import {it,expect} from 'vitest';
import {validateAnswer,validateExtraction} from '@/lib/server/ai/validation';
import {classifyProviderFailure} from '@/lib/server/ai/provider';
import {emptySnapshot} from '@/lib/contracts/clinical';
import type {Evidence} from '@/lib/contracts/ai';
const segment='00000000-0000-4000-8000-000000000071';
function source(text:string,speaker='clinician'):Evidence{return{evidenceId:'segment:'+segment,segmentId:segment,versionId:segment,sequence:0,sourceType:'transcript',text,speaker};}
function answer(text:string,s:Evidence,quote=s.text){return{schemaVersion:'1',answerKind:'grounded',answer:text,facts:[{text,evidenceIds:[s.evidenceId],quotedSupport:[{evidenceId:s.evidenceId,quote}]}],definitions:[],uncertainties:[],citedSourceIds:[s.evidenceId]};}
function extract(value:unknown,text:string,path='diagnosis',speaker='clinician'){return validateExtraction({operations:[{op:'set_fact',path,value,evidence_segment_ids:[segment]}]},{baseRevision:0,throughSegmentId:segment,sources:[source(text,speaker)],draft:emptySnapshot()});}
it('requires complete source context for negated, family, uncertain, historical and stopped assertions',()=>{
 for(const [claim,text] of [['diabetes','No history of diabetes.'],['diabetes','Family history of diabetes.'],['asthma','Rule out asthma.'],['asthma','Possible asthma.'],['fever','Fever resolved.'],['malaria','Previously treated malaria.'],['fever','Denies any recent episodes of fever.'],['metformin','Metformin was stopped.'],['बुखार','अभी बुखार बिल्कुल नहीं है।'],['diabetes','Patient reports family mein diabetes nahi hai.']]){
 const s=source(text);expect(()=>validateAnswer(answer(claim,s,claim),[s])).toThrow();
 expect(validateAnswer(answer(text,s),[s]).answer).toBe(text);
 }
});
it('diagnosis requires explicit clinician assessment and retains its full uncertainty/temporal context',()=>{
 for(const text of ['No history of diabetes.','Family history of diabetes.','Patient reports diabetes.','Assessment: rule out diabetes.','Assessment: possible diabetes.','Assessment: previously treated diabetes.'])expect(()=>extract(['diabetes'],text)).toThrow();
 expect(extract(['possible diabetes'],'Assessment: possible diabetes.')).toBeTruthy();
 expect(extract(['Diabetes'],'Assessment: Diabetes.')).toBeTruthy();
 expect(()=>extract(['Diabetes'],'Assessment: Diabetes.','diagnosis','patient')).toThrow('ASSESSMENT_NOT_CLINICIAN_STATED');
});
it('a stopped medicine cannot become an active medication proposal and numeric prefixes cannot change a value',()=>{
 const medicine={id:'00000000-0000-4000-8000-000000000072',name:'Metformin',dose:'25 mg',frequency:null,duration:null,route:null,instructions:null,unknownFields:['frequency','duration','route']};
 expect(()=>extract([medicine],'Metformin 25 mg was stopped.','medications')).toThrow('MEDICATION_CONTEXT_REVIEW_REQUIRED');
 expect(()=>extract('12.4','Weight 12.45 kg.','chief_complaint')).toThrow('NUMERIC_FIDELITY');
 expect(()=>validateAnswer(answer('12.4',source('Weight 12.45 kg.')),[source('Weight 12.45 kg.')])).toThrow('NUMERIC_FIDELITY');
});
it('preserves complete dated/decimal/unit/frequency/duration excerpts and rejects a different question-independent fragment',()=>{
 const text='2026-10-24: dose 1.25 mg twice daily for 10 days; glucose 6.2 mmol/L.';const s=source(text);
 expect(validateAnswer(answer(text,s),[s]).answer).toBe(text);
 expect(()=>validateAnswer(answer('dose 1.25 mg',s),[s])).toThrow('CONTEXT_FIDELITY');
 expect(()=>validateAnswer(answer(text.replace('mmol/L','mg/dL'),s),[s])).toThrow();
});
it('HTTP failures distinguish explicit refusal from ambiguous upstream outcomes without claiming zero consumption',()=>{
 expect(classifyProviderFailure(401)).toMatchObject({category:'PROVIDER_AUTHENTICATION',definite:true});
 expect(classifyProviderFailure(429)).toMatchObject({category:'RATE_LIMITED',definite:true});
 for(const status of [408,500,502,503,504,undefined])expect(classifyProviderFailure(status)).toMatchObject({category:'OUTCOME_UNKNOWN',definite:false});
});
it('rejects an exact but irrelevant excerpt for a specifically different measurement question',()=>{
 const s=source('Haemoglobin 12.4 g/dL.');
 expect(()=>validateAnswer(answer(s.text,s),[s],[],'What HbA1c value is written?')).toThrow('QUESTION_RELEVANCE');
 expect(validateAnswer(answer(s.text,s),[s],[],'What haemoglobin value does this report show?').answer).toBe(s.text);
});

it('extracts a supported whole sentence without unrelated paragraph negations contaminating every field',()=>{
 const text='Dizziness for three days. No fever. Current medication metformin 500 mg.';
 const p=validateExtraction({operations:[{op:'set_fact',path:'chief_complaint',value:'Dizziness for three days.',note:'Source quote: Dizziness for three days.',evidence_segment_ids:[segment]}]},{baseRevision:0,throughSegmentId:segment,sources:[source(text)],draft:emptySnapshot()});expect(p.operations).toHaveLength(1);
 for(const quote of ['fever','metformin 500 mg'])expect(()=>validateExtraction({operations:[{op:'set_fact',path:'chief_complaint',value:quote,note:'Source quote: '+quote,evidence_segment_ids:[segment]}]},{baseRevision:0,throughSegmentId:segment,sources:[source(text)],draft:emptySnapshot()})).toThrow('SOURCE_QUOTE_FIDELITY');
});
