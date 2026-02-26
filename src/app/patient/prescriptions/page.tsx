import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { PatientPrescriptionsClient } from "@/components/patient/PatientPrescriptionsClient";

export default async function PatientPrescriptionsPage() {
    const user = await getServerUser();

    if (!user) redirect("/login");
    if (user.role !== "patient") redirect("/login");

    return <PatientPrescriptionsClient user={user} />;
}
