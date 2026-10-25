// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {act,createElement,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {SessionBoundary} from '@/components/shared/SessionBoundary';
import {AuthComplete} from '@/components/shared/AuthComplete';
import {announceSessionChange,reloadSessionDocument,replaceSessionDocument,sessionChangeKey} from '@/lib/client/session-events';
vi.mock('@/lib/client/session-events',async original=>({...await original<typeof import('@/lib/client/session-events')>(),reloadSessionDocument:vi.fn(),replaceSessionDocument:vi.fn()}));
let root:Root|undefined,host:HTMLDivElement|undefined;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());host?.remove();localStorage.clear();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('a cross-tab session change hides mounted private content before requesting document revalidation',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root!.render(createElement(SessionBoundary,null,createElement('div',null,'Synthetic private account content'))));
 await act(async()=>window.dispatchEvent(new StorageEvent('storage',{key:'theme',newValue:'dark'})));expect(host.textContent).toContain('Synthetic private');expect(reloadSessionDocument).not.toHaveBeenCalled();
 await act(async()=>window.dispatchEvent(new StorageEvent('storage',{key:sessionChangeKey,newValue:'random-nonce'})));expect(host.textContent).not.toContain('Synthetic private');expect(host.textContent).toContain('Private content has been hidden');expect(reloadSessionDocument).toHaveBeenCalledTimes(1);
 await act(async()=>window.dispatchEvent(new StorageEvent('storage',{key:sessionChangeKey,newValue:'another-nonce'})));expect(reloadSessionDocument).toHaveBeenCalledTimes(1);
});
it('the session announcement stores only a nonce, never account or clinical data',()=>{announceSessionChange();const nonce=localStorage.getItem(sessionChangeKey);expect(nonce).toMatch(/^[a-f0-9-]{36}$/);expect(localStorage.length).toBe(1);});
it('verified OAuth completion announces one nonce before navigation, including strict effect replay',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root!.render(createElement(StrictMode,null,createElement(AuthComplete,{target:'/patient/reports'}))));
 expect(localStorage.getItem(sessionChangeKey)).toMatch(/^[a-f0-9-]{36}$/);expect(localStorage.length).toBe(1);expect(replaceSessionDocument).toHaveBeenCalledExactlyOnceWith('/patient/reports');expect(host.querySelector('a')?.getAttribute('href')).toBe('/patient/reports');
});
