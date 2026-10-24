import {CareWorkspace} from '@/components/care/CareWorkspace';
const workspace='00000000-0000-4000-8000-000000000041';
const provider='00000000-0000-4000-8000-000000000042';
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}){
 const view=(await searchParams).view;const role=view==='reception'?'receptionist':view==='clinician'?'doctor':'patient';
 return <CareWorkspace role={role} memberships={role==='patient'?[]:[{workspace_id:workspace,role}]} fixture={{
 slots:[{id:'00000000-0000-4000-8000-000000000043',provider_name:'Dr. Synthetic Meera',starts_at:'2026-11-03T04:00:00Z',ends_at:'2026-11-03T04:30:00Z',time_zone:'Asia/Kolkata',synthetic:true}],
 appointments:[{id:'00000000-0000-4000-8000-000000000044',provider_name:'Dr. Synthetic Meera',starts_at:'2026-11-02T04:00:00Z',time_zone:'Asia/Kolkata',reason:'Synthetic follow-up intention confirmed against a sample slot',status:'confirmed',revision:1}],
 patients:[{id:'00000000-0000-4000-8000-000000000045',name:'Synthetic आशा — long-name layout sample',phone:null,unclaimed:true}],providers:[{id:provider,name:'Dr. Synthetic Meera'}],
 queue:[{id:'00000000-0000-4000-8000-000000000046',patient_name:'Synthetic आशा — long-name layout sample',doctor_name:'Dr. Synthetic Meera',queue_number:1,status:'waiting',revision:1,consultation_ref:null,vitals_recorded:{temperature:{value:37.2,unit:'°C'},weight:{value:68.25,unit:'kg'}},vital_provenance:{observedAt:'2026-10-24T03:30:00Z',recordedAt:'2026-10-24T03:31:00Z'}}]
 }}/>;
}
