import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";
import { randomUUID,createHmac } from "node:crypto";
import { localConfiguration,root,sql } from "../../scripts/local-supabase.mjs";
import { resolvePrincipal } from "@/lib/server/auth/context";
import { readPrivateContent } from "@/lib/server/documents/content";
import { GET as me } from "@/app/api/me/route";
import { GET as contentRoute } from "@/app/api/documents/[id]/content/route";
import { completeCallback } from "@/lib/server/auth/callback";
import { GET as emrRoute } from "@/app/api/consultations/[id]/emr/route";

type Jar = { getAll:()=>{name:string;value:string}[]; set:(name:string,value:string)=>void };
const requestState=vi.hoisted(()=>({jar:null as Jar|null}));
// Only the framework cookie adapter is supplied here. Auth identities, JWTs,
// database policies and Storage requests all use the actual local services.
vi.mock("next/headers",()=>({cookies:async()=>requestState.jar}));
const config=localConfiguration();
const fixture=JSON.parse(readFileSync(root+"/tests/infra/.runtime/fixture.json","utf8"));
const {actors,ids}=fixture;
const clients:Record<string,SupabaseClient>={};
const jars:Record<string,Jar>={};
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const anon=createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const docId=randomUUID(), versionId=randomUUID(), objectKey=`${docId}/${versionId}.txt`;
const privateBytes=new TextEncoder().encode("Synthetic private record; no real medical data.");

function makeClient() {
 const values=new Map<string,string>();
 const jar:Jar={getAll:()=>Array.from(values,([name,value])=>({name,value})),set:(name,value)=>{values.set(name,value);}};
 const client=createServerClient(config.API_URL,config.ANON_KEY,{cookies:{getAll:jar.getAll,setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}});
 return {client,jar};
}
async function deniedRead(client:SupabaseClient,table:string,id:string) {
 const {data,error}=await client.from(table).select("*").eq("id",id);
 if(error) expect(error.code,`Unexpected error for ${table}: ${error.message}`).toBe('42501');
 else expect(data).toEqual([]);
}
beforeAll(async()=>{
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL",config.API_URL);vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY",config.ANON_KEY);
 vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY",config.SERVICE_ROLE_KEY);vi.stubEnv("APP_ORIGIN","http://localhost:3000");
 // Fresh unlinked identity per run: a prior successful bootstrap is preserved.
 const freshEmail=`unlinked.${randomUUID()}@synthetic.example.test`, freshPassword=randomUUID()+randomUUID();
 const fresh=await admin.auth.admin.createUser({email:freshEmail,password:freshPassword,email_confirm:true,user_metadata:{role:'admin'}});
 expect(fresh.error).toBeNull();actors.unlinked={...actors.unlinked,email:freshEmail,password:freshPassword,authId:fresh.data.user!.id};
 for(const [name,actor] of Object.entries(actors) as [string,{email:string;password:string}][]) {
  const {client,jar}=makeClient();
  const {error}=await client.auth.signInWithPassword({email:actor.email,password:actor.password});
  expect(error?.code??null,`Real Auth login ${name}`).toBeNull();clients[name]=client;jars[name]=jar;
 }
 const {error:d}=await admin.from("documents").insert({id:docId,patient_id:ids.patientA,created_by:actors.patientA.appId,title:"Synthetic private record"});expect(d).toBeNull();
 const {error:v}=await admin.from("document_versions").insert({id:versionId,document_id:docId,version_no:1,object_key:objectKey,mime:"text/plain",byte_size:privateBytes.length,sha256:"fixture-only"});expect(v).toBeNull();
 const {error:c}=await admin.from("documents").update({current_version_id:versionId}).eq("id",docId);expect(c).toBeNull();
});
afterAll(()=>vi.unstubAllEnvs());

