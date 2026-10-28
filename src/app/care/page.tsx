import { redirect } from 'next/navigation';
import { requirePrincipal } from '@/lib/server/auth/context';
import { CareWorkspace } from '@/components/care/CareWorkspace';
import {getSupabaseServerClient} from '@/lib/supabase-server';
import {WorkspaceFrame} from '@/components/shared/WorkspaceFrame';
export const dynamic = 'force-dynamic';
export default async function Page() { const p = await requirePrincipal().catch(() => null); if (!p || !['patient', 'doctor', 'receptionist'].includes(p.role))
    redirect('/login');
    const rows=await(await getSupabaseServerClient()).from('workspaces').select('id,name').in('id',(p.memberships??[]).map(m=>m.workspace_id));
    const memberships=(p.memberships??[]).map(m=>({...m,name:rows.data?.find(w=>w.id===m.workspace_id)?.name??'Assigned clinic'}));
    return <WorkspaceFrame principal={p}><CareWorkspace key={p.id} role={p.role} memberships={memberships}/></WorkspaceFrame>; }
