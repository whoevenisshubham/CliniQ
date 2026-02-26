import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { PatientAppointmentsClient } from "@/components/patient/PatientAppointmentsClient";

export default async function PatientAppointmentsPage() {
    const user = await getServerUser();

    if (!user) redirect("/login");
    if (user.role !== "patient") redirect("/login");

    return <PatientAppointmentsClient user={user} />;
}
