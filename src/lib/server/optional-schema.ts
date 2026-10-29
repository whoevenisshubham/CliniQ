import type {SupabaseClient} from '@supabase/supabase-js';
// No probe is made while disabled. Missing RPC, stale cache or network failure
// means unavailable, never permission to use an optional half-migrated feature.
export async function optionalSchema(client:SupabaseClient,kind:'ocr'|'speech'){
 try{const r=await client.rpc('optional_capabilities');return !r.error&&r.data?.[kind]===1;}catch{return false;}
}
