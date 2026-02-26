import { ActiveConsultationClient } from "@/components/doctor/ActiveConsultationClient";

export default function ActiveConsultationPage() {
  return (
    <div className="h-full">
      <ActiveConsultationClient consultationId="new" patientName="Priya Sharma" />
    </div>
  );
}
