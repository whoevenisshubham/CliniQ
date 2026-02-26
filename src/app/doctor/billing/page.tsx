import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { BillingClient } from "@/components/doctor/BillingClient";

export default async function BillingPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!["doctor", "nurse"].includes(user.role)) redirect("/login");
  return <BillingClient user={user} />;
}
