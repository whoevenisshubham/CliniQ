import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { PatientChatClient } from "@/components/patient/PatientChatClient";

export default async function PatientChatPage() {
    const user = await getServerUser();

    if (!user) redirect("/login");
    if (user.role !== "patient") redirect("/login");

    return <PatientChatClient user={user} />;
}
