import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { ActiveConsultationClient } from "@/components/doctor/ActiveConsultationClient";

export default async function ActiveConsultationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!["doctor", "nurse"].includes(user.role)) redirect("/login");

  const params = await searchParams;
  const patientId = params.patientId ?? "";
  const patientName = params.patientName ?? "Priya Sharma";
  const consultationId = params.id ?? "new";

  return (
    <div className="h-full">
      <ActiveConsultationClient
        consultationId={consultationId}
        patientName={patientName}
      />
    </div>
  );
}
