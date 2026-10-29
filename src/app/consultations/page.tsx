import { redirect } from "next/navigation";
import { requirePrincipal } from "@/lib/server/auth/context";
import { ConsultationReview } from "@/components/consultation/ConsultationReview";
import {WorkspaceFrame} from '@/components/shared/WorkspaceFrame';
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: {
    searchParams: Promise<{
        id?: string;
        patient?:string;
        view?:string;
        version?:string;
    }>;
}) {
    const p = await requirePrincipal().catch(() => null);
    if (!p || !["doctor", "patient"].includes(p.role))
        redirect("/login");
    const {id,patient,view,version} = await searchParams;
    return <WorkspaceFrame principal={p}><ConsultationReview key={`${p.id}:${id ?? 'list'}:${patient??''}:${view??''}:${version??''}`} actorId={p.id} provider={p.role === "doctor"} initialVersion={version} historyOnly={view==='history'} initialPatient={patient} initialId={id && id !== "new" ? id : null}/></WorkspaceFrame>;
}
