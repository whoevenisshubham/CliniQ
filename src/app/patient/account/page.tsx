import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { PatientAccountClient } from "@/components/patient/PatientAccountClient";

export default async function PatientAccountPage() {
    const user = await getServerUser();

    if (!user) redirect("/login");
    if (user.role !== "patient") redirect("/login");

    return <PatientAccountClient user={user} />;
}
