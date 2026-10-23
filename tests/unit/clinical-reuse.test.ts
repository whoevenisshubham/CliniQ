import { expect,it } from "vitest";
import { normalizeMedicationEntry,normalizeMedicationsArray } from "@/lib/clinical/normalizeMedications";
import { buildClinicalSummary,buildPatientSummary } from "@/lib/clinical/summaries";

it("retains legacy medication aliases without inventing missing directions",()=>{
 expect(normalizeMedicationEntry({drug_name:'  Source medicine ',strength:'5 mg',freq:'source frequency',days:'source duration',ROA:'oral',sig:'source note'}))
 .toMatchObject({name:'Source medicine',dosage:'5 mg',frequency:'source frequency',duration:'source duration',route:'oral',instructions:'source note'});
 expect(normalizeMedicationEntry(' Source medicine ')).toMatchObject({name:'Source medicine',dosage:''});
});
it("rejects object coercion and caps pathological source collections",()=>{
 expect(normalizeMedicationsArray([{name:{injected:true},dose:{unsafe:true}},null,42])).toEqual([]);
 expect(normalizeMedicationsArray(Array.from({length:100},()=>({name:'Source medicine'})))).toHaveLength(50);
 expect(normalizeMedicationEntry({name:'Source medicine',dose:'x'.repeat(3000)}).dosage).toHaveLength(1000);
});
it("formats only source-provided facts without inference or external generation",()=>{
 const snapshot={chief_complaint:'source complaint',medications:[{name:'Source medicine',dosage:'5 mg'}],diagnosis_text:['source assessment']};
 expect(buildClinicalSummary(snapshot)).toBe('Chief complaint: source complaint. Assessment: source assessment. Medications: Source medicine, 5 mg.');
 expect(buildPatientSummary(snapshot)).toBe('You were seen for source complaint. Medications: Source medicine, 5 mg.');
 expect(buildClinicalSummary({})).toBeNull();expect(buildPatientSummary({})).toBeNull();
});
