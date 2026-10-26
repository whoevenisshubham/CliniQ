// Runs ONLY inside prepare-isolated's already guarded, fresh synthetic fixture.
// Never a hosted executor and never a reset/downgrade of an existing stack.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {root,sql,localConfiguration} from './local-supabase.mjs';
import {loadMigrationPlan,transactionBody} from './migration-plan.mjs';
import {uploadDocument,changeDocument,documentDetail} from '../src/lib/server/documents/service';
import {readPrivateContent} from '../src/lib/server/documents/content';
import {runNextJob} from '../src/lib/server/jobs/unified-runner';
import {accountView} from '../src/lib/server/account/service';
import {mutateClinical,clinicalList} from '../src/lib/server/clinical/service';
import {speechAvailability} from '../src/lib/server/speech/service';
import {ocrReady} from '../src/lib/server/ocr/service';
import {emptySnapshot} from '../src/lib/contracts/clinical';
async function main(){
if(process.argv[2]!=='--local-synthetic')throw Error('Explicit isolated rehearsal required');
const cfg=localConfiguration();
const options={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,options);
const nativeFetch=globalThis.fetch;let externalCalls=0;
globalThis.fetch=((input:RequestInfo|URL,init?:RequestInit)=>{const u=new URL(input instanceof Request?input.url:String(input));if(!['127.0.0.1','localhost'].includes(u.hostname)){externalCalls++;throw Error('EXTERNAL_CALL_FORBIDDEN');}return nativeFetch(input,init);}) as typeof fetch;
const patient=createClient(cfg.API_URL,cfg.ANON_KEY,options),doctor=createClient(cfg.API_URL,cfg.ANON_KEY,options);
async function ready(){for(let n=0;n<30;n++){if(!(await admin.from('documents').select('id').limit(1)).error)return;await new Promise(r=>setTimeout(r,200));}throw Error('ISOLATED_SCHEMA_CACHE_UNAVAILABLE');}
try{
 assert.equal(sql("select to_regprocedure('public.optional_capabilities()') is null"),'t');
 await ready();
 // Separate bounded actors/workspace keep this preservation fixture from
 // changing the accepted baseline actors' expected historical visit inventory.
 const actors:Record<string,{id:string;email:string;password:string}>={};
 for(const role of ['patient','doctor']){const id=randomUUID(),email='upgrade.'+randomUUID()+'@synthetic.example.test',password=randomUUID()+randomUUID(),auth=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.equal(auth.error,null);assert.equal((await admin.from('users').insert({id,auth_user_id:auth.data.user!.id,email,name:'Synthetic upgrade '+role,role,is_active:true})).error,null);actors[role]={id,email,password};}
 const patientId=randomUUID(),workspaceId=randomUUID();assert.equal((await admin.from('patients').insert({id:patientId,user_id:actors.patient.id,name:'Synthetic upgrade patient'})).error,null);assert.equal((await admin.from('workspaces').insert({id:workspaceId,name:'Synthetic upgrade only',is_demo:true})).error,null);assert.equal((await admin.from('workspace_memberships').insert({workspace_id:workspaceId,user_id:actors.doctor.id,role:'doctor'})).error,null);assert.equal((await admin.from('care_relationships').insert({patient_id:patientId,provider_id:actors.doctor.id,workspace_id:workspaceId,scope:'clinical',granted_by:actors.patient.id})).error,null);
 assert.equal((await patient.auth.signInWithPassword(actors.patient)).error,null);assert.equal((await doctor.auth.signInWithPassword(actors.doctor)).error,null);
 process.env.OCR_ENABLED='false';process.env.SPEECH_ENABLED='false';process.env.AI_ENABLED='false';
 const uploaded=await uploadDocument(patient,admin,{key:randomUUID(),title:'Synthetic preserved upgrade source',fileName:'upgrade.txt',mime:'text/plain',bytes:new TextEncoder().encode('SYNTHETIC preserved private source 12.4 g/dL')});
 const job=await admin.from('document_jobs').select('id').eq('version_id',uploaded.version_id).eq('kind','ingest_document').single();assert.equal(job.error,null);
 assert.equal((await runNextJob(admin,job.data!.id)).status,'text_ready');
 const detail=await documentDetail(patient,uploaded.document_id);await changeDocument(patient,uploaded.document_id,{key:randomUUID(),revision:detail.document.revision,action:'share',providerId:actors.doctor.id,workspaceId:workspaceId});
 const shared=await admin.from('document_jobs').select('id').eq('version_id',uploaded.version_id).eq('kind','ingest_document').eq('status','queued').single();assert.equal(shared.error,null);assert.equal((await runNextJob(admin,shared.data!.id)).status,'text_ready');
 const c=await mutateClinical(doctor,randomUUID(),{action:'create',patientId:patientId,workspaceId:workspaceId}),cid=c.consultationId;
 const snapshot={...emptySnapshot(),chief_complaint:'Synthetic manually reviewed upgrade finding'};
 const saved=await mutateClinical(doctor,randomUUID(),{action:'save',consultationId:cid,expectedRevision:0,snapshot});
 await mutateClinical(doctor,randomUUID(),{action:'finalize',consultationId:cid,expectedRevision:saved.revision,reviewedDraftRevision:saved.revision,confirmed:true,acknowledgements:{}});
 assert.equal((await clinicalList(patient)).approved!.length,1);assert.ok(await accountView(patient));
 assert.equal((await speechAvailability(doctor,()=>{throw Error('DISABLED_MUST_NOT_READ_ALLOWANCES');},cid)).available,false);
 assert.equal(await ocrReady(patient),false);
 // Accidentally flipped flags must remain unavailable on the older schema.
 process.env.OCR_ENABLED='true';assert.equal(await ocrReady(patient),false);assert.equal((await documentDetail(patient,uploaded.document_id)).document.id,uploaded.document_id);
 process.env.SPEECH_ENABLED='true';process.env.SPEECH_PROVIDER_VERIFIED='true';process.env.DEEPGRAM_API_KEY='synthetic-not-a-real-key';process.env.LIVE_SPEECH_AUTHORIZATION_REF='synthetic-unconfigured';assert.equal((await speechAvailability(doctor,()=>{throw Error('OLD_SCHEMA_MUST_NOT_READ_NEW_COLUMNS');},cid)).available,false);
 process.env.OCR_ENABLED='false';process.env.SPEECH_ENABLED='false';
 const columns=JSON.parse(sql("select json_object_agg(table_name,cols) from (select table_name,string_agg(quote_ident(column_name),',' order by ordinal_position) cols from information_schema.columns where table_schema='public' group by table_name) x"));
 const snapshotRows=()=>Object.fromEntries(Object.entries(columns).map(([table,cols])=>[table,JSON.parse(sql(`select json_build_object('rows',count(*),'hash',md5(coalesce(string_agg(row_to_json(x)::text,'|' order by row_to_json(x)::text),''))) from (select ${cols} from public.${table}) x`))]));
 sql(readFileSync(root+'/scripts/optional-rollout-preflight.sql','utf8'));
 const preparedSnapshot=sql(readFileSync(root+'/scripts/optional-preservation-snapshot.sql','utf8'));
 const before=snapshotRows(),sourceFunction=sql("select 'private.ai_sources_current(public.document_jobs)'::regprocedure::oid"),policies=sql("select md5(string_agg(row_to_json(x)::text,'|' order by row_to_json(x)::text)) from (select * from pg_policies where schemaname='public') x");
 const plan=loadMigrationPlan(root),files=Object.keys(plan.manifest).filter(f=>/20261025000[12]_|202610260001_/.test(f));assert.equal(files.length,3);
 sql('BEGIN;\n'+files.map(f=>transactionBody(readFileSync(root+'/'+f,'utf8'))).join('\n')+'\nCOMMIT;');
 const after=snapshotRows();assert.deepEqual(after,before,'Optional upgrade changed existing row fields');assert.equal(sql("select 'private.ai_sources_current(public.document_jobs)'::regprocedure::oid"),sourceFunction);assert.equal(sql("select md5(string_agg(row_to_json(x)::text,'|' order by row_to_json(x)::text)) from (select * from pg_policies where schemaname='public') x"),policies);
 assert.equal(sql(readFileSync(root+'/scripts/optional-preservation-snapshot.sql','utf8')),preparedSnapshot,'Prepared read-only digest must preserve existing rows');sql(readFileSync(root+'/scripts/optional-rollout-postflight.sql','utf8'));
 assert.equal(sql('select count(*) from public.provider_allowances'),'0');assert.equal(sql('select count(*) from public.speech_allowances'),'0');
 let refreshed=false;for(let n=0;n<30;n++){const r=await admin.rpc('optional_capabilities');if(!r.error&&r.data?.ocr===1&&r.data?.speech===1){refreshed=true;break;}await new Promise(r=>setTimeout(r,200));}assert.ok(refreshed,'Optional schema cache must converge');
 await ready();assert.equal((await documentDetail(patient,uploaded.document_id)).document.id,uploaded.document_id);assert.equal((await documentDetail(doctor,uploaded.document_id)).document.id,uploaded.document_id);assert.equal((await clinicalList(patient)).approved!.length,1);assert.ok(await accountView(patient));
 const file=await readPrivateContent(doctor,()=>admin,uploaded.document_id);assert.equal(await file.text(),'SYNTHETIC preserved private source 12.4 g/dL');
 assert.equal((await runNextJob(admin,job.data!.id)).status,'idle');assert.equal(await ocrReady(patient),false);assert.equal(externalCalls,0);
 const report={sourceSha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),scope:'actual isolated older-schema Auth/database/Storage plus forward preservation; not hosted acceptance',olderSchemaBoundary:'through 202610240001; both optional migrations absent',before,after,preserved:true,sourceFunctionOIDPreserved:true,existingPoliciesPreserved:true,existingSharedPrivateBytes:'passed',existingApprovedRecord:'passed',oldSchemaAccidentalFlags:'unavailable; ordinary document still readable',disabledCapabilityNeedsNewSchema:false,newAllowanceRows:0,externalProviderCalls:externalCalls,migrations:files.map(file=>({file,...plan.manifest[file]}))};
 writeFileSync(root+'/tests/infra/.runtime/optional-upgrade.json',JSON.stringify(report,null,2));console.log(JSON.stringify({optionalUpgrade:'passed',tablesCompared:Object.keys(before).length,rowsPreserved:Object.values(before).reduce((n:number,x:unknown)=>n+(x as {rows:number}).rows,0),oldSchemaServices:'passed',externalProviderCalls:0,manifestHash:createHash('sha256').update(JSON.stringify(report.migrations)).digest('hex')}));
}finally{globalThis.fetch=nativeFetch;}

}
void main().catch(error=>{console.error(error);process.exitCode=1;});
