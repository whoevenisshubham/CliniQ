BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
CREATE TABLE public.availability_slots(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),provider_id uuid NOT NULL REFERENCES public.users(id),
 starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,time_zone text NOT NULL,status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','withdrawn')),
 synthetic boolean NOT NULL DEFAULT true CHECK(synthetic),CHECK(ends_at>starts_at AND ends_at-starts_at<=interval '2 hours'),
 FOREIGN KEY(workspace_id,provider_id) REFERENCES public.workspace_memberships(workspace_id,user_id),
 EXCLUDE USING gist(provider_id extensions.gist_uuid_ops WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&)
);
ALTER TABLE public.appointments ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.appointments ADD COLUMN slot_id uuid REFERENCES public.availability_slots(id);
ALTER TABLE public.appointments ADD COLUMN starts_at timestamptz;
ALTER TABLE public.appointments ADD COLUMN ends_at timestamptz;
ALTER TABLE public.appointments ADD COLUMN time_zone text;
ALTER TABLE public.appointments ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);
CREATE UNIQUE INDEX appointment_confirmed_slot ON public.appointments(slot_id) WHERE status='confirmed' AND slot_id IS NOT NULL;
ALTER TABLE public.patient_queue ADD COLUMN service_date date;
ALTER TABLE public.patient_queue ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);
CREATE UNIQUE INDEX typed_queue_number ON public.patient_queue(workspace_id,doctor_ref,service_date,queue_number) WHERE workspace_id IS NOT NULL AND doctor_ref IS NOT NULL AND service_date IS NOT NULL;
CREATE UNIQUE INDEX typed_queue_waiting ON public.patient_queue(workspace_id,doctor_ref,service_date,patient_ref) WHERE status IN ('waiting','in-consultation') AND service_date IS NOT NULL;
CREATE UNIQUE INDEX queue_one_encounter ON public.patient_queue(consultation_ref) WHERE consultation_ref IS NOT NULL;
CREATE TABLE public.care_operations(actor_id uuid NOT NULL REFERENCES public.users(id),operation_key uuid NOT NULL,command jsonb NOT NULL,response jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,operation_key));
CREATE TABLE public.queue_vital_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),queue_id uuid NOT NULL REFERENCES public.patient_queue(id),
 actor_id uuid NOT NULL REFERENCES public.users(id),recorded_at timestamptz NOT NULL DEFAULT now(),
 observed_at timestamptz NOT NULL,revision integer NOT NULL CHECK(revision>0),
 measurements jsonb NOT NULL,correction_reason text,UNIQUE(queue_id,revision)
);
ALTER TABLE public.queue_vital_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.queue_vital_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.queue_vital_events TO service_role;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.availability_slots,public.care_operations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.availability_slots,public.care_operations TO service_role;
CREATE FUNCTION private.can_intake(p uuid,w uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT private.has_workspace_role(w,ARRAY['receptionist']) AND EXISTS(SELECT 1 FROM public.care_relationships WHERE patient_id=p AND workspace_id=w AND provider_id=private.current_app_user_id() AND scope='intake' AND revoked_at IS NULL)
$$;
REVOKE ALL ON FUNCTION private.can_intake(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_intake(uuid,uuid) TO authenticated;
CREATE FUNCTION private.validate_intake_vitals(v jsonb) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE item jsonb;label text;n numeric;unit text;BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(v)) NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'INVALID_VITALS';END IF;
 FOR label,item IN SELECT * FROM jsonb_each(v) LOOP
 IF label<>ALL(ARRAY['temperature','pulse','systolic','diastolic','weight','spo2']) OR jsonb_typeof(item) IS DISTINCT FROM 'object' OR NOT(item ?& ARRAY['value','unit']) OR (SELECT count(*) FROM jsonb_object_keys(item))<>2 OR jsonb_typeof(item->'value') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'INVALID_VITALS';END IF;
 n:=(item->>'value')::numeric;unit:=item->>'unit';
 IF (CASE label WHEN 'temperature' THEN unit='°C' AND n BETWEEN 25 AND 45 WHEN 'pulse' THEN unit='bpm' AND n BETWEEN 10 AND 300 WHEN 'systolic' THEN unit='mmHg' AND n BETWEEN 30 AND 300 WHEN 'diastolic' THEN unit='mmHg' AND n BETWEEN 10 AND 200 WHEN 'weight' THEN unit='kg' AND n BETWEEN 0.1 AND 500 WHEN 'spo2' THEN unit='%' AND n BETWEEN 0 AND 100 ELSE false END) IS DISTINCT FROM true THEN RAISE EXCEPTION 'INVALID_VITALS';END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.validate_intake_vitals(jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.care_view(w uuid DEFAULT NULL,q text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();role text;p uuid;slots jsonb;appts jsonb;patients jsonb;queue jsonb;providers jsonb;BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 SELECT u.role INTO role FROM public.users u WHERE id=a;SELECT id INTO p FROM public.patients WHERE user_id=a;
 IF role<>'patient' AND (w IS NULL OR NOT private.has_workspace_role(w,ARRAY['receptionist','doctor'])) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF length(q)>100 THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 SELECT coalesce(jsonb_agg(z),'[]') INTO slots FROM(SELECT s.id,s.workspace_id,s.provider_id,u.name AS provider_name,s.starts_at,s.ends_at,s.time_zone,s.synthetic FROM public.availability_slots s JOIN public.users u ON u.id=s.provider_id JOIN public.workspace_memberships m ON m.workspace_id=s.workspace_id AND m.user_id=s.provider_id JOIN public.workspaces x ON x.id=s.workspace_id WHERE s.status='open' AND s.starts_at>now() AND s.starts_at<now()+interval '90 days' AND x.is_demo AND m.status='active' AND m.role='doctor' AND u.is_active AND u.role='doctor' AND NOT EXISTS(SELECT 1 FROM public.appointments WHERE slot_id=s.id AND status='confirmed') AND ((role='patient' AND EXISTS(SELECT 1 FROM public.care_relationships r WHERE r.patient_id=p AND r.provider_id=s.provider_id AND r.workspace_id=s.workspace_id AND r.scope='clinical' AND r.revoked_at IS NULL)) OR (role<>'patient' AND s.workspace_id=w)) ORDER BY s.starts_at LIMIT 50) z;
 SELECT coalesce(jsonb_agg(z),'[]') INTO appts FROM(SELECT x.id,x.patient_id,x.doctor_id,x.slot_id,x.starts_at,x.ends_at,x.time_zone,x.status,x.reason,x.type,x.revision,u.name provider_name FROM public.appointments x JOIN public.users u ON u.id=x.doctor_id WHERE x.slot_id IS NOT NULL AND ((role='patient' AND x.patient_id=p) OR (x.workspace_id=w AND ((role='doctor' AND x.doctor_id=a AND private.can_treat(x.patient_id,w)) OR private.can_intake(x.patient_id,w)))) ORDER BY x.starts_at DESC LIMIT 50) z;
 IF role<>'patient' THEN
 SELECT coalesce(jsonb_agg(z),'[]') INTO providers FROM(SELECT u.id,u.name FROM public.users u JOIN public.workspace_memberships m ON m.user_id=u.id WHERE m.workspace_id=w AND m.role='doctor' AND m.status='active' AND u.is_active AND u.role='doctor' ORDER BY u.name LIMIT 50) z;
 SELECT coalesce(jsonb_agg(z),'[]') INTO patients FROM(SELECT x.id,x.name,x.phone,x.dob,(x.user_id IS NULL) unclaimed FROM public.patients x WHERE ((role='doctor' AND private.can_treat(x.id,w)) OR private.can_intake(x.id,w)) AND (q='' OR position(lower(q) in lower(x.name))>0 OR position(q in coalesce(x.phone,''))>0) ORDER BY x.name LIMIT 30) z;
 SELECT coalesce(jsonb_agg(z),'[]') INTO queue FROM(SELECT x.id,x.patient_ref,x.patient_name,x.doctor_ref,x.doctor_name,x.queue_number,x.service_date,x.status,x.priority,x.revision,x.consultation_ref,x.vitals_recorded,(SELECT jsonb_build_object('actorId',e.actor_id,'recordedAt',e.recorded_at,'observedAt',e.observed_at,'revision',e.revision,'source','reception_intake','correctionReason',e.correction_reason) FROM public.queue_vital_events e WHERE e.queue_id=x.id ORDER BY e.revision DESC LIMIT 1) vital_provenance FROM public.patient_queue x WHERE x.workspace_id=w AND x.service_date=(now() AT TIME ZONE (SELECT time_zone FROM public.workspaces WHERE id=w))::date AND ((role='doctor' AND x.doctor_ref=a AND private.can_treat(x.patient_ref,w)) OR private.can_intake(x.patient_ref,w)) ORDER BY x.queue_number LIMIT 100) z;
 END IF;
 RETURN jsonb_build_object('role',role,'slots',slots,'appointments',appts,'patients',coalesce(patients,'[]'),'queue',coalesce(queue,'[]'),'providers',coalesce(providers,'[]'));
END $$;
CREATE FUNCTION public.care_mutate(k uuid,command jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();action text:=command->>'action';prior public.care_operations;app public.appointments;s public.availability_slots;oldslot uuid;p uuid;w uuid;doc uuid;entry public.patient_queue;response jsonb;day date;tz text;n integer;name text;role text;BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF k IS NULL OR jsonb_typeof(command) IS DISTINCT FROM 'object' OR octet_length(command::text)>4096 OR action IS NULL THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 SELECT u.role INTO role FROM public.users u WHERE id=a FOR SHARE;
 PERFORM pg_advisory_xact_lock(hashtextextended('care-actor:'||a::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text||k::text,0));
 SELECT * INTO prior FROM public.care_operations WHERE actor_id=a AND operation_key=k;
 IF FOUND THEN
 IF prior.command<>command THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
 IF prior.response ? 'appointmentId' THEN
 SELECT * INTO app FROM public.appointments WHERE id=(prior.response->>'appointmentId')::uuid;
 IF NOT(private.owns_patient(app.patient_id) OR private.can_intake(app.patient_id,app.workspace_id)) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 ELSE
 SELECT * INTO entry FROM public.patient_queue WHERE id=(prior.response->>'queueId')::uuid;
 IF NOT(private.can_intake(entry.patient_ref,entry.workspace_id) OR (entry.doctor_ref=a AND private.can_treat(entry.patient_ref,entry.workspace_id))) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 END IF;RETURN prior.response;END IF;
 IF (SELECT count(*) FROM public.care_operations WHERE actor_id=a AND created_at>now()-interval '1 day')>=100 THEN RAISE EXCEPTION 'OPERATION_LIMIT';END IF;
 IF action=ANY(ARRAY['book','cancel','reschedule']) THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(command) x WHERE x<>ALL(ARRAY['action','slotId','appointmentId','expectedRevision','reason','type'])) THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 IF action='book' THEN
 SELECT id INTO p FROM public.patients WHERE user_id=a;IF role<>'patient' OR p IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 ELSE
 SELECT * INTO app FROM public.appointments WHERE id=(command->>'appointmentId')::uuid FOR UPDATE;
 PERFORM 1 FROM public.care_relationships WHERE patient_id=app.patient_id AND workspace_id=app.workspace_id AND provider_id=a AND revoked_at IS NULL FOR SHARE;
 IF NOT FOUND OR app.slot_id IS NULL OR NOT (private.owns_patient(app.patient_id) OR private.can_intake(app.patient_id,app.workspace_id)) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF app.revision IS DISTINCT FROM (command->>'expectedRevision')::integer OR app.status<>'confirmed' OR app.starts_at<=now() THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 p:=app.patient_id;oldslot:=app.slot_id;
 END IF;
 PERFORM 1 FROM public.availability_slots WHERE id=oldslot OR id=(command->>'slotId')::uuid ORDER BY id FOR UPDATE;
 IF action<>'cancel' THEN
 SELECT * INTO s FROM public.availability_slots WHERE id=(command->>'slotId')::uuid;
 PERFORM 1 FROM public.workspace_memberships WHERE workspace_id=s.workspace_id AND user_id=s.provider_id FOR SHARE;
 PERFORM 1 FROM public.users WHERE id=s.provider_id FOR SHARE;
 PERFORM 1 FROM public.care_relationships WHERE patient_id=p AND workspace_id=s.workspace_id AND provider_id=s.provider_id AND scope='clinical' AND revoked_at IS NULL FOR SHARE;
 IF NOT FOUND OR s.status<>'open' OR s.starts_at<=now() OR s.starts_at>now()+interval '90 days' OR NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=s.workspace_id AND is_demo) OR NOT EXISTS(SELECT 1 FROM public.care_relationships r JOIN public.workspace_memberships m ON m.workspace_id=r.workspace_id AND m.user_id=r.provider_id JOIN public.users u ON u.id=m.user_id WHERE r.patient_id=p AND r.workspace_id=s.workspace_id AND r.provider_id=s.provider_id AND r.scope='clinical' AND r.revoked_at IS NULL AND m.role='doctor' AND m.status='active' AND u.role='doctor' AND u.is_active) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF EXISTS(SELECT 1 FROM public.appointments WHERE slot_id=s.id AND status='confirmed' AND id IS DISTINCT FROM app.id) THEN RAISE EXCEPTION 'SLOT_TAKEN';END IF;
 END IF;
 IF action='book' THEN
 IF length(coalesce(command->>'reason',''))>500 OR coalesce(command->>'type','general')<>ALL(ARRAY['general','followup']) THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 INSERT INTO public.appointments(patient_id,doctor_id,workspace_id,slot_id,starts_at,ends_at,time_zone,date,time_slot,reason,type,status) VALUES(p,s.provider_id,s.workspace_id,s.id,s.starts_at,s.ends_at,s.time_zone,(s.starts_at AT TIME ZONE s.time_zone)::date,to_char(s.starts_at AT TIME ZONE s.time_zone,'HH24:MI'),coalesce(command->>'reason',''),coalesce(command->>'type','general'),'confirmed') RETURNING * INTO app;
 ELSIF action='cancel' THEN UPDATE public.appointments SET status='cancelled',revision=revision+1 WHERE id=app.id RETURNING * INTO app;
 ELSE UPDATE public.appointments SET slot_id=s.id,doctor_id=s.provider_id,workspace_id=s.workspace_id,starts_at=s.starts_at,ends_at=s.ends_at,time_zone=s.time_zone,date=(s.starts_at AT TIME ZONE s.time_zone)::date,time_slot=to_char(s.starts_at AT TIME ZONE s.time_zone,'HH24:MI'),revision=revision+1 WHERE id=app.id RETURNING * INTO app;
 END IF;
 response:=jsonb_build_object('appointmentId',app.id,'revision',app.revision,'status',app.status);
 ELSIF action=ANY(ARRAY['intake','enqueue','start','cancel_queue','no_show','vitals']) THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(command) x WHERE x<>ALL(ARRAY['action','workspaceId','providerId','patientId','name','phone','dob','queueId','expectedRevision','priority','measurements','observedAt','correctionReason'])) THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 PERFORM 1 FROM public.workspace_memberships WHERE workspace_id=(command->>'workspaceId')::uuid AND user_id=a FOR SHARE;
 w:=(command->>'workspaceId')::uuid;IF NOT private.has_workspace_role(w,ARRAY['receptionist','doctor']) OR NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=w AND is_demo) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT time_zone INTO tz FROM public.workspaces WHERE id=w;day:=(clock_timestamp() AT TIME ZONE tz)::date;
 IF action=ANY(ARRAY['intake','enqueue']) THEN
 IF role<>'receptionist' THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 doc:=(command->>'providerId')::uuid;
 PERFORM 1 FROM public.workspace_memberships WHERE workspace_id=w AND user_id=doc FOR SHARE;
 PERFORM 1 FROM public.users WHERE id=doc FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM public.workspace_memberships m JOIN public.users u ON u.id=m.user_id WHERE m.workspace_id=w AND m.user_id=doc AND m.status='active' AND m.role='doctor' AND u.role='doctor' AND u.is_active) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF action='intake' THEN
 name:=btrim(command->>'name');IF name IS NULL OR length(name) NOT BETWEEN 1 AND 120 OR length(coalesce(command->>'phone',''))>30 OR (command->>'dob')::date>current_date OR (command->>'dob')::date<date '1900-01-01' THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 INSERT INTO public.patients(name,phone,dob,user_id) VALUES(name,nullif(command->>'phone',''),(command->>'dob')::date,NULL) RETURNING id INTO p;
 INSERT INTO public.care_relationships(patient_id,workspace_id,provider_id,scope,granted_by) VALUES(p,w,a,'intake',a),(p,w,doc,'clinical',a);
 ELSE
 p:=(command->>'patientId')::uuid;
 PERFORM 1 FROM public.care_relationships WHERE patient_id=p AND workspace_id=w AND provider_id IN(a,doc) AND revoked_at IS NULL ORDER BY id FOR SHARE;
 IF NOT private.can_intake(p,w) OR NOT EXISTS(SELECT 1 FROM public.care_relationships WHERE patient_id=p AND workspace_id=w AND provider_id=doc AND scope='clinical' AND revoked_at IS NULL) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT x.name INTO name FROM public.patients x WHERE id=p;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(w::text||doc::text||day::text,0));
 SELECT coalesce(max(queue_number),0)+1 INTO n FROM public.patient_queue WHERE workspace_id=w AND doctor_ref=doc AND service_date=day;
 IF n>100 THEN RAISE EXCEPTION 'OPERATION_LIMIT';END IF;
 IF coalesce(command->>'priority','normal')<>ALL(ARRAY['normal','urgent']) THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 INSERT INTO public.patient_queue(patient_id,patient_name,doctor_id,doctor_name,patient_ref,doctor_ref,workspace_id,service_date,queue_number,priority,registered_by) VALUES(p::text,name,doc::text,(SELECT u.name FROM public.users u WHERE id=doc),p,doc,w,day,n,coalesce(command->>'priority','normal'),a::text) RETURNING * INTO entry;
 ELSE
 SELECT * INTO entry FROM public.patient_queue WHERE id=(command->>'queueId')::uuid FOR UPDATE;
 PERFORM 1 FROM public.care_relationships WHERE patient_id=entry.patient_ref AND workspace_id=w AND provider_id=a AND revoked_at IS NULL FOR SHARE;
 IF NOT FOUND OR entry.workspace_id<>w OR entry.service_date<>day OR entry.status<>'waiting' OR entry.revision IS DISTINCT FROM (command->>'expectedRevision')::integer THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 IF action='vitals' THEN
 IF NOT(private.can_intake(entry.patient_ref,w) OR (entry.doctor_ref=a AND private.can_treat(entry.patient_ref,w))) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 PERFORM private.validate_intake_vitals(command->'measurements');
 IF command->>'observedAt' IS NULL OR (command->>'observedAt')::timestamptz>now()+interval '5 minutes' OR (command->>'observedAt')::timestamptz<now()-interval '1 day' THEN RAISE EXCEPTION 'INVALID_VITALS';END IF;
 IF entry.vitals_recorded<>'{}'::jsonb AND length(btrim(coalesce(command->>'correctionReason',''))) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'CORRECTION_REASON_REQUIRED';END IF;
 UPDATE public.patient_queue SET vitals_recorded=command->'measurements',revision=revision+1 WHERE id=entry.id RETURNING * INTO entry;
 INSERT INTO public.queue_vital_events(queue_id,actor_id,observed_at,revision,measurements,correction_reason) VALUES(entry.id,a,(command->>'observedAt')::timestamptz,entry.revision,command->'measurements',command->>'correctionReason');
 ELSIF action='start' THEN
 IF entry.doctor_ref<>a OR NOT private.can_treat(entry.patient_ref,w) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 response:=public.clinical_mutate(k,jsonb_build_object('action','create','patientId',entry.patient_ref,'workspaceId',w));
 UPDATE public.patient_queue SET status='in-consultation',start_time=now(),consultation_ref=(response->>'consultationId')::uuid,consultation_id=response->>'consultationId',revision=revision+1 WHERE id=entry.id RETURNING * INTO entry;
 ELSE
 IF NOT private.can_intake(entry.patient_ref,w) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 UPDATE public.patient_queue SET status=CASE WHEN action='cancel_queue' THEN 'cancelled' ELSE 'no-show' END,revision=revision+1 WHERE id=entry.id RETURNING * INTO entry;
 END IF;
 END IF;
 response:=jsonb_build_object('queueId',entry.id,'patientId',entry.patient_ref,'queueNumber',entry.queue_number,'revision',entry.revision,'consultationId',entry.consultation_ref,'status',entry.status);
 ELSE RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 INSERT INTO public.care_operations(actor_id,operation_key,command,response) VALUES(a,k,command,response);RETURN response;
END $$;
REVOKE ALL ON FUNCTION public.care_view(uuid,text),public.care_mutate(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.care_view(uuid,text),public.care_mutate(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
