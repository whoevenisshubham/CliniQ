// Provider-side format constraints supplement, never replace, source/clinical
// validation. The original Llama adapter retains its JSON-object wire contract.
const text={type:'string'},nullable={type:['string','null']};
const object=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const medication=object({id:text,name:text,dose:nullable,frequency:nullable,duration:nullable,route:nullable,instructions:nullable,unknownFields:{type:'array',items:{type:'string',enum:['dose','frequency','duration','route']}}});
const vital=object({name:{type:'string',enum:['bp_systolic','bp_diastolic','heart_rate','respiratory_rate','temperature','spo2','weight','height','glucose','hba1c']},value:{type:['number','null']},unit:text,observedAt:nullable});
const schema=object({operations:{type:'array',items:object({
 op:{type:'string',enum:['set_fact','update_fact','retract_fact','mark_uncertain']},
 path:{type:'string',enum:['chief_complaint','physical_examination','symptoms','diagnosis','medications','lab_tests_ordered','vitals','clinical_summary']},
 value:{anyOf:[nullable,{type:'array',items:{anyOf:[text,medication,vital]}}]},
 evidence_segment_ids:{type:'array',items:text},note:{type:'string',description:'Source quote: followed by the shortest complete supporting source sentence(s). Never paraphrase or use ellipsis.'}
})}});
export function providerResponseFormat(kind:string|undefined,model:string){
 return kind==='extract_emr'&&model==='openai/gpt-oss-20b'?{type:'json_schema' as const,json_schema:{name:'review_emr_delta',strict:true,schema}}:{type:'json_object' as const};
}
export function providerInputBound(messages:unknown,kind:string|undefined,model:string){return Buffer.byteLength(JSON.stringify({messages,response_format:providerResponseFormat(kind,model)}),'utf8')+256;}
