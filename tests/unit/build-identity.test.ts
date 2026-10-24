import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {GET} from '@/app/api/build/route';
vi.mock('node:fs',()=>({readFileSync:vi.fn()}));
afterEach(()=>vi.resetAllMocks());
it('public build identity exposes only valid source/parser identifiers, even if an artifact contains other fields',async()=>{
 vi.mocked(readFileSync).mockReturnValue(JSON.stringify({sourceSha:'a'.repeat(40),parserSha256:'b'.repeat(64),privateDiagnostic:'must never leave the server'}));
 const response=GET();expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.json()).toEqual({sourceSha:'a'.repeat(40),parserSha256:'b'.repeat(64)});
});
it('missing or malformed artifact identity remains explicitly unavailable',async()=>{
 vi.mocked(readFileSync).mockReturnValue('{"sourceSha":"unverified text","parserSha256":"bad"}');expect(await GET().json()).toEqual({sourceSha:'unavailable',parserSha256:'unavailable'});
 vi.mocked(readFileSync).mockImplementation(()=>{throw Error('private read failure');});expect(await GET().text()).not.toContain('private read failure');
});
