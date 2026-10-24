"use client";
import {useState} from 'react';
const fields=[['temperature','Temperature','°C'],['pulse','Pulse','bpm'],['systolic','Systolic','mmHg'],['diastolic','Diastolic','mmHg'],['weight','Weight','kg'],['spo2','Oxygen saturation','%']] as const;
export function QueueVitals({queueId,revision,workspace,measurements={},provenance,disabled,onSave}:{queueId:string;revision:number;workspace:string;measurements?:Record<string,{value:number;unit:string}>;provenance?:{observedAt:string;recordedAt:string;correctionReason?:string}|null;disabled:boolean;onSave:(command:unknown)=>void}){
 const [values,setValues]=useState<Record<string,string>>({}),[observed,setObserved]=useState(''),[reason,setReason]=useState('');
 return <details className="queue-vitals"><summary>{Object.keys(measurements).length?'Intake measurements · view or correct':'Record intake measurements'}</summary>
 {Object.keys(measurements).length>0&&<><dl>{Object.entries(measurements).map(([key,v])=><div key={key}><dt>{fields.find(f=>f[0]===key)?.[1]??key}</dt><dd>{v.value} {v.unit}</dd></div>)}</dl>{provenance&&<p className="muted">Reception intake · observed {new Date(provenance.observedAt).toLocaleString()} · recorded {new Date(provenance.recordedAt).toLocaleString()}{provenance.correctionReason&&' · correction: '+provenance.correctionReason}</p>}</>}
 <p className="muted">Intake observations require clinician review. Corrections retain the previous event.</p>
 <form onSubmit={e=>{e.preventDefault();const measurements=Object.fromEntries(fields.filter(([key])=>values[key]?.trim()).map(([key,,unit])=>[key,{value:Number(values[key]),unit}]));onSave({action:'vitals',workspaceId:workspace,queueId,expectedRevision:revision,measurements,observedAt:new Date(observed).toISOString(),...(reason?{correctionReason:reason}:{})});}}>
 <div className="intake-vital-grid">{fields.map(([key,label,unit])=><label className="field-label" key={key}>{label} ({unit})<input type="number" step="any" value={values[key]??''} disabled={disabled} onChange={e=>setValues({...values,[key]:e.target.value})}/></label>)}</div>
 <label className="field-label">Observed at (your browser’s local time)<input type="datetime-local" required value={observed} disabled={disabled} onChange={e=>setObserved(e.target.value)}/></label>
 {!!Object.keys(measurements).length&&<label className="field-label">Correction reason<input required minLength={10} maxLength={500} value={reason} disabled={disabled} onChange={e=>setReason(e.target.value)}/></label>}
 <button className="quiet-button" disabled={disabled||!observed||!Object.values(values).some(x=>x.trim())}>Save intake measurements</button>
 </form></details>;
}
