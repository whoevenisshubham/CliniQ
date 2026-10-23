import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { root, sql, localConfiguration } from './local-supabase.mjs';
import { provisionSyntheticActors } from './setup-demo.mjs';

if (process.argv[2] !== '--apply-local-synthetic') throw new Error('Explicit --apply-local-synthetic required');
localConfiguration();
if (sql("select to_regclass('public.users') is not null") !== 'f') throw new Error('Existing application schema preserved: use existing fixture or a separately named isolated project; no reset permitted');
const base = readFileSync(path.join(root,'supabase/baseline/001_domain.sql'),'utf8');
const forward = readFileSync(path.join(root,'supabase/migrations/202610230001_identity_isolation.sql'),'utf8').replace(/^BEGIN;/m,'').replace(/^COMMIT;/m,'');
const m2 = readFileSync(path.join(root,'supabase/migrations/202610230002_documents_jobs.sql'),'utf8').replace(/^BEGIN;/m,'').replace(/^COMMIT;/m,'');
const m3 = readFileSync(path.join(root,'supabase/migrations/202610230003_approved_records.sql'),'utf8').replace(/^BEGIN;/m,'').replace(/^COMMIT;/m,'');
const legacyPolicies = readFileSync(path.join(root,'tests/fixtures/legacy-policies.sql'),'utf8');
const fresh = sql(`BEGIN;\n${base}\n${forward}\n${m2}\n${m3}\nSELECT json_build_object('users',(select count(*) from public.users),'patients',(select count(*) from public.patients),'memberships',(select count(*) from public.workspace_memberships));\nROLLBACK;`);
assert.deepEqual(JSON.parse(fresh),{users:0,patients:0,memberships:0});
const provision = await provisionSyntheticActors();
const { actors:a } = provision;
const ids = { patientA:randomUUID(),patientB:randomUUID(),visitA:randomUUID(),visitB:randomUUID(),workspaceA:randomUUID(),workspaceB:randomUUID() };
const q = value => "'" + String(value).replaceAll("'","''") + "'";
let fixture = '';
for (const actor of Object.values(a).filter(x=>x.name!=='unlinked')) {
  // Receptionist role is added by the forward migration; historical source enum
  // fixture uses patient until explicit trusted provisioning completes.
  fixture += `INSERT INTO public.users(id,email,name,role) VALUES(${q(actor.appId)},${q(actor.email)},${q('Synthetic '+actor.name)},${q(actor.role==='receptionist'?'patient':actor.role)});\n`;
}
for (const suffix of ['A','B']) {
 fixture += `INSERT INTO public.patients(id,user_id,name,dob,phone) VALUES(${q(ids['patient'+suffix])},${q(a['patient'+suffix].appId)},'Synthetic Patient','1990-01-01','0000000000');
 INSERT INTO public.consultations(id,doctor_id,patient_id,status,chief_complaint) VALUES(${q(ids['visit'+suffix])},${q(a['doctor'+suffix].appId)},${q(ids['patient'+suffix])},'completed','Synthetic historical complaint');
 INSERT INTO public.transcripts(consultation_id,raw_text,segments,language) VALUES(${q(ids['visit'+suffix])},'Synthetic historical Hinglish transcript','[{"id":"stable-segment","text":"synthetic","is_final":true}]','hi');
 INSERT INTO public.emr_entries(consultation_id,chief_complaint,medications) VALUES(${q(ids['visit'+suffix])},'Synthetic reviewed history','[{"name":"Synthetic medicine","dose":"source text"}]');
 INSERT INTO public.prescriptions(consultation_id,patient_id,doctor_id,medication_name) VALUES(${q(ids['visit'+suffix])},${q(ids['patient'+suffix])},${q(a['doctor'+suffix].appId)},'Synthetic medicine');\n`;
}
fixture += `INSERT INTO public.audit_log(consultation_id,event_type,actor_id,actor_role,payload,hash) VALUES(${q(ids.visitA)},'historical_fixture',${q(a.doctorA.appId)},'doctor','{"synthetic":true}','preserve-original-hash');
 INSERT INTO public.billing_drafts(consultation_id,line_items,total) VALUES(${q(ids.visitA)},'[{"name":"Synthetic visit","amount":100}]',100);
 INSERT INTO public.family_members(patient_id,name,relation) VALUES(${q(ids.patientA)},'Synthetic relative','parent');
 INSERT INTO public.health_scores(patient_id,overall_score) VALUES(${q(ids.patientA)},70);
 INSERT INTO public.appointments(patient_id,doctor_id,date,time_slot) VALUES(${q(ids.patientA)},${q(a.doctorA.appId)},'2026-10-23','09:00');
 INSERT INTO public.data_consents(patient_id,purpose,enabled) VALUES(${q(ids.patientA)},'synthetic_fixture',true);
 INSERT INTO public.consent_records(consultation_id,patient_id,consent_type) VALUES(${q(ids.visitA)},${q(ids.patientA)},'written');
 INSERT INTO public.patient_queue(patient_id,patient_name,doctor_id,consultation_id) VALUES(${q(ids.patientA)},'Synthetic Patient',${q(a.doctorA.appId)},${q(ids.visitA)});
 INSERT INTO public.safety_alerts(consultation_id,alert_type,severity,title,description) VALUES(${q(ids.visitA)},'allergy','low','Synthetic notice','Synthetic preserved notice');`;
