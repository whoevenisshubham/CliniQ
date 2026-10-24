BEGIN;
CREATE TABLE public.illustrative_tariffs(
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),version text NOT NULL CHECK(length(version) BETWEEN 1 AND 100),effective_on date NOT NULL,
 synthetic boolean NOT NULL CHECK(synthetic),source_revision text NOT NULL,items jsonb NOT NULL CHECK(jsonb_typeof(items)='array' AND jsonb_array_length(items) BETWEEN 1 AND 60),PRIMARY KEY(workspace_id,version)
);
ALTER TABLE public.illustrative_tariffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.illustrative_tariffs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.illustrative_tariffs TO service_role;
CREATE TRIGGER tariff_version_immutable BEFORE UPDATE OR DELETE ON public.illustrative_tariffs FOR EACH ROW EXECUTE FUNCTION private.immutable_approved();
ALTER TABLE public.billing_drafts ADD COLUMN subtotal_paise bigint;
ALTER TABLE public.billing_drafts ADD COLUMN tax_paise bigint;
ALTER TABLE public.billing_drafts ADD COLUMN total_paise bigint;
-- NUMERIC(10,2) multiplication is exact. Original rupee fields and items remain.
UPDATE public.billing_drafts SET subtotal_paise=(subtotal*100)::bigint,tax_paise=(tax*100)::bigint,total_paise=(total*100)::bigint;
ALTER TABLE public.billing_drafts ADD CONSTRAINT billing_integer_nonnegative CHECK(subtotal_paise>=0 AND tax_paise>=0 AND total_paise>=0);
ALTER TABLE public.billing_drafts ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);
ALTER TABLE public.billing_drafts ADD COLUMN tariff_version text;
ALTER TABLE public.billing_drafts ADD COLUMN reviewed_items jsonb;
ALTER TABLE public.billing_drafts ADD COLUMN approved_source uuid REFERENCES public.emr_versions(id);
ALTER TABLE public.billing_drafts ADD COLUMN reviewed_by uuid REFERENCES public.users(id);
ALTER TABLE public.billing_drafts ADD COLUMN reviewed_at timestamptz;
CREATE TABLE public.billing_revisions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bill_id uuid NOT NULL REFERENCES public.billing_drafts(id),revision integer NOT NULL,
 source_version uuid NOT NULL REFERENCES public.emr_versions(id),tariff_version text NOT NULL,items jsonb NOT NULL,total_paise bigint NOT NULL CHECK(total_paise BETWEEN 0 AND 1000000000),
 reviewed_by uuid NOT NULL REFERENCES public.users(id),reviewed_at timestamptz NOT NULL DEFAULT now(),previous_record jsonb NOT NULL,UNIQUE(bill_id,revision)
);
ALTER TABLE public.billing_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_revisions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.billing_revisions TO service_role;
CREATE TRIGGER bill_revision_immutable BEFORE UPDATE OR DELETE ON public.billing_revisions FOR EACH ROW EXECUTE FUNCTION private.immutable_approved();

CREATE FUNCTION public.illustrative_billing_view(cid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.consultations;b public.billing_drafts;tariffs jsonb;versions jsonb;history jsonb;BEGIN
 IF NOT private.can_read_approved(cid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;SELECT * INTO c FROM public.consultations WHERE id=cid;
 SELECT * INTO b FROM public.billing_drafts WHERE consultation_id=cid;
 SELECT coalesce(jsonb_agg(jsonb_build_object('version',t.version,'effectiveOn',t.effective_on,'items',t.items,'sourceRevision',t.source_revision) ORDER BY t.effective_on DESC),'[]') INTO tariffs FROM public.illustrative_tariffs t WHERE t.workspace_id=c.workspace_id;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.id,'reviewedAt',v.reviewed_at)),'[]') INTO versions FROM public.emr_versions v WHERE v.consultation_id=cid AND NOT EXISTS(SELECT 1 FROM public.emr_versions n WHERE n.amended_from_id=v.id);
 SELECT coalesce(jsonb_agg(jsonb_build_object('revision',r.revision,'sourceVersion',r.source_version,'tariffVersion',r.tariff_version,'items',r.items,'totalPaise',r.total_paise,'reviewedAt',r.reviewed_at) ORDER BY r.revision DESC),'[]') INTO history FROM public.billing_revisions r WHERE r.bill_id=b.id;
 RETURN jsonb_build_object('canReview',private.can_edit_encounter(cid),'revision',b.revision,'bill',CASE WHEN b.reviewed_at IS NOT NULL THEN jsonb_build_object('id',b.id,'items',b.reviewed_items,'subtotalPaise',b.subtotal_paise,'taxPaise',NULL,'totalPaise',b.total_paise,'taxStatus','not_assessed','tariffVersion',b.tariff_version,'sourceVersion',b.approved_source,'reviewedAt',b.reviewed_at,'sourceCurrent',NOT EXISTS(SELECT 1 FROM public.emr_versions n WHERE n.amended_from_id=b.approved_source)) ELSE NULL END,'tariffs',tariffs,'approvedVersions',versions,'history',history);
