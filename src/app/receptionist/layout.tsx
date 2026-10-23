import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { DashboardShell } from "@/components/shared/DashboardShell";

export const dynamic = "force-dynamic";

export default async function ReceptionistLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getServerUser();
    if (!user) redirect("/login");
    if (user.role !== "receptionist") redirect("/login");
    return <DashboardShell user={user}>{children}</DashboardShell>;
}
