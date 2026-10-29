BEGIN;
-- Additive operational administration; no clinical-data policy is broadened.
ALTER TABLE public.workspace_memberships ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);
CREATE TABLE private.admin_operations(
 actor_id uuid NOT NULL REFERENCES public.users(id), operation_key uuid NOT NULL,
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id), command jsonb NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,operation_key)
);
REVOKE ALL ON private.admin_operations FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX admin_operations_workspace_time ON private.admin_operations(workspace_id,created_at DESC);

CREATE FUNCTION public.workspace_admin_view(w uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id(); result jsonb;
BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF NOT private.has_workspace_role(w,ARRAY['admin']) THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
 SELECT jsonb_build_object(
  'workspace',jsonb_build_object('id',x.id,'name',x.name,'timeZone',x.time_zone),
  'members',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT m.user_id AS id,u.name,u.email,m.role,m.status,m.revision,u.is_active AS account_active
    FROM public.workspace_memberships m JOIN public.users u ON u.id=m.user_id
    WHERE m.workspace_id=w ORDER BY u.name,m.user_id LIMIT 100)t),'[]'::jsonb),
  'consultations',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT c.id,c.status,c.started_at,c.revision,u.name AS clinician
    FROM public.consultations c JOIN public.users u ON u.id=c.doctor_id
    WHERE c.workspace_id=w ORDER BY c.started_at DESC,c.id LIMIT 50)t),'[]'::jsonb),
  'counts',jsonb_build_object('consultations',(SELECT count(*) FROM public.consultations WHERE workspace_id=w),
    'activeStaff',(SELECT count(*) FROM public.workspace_memberships m JOIN public.users u ON u.id=m.user_id WHERE m.workspace_id=w AND m.status='active' AND u.is_active)),
  'audit',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT o.created_at AS occurred_at,u.name AS actor,o.command->>'action' AS action,o.result->>'memberId' AS member_id
    FROM private.admin_operations o JOIN public.users u ON u.id=o.actor_id WHERE o.workspace_id=w
    ORDER BY o.created_at DESC LIMIT 50)t),'[]'::jsonb)
 ) INTO result FROM public.workspaces x WHERE x.id=w;
 RETURN result;
END $$;

CREATE FUNCTION public.workspace_admin_mutate(k uuid,command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id(); w uuid; target uuid; expected integer;
 old private.admin_operations; member public.workspace_memberships; output jsonb;
BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF k IS NULL OR command IS NULL OR jsonb_typeof(command)<>'object' OR
    (SELECT count(*) FROM jsonb_object_keys(command))<>5 OR command->>'action'<>'set_status' OR
    coalesce(command->>'status','') NOT IN ('active','inactive') THEN RAISE EXCEPTION 'INVALID_COMMAND'; END IF;
 w:=(command->>'workspaceId')::uuid;target:=(command->>'memberId')::uuid;expected:=(command->>'expectedRevision')::integer;
 IF w IS NULL OR target IS NULL OR expected IS NULL OR expected<0 THEN RAISE EXCEPTION 'INVALID_COMMAND'; END IF;
 IF NOT private.has_workspace_role(w,ARRAY['admin']) THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
 -- One transaction per workspace; no role/identity grants and no new memberships.
 PERFORM 1 FROM public.workspaces WHERE id=w FOR UPDATE;
 SELECT * INTO old FROM private.admin_operations WHERE actor_id=a AND operation_key=k;
 IF FOUND THEN
  IF old.command<>command THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
  RETURN old.result;
 END IF;
 IF target=a THEN RAISE EXCEPTION 'SELF_CHANGE_FORBIDDEN'; END IF;
 SELECT * INTO member FROM public.workspace_memberships WHERE workspace_id=w AND user_id=target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF member.revision<>expected THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
 IF command->>'status'='active' AND NOT EXISTS(SELECT 1 FROM public.users WHERE id=target AND is_active AND role=member.role) THEN RAISE EXCEPTION 'ACCOUNT_UNAVAILABLE';END IF;
 IF member.role='admin' AND command->>'status'='inactive' AND NOT EXISTS(
  SELECT 1 FROM public.workspace_memberships m JOIN public.users u ON u.id=m.user_id
  WHERE m.workspace_id=w AND m.user_id<>target AND m.role='admin' AND m.status='active' AND u.is_active AND u.role='admin'
 ) THEN RAISE EXCEPTION 'LAST_ADMIN_REQUIRED'; END IF;
 UPDATE public.workspace_memberships SET status=command->>'status',revision=revision+1 WHERE workspace_id=w AND user_id=target;
 output:=jsonb_build_object('memberId',target,'revision',expected+1,'status',command->>'status');
 INSERT INTO private.admin_operations(actor_id,operation_key,workspace_id,command,result) VALUES(a,k,w,command,output);
 RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.workspace_admin_view(uuid),public.workspace_admin_mutate(uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.workspace_admin_view(uuid),public.workspace_admin_mutate(uuid,jsonb) TO authenticated;
COMMIT;
