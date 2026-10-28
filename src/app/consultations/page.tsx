import { redirect } from "next/navigation";
import { requirePrincipal } from "@/lib/server/auth/context";
import { ConsultationReview } from "@/components/consultation/ConsultationReview";
import {WorkspaceFrame} from '@/components/shared/WorkspaceFrame';
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: {
    searchParams: Promise<{
        id?: string;
        patient?:string;
    }>;
}) {
    const p = await requirePrincipal().catch(() => null);
    if (!p || !["doctor", "patient"].includes(p.role))
        redirect("/login");
    const {id,patient} = await searchParams;
    return <WorkspaceFrame principal={p}><ConsultationReview key={`${p.id}:${id ?? 'list'}:${patient??''}`} actorId={p.id} provider={p.role === "doctor"} initialPatient={patient} initialId={id && id !== "new" ? id : null}/></WorkspaceFrame>;
}
