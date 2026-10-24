import {readdirSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
export const migrationConvention=/^(\d{12,14})_[a-z][a-z0-9_]*\.sql$/;
export function activeMigrationNames(names){
 const active=names.filter(name=>migrationConvention.test(name)).sort((a,b)=>a.localeCompare(b));
 if(!active.length)throw new Error('No active versioned migrations');
 const versions=new Set();
 for(const name of active){const version=name.match(migrationConvention)[1];if(versions.has(version))throw new Error('Duplicate migration version: '+version);versions.add(version);}
 return active;
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const normalizeSQL=source=>source.replace(/\r\n/g,'\n');
export function transactionBody(source){const text=normalizeSQL(source).trim();if(!/^(?:--[^\n]*\n|\s)*BEGIN;\n/.test(text)||! /\nCOMMIT;$/.test(text))throw new Error('Active migration must have an explicit transaction wrapper');return text.replace(/^BEGIN;\n/m,'').replace(/\nCOMMIT;$/,'');}
/** @returns {{baseline:string,forward:string,manifest:Record<string,{committedSha256:string|null,workingTreeRawSha256:string,executedLFNormalizedSha256:string,matchesCommitted:boolean}>,hashScope:string}} */
export function loadMigrationPlan(root){
 const paths=['supabase/baseline/001_domain.sql',...activeMigrationNames(readdirSync(path.join(root,'supabase/migrations'))).map(name=>'supabase/migrations/'+name)];
 const entries=paths.map(file=>{const bytes=readFileSync(path.join(root,file));const executed=normalizeSQL(bytes.toString('utf8'));let committed=null;try{committed=execFileSync('git',['show','HEAD:'+file],{cwd:root,stdio:['ignore','pipe','pipe']});}catch{/* Uncommitted additions are labelled, never silently called committed. */}
 return {path:file,sql:executed,evidence:{committedSha256:committed?hash(committed):null,workingTreeRawSha256:hash(bytes),executedLFNormalizedSha256:hash(executed),matchesCommitted:committed?normalizeSQL(committed.toString('utf8'))===executed:false}};
 });
 return {baseline:entries[0].sql,forward:entries.slice(1).map(entry=>transactionBody(entry.sql)).join('\n'),manifest:Object.fromEntries(entries.map(e=>[e.path,e.evidence])),hashScope:'committedSha256: exact git HEAD blob bytes; execution: UTF-8 with CRLF normalized to LF, outer migration transaction wrappers removed for atomic rehearsal'};
}
