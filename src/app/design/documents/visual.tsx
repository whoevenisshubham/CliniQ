"use client";
import {useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {Suspense} from 'react';
import {RecordLayout,DocumentList,SourceDetail,type DocumentRow} from '@/components/documents/DocumentSurface';
const rows:DocumentRow[]=[{id:'visual-one',title:'Visit notes · annual review',status:'ready',revision:1,current_version_id:'visual-version',created_at:'2026-10-21T12:00:00Z'},{id:'visual-two',title:'Discharge instructions',status:'ready',revision:1,current_version_id:'visual-version',created_at:'2026-10-18T12:00:00Z'},{id:'visual-three',title:'Scanned referral letter',status:'ready',revision:1,current_version_id:'visual-version',created_at:'2026-10-12T12:00:00Z'}];
function Surface(){const q=useSearchParams();const provider=q.get('view')==='provider';const [selected,setSelected]=useState(q.get('view')==='detail');return <RecordLayout fixture provider={provider}>{selected?<SourceDetail title={rows[0].title} version={1} status="text_ready" onBack={()=>setSelected(false)} chunks={[{id:'visual-source',page:1,ordinal:0,offset_start:0,offset_end:253,text:'Synthetic source for layout review\n\nVisit notes · annual review\n\nThis is an illustrative document passage, not a patient record or medical advice.\n\nBring the original record to your next appointment. Discuss any questions with your clinician.'}]}/>:<DocumentList rows={q.get('state')==='empty'?[]:rows} provider={provider} onSelect={()=>setSelected(true)}/>}</RecordLayout>}
export function VisualDocuments(){return <Suspense fallback={<p>Loading visual fixture…</p>}><Surface/></Suspense>}
