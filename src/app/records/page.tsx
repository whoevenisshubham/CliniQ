import { getSupabaseServerClient } from "@/lib/supabase-server";
import { resolvePrincipal } from "@/lib/server/auth/context";
import { DocumentWorkspace } from "@/components/documents/DocumentWorkspace";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{document?:string}>}) {
  let role: string;
  let actorId:string;
  try {
    const principal=await resolvePrincipal(await getSupabaseServerClient());
    role=principal.role;actorId=principal.id;
  } catch {
    redirect("/login");
  }
  if (!["doctor", "patient"].includes(role)) redirect("/login");
  const documentId=(await searchParams).document??null;
  return <DocumentWorkspace key={actorId+':'+(documentId??'library')} provider={role === "doctor"} initialDocumentId={documentId} />;
}
