BEGIN;
CREATE TABLE private.safety_reviews(actor_id uuid REFERENCES public.users(id),operation_key uuid,consultation_id uuid REFERENCES public.consultations(id),version_id uuid REFERENCES public.emr_versions(id),source_key text NOT NULL,rule_id text NOT NULL,state text NOT NULL CHECK(state IN ('reviewed','dismissed')),note text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,operation_key));
CREATE INDEX safety_reviews_encounter ON private.safety_reviews(consultation_id,created_at DESC);
REVOKE ALL ON private.safety_reviews FROM PUBLIC,anon,authenticated,service_role;
-- Only the scoped server evaluator can attest which identified rules matched.
-- One bounded presentation per actor/encounter; clients cannot mint arbitrary receipts.
CREATE TABLE private.safety_presentations(actor_id uuid REFERENCES public.users(id),consultation_id uuid REFERENCES public.consultations(id),source_key text NOT NULL,rule_ids text[] NOT NULL CHECK(cardinality(rule_ids)<=200),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,consultation_id));
REVOKE ALL ON private.safety_presentations FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.clinical_safety_present(actor uuid,cid uuid,source text,rules text[]) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF source IS NULL OR source!~'^[a-f0-9]{32}$' OR rules IS NULL OR cardinality(rules)>200 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=actor AND role='doctor' AND is_active) THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 INSERT INTO private.safety_presentations VALUES(actor,cid,source,rules,now()) ON CONFLICT(actor_id,consultation_id) DO UPDATE SET source_key=excluded.source_key,rule_ids=excluded.rule_ids,created_at=excluded.created_at;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.clinical_safety_present(uuid,uuid,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinical_safety_present(uuid,uuid,text,text[]) TO service_role;
CREATE FUNCTION public.clinical_safety_view(cid uuid,vid uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.consultations;p public.patients;s jsonb;ctx jsonb;current_source boolean;key text;BEGIN
 IF NOT private.can_edit_encounter(cid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT * INTO c FROM public.consultations WHERE id=cid;SELECT * INTO p FROM public.patients WHERE id=c.patient_id;
 IF vid IS NULL AND c.status<>'active' THEN SELECT id INTO vid FROM public.emr_versions WHERE consultation_id=cid ORDER BY version_no DESC LIMIT 1;END IF;
 IF vid IS NULL THEN SELECT snapshot,clinical_context INTO s,ctx FROM public.clinical_drafts WHERE consultation_id=cid;current_source:=c.status='active';
 ELSE SELECT snapshot,clinical_context INTO s,ctx FROM public.emr_versions WHERE id=vid AND consultation_id=cid;current_source:=NOT EXISTS(SELECT 1 FROM public.consultations WHERE amendment_of=vid);END IF;
 IF s IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 key:=md5(jsonb_build_object('rulePack','reviewed-label-pairs-2026-10-29','revision',c.revision,'version',vid,'allergies',p.allergies,'snapshot',s,'context',ctx,'current',current_source)::text);
 RETURN jsonb_build_object('rulePack','reviewed-label-pairs-2026-10-29','consultationId',cid,'patientName',p.name,'revision',c.revision,'versionId',vid,'sourceKey',key,'currentSource',current_source,'allergies',coalesce(to_jsonb(p.allergies),'[]'::jsonb),'snapshot',s,'context',ctx,
 'reviews',coalesce((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM(SELECT rule_id,state,note,source_key,created_at FROM private.safety_reviews WHERE consultation_id=cid AND actor_id=private.current_app_user_id() AND version_id IS NOT DISTINCT FROM vid ORDER BY created_at DESC LIMIT 100)x),'[]'::jsonb));
END $$;
CREATE FUNCTION public.clinical_safety_review(k uuid,cid uuid,vid uuid,source text,rule text,decision text,reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();old private.safety_reviews;v jsonb;p uuid;BEGIN
 IF NOT private.can_edit_encounter(cid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF k IS NULL OR rule IS NULL OR rule!~'^[a-zA-Z0-9:_-]{1,160}$' OR decision IS NULL OR decision NOT IN ('reviewed','dismissed') OR reason IS NULL OR length(trim(reason)) NOT BETWEEN 20 AND 500 THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 SELECT patient_id INTO p FROM public.consultations WHERE id=cid FOR UPDATE;PERFORM 1 FROM public.patients WHERE id=p FOR UPDATE;
 SELECT * INTO old FROM private.safety_reviews WHERE actor_id=a AND operation_key=k;
 IF FOUND THEN
 IF old.consultation_id<>cid OR old.version_id IS DISTINCT FROM vid OR old.source_key<>source OR old.rule_id<>rule OR old.state<>decision OR old.note<>reason THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
 RETURN jsonb_build_object('recorded',true);END IF;
 v:=public.clinical_safety_view(cid,vid);
 IF v->>'sourceKey' IS DISTINCT FROM source OR NOT(v->>'currentSource')::boolean THEN RAISE EXCEPTION 'STALE_SAFETY_CONTEXT';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.safety_presentations p WHERE p.actor_id=a AND p.consultation_id=cid AND p.source_key=source AND rule=ANY(p.rule_ids) AND p.created_at>now()-interval '30 minutes') THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 INSERT INTO private.safety_reviews VALUES(a,k,cid,vid,source,rule,decision,reason,now());RETURN jsonb_build_object('recorded',true);
END $$;
REVOKE ALL ON FUNCTION public.clinical_safety_view(uuid,uuid),public.clinical_safety_review(uuid,uuid,uuid,text,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.clinical_safety_view(uuid,uuid),public.clinical_safety_review(uuid,uuid,uuid,text,text,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
