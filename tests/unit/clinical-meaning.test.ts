import {it,expect} from 'vitest';
import retained from '../fixtures/clinical/retained-extraction-failures.json';
import {normalizeClinicalFacts,normalizeClinicalWording} from '@/lib/server/ai/clinical-meaning';
import {validateExtraction} from '@/lib/server/ai/validation';
import {emptySnapshot} from '@/lib/contracts/clinical';
import {proposalCandidate} from '@/lib/clinical/proposals';
import type {Evidence} from '@/lib/contracts/ai';
const sid='00000000-0000-4000-8000-000000000091',later='00000000-0000-4000-8000-000000000092';
const source=(text:string,id=sid,sequence=0,speaker='clinician'):Evidence=>({evidenceId:'segment:'+id,sourceType:'transcript',segmentId:id,versionId:id,sequence,text,speaker});
const input=(sources:Evidence[])=>({sources,baseRevision:1,throughSegmentId:sources.at(-1)!.segmentId!,draft:emptySnapshot()});
const fact=(k:string,t:string,q:string,p='present',extra={})=>({k,t,p,s:[0],q,c:[],m:null,v:null,...extra});
it('replays both exact retained failures without promoting their unsafe fields',()=>{
 const s=source(retained.source.text,retained.source.id,0,'unknown');
 for(const r of retained.responses){const raw=JSON.parse(r.raw_response);expect(()=>validateExtraction(raw,input([s]))).toThrow();expect(raw.operations.some((o:{path:string;value?:unknown})=>o.path==='medications')).toBe(true);expect(raw.operations.some((o:{path:string;value?:unknown})=>o.path==='symptoms'&&JSON.stringify(o.value).includes('Fever'))).toBe(true);}
});
it('keeps Hindi/English denied symptoms apart from a supported concise positive symptom',()=>{
 const q='पिछले तीन दिनों से हल्का चक्कर है, बुखार नहीं है.';
 const r=normalizeClinicalFacts({facts:[fact('symptom','Dizziness for 3 days',q),fact('symptom','Fever',q,'absent')]},input([source(q)]));
 expect(r.operations.find(x=>x.path==='symptoms')?.value).toEqual(['Dizziness for 3 days']);expect(r.context.symptoms.map(x=>x.polarity)).toEqual(['present','absent']);
 expect(()=>normalizeClinicalFacts({facts:[fact('symptom','Fever',q)]},input([source(q)]))).toThrow('POLARITY_CONFLICT');
 const english='No fever, cough or dyspnea.';expect(normalizeClinicalFacts({facts:[fact('symptom','cough',english,'absent')]},input([source(english)])).context.symptoms[0].polarity).toBe('absent');
});
it('retains existing medication and explicit no-new-prescription as history, never a prescription',()=>{
 const q='Current medication SourceMedicine five hundred mg twice daily.',no='No new medicine prescribed.';
 const m={n:'SourceMedicine',d:'500 mg',f:'twice daily',du:null,r:null,i:null};
 const facts=[fact('medicine','SourceMedicine 500 mg',q,'present',{m}),fact('prescribing',no,no,'absent')];
 const r=normalizeClinicalFacts({facts},input([source(q+' '+no)]));expect(r.operations.some(x=>x.path==='medications')).toBe(false);expect(r.context.medication_history[0].medication?.dose).toBe('500 mg');expect(r.context.statements[0].polarity).toBe('absent');
 expect(()=>normalizeClinicalFacts({facts:[{...facts[0],k:'prescription'},facts[1]]},input([source(q+' '+no)]))).toThrow('NEW_PRESCRIPTION_CONTEXT_REQUIRED');
});
it('a genuinely new clinician prescription stays separate and retains explicit unknowns',()=>{
 const q='Prescribe SourceMedicine 5 mg oral once daily.';
 const r=normalizeClinicalFacts({facts:[fact('prescription','SourceMedicine 5 mg',q,'present',{m:{n:'SourceMedicine',d:'5 mg',f:'once daily',du:null,r:'oral',i:null}})]},input([source(q)]));
 const prior={...emptySnapshot(),medications:[{id:'00000000-0000-4000-8000-000000000093',name:'ExistingReviewedRx',dose:null,frequency:null,duration:null,route:null,instructions:null,unknownFields:['dose','frequency','duration','route']}]};
 const retained=normalizeClinicalFacts({facts:[fact('prescription','SourceMedicine 5 mg',q,'present',{m:{n:'SourceMedicine',d:'5 mg',f:'once daily',du:null,r:'oral',i:null}})]},{...input([source(q)]),draft:prior});expect((retained.operations.find(o=>o.path==='medications')!.value as {name:string}[]).map(m=>m.name)).toEqual(['ExistingReviewedRx','SourceMedicine']);
 expect(r.operations[0].path).toBe('medications');expect(r.context.medication_history).toEqual([]);expect((r.operations[0].value as {unknownFields:string[]}[])[0].unknownFields).toEqual(['duration']);
 expect(()=>normalizeClinicalFacts({facts:[fact('prescription','SourceMedicine 5 mg',q,'present',{m:{n:'SourceMedicine',d:'5 mg',f:'once daily',du:null,r:'oral',i:null}})]},input([source(q,sid,0,'patient')]))).toThrow('NEW_PRESCRIPTION_CONTEXT_REQUIRED');
});
it('spoken dose correction retains earlier source and does not accept the explicitly rejected number',()=>{
 const old='Current medication SourceMedicine 5 mg once daily.',q='Actually the SourceMedicine dose is ten mg, not five mg.';
 const f=fact('medicine','dose 10 mg',q,'present',{s:[1],c:[0],m:{n:'SourceMedicine',d:'10 mg',f:'once daily',du:null,r:null,i:null}});
 const r=normalizeClinicalFacts({facts:[f]},input([source(old),source(q,later,1)]));expect(r.context.medication_history[0].corrects_source_ids).toEqual([sid]);expect(r.context.medication_history[0].medication?.dose).toBe('10 mg');
 expect(()=>normalizeClinicalFacts({facts:[fact('medicine','SourceMedicine 5 mg',old,'present',{m:{n:'SourceMedicine',d:'5 mg',f:'once daily',du:null,r:null,i:null}})]},{...input([source(old),source(q,later,1)]),newSourceIds:[later]})).toThrow('UNCHANGED_SOURCE_REPEATED');
 expect(()=>normalizeClinicalFacts({facts:[{...f,m:{n:'SourceMedicine',d:'5 mg',f:'once daily',du:null,r:null,i:null}}]},input([source(old),source(q,later,1)]))).toThrow('MEDICATION_FIDELITY');expect(normalizeClinicalWording('one hundred thirty-eight')).toBe('138');
 const ambiguous='Actually the dose is ten mg, not five mg.';expect(()=>normalizeClinicalFacts({facts:[{...f,q:ambiguous}]},input([source(old),source(ambiguous,later,1)]))).toThrow('AMBIGUOUS_MEDICATION_CORRECTION');
});
it('unclear raw STT is shown as uncertain rather than silently converted to another medical term',()=>{
 const q='The source says just pain.';
 expect(()=>normalizeClinicalFacts({facts:[fact('symptom','chest pain',q)]},input([source(q)]))).toThrow('UNSUPPORTED_PARAPHRASE');
 const r=normalizeClinicalFacts({facts:[fact('uncertain','just pain',q,'uncertain')]},input([source(q)]));expect(r.context.statements[0].quote).toBe(q);expect(r.operations).toEqual([]);
});
it('preserves the actual recorded BP and HbA1c without copying script measurements or inventing units',()=>{
 const s=source(retained.source.text,retained.source.id,0,'unknown');
 const r=normalizeClinicalFacts({facts:[fact('measurement','blood pressure 138/68','आज blood pressure 138 over 68 है.'),fact('measurement','HbA1c 7.2%','Latest HbA1c 7.2% है.','present',{v:{n:'hba1c',x:7.2,u:'%'}})]},input([s]));
 expect(r.context.statements[0].text).toContain('138/68');expect(r.operations.find(x=>x.path==='vitals')?.value).toEqual([{name:'hba1c',value:7.2,unit:'%',observedAt:null}]);
});
it('late proposal cannot overwrite a newer clinician-edited draft',()=>{
 const q='Dizziness for three days.',p=normalizeClinicalFacts({facts:[fact('complaint','Dizziness for 3 days',q)]},input([source(q)]));
 const edited={...emptySnapshot(),chief_complaint:'Clinician-reviewed wording'};
 const candidate=proposalCandidate(edited,2,{baseRevision:1,throughSegmentId:sid,operations:p.operations});expect(candidate.state).toBe('stale');expect(candidate.snapshot).toEqual(edited);
});

