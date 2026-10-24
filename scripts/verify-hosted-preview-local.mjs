// Fresh CI instance only. Rehearses provisioning SQL/Auth, never remote writes.
import {createClient} from '@supabase/supabase-js';
import pg from 'pg';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {localConfiguration,root} from './local-supabase.mjs';
import {loadMigrationPlan} from './migration-plan.mjs';
import {provisionHosted} from './hosted-preview.mjs';

if(process.argv[2]!=='--local-synthetic')throw new Error('Explicit local rehearsal required');
const config=localConfiguration();
const url=new URL(config.DB_URL);
if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='54322'||url.pathname!=='/postgres')throw new Error('Unexpected rehearsal database');
const db=new pg.Client({connectionString:url.toString(),connectionTimeoutMillis:10000,statement_timeout:60000});
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,options),plan=loadMigrationPlan(root);
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const approval={version:1,projectName:'cliniqplus-v2-preview',region:'ap-south-1',plan:'Free',newEmptyProject:true,projectRef:'p'.repeat(20),sourceSha,maxActors:6,workspaces:2,liveProviders:false,migrations:Object.fromEntries(Object.entries(plan.manifest).map(([file,v])=>[file,v.committedSha256]))};
let credentials,progress;
try{
 await db.connect();
 const result=await provisionHosted({approval,plan,db,auth:admin.auth.admin,vault:{open:async value=>{credentials=value;},record:async value=>{progress={...progress,...value};}},tariff:JSON.parse(readFileSync(path.join(root,'src/lib/catalog/synthetic-tariff.json'),'utf8'))});
 // Read-only schema-cache convergence; never retry a mutation or count an error as denial.
 let ready=false;
 for(let n=0;n<15;n++){const r=await admin.from('users').select('id').limit(1);if(!r.error){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,200));}
 if(!ready)throw new Error('Rehearsal schema unavailable');
 for(const name of ['patientA','patientB','doctorA','doctorU']){
  const actor=credentials.actors.find(a=>a.name===name),client=createClient(config.API_URL,config.ANON_KEY,options);
  const login=await client.auth.signInWithPassword({email:actor.email,password:actor.password});if(login.error)throw new Error('Rehearsal Auth failed');
  const patients=await client.from('patients').select('id');if(patients.error)throw new Error('Rehearsal scoped read failed');
  const expected=name==='doctorU'?[]:[credentials.ids[name==='patientB'?'patientB':'patientA']];
  if(JSON.stringify(patients.data.map(p=>p.id).sort())!==JSON.stringify(expected.sort()))throw new Error('Rehearsal isolation mismatch');
  await client.auth.signOut();
 }
 if(progress.stage!=='complete')throw new Error('Rehearsal journal incomplete');
 console.log(JSON.stringify({scope:'fresh local CI Auth/Postgres/Storage provisioning rehearsal; not hosted CLI/runtime acceptance',sourceSha,actors:result.authAccountsCreated,workspaces:result.workspaces,realActorLoginAndScopedReads:4,externalProviderCalls:0,credentialsPublished:false}));
}catch{console.error('Local provisioning rehearsal failed; preserve runner diagnostics privately, never publish credentials.');process.exitCode=1;}
finally{await db.end().catch(()=>{});credentials=undefined;}
