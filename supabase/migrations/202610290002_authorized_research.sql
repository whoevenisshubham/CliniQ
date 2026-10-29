BEGIN;
-- Research membership conveys no clinical-table permission. Data release is separate.
ALTER TABLE public.workspace_memberships DROP CONSTRAINT workspace_memberships_role_check;
ALTER TABLE public.workspace_memberships ADD CONSTRAINT workspace_memberships_role_check CHECK(role IN ('doctor','receptionist','admin','nurse','research'));
CREATE TABLE private.research_permissions(workspace_id uuid REFERENCES public.workspaces(id),user_id uuid REFERENCES public.users(id),enabled boolean NOT NULL,revision integer NOT NULL,granted_by uuid REFERENCES public.users(id),PRIMARY KEY(workspace_id,user_id));
CREATE TABLE private.research_authorizations(patient_id uuid REFERENCES public.patients(id),workspace_id uuid REFERENCES public.workspaces(id),enabled boolean NOT NULL,revision integer NOT NULL,terms_version integer NOT NULL DEFAULT 1,PRIMARY KEY(patient_id,workspace_id));
CREATE TABLE private.research_operations(actor_id uuid REFERENCES public.users(id),operation_key uuid,command jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,operation_key));
CREATE TABLE private.research_releases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid REFERENCES public.workspaces(id),quarter date NOT NULL,created_by uuid REFERENCES public.users(id),created_at timestamptz NOT NULL DEFAULT now(),state text NOT NULL CHECK(state IN ('released','withheld')),visits_lower_bound integer,participants_lower_bound integer,source_versions uuid[] NOT NULL,consent_versions jsonb NOT NULL,UNIQUE(workspace_id,quarter));
REVOKE ALL ON private.research_permissions,private.research_authorizations,private.research_operations,private.research_releases FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.clinical_approved_index() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_agg(row ORDER BY reviewed_at DESC),'[]'::jsonb) FROM (
 SELECT to_jsonb(v)||jsonb_build_object('reviewer_name',u.name,'encounter_at',c.started_at) AS row,v.reviewed_at
 FROM public.emr_versions v JOIN public.consultations c ON c.id=v.consultation_id JOIN public.users u ON u.id=v.reviewed_by
 WHERE private.can_read_approved(c.id) ORDER BY v.reviewed_at DESC,v.id LIMIT 50)x
$$;

CREATE FUNCTION public.research_owner_view() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p uuid;BEGIN
 SELECT id INTO p FROM public.patients WHERE user_id=private.current_app_user_id();IF p IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'enabled',coalesce(a.enabled,false),'revision',coalesce(a.revision,0)))
 FROM public.workspaces w LEFT JOIN private.research_authorizations a ON a.workspace_id=w.id AND a.patient_id=p
 WHERE a.patient_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.consultations c JOIN public.emr_versions v ON v.consultation_id=c.id WHERE c.workspace_id=w.id AND c.patient_id=p)),'[]'::jsonb);
END $$;
CREATE FUNCTION public.research_consent(k uuid,w uuid,allow boolean,expected integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();p uuid;old private.research_operations;r integer;cmd jsonb;outcome jsonb;BEGIN
 IF k IS NULL OR w IS NULL OR allow IS NULL OR expected IS NULL OR expected<0 THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 SELECT id INTO p FROM public.patients WHERE user_id=a FOR UPDATE;IF p IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 cmd:=jsonb_build_object('action','consent','workspace',w,'allow',allow,'expected',expected);
 SELECT * INTO old FROM private.research_operations WHERE actor_id=a AND operation_key=k;
 IF FOUND THEN IF old.command<>cmd THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN old.result;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.consultations c JOIN public.emr_versions v ON v.consultation_id=c.id WHERE c.workspace_id=w AND c.patient_id=p) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT revision INTO r FROM private.research_authorizations WHERE patient_id=p AND workspace_id=w;
 IF coalesce(r,0)<>expected THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 INSERT INTO private.research_authorizations(patient_id,workspace_id,enabled,revision) VALUES(p,w,allow,expected+1) ON CONFLICT(patient_id,workspace_id) DO UPDATE SET enabled=excluded.enabled,revision=excluded.revision;
 outcome:=jsonb_build_object('revision',expected+1,'enabled',allow);
 INSERT INTO private.research_operations VALUES(a,k,cmd,outcome,now());RETURN outcome;
