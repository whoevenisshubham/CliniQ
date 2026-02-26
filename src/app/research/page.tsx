import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { ResearchDashboardClient } from "@/components/research/ResearchDashboardClient";

export default async function ResearchDashboardPage() {
  const user = await getServerUser();

  if (!user) redirect("/login");
  if (!["research", "admin"].includes(user.role)) redirect("/login");

  return <ResearchDashboardClient user={user} />;
}
