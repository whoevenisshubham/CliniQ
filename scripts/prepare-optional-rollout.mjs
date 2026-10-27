// Read-only packaging: no DB/API client, credentials, migration executor or reset.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {loadMigrationPlan} from './migration-plan.mjs';
const root=process.cwd(),accepted=JSON.parse(readFileSync('docs/rollout/accepted-schema.json','utf8')),plan=loadMigrationPlan(root);
for(const [file,hash] of Object.entries(accepted.migrations))if(plan.manifest[file]?.committedSha256!==hash||!plan.manifest[file]?.matchesCommitted)throw Error('ACCEPTED_SCHEMA_DRIFT: '+file);
const files=Object.keys(plan.manifest).filter(f=>!Object.hasOwn(accepted.migrations,f));
if(files.join('|')!=='supabase/migrations/202610250001_reviewable_ocr.sql|supabase/migrations/202610250002_disabled_live_speech.sql|supabase/migrations/202610260001_bounded_speech_acceptance.sql|supabase/migrations/202610260002_streamed_speech_receipt.sql|supabase/migrations/202610260003_ai_raw_receipts.sql|supabase/migrations/202610270001_live_segment_checkpoints.sql|supabase/migrations/202610270002_clinical_meaning.sql'||files.some(f=>!plan.manifest[f].matchesCommitted))throw Error('UNREVIEWED_ADDITIVE_PLAN');
const report={sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),targetProjectRef:'vjlbulywfkixfdsibqgc',scope:'prepared only; no remote connection or enablement',accepted,executionOrder:files.map(file=>({file,...plan.manifest[file]})),newAllowanceRows:0,readOnlyPreflight:'scripts/optional-rollout-preflight.sql',readOnlyPostflight:'scripts/optional-rollout-postflight.sql',rollback:'Disable optional flags and use compatible app; never destructive down migration/reset/provisioning rerun'};
mkdirSync('tests/infra/.runtime',{recursive:true});writeFileSync('tests/infra/.runtime/optional-rollout.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
