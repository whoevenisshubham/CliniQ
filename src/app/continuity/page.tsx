import {redirect} from 'next/navigation';
import {requirePrincipal} from '@/lib/server/auth/context';
import {ContinuityWorkspace} from '@/components/continuity/ContinuityWorkspace';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{encounter?:string}>}){const p=await requirePrincipal().catch(()=>null);if(!p||!['patient','doctor'].includes(p.role))redirect('/login');const encounter=(await searchParams).encounter??null;return <ContinuityWorkspace key={p.id+':'+(encounter??'owner')} provider={p.role==='doctor'} encounterId={encounter}/>;}
