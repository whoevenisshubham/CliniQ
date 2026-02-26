import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { ReceptionistDashboardClient } from "@/components/receptionist/ReceptionistDashboardClient";

export default async function ReceptionistPage() {
    const user = await getServerUser();
    if (!user) redirect("/login");
    if (user.role !== "receptionist") redirect("/login");
    return <ReceptionistDashboardClient user={user} />;
}
