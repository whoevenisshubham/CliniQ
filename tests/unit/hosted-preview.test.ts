import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {assertAllowedProjectDigest,validateApproval,connectionOptions,makeActors,assertEmptyDatabase,provisionHosted} from '../../scripts/hosted-preview.mjs';

// Guard/orchestration tests use bounded dependency doubles, never hosted accounts.
const ref='a'.repeat(20),sha='b'.repeat(40),file='supabase/baseline/001_domain.sql';
const manifest={[file]:{committedSha256:'c'.repeat(64),matchesCommitted:true}};
const approval={version:1,projectName:'cliniqplus-v2-preview',region:'ap-south-1',plan:'Free',newEmptyProject:true,projectRef:ref,sourceSha:sha,maxActors:6,workspaces:2,liveProviders:false,migrations:{[file]:'c'.repeat(64)},databaseHost:`db.${ref}.supabase.co`};
const key='sb_secret_synthetic_test_only',url=`postgresql://postgres:synthetic-test-only@${approval.databaseHost}:5432/postgres`;
const plan={baseline:'REHEARSAL_BASELINE',forward:'REHEARSAL_FORWARD',manifest};

it.each([{plan:'Pro'},{newEmptyProject:false},{region:'ap-southeast-2'},{projectName:'NexusMD'},{maxActors:7},{workspaces:3},{liveProviders:true},{projectRef:'unassigned'}])('rejects scope changes before connecting: %j',change=>{
 expect(()=>validateApproval({...approval,...change},sha,manifest)).toThrow();
});
it.each(['7c14714db81a3204acaac42f13f7dfbad49fa85184341dbe40ade552660cb2b6','c59410de120a6a94e9fc142c5fcc4cd3a93f4a4d3c66d6045d4e7071a1a6bf7b'])('permanently refuses a protected historical project digest',digest=>expect(()=>assertAllowedProjectDigest(digest)).toThrow('HISTORICAL_PROJECT_FORBIDDEN'));
it('requires exact source and committed migration identities',()=>{
 expect(()=>validateApproval(approval,'d'.repeat(40),manifest)).toThrow('SOURCE_MISMATCH');
 expect(()=>validateApproval(approval,sha,{[file]:{...manifest[file],matchesCommitted:false}})).toThrow('UNCOMMITTED_MIGRATION');
 expect(()=>validateApproval({...approval,migrations:{}},sha,manifest)).toThrow('MIGRATION_MANIFEST_MISMATCH');
 expect(validateApproval(approval,sha,manifest)).toBe(approval);
});
it.each([url+'?sslmode=no-verify',url.replace(':5432/',':6543/'),url.replace(approval.databaseHost,'attacker.example'),url.replace('postgresql:','http:')])('rejects unsafe or foreign SQL connections',connection=>expect(()=>connectionOptions(approval,connection,key,undefined)).toThrow());
it('pins direct/session-pooler identity and verified TLS without connection-string overrides',()=>{
 const direct=connectionOptions(approval,url,key,'synthetic-ca');expect(direct.ssl).toMatchObject({rejectUnauthorized:true,servername:approval.databaseHost,ca:'synthetic-ca'});expect(direct).not.toHaveProperty('connectionString');
 const pool={...approval,databaseHost:'aws-1-ap-south-1.pooler.supabase.com'};
 expect(connectionOptions(pool,`postgresql://postgres.${ref}:synthetic-test-only@${pool.databaseHost}:5432/postgres`,key,undefined).user).toBe('postgres.'+ref);
 expect(()=>connectionOptions(pool,`postgresql://postgres.${'z'.repeat(20)}:synthetic-test-only@${pool.databaseHost}:5432/postgres`,key,undefined)).toThrow('DATABASE_PROJECT_MISMATCH');
 const jwt=(payload:unknown)=>'header.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.signature';
 expect(()=>connectionOptions(approval,url,jwt({ref,role:'anon'}),undefined)).toThrow('SERVICE_KEY_PROJECT_MISMATCH');
 expect(()=>connectionOptions(approval,url,jwt({ref:'z'.repeat(20),role:'service_role'}),undefined)).toThrow('SERVICE_KEY_PROJECT_MISMATCH');
});
it('creates exactly six distinct synthetic credentials and explicit application identities',()=>{
 const actors=makeActors(randomUUID());expect(actors).toHaveLength(6);expect(new Set(actors.map(a=>a.password)).size).toBe(6);expect(new Set(actors.map(a=>a.appId)).size).toBe(6);expect(actors.filter(a=>a.role==='admin')).toHaveLength(0);expect(actors.every(a=>a.email.endsWith('@synthetic.example.test'))).toBe(true);
});
it.each(['relations','routines','actors','buckets','objects'])('preserves existing %s before DDL or Auth creation',async field=>{
 const db={query:vi.fn(async()=>({rows:[{relations:0,routines:0,actors:0,buckets:0,objects:0,[field]:1}]}))};await expect(assertEmptyDatabase(db)).rejects.toThrow('EXISTING_DATA_PRESERVED');expect(db.query).toHaveBeenCalledTimes(1);
});

