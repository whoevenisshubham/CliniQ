import { createClient } from '@supabase/supabase-js';
import { randomUUID, randomBytes } from 'node:crypto';
import { localConfiguration } from './local-supabase.mjs';
import { pathToFileURL } from 'node:url';

// Explicit local-only synthetic provisioning. Never updates an existing password,
// reuses accounts by email, links hosted projects or runs from an HTTP handler.
export async function provisionSyntheticActors() {
  const config = localConfiguration();
  const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const inventory=await admin.auth.admin.listUsers({page:1,perPage:50});
  if(inventory.error || inventory.data.users.length>40) throw new Error('Local synthetic account cap reached; preserve existing accounts and use a separately named test project');
  const runId = randomUUID();
  const actors = {};
  for (const [name, role] of Object.entries({ patientA:'patient', patientB:'patient', doctorA:'doctor', doctorB:'doctor', doctorU:'doctor', reception:'receptionist', admin:'admin', disabled:'patient', unlinked:'patient' })) {
    const email = `${name.toLowerCase()}.${runId}@synthetic.example.test`;
    const password = randomBytes(24).toString('base64url');
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: 'admin', name: 'Untrusted metadata' } });
    if (error) throw new Error(`Synthetic Auth provisioning failed for ${name}: ${error.code ?? 'unknown'}`);
    actors[name] = { name, role, email, password, authId: data.user.id, appId: randomUUID() };
  }
  return { config, admin, actors, runId };
}

export async function provisionDemoWorkspace() {
  const config=localConfiguration();
  const inspection=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const existing=await inspection.from('workspaces').select('id,is_demo');
  if(existing.error || existing.data.some(w=>!w.is_demo) || existing.data.length>8) throw new Error('Refusing provisioning before schema setup, into non-demo data, or beyond workspace cap');
  const state=await provisionSyntheticActors();const {admin,actors}=state;
  const ids={workspaceA:randomUUID(),workspaceB:randomUUID(),patientA:randomUUID(),patientB:randomUUID()};
  function check(result) { if(result.error) throw new Error('Explicit synthetic provisioning failed: '+(result.error.code??'unknown')); }
  check(await admin.from('users').insert(Object.values(actors).filter(a=>a.name!=='unlinked').map(a=>({id:a.appId,auth_user_id:a.authId,name:'Synthetic '+a.name,email:a.email,role:a.role,is_active:a.name!=='disabled'}))));
  check(await admin.from('workspaces').insert([{id:ids.workspaceA,name:'Synthetic demo A',is_demo:true},{id:ids.workspaceB,name:'Synthetic demo B',is_demo:true}]));
  check(await admin.from('patients').insert(['A','B'].map(s=>({id:ids['patient'+s],user_id:actors['patient'+s].appId,name:'Synthetic patient '+s}))));
  check(await admin.from('workspace_memberships').insert(['doctorA','doctorU','reception','admin','doctorB'].map(name=>({workspace_id:name==='doctorB'?ids.workspaceB:ids.workspaceA,user_id:actors[name].appId,role:actors[name].role}))));
  check(await admin.from('care_relationships').insert(['A','B'].map(s=>({patient_id:ids['patient'+s],workspace_id:ids['workspace'+s],provider_id:actors['doctor'+s].appId,granted_by:actors['patient'+s].appId,scope:'clinical'}))));
  return {actors,ids,runId:state.runId};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] !== '--local-synthetic') throw new Error('Explicit --local-synthetic required');
  const result=await provisionDemoWorkspace();
  const {mkdirSync,writeFileSync}=await import('node:fs');
  const {root}=await import('./local-supabase.mjs');
  mkdirSync(root+'/tests/infra/.runtime',{recursive:true});
  writeFileSync(root+'/tests/infra/.runtime/demo-accounts.json',JSON.stringify(result));
  console.log(JSON.stringify({runId:result.runId,authAccountsCreated:Object.keys(result.actors).length,workspaces:2,scope:'isolated local synthetic workspace only; credentials retained in gitignored .runtime; no password resets'}));
}
