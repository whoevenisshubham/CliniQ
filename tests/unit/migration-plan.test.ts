import {it,expect} from 'vitest';
import {activeMigrationNames,transactionBody,loadMigrationPlan} from '../../scripts/migration-plan.mjs';
it('includes future active versions and excludes historical seed/permissive migrations',()=>{
 expect(activeMigrationNames(['003_seed_data.sql','001_nexusmd_schema.sql','202610230001_identity.sql','202701010001_future.sql','20270102090000_later.sql','README.md'])).toEqual(['202610230001_identity.sql','202701010001_future.sql','20270102090000_later.sql']);
 expect(()=>activeMigrationNames(['202701010001_a.sql','202701010001_b.sql'])).toThrow('Duplicate migration version');
});
it('normalizes Windows line endings and preserves the SQL body while validating transaction wrappers',()=>{
 expect(transactionBody('BEGIN;\r\nSELECT 1;\r\nCOMMIT;\r\n')).toBe('SELECT 1;');
 expect(()=>transactionBody('SELECT 1;')).toThrow('transaction wrapper');
});
it('uses exactly the same active paths for execution and evidence with committed hash scope',()=>{
 const plan=loadMigrationPlan(process.cwd());expect(Object.keys(plan.manifest).length).toBeGreaterThan(1);
 expect(plan.forward).toContain('CREATE FUNCTION public.illustrative_billing_review');
 for(const evidence of Object.values(plan.manifest)){expect(evidence.committedSha256).toMatch(/^[a-f0-9]{64}$/);expect(evidence.matchesCommitted).toBe(true);}
 expect(plan.hashScope).toContain('exact git HEAD blob bytes');
});
