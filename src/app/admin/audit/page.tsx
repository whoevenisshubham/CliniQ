import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { AdminAuditClient } from "@/components/admin/AdminAuditClient";

export default async function AdminAuditPage() {
    const user = await getServerUser();

    if (!user) redirect("/login");
    if (user.role !== "admin") redirect("/login");

    return <AdminAuditClient user={user} />;
}
