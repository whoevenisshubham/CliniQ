import { getSupabaseServerClient } from "@/lib/supabase-server";
import { resolvePrincipal } from "@/lib/server/auth/context";
import { DocumentWorkspace } from "@/components/documents/DocumentWorkspace";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{document?:string}>}) {
  let role: string;
  try {
    role = (await resolvePrincipal(await getSupabaseServerClient())).role;
  } catch {
    redirect("/login");
  }
  if (!["doctor", "patient"].includes(role)) redirect("/login");
  return <DocumentWorkspace provider={role === "doctor"} initialDocumentId={(await searchParams).document??null} />;
}
