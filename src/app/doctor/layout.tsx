import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { DashboardShell } from "@/components/shared/DashboardShell";

export default async function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
