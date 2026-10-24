import { redirect } from "next/navigation";
import {requirePrincipal} from '@/lib/server/auth/context';
import {AccountWorkspace} from '@/components/patient/AccountWorkspace';
export const dynamic='force-dynamic';

export default async function PatientAccountPage() {
    const user = await requirePrincipal().catch(()=>null);

    if (!user) redirect("/login");
    if (user.role !== "patient") redirect("/login");

    return <AccountWorkspace key={user.id} />;
}
