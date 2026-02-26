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

-- RLS for queue (permissive for demo)
ALTER TABLE patient_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to queue" ON patient_queue FOR ALL USING (true) WITH CHECK (true);

-- Seed some queue entries for demo
INSERT INTO patient_queue (patient_id, patient_name, doctor_id, doctor_name, queue_number, status, priority, reason, visit_type, registered_by, vitals_recorded)
VALUES
  ('demo-patient-001', 'Priya Sharma', 'demo-doctor-001', 'Dr. Arjun Sharma', 1, 'waiting', 'normal', 'Follow-up: Diabetes management', 'appointment', 'demo-receptionist-001',
   '{"bp_systolic": 138, "bp_diastolic": 88, "heart_rate": 78, "temperature": 98.4, "spo2": 97, "weight": 68}'::jsonb),
  ('demo-patient-002', 'Rajesh Kumar', 'demo-doctor-001', 'Dr. Arjun Sharma', 2, 'waiting', 'urgent', 'Chest pain, shortness of breath', 'walk-in', 'demo-receptionist-001',
   '{"bp_systolic": 156, "bp_diastolic": 98, "heart_rate": 92, "temperature": 99.1, "spo2": 94, "weight": 85}'::jsonb),
  ('demo-patient-003', 'Anita Verma', 'demo-doctor-002', 'Dr. Neha Patel', 1, 'waiting', 'normal', 'Skin rash, itching for 1 week', 'walk-in', 'demo-receptionist-001',
   '{"bp_systolic": 120, "bp_diastolic": 80, "heart_rate": 72, "temperature": 98.6, "spo2": 99, "weight": 55}'::jsonb)
ON CONFLICT DO NOTHING;

-- Also ensure demo users exist for patient-002 and patient-003
INSERT INTO users (id, email, name, role, is_active)
VALUES
  ('demo-patient-002', 'rajesh.kumar@email.com', 'Rajesh Kumar', 'patient', true),
  ('demo-patient-003', 'anita.verma@email.com', 'Anita Verma', 'patient', true),
  ('demo-receptionist-001', 'demo.reception@nexusmd.app', 'Kavita (Receptionist)', 'receptionist', true),
  ('demo-doctor-002', 'neha.patel@nexusmd.app', 'Dr. Neha Patel', 'doctor', true)
ON CONFLICT (id) DO NOTHING;

-- Patients table entries for new demo patients
INSERT INTO patients (id, user_id, name, dob, gender, blood_group, phone, allergies, chronic_conditions)
VALUES
  (gen_random_uuid(), 'demo-patient-002', 'Rajesh Kumar', '1975-08-22', 'M', 'A+', '+91 87654 32109', ARRAY['Sulfa drugs'], ARRAY['Hypertension', 'Obesity']),
  (gen_random_uuid(), 'demo-patient-003', 'Anita Verma', '1992-11-08', 'F', 'O+', '+91 76543 21098', ARRAY[]::TEXT[], ARRAY['Asthma'])
ON CONFLICT DO NOTHING;
