import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { PatientReportsClient } from "@/components/patient/PatientReportsClient";

export default async function PatientReportsPage() {
    const user = await getServerUser();

    if (!user) redirect("/login");
    if (user.role !== "patient") redirect("/login");

    return <PatientReportsClient user={user} />;
}
