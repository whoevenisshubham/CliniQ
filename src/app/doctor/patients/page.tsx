import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { PatientsClient } from "@/components/doctor/PatientsClient";

export default async function PatientsPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!["doctor", "nurse"].includes(user.role)) redirect("/login");
  return <PatientsClient user={user} />;
}
