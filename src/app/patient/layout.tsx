import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/shared/DashboardShell";

export const dynamic = "force-dynamic";

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["patient"]);
  if (!user) redirect("/login");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
