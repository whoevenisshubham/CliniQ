import { redirect } from "next/navigation";
import {requirePrincipal} from '@/lib/server/auth/context';
import {AccountWorkspace} from '@/components/patient/AccountWorkspace';
import {WorkspaceFrame} from '@/components/shared/WorkspaceFrame';
export const dynamic='force-dynamic';

export default async function PatientAccountPage() {
    const user = await requirePrincipal().catch(()=>null);

    if (!user) redirect("/login");
    if (user.role !== "patient") redirect("/login");

    return <WorkspaceFrame principal={user}><AccountWorkspace key={user.id} /></WorkspaceFrame>;
}