it('merges strict nullable prescription fragments without erasing dose, duration or stable ID',()=>{
 const q1='Prescribe ExampleMedicine 2.5 mg for two days.',q2='Take ExampleMedicine twice daily.';
 const first=fact('prescription','ExampleMedicine 2.5 mg',q1,'present',{m:{n:'ExampleMedicine',d:'2.5 mg',f:null,du:'two days',r:null,i:null}});
 const second=fact('prescription','ExampleMedicine twice daily',q2,'present',{m:{n:'ExampleMedicine',d:null,f:'twice daily',du:null,r:null,i:null}});
 const a=normalizeClinicalFacts({facts:[first]},input([source(q1)]));const prior=(a.operations.find(o=>o.path==='medications')!.value as ReturnType<typeof emptySnapshot>['medications'])[0];
 const b=normalizeClinicalFacts({facts:[second]},{...input([source(q2,later,1)]),draft:{...emptySnapshot(),medications:[prior]}});
 const row=(b.operations.find(o=>o.path==='medications')!.value as ReturnType<typeof emptySnapshot>['medications'])[0];
 expect(row).toMatchObject({id:prior.id,dose:'2.5 mg',frequency:'twice daily',duration:'two days',route:null,unknownFields:['route']});
 const together=normalizeClinicalFacts({facts:[first,{...second,s:[1]}]},input([source(q1),source(q2,later,1)]));expect(together.operations.find(o=>o.path==='medications')!.value).toEqual([row]);
 const q3='Actually, prescribe ExampleMedicine 5 mg.';
 const c=normalizeClinicalFacts({facts:[fact('prescription','ExampleMedicine 5 mg',q3,'present',{s:[1],c:[0],m:{n:'ExampleMedicine',d:'5 mg',f:null,du:null,r:null,i:null}})]},{...input([source(q1),source(q3,later,1)]),draft:{...emptySnapshot(),medications:[row]}});
 expect((c.operations.find(o=>o.path==='medications')!.value as typeof row[])[0]).toMatchObject({id:prior.id,dose:'5 mg',frequency:'twice daily',duration:'two days'});expect(prior.dose).toBe('2.5 mg');
});
