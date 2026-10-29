import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["patient"]);
  if (!user) redirect("/login");
  // Repaired patient pages own their RecordLayout; retained paths redirect there.
  return <>{children}</>;
}
