-- Forward upgrade of the inspected UUID CliniQ schema. No data/link guessing.
-- Requires read-only inventory + backup before any intended hosted application.
BEGIN;
DO $$ BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='id') IS DISTINCT FROM 'uuid'
  THEN RAISE EXCEPTION 'Unsupported legacy identity type; explicit reconciliation required'; END IF;
  IF EXISTS (SELECT user_id FROM public.patients WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1)
  THEN RAISE EXCEPTION 'Duplicate patient ownership; preserve and reconcile before upgrade'; END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('v','m') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=c.oid AND d.deptype='e'))
  THEN RAISE EXCEPTION 'Public views require explicit privilege/isolation reconciliation'; END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e'))
  THEN RAISE EXCEPTION 'Existing privileged RPCs require explicit reconciliation'; END IF;
END $$;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id uuid;
ALTER TABLE public.users ADD CONSTRAINT users_auth_identity_unique UNIQUE(auth_user_id);
ALTER TABLE public.users ADD CONSTRAINT users_auth_identity_fk FOREIGN KEY(auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('patient','doctor','receptionist','admin','nurse','research'));
ALTER TABLE public.patients ALTER COLUMN dob DROP NOT NULL;
ALTER TABLE public.patients ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0);
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS patients_owned_user_unique ON public.patients(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  time_zone text NOT NULL DEFAULT 'Asia/Kolkata', is_demo boolean NOT NULL DEFAULT false
);
CREATE TABLE public.workspace_memberships (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id), user_id uuid NOT NULL REFERENCES public.users(id),
  role text NOT NULL CHECK (role IN ('doctor','receptionist','admin','nurse')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  PRIMARY KEY(workspace_id,user_id)
);
-- Adapts MediFlow patient_doctors relationship semantics, scoped to workspace,
-- explicit actor, clinical/intake purpose and revocation; no MongoDB introduced.
CREATE TABLE public.care_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id uuid NOT NULL REFERENCES public.patients(id),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id), provider_id uuid NOT NULL REFERENCES public.users(id),
  scope text NOT NULL CHECK (scope IN ('clinical','intake')), granted_by uuid NOT NULL REFERENCES public.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, revision integer NOT NULL DEFAULT 0,
  FOREIGN KEY(workspace_id,provider_id) REFERENCES public.workspace_memberships(workspace_id,user_id)
);
CREATE UNIQUE INDEX care_active_unique ON public.care_relationships(patient_id,workspace_id,provider_id,scope) WHERE revoked_at IS NULL;
ALTER TABLE public.consultations ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.consultations ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK (revision>=0);
ALTER TABLE public.consultations ADD COLUMN finalized_revision integer;

-- M2 metadata foundations. No authenticated direct inserts/grants yet; M2 will
-- implement quota/operation transactions before enabling document admission.
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id uuid NOT NULL REFERENCES public.patients(id),
  created_by uuid NOT NULL REFERENCES public.users(id), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
  kind text NOT NULL DEFAULT 'record', status text NOT NULL DEFAULT 'uploading' CHECK(status IN ('uploading','ready','upload_failed','deleted')),
  current_version_id uuid, revision integer NOT NULL DEFAULT 0, deleted_at timestamptz
);
CREATE TABLE public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES public.documents(id),
  version_no integer NOT NULL CHECK(version_no>0), object_key text UNIQUE NOT NULL,
  mime text NOT NULL CHECK(mime IN ('application/pdf','image/png','image/jpeg','text/plain')),
  byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 4194304), sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(document_id,version_no), UNIQUE(document_id,id)
);
ALTER TABLE public.documents ADD CONSTRAINT documents_current_version_fk
  FOREIGN KEY(id,current_version_id) REFERENCES public.document_versions(document_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE public.document_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES public.documents(id),
  provider_id uuid NOT NULL REFERENCES public.users(id), workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  granted_by uuid NOT NULL REFERENCES public.users(id), created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
  FOREIGN KEY(workspace_id,provider_id) REFERENCES public.workspace_memberships(workspace_id,user_id)
);
CREATE UNIQUE INDEX document_active_grant_unique ON public.document_grants(document_id,provider_id,workspace_id) WHERE revoked_at IS NULL;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
CREATE FUNCTION private.current_app_user_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT id FROM public.users WHERE auth_user_id=auth.uid() AND is_active=true
 AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=auth.uid() AND s.id::text=auth.jwt()->>'session_id')