sql(`BEGIN;\n${base}\n${legacyPolicies}\n${fixture}\nCOMMIT;`);
const columns = JSON.parse(sql(`select json_object_agg(table_name,cols) from (select table_name,string_agg(quote_ident(column_name),',' order by ordinal_position) cols from information_schema.columns where table_schema='public' group by table_name) x`));
const snapshots = () => Object.fromEntries(Object.entries(columns).map(([table,cols]) => [table,JSON.parse(sql(`select json_build_object('rows',count(*),'hash',md5(coalesce(string_agg(row_to_json(x)::text,'|' order by x.id),''))) from (select ${cols} from public.${table}) x`))]));
const before=snapshots();
sql(`BEGIN;\n${forward}\n${m2}\n${m3}\nCOMMIT;`);
const after=snapshots();
assert.deepEqual(after,before,'Forward upgrade changed original IDs or historical values');

// Exact Auth-ID mapping supplied by this explicit provisioning run, never email.
for (const actor of Object.values(a).filter(x=>x.name!=='unlinked')) {
 sql(`update public.users set auth_user_id=${q(actor.authId)},is_active=${actor.name==='disabled'?'false':'true'},role=${q(actor.role)} where id=${q(actor.appId)} and auth_user_id is null`);
}
sql(`insert into public.workspaces(id,name,is_demo) values(${q(ids.workspaceA)},'Synthetic A',true),(${q(ids.workspaceB)},'Synthetic B',true)`);
for (const name of ['doctorA','doctorU','reception','admin','doctorB']) {
 const w=name==='doctorB'?ids.workspaceB:ids.workspaceA;
 sql(`insert into public.workspace_memberships(workspace_id,user_id,role) values(${q(w)},${q(a[name].appId)},${q(a[name].role)})`);
}
for (const s of ['A','B']) {
 sql(`insert into public.care_relationships(patient_id,workspace_id,provider_id,scope,granted_by) values(${q(ids['patient'+s])},${q(ids['workspace'+s])},${q(a['doctor'+s].appId)},'clinical',${q(a['patient'+s].appId)});
 update public.consultations set workspace_id=${q(ids['workspace'+s])} where id=${q(ids['visit'+s])}`);
}
sql(`insert into public.care_relationships(patient_id,workspace_id,provider_id,scope,granted_by) values(${q(ids.patientA)},${q(ids.workspaceA)},${q(a.reception.appId)},'intake',${q(a.patientA.appId)})`);
const target=path.join(root,'tests/infra/.runtime');mkdirSync(target,{recursive:true});
writeFileSync(path.join(target,'fixture.json'),JSON.stringify({actors:a,ids,runId:provision.runId}));
writeFileSync(path.join(target,'preservation.json'),JSON.stringify({timestamp:new Date().toISOString(),sourceSha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),baselineSha256:createHash('sha256').update(base).digest('hex'),migrationSha256:createHash('sha256').update(readFileSync(path.join(root,'supabase/migrations/202610230001_identity_isolation.sql'))).digest('hex'),clinicalMigrationSha256:createHash('sha256').update(readFileSync(path.join(root,'supabase/migrations/202610230003_approved_records.sql'))).digest('hex'),documentMigrationSha256:createHash('sha256').update(readFileSync(path.join(root,'supabase/migrations/202610230002_documents_jobs.sql'))).digest('hex'),databaseVersion:sql('show server_version'),freshBaseline:{users:0,patients:0,memberships:0},before,after,originalFieldsPreserved:true,explicitMappingOnly:true},null,2));
console.log(JSON.stringify({freshBaseline:'passed; no seeded identities',legacyUpgrade:'passed',tablesCompared:Object.keys(before).length,historicalRowsPreserved:Object.values(before).reduce((n,x)=>n+x.rows,0),authAccounts:Object.keys(a).length,credentialOutput:false}));
