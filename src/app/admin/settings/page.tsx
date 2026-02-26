import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { AdminSettingsClient } from "@/components/admin/AdminSettingsClient";

export default async function AdminSettingsPage() {
    const user = await getServerUser();

    if (!user) redirect("/login");
    if (user.role !== "admin") redirect("/login");

    return <AdminSettingsClient user={user} />;
}
