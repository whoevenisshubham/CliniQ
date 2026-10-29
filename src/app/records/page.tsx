import { getSupabaseServerClient } from "@/lib/supabase-server";
import { resolvePrincipal } from "@/lib/server/auth/context";
import { DocumentWorkspace } from "@/components/documents/DocumentWorkspace";
import { redirect } from "next/navigation";
import {WorkspaceFrame} from '@/components/shared/WorkspaceFrame';
import type {Principal} from '@/lib/server/auth/context';
export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{document?:string;version?:string}>}) {
  let role: string;
  let actorId:string;
  let principal:Principal;
  try {
    principal=await resolvePrincipal(await getSupabaseServerClient());
    role=principal.role;actorId=principal.id;
  } catch {
    redirect("/login");
  }
  if (!["doctor", "patient"].includes(role)) redirect("/login");
  const query=await searchParams,documentId=query.document??null,versionId=query.version??null;
  return <WorkspaceFrame principal={principal}><DocumentWorkspace key={actorId+':'+(documentId??'library')} provider={role === "doctor"} initialDocumentId={documentId} initialVersionId={versionId} /></WorkspaceFrame>;
}
