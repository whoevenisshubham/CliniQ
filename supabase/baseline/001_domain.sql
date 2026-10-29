-- Derived from CliniQ d2fadb6 domain DDL; no seeds or permissive policies.
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




-- ─── Realtime — enable for live transcript updates ─────────────────────────




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


-- ============================================================
-- Family Members Table — For Family Health Graph
-- ============================================================

CREATE TABLE IF NOT EXISTS public.family_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  relation   TEXT NOT NULL,
  age        INTEGER,
  gender     TEXT CHECK (gender IN ('M','F')),
  conditions TEXT[] DEFAULT '{}',
  deceased   BOOLEAN DEFAULT false,
  is_patient BOOLEAN DEFAULT false,
  parent_id  UUID REFERENCES public.family_members(id), -- self-referencing for tree
  generation INTEGER DEFAULT 0,  -- 0=grandparents, 1=parents, 2=patient, 3=children
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;






-- =====================================================================
-- NexusMD Migration 004: Receptionist Workflow & Patient Queue
-- =====================================================================

-- Patient queue / walk-in waitlist
CREATE TABLE IF NOT EXISTS patient_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id TEXT NOT NULL,
  patient_name TEXT NOT NULL DEFAULT '',
  doctor_id TEXT,
  doctor_name TEXT DEFAULT '',
  queue_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting',  -- waiting | in-consultation | completed | no-show | cancelled
  priority TEXT NOT NULL DEFAULT 'normal', -- normal | urgent | emergency
  check_in_time TIMESTAMPTZ DEFAULT now(),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  consultation_id TEXT,
  reason TEXT DEFAULT '',
  visit_type TEXT DEFAULT 'walk-in',  -- walk-in | appointment | emergency | referral
  registered_by TEXT DEFAULT '',
  vitals_recorded JSONB DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for queue
CREATE INDEX IF NOT EXISTS idx_queue_status ON patient_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_doctor ON patient_queue(doctor_id);
CREATE INDEX IF NOT EXISTS idx_queue_date ON patient_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_queue_patient ON patient_queue(patient_id);

