import type {Medication} from '@/lib/contracts/clinical';
import {emptySnapshot} from '@/lib/contracts/clinical';
import {validateClinicalSnapshot} from './schema';
import {normalizeClinicalWording} from './wording';
export type ClinicalAssertion={id:string;kind:'symptom'|'medicine'|'history'|'allergy'|'prescribing'|'uncertain'|'measurement';text:string;polarity:'present'|'absent'|'uncertain';source_ids:string[];quote:string;corrects_source_ids:string[];medication:Medication|null};
export type ClinicalContext={symptoms:ClinicalAssertion[];medication_history:ClinicalAssertion[];statements:ClinicalAssertion[]};
export const emptyContext=():ClinicalContext=>({symptoms:[],medication_history:[],statements:[]});
export function sameAssertionSubject(a:Pick<ClinicalAssertion,'kind'|'text'|'medication'>,b:Pick<ClinicalAssertion,'kind'|'text'|'medication'>){
 if(a.kind!==b.kind)return false;
 if(a.kind==='medicine')return !!a.medication&&!!b.medication&&normalizeClinicalWording(a.medication.name)===normalizeClinicalWording(b.medication.name);
 const ignore=new Set('no not denies denied reported present absent uncertain mild for since and or day days history the is are lasted है नहीं और में दिनों'.split(' '));
 const terms=(t:string)=>normalizeClinicalWording(t).match(/[\p{L}_]+/gu)?.filter(w=>!ignore.has(w))??[];
 const left=new Set(terms(a.text)),right=new Set(terms(b.text));return left.size>0&&left.size===right.size&&[...left].every(w=>right.has(w));
}
const uuid=/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function validateContext(value:unknown):asserts value is ClinicalContext{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('CONTEXT_SCHEMA');
 const c=value as Record<string,unknown>;if(Object.keys(c).sort().join()!=='medication_history,statements,symptoms'||JSON.stringify(c).length>24576)throw Error('CONTEXT_SCHEMA');
 for(const [field,rows]of Object.entries(c)){
  if(!Array.isArray(rows)||rows.length>30)throw Error('CONTEXT_SCHEMA');
  const ids=new Set<string>();
  for(const a of rows){
   if(!a||typeof a!=='object'||Object.keys(a).sort().join()!=='corrects_source_ids,id,kind,medication,polarity,quote,source_ids,text'||!uuid.test(a.id)||!['present','absent','uncertain'].includes(a.polarity)||!['symptom','medicine','history','allergy','prescribing','uncertain','measurement'].includes(a.kind)||typeof a.text!=='string'||!a.text.trim()||a.text.length>1000||typeof a.quote!=='string'||a.quote.length>1000)throw Error('CONTEXT_SCHEMA');
   for(const key of ['source_ids','corrects_source_ids'])if(!Array.isArray(a[key])||a[key].length>10||a[key].some((id:unknown)=>typeof id!=='string'||!uuid.test(id)))throw Error('CONTEXT_SCHEMA');
   if(!a.source_ids.length||field==='symptoms'&&a.kind!=='symptom'||field==='medication_history'&&a.kind!=='medicine'||field==='statements'&&['symptom','medicine'].includes(a.kind))throw Error('CONTEXT_SCHEMA');
   if(ids.has(a.id))throw Error('CONTEXT_SCHEMA');ids.add(a.id);
   if(a.medication!==null)validateClinicalSnapshot({...emptySnapshot(),medications:[a.medication]});
  }
 }
}
export function mergeContext(old:ClinicalContext|undefined,next:ClinicalContext){
 const result=emptyContext();for(const field of Object.keys(result)as(keyof ClinicalContext)[]){const rows=[...(old?.[field]??[])];for(const a of next[field])if(!rows.some(x=>x.id===a.id))rows.push(a);result[field]=rows;}validateContext(result);return result;
}