$$;
CREATE FUNCTION private.has_workspace_role(w uuid, roles text[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.workspace_memberships m JOIN public.users u ON u.id=m.user_id
 WHERE m.workspace_id=w AND m.user_id=private.current_app_user_id() AND m.status='active' AND m.role=ANY(roles) AND u.role=m.role)
$$;
CREATE FUNCTION private.owns_patient(p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.patients WHERE id=p AND user_id=private.current_app_user_id())
$$;
CREATE FUNCTION private.can_treat(p uuid,w uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT private.has_workspace_role(w,ARRAY['doctor']) AND EXISTS(SELECT 1 FROM public.care_relationships c
 WHERE c.patient_id=p AND c.workspace_id=w AND c.provider_id=private.current_app_user_id() AND c.scope='clinical' AND c.revoked_at IS NULL)
$$;
CREATE FUNCTION private.can_read_document(d uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.documents x WHERE x.id=d AND x.deleted_at IS NULL AND x.status IN ('uploading','ready','upload_failed') AND
 (private.owns_patient(x.patient_id) OR (x.status='ready' AND EXISTS(SELECT 1 FROM public.document_grants g
 WHERE g.document_id=x.id AND g.provider_id=private.current_app_user_id() AND g.revoked_at IS NULL
 AND private.has_workspace_role(g.workspace_id,ARRAY['doctor'])
 AND EXISTS(SELECT 1 FROM public.users grantor WHERE grantor.id=g.granted_by AND grantor.id=x.created_by)
 ))))
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

-- Exact known legacy policies are removed below; unknown policies abort rather
-- than silently remaining OR-combined with new policies.
DROP POLICY IF EXISTS "Users can read own record" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Doctors can read all patients" ON public.patients;
DROP POLICY IF EXISTS "Patients can read own record" ON public.patients;
DROP POLICY IF EXISTS "Doctor can access own consultations" ON public.consultations;
DROP POLICY IF EXISTS "Patient can read own consultations" ON public.consultations;
DROP POLICY IF EXISTS "Doctor can manage transcripts" ON public.transcripts;
DROP POLICY IF EXISTS "Doctor can manage EMR entries" ON public.emr_entries;
DROP POLICY IF EXISTS "Patient can read own EMR entries" ON public.emr_entries;
DROP POLICY IF EXISTS "Doctor can manage safety alerts" ON public.safety_alerts;
DROP POLICY IF EXISTS "Authenticated users can insert audit events" ON public.audit_log;
DROP POLICY IF EXISTS "Doctors and admins can read audit log" ON public.audit_log;
DROP POLICY IF EXISTS "appointments_read" ON public.appointments;
DROP POLICY IF EXISTS "appointments_write" ON public.appointments;
DROP POLICY IF EXISTS "appointments_update" ON public.appointments;
DROP POLICY IF EXISTS "health_scores_read" ON public.health_scores;
DROP POLICY IF EXISTS "health_scores_write" ON public.health_scores;
DROP POLICY IF EXISTS "consent_records_read" ON public.consent_records;
DROP POLICY IF EXISTS "consent_records_write" ON public.consent_records;
DROP POLICY IF EXISTS "data_consents_read" ON public.data_consents;
DROP POLICY IF EXISTS "data_consents_write" ON public.data_consents;
DROP POLICY IF EXISTS "service_read_users" ON public.users;
DROP POLICY IF EXISTS "service_write_users" ON public.users;
DROP POLICY IF EXISTS "service_read_patients" ON public.patients;
DROP POLICY IF EXISTS "service_write_patients" ON public.patients;
DROP POLICY IF EXISTS "service_read_consultations" ON public.consultations;
DROP POLICY IF EXISTS "service_write_consultations" ON public.consultations;
DROP POLICY IF EXISTS "service_read_emr" ON public.emr_entries;
DROP POLICY IF EXISTS "service_write_emr" ON public.emr_entries;
DROP POLICY IF EXISTS "service_read_prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "service_write_prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "service_read_safety" ON public.safety_alerts;
DROP POLICY IF EXISTS "service_read_audit" ON public.audit_log;
DROP POLICY IF EXISTS "service_write_audit" ON public.audit_log;
DROP POLICY IF EXISTS "service_read_billing" ON public.billing_drafts;
DROP POLICY IF EXISTS "service_write_billing" ON public.billing_drafts;
DROP POLICY IF EXISTS "Doctors can read family members of their patients" ON public.family_members;
DROP POLICY IF EXISTS "Doctors can insert family members" ON public.family_members;
DROP POLICY IF EXISTS "Allow all access to queue" ON public.patient_queue;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=ANY(ARRAY['users','patients','consultations','transcripts','emr_entries','safety_alerts','prescriptions','billing_drafts','audit_log','appointments','health_scores','consent_records','data_consents','family_members','patient_queue','workspaces','workspace_memberships','care_relationships','documents','document_versions','document_grants'])) THEN RAISE EXCEPTION 'Unknown legacy policies require explicit reconciliation'; END IF; END $$;

-- Existing clinical tables are read-only or fully contained until scoped RPCs.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patients FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consultations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.consultations TO service_role;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transcripts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.transcripts TO service_role;
ALTER TABLE public.emr_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.emr_entries FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.emr_entries TO service_role;
ALTER TABLE public.safety_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.safety_alerts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.safety_alerts TO service_role;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prescriptions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.prescriptions TO service_role;
ALTER TABLE public.billing_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_drafts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.billing_drafts TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_log FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.appointments FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.health_scores FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.health_scores TO service_role;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consent_records FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.consent_records TO service_role;
ALTER TABLE public.data_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.data_consents FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.data_consents TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_members FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.patient_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_queue FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.patient_queue TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspaces FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_memberships FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.workspace_memberships TO service_role;
ALTER TABLE public.care_relationships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.care_relationships FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.care_relationships TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.documents FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_versions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.document_versions TO service_role;
ALTER TABLE public.document_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_grants FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.document_grants TO service_role;

CREATE POLICY users_self ON public.users FOR SELECT TO authenticated USING(id=private.current_app_user_id());
GRANT SELECT(id,auth_user_id,email,name,role,is_active,avatar_url,department,updated_at) ON public.users TO authenticated;
CREATE POLICY patients_scoped ON public.patients FOR SELECT TO authenticated USING(
 private.owns_patient(id) OR EXISTS(SELECT 1 FROM public.care_relationships c WHERE c.patient_id=patients.id AND private.can_treat(patients.id,c.workspace_id))
);
GRANT SELECT ON public.patients TO authenticated;
CREATE POLICY workspaces_member ON public.workspaces FOR SELECT TO authenticated USING(private.has_workspace_role(id,ARRAY['doctor','receptionist','admin','nurse']));
CREATE POLICY memberships_self ON public.workspace_memberships FOR SELECT TO authenticated USING(user_id=private.current_app_user_id());
CREATE POLICY care_scoped ON public.care_relationships FOR SELECT TO authenticated USING(private.owns_patient(patient_id) OR
 (provider_id=private.current_app_user_id() AND private.has_workspace_role(workspace_id,ARRAY['doctor','receptionist','nurse'])));
GRANT SELECT ON public.workspaces,public.workspace_memberships,public.care_relationships TO authenticated;
CREATE POLICY consultations_provider ON public.consultations FOR SELECT TO authenticated USING(
 doctor_id=private.current_app_user_id() AND private.can_treat(patient_id,workspace_id));
GRANT SELECT ON public.consultations TO authenticated;
CREATE POLICY transcripts_provider ON public.transcripts FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.consultations c WHERE c.id=consultation_id));
CREATE POLICY emr_provider ON public.emr_entries FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.consultations c WHERE c.id=consultation_id));
GRANT SELECT ON public.transcripts,public.emr_entries TO authenticated;
CREATE POLICY documents_scoped ON public.documents FOR SELECT TO authenticated USING(private.can_read_document(id));
CREATE POLICY versions_scoped ON public.document_versions FOR SELECT TO authenticated USING(private.can_read_document(document_id) AND
 (EXISTS(SELECT 1 FROM public.documents d WHERE d.id=document_id AND private.owns_patient(d.patient_id)) OR
 EXISTS(SELECT 1 FROM public.documents d WHERE d.id=document_id AND d.current_version_id=document_versions.id)));