function dependencies(){
 const users:{id:string;email:string}[]=[],records:Record<string,unknown>[]=[];
 const auth={listUsers:vi.fn(async()=>({data:{users:[...users]},error:null})),createUser:vi.fn(async(input:{email:string})=>{const user={id:randomUUID(),email:input.email};users.push(user);return {data:{user},error:null};})};
 const db={query:vi.fn(async(...[text]:[string,unknown[]?]):Promise<{rows:Record<string,unknown>[]} >=>{
  if(text.includes('pg_try_advisory_lock'))return {rows:[{locked:true}]};
  if(text.includes(' relations,'))return {rows:[{relations:0,routines:0,actors:0,buckets:0,objects:0}]};
  if(text.includes('FROM pg_namespace'))return {rows:[]};
  if(text.includes('to_regclass'))return {rows:[{present:false}]};
  if(text==='SELECT id::text FROM auth.users')return {rows:users.map(u=>({id:u.id}))};
  if(text.includes('public.users)+(SELECT count'))return {rows:[{count:'0'}]};
  if(text.includes('public_buckets'))return {rows:[{actors:6,workspaces:2,patients:2,unprotected:0,public_buckets:0}]};
  return {rows:[]};
 })};
 const vault={open:vi.fn(async()=>{}),record:vi.fn(async(value:Record<string,unknown>)=>{records.push(value);})};
 const args={approval,plan,auth,db,vault,tariff:{version:'synthetic-test',effectiveOn:'2026-10-24',sourceRevision:sha,items:[]}};
 return {args,users,records};
}
it('an existing Auth account stops the run before baseline application or account creation',async()=>{
 const d=dependencies();d.users.push({id:randomUUID(),email:'existing@synthetic.example.test'});await expect(provisionHosted(d.args)).rejects.toThrow('EXISTING_AUTH_PRESERVED');expect(d.args.auth.createUser).not.toHaveBeenCalled();expect(d.args.db.query.mock.calls.some(([sql])=>sql==='BEGIN')).toBe(false);
});
it('uncertain Auth creation is not retried and preserves known created identifiers for manual recovery',async()=>{
 const d=dependencies();d.args.auth.createUser.mockRejectedValueOnce(new Error('Synthetic timeout'));
 await expect(provisionHosted(d.args)).rejects.toThrow('Synthetic timeout');expect(d.args.auth.createUser).toHaveBeenCalledTimes(1);expect(d.records.at(-1)).toMatchObject({stage:'auth_create_unknown',stopped:true});expect(d.args.db.query.mock.calls.some(([sql])=>sql.startsWith('INSERT INTO public.users'))).toBe(false);
});
it('partial Auth creation stops at the uncertain third account without mapping or resending it',async()=>{
 const d=dependencies(),create=d.args.auth.createUser.getMockImplementation()!;
 d.args.auth.createUser.mockImplementationOnce(create).mockImplementationOnce(create).mockRejectedValueOnce(new Error('Synthetic third-create timeout'));
 await expect(provisionHosted(d.args)).rejects.toThrow('Synthetic third-create timeout');expect(d.args.auth.createUser).toHaveBeenCalledTimes(3);expect(d.users).toHaveLength(2);
 expect(d.records.find(r=>r.stage==='auth_create_unknown'&&Array.isArray(r.createdAuthIds)&&r.createdAuthIds.length===2)?.createdAuthIds).toEqual(d.users.map(u=>u.id));
 expect(d.args.db.query.mock.calls.some(([sql])=>sql.startsWith('INSERT INTO public.users'))).toBe(false);
});
it('commits explicit returned Auth IDs in a separate transactional mapping phase without merging metadata',async()=>{
 const d=dependencies(),result=await provisionHosted(d.args);expect(result).toMatchObject({authAccountsCreated:6,workspaces:2,stage:'complete',externalProviderCalls:0});
 const mappings=d.args.db.query.mock.calls.filter(([sql])=>sql.startsWith('INSERT INTO public.users'));expect(mappings).toHaveLength(6);expect(mappings.map(([,values])=>values?.[1])).toEqual(d.users.map(u=>u.id));expect(d.args.db.query.mock.calls.filter(([sql])=>sql==='COMMIT')).toHaveLength(2);expect(d.records.at(-1)?.actors).toHaveLength(6);expect(JSON.stringify(d.records)).not.toContain('password');
});
