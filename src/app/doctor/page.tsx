import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { DoctorDashboardClient } from "@/components/doctor/DoctorDashboardClient";

export default async function DoctorDashboardPage() {
  const user = await getServerUser();

  if (!user) redirect("/login");
  if (!["doctor", "nurse"].includes(user.role)) redirect("/login");

  return <DoctorDashboardClient user={user} />;
}
