-- Isolated upgrade fixture only. Never deploy these legacy policies.
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
CREATE POLICY "Doctor can manage transcripts"
  ON public.transcripts FOR ALL
  USING (
    consultation_id IN (
      SELECT id FROM public.consultations WHERE doctor_id = auth.uid()
    )
  );
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
CREATE POLICY "Doctor can manage safety alerts"
  ON public.safety_alerts FOR ALL
  USING (
    consultation_id IN (
      SELECT id FROM public.consultations WHERE doctor_id = auth.uid()
    )
  );
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
CREATE POLICY "appointments_read" ON public.appointments FOR SELECT USING (TRUE);
CREATE POLICY "appointments_write" ON public.appointments FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "appointments_update" ON public.appointments FOR UPDATE USING (TRUE);
CREATE POLICY "health_scores_read" ON public.health_scores FOR SELECT USING (TRUE);
CREATE POLICY "health_scores_write" ON public.health_scores FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "consent_records_read" ON public.consent_records FOR SELECT USING (TRUE);
CREATE POLICY "consent_records_write" ON public.consent_records FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "data_consents_read" ON public.data_consents FOR SELECT USING (TRUE);
CREATE POLICY "data_consents_write" ON public.data_consents FOR ALL USING (TRUE);
CREATE POLICY "service_read_users" ON public.users FOR SELECT USING (TRUE);
CREATE POLICY "service_write_users" ON public.users FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "service_read_patients" ON public.patients FOR SELECT USING (TRUE);
CREATE POLICY "service_write_patients" ON public.patients FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "service_read_consultations" ON public.consultations FOR SELECT USING (TRUE);
CREATE POLICY "service_write_consultations" ON public.consultations FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "service_read_emr" ON public.emr_entries FOR SELECT USING (TRUE);
CREATE POLICY "service_write_emr" ON public.emr_entries FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "service_read_prescriptions" ON public.prescriptions FOR SELECT USING (TRUE);
CREATE POLICY "service_write_prescriptions" ON public.prescriptions FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "service_read_safety" ON public.safety_alerts FOR SELECT USING (TRUE);
CREATE POLICY "service_read_audit" ON public.audit_log FOR SELECT USING (TRUE);
CREATE POLICY "service_write_audit" ON public.audit_log FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "service_read_billing" ON public.billing_drafts FOR SELECT USING (TRUE);
CREATE POLICY "service_write_billing" ON public.billing_drafts FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Doctors can read family members of their patients"
  ON public.family_members FOR SELECT
  USING (true);
CREATE POLICY "Doctors can insert family members"
  ON public.family_members FOR INSERT
  WITH CHECK (true);
CREATE POLICY "Allow all access to queue" ON patient_queue FOR ALL USING (true) WITH CHECK (true);