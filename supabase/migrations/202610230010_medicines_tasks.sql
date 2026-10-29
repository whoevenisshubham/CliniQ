BEGIN;
CREATE FUNCTION private.valid_tracking_times(times text[]) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT times IS NOT NULL AND cardinality(times) BETWEEN 1 AND 8 AND cardinality(times)=(SELECT count(DISTINCT t) FROM unnest(times) t) AND NOT EXISTS(SELECT 1 FROM unnest(times) t WHERE t IS NULL OR t!~'^([01][0-9]|2[0-3]):[0-5][0-9]$')
$$;
REVOKE ALL ON FUNCTION private.valid_tracking_times(text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.valid_tracking_times(text[]) TO service_role;
CREATE TABLE public.medication_schedules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),patient_id uuid NOT NULL REFERENCES public.patients(id),prescription_id uuid NOT NULL REFERENCES public.prescriptions(id),
 local_times text[] NOT NULL CHECK(private.valid_tracking_times(local_times)),time_zone text NOT NULL CHECK(time_zone IN ('Asia/Kolkata','UTC')),
 starts_on date NOT NULL,ends_on date NOT NULL,CHECK(ends_on>=starts_on AND ends_on-starts_on<=90),enabled boolean NOT NULL,
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),created_by uuid NOT NULL REFERENCES public.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 materialized_through date NOT NULL,next_materialize_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX medication_one_tracking_schedule ON public.medication_schedules(prescription_id);
CREATE INDEX medication_tracking_due ON public.medication_schedules(next_materialize_at) WHERE enabled;
CREATE TABLE public.adherence_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),patient_id uuid NOT NULL REFERENCES public.patients(id),prescription_id uuid NOT NULL REFERENCES public.prescriptions(id),schedule_id uuid NOT NULL REFERENCES public.medication_schedules(id),scheduled_at timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN ('taken','missed','not_recorded')),reported_by uuid NOT NULL REFERENCES public.users(id),reported_at timestamptz NOT NULL DEFAULT now(),revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 UNIQUE(prescription_id,scheduled_at)
);
CREATE TABLE public.adherence_event_revisions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES public.adherence_events(id),revision integer NOT NULL,
 status text NOT NULL CHECK(status IN ('taken','missed','not_recorded')),reported_by uuid NOT NULL REFERENCES public.users(id),reported_at timestamptz NOT NULL DEFAULT now(),reason text,
 UNIQUE(event_id,revision)
);
ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications DROP CONSTRAINT notifications_recipient_id_resource_id_key;
ALTER TABLE public.notifications ALTER COLUMN recipient_id DROP NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN resource_id DROP NOT NULL;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK(kind IN ('approved_record','medication_reminder','follow_up','appointment'));
ALTER TABLE public.notifications ADD COLUMN patient_ref uuid REFERENCES public.patients(id);
ALTER TABLE public.notifications ADD COLUMN created_by uuid REFERENCES public.users(id);
ALTER TABLE public.notifications ADD COLUMN created_at timestamptz;
ALTER TABLE public.notifications ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.notifications ADD COLUMN completed_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN cancelled_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);
ALTER TABLE public.notifications ADD COLUMN schedule_id uuid REFERENCES public.medication_schedules(id);
ALTER TABLE public.notifications ADD COLUMN schedule_revision integer;
ALTER TABLE public.notifications ADD COLUMN appointment_ref uuid REFERENCES public.appointments(id);
ALTER TABLE public.notifications ADD COLUMN dedupe_key text CHECK(length(dedupe_key)<=200);
CREATE UNIQUE INDEX notifications_approved_once ON public.notifications(recipient_id,resource_id) WHERE kind='approved_record';
CREATE UNIQUE INDEX notifications_intention_once ON public.notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX notifications_patient_due ON public.notifications(patient_ref,due_at);
CREATE INDEX notifications_schedule ON public.notifications(schedule_id) WHERE schedule_id IS NOT NULL;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_intention_source CHECK(kind='approved_record' OR (patient_ref IS NOT NULL AND dedupe_key IS NOT NULL AND (kind<>'medication_reminder' OR schedule_id IS NOT NULL) AND (kind<>'appointment' OR appointment_ref IS NOT NULL)));
ALTER TABLE public.notifications ADD CONSTRAINT notifications_record_source CHECK(kind='appointment' OR resource_id IS NOT NULL);
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_event_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medication_schedules,public.adherence_events,public.adherence_event_revisions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.medication_schedules,public.adherence_events,public.adherence_event_revisions TO service_role;
CREATE TRIGGER adherence_history_immutable BEFORE UPDATE OR DELETE ON public.adherence_event_revisions FOR EACH ROW EXECUTE FUNCTION private.immutable_approved();
DROP POLICY notifications_recipient ON public.notifications;
CREATE POLICY notifications_owner ON public.notifications FOR SELECT TO authenticated USING(recipient_id=private.current_app_user_id() OR private.owns_patient(patient_ref));

