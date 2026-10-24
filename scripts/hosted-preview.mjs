// Explicit owner-approved new-project setup. Not a general migration/reset tool.
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdirSync,renameSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadMigrationPlan} from './migration-plan.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const sha256=value=>createHash('sha256').update(value).digest('hex');
// Historical project references are private; their digests are permanent denials.
const protectedProjects=new Set(['7c14714db81a3204acaac42f13f7dfbad49fa85184341dbe40ade552660cb2b6','c59410de120a6a94e9fc142c5fcc4cd3a93f4a4d3c66d6045d4e7071a1a6bf7b']);
const requireThat=(ok,code)=>{if(!ok)throw new Error(code);};
export function assertAllowedProjectDigest(digest){requireThat(!protectedProjects.has(digest),'HISTORICAL_PROJECT_FORBIDDEN');}
export function validateApproval(m,sourceSha,manifest){
 requireThat(m?.version===1&&m.projectName==='cliniqplus-v2-preview'&&m.region==='ap-south-1'&&m.plan==='Free'&&m.newEmptyProject===true,'APPROVAL_SCOPE_MISMATCH');
 requireThat(/^[a-z]{20}$/.test(m.projectRef??''),'VERIFIED_PROJECT_REF_REQUIRED');assertAllowedProjectDigest(sha256(m.projectRef));
 requireThat(m.sourceSha===sourceSha&&/^[a-f0-9]{40}$/.test(sourceSha),'SOURCE_MISMATCH');
 requireThat(m.maxActors===6&&m.workspaces===2&&m.liveProviders===false,'PROVISIONING_BOUNDS_MISMATCH');
 const actual=Object.fromEntries(Object.entries(manifest).map(([k,v])=>[k,v.committedSha256]));
 requireThat(Object.values(manifest).every(v=>v.matchesCommitted),'UNCOMMITTED_MIGRATION');
 requireThat(m.migrations&&Object.keys(m.migrations).length===Object.keys(actual).length&&Object.entries(actual).every(([k,v])=>m.migrations[k]===v),'MIGRATION_MANIFEST_MISMATCH');
 return m;
}
export function connectionOptions(m,databaseUrl,key,ca){
 let u;try{u=new URL(databaseUrl);}catch{throw new Error('DATABASE_URL_REQUIRED');}
 requireThat(u.protocol==='postgresql:'||u.protocol==='postgres:','DATABASE_PROTOCOL');
 requireThat(!u.search&&!u.hash&&u.pathname==='/postgres'&&(!u.port||u.port==='5432'),'SESSION_TLS_CONNECTION_REQUIRED');
 const user=decodeURIComponent(u.username),direct=u.hostname===`db.${m.projectRef}.supabase.co`;
 const pool=/^aws-[0-9]+-ap-south-1\.pooler\.supabase\.com$/.test(u.hostname)&&u.hostname===m.databaseHost;
 requireThat((direct&&user==='postgres')||(pool&&user===`postgres.${m.projectRef}`),'DATABASE_PROJECT_MISMATCH');
 requireThat(u.hostname===m.databaseHost&&!!u.password,'DATABASE_PROJECT_MISMATCH');
 requireThat(typeof key==='string'&&(key.startsWith('sb_secret_')||key.split('.').length===3),'SERVICE_KEY_REQUIRED');
 if(!key.startsWith('sb_secret_')){let p;try{p=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());}catch{throw new Error('SERVICE_KEY_REQUIRED');}requireThat(p.role==='service_role'&&p.ref===m.projectRef,'SERVICE_KEY_PROJECT_MISMATCH');}
 return {host:u.hostname,port:5432,user,password:decodeURIComponent(u.password),database:'postgres',ssl:{rejectUnauthorized:true,servername:u.hostname,...(ca?{ca}:{})},connectionTimeoutMillis:10000,statement_timeout:60000,query_timeout:65000,idle_in_transaction_session_timeout:15000};
}
export function makeActors(runId){
 const roles={patientA:'patient',patientB:'patient',doctorA:'doctor',doctorB:'doctor',doctorU:'doctor',reception:'receptionist'};
 return Object.entries(roles).map(([name,role])=>({name,role,appId:randomUUID(),email:`${name.toLowerCase()}.${runId}@synthetic.example.test`,password:randomBytes(24).toString('base64url')}));
}
export async function assertEmptyDatabase(db){
 const r=await db.query(`SELECT
 (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p','v','m','f','S')) relations,
 (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')) routines,
 (SELECT count(*)::int FROM auth.users) actors,
 (SELECT count(*)::int FROM storage.buckets) buckets,
 (SELECT count(*)::int FROM storage.objects) objects`);
 requireThat(['relations','routines','actors','buckets','objects'].every(k=>r.rows[0]?.[k]===0),'EXISTING_DATA_PRESERVED');
 // An unrecognized application schema requires inspection, never an empty claim.
 const schemas=await db.query(`SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN ('information_schema','public','private','auth','storage','extensions','realtime','_realtime','graphql','graphql_public','vault','supabase_functions','supabase_migrations','net','cron','pgsodium','pgsodium_masks','pgtle')`);
 requireThat(schemas.rows.length===0,'UNKNOWN_SCHEMA_PRESERVED');
 const history=await db.query("SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL present");
 if(history.rows[0].present){const rows=await db.query('SELECT count(*)::int count FROM supabase_migrations.schema_migrations');requireThat(rows.rows[0].count===0,'EXISTING_MIGRATION_HISTORY_PRESERVED');}
}
async function authUsers(auth){const r=await auth.listUsers({page:1,perPage:50});requireThat(!r.error&&Array.isArray(r.data?.users),'AUTH_INVENTORY_FAILED');return r.data.users;}
export async function provisionHosted({approval,plan,db,auth,vault,tariff}){
 validateApproval(approval,approval.sourceSha,plan.manifest);
 const runId=randomUUID(),actors=makeActors(runId),ids={workspaceA:randomUUID(),workspaceB:randomUUID(),patientA:randomUUID(),patientB:randomUUID()};
 // Exclusive encrypted private journal is created before the first mutation.
 await vault.open({runId,projectRef:approval.projectRef,sourceSha:approval.sourceSha,actors,ids});
 let stage='preflight';
 try{
  const lock=await db.query('SELECT pg_try_advisory_lock(741932603) locked');requireThat(lock.rows[0]?.locked===true,'ANOTHER_PROVISIONER_ACTIVE');
  await assertEmptyDatabase(db);requireThat((await authUsers(auth)).length===0,'EXISTING_AUTH_PRESERVED');
  stage='baseline_unknown';await vault.record({stage});
  await db.query('BEGIN');
  try{
   await assertEmptyDatabase(db);
   await db.query(plan.baseline+'\n'+plan.forward);
   await db.query(`CREATE TABLE private.preview_provisioning(run_id uuid PRIMARY KEY, project_ref text NOT NULL, source_sha text NOT NULL, migration_manifest jsonb NOT NULL, state text NOT NULL CHECK(state IN ('baseline','complete')), created_at timestamptz NOT NULL DEFAULT now()); REVOKE ALL ON private.preview_provisioning FROM PUBLIC,anon,authenticated,service_role;`);
   await db.query("INSERT INTO private.preview_provisioning(run_id,project_ref,source_sha,migration_manifest,state) VALUES($1,$2,$3,$4,'baseline')",[runId,approval.projectRef,approval.sourceSha,JSON.stringify(plan.manifest)]);
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}
  stage='baseline_applied';await vault.record({stage});
  const created=[];
  for(const actor of actors){
   const current=await authUsers(auth);requireThat(current.length===created.length&&current.every(u=>created.includes(u.id)),'AUTH_INVENTORY_CHANGED');
   stage='auth_create_unknown';await vault.record({stage,actor:actor.name,createdAuthIds:[...created]});
   const result=await auth.createUser({email:actor.email,password:actor.password,email_confirm:true,user_metadata:{synthetic_preview_run:runId}});
   requireThat(!result.error&&/^[a-f0-9-]{36}$/.test(result.data?.user?.id??'')&&result.data.user.email===actor.email,'AUTH_CREATE_UNCONFIRMED');
   actor.authId=result.data.user.id;created.push(actor.authId);
   stage='auth_created';await vault.record({stage,actor:actor.name,authId:actor.authId,createdAuthIds:[...created]});
  }
  const all=await authUsers(auth);requireThat(all.length===6&&all.every(u=>created.includes(u.id)),'AUTH_INVENTORY_CHANGED');
  stage='mapping_commit_unknown';await vault.record({stage});
  await db.query('BEGIN');
  try{
   const authIds=await db.query('SELECT id::text FROM auth.users');requireThat(authIds.rows.length===6&&authIds.rows.every(u=>created.includes(u.id)),'AUTH_DATABASE_MISMATCH');
   const empty=await db.query('SELECT (SELECT count(*) FROM public.users)+(SELECT count(*) FROM public.workspaces)+(SELECT count(*) FROM public.patients) count');requireThat(Number(empty.rows[0].count)===0,'APPLICATION_INVENTORY_CHANGED');
   for(const a of actors)await db.query('INSERT INTO public.users(id,auth_user_id,name,email,role,is_active) VALUES($1,$2,$3,$4,$5,true)',[a.appId,a.authId,'Synthetic '+a.name,a.email,a.role]);
   for(const s of ['A','B']){
    const patient=actors.find(a=>a.name==='patient'+s),doctor=actors.find(a=>a.name==='doctor'+s);
    await db.query('INSERT INTO public.workspaces(id,name,is_demo) VALUES($1,$2,true)',[ids['workspace'+s],'Synthetic preview '+s]);
    await db.query('INSERT INTO public.patients(id,user_id,name) VALUES($1,$2,$3)',[ids['patient'+s],patient.appId,'Synthetic patient '+s]);
    await db.query('INSERT INTO public.workspace_memberships(workspace_id,user_id,role) VALUES($1,$2,$3)',[ids['workspace'+s],doctor.appId,doctor.role]);
    await db.query('INSERT INTO public.care_relationships(patient_id,workspace_id,provider_id,granted_by,scope) VALUES($1,$2,$3,$4,$5)',[ids['patient'+s],ids['workspace'+s],doctor.appId,patient.appId,'clinical']);
    await db.query('INSERT INTO public.illustrative_tariffs(workspace_id,version,effective_on,synthetic,source_revision,items) VALUES($1,$2,$3,true,$4,$5)',[ids['workspace'+s],tariff.version,tariff.effectiveOn,tariff.sourceRevision,JSON.stringify(tariff.items)]);
   }
   for(const name of ['doctorU','reception']){const a=actors.find(a=>a.name===name);await db.query('INSERT INTO public.workspace_memberships(workspace_id,user_id,role) VALUES($1,$2,$3)',[ids.workspaceA,a.appId,a.role]);}
   await db.query('INSERT INTO public.care_relationships(patient_id,workspace_id,provider_id,granted_by,scope) VALUES($1,$2,$3,$4,$5)',[ids.patientA,ids.workspaceA,actors.find(a=>a.name==='reception').appId,actors.find(a=>a.name==='patientA').appId,'intake']);
   await db.query("UPDATE private.preview_provisioning SET state='complete' WHERE run_id=$1",[runId]);
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}
  const checked=await db.query("SELECT (SELECT count(*)::int FROM public.users) actors,(SELECT count(*)::int FROM public.workspaces WHERE is_demo) workspaces,(SELECT count(*)::int FROM public.patients) patients,(SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity) unprotected,(SELECT count(*)::int FROM storage.buckets WHERE public) public_buckets");
  requireThat(checked.rows[0]?.actors===6&&checked.rows[0]?.workspaces===2&&checked.rows[0]?.patients===2&&checked.rows[0]?.unprotected===0&&checked.rows[0]?.public_buckets===0,'POST_COMMIT_VERIFICATION_FAILED');
  await db.query("NOTIFY pgrst, 'reload schema'");
  stage='complete';await vault.record({stage,actors:actors.map(a=>({name:a.name,role:a.role,email:a.email,appId:a.appId,authId:a.authId})),ids});
  return {runId,authAccountsCreated:6,workspaces:2,stage,externalProviderCalls:0};
 }catch(e){await vault.record({stage,stopped:true}).catch(()=>{});throw e;}
 finally{await db.query('SELECT pg_advisory_unlock(741932603)').catch(()=>{});}
}

