import {redirect} from 'next/navigation';
import {requirePrincipal} from '@/lib/server/auth/context';
import {getSupabaseServerClient} from '@/lib/supabase-server';
import {WorkspaceAdministration} from './WorkspaceAdministration';
export async function AdministrationPage({section}:{section:'overview'|'users'|'consultations'|'analytics'|'audit'|'settings'}){
 const p=await requirePrincipal().catch(()=>null);if(!p||p.role!=='admin')redirect('/login');
 const r=await(await getSupabaseServerClient()).from('workspaces').select('id,name').in('id',(p.memberships??[]).filter(m=>m.role==='admin').map(m=>m.workspace_id));
 if(r.error)return <p role="alert" className="p-6">Workspace configuration is unavailable.</p>;
 return <WorkspaceAdministration key={p.id} actorId={p.id} workspaces={r.data??[]} section={section}/>;
}
