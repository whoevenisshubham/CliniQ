import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parseDocument} from '@/lib/server/documents/parser';
import expected from '../fixtures/documents/expected.json';

for(const [name,fixture] of Object.entries(expected)){
 it(`preserves literal source characters, values and page references: ${name}`,async()=>{
  const parsed=await parseDocument(new Uint8Array(readFileSync(new URL('../fixtures/documents/'+name,import.meta.url))),'application/pdf');
  expect(parsed.status).toBe('text_ready');expect(parsed.pages).toBe(2);
  for(const [page,tokens]of fixture.pages.entries()){
   const text=parsed.chunks.filter(c=>c.page===page+1).map(c=>c.text).join(' ').normalize('NFC').replace(/\s+/g,' ').trim();
   for(const token of tokens)expect(text).toContain(token.normalize('NFC').replace(/\s+/g,' ').trim());
  }
 },35000);
}