END $$;

CREATE FUNCTION public.research_workspaces() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name)),'[]'::jsonb) FROM public.workspaces w WHERE private.has_workspace_role(w.id,ARRAY['research','admin'])
$$;
CREATE FUNCTION private.research_release_valid(r private.research_releases) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT r.state='released' AND cardinality(r.source_versions)>0 AND NOT EXISTS(
 SELECT 1 FROM jsonb_each_text(r.consent_versions) x LEFT JOIN private.research_authorizations a ON a.patient_id=x.key::uuid AND a.workspace_id=r.workspace_id
 WHERE a.patient_id IS NULL OR NOT a.enabled OR a.revision<>x.value::integer)
 AND NOT EXISTS(SELECT 1 FROM public.consultations c WHERE c.amendment_of=ANY(r.source_versions))
 AND NOT EXISTS(SELECT 1 FROM unnest(r.source_versions) source(id) WHERE NOT EXISTS(SELECT 1 FROM public.emr_versions v JOIN public.consultations c ON c.id=v.consultation_id WHERE v.id=source.id AND c.workspace_id=r.workspace_id))
$$;
REVOKE ALL ON FUNCTION private.research_release_valid(private.research_releases) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.research_view(w uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();is_admin boolean;allowed boolean;BEGIN
 is_admin:=private.has_workspace_role(w,ARRAY['admin']);
 allowed:=is_admin OR (private.has_workspace_role(w,ARRAY['research']) AND EXISTS(SELECT 1 FROM private.research_permissions WHERE workspace_id=w AND user_id=a AND enabled));
 IF NOT allowed THEN RAISE EXCEPTION 'RESEARCH_PERMISSION_REQUIRED';END IF;
 RETURN jsonb_build_object('workspaceId',w,'canManage',is_admin,'coverage','approved-care activity only; no disease prevalence or individual cases',
 'members',CASE WHEN is_admin THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'enabled',coalesce(p.enabled,false),'revision',coalesce(p.revision,0))) FROM public.workspace_memberships m JOIN public.users u ON u.id=m.user_id LEFT JOIN private.research_permissions p ON p.workspace_id=w AND p.user_id=u.id WHERE m.workspace_id=w AND m.role='research' AND m.status='active' AND u.role='research' AND u.is_active),'[]'::jsonb) ELSE '[]'::jsonb END,
 'releases',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'quarter',r.quarter,'createdAt',r.created_at,'state',CASE WHEN r.state='withheld' THEN 'withheld' WHEN private.research_release_valid(r) THEN 'released' ELSE 'withdrawn' END)||CASE WHEN private.research_release_valid(r) THEN jsonb_build_object('visitsLowerBound',r.visits_lower_bound,'participantsLowerBound',r.participants_lower_bound) ELSE '{}'::jsonb END ORDER BY r.quarter DESC) FROM private.research_releases r WHERE r.workspace_id=w),'[]'::jsonb));
