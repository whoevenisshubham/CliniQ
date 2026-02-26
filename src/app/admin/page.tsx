import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

export default async function AdminDashboardPage() {
  const user = await getServerUser();

  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/login");

  return <AdminDashboardClient user={user} />;
}