CREATE FUNCTION private.current_prescription(rx uuid,p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.prescriptions r JOIN public.emr_versions v ON v.id=r.approved_emr_version_id WHERE r.id=rx AND r.patient_id=p AND NOT EXISTS(SELECT 1 FROM public.emr_versions n WHERE n.amended_from_id=v.id))
$$;
REVOKE ALL ON FUNCTION private.current_prescription(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.appointment_intention() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE owner_id uuid;BEGIN
 IF NEW.slot_id IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.slot_id IS NOT DISTINCT FROM OLD.slot_id AND NEW.revision IS NOT DISTINCT FROM OLD.revision THEN RETURN NEW;END IF;
 UPDATE public.notifications SET cancelled_at=coalesce(cancelled_at,now()),revision=revision+1 WHERE appointment_ref=NEW.id AND cancelled_at IS NULL;
 IF NEW.status='confirmed' THEN
 SELECT user_id INTO owner_id FROM public.patients WHERE id=NEW.patient_id;
 INSERT INTO public.notifications(recipient_id,workspace_id,kind,due_at,patient_ref,created_by,appointment_ref,dedupe_key) VALUES(owner_id,NEW.workspace_id,'appointment',NEW.starts_at,NEW.patient_id,private.current_app_user_id(),NEW.id,'appointment:'||NEW.id||':'||NEW.revision) ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.appointment_intention() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER appointment_task_intention AFTER INSERT OR UPDATE OF status,slot_id,revision ON public.appointments FOR EACH ROW EXECUTE FUNCTION private.appointment_intention();
CREATE FUNCTION private.invalidate_continuing_intentions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.amended_from_id IS NOT NULL THEN
 PERFORM 1 FROM public.emr_versions WHERE id=NEW.amended_from_id FOR UPDATE;
 UPDATE public.medication_schedules s SET enabled=false,revision=revision+1 WHERE enabled AND EXISTS(SELECT 1 FROM public.prescriptions r WHERE r.id=s.prescription_id AND r.approved_emr_version_id=NEW.amended_from_id);
 UPDATE public.notifications SET cancelled_at=coalesce(cancelled_at,now()),revision=revision+1 WHERE resource_id=NEW.amended_from_id AND kind IN ('medication_reminder','follow_up') AND cancelled_at IS NULL;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.invalidate_continuing_intentions() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER continuing_intentions_amendment AFTER INSERT ON public.emr_versions FOR EACH ROW EXECUTE FUNCTION private.invalidate_continuing_intentions();

CREATE FUNCTION public.continuity_view(cid uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();p uuid;role text;c public.consultations;rx jsonb;schedules jsonb;tasks jsonb;events jsonb;versions jsonb;BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;SELECT u.role INTO role FROM public.users u WHERE id=a;
 IF role='patient' THEN SELECT id INTO p FROM public.patients WHERE user_id=a;
 ELSIF role='doctor' AND cid IS NOT NULL AND private.can_edit_encounter(cid) THEN SELECT * INTO c FROM public.consultations WHERE id=cid;p:=c.patient_id;
 ELSE RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF p IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT coalesce(jsonb_agg(x),'[]') INTO rx FROM(SELECT r.id,r.medication_name,r.dosage,r.frequency,r.duration,r.route,r.instructions,r.unknown_fields,r.approved_emr_version_id,v.reviewed_at,cx.workspace_id,NOT EXISTS(SELECT 1 FROM public.emr_versions n WHERE n.amended_from_id=v.id) current_source FROM public.prescriptions r JOIN public.emr_versions v ON v.id=r.approved_emr_version_id JOIN public.consultations cx ON cx.id=r.consultation_id WHERE r.patient_id=p AND (role='patient' OR private.can_read_approved(r.consultation_id)) ORDER BY v.reviewed_at DESC,r.id LIMIT 100) x;
 SELECT coalesce(jsonb_agg(x),'[]') INTO schedules FROM(SELECT id,prescription_id,local_times,time_zone,starts_on,ends_on,enabled,revision FROM public.medication_schedules ms WHERE patient_id=p AND (role='patient' OR EXISTS(SELECT 1 FROM public.prescriptions mr WHERE mr.id=ms.prescription_id AND private.can_read_approved(mr.consultation_id))) ORDER BY created_at DESC LIMIT 100) x;
 SELECT coalesce(jsonb_agg(x),'[]') INTO tasks FROM(SELECT n.id,n.kind,n.resource_id,n.due_at,n.read_at,n.completed_at,n.cancelled_at,n.revision,n.schedule_id,n.appointment_ref,n.created_by,s.prescription_id,r.medication_name,coalesce(s.time_zone,ap.time_zone,w.time_zone,'UTC') display_time_zone,(SELECT e.status FROM public.adherence_events e WHERE e.prescription_id=s.prescription_id AND e.scheduled_at=n.due_at) reported_status,(SELECT e.revision FROM public.adherence_events e WHERE e.prescription_id=s.prescription_id AND e.scheduled_at=n.due_at) report_revision FROM public.notifications n LEFT JOIN public.medication_schedules s ON s.id=n.schedule_id LEFT JOIN public.prescriptions r ON r.id=s.prescription_id LEFT JOIN public.appointments ap ON ap.id=n.appointment_ref LEFT JOIN public.workspaces w ON w.id=n.workspace_id WHERE (n.patient_ref=p OR (role='patient' AND n.recipient_id=a)) AND (role='patient' OR (n.kind='follow_up' AND n.created_by=a AND n.workspace_id=c.workspace_id)) ORDER BY (n.cancelled_at IS NULL AND n.completed_at IS NULL) DESC,n.due_at DESC LIMIT 100) x;
 SELECT coalesce(jsonb_agg(x),'[]') INTO events FROM(SELECT e.id,e.prescription_id,e.scheduled_at,e.status,e.reported_at,e.revision,(SELECT jsonb_agg(jsonb_build_object('revision',h.revision,'status',h.status,'reportedAt',h.reported_at,'reason',h.reason) ORDER BY h.revision) FROM public.adherence_event_revisions h WHERE h.event_id=e.id) history FROM public.adherence_events e WHERE e.patient_id=p AND (role='patient' OR EXISTS(SELECT 1 FROM public.prescriptions er WHERE er.id=e.prescription_id AND private.can_read_approved(er.consultation_id))) ORDER BY e.scheduled_at DESC LIMIT 100) x;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.id,'reviewedAt',v.reviewed_at)),'[]') INTO versions FROM public.emr_versions v WHERE v.consultation_id=cid AND private.can_read_approved(cid) AND NOT EXISTS(SELECT 1 FROM public.emr_versions n WHERE n.amended_from_id=v.id);
 RETURN jsonb_build_object('role',role,'patientId',p,'prescriptions',rx,'schedules',schedules,'tasks',tasks,'adherence',events,'approvedVersions',versions);
