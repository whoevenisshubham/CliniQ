import 'server-only';
import type {SupabaseClient,PostgrestError} from '@supabase/supabase-js';
import {resolvePrincipal} from '../auth/context';
import {HttpError} from '../http';
import {id} from '../documents/service';
function check(error:PostgrestError|null){
 if(!error)return;
 const statuses:Record<string,number>={AUTH_REQUIRED:401,ADMIN_REQUIRED:403,SELF_CHANGE_FORBIDDEN:403,NOT_FOUND:404,REVISION_CONFLICT:409,IDEMPOTENCY_CONFLICT:409,LAST_ADMIN_REQUIRED:409,ACCOUNT_UNAVAILABLE:409,INVALID_COMMAND:422};
 const status=statuses[error.message]??(['22P02','22003','23514'].includes(error.code)?422:503);
 throw new HttpError(status,status===503?'ADMIN_UNAVAILABLE':error.message,status===503?'Workspace administration is temporarily unavailable.':'This membership change is unavailable. Refresh and review the current workspace assignment.');
}
async function requireAdmin(client:SupabaseClient){const p=await resolvePrincipal(client);if(p.role!=='admin')throw new HttpError(403,'ADMIN_REQUIRED','An active workspace administrator is required.');return p;}
export async function administrationView(client:SupabaseClient,workspace:string){await requireAdmin(client);id(workspace);const r=await client.rpc('workspace_admin_view',{w:workspace});check(r.error);return r.data;}
export async function administrationMutate(client:SupabaseClient,key:string,command:unknown){await requireAdmin(client);id(key);const r=await client.rpc('workspace_admin_mutate',{k:key,command});check(r.error);return r.data;}
export async function administrationOperation(client:SupabaseClient,workspace:string,key:string){await requireAdmin(client);id(workspace);id(key);const r=await client.rpc('workspace_admin_operation',{w:workspace,k:key});check(r.error);return r.data;}
export async function administrationWorkerStatus(client:SupabaseClient,workspace:string){await requireAdmin(client);id(workspace);const r=await client.rpc('workspace_worker_status',{w:workspace});check(r.error);return r.data;}
