import { redirect } from 'next/navigation';
import { requirePrincipal } from '@/lib/server/auth/context';
import { CareWorkspace } from '@/components/care/CareWorkspace';
export const dynamic = 'force-dynamic';
export default async function Page() { const p = await requirePrincipal().catch(() => null); if (!p || !['patient', 'doctor', 'receptionist'].includes(p.role))
    redirect('/login'); return <CareWorkspace key={p.id} role={p.role} memberships={p.memberships ?? []}/>; }
