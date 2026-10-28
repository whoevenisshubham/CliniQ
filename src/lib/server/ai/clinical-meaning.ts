import {createHash} from 'node:crypto';
import type {Evidence} from '@/lib/contracts/ai';
import {emptySnapshot,type Medication} from '@/lib/contracts/clinical';
import {emptyContext,validateContext,sameAssertionSubject,type ClinicalAssertion} from '@/lib/clinical/context';
import {validateClinicalSnapshot} from '@/lib/clinical/schema';
import type {ClinicalProposal} from '@/lib/clinical/proposals';

// Finite, explicit equivalences; unsupported paraphrases remain unaccepted.
// No patient, medicine-name or expected-value special cases are used here.
export {normalizeClinicalWording} from '@/lib/clinical/wording';
import {normalizeClinicalWording} from '@/lib/clinical/wording';
const negative=/\b(?:no|not|denies|denied|without|nahi|nahin)\b|नहीं|नही/iu;
const uncertain=/\b(?:maybe|perhaps|unclear|unintelligible|possibly|might|unsure)\b|शायद|अस्पष्ट|पता नहीं/iu;
const correction=/\b(?:actually|correction|sorry|i meant|rather|not .+ but)\b|सुधार|मेरा मतलब|माफ|नहीं बल्कि/iu;
const tokens=(s:string):string[]=>normalizeClinicalWording(s).match(/\d+(?:\.\d+)?|[\p{L}_]+|%/gu)??[];
const stop=new Set('a an the is are was were has have of for and or with reported reports patient says days day today mild हल्का और है हैं को की का से में यह इन्हें पिछले दिनों पर'.split(' '));
function supports(claim:string,quote:string){const q=new Set(tokens(quote));return tokens(claim).filter(t=>!stop.has(t)).every(t=>q.has(t));}
function units(s:string){return s.split(/(?<=[.!?।])\s+|\r?\n+/u).map(x=>x.trim()).filter(Boolean);}
function fullQuote(q:string,s:string){return units(s).some((_,start,all)=>all.slice(start).some((__,n)=>normalizeClinicalWording(all.slice(start,start+n+1).join(' '))===normalizeClinicalWording(q)));}
function sourceClauses(claim:string,quote:string){
 const concept=tokens(claim).filter(t=>!stop.has(t)&&!negative.test(t));
 const clauses=units(quote).flatMap(s=>s.split(/(?:\bbut\b|\bhowever\b|लेकिन|परंतु|(?:है|हैं)\s*[,;]|[,;]\s*(?=no\b|not\b|denies\b|without\b))/iu));
 const numeric=concept.filter(t=>/^\d/.test(t)),anchors=numeric.length?numeric:concept;
 return clauses.filter(c=>anchors.some(t=>tokens(c).includes(t)));
}
export function sourcePolarity(claim:string,quote:string):'present'|'absent'|'uncertain'{
 const selected=sourceClauses(claim,quote);
 if(!selected.length||selected.some(c=>uncertain.test(c)))return 'uncertain';
 const signs=new Set(selected.map(c=>negative.test(c)?'absent':'present'));
 return signs.size===1?[...signs][0]as'present'|'absent':'uncertain';
}
type Fact={k:'complaint'|'symptom'|'medicine'|'prescription'|'assessment'|'measurement'|'history'|'allergy'|'prescribing'|'uncertain';t:string;p:'present'|'absent'|'uncertain';s:number[];q:string;c:number[];m:null|{n:string;d:string|null;f:string|null;du:string|null;r:string|null;i:string|null};v:null|{n:string;x:number;u:string}};
const stable=(s:string)=>{const h=createHash('sha256').update(s).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
export function normalizeClinicalFacts(raw:unknown,input:{sources:Evidence[];baseRevision:number;throughSegmentId:string;draft?:unknown;newSourceIds?:string[]}){
 const value=raw as{facts:Fact[]};if(!value||Object.keys(value).join()!=='facts'||!Array.isArray(value.facts)||value.facts.length>16)throw Error('OUTPUT_SCHEMA');
 const context=emptyContext(),operations:ClinicalProposal['operations']=[],snapshot=structuredClone(input.draft??emptySnapshot());validateClinicalSnapshot(snapshot);
 const facts=value.facts.map(f=>{
  if(!f||Object.keys(f).sort().join()!=='c,k,m,p,q,s,t,v'||!['complaint','symptom','medicine','prescription','assessment','measurement','history','allergy','prescribing','uncertain'].includes(f.k)||!['present','absent','uncertain'].includes(f.p)||typeof f.t!=='string'||!f.t.trim()||f.t.length>500||typeof f.q!=='string'||f.q.length>486||!Array.isArray(f.s)||!f.s.length||f.s.length>4||!Array.isArray(f.c)||f.c.length>4)throw Error('OUTPUT_SCHEMA');
  const pick=(i:number)=>{if(!Number.isSafeInteger(i)||i<0||i>=input.sources.length)throw Error('INVALID_CITATION');return input.sources[i];};
  const sources=f.s.map(pick);if(input.newSourceIds&&!sources.some(s=>input.newSourceIds!.includes(s.segmentId!)))throw Error('UNCHANGED_SOURCE_REPEATED');const prior=[...new Map([...f.c.map(pick),...sources.flatMap(s=>s.correctsSegmentId?input.sources.filter(p=>p.segmentId===s.correctsSegmentId):[])].map(s=>[s.segmentId,s])).values()],quote=sources.map(s=>s.text).join(' ');
  if(!sources.every(s=>s.sourceType==='transcript'&&s.segmentId)||!fullQuote(f.q,quote))throw Error('SOURCE_QUOTE_FIDELITY');
  if(!supports(f.t,f.q))throw Error('UNSUPPORTED_PARAPHRASE');
  const polarity=sourcePolarity(f.t,f.q);
  if(f.p!=='uncertain'&&polarity!==f.p)throw Error('POLARITY_CONFLICT');
  const scope=sourceClauses(f.t,f.q).join(' ');
  if(/\bfamily\b|पारिवारिक/iu.test(scope)&&!/\bfamily\b|पारिवारिक/iu.test(f.t))throw Error('QUALIFIER_FIDELITY');
  if(f.k==='symptom'&&/\b(?:history|previously|formerly|resolved|stopped|discontinued)\b|इतिहास|पहले/iu.test(scope))throw Error('HISTORY_CONTEXT_REQUIRED');
  if(prior.length&&(!correction.test(f.q)&&!sources.some(s=>prior.some(p=>s.correctsSegmentId===p.segmentId))||prior.some(s=>!s.segmentId||sources.some(n=>(n.sequence??0)<(s.sequence??0)))))throw Error('CORRECTION_CONTEXT_REQUIRED');
  return{f,sources,prior};
 });
 const noNew=facts.some(({f})=>f.k==='prescribing'&&f.p==='absent');
 for(const{f,sources,prior}of facts){
  const ids=sources.map(s=>s.segmentId!),corrects=prior.map(s=>s.segmentId!),id=stable(f.k+ids.join()+f.t);
  const op=(path:ClinicalProposal['operations'][number]['path'],v:unknown)=>operations.push({op:prior.length?'update_fact':'set_fact',path,value:v,evidence_segment_ids:[...new Set([...ids,...corrects])],note:'Source quote: '+f.q});
  let medication:Medication|null=null;
  if(f.k==='medicine'||f.k==='prescription'){
   if(!f.m||typeof f.m.n!=='string'||!f.m.n.trim())throw Error('MEDICATION_SCHEMA');
   if(prior.length&&!supports(f.m.n,f.q))throw Error('AMBIGUOUS_MEDICATION_CORRECTION');
   for(const[key,x]of Object.entries(f.m))if(x!==null&&(typeof x!=='string'||!supports(x,key==='d'?f.q:f.q+' '+prior.map(s=>s.text).join(' '))||key==='d'&&sourcePolarity(x,f.q)!=='present'))throw Error('MEDICATION_FIDELITY');
   medication={id,name:f.m.n,dose:f.m.d,frequency:f.m.f,duration:f.m.du,route:f.m.r,instructions:f.m.i,unknownFields:(['dose','frequency','duration','route']as const).filter(k=>({dose:f.m!.d,frequency:f.m!.f,duration:f.m!.du,route:f.m!.r})[k]===null)};
   validateClinicalSnapshot({...emptySnapshot(),medications:[medication]});
   if(f.k==='prescription'){
    if(noNew||f.p!=='present'||!sources.every(s=>s.speaker==='clinician')||!/\b(?:prescribe|prescribed|start|take|begin)\b|दवा शुरू|लेने के लिए|लिख रहा/iu.test(f.q)||/\b(?:current medication|currently taking|existing|already taking)\b|पहले से/iu.test(f.q))throw Error('NEW_PRESCRIPTION_CONTEXT_REQUIRED');
    op('medications',[medication]);continue;
   }
  }
  if(f.k==='complaint'&&f.p==='present'){op('chief_complaint',f.t);continue;}
  if(f.k==='assessment'){if(!sources.every(s=>s.speaker==='clinician')||!/^(?:assessment|diagnosis|impression|निदान)\s*:/iu.test(f.q))throw Error('ASSESSMENT_NOT_CLINICIAN_STATED');op('diagnosis',[f.t]);continue;}
  if(f.k==='measurement'&&f.p==='present'&&f.v){
   if(!supports(String(f.v.x),f.q)||!supports(f.v.u,f.q))throw Error('NUMERIC_FIDELITY');const vital={name:f.v.n,value:f.v.x,unit:f.v.u,observedAt:null};validateClinicalSnapshot({...emptySnapshot(),vitals:[vital]});op('vitals',[vital]);
  }
  const assertion:ClinicalAssertion={id,kind:f.k==='complaint'||f.k==='uncertain'?'uncertain':f.k,text:f.t,polarity:f.p,source_ids:ids,quote:f.q,corrects_source_ids:corrects,medication};
  (f.k==='symptom'?context.symptoms:f.k==='medicine'?context.medication_history:context.statements).push(assertion);
 }
 // Snapshot's positive symptom list is derived only from explicit present facts;
 // denied/uncertain/history statements remain distinct in reviewed context.
 const present=context.symptoms.filter(f=>f.polarity==='present'),corrected=context.symptoms.filter(f=>f.corrects_source_ids.length);
 if(present.length||corrected.length){const preserved=snapshot.symptoms.filter(t=>!corrected.some(a=>sameAssertionSubject({kind:'symptom',text:t,medication:null},a)&&input.sources.some(s=>a.corrects_source_ids.includes(s.segmentId!)&&supports(t,s.text))));operations.push({op:'set_fact',path:'symptoms',value:[...new Set([...preserved,...present.map(f=>f.text)])],evidence_segment_ids:[...new Set(context.symptoms.flatMap(f=>[...f.source_ids,...f.corrects_source_ids]))],note:'Explicit source assertions; earlier correction history retained'});}
 const prescriptions=operations.filter(o=>o.path==='medications');if(prescriptions.length){
  const merged=new Map(snapshot.medications.map(m=>[normalizeClinicalWording(m.name),m]));
  // MediFlow partial-slot merge adapted to the strict wire contract: null
  // means unstated in this delta, not an instruction to erase a reviewed field.
  // Explicit replacement values still win; retraction/uncertainty stays review-only.
  for(const op of prescriptions)for(const m of op.value as Medication[]){
   const key=normalizeClinicalWording(m.name),old=merged.get(key),next={...m,id:old?.id??m.id};
   for(const field of ['dose','frequency','duration','route','instructions']as const)if(next[field]===null&&old)next[field]=old[field];
   next.unknownFields=(['dose','frequency','duration','route']as const).filter(field=>next[field]===null);
   validateClinicalSnapshot({...emptySnapshot(),medications:[next]});merged.set(key,next);
  }
  for(let i=operations.length-1;i>=0;i--)if(operations[i].path==='medications')operations.splice(i,1);
  operations.push({op:'set_fact',path:'medications',value:[...merged.values()],evidence_segment_ids:[...new Set(prescriptions.flatMap(o=>o.evidence_segment_ids))],note:'Explicit new clinician prescriptions; unrelated reviewed prescriptions retained'});
 }
 const measurements=operations.filter(o=>o.path==='vitals');if(measurements.length){const merged=new Map(snapshot.vitals.map(v=>[v.name+'|'+v.unit,v]));for(const op of measurements)for(const v of op.value as typeof snapshot.vitals)merged.set(v.name+'|'+v.unit,v);for(let i=operations.length-1;i>=0;i--)if(operations[i].path==='vitals')operations.splice(i,1);operations.push({op:'set_fact',path:'vitals',value:[...merged.values()],evidence_segment_ids:[...new Set(measurements.flatMap(o=>o.evidence_segment_ids))],note:'Source-stated values and units; unrelated reviewed measurements retained'});}
 validateContext(context);return{operations,context};
}
