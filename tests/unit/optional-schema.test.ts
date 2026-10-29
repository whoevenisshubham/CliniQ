import {afterEach,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {optionalSchema} from '@/lib/server/optional-schema';
import {ocrReady} from '@/lib/server/ocr/service';
import {runOCRJob} from '@/lib/server/ocr/runner';
afterEach(()=>vi.unstubAllEnvs());
it('disabled OCR needs no new schema RPC or table, including explicit worker dispatch',async()=>{vi.stubEnv('OCR_ENABLED','false');const rpc=vi.fn(()=>{throw Error('New schema must not be needed');}),admin={rpc} as unknown as SupabaseClient;expect(await ocrReady(admin)).toBe(false);expect(await runOCRJob(admin,'synthetic-job')).toEqual({status:'unavailable'});expect(rpc).not.toHaveBeenCalled();});
it('missing RPC/cache, network errors and wrong optional revision fail closed despite enabled flag',async()=>{vi.stubEnv('OCR_ENABLED','true');for(const rpc of [vi.fn(async()=>({data:null,error:{code:'PGRST202'}})),vi.fn(async()=>{throw Error('Network unavailable');}),vi.fn(async()=>({data:{ocr:0,speech:0},error:null}))]){const c={rpc} as unknown as SupabaseClient;expect(await ocrReady(c)).toBe(false);expect(await runOCRJob(c,'synthetic-job')).toEqual({status:'unavailable'});expect(rpc).toHaveBeenNthCalledWith(1,'optional_capabilities');expect(rpc).toHaveBeenNthCalledWith(2,'optional_capabilities');expect(rpc).toHaveBeenCalledTimes(2);}const c={rpc:vi.fn(async()=>({data:{ocr:1,speech:0},error:null}))} as unknown as SupabaseClient;expect(await optionalSchema(c,'ocr')).toBe(true);expect(await optionalSchema(c,'speech')).toBe(false);});
