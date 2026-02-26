import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { EMRRecordsClient } from "@/components/doctor/EMRRecordsClient";

export default async function EMRRecordsPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!["doctor", "nurse"].includes(user.role)) redirect("/login");
  return <EMRRecordsClient user={user} />;
}
