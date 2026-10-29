"use client";

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {DashboardShell} from './DashboardShell';
import {ThemeToggle} from './ThemeProvider';
import {readJsonResponse} from '@/lib/client/http-response';
import {clinicalResponse} from '@/lib/client/workspace-response';
import type {UserRole} from '@/lib/types';

type User={id:string;name:string;email:string;role:UserRole;avatar_url?:string};
type Listing={role:string;patients?:{id:string;name:string;allergies?:string[]}[];visits?:{id:string;patient_id:string;status:string;revision:number;started_at:string}[];approved?:{id:string;consultation_id:string;reviewed_at:string;source_revision:number;snapshot?:{chief_complaint?:string|null};reviewer_name?:string|null;encounter_at?:string|null}[]};

/** Original DashboardShell/AppSidebar, with the scoped V2 clinical list as its data seam. */
export function RoleHome({user,view='overview'}:{user:User;view?:'overview'|'patients'|'safety'}){
 const [data,setData]=useState<Listing|null>(null),[error,setError]=useState(''),[query,setQuery]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  fetch('/api/clinical',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])})
   .then(r=>readJsonResponse(r,b=>clinicalResponse(b,'/api/clinical',false)))
   .then(b=>{if(!controller.signal.aborted){if(b.data.role!==user.role)throw Error('Account changed. Sign in again.');setData(b.data);}})
   .catch(()=>{if(!controller.signal.aborted){setData(null);setError('Records could not be loaded. Reopen this page after checking your session.');}});
  return()=>controller.abort();
 },[user.id,user.role]);
 const provider=user.role==='doctor';
 const patients=(data?.patients??[]).filter(p=>p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const content=<div className="mx-auto max-w-6xl p-5 sm:p-8">
  <header className="mb-5 flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs text-[var(--foreground-muted)]">{user.name}</p><h1 className="mt-1 text-2xl font-semibold">{view==='patients'?'Patients':view==='safety'?'Safety review':provider?'Clinic workspace':'Your health records'}</h1></div><ThemeToggle/></header>
  <nav aria-label="Quick actions" className="mb-6 flex flex-wrap gap-2">
   <Link className="role-home-primary rounded-lg px-3 py-2.5 text-sm font-medium" href={provider?'/consultations':'/records'}>{provider?'Open Ambient Scribe':'Add or read a document'}</Link>
   <Link className="rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm" href="/care">{provider?'Clinic queue':'Appointments'}</Link>
   <Link className="rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm" href={provider?'/records':'/continuity'}>{provider?'Shared documents':'Medicines & tasks'}</Link>
  </nav>
  {error?<p role="alert">{error} <Link href="/login" className="underline">Sign in</Link></p>:!data?<p role="status">Loading your authorized records…</p>:provider?<>
   <section aria-labelledby="patients-heading" className="mb-8"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4"><h2 id="patients-heading" className="text-xl font-semibold">{view==='safety'?'Allergy information':'Patient directory'}</h2><label className="text-sm">Search patients <input type="search" maxLength={100} value={query} onChange={e=>setQuery(e.target.value)} className="ml-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2"/></label></div>
   {view==='safety'&&<p className="my-3 text-sm text-[var(--foreground-muted)]">Recorded allergies only. No comprehensive drug-interaction or safety screening is claimed. Verify each encounter before approval.</p>}
   {!patients.length?<p className="py-5">No matching authorized patients.</p>:<ul className="divide-y divide-[var(--border)]">{patients.map(p=><li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="font-medium">{p.name}</h3>{view==='safety'&&<p className="mt-1 text-sm">{p.allergies?.length?p.allergies.join(', '):'No allergy recorded; verify with patient.'}</p>}</div><Link className="text-sm text-blue-700 dark:text-blue-300 underline" href={`/consultations?patient=${p.id}`}>Open encounters</Link></li>)}</ul>}
   <p className="mt-2 text-xs text-[var(--foreground-subtle)]">Up to 50 authorized patients. Care access does not grant document access.</p></section>
   <section><h2 className="border-b border-[var(--border)] pb-4 text-xl font-semibold">Recent encounters</h2>{!data.visits?.length?<p className="py-5">No encounters yet. Open Ambient Scribe to select an authorized patient.</p>:<ul className="divide-y divide-[var(--border)]">{data.visits.map(v=><li key={v.id} className="flex flex-wrap justify-between gap-3 py-4"><div><p>{data.patients?.find(p=>p.id===v.patient_id)?.name??'Authorized patient'}</p><p className="text-sm text-[var(--foreground-muted)]">{new Date(v.started_at).toLocaleDateString()} · {v.status}</p></div><Link href={`/consultations?id=${v.id}`} className="text-blue-700 dark:text-blue-300 underline">Open record</Link></li>)}</ul>}</section>
  </>:<section><h2 className="border-b border-[var(--border)] pb-4 text-xl font-semibold">Reviewed visits</h2>{!data.approved?.length?<p className="py-5">No approved visits are available yet. Draft clinical notes remain private to your clinician.</p>:<ul className="divide-y divide-[var(--border)]">{data.approved.map(v=><li key={v.id} className="flex flex-wrap justify-between gap-3 py-4"><div><h3 className="font-medium">{v.snapshot?.chief_complaint||"Reviewed consultation"}</h3><p className="mt-1 text-sm text-[var(--foreground-muted)]">{new Date(v.encounter_at??v.reviewed_at).toLocaleDateString()}{v.reviewer_name?" · "+v.reviewer_name:""} · reviewed</p><details className="mt-2 text-xs text-[var(--foreground-subtle)]"><summary>Record details</summary>Reviewed {new Date(v.reviewed_at).toLocaleString()} · source revision {v.source_revision}</details></div><Link className="text-blue-700 dark:text-blue-300 underline" href={`/consultations?id=${v.consultation_id}&version=${v.id}`}>Read approved visit</Link></li>)}</ul>}<Link href="/patient/account" className="mt-6 inline-block text-blue-700 dark:text-blue-300 underline">Profile, family history & measurements</Link></section>}
 </div>;
 return provider?content:<DashboardShell user={user}>{content}</DashboardShell>;
}
