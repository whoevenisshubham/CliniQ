import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { PatientDashboardClient } from "@/components/patient/PatientDashboardClient";

export default async function PatientDashboardPage() {
  const user = await getServerUser();

  if (!user) redirect("/login");
  if (user.role !== "patient") redirect("/login");

  return <PatientDashboardClient user={user} />;
}
