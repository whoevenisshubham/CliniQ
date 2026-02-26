import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { AdminUsersClient } from "@/components/admin/AdminUsersClient";

export default async function AdminUsersPage() {
    const user = await getServerUser();

    if (!user) redirect("/login");
    if (user.role !== "admin") redirect("/login");

    return <AdminUsersClient user={user} />;
}
