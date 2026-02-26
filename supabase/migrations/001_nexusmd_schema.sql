-- ============================================================
-- NexusMD Database Schema — Supabase PostgreSQL
-- Run in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  role          TEXT NOT NULL DEFAULT 'patient'
                  CHECK (role IN ('doctor','patient','nurse','admin','research')),
  name          TEXT NOT NULL,
  phone         TEXT,
  language_pref TEXT NOT NULL DEFAULT 'en'
                  CHECK (language_pref IN ('en','hi','hinglish')),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own record"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ─── Patients ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patients (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  dob                DATE NOT NULL,
  gender             TEXT CHECK (gender IN ('M','F','Other')),
  blood_group        TEXT,
  allergies          TEXT[]    DEFAULT '{}',
  chronic_conditions TEXT[]    DEFAULT '{}',
  abha_id            TEXT UNIQUE,
  phone              TEXT NOT NULL,
  address            TEXT,
  emergency_contact  TEXT,
  family_id          UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can read all patients"
  ON public.patients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('doctor','nurse','admin')
    )
  );

CREATE POLICY "Patients can read own record"
  ON public.patients FOR SELECT
  USING (user_id = auth.uid());

-- ─── Consultations ────────────────────────────────────────────────────────────
-- FHIR-lite JSON support via fhir_bundle JSONB
CREATE TABLE IF NOT EXISTS public.consultations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  patient_id          UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at            TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','completed','draft','cancelled')),
  consultation_type   TEXT NOT NULL DEFAULT 'general'
                        CHECK (consultation_type IN ('general','followup','emergency','triage','teleconsult')),
  chief_complaint     TEXT,
  consent_recorded    BOOLEAN NOT NULL DEFAULT FALSE,
  consent_timestamp   TIMESTAMPTZ,
  -- FHIR-lite Bundle (IHE / HL7 compatible export)
  fhir_bundle         JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctor can access own consultations"
  ON public.consultations FOR ALL
  USING (doctor_id = auth.uid());

CREATE POLICY "Patient can read own consultations"
  ON public.consultations FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM public.patients WHERE user_id = auth.uid()
    )
  );

-- ─── Transcripts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transcripts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE,
  raw_text        TEXT NOT NULL DEFAULT '',
  segments        JSONB DEFAULT '[]', -- TranscriptSegment[]
  language        TEXT DEFAULT 'en',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctor can manage transcripts"
  ON public.transcripts FOR ALL
  USING (
    consultation_id IN (
      SELECT id FROM public.consultations WHERE doctor_id = auth.uid()
    )
  );

-- ─── EMR Entries ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.emr_entries (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id       UUID REFERENCES public.consultations(id) ON DELETE CASCADE,
  vitals                JSONB DEFAULT '{}',
  chief_complaint       TEXT DEFAULT '',
  symptoms              TEXT[]   DEFAULT '{}',
  diagnosis             TEXT[]   DEFAULT '{}',
  icd_codes             JSONB    DEFAULT '[]',   -- IcdCode[]
  medications           JSONB    DEFAULT '[]',   -- Medication[]
  lab_tests_ordered     TEXT[]   DEFAULT '{}',
  physical_examination  TEXT     DEFAULT '',
  missing_fields        TEXT[]   DEFAULT '{}',
  gap_prompts           TEXT[]   DEFAULT '{}',
  clinical_summary      TEXT,
  patient_summary       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.emr_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctor can manage EMR entries"
  ON public.emr_entries FOR ALL
  USING (
    consultation_id IN (
      SELECT id FROM public.consultations WHERE doctor_id = auth.uid()
    )
  );

CREATE POLICY "Patient can read own EMR entries"
  ON public.emr_entries FOR SELECT
  USING (
    consultation_id IN (
      SELECT c.id FROM public.consultations c
      JOIN public.patients p ON c.patient_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- ─── Safety Alerts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.safety_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE,
  alert_type      TEXT NOT NULL
                    CHECK (alert_type IN ('drug_interaction','allergy','contraindication','dosage')),
  severity        TEXT NOT NULL
                    CHECK (severity IN ('low','medium','high','critical')),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  drug_a          TEXT,
  drug_b          TEXT,
  mechanism       TEXT,
  alternatives    TEXT[] DEFAULT '{}',
  acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by UUID REFERENCES public.users(id),
  override_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.safety_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctor can manage safety alerts"
  ON public.safety_alerts FOR ALL
  USING (
    consultation_id IN (
      SELECT id FROM public.consultations WHERE doctor_id = auth.uid()
    )
  );

-- ─── Prescriptions / Drug Costs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id         UUID REFERENCES public.consultations(id) ON DELETE CASCADE,
  medication_name         TEXT NOT NULL,
  brand_name              TEXT,
  brand_price             NUMERIC(10,2),
  generic_name            TEXT,
  generic_price           NUMERIC(10,2),
  jan_aushadhi_available  BOOLEAN DEFAULT FALSE,
  jan_aushadhi_price      NUMERIC(10,2),
  jan_aushadhi_store      TEXT,
  monthly_savings         NUMERIC(10,2),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Billing Drafts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.billing_drafts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE UNIQUE,
  line_items      JSONB NOT NULL DEFAULT '[]',
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax             NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  insurance_eligible BOOLEAN DEFAULT FALSE,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','finalized','submitted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Audit Log (Append-Only — Legal Shield) ────────────────────────────────
-- This table is INSERT-only. No UPDATE or DELETE allowed (immutable legal record).
CREATE TABLE IF NOT EXISTS public.audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE RESTRICT,
  event_type      TEXT NOT NULL,
  actor_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_role      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hash            TEXT NOT NULL, -- SHA chain hash
  previous_hash   TEXT NOT NULL DEFAULT '0000000000000000'
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ONLY INSERT allowed — no update/delete for immutability
CREATE POLICY "Authenticated users can insert audit events"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Doctors and admins can read audit log"
  ON public.audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('doctor','admin')
    )
  );

-- ─── Realtime — enable for live transcript updates ─────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.transcripts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.emr_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.safety_alerts;

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_consultations_doctor ON public.consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON public.consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_emr_consultation ON public.emr_entries(consultation_id);
CREATE INDEX IF NOT EXISTS idx_audit_consultation ON public.audit_log(consultation_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_safety_consultation ON public.safety_alerts(consultation_id);

-- ─── Trigger: auto-update updated_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_emr_updated_at
  BEFORE UPDATE ON public.emr_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_transcripts_updated_at
  BEFORE UPDATE ON public.transcripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
