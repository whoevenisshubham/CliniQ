-- ============================================================
-- NexusMD Seed Data — 003
-- Run AFTER 001 + 002 in Supabase SQL Editor
-- Seeds demo patient data: consultations, prescriptions,
-- appointments, health scores, billing
-- ============================================================

DO $$
DECLARE
  doc1_id UUID;
  doc2_id UUID;
  pat_id  UUID;
  c1      UUID;
  c2      UUID;
  c3      UUID;
BEGIN
  -- Get doctor UUIDs (created by the /api/seed endpoint or migration 001)
  SELECT id INTO doc1_id FROM public.users WHERE email = 'demo.doctor@nexusmd.app' LIMIT 1;
  SELECT id INTO doc2_id FROM public.users WHERE email = 'demo.doctor2@nexusmd.app' LIMIT 1;
  SELECT id INTO pat_id FROM public.patients WHERE abha_id = 'DEMO-ABHA-12345' LIMIT 1;

  -- If patient doesn't exist yet, create one
  IF pat_id IS NULL AND doc1_id IS NOT NULL THEN
    -- First check if demo patient user exists
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'demo.patient@nexusmd.app') THEN
      INSERT INTO public.users (email, name, role, phone, language_pref)
      VALUES ('demo.patient@nexusmd.app', 'Priya Sharma', 'patient', '+91-9876543211', 'hi')
      RETURNING id INTO doc1_id; -- reuse variable temporarily
    END IF;

    INSERT INTO public.patients (user_id, name, dob, gender, blood_group, allergies, chronic_conditions, abha_id, phone, address, emergency_contact)
    SELECT u.id, 'Priya Sharma', '1981-03-15', 'F', 'B+',
           ARRAY['Sulfonamides', 'Penicillin'],
           ARRAY['Type 2 Diabetes', 'Hypertension'],
           'DEMO-ABHA-12345', '+91 98765 43211',
           '42, Sector 15, Gurugram, Haryana, 122001',
           '{"name": "Rajesh Sharma", "relation": "Spouse", "phone": "+91 98765 43210"}'
    FROM public.users u WHERE u.email = 'demo.patient@nexusmd.app'
    ON CONFLICT (abha_id) DO NOTHING
    RETURNING id INTO pat_id;
  END IF;

  -- Only seed if we have both doctors and patient
  IF doc1_id IS NOT NULL AND pat_id IS NOT NULL THEN

    -- If no second doctor, use first doctor
    IF doc2_id IS NULL THEN doc2_id := doc1_id; END IF;

    -- ═══ Consultations ═══
    INSERT INTO public.consultations (patient_id, doctor_id, status, consultation_type, mode, started_at, ended_at, duration_sec, chief_complaint, location)
    VALUES (pat_id, doc1_id, 'completed', 'followup', 'in-person',
            NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days' + INTERVAL '32 minutes', 1920,
            'Diabetes follow-up — HbA1c recheck', 'gurugram')
    RETURNING id INTO c1;

    INSERT INTO public.consultations (patient_id, doctor_id, status, consultation_type, mode, started_at, ended_at, duration_sec, chief_complaint, location)
    VALUES (pat_id, doc1_id, 'completed', 'followup', 'in-person',
            NOW() - INTERVAL '37 days', NOW() - INTERVAL '37 days' + INTERVAL '45 minutes', 2700,
            'Hypertension management — BP review', 'gurugram')
    RETURNING id INTO c2;

    INSERT INTO public.consultations (patient_id, doctor_id, status, consultation_type, mode, started_at, ended_at, duration_sec, chief_complaint, location)
    VALUES (pat_id, doc2_id, 'completed', 'general', 'in-person',
            NOW() - INTERVAL '78 days', NOW() - INTERVAL '78 days' + INTERVAL '22 minutes', 1320,
            'Seasonal flu — fever and body ache', 'gurugram')
    RETURNING id INTO c3;

    -- ═══ EMR Entries ═══
    INSERT INTO public.emr_entries (consultation_id, chief_complaint, symptoms, diagnosis, icd_codes, medications, vitals, lab_tests_ordered, physical_examination) VALUES
    (c1, 'Diabetes follow-up — HbA1c recheck',
     ARRAY['fatigue', 'increased thirst', 'frequent urination'],
     ARRAY['Type 2 Diabetes Mellitus', 'Essential Hypertension'],
     '[{"code":"E11.9","description":"Type 2 DM without complications","confidence":0.95},{"code":"I10","description":"Essential Hypertension","confidence":0.90}]'::jsonb,
     '[{"name":"Metformin","dosage":"500mg","frequency":"Twice daily","duration":"Ongoing","generic_name":"Metformin Hydrochloride"},{"name":"Amlodipine","dosage":"5mg","frequency":"Once daily","duration":"Ongoing","generic_name":"Amlodipine Besylate"}]'::jsonb,
     '{"bp_systolic":138,"bp_diastolic":88,"heart_rate":78,"temperature":98.4,"spo2":97,"weight":68,"height":162}'::jsonb,
     ARRAY['HbA1c', 'Fasting Blood Sugar', 'Lipid Panel'],
     'Mild pedal edema. No retinopathy. Peripheral pulses normal.'),

    (c2, 'Hypertension management — BP review',
     ARRAY['headache', 'dizziness on standing'],
     ARRAY['Essential Hypertension', 'Orthostatic Hypotension evaluation'],
     '[{"code":"I10","description":"Essential Hypertension","confidence":0.92}]'::jsonb,
     '[{"name":"Amlodipine","dosage":"5mg","frequency":"Once daily","duration":"Ongoing","generic_name":"Amlodipine Besylate"},{"name":"Atorvastatin","dosage":"10mg","frequency":"Once at night","duration":"Ongoing","generic_name":"Atorvastatin Calcium"}]'::jsonb,
     '{"bp_systolic":145,"bp_diastolic":92,"heart_rate":82,"temperature":98.6,"spo2":98,"weight":69,"height":162}'::jsonb,
     ARRAY['Complete Blood Count', 'Renal Function Test'],
     'BP elevated. No focal neurological deficits. Fundoscopy normal.'),

    (c3, 'Seasonal flu — fever and body ache',
     ARRAY['fever', 'body ache', 'sore throat', 'runny nose'],
     ARRAY['Acute Upper Respiratory Infection'],
     '[{"code":"J06.9","description":"Acute upper respiratory infection, unspecified","confidence":0.88}]'::jsonb,
     '[{"name":"Paracetamol","dosage":"500mg","frequency":"As needed (max 3/day)","duration":"5 days","generic_name":"Paracetamol"},{"name":"Cetirizine","dosage":"10mg","frequency":"Once daily","duration":"7 days","generic_name":"Cetirizine Hydrochloride"}]'::jsonb,
     '{"bp_systolic":120,"bp_diastolic":78,"heart_rate":88,"temperature":101.2,"spo2":96,"weight":68,"height":162}'::jsonb,
     ARRAY['Complete Blood Count'],
     'Pharynx congested. Tonsils mildly enlarged. Chest clear.');

    -- ═══ Prescriptions ═══
    INSERT INTO public.prescriptions (consultation_id, patient_id, doctor_id, medication_name, generic_name, dosage, frequency, duration, instructions, brand_price, generic_price, jan_aushadhi_price, jan_aushadhi_available, status) VALUES
    (c1, pat_id, doc1_id, 'Metformin 500mg', 'Metformin Hydrochloride', '500mg', 'Twice daily (morning & night)', 'Ongoing', 'Take with food. Do not skip doses.', 180, 45, 22, TRUE, 'active'),
    (c2, pat_id, doc1_id, 'Amlodipine 5mg', 'Amlodipine Besylate', '5mg', 'Once daily (morning)', 'Ongoing', 'Take at the same time each day.', 250, 60, 28, TRUE, 'active'),
    (c2, pat_id, doc1_id, 'Atorvastatin 10mg', 'Atorvastatin Calcium', '10mg', 'Once at night', 'Ongoing', 'Take after dinner. Avoid grapefruit juice.', 320, 78, 35, TRUE, 'active'),
    (c3, pat_id, doc2_id, 'Paracetamol 500mg', 'Paracetamol', '500mg', 'As needed (max 3/day)', '5 days', 'Take with water after food.', 45, 12, 8, TRUE, 'completed'),
    (c3, pat_id, doc2_id, 'Cetirizine 10mg', 'Cetirizine Hydrochloride', '10mg', 'Once daily', '7 days', 'May cause drowsiness.', 95, 20, 10, TRUE, 'completed');

    -- ═══ Appointments ═══
    INSERT INTO public.appointments (patient_id, doctor_id, date, time_slot, type, mode, reason, status) VALUES
    (pat_id, doc1_id, CURRENT_DATE + 7, '10:00 AM', 'followup', 'in-person', 'Diabetes follow-up — HbA1c recheck', 'confirmed'),
    (pat_id, doc2_id, CURRENT_DATE + 20, '2:30 PM', 'general', 'teleconsult', 'Annual health checkup', 'confirmed'),
    (pat_id, doc1_id, CURRENT_DATE - 11, '10:00 AM', 'followup', 'in-person', 'Diabetes follow-up', 'completed'),
    (pat_id, doc1_id, CURRENT_DATE - 37, '11:00 AM', 'followup', 'in-person', 'Hypertension management', 'completed'),
    (pat_id, doc2_id, CURRENT_DATE - 78, '3:00 PM', 'general', 'in-person', 'Seasonal flu', 'completed');

    -- ═══ Health Score ═══
    INSERT INTO public.health_scores (patient_id, overall_score, vitals_score, chronic_control, medication_adherence, preventive_care, lifestyle_score) VALUES
    (pat_id, 72, 78, 65, 88, 60, 70);

    -- ═══ Data Consents ═══
    INSERT INTO public.data_consents (patient_id, purpose, description, enabled) VALUES
    (pat_id, 'Research Data Sharing', 'Allow anonymized health data to be used for medical research', TRUE),
    (pat_id, 'Government Epidemiology', 'Share aggregated data with public health authorities for disease tracking', TRUE),
    (pat_id, 'Insurance Claims', 'Allow automated sharing of reports with your insurance provider', FALSE),
    (pat_id, 'WhatsApp Notifications', 'Receive appointment reminders and reports via WhatsApp', TRUE);

    -- ═══ Billing ═══
    INSERT INTO public.billing_drafts (consultation_id, line_items, subtotal, tax, total, status) VALUES
    (c1, '[{"description":"Follow-up Consultation","quantity":1,"unit_price":1000,"total":1000},{"description":"Lab Tests (HbA1c + FBS + Lipid)","quantity":1,"unit_price":1800,"total":1800}]'::jsonb, 2800, 504, 3304, 'finalized'),
    (c2, '[{"description":"Follow-up Consultation","quantity":1,"unit_price":1000,"total":1000},{"description":"Lab Tests (CBC + RFT)","quantity":1,"unit_price":900,"total":900}]'::jsonb, 1900, 342, 2242, 'finalized'),
    (c3, '[{"description":"General Consultation","quantity":1,"unit_price":700,"total":700},{"description":"Lab Tests (CBC)","quantity":1,"unit_price":400,"total":400}]'::jsonb, 1100, 198, 1298, 'finalized');

    RAISE NOTICE 'Seed data inserted successfully for patient: %', pat_id;
  ELSE
    RAISE NOTICE 'Could not find demo users. Run /api/seed first, then re-run this migration.';
  END IF;
END $$;