END $$;
CREATE FUNCTION public.illustrative_billing_review(k uuid,cid uuid,command jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();c public.consultations;v public.emr_versions;b public.billing_drafts;t public.illustrative_tariffs;prior public.care_operations;row jsonb;item jsonb;priced jsonb:='[]';quantity integer;unit_paise bigint;sum_paise bigint:=0;before_value jsonb;response jsonb;BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('care-actor:'||a::text,0));
 SELECT * INTO c FROM public.consultations WHERE id=cid FOR UPDATE;
 IF NOT FOUND OR NOT private.can_edit_encounter(cid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 PERFORM private.lock_clinical_access(c.patient_id,c.workspace_id);
 IF k IS NULL OR jsonb_typeof(command) IS DISTINCT FROM 'object' OR octet_length(command::text)>8192 OR EXISTS(SELECT 1 FROM jsonb_object_keys(command) f WHERE f<>ALL(ARRAY['expectedRevision','approvedVersionId','tariffVersion','items','confirmed'])) THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 SELECT * INTO v FROM public.emr_versions WHERE id=(command->>'approvedVersionId')::uuid AND consultation_id=cid FOR SHARE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.emr_versions n WHERE n.amended_from_id=v.id) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT * INTO prior FROM public.care_operations WHERE actor_id=a AND operation_key=k;
 IF FOUND THEN IF prior.command<>command||jsonb_build_object('consultationId',cid,'action','billing_review') THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN prior.response;END IF;
 IF (SELECT count(*) FROM public.care_operations WHERE actor_id=a AND created_at>now()-interval '1 day')>=100 THEN RAISE EXCEPTION 'OPERATION_LIMIT';END IF;
 IF command->'confirmed' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(command->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(command->'items') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'REVIEW_REQUIRED';END IF;
 SELECT * INTO t FROM public.illustrative_tariffs WHERE workspace_id=c.workspace_id AND version=command->>'tariffVersion';IF NOT FOUND THEN RAISE EXCEPTION 'TARIFF_UNAVAILABLE';END IF;
 IF (SELECT count(DISTINCT x->>'itemId') FROM jsonb_array_elements(command->'items') x)<>jsonb_array_length(command->'items') THEN RAISE EXCEPTION 'INVALID_ITEMS';END IF;
 FOR row IN SELECT * FROM jsonb_array_elements(command->'items') LOOP
 IF jsonb_typeof(row) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(row))<>2 OR EXISTS(SELECT 1 FROM jsonb_object_keys(row) x WHERE x<>ALL(ARRAY['itemId','quantity'])) OR jsonb_typeof(row->'quantity') IS DISTINCT FROM 'number' OR row->>'quantity'!~'^\d{1,3}$' OR (row->>'quantity')::integer NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'INVALID_ITEMS';END IF;
 SELECT x INTO item FROM jsonb_array_elements(t.items) x WHERE x->>'id'=row->>'itemId';IF NOT FOUND OR jsonb_typeof(item->'unitPaise') IS DISTINCT FROM 'number' OR item->>'unitPaise'!~'^\d{1,7}$' OR (item->>'unitPaise')::bigint NOT BETWEEN 0 AND 1000000 THEN RAISE EXCEPTION 'INVALID_ITEMS';END IF;
 quantity:=(row->>'quantity')::integer;unit_paise:=(item->>'unitPaise')::bigint;sum_paise:=sum_paise+quantity*unit_paise;
 priced:=priced||jsonb_build_array(jsonb_build_object('itemId',item->>'id','description',item->>'description','category',item->>'category','quantity',quantity,'unitPaise',unit_paise,'totalPaise',quantity*unit_paise));
 END LOOP;
 IF sum_paise>1000000000 THEN RAISE EXCEPTION 'INVALID_ITEMS';END IF;
 SELECT * INTO b FROM public.billing_drafts WHERE consultation_id=cid FOR UPDATE;
 IF FOUND THEN IF b.revision IS DISTINCT FROM (command->>'expectedRevision')::integer THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;before_value:=to_jsonb(b);
 ELSE IF command->'expectedRevision' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;INSERT INTO public.billing_drafts(consultation_id) VALUES(cid) RETURNING * INTO b;before_value:=to_jsonb(b);END IF;
 UPDATE public.billing_drafts SET revision=revision+1,tariff_version=t.version,reviewed_items=priced,approved_source=v.id,reviewed_by=a,reviewed_at=now(),subtotal_paise=sum_paise,tax_paise=NULL,total_paise=sum_paise WHERE id=b.id RETURNING * INTO b;
 INSERT INTO public.billing_revisions(bill_id,revision,source_version,tariff_version,items,total_paise,reviewed_by,previous_record) VALUES(b.id,b.revision,v.id,t.version,priced,sum_paise,a,before_value);
 response:=jsonb_build_object('billId',b.id,'revision',b.revision,'totalPaise',sum_paise,'illustrative',true,'taxStatus','not_assessed');
 INSERT INTO public.care_operations(actor_id,operation_key,command,response) VALUES(a,k,command||jsonb_build_object('consultationId',cid,'action','billing_review'),response);RETURN response;
END $$;
REVOKE ALL ON FUNCTION public.illustrative_billing_view(uuid),public.illustrative_billing_review(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.illustrative_billing_view(uuid),public.illustrative_billing_review(uuid,uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