CREATE POLICY grants_scoped ON public.document_grants FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.documents d WHERE d.id=document_id AND private.owns_patient(d.patient_id)) OR
 (provider_id=private.current_app_user_id() AND revoked_at IS NULL AND private.can_read_document(document_id)));
GRANT SELECT ON public.documents,public.document_versions,public.document_grants TO authenticated;

-- No direct Storage SELECT/signing: otherwise bearer signed links outlive revoke.
-- A byte proxy must first read metadata with the caller's RLS client, then load
-- that exact object with its server-only capability. No public buckets/URLs.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('clinical-documents','clinical-documents',false,4194304,ARRAY['application/pdf','image/png','image/jpeg','text/plain']),
 ('clinical-audio-temp','clinical-audio-temp',false,4194304,ARRAY['audio/wav','audio/webm'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects')
 THEN RAISE EXCEPTION 'Existing Storage policies require explicit inventory and removal before upgrade'; END IF;
END $$;
CREATE POLICY clinical_owner_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id='clinical-documents' AND EXISTS(SELECT 1 FROM public.document_versions v JOIN public.documents d ON d.id=v.document_id
 WHERE v.object_key=name AND d.status='uploading' AND d.deleted_at IS NULL AND d.created_by=private.current_app_user_id() AND private.owns_patient(d.patient_id)));

CREATE FUNCTION public.bootstrap_patient() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=auth.uid(); existing_id uuid; new_id uuid; verified_email text;
BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=a AND s.id::text=auth.jwt()->>'session_id')
 THEN RAISE EXCEPTION 'Active session required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text,0));
 SELECT id INTO existing_id FROM public.users WHERE auth_user_id=a;
 IF existing_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=existing_id AND is_active) THEN RAISE EXCEPTION 'Inactive account' USING ERRCODE='42501'; END IF;
   RETURN existing_id;
 END IF;
 SELECT email INTO verified_email FROM auth.users WHERE id=a AND email_confirmed_at IS NOT NULL AND is_anonymous IS NOT TRUE;
 IF verified_email IS NULL THEN RAISE EXCEPTION 'Verified identity required' USING ERRCODE='42501'; END IF;
 -- A collision is not permission to merge or attach the legacy account.
 IF EXISTS(SELECT 1 FROM public.users WHERE lower(email)=lower(verified_email)) THEN
   RAISE EXCEPTION 'Explicit legacy identity reconciliation required' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.users(email,name,role,auth_user_id,is_active) VALUES(verified_email,'Patient','patient',a,true) RETURNING id INTO new_id;
 INSERT INTO public.patients(user_id,name) VALUES(new_id,'Patient');
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.bootstrap_patient() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_patient() TO authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