// Windows credential records use current-user DPAPI; plaintext never reaches disk.
export function privateVault(directory){
 const parent=path.resolve(os.homedir(),'.codex','private'),dir=path.resolve(directory);
 requireThat(dir.startsWith(parent+path.sep)&&!existsSync(path.join(dir,'progress.json')),'NEW_PRIVATE_JOURNAL_REQUIRED');
 mkdirSync(dir,{recursive:true,mode:0o700});
 if(process.platform!=='win32')requireThat((statSync(dir).mode&0o077)===0,'PRIVATE_DIRECTORY_PERMISSIONS');
 let state={};
 const record=value=>{state={...state,...value};writeFileSync(path.join(dir,'progress.next'),JSON.stringify(state,null,2),{mode:0o600});renameSync(path.join(dir,'progress.next'),path.join(dir,'progress.json'));};
 return {
  open:async data=>{
   requireThat(process.platform==='win32','WINDOWS_DPAPI_REQUIRED');
   const encrypted=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Add-Type -AssemblyName System.Security; $raw=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($raw,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))"],{input:JSON.stringify(data),encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
   requireThat(!!encrypted,'PRIVATE_VAULT_FAILED');
   writeFileSync(path.join(dir,'credentials.dpapi'),encrypted,{flag:'wx',mode:0o600});
   state={runId:data.runId,projectRef:data.projectRef,stage:'preflight'};
   writeFileSync(path.join(dir,'progress.json'),JSON.stringify(state),{flag:'wx',mode:0o600});
  },record:async value=>record(value)
 };
}