END $$;
CREATE FUNCTION public.research_manage(k uuid,command jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();w uuid;target uuid;expected integer;q date;old private.research_operations;outcome jsonb;versions uuid[];consents jsonb;n integer;v integer;rid uuid;BEGIN
 IF k IS NULL OR jsonb_typeof(command) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 w:=(command->>'workspaceId')::uuid;IF NOT private.has_workspace_role(w,ARRAY['admin']) THEN RAISE EXCEPTION 'ADMIN_REQUIRED';END IF;
 PERFORM 1 FROM public.workspaces WHERE id=w FOR UPDATE;
 SELECT * INTO old FROM private.research_operations WHERE actor_id=a AND operation_key=k;
 IF FOUND THEN IF old.command<>command THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN old.result;END IF;
 IF command->>'action'='authorize' THEN
  IF (SELECT count(*) FROM jsonb_object_keys(command))<>5 OR jsonb_typeof(command->'enabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
  target:=(command->>'memberId')::uuid;expected:=(command->>'expectedRevision')::integer;
  IF expected IS NULL OR expected<0 OR NOT EXISTS(SELECT 1 FROM public.workspace_memberships m JOIN public.users u ON u.id=m.user_id WHERE m.workspace_id=w AND m.user_id=target AND m.role='research' AND m.status='active' AND u.role='research' AND u.is_active) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  SELECT revision INTO v FROM private.research_permissions WHERE workspace_id=w AND user_id=target;
  IF coalesce(v,0)<>expected THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
  INSERT INTO private.research_permissions VALUES(w,target,(command->>'enabled')::boolean,expected+1,a) ON CONFLICT(workspace_id,user_id) DO UPDATE SET enabled=excluded.enabled,revision=excluded.revision,granted_by=excluded.granted_by;
  outcome:=jsonb_build_object('memberId',target,'revision',expected+1);
 ELSIF command->>'action'='release' THEN
  IF (SELECT count(*) FROM jsonb_object_keys(command))<>3 THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
  q:=(command->>'quarter')::date;
  IF q IS NULL OR q<>date_trunc('quarter',q)::date OR q>=date_trunc('quarter',timezone('UTC',now()))::date OR q<date_trunc('quarter',timezone('UTC',now()))::date-interval '5 years' THEN RAISE EXCEPTION 'INVALID_QUARTER';END IF;
  IF EXISTS(SELECT 1 FROM private.research_releases WHERE workspace_id=w AND quarter=q) THEN RAISE EXCEPTION 'RELEASE_EXISTS';END IF;
  IF (SELECT count(*) FROM private.research_releases WHERE workspace_id=w)>=20 THEN RAISE EXCEPTION 'RELEASE_LIMIT';END IF;
  WITH current_versions AS(SELECT DISTINCT ON(c.id) v.id,c.patient_id,a.revision FROM public.consultations c JOIN public.emr_versions v ON v.consultation_id=c.id JOIN private.research_authorizations a ON a.patient_id=c.patient_id AND a.workspace_id=w AND a.enabled AND a.terms_version=1
   WHERE c.workspace_id=w AND c.started_at>=(q::timestamp AT TIME ZONE 'UTC') AND c.started_at<((q+interval '3 months') AT TIME ZONE 'UTC') AND NOT EXISTS(SELECT 1 FROM public.consultations newer WHERE newer.amendment_of=v.id) ORDER BY c.id,v.version_no DESC LIMIT 5001)
  SELECT coalesce(array_agg(id),'{}'::uuid[]),coalesce(jsonb_object_agg(patient_id::text,revision),'{}'::jsonb),count(DISTINCT patient_id),count(*) INTO versions,consents,n,v FROM current_versions;
  IF v>5000 THEN RAISE EXCEPTION 'RELEASE_LIMIT';END IF;
  INSERT INTO private.research_releases(workspace_id,quarter,created_by,state,visits_lower_bound,participants_lower_bound,source_versions,consent_versions)
  VALUES(w,q,a,CASE WHEN n>=5 THEN 'released' ELSE 'withheld' END,CASE WHEN n>=5 THEN (v/5)*5 END,CASE WHEN n>=5 THEN (n/5)*5 END,versions,consents) RETURNING id INTO rid;
  outcome:=jsonb_build_object('releaseId',rid,'state',CASE WHEN n>=5 THEN 'released' ELSE 'withheld' END);
 ELSE RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 INSERT INTO private.research_operations VALUES(a,k,command,outcome,now());RETURN outcome;
END $$;
REVOKE ALL ON FUNCTION public.clinical_approved_index(),public.research_owner_view(),public.research_consent(uuid,uuid,boolean,integer),public.research_workspaces(),public.research_view(uuid),public.research_manage(uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.clinical_approved_index(),public.research_owner_view(),public.research_consent(uuid,uuid,boolean,integer),public.research_workspaces(),public.research_view(uuid),public.research_manage(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
