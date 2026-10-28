import {redirect} from 'next/navigation';
import {requirePrincipal} from '@/lib/server/auth/context';
import type {UserRole} from '@/lib/types';
import {DashboardShell} from './DashboardShell';
import {ThemeToggle} from './ThemeProvider';

export async function DeferredWorkspace({allowed,title,reason}:{allowed:UserRole[];title:string;reason:string}){
 const p=await requirePrincipal().catch(()=>null);
 if(!p||!allowed.includes(p.role))redirect('/login');

 const content=<div className="mx-auto max-w-5xl p-6 sm:p-10"><header className="mb-8 flex items-center justify-between gap-4"><h1 className="text-3xl font-semibold">{title}</h1><ThemeToggle/></header><p className="mb-3 font-medium">Workflow unavailable</p><p className="mb-4 text-[var(--foreground-muted)]">{reason}</p><p>This workflow has not completed its persistence, access and acceptance requirements. The historical implementation is retained for repair.</p><section className="mt-8 border-t border-[var(--border)] pt-5"><h2 className="mb-3 text-lg font-semibold">Your active workspace assignments</h2>{p.memberships?.length?<ul className="space-y-2">{p.memberships.map(m=><li key={`${m.workspace_id}:${m.role}`}>{m.role} · {m.workspace_id.slice(0,8)} · {m.status}</li>)}</ul>:<p>No active assignments.</p>}<p className="mt-3 text-sm text-[var(--foreground-subtle)]">These are your verified assignments, not an organization-wide user directory or permission editor.</p></section></div>;
 return ['admin','research'].includes(p.role)?content:<DashboardShell user={{id:p.id,name:p.name,email:p.email,role:p.role,avatar_url:p.avatar_url}}>{content}</DashboardShell>;
}