async function main(){
 const [command,approvalPath,digest,journalDirectory]=process.argv.slice(2);
 if(command==='--plan'){
  requireThat(!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),'CLEAN_SOURCE_REQUIRED');
  const plan=loadMigrationPlan(root),sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  console.log(JSON.stringify({version:1,projectName:'cliniqplus-v2-preview',projectRef:null,region:'ap-south-1',plan:'Free',newEmptyProject:true,sourceSha,databaseHost:null,maxActors:6,workspaces:2,liveProviders:false,migrations:Object.fromEntries(Object.entries(plan.manifest).map(([file,v])=>[file,v.committedSha256]))},null,2));return;
 }
 requireThat(command==='--apply-hosted-preview'&&approvalPath&&/^[a-f0-9]{64}$/.test(digest??'')&&journalDirectory,'EXPLICIT_APPROVAL_FILE_DIGEST_AND_PRIVATE_JOURNAL_REQUIRED');
 requireThat(process.env.NODE_TLS_REJECT_UNAUTHORIZED!=='0','TLS_BYPASS_FORBIDDEN');
 const bytes=readFileSync(approvalPath);requireThat(sha256(bytes)===digest,'APPROVAL_FILE_CHANGED');
 requireThat(!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),'CLEAN_SOURCE_REQUIRED');
 const sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),plan=loadMigrationPlan(root);
 const approval=validateApproval(JSON.parse(bytes),sourceSha,plan.manifest),key=process.env.CLINIQ_PREVIEW_SERVICE_ROLE_KEY;
 const options=connectionOptions(approval,process.env.CLINIQ_PREVIEW_DATABASE_URL,key,approval.caPath?readFileSync(approval.caPath,'utf8'):undefined);
 const vault=privateVault(journalDirectory);
 const {default:pg}=await import('pg'),{createClient}=await import('@supabase/supabase-js');
 let requests=0;
 const admin=createClient(`https://${approval.projectRef}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,init={})=>{requireThat(++requests<=20,'AUTH_REQUEST_BUDGET');return fetch(url,{...init,redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(15000),...(init.signal?[init.signal]:[])])});}}});
 const db=new pg.Client(options);
 try{await db.connect();const result=await provisionHosted({approval,plan,db,auth:admin.auth.admin,vault,tariff:JSON.parse(readFileSync(path.join(root,'src/lib/catalog/synthetic-tariff.json'),'utf8'))});console.log(JSON.stringify(result));}
 finally{await db.end().catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(JSON.stringify({error:'HOSTED_PROVISIONING_STOPPED',reason:/^[A-Z_]+$/.test(e.message)?e.message:'DEPENDENCY_FAILURE_PRESERVE_STATE',action:'Inspect private progress; no automatic retry, deletion, password reset or identity merge.'}));process.exitCode=1;});
