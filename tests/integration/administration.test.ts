import {beforeAll,it,expect} from 'vitest';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {localConfiguration} from '../../scripts/local-supabase.mjs';
import {administrationView,administrationMutate} from '@/lib/server/administration/service';
const config=localConfiguration();
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const wA=randomUUID(),wB=randomUUID();
const people:Record<string,{id:string;client:SupabaseClient}>={};
beforeAll(async()=>{
 expect((await admin.from('workspaces').insert([{id:wA,name:'Synthetic administration A',is_demo:true},{id:wB,name:'Synthetic administration B',is_demo:true}])).error).toBeNull();
 for(const [name,role,w] of [['adminA','admin',wA],['adminB','admin',wB],['staff','doctor',wA]]){
  const id=randomUUID(),email=`${name}.${id}@synthetic.example.test`,password=randomUUID()+randomUUID();
  const auth=await admin.auth.admin.createUser({email,password,email_confirm:true});expect(auth.error).toBeNull();
  expect((await admin.from('users').insert({id,auth_user_id:auth.data.user!.id,email,name:'Synthetic '+name,role,is_active:true})).error).toBeNull();
  expect((await admin.from('workspace_memberships').insert({workspace_id:w,user_id:id,role,status:'active'})).error).toBeNull();
  const client=createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  expect((await client.auth.signInWithPassword({email,password})).error).toBeNull();people[name]={id,client};
 }
});
it('real admin sessions see only their workspace staff and operational metadata',async()=>{
 const view=await administrationView(people.adminA.client,wA);
 expect(view.workspace.id).toBe(wA);expect(view.members.map((m:{id:string})=>m.id).sort()).toEqual([people.adminA.id,people.staff.id].sort());
 expect(view.counts).toEqual({consultations:0,activeStaff:2});expect(view.audit).toEqual([]);
 expect(JSON.stringify(view)).not.toContain(people.adminB.id);
 await expect(administrationView(people.adminA.client,wB)).rejects.toMatchObject({status:403,code:'ADMIN_REQUIRED'});
 const direct=await people.staff.client.rpc('workspace_admin_view',{w:wA});expect(direct.error?.message).toBe('ADMIN_REQUIRED');
});
it('status changes are atomic, revisioned and idempotent, with no global role change',async()=>{
 const key=randomUUID(),command={action:'set_status',workspaceId:wA,memberId:people.staff.id,expectedRevision:0,status:'inactive'};
 const result=await administrationMutate(people.adminA.client,key,command);expect(result).toEqual({memberId:people.staff.id,revision:1,status:'inactive'});
 expect(await administrationMutate(people.adminA.client,key,command)).toEqual(result);
 await expect(administrationMutate(people.adminA.client,randomUUID(),{...command,status:'active'})).rejects.toMatchObject({status:409,code:'REVISION_CONFLICT'});
 await expect(administrationMutate(people.adminB.client,randomUUID(),command)).rejects.toMatchObject({status:403,code:'ADMIN_REQUIRED'});
 await expect(administrationMutate(people.adminA.client,randomUUID(),{...command,memberId:people.adminA.id})).rejects.toMatchObject({status:403,code:'SELF_CHANGE_FORBIDDEN'});
 await expect(administrationMutate(people.adminA.client,randomUUID(),{...command,memberId:people.adminB.id})).rejects.toMatchObject({status:404,code:'NOT_FOUND'});
 const role=await admin.from('users').select('role,is_active').eq('id',people.staff.id).single();expect(role.error).toBeNull();expect(role.data).toEqual({role:'doctor',is_active:true});
 const view=await administrationView(people.adminA.client,wA);expect(view.counts.activeStaff).toBe(1);expect(view.audit).toHaveLength(1);
 expect(await administrationMutate(people.adminA.client,randomUUID(),{...command,status:'active',expectedRevision:1})).toMatchObject({revision:2,status:'active'});
});
it('staff cannot self-promote or invoke administration and direct membership writes remain denied',async()=>{
 await expect(administrationView(people.staff.client,wA)).rejects.toMatchObject({status:403,code:'ADMIN_REQUIRED'});
 const command={action:'set_status',workspaceId:wA,memberId:people.staff.id,expectedRevision:2,status:'active'};
 const direct=await people.staff.client.rpc('workspace_admin_mutate',{k:randomUUID(),command});expect(direct.error?.message).toBe('ADMIN_REQUIRED');
 const write=await people.staff.client.from('workspace_memberships').update({role:'admin'}).eq('workspace_id',wA).eq('user_id',people.staff.id);expect(write.error?.code).toBe('42501');
 const role=await admin.from('workspace_memberships').select('role,revision').eq('workspace_id',wA).eq('user_id',people.staff.id).single();expect(role.error).toBeNull();expect(role.data).toEqual({role:'doctor',revision:2});
});
