BEGIN;
CREATE TABLE private.worker_observations(id uuid PRIMARY KEY,source_sha text NOT NULL CHECK(source_sha~'^[a-f0-9]{40}$'),outcome text NOT NULL CHECK(outcome IN ('ok','degraded','failed')),duration_ms integer NOT NULL CHECK(duration_ms BETWEEN 0 AND 180000),finished_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX worker_observations_recent ON private.worker_observations(finished_at DESC);
REVOKE ALL ON private.worker_observations FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.worker_observe(k uuid,source text,outcome text,duration integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF k IS NULL OR source IS NULL OR source!~'^[a-f0-9]{40}$' OR outcome IS NULL OR outcome NOT IN ('ok','degraded','failed') OR duration IS NULL OR duration NOT BETWEEN 0 AND 180000 THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 INSERT INTO private.worker_observations(id,source_sha,outcome,duration_ms) VALUES(k,source,outcome,duration) ON CONFLICT(id) DO NOTHING;
 RETURN EXISTS(SELECT 1 FROM private.worker_observations r WHERE r.id=k AND r.source_sha=source AND r.outcome=worker_observe.outcome AND r.duration_ms=duration);
END $$;
CREATE FUNCTION public.worker_status() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE last_success timestamptz;latest private.worker_observations;BEGIN
 SELECT max(finished_at) INTO last_success FROM private.worker_observations WHERE outcome='ok';
 SELECT * INTO latest FROM private.worker_observations ORDER BY finished_at DESC,id DESC LIMIT 1;
 RETURN jsonb_build_object('state',CASE WHEN last_success IS NULL THEN 'unknown' WHEN last_success<now()-interval '1 hour' THEN 'stale' ELSE 'recent' END,'lastSuccess',last_success,'lastObservation',CASE WHEN latest.id IS NULL THEN NULL ELSE jsonb_build_object('sourceSha',latest.source_sha,'outcome',latest.outcome,'finishedAt',latest.finished_at,'durationMs',latest.duration_ms) END,'scope','application worker observation; not schedule or workspace delivery acceptance');
END $$;
CREATE FUNCTION public.workspace_worker_status(w uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN IF NOT private.has_workspace_role(w,ARRAY['admin']) THEN RAISE EXCEPTION 'ADMIN_REQUIRED';END IF;RETURN public.worker_status();END $$;
CREATE FUNCTION public.workspace_admin_operation(w uuid,k uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN IF NOT private.has_workspace_role(w,ARRAY['admin']) THEN RAISE EXCEPTION 'ADMIN_REQUIRED';END IF;RETURN(SELECT result FROM private.admin_operations WHERE workspace_id=w AND actor_id=private.current_app_user_id() AND operation_key=k);END $$;
REVOKE ALL ON FUNCTION public.worker_observe(uuid,text,text,integer),public.worker_status(),public.workspace_worker_status(uuid),public.workspace_admin_operation(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.worker_observe(uuid,text,text,integer),public.worker_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.workspace_worker_status(uuid),public.workspace_admin_operation(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
