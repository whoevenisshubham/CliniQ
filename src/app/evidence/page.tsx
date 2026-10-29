import {WorkspaceFrame} from '@/components/shared/WorkspaceFrame';
import { redirect } from 'next/navigation';
import { requirePrincipal } from '@/lib/server/auth/context';
import { EvidenceWorkspace } from '@/components/evidence/EvidenceWorkspace';
export const dynamic = 'force-dynamic';
export default async function Page({ searchParams }: {
    searchParams: Promise<{
        thread?: string;
        consultation?: string;
        document?: string;
    }>;
}) { const p = await requirePrincipal().catch(() => null); if (!p || !['doctor', 'patient'].includes(p.role))
    redirect('/login'); const q = await searchParams; return <WorkspaceFrame principal={p}><EvidenceWorkspace key={[p.id,q.thread??'none',q.consultation??'none',q.document??'none'].join(':')} actorId={p.id} provider={p.role === 'doctor'} initialThread={q.thread ?? null} consultationId={q.consultation ?? null} initialDocumentId={q.document ?? null}/></WorkspaceFrame>; }
