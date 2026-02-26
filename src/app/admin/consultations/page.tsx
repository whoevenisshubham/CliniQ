import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { AdminConsultationsClient } from "@/components/admin/AdminConsultationsClient";

export default async function AdminConsultationsPage() {
    const user = await getServerUser();

    if (!user) redirect("/login");
    if (user.role !== "admin") redirect("/login");

    return <AdminConsultationsClient user={user} />;
}