END $$;

CREATE FUNCTION public.continuity_mutate(k uuid,command jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();p uuid;role text;action text:=command->>'action';prior public.care_operations;s public.medication_schedules;r public.prescriptions;c public.consultations;n public.notifications;e public.adherence_events;v public.emr_versions;response jsonb;times text[];today date;state text;BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;SELECT u.role INTO role FROM public.users u WHERE id=a FOR SHARE;
 IF k IS NULL OR jsonb_typeof(command) IS DISTINCT FROM 'object' OR octet_length(command::text)>8192 THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('care-actor:'||a::text,0));
 IF role='patient' THEN SELECT id INTO p FROM public.patients WHERE user_id=a FOR SHARE;
 ELSIF role='doctor' AND action='follow_up' THEN
 SELECT * INTO v FROM public.emr_versions WHERE id=(command->>'approvedVersionId')::uuid FOR SHARE;SELECT * INTO c FROM public.consultations WHERE id=v.consultation_id;
 IF NOT private.can_edit_encounter(c.id) OR EXISTS(SELECT 1 FROM public.emr_versions newer WHERE newer.amended_from_id=v.id) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;p:=c.patient_id;
 PERFORM private.lock_clinical_access(c.patient_id,c.workspace_id);
 ELSE RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF p IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT * INTO prior FROM public.care_operations WHERE actor_id=a AND operation_key=k;
 IF FOUND THEN IF prior.command<>command THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN prior.response;END IF;
 IF (SELECT count(*) FROM public.care_operations WHERE actor_id=a AND created_at>now()-interval '1 day')>=100 THEN RAISE EXCEPTION 'OPERATION_LIMIT';END IF;
 IF action='save_schedule' THEN
 IF role<>'patient' OR EXISTS(SELECT 1 FROM jsonb_object_keys(command) f WHERE f<>ALL(ARRAY['action','prescriptionId','localTimes','timeZone','startsOn','endsOn','enabled','expectedRevision'])) OR jsonb_typeof(command->'localTimes') IS DISTINCT FROM 'array' OR jsonb_typeof(command->'enabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 SELECT * INTO r FROM public.prescriptions WHERE id=(command->>'prescriptionId')::uuid;
 PERFORM 1 FROM public.emr_versions WHERE id=r.approved_emr_version_id FOR SHARE;
 IF r.patient_id IS DISTINCT FROM p OR NOT private.current_prescription(r.id,p) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT array_agg(value ORDER BY value) INTO times FROM jsonb_array_elements_text(command->'localTimes');
 IF NOT private.valid_tracking_times(times) OR command->>'timeZone' IS NULL OR command->>'timeZone'<>ALL(ARRAY['Asia/Kolkata','UTC']) THEN RAISE EXCEPTION 'INVALID_SCHEDULE';END IF;
 today:=(now() AT TIME ZONE (command->>'timeZone'))::date;
 IF (command->>'startsOn')::date NOT BETWEEN today-30 AND today+90 OR (command->>'endsOn')::date<(command->>'startsOn')::date OR (command->>'endsOn')::date-(command->>'startsOn')::date>90 THEN RAISE EXCEPTION 'INVALID_SCHEDULE';END IF;
 SELECT * INTO s FROM public.medication_schedules WHERE prescription_id=r.id FOR UPDATE;
 IF FOUND THEN
 IF s.revision IS DISTINCT FROM (command->>'expectedRevision')::integer THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 UPDATE public.notifications SET cancelled_at=coalesce(cancelled_at,now()),revision=revision+1 WHERE schedule_id=s.id AND cancelled_at IS NULL;
 UPDATE public.medication_schedules SET local_times=times,time_zone=command->>'timeZone',starts_on=(command->>'startsOn')::date,ends_on=(command->>'endsOn')::date,enabled=(command->>'enabled')::boolean,revision=revision+1,materialized_through=(command->>'startsOn')::date-1,next_materialize_at=now() WHERE id=s.id RETURNING * INTO s;
 ELSE
 IF command->'expectedRevision' IS DISTINCT FROM 'null'::jsonb OR (SELECT count(*) FROM public.medication_schedules WHERE patient_id=p)>=100 THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 INSERT INTO public.medication_schedules(patient_id,prescription_id,local_times,time_zone,starts_on,ends_on,enabled,created_by,materialized_through) VALUES(p,r.id,times,command->>'timeZone',(command->>'startsOn')::date,(command->>'endsOn')::date,(command->>'enabled')::boolean,a,(command->>'startsOn')::date-1) RETURNING * INTO s;
 END IF;response:=jsonb_build_object('scheduleId',s.id,'revision',s.revision);
 ELSIF action='report_adherence' THEN
 IF role<>'patient' OR EXISTS(SELECT 1 FROM jsonb_object_keys(command) f WHERE f<>ALL(ARRAY['action','taskId','status','expectedRevision','correctionReason'])) OR command->>'status' IS NULL OR command->>'status'<>ALL(ARRAY['taken','missed','not_recorded']) THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 SELECT * INTO n FROM public.notifications WHERE id=(command->>'taskId')::uuid FOR UPDATE;
 IF n.patient_ref IS DISTINCT FROM p OR n.kind<>'medication_reminder' OR n.due_at>now() THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT * INTO s FROM public.medication_schedules WHERE id=n.schedule_id;
 SELECT * INTO e FROM public.adherence_events WHERE prescription_id=s.prescription_id AND scheduled_at=n.due_at FOR UPDATE;
 IF FOUND THEN
 IF e.revision IS DISTINCT FROM (command->>'expectedRevision')::integer THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 IF length(btrim(coalesce(command->>'correctionReason',''))) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'CORRECTION_REASON_REQUIRED';END IF;
 UPDATE public.adherence_events SET status=command->>'status',reported_by=a,reported_at=now(),revision=revision+1 WHERE id=e.id RETURNING * INTO e;
 ELSE
 IF command->'expectedRevision' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 INSERT INTO public.adherence_events(patient_id,prescription_id,schedule_id,scheduled_at,status,reported_by) VALUES(p,s.prescription_id,s.id,n.due_at,command->>'status',a) RETURNING * INTO e;
 END IF;
 INSERT INTO public.adherence_event_revisions(event_id,revision,status,reported_by,reason) VALUES(e.id,e.revision,e.status,a,command->>'correctionReason');
 UPDATE public.notifications SET completed_at=CASE WHEN e.status='not_recorded' THEN NULL ELSE e.reported_at END,revision=revision+1 WHERE id=n.id;
 response:=jsonb_build_object('eventId',e.id,'revision',e.revision,'status',e.status);
 ELSIF action='task_state' THEN
 IF role<>'patient' OR EXISTS(SELECT 1 FROM jsonb_object_keys(command) f WHERE f<>ALL(ARRAY['action','taskId','expectedRevision','state'])) THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 SELECT * INTO n FROM public.notifications WHERE id=(command->>'taskId')::uuid FOR UPDATE;
 IF (n.patient_ref=p OR n.recipient_id=a) IS DISTINCT FROM true THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF n.revision IS DISTINCT FROM (command->>'expectedRevision')::integer THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 state:=command->>'state';IF state IS NULL OR state<>ALL(ARRAY['read','complete','dismiss']) OR (state='complete' AND n.kind='medication_reminder') THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 IF state='complete' AND n.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 UPDATE public.notifications SET read_at=CASE WHEN state='read' THEN coalesce(read_at,now()) ELSE read_at END,completed_at=CASE WHEN state='complete' THEN coalesce(completed_at,now()) ELSE completed_at END,cancelled_at=CASE WHEN state='dismiss' THEN coalesce(cancelled_at,now()) ELSE cancelled_at END,revision=revision+1 WHERE id=n.id RETURNING * INTO n;
 response:=jsonb_build_object('taskId',n.id,'revision',n.revision);
 ELSIF action='follow_up' THEN
 IF role<>'doctor' OR EXISTS(SELECT 1 FROM jsonb_object_keys(command) f WHERE f<>ALL(ARRAY['action','approvedVersionId','dueAt'])) OR command->>'dueAt' IS NULL OR (command->>'dueAt')::timestamptz NOT BETWEEN now() AND now()+interval '90 days' THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 INSERT INTO public.notifications(recipient_id,workspace_id,kind,resource_id,due_at,patient_ref,created_by,dedupe_key) VALUES((SELECT user_id FROM public.patients WHERE id=p),c.workspace_id,'follow_up',v.id,(command->>'dueAt')::timestamptz,p,a,'follow-up:'||k) RETURNING * INTO n;
 response:=jsonb_build_object('taskId',n.id,'revision',n.revision,'state','intention_not_booking');
 ELSE RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 INSERT INTO public.care_operations(actor_id,operation_key,command,response) VALUES(a,k,command,response);RETURN response;
END $$;
REVOKE ALL ON FUNCTION public.continuity_view(uuid),public.continuity_mutate(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.continuity_view(uuid),public.continuity_mutate(uuid,jsonb) TO authenticated;

CREATE FUNCTION public.continuity_reconcile() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s public.medication_schedules;r public.prescriptions;c public.consultations;app public.appointments;day date;last_day date;clock text;due timestamptz;owner_id uuid;changed integer:=0;steps integer;written integer;BEGIN
 FOR app IN SELECT a.* FROM public.appointments a WHERE a.slot_id IS NOT NULL AND a.status='confirmed' AND NOT EXISTS(SELECT 1 FROM public.notifications n WHERE n.dedupe_key='appointment:'||a.id||':'||a.revision) ORDER BY a.starts_at,a.id FOR UPDATE SKIP LOCKED LIMIT 20 LOOP
 INSERT INTO public.notifications(recipient_id,workspace_id,kind,due_at,patient_ref,appointment_ref,dedupe_key) VALUES((SELECT user_id FROM public.patients WHERE id=app.patient_id),app.workspace_id,'appointment',app.starts_at,app.patient_id,app.id,'appointment:'||app.id||':'||app.revision) ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
 GET DIAGNOSTICS written=ROW_COUNT;changed:=changed+written;
 END LOOP;
 FOR s IN SELECT * FROM public.medication_schedules WHERE enabled AND next_materialize_at<=now() ORDER BY next_materialize_at,id FOR UPDATE SKIP LOCKED LIMIT 10 LOOP
 IF NOT private.current_prescription(s.prescription_id,s.patient_id) THEN UPDATE public.medication_schedules SET enabled=false,revision=revision+1 WHERE id=s.id;UPDATE public.notifications SET cancelled_at=coalesce(cancelled_at,now()),revision=revision+1 WHERE schedule_id=s.id AND cancelled_at IS NULL;CONTINUE;END IF;
 SELECT * INTO r FROM public.prescriptions WHERE id=s.prescription_id;SELECT * INTO c FROM public.consultations WHERE id=r.consultation_id;SELECT user_id INTO owner_id FROM public.patients WHERE id=s.patient_id;
 day:=greatest(s.starts_on,s.materialized_through+1);last_day:=least(s.ends_on,(now() AT TIME ZONE s.time_zone)::date+1);steps:=0;
 WHILE day<=last_day AND steps<2 LOOP
 FOREACH clock IN ARRAY s.local_times LOOP
 due:=(day+clock::time) AT TIME ZONE s.time_zone;
 INSERT INTO public.notifications(recipient_id,workspace_id,kind,resource_id,due_at,patient_ref,created_by,schedule_id,schedule_revision,dedupe_key,completed_at) VALUES(owner_id,c.workspace_id,'medication_reminder',r.approved_emr_version_id,due,s.patient_id,s.created_by,s.id,s.revision,'medicine:'||s.id||':'||s.revision||':'||due,(SELECT reported_at FROM public.adherence_events WHERE prescription_id=r.id AND scheduled_at=due AND status<>'not_recorded')) ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
 GET DIAGNOSTICS written=ROW_COUNT;changed:=changed+written;
 END LOOP;UPDATE public.medication_schedules SET materialized_through=day WHERE id=s.id;day:=day+1;steps:=steps+1;
 END LOOP;
 UPDATE public.medication_schedules SET next_materialize_at=CASE WHEN day<=last_day THEN now() WHEN day>s.ends_on THEN 'infinity'::timestamptz ELSE ((greatest((now() AT TIME ZONE s.time_zone)::date+1,s.starts_on-1))::timestamp AT TIME ZONE s.time_zone) END WHERE id=s.id;
 END LOOP;RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.continuity_reconcile() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.continuity_reconcile() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
