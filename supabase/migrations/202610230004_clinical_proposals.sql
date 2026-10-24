BEGIN;
CREATE TABLE public.clinical_proposals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 consultation_id uuid NOT NULL REFERENCES public.clinical_drafts(consultation_id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES public.users(id),
 base_revision integer NOT NULL CHECK(base_revision>=0),
 through_segment_id uuid NOT NULL REFERENCES public.clinical_segments(id) ON DELETE RESTRICT,
 operations jsonb NOT NULL CHECK(jsonb_typeof(operations)='array' AND jsonb_array_length(operations)<=30),
 source_snapshot jsonb NOT NULL,
 result_kind text NOT NULL CHECK(result_kind IN ('offline_fixture','generated')),
 state text NOT NULL CHECK(state IN ('review_required','stale','accepted','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 accepted_key uuid,accepted_revision integer,accepted_result jsonb
);
ALTER TABLE public.clinical_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinical_proposals FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.clinical_proposals TO service_role;
GRANT SELECT ON public.clinical_proposals TO authenticated;
CREATE POLICY proposals_treating ON public.clinical_proposals FOR SELECT TO authenticated USING(actor_id=private.current_app_user_id() AND private.can_edit_encounter(consultation_id));
CREATE FUNCTION private.actor_can_edit_encounter(a uuid,c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.consultations x JOIN public.users u ON u.id=x.doctor_id JOIN public.workspace_memberships m ON m.user_id=u.id AND m.workspace_id=x.workspace_id
 WHERE x.id=c AND u.id=a AND u.is_active AND u.role='doctor' AND m.role='doctor' AND m.status='active' AND EXISTS(SELECT 1 FROM public.care_relationships r WHERE r.patient_id=x.patient_id AND r.workspace_id=x.workspace_id AND r.provider_id=a AND r.scope='clinical' AND r.revoked_at IS NULL))
$$;
REVOKE ALL ON FUNCTION private.actor_can_edit_encounter(uuid,uuid) FROM PUBLIC,anon,authenticated;
-- Worker-only publication. DB validates source identity as well as the typed
-- validator in the shared service. A stale result is saved for review, never
-- written into clinician fields. No external execution is admitted here.
CREATE FUNCTION public.clinical_offer(a uuid,c uuid,p jsonb,mode text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d public.clinical_drafts; op jsonb; sid jsonb; cursor_seq integer; pid uuid; source jsonb;
BEGIN
 PERFORM 1 FROM public.consultations WHERE id=c AND status='active' FOR UPDATE;
 IF NOT FOUND OR NOT private.actor_can_edit_encounter(a,c) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF mode IS DISTINCT FROM 'offline_fixture' THEN RAISE EXCEPTION 'PROVIDER_NOT_AUTHORIZED'; END IF;
 SELECT * INTO d FROM public.clinical_drafts WHERE consultation_id=c FOR UPDATE;
 IF (SELECT count(*) FROM public.clinical_proposals WHERE consultation_id=c)>=100 THEN RAISE EXCEPTION 'OPERATION_LIMIT';END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>65536 OR (SELECT count(*) FROM jsonb_object_keys(p))<>3 OR NOT(p ?& ARRAY['baseRevision','throughSegmentId','operations']) OR jsonb_typeof(p->'baseRevision') IS DISTINCT FROM 'number' OR (p->>'baseRevision')::numeric<>trunc((p->>'baseRevision')::numeric) OR (p->>'baseRevision')::integer<0 OR (p->>'baseRevision')::integer>d.revision OR jsonb_typeof(p->'operations') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'operations')>30 THEN RAISE EXCEPTION 'INVALID_PROPOSAL'; END IF;
 SELECT sequence INTO cursor_seq FROM public.clinical_segments WHERE id=(p->>'throughSegmentId')::uuid AND consultation_id=c;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_CURSOR'; END IF;
 FOR op IN SELECT value FROM jsonb_array_elements(p->'operations') LOOP
 IF jsonb_typeof(op) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(op) t(k) WHERE k<>ALL(ARRAY['op','path','value','evidence_segment_ids','note'])) OR jsonb_typeof(op->'op') IS DISTINCT FROM 'string' OR (op->>'op')<>ALL(ARRAY['set_fact','update_fact','retract_fact','mark_uncertain']) OR jsonb_typeof(op->'path') IS DISTINCT FROM 'string' OR (op->>'path')<>ALL(ARRAY['chief_complaint','physical_examination','symptoms','diagnosis','medications','lab_tests_ordered','vitals','clinical_summary']) OR jsonb_typeof(op->'evidence_segment_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(op->'evidence_segment_ids') NOT BETWEEN 1 AND 10 OR (op->>'op'=ANY(ARRAY['set_fact','update_fact']) AND NOT(op ? 'value')) THEN RAISE EXCEPTION 'INVALID_PROPOSAL';END IF;
 FOR sid IN SELECT value FROM jsonb_array_elements(op->'evidence_segment_ids') LOOP
 IF jsonb_typeof(sid)<>'string' OR NOT EXISTS(SELECT 1 FROM public.clinical_segments WHERE id=(sid#>>'{}')::uuid AND consultation_id=c AND sequence<=cursor_seq) THEN RAISE EXCEPTION 'INVALID_SOURCE';END IF;
 END LOOP;END LOOP;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'sequence',sequence,'text',text,'speaker',speaker,'language',language) ORDER BY sequence),'[]') INTO source FROM public.clinical_segments WHERE consultation_id=c AND id IN(SELECT (source_item.identity#>>'{}')::uuid FROM jsonb_array_elements(p->'operations') AS op_item(payload),LATERAL jsonb_array_elements(op_item.payload->'evidence_segment_ids') AS source_item(identity));
 INSERT INTO public.clinical_proposals(consultation_id,actor_id,base_revision,through_segment_id,operations,source_snapshot,result_kind,state)
 VALUES(c,a,(p->>'baseRevision')::integer,(p->>'throughSegmentId')::uuid,p->'operations',source,mode,CASE WHEN d.revision=(p->>'baseRevision')::integer THEN 'review_required' ELSE 'stale' END) RETURNING id INTO pid;RETURN pid;
END $$;
REVOKE ALL ON FUNCTION public.clinical_offer(uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinical_offer(uuid,uuid,jsonb,text) TO service_role;

CREATE FUNCTION public.clinical_apply_proposal(k uuid,pid uuid,expected integer,decision text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
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
 s:=jsonb_set(s,ARRAY[op->>'path'],op->'value');
 prov:=jsonb_set(prov,ARRAY[op->>'path'],jsonb_build_object('sourceType','generated_proposal','proposalId',p.id,'resultKind',p.result_kind,'evidenceSegmentIds',op->'evidence_segment_ids','lastEditor',private.current_app_user_id(),'revision',expected+1));
 END IF;END LOOP;
 result:=public.clinical_mutate(k,jsonb_build_object('action','save','consultationId',c.id,'expectedRevision',expected,'snapshot',s));
 UPDATE public.clinical_drafts SET provenance=prov WHERE consultation_id=c.id;
 UPDATE public.clinical_proposals SET state='accepted',accepted_key=k,accepted_revision=expected,accepted_result=result WHERE id=pid;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.clinical_apply_proposal(uuid,uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinical_apply_proposal(uuid,uuid,integer,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
