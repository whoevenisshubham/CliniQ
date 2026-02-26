import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { SafetyAlertsClient } from "@/components/doctor/SafetyAlertsClient";

export default async function SafetyAlertsPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!["doctor", "nurse"].includes(user.role)) redirect("/login");
  return <SafetyAlertsClient user={user} />;
}
