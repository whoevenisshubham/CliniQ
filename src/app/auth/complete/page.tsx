import {redirect} from 'next/navigation';
import {getRoleDashboardPath,getServerUser} from '@/lib/auth';
import {completedSessionPath} from '@/lib/server/auth/callback';
import {AuthComplete} from '@/components/shared/AuthComplete';
export const dynamic='force-dynamic';
export default async function CompletePage({searchParams}:{searchParams:Promise<{next?:string|string[]}>}){
 const principal=await getServerUser();if(!principal)redirect('/login');
 const next=(await searchParams).next;
 return <AuthComplete target={completedSessionPath(getRoleDashboardPath(principal.role),typeof next==='string'?next:null)}/>;
}
