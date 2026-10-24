import { redirect } from "next/navigation";
import { requirePrincipal } from "@/lib/server/auth/context";
import { ConsultationReview } from "@/components/consultation/ConsultationReview";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: {
    searchParams: Promise<{
        id?: string;
    }>;
}) {
    const p = await requirePrincipal().catch(() => null);
    if (!p || !["doctor", "patient"].includes(p.role))
        redirect("/login");
    const id = (await searchParams).id;
    return <ConsultationReview key={`${p.id}:${id ?? 'list'}`} actorId={p.id} provider={p.role === "doctor"} initialId={id && id !== "new" ? id : null}/>;
}
