import { redirect } from "next/navigation";
import { requirePrincipal } from "@/lib/server/auth/context";
import { ConsultationReview } from "@/components/consultation/ConsultationReview";
import {WorkspaceFrame} from '@/components/shared/WorkspaceFrame';
import {ApprovedRecord} from '@/components/consultation/ConsultationReview';
import {RecordLayout} from '@/components/documents/DocumentSurface';
import {getSupabaseServerClient} from '@/lib/supabase-server';
import {validateClinicalSnapshot} from '@/lib/clinical/schema';
import Link from 'next/link';
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
    if(version){
        const r=await(await getSupabaseServerClient()).from('emr_versions').select('*').eq('id',version).maybeSingle();
        let valid=false;try{if(r.data&&(!id||r.data.consultation_id===id)){validateClinicalSnapshot(r.data.snapshot);valid=true;}}catch{/* Corrupt or unavailable source is not substituted with another version. */}
        return <WorkspaceFrame principal={p}><RecordLayout provider={p.role==='doctor'} section="consultations"><Link className="text-link" href="/consultations">All reviewed records</Link>{valid?<><h1 className="text-2xl font-semibold">Selected reviewed record</h1><p className="my-3">Later amendments are separate records; this selection is not replaced by a newer draft.</p><ApprovedRecord record={r.data}/></>:<p role="alert">The selected reviewed record is unavailable.</p>}</RecordLayout></WorkspaceFrame>;
    }
    return <WorkspaceFrame principal={p}><ConsultationReview key={`${p.id}:${id ?? 'list'}:${patient??''}:${view??''}:${version??''}`} actorId={p.id} provider={p.role === "doctor"} initialVersion={version} historyOnly={view==='history'} initialPatient={patient} initialId={id && id !== "new" ? id : null}/></WorkspaceFrame>;
}
