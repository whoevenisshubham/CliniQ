import {redirect} from 'next/navigation';
import {requirePrincipal} from '@/lib/server/auth/context';
import {RoleHome} from './RoleHome';
export async function RoleHomePage({role,view}:{role:'doctor'|'patient';view?:'overview'|'patients'|'safety'}){
 const p=await requirePrincipal().catch(()=>null);
 if(!p||p.role!==role)redirect('/login');
 return <RoleHome key={p.id} user={{id:p.id,name:p.name,email:p.email,role:p.role,avatar_url:p.avatar_url}} view={view}/>;
}
