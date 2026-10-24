import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { configureOfflineActor,enqueueOfflineEntry,getOfflineQueue,syncEntry } from "@/lib/offline-queue";
let data:Map<string,string>;
beforeEach(()=>{
 data=new Map([['nexusmd_offline_queue','[{"transcript":"legacy preserved"}]']]);
 vi.stubGlobal('window',{});vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)});
 vi.stubGlobal('fetch',vi.fn());
});
afterEach(()=>{configureOfflineActor(null);vi.unstubAllGlobals();});
const draft={consultationId:'synthetic',patientName:'Synthetic',transcript:'Synthetic source transcript for isolation',durationMs:100};
it('does not read/import or overwrite unscoped legacy data, and requires explicit actor opt-in',()=>{
 configureOfflineActor('actor-a');expect(getOfflineQueue()).toEqual([]);expect(enqueueOfflineEntry(draft)).toBe('');
 expect(data.get('nexusmd_offline_queue')).toBe('[{"transcript":"legacy preserved"}]');
 expect(data.has('cliniq:offline:actor-a')).toBe(false);
});
it('actor switching and logout hide other drafts while preserving their stored data',()=>{
 data.set('cliniq:offline-opt-in:actor-a','true');configureOfflineActor('actor-a');enqueueOfflineEntry(draft);expect(getOfflineQueue()).toHaveLength(1);
 configureOfflineActor('actor-b');expect(getOfflineQueue()).toEqual([]);
 configureOfflineActor(null);expect(getOfflineQueue()).toEqual([]);expect(data.has('cliniq:offline:actor-a')).toBe(true);
 configureOfflineActor('actor-a');expect(getOfflineQueue()[0].actorId).toBe('actor-a');
});
it('does not transmit a queued transcript or claim persisted sync through the old extraction endpoint',async()=>{
 data.set('cliniq:offline-opt-in:actor-a','true');configureOfflineActor('actor-a');enqueueOfflineEntry(draft);
 expect(await syncEntry(getOfflineQueue()[0])).toBe(false);expect(fetch).not.toHaveBeenCalled();expect(getOfflineQueue()[0].synced).toBe(false);
});
