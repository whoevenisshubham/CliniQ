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

CREATE POLICY "Doctors can read family members of their patients"
  ON public.family_members FOR SELECT
  USING (true);

CREATE POLICY "Doctors can insert family members"
  ON public.family_members FOR INSERT
  WITH CHECK (true);

-- ─── Seed data for demo patient (Priya Sharma, patient_id = 1) ──────────────
-- Uses a fixed UUID for the demo patient link

DO $$
DECLARE
  demo_patient_id UUID;
  gf_p_id UUID := uuid_generate_v4();
  gm_p_id UUID := uuid_generate_v4();
  gf_m_id UUID := uuid_generate_v4();
  gm_m_id UUID := uuid_generate_v4();
  father_id UUID := uuid_generate_v4();
  mother_id UUID := uuid_generate_v4();
  uncle_id UUID := uuid_generate_v4();
  patient_node_id UUID := uuid_generate_v4();
  brother_id UUID := uuid_generate_v4();
  sister_id UUID := uuid_generate_v4();
  son_id UUID := uuid_generate_v4();
  daughter_id UUID := uuid_generate_v4();
BEGIN
  -- Try to find the demo patient; if not found, use a placeholder UUID
  SELECT id INTO demo_patient_id FROM public.patients WHERE name ILIKE '%Priya%' LIMIT 1;
  IF demo_patient_id IS NULL THEN
    demo_patient_id := '00000000-0000-0000-0000-000000000001'::UUID;
  END IF;

  -- Generation 0 — Grandparents
  INSERT INTO public.family_members (id, patient_id, name, relation, age, gender, conditions, deceased, is_patient, parent_id, generation)
  VALUES
    (gf_p_id, demo_patient_id, 'Krishnarao Sharma', 'Paternal Grandfather', 82, 'M', ARRAY['Type 2 Diabetes','Hypertension'], true, false, NULL, 0),
    (gm_p_id, demo_patient_id, 'Saraswati Sharma', 'Paternal Grandmother', 78, 'F', ARRAY['Hypertension','Osteoporosis'], false, false, NULL, 0),
    (gf_m_id, demo_patient_id, 'Shivaji Patel', 'Maternal Grandfather', 80, 'M', ARRAY['CAD','Type 2 Diabetes'], true, false, NULL, 0),
    (gm_m_id, demo_patient_id, 'Kamala Patel', 'Maternal Grandmother', 75, 'F', ARRAY['Type 2 Diabetes','Cataract'], false, false, NULL, 0);

  -- Generation 1 — Parents & Uncle
  INSERT INTO public.family_members (id, patient_id, name, relation, age, gender, conditions, deceased, is_patient, parent_id, generation)
  VALUES
    (father_id, demo_patient_id, 'Suresh Sharma', 'Father', 58, 'M', ARRAY['Type 2 Diabetes','Hypertension','Dyslipidaemia'], false, false, gf_p_id, 1),
    (mother_id, demo_patient_id, 'Sunita Sharma', 'Mother', 54, 'F', ARRAY['Hypothyroidism','Hypertension'], false, false, gf_m_id, 1),
    (uncle_id, demo_patient_id, 'Vijay Sharma', 'Paternal Uncle', 52, 'M', ARRAY['Type 2 Diabetes','CAD'], false, false, gf_p_id, 1);

  -- Generation 2 — Patient + Siblings
  INSERT INTO public.family_members (id, patient_id, name, relation, age, gender, conditions, deceased, is_patient, parent_id, generation)
  VALUES
    (patient_node_id, demo_patient_id, 'Priya Sharma', 'Patient', 45, 'F', ARRAY['Type 2 Diabetes','Hypertension'], false, true, father_id, 2),
    (brother_id, demo_patient_id, 'Rahul Sharma', 'Brother', 42, 'M', ARRAY['Pre-diabetes','Hypertension'], false, false, father_id, 2),
    (sister_id, demo_patient_id, 'Neha Sharma', 'Sister', 38, 'F', ARRAY['Hypothyroidism'], false, false, father_id, 2);

  -- Generation 3 — Children
  INSERT INTO public.family_members (id, patient_id, name, relation, age, gender, conditions, deceased, is_patient, parent_id, generation)
  VALUES
    (son_id, demo_patient_id, 'Arjun Sharma', 'Son', 19, 'M', ARRAY['Asthma'], false, false, patient_node_id, 3),
    (daughter_id, demo_patient_id, 'Kavya Sharma', 'Daughter', 16, 'F', ARRAY[]::TEXT[], false, false, patient_node_id, 3);

END $$;
