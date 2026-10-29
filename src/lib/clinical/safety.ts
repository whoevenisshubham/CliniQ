import {checkSafetyConsistencies} from '@/lib/safety-guard';
import type {ClinicalSnapshot} from '@/lib/contracts/clinical';
import {sameAssertionSubject,type ClinicalContext} from './context';
export const SAFETY_PACK='reviewed-label-pairs-2026-10-29';
export const safetySources={warfarin:'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8ad881e0-ca41-42ad-9d7d-eb85b3a30af0',atorvastatin:'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=604a011e-6c64-4895-8f6e-d28f119c4c22'};
export type SafetyFinding={id:string;kind:'recorded_allergy'|'potential_interaction'|'incomplete';title:string;detail:string;source:string|null;medicines:string[]};
const normalize=(s:string)=>s.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function ingredient(name:string,drug:string){const text=normalize(name);return !/^(no|not|denies|discontinued)\b/.test(text)&&new RegExp('(^| )'+drug+'( |[0-9]|$)').test(text);}
/** Retains the original CliniQ pair detector, but only independently verified pairs can surface. */
export function evaluateSafety(snapshot:ClinicalSnapshot,context:ClinicalContext|null,allergies:string[]):SafetyFinding[]{
 context=context&&Array.isArray(context.symptoms)&&Array.isArray(context.medication_history)&&Array.isArray(context.statements)?context:null;
 const assertions=context?[...context.symptoms,...context.medication_history,...context.statements]:[];
 const history=(context?.medication_history??[]).filter(a=>a.polarity==='present'&&a.medication&&!assertions.some(b=>b.id!==a.id&&sameAssertionSubject(a,b)&&b.corrects_source_ids.some(id=>a.source_ids.includes(id))));
 const meds=[...snapshot.medications.map(m=>({...m,origin:'new prescription'})),...history.map(a=>({...a.medication!,id:a.id,origin:'current medication history'}))];
 const findings:SafetyFinding[]=[];
 for(const [i,allergy] of allergies.entries())for(const med of meds)if(normalize(allergy)&&ingredient(med.name,normalize(allergy)))findings.push({id:`allergy:${i}:${med.id}`,kind:'recorded_allergy',title:`Recorded allergy matches ${med.name}`,detail:`${med.origin}. Verify the recorded reaction and clinical context; this is an ingredient-name match, not a complete allergy assessment.`,source:null,medicines:[med.name]});
 const existing=checkSafetyConsistencies({prescribedMeds:meds.map(m=>m.name),patientAllergies:[],consultationId:'source-bound-review'});
 const rules=[{a:'warfarin',b:'aspirin',id:'ddi-warfarin-aspirin',title:'Potential increased bleeding risk',detail:'The warfarin label lists aspirin among medicines that can increase bleeding risk. A combination may be intentional; the treating clinician must review its indication and context.',source:safetySources.warfarin},{a:'atorvastatin',b:'clarithromycin',id:'ddi-atorvastatin-clarithromycin',title:'Potential atorvastatin interaction',detail:'The atorvastatin label identifies clarithromycin as an interaction requiring dose and clinical-context review. This screen does not determine an appropriate dose or change treatment.',source:safetySources.atorvastatin}];
 for(const r of rules)if(existing.some(a=>a.alert_type==='drug_interaction'&&a.drug_a===r.a&&a.drug_b===r.b)&&meds.some(m=>ingredient(m.name,r.a))&&meds.some(m=>ingredient(m.name,r.b)))findings.push({id:r.id,kind:'potential_interaction',title:r.title,detail:r.detail,source:r.source,medicines:meds.filter(m=>ingredient(m.name,r.a)||ingredient(m.name,r.b)).map(m=>`${m.name} (${m.origin})`)});
 if(!allergies.length)findings.push({id:'incomplete-allergies',kind:'incomplete',title:'Allergy information incomplete',detail:'No allergy is recorded. This does not establish that the patient has no allergies.',source:null,medicines:[]});
 for(const m of meds)if(m.unknownFields.length)findings.push({id:`incomplete:${m.id}`,kind:'incomplete',title:`Incomplete medicine information: ${m.name}`,detail:`Unknown ${m.unknownFields.join(', ')}. Review the original wording and source before a treatment decision.`,source:null,medicines:[m.name]});
 return findings.length<=200?findings:[...findings.slice(0,199),{id:'incomplete-coverage',kind:'incomplete',title:'Finding display limit reached',detail:'This saved context exceeds the 200-finding bound. Review the complete medicines and allergy history directly; this screen is incomplete.',source:null,medicines:[]}];
}
