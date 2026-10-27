// Provider-side format constraints supplement, never replace, source/clinical
// validation. The original Llama adapter retains its JSON-object wire contract.
const text={type:'string'},nullable={type:['string','null']};
const object=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const indices={type:'array',items:{type:'integer'}};
const schema=object({facts:{type:'array',items:object({
 k:{type:'string',enum:['complaint','symptom','medicine','prescription','assessment','measurement','history','allergy','prescribing','uncertain']},t:text,
 p:{type:'string',enum:['present','absent','uncertain']},s:indices,q:text,c:indices,
 m:{anyOf:[{type:'null'},object({n:text,d:nullable,f:nullable,du:nullable,r:nullable,i:nullable})]},
 v:{anyOf:[{type:'null'},object({n:text,x:{type:'number'},u:text})]}
})}});
export function providerResponseFormat(kind:string|undefined,model:string){
 return kind==='extract_emr'&&model==='openai/gpt-oss-20b'?{type:'json_schema' as const,json_schema:{name:'clinical_assertions',strict:true,schema}}:{type:'json_object' as const};
}
export function providerInputBound(messages:unknown,kind:string|undefined,model:string){return Buffer.byteLength(JSON.stringify({messages,response_format:providerResponseFormat(kind,model)}),'utf8')+256;}
