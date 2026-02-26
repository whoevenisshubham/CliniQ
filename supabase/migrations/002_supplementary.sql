-- ============================================================
-- NexusMD Supplementary Migration — 002
-- Adds: appointments, health_scores, consent_records, data_consents
-- Seeds: demo data for Priya Sharma
-- Run AFTER 001_nexusmd_schema.sql in Supabase SQL Editor
-- ============================================================

-- ─── Appointments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appointments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID REFERENCES public.patients(id),
  doctor_id     UUID REFERENCES public.users(id),
  date          DATE NOT NULL,
  time_slot     TEXT NOT NULL,
  type          TEXT DEFAULT 'general' CHECK (type IN ('general','followup','emergency','teleconsult')),
  mode          TEXT DEFAULT 'in-person' CHECK (mode IN ('in-person','teleconsult')),
  reason        TEXT,
  status        TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed','completed','cancelled','no-show')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointments_read" ON public.appointments FOR SELECT USING (TRUE);
CREATE POLICY "appointments_write" ON public.appointments FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "appointments_update" ON public.appointments FOR UPDATE USING (TRUE);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);

-- ─── Health Scores ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.health_scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID REFERENCES public.patients(id),
  overall_score         INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  vitals_score          INTEGER,
  chronic_control       INTEGER,
  medication_adherence  INTEGER,
  preventive_care       INTEGER,
  lifestyle_score       INTEGER,
  computed_at           TIMESTAMPTZ DEFAULT NOW(),
  methodology           TEXT DEFAULT 'composite_v1'
);

ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_scores_read" ON public.health_scores FOR SELECT USING (TRUE);
CREATE POLICY "health_scores_write" ON public.health_scores FOR INSERT WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_health_scores_patient ON public.health_scores(patient_id);

-- ─── Consent Records ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consent_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id   UUID REFERENCES public.consultations(id),
  patient_id        UUID REFERENCES public.patients(id),
  consent_type      TEXT CHECK (consent_type IN ('voice','otp_esign','written')),
  audio_url         TEXT,
  otp_verified      BOOLEAN DEFAULT FALSE,
  ip_address        TEXT,
  recorded_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consent_records_read" ON public.consent_records FOR SELECT USING (TRUE);
CREATE POLICY "consent_records_write" ON public.consent_records FOR INSERT WITH CHECK (TRUE);

-- ─── Data Consents (patient privacy preferences) ─────────────
CREATE TABLE IF NOT EXISTS public.data_consents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID REFERENCES public.patients(id),
  purpose       TEXT NOT NULL,
  description   TEXT,
  enabled       BOOLEAN DEFAULT FALSE,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.data_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "data_consents_read" ON public.data_consents FOR SELECT USING (TRUE);
CREATE POLICY "data_consents_write" ON public.data_consents FOR ALL USING (TRUE);

-- ─── Add missing columns to prescriptions ─────────────────────
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.patients(id);
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES public.users(id);
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS dosage TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS frequency TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','cancelled'));
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS prescribed_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON public.prescriptions(status);

-- ─── Add missing columns to consultations ─────────────────────
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'in-person';
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS duration_sec INTEGER;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS full_transcript TEXT;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'gurugram';

-- ─── Add missing columns to emr_entries ───────────────────────
ALTER TABLE public.emr_entries ADD COLUMN IF NOT EXISTS differentials JSONB DEFAULT '[]';
ALTER TABLE public.emr_entries ADD COLUMN IF NOT EXISTS patient_summary_en JSONB;
ALTER TABLE public.emr_entries ADD COLUMN IF NOT EXISTS patient_summary_hi JSONB;
ALTER TABLE public.emr_entries ADD COLUMN IF NOT EXISTS epidemiology_context JSONB;
ALTER TABLE public.emr_entries ADD COLUMN IF NOT EXISTS extraction_model TEXT DEFAULT 'llama3-70b-8192';

-- ─── Fix RLS: make tables accessible via service role key ─────
-- (The existing RLS policies use auth.uid() which doesn't work with demo auth.
--  Add permissive policies so the service-role client can read/write.)
DO $$
BEGIN
  -- These will only be created if they don't already exist
  BEGIN CREATE POLICY "service_read_users" ON public.users FOR SELECT USING (TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "service_write_users" ON public.users FOR INSERT WITH CHECK (TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "service_read_patients" ON public.patients FOR SELECT USING (TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "service_write_patients" ON public.patients FOR INSERT WITH CHECK (TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "service_read_consultations" ON public.consultations FOR SELECT USING (TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "service_write_consultations" ON public.consultations FOR INSERT WITH CHECK (TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "service_read_emr" ON public.emr_entries FOR SELECT USING (TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "service_write_emr" ON public.emr_entries FOR INSERT WITH CHECK (TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "service_read_prescriptions" ON public.prescriptions FOR SELECT USING (TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "service_write_prescriptions" ON public.prescriptions FOR INSERT WITH CHECK (TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "service_read_safety" ON public.safety_alerts FOR SELECT USING (TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "service_read_audit" ON public.audit_log FOR SELECT USING (TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "service_write_audit" ON public.audit_log FOR INSERT WITH CHECK (TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "service_read_billing" ON public.billing_drafts FOR SELECT USING (TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "service_write_billing" ON public.billing_drafts FOR INSERT WITH CHECK (TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