it("preserves every original field/UUID/history row through the representative forward upgrade",()=>{
 const proof=JSON.parse(readFileSync(root+"/tests/infra/.runtime/preservation.json","utf8"));
 expect(proof.before).toEqual(proof.after);expect(Object.keys(proof.before)).toHaveLength(15);
 expect(proof.freshBaseline).toEqual({users:0,patients:0,memberships:0});
 expect(proof.before.transcripts.rows).toBe(2);expect(proof.before.audit_log.rows).toBe(1);
});
it.each(["patientA","patientB","doctorA","doctorB","doctorU","reception","admin"])("real principal %s retains application ID and ignores admin metadata",async name=>{
 const principal=await resolvePrincipal(clients[name]);expect(principal.id).toBe(actors[name].appId);expect(principal.role).toBe(actors[name].role);
 expect(principal.authUserId).toBe(actors[name].authId);expect(principal.id).not.toBe(principal.authUserId);
});
it.each(["disabled","unlinked"])("real Auth account %s cannot become an application principal",async name=>{
 await expect(resolvePrincipal(clients[name])).rejects.toMatchObject({status:403});
});
it("anonymous clients cannot read identity or clinical tables or bootstrap",async()=>{
 for(const table of ["users","patients","consultations","transcripts","emr_entries","prescriptions","audit_log","documents","workspace_memberships"]) {
  const {data,error}=await anon.from(table).select("*");expect(error||!data?.length).toBeTruthy();
 }
 expect((await anon.rpc("bootstrap_patient")).error).not.toBeNull();
});
it("forged JWTs and unsigned legacy cookies cannot impersonate a user",async()=>{
 const session=(await clients.patientA.auth.getSession()).data.session!;
 const pieces=session.access_token.split('.');pieces[2]='invalid-signature';
 const forged=createClient(config.API_URL,config.ANON_KEY,{global:{headers:{Authorization:'Bearer '+pieces.join('.')}},auth:{persistSession:false,autoRefreshToken:false}});
 expect((await forged.from('users').select('id')).error).not.toBeNull();
 expect((await forged.auth.getUser(pieces.join('.'))).error).not.toBeNull();
 requestState.jar={getAll:()=>[{name:'nexusmd_session',value:Buffer.from(JSON.stringify({id:actors.doctorA.appId,role:'admin'})).toString('base64')}],set:()=>{}};
 expect((await me()).status).toBe(401);
});
it("an otherwise correctly signed expired local JWT is rejected by Auth and database admission",async()=>{
 const session=(await clients.patientA.auth.getSession()).data.session!;
 const [header,body]=session.access_token.split('.');const payload=JSON.parse(Buffer.from(body,'base64url').toString());payload.exp=Math.floor(Date.now()/1000)-120;
 const text=header+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url');
 const jwt=text+'.'+createHmac('sha256',config.JWT_SECRET).update(text).digest('base64url');
 expect((await clients.patientA.auth.getUser(jwt)).error).not.toBeNull();
 const expired=createClient(config.API_URL,config.ANON_KEY,{global:{headers:{Authorization:'Bearer '+jwt}},auth:{persistSession:false,autoRefreshToken:false}});
 expect((await expired.from('users').select('id')).error).not.toBeNull();
});
it("each patient reads its own profile and cannot enumerate another patient",async()=>{
 for(const s of ["A","B"]) {
  const {data,error}=await clients['patient'+s].from("patients").select("id");expect(error).toBeNull();expect(data).toEqual([{id:ids['patient'+s]}]);
 }
});
it("assigned providers read only their scoped patient and preserved visit/transcript/EMR",async()=>{
 for(const s of ["A","B"]) {
  const c=clients['doctor'+s];
  expect((await c.from("patients").select("id")).data).toEqual([{id:ids['patient'+s]}]);
  expect((await c.from("consultations").select("id")).data).toEqual([{id:ids['visit'+s]}]);
  expect((await c.from("transcripts").select("raw_text")).data).toEqual([{raw_text:"Synthetic historical Hinglish transcript"}]);
  expect((await c.from("emr_entries").select("chief_complaint")).data).toEqual([{chief_complaint:"Synthetic reviewed history"}]);
 }
});
it.each(["doctorU","reception","admin"])("%s cannot obtain clinical content through workspace role alone",async name=>{
 for(const table of ["patients","consultations","transcripts","emr_entries"]) {
  const {data,error}=await clients[name].from(table).select("*");expect(error).toBeNull();expect(data).toEqual([]);
 }
});
it("staff memberships are limited to the current actor/workspace",async()=>{
 const {data,error}=await clients.doctorA.from("workspace_memberships").select("workspace_id,user_id");expect(error).toBeNull();
 expect(data).toEqual([{workspace_id:ids.workspaceA,user_id:actors.doctorA.appId}]);
 expect((await clients.doctorA.from("workspaces").select("id")).data).toEqual([{id:ids.workspaceA}]);
});
it("direct mutations cannot promote roles, link Auth, join a workspace, fabricate care or clinical/audit records",async()=>{
 const p=clients.patientA;
 for(const change of [{role:'admin'},{auth_user_id:actors.doctorA.authId},{is_active:false}]) expect((await p.from("users").update(change).eq("id",actors.patientA.appId)).error).not.toBeNull();
 expect((await p.from("workspace_memberships").insert({workspace_id:ids.workspaceA,user_id:actors.patientA.appId,role:'doctor'})).error).not.toBeNull();
 expect((await clients.doctorU.from("care_relationships").insert({patient_id:ids.patientA,provider_id:actors.doctorU.appId,workspace_id:ids.workspaceA,scope:'clinical',granted_by:actors.doctorU.appId})).error).not.toBeNull();
 expect((await clients.doctorA.from("emr_entries").update({chief_complaint:'tampered'}).eq("consultation_id",ids.visitA)).error).not.toBeNull();
 expect((await p.from("audit_log").insert({event_type:'forged',actor_role:'admin',hash:'fake'})).error).not.toBeNull();
});
it("patient bootstrap is retry/concurrency safe and creates no staff role/membership",async()=>{
 const results=await Promise.all([clients.unlinked.rpc("bootstrap_patient"),clients.unlinked.rpc("bootstrap_patient")]);
 expect(results[0].error).toBeNull();expect(results[1].error).toBeNull();expect(results[0].data).toBe(results[1].data);
 const principal=await resolvePrincipal(clients.unlinked);expect(principal.role).toBe('patient');
 const rows=await admin.from("patients").select("id,dob,phone").eq("user_id",principal.id);expect(rows.data).toHaveLength(1);expect(rows.data![0].dob).toBeNull();
 expect((await clients.unlinked.from("workspace_memberships").select("*")).data).toEqual([]);
});
it("direct uploads require validated server admission, including an owner with registered metadata",async()=>{
 expect((await clients.patientB.storage.from("clinical-documents").upload(objectKey,privateBytes,{contentType:'text/plain'})).error).not.toBeNull();
 expect((await clients.patientA.storage.from("clinical-documents").upload('arbitrary.txt',privateBytes,{contentType:'text/plain'})).error).not.toBeNull();
 expect((await clients.patientA.storage.from("clinical-documents").upload(objectKey,privateBytes,{contentType:'text/plain'})).error).not.toBeNull();
 expect((await admin.storage.from("clinical-documents").upload(objectKey,privateBytes,{contentType:'text/plain'})).error).toBeNull();
 expect((await admin.from("documents").update({status:'ready'}).eq('id',docId)).error).toBeNull();
});
it("direct downloads, signed URLs, listing, overwrite and deletion cannot bypass private content admission",async()=>{
 for(const name of ['patientA','patientB','doctorA']) {
  const storage=clients[name].storage.from('clinical-documents');
  expect((await storage.download(objectKey)).error).not.toBeNull();
  expect((await storage.createSignedUrl(objectKey,60)).error).not.toBeNull();
  const listed=await storage.list(docId);expect(listed.data??[]).toEqual([]);
  expect((await storage.update(objectKey,privateBytes,{contentType:'text/plain'})).error).not.toBeNull();
  const removed=await storage.remove([objectKey]);expect(removed.data??[]).toEqual([]);
 }
 expect((await admin.storage.from('clinical-documents').download(objectKey)).error).toBeNull();
 expect((await clients.patientA.storage.updateBucket('clinical-documents',{public:true})).error).not.toBeNull();
 expect((await fetch(config.API_URL+'/storage/v1/object/public/clinical-documents/'+objectKey)).ok).toBe(false);
});
it("grant revocation during a real byte read prevents publication",async()=>{
 const grantId=randomUUID();await admin.from('document_grants').insert({id:grantId,document_id:docId,provider_id:actors.doctorA.appId,workspace_id:ids.workspaceA,granted_by:actors.patientA.appId});
 const racingCapability={storage:{from:()=>({download:async(key:string)=>{
  const result=await admin.storage.from('clinical-documents').download(key);
  await admin.from('document_grants').update({revoked_at:new Date().toISOString()}).eq('id',grantId);
  return result;
 }})}} as unknown as SupabaseClient;
 await expect(readPrivateContent(clients.doctorA,()=>racingCapability,docId)).rejects.toMatchObject({status:404});
});
it("the actual byte service allows owner, denies other patients and care-only providers, then honors grant/revoke",async()=>{
 const owner=await readPrivateContent(clients.patientA,()=>admin,docId);expect(await owner.text()).toContain('Synthetic private record');expect(owner.headers.get('cache-control')).toBe('private, no-store');
 for(const name of ['patientB','doctorA','doctorB','doctorU','reception','admin']) await expect(readPrivateContent(clients[name],()=>admin,docId)).rejects.toMatchObject({status:404});
 const grantId=randomUUID();
 expect((await admin.from('document_grants').insert({id:grantId,document_id:docId,provider_id:actors.doctorA.appId,workspace_id:ids.workspaceA,granted_by:actors.patientA.appId})).error).toBeNull();
 expect((await readPrivateContent(clients.doctorA,()=>admin,docId)).status).toBe(200);
 expect((await admin.from('document_grants').update({revoked_at:new Date().toISOString()}).eq('id',grantId)).error).toBeNull();
 await expect(readPrivateContent(clients.doctorA,()=>admin,docId)).rejects.toMatchObject({status:404});
});
it("actual HTTP handlers resolve real cookie sessions; no mocked principal",async()=>{
 requestState.jar=jars.patientA;const response=await me();expect(response.status).toBe(200);expect((await response.json()).data.id).toBe(actors.patientA.appId);
 const bytes=await contentRoute(new Request('http://localhost:3000'),{params:Promise.resolve({id:docId})});expect(bytes.status).toBe(200);
 requestState.jar=jars.patientB;expect((await contentRoute(new Request('http://localhost:3000'),{params:Promise.resolve({id:docId})})).status).toBe(404);
 requestState.jar={getAll:()=>[],set:()=>{}};expect((await me()).status).toBe(401);
});
it("the repaired EMR HTTP reader uses real scoped policies and MediFlow normalization without writing history",async()=>{
 requestState.jar=jars.doctorA;
 const result=await emrRoute(new Request('http://localhost:3000'),{params:Promise.resolve({id:ids.visitA})});expect(result.status).toBe(200);
 const payload=await result.json();expect(payload.data.snapshot.medications[0].dosage).toBe('source text');
 expect(payload.data.sourceMedications[0]).toEqual({name:'Synthetic medicine',dose:'source text'});
 expect(payload.data.summaryKind).toBe('deterministic_source_format');
 for(const name of ['patientA','doctorB','doctorU','admin','reception']) {
  requestState.jar=jars[name];expect((await emrRoute(new Request('http://localhost:3000'),{params:Promise.resolve({id:ids.visitA})})).status).toBe(404);
 }
});
it("workspace membership revocation and disabled accounts take effect on an already-issued session",async()=>{
 expect((await admin.from('workspace_memberships').update({status:'inactive'}).eq('workspace_id',ids.workspaceA).eq('user_id',actors.doctorA.appId)).error).toBeNull();
 await deniedRead(clients.doctorA,'patients',ids.patientA);
  await expect(resolvePrincipal(clients.doctorA)).rejects.toMatchObject({status:403,code:'MEMBERSHIP_REQUIRED'});
 await admin.from('workspace_memberships').update({status:'active'}).eq('workspace_id',ids.workspaceA).eq('user_id',actors.doctorA.appId);
 await admin.from('users').update({is_active:false}).eq('id',actors.patientA.appId);
 await expect(resolvePrincipal(clients.patientA)).rejects.toMatchObject({status:403});await deniedRead(clients.patientA,'documents',docId);
 await admin.from('users').update({is_active:true}).eq('id',actors.patientA.appId);
});
it("known permissive policies are removed and every application table has RLS",()=>{
 expect(sql("select count(*) from pg_policies where schemaname='public' and (qual='true' or with_check='true')")).toBe('0');
 expect(sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity")).toBe('0');
 expect(sql("select count(*) from storage.buckets where id in ('clinical-documents','clinical-audio-temp') and public")).toBe('0');
});
it("logout invalidates subsequent Auth identity resolution",async()=>{
 const oldToken=(await clients.doctorU.auth.getSession()).data.session!.access_token;
 const oldCookies=jars.doctorU.getAll();
 expect((await clients.doctorU.auth.signOut({scope:'local'})).error).toBeNull();
 await expect(resolvePrincipal(clients.doctorU)).rejects.toMatchObject({status:401});
 const replay=createClient(config.API_URL,config.ANON_KEY,{global:{headers:{Authorization:'Bearer '+oldToken}},auth:{persistSession:false,autoRefreshToken:false}});
 expect((await replay.from('users').select('id')).data??[]).toEqual([]);
 expect((await replay.rpc('bootstrap_patient')).error).not.toBeNull();
 requestState.jar={getAll:()=>oldCookies,set:()=>{}};expect((await me()).status).not.toBe(200);
});

async function mailCode(email:string) {
 const started=Date.now();
 while(Date.now()-started<10000) {
  const list=await fetch(config.INBUCKET_URL+'/api/v1/messages').then(r=>r.json());
  const message=list.messages.find((m:{To:{Address:string}[]})=>m.To.some(t=>t.Address===email));
  if(message) {
   const body=await fetch(config.INBUCKET_URL+'/api/v1/message/'+message.ID).then(r=>r.json());
   const links=String(body.Text||body.HTML).replaceAll('&amp;','&').match(/https?:\/\/[^\s<>\"]+/g)??[];
   const link=links.find((l:string)=>new URL(l).pathname==='/auth/v1/verify');
   if(!link || new URL(link).origin!==config.API_URL) throw new Error('Unexpected local verification URL');
   const verified=await fetch(link,{redirect:'manual'});
   const location=verified.headers.get('location');
   if(!location) throw new Error('Local Auth did not redirect');
   const target=new URL(location);expect(target.origin).toBe('http://localhost:3000');
   const code=target.searchParams.get('code');if(!code) throw new Error('Local Auth did not return a PKCE code');
   return code;
  }
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw new Error('Local mail delivery timeout');
}
it("real local PKCE callback reuses stable identity, restricts role return and rejects code replay",async()=>{
 const {client}=makeClient();
 const {error}=await client.auth.signInWithOtp({email:actors.patientA.email,options:{emailRedirectTo:'http://localhost:3000/auth/callback',shouldCreateUser:false}});expect(error).toBeNull();
 const code=await mailCode(actors.patientA.email);
 expect(await completeCallback(client,code,'/doctor')).toBe('/patient');
 expect((await resolvePrincipal(client)).id).toBe(actors.patientA.appId);
 await expect(completeCallback(client,code,null)).rejects.toMatchObject({status:400});
});
it("real local PKCE rejects a missing verifier without granting an application session",async()=>{
 const {client}=makeClient();
 expect((await client.auth.signInWithOtp({email:actors.patientB.email,options:{emailRedirectTo:'http://localhost:3000/auth/callback',shouldCreateUser:false}})).error).toBeNull();
 const code=await mailCode(actors.patientB.email);
 const stranger=makeClient().client;
 await expect(completeCallback(stranger,code,null)).rejects.toMatchObject({status:400});
 await expect(resolvePrincipal(stranger)).rejects.toMatchObject({status:401});
 expect(await completeCallback(client,code,'/patient/reports')).toBe('/patient/reports');
});
it('deniedRead does not count an unexpected schema error as a successful denial',async()=>{
 await expect(deniedRead(clients.patientA,'missing_isolation_test_table',randomUUID())).rejects.toThrow();
});
