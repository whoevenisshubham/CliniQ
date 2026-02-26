import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { AdminAnalyticsClient } from "@/components/admin/AdminAnalyticsClient";

export default async function AdminAnalyticsPage() {
    const user = await getServerUser();

    if (!user) redirect("/login");
    if (user.role !== "admin") redirect("/login");

    return <AdminAnalyticsClient user={user} />;
}
