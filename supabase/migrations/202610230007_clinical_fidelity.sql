BEGIN;
-- Proposals are deltas. Omission never silently stops another saved medicine.
CREATE FUNCTION private.merge_medication_delta(existing jsonb,incoming jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE result jsonb;BEGIN
 IF jsonb_typeof(incoming) IS DISTINCT FROM 'array' OR jsonb_array_length(incoming)<>(SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(incoming)) THEN RAISE EXCEPTION 'INVALID_MEDICATION';END IF;
 SELECT coalesce(jsonb_agg(x.item ORDER BY x.ordering),'[]') INTO result FROM(
 SELECT coalesce((SELECT value FROM jsonb_array_elements(incoming) WHERE value->>'id'=old.item->>'id'),old.item) item,old.pos ordering FROM jsonb_array_elements(existing) WITH ORDINALITY old(item,pos)
 UNION ALL SELECT fresh.item,1000+fresh.pos FROM jsonb_array_elements(incoming) WITH ORDINALITY fresh(item,pos) WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(existing) old WHERE old->>'id'=fresh.item->>'id')
 ) x;RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.merge_medication_delta(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.medication_field_provenance(old_meds jsonb,new_meds jsonb,prior jsonb,metadata jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE item jsonb;old_item jsonb;field text;fields jsonb;items jsonb:='{}';BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements(new_meds) LOOP
 SELECT value INTO old_item FROM jsonb_array_elements(old_meds) WHERE value->>'id'=item->>'id';fields:='{}';
 FOREACH field IN ARRAY ARRAY['name','dose','frequency','duration','route','instructions','unknownFields'] LOOP
 fields:=jsonb_set(fields,ARRAY[field],CASE WHEN old_item IS NOT NULL AND old_item->field IS NOT DISTINCT FROM item->field THEN coalesce(prior->'items'->(item->>'id')->field,prior-'items',metadata) ELSE metadata END);
 END LOOP;items:=jsonb_set(items,ARRAY[item->>'id'],fields);
 END LOOP;RETURN jsonb_set(metadata,ARRAY['items'],items);
END $$;
REVOKE ALL ON FUNCTION private.medication_field_provenance(jsonb,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.track_manual_medication_provenance() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 IF OLD.snapshot->'medications' IS DISTINCT FROM NEW.snapshot->'medications' THEN
 NEW.provenance:=jsonb_set(NEW.provenance,ARRAY['medications'],private.medication_field_provenance(OLD.snapshot->'medications',NEW.snapshot->'medications',coalesce(OLD.provenance->'medications','{}'),coalesce(NEW.provenance->'medications','{}')-'items'));
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.track_manual_medication_provenance() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER clinical_medication_provenance BEFORE UPDATE OF snapshot ON public.clinical_drafts FOR EACH ROW EXECUTE FUNCTION private.track_manual_medication_provenance();
CREATE OR REPLACE FUNCTION public.clinical_apply_proposal(k uuid,pid uuid,expected integer,decision text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p public.clinical_proposals;c public.consultations;d public.clinical_drafts;op jsonb;s jsonb;result jsonb;prov jsonb;
BEGIN
 SELECT * INTO p FROM public.clinical_proposals WHERE id=pid;
 IF NOT FOUND OR p.actor_id IS DISTINCT FROM private.current_app_user_id() OR NOT private.can_edit_encounter(p.consultation_id) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT * INTO c FROM public.consultations WHERE id=p.consultation_id FOR UPDATE;
 SELECT * INTO p FROM public.clinical_proposals WHERE id=pid FOR UPDATE;
 IF p.accepted_key=k THEN IF expected<>p.accepted_revision OR decision<>'accept' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN p.accepted_result;END IF;
 IF c.status<>'active' OR c.revision<>expected OR p.state<>ALL(ARRAY['review_required','stale']) THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
 IF decision='reject' THEN UPDATE public.clinical_proposals SET state='rejected' WHERE id=pid;RETURN jsonb_build_object('consultationId',c.id,'revision',c.revision);END IF;
 IF decision IS DISTINCT FROM 'accept' THEN RAISE EXCEPTION 'INVALID_COMMAND'; END IF;
 IF p.base_revision<>c.revision THEN RAISE EXCEPTION 'STALE_PROPOSAL'; END IF;
 SELECT * INTO d FROM public.clinical_drafts WHERE consultation_id=c.id FOR UPDATE;s:=d.snapshot;prov:=d.provenance;
 FOR op IN SELECT value FROM jsonb_array_elements(p.operations) LOOP
 IF op->>'op'=ANY(ARRAY['set_fact','update_fact']) THEN
 s:=jsonb_set(s,ARRAY[op->>'path'],CASE WHEN op->>'path'='medications' THEN private.merge_medication_delta(s->'medications',op->'value') ELSE op->'value' END);
 prov:=jsonb_set(prov,ARRAY[op->>'path'],jsonb_build_object('sourceType','generated_proposal','proposalId',p.id,'resultKind',p.result_kind,'evidenceSegmentIds',op->'evidence_segment_ids','lastEditor',private.current_app_user_id(),'revision',expected+1));
 END IF;END LOOP;
 result:=public.clinical_mutate(k,jsonb_build_object('action','save','consultationId',c.id,'expectedRevision',expected,'snapshot',s));
 IF s->'medications' IS DISTINCT FROM d.snapshot->'medications' THEN prov:=jsonb_set(prov,ARRAY['medications'],private.medication_field_provenance(d.snapshot->'medications',s->'medications',coalesce(d.provenance->'medications','{}'),coalesce(prov->'medications','{}')-'items'));END IF;
 UPDATE public.clinical_drafts SET provenance=prov WHERE consultation_id=c.id;
 UPDATE public.clinical_proposals SET state='accepted',accepted_key=k,accepted_revision=expected,accepted_result=result WHERE id=pid;
 RETURN result;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
