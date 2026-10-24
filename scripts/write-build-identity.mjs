import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadMigrationPlan} from './migration-plan.mjs';
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(!/^[a-f0-9]{40}$/.test(sourceSha))throw Error('BUILD_SOURCE_REQUIRED');
const plan=loadMigrationPlan(process.cwd());
if(!Object.values(plan.manifest).every(m=>m.matchesCommitted))throw Error('BUILD_MIGRATIONS_CHANGED');
// Explicit public allowlist; no environment dump, project credential or actor data.
writeFileSync('public/build-identity.json',JSON.stringify({sourceSha,parserSha256:createHash('sha256').update(readFileSync('scripts/document-parser-worker.mjs')).digest('hex'),migrations:Object.fromEntries(Object.entries(plan.manifest).map(([name,m])=>[name,m.committedSha256]))},null,2));
