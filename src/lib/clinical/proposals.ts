import type { ClinicalSnapshot,Medication } from "@/lib/contracts/clinical";
// MediFlow 45fbfb85 src/lib/emr/{types,merge}.ts operation vocabulary and
// extraction cursor retained. Arbitrary path mutation/index expansion replaced
// by typed top-level operations with exact saved source IDs and revisions.
const fields = ['chief_complaint', 'physical_examination', 'symptoms', 'diagnosis', 'medications', 'lab_tests_ordered', 'vitals', 'clinical_summary'] as const;
type Field = typeof fields[number];
export type ClinicalProposal = {
    baseRevision: number;
    throughSegmentId: string;
    operations: {
        op: 'set_fact' | 'update_fact' | 'retract_fact' | 'mark_uncertain';
        path: Field;
        value?: unknown;
        evidence_segment_ids: string[];
        note?: string;
    }[];
};
const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function validateProposal(raw: unknown, sources: {
    id: string;
    sequence: number;
    text: string;
}[]): ClinicalProposal {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error('INVALID_PROPOSAL');
    const p = raw as Record<string, unknown>;
    if (Object.keys(p).sort().join() !== ['baseRevision', 'operations', 'throughSegmentId'].sort().join() || !Number.isInteger(p.baseRevision) || Number(p.baseRevision) < 0 || !Array.isArray(p.operations) || p.operations.length > 30 || typeof p.throughSegmentId !== 'string')
        throw new Error('INVALID_PROPOSAL');
    const through = sources.find(s => s.id === p.throughSegmentId);
    if (!through)
        throw new Error('INVALID_CURSOR');
    for (const rawOp of p.operations) {
        if (!rawOp || typeof rawOp !== 'object' || Array.isArray(rawOp))
            throw new Error('INVALID_OPERATION');
        const op = rawOp as Record<string, unknown>;
        if (Object.keys(op).some(k => !['op', 'path', 'value', 'evidence_segment_ids', 'note'].includes(k)) || !['set_fact', 'update_fact', 'retract_fact', 'mark_uncertain'].includes(String(op.op)) || !fields.includes(op.path as Field) || !Array.isArray(op.evidence_segment_ids) || !op.evidence_segment_ids.length || op.evidence_segment_ids.length > 10 || op.evidence_segment_ids.some(id => typeof id !== 'string' || !uuid.test(id) || !sources.some(s => s.id === id && s.sequence <= through.sequence)) || typeof op.note !== 'undefined' && (typeof op.note !== 'string' || op.note.length > 500))
            throw new Error('INVALID_OPERATION');
        if (['set_fact', 'update_fact'].includes(String(op.op)) && !Object.hasOwn(op, 'value'))
            throw new Error('INVALID_OPERATION');
    }
    if (JSON.stringify(raw).length > 65536)
        throw new Error('PROPOSAL_TOO_LARGE');
    return structuredClone(raw) as ClinicalProposal;
}
// This builds a review candidate; it never saves/approves. The authoritative
// save applies the DB schema and expected-revision checks again.
export function proposalCandidate(snapshot: ClinicalSnapshot, currentRevision: number, p: ClinicalProposal) {
    if (currentRevision !== p.baseRevision)
        return { state: 'stale' as const, snapshot: structuredClone(snapshot), requiresReview: true, uncertain: [] as string[] };
    const next = structuredClone(snapshot), uncertain: string[] = [];
    for (const op of p.operations) {
        if (op.op === 'mark_uncertain') {
            uncertain.push(op.path);
            continue;
        }
        if (op.op === 'retract_fact') {
            uncertain.push(op.path);
            continue;
        }
        if(op.path==='medications'&&Array.isArray(op.value)){
            const incoming=structuredClone(op.value) as Medication[];
            if(incoming.some(m=>!m||typeof m!=='object')||new Set(incoming.map(m=>m.id)).size!==incoming.length)throw new Error('CLINICAL_SCHEMA');
            // MediFlow 45fbfb85 merge.ts: merge partial medication fields, retain the
            // rest of the row. V2 matches stable IDs instead of mutable indices.
            next.medications=[...next.medications.map(m=>{const delta=incoming.find(n=>n.id===m.id);return delta?{...m,...Object.fromEntries(Object.entries(delta).filter(([,v])=>v!==undefined))}:m;}),...incoming.filter(m=>!next.medications.some(old=>old.id===m.id))];
        }else Object.assign(next, { [op.path]: structuredClone(op.value) });
    }
    return { state: 'review_required' as const, snapshot: next, requiresReview: true, uncertain };
}
