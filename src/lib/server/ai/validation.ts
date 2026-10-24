import type { Evidence, GroundedAnswer } from '@/lib/contracts/ai';
import { validateProposal, proposalCandidate } from '@/lib/clinical/proposals';
import { validateClinicalSnapshot } from '@/lib/clinical/schema';
import { emptySnapshot } from '@/lib/contracts/clinical';
const object = (x: unknown): Record<string, unknown> => { if (!x || typeof x !== 'object' || Array.isArray(x))
    throw new Error('OUTPUT_SCHEMA'); return x as Record<string, unknown>; };
const keys = (x: Record<string, unknown>, expected: string[]) => { if (Object.keys(x).sort().join() !== expected.sort().join())
    throw new Error('OUTPUT_SCHEMA'); };
const string = (x: unknown, max: number, min = 0): string => { if (typeof x !== 'string' || x.length > max || x.length < min)
    throw new Error('OUTPUT_SCHEMA'); return x; };
const array = (x: unknown, max: number, min = 0): unknown[] => { if (!Array.isArray(x) || x.length > max || x.length < min)
    throw new Error('OUTPUT_SCHEMA'); return x; };
const normalize = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();
// Conservative excerpt mode: preserve the whole source sentence/line, rather
// than asserting that an arbitrary matching substring entails a clinical fact.
const contextText=(s:string)=>normalize(s).replace(/^[“"‘']+|[.!?।”"’']+$/g,'').trim();
function completeContext(value:string,source:string){return contextText(value)===contextText(source)||source.split(/(?<=[.!?।])\s+|\r?\n+/u).some(unit=>contextText(unit)===contextText(value));}
const qualifiedContext=/(?:\b(?:no|not|denies|denied|without|family|history|possible|possibly|suspected|resolved|previously|formerly|stopped|discontinued|rule\s+out|r\/o|patient\s+(?:says|reports)|nahi|nahin|band)\b|नहीं|नही|पारिवारिक|इतिहास|संभव|बंद)/iu;
function numericFidelity(value:string,support:string[]){return numbers(value).every(v=>support.some(s=>numbers(s).some(n=>n.replace(/\s/g,'')===v.replace(/\s/g,''))));}
function preservesNegation(claim: string, support: string) {
    if (/(?:\b(?:no|not|denies|without|nahi|nahin)\b|नहीं|नही)/i.test(claim))
        return true;
    const escaped = normalize(claim).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return !new RegExp('(?:\\b(?:no|not|denies|without|not taking|no longer taking)\\s+' + escaped + '|' + escaped + '\\s+(?:nahi|nahin|नहीं|नही))', 'i').test(normalize(support));
}
const numbers = (s: string) => s.match(/\d+(?:[.,]\d+)?(?:\s*(?:mg|mcg|g\/dL|mmol\/L|mg\/dL|kg|mmHg|°C|°F|%|ml|mL))?/g) ?? [];
export function unsupportedAdvice(q: string) { return /\b(?:should\s+i\s+(?:stop|start|change)|stop\s+taking|increase\s+(?:my\s+)?dose|prescribe|diagnose\s+me|cure\s+my)\b/i.test(q); }
export function parseOutput(text: string, finish: string): unknown { if (finish !== 'stop' || text.length > 50000)
    throw new Error('INCOMPLETE_OUTPUT'); try {
    return JSON.parse(text);
}
catch {
    throw new Error('MALFORMED_OUTPUT');
} }
export function validateAnswer(raw: unknown, sources: Evidence[], definitions: {
    id: string;
    text: string;
}[] = [],question?:string): GroundedAnswer {
    const a = object(raw);
    keys(a, ['schemaVersion', 'answerKind', 'answer', 'facts', 'definitions', 'uncertainties', 'citedSourceIds']);
    if (a.schemaVersion !== '1' || !['grounded', 'insufficient_evidence'].includes(String(a.answerKind)))
        throw new Error('OUTPUT_SCHEMA');
    string(a.answer, 3000);
    const facts = array(a.facts, 12), defs = array(a.definitions, 4);
    array(a.uncertainties, 8).forEach(x => string(x, 500));
    const cited = array(a.citedSourceIds, 12).map(x => string(x, 200));
    if (new Set(cited).size !== cited.length)
        throw new Error('OUTPUT_SCHEMA');
    const supported: string[] = [];
    const referenced = new Set<string>();
    for (const rawFact of facts) {
        const f = object(rawFact);
        keys(f, ['text', 'evidenceIds', 'quotedSupport']);
        const text = string(f.text, 600, 1);
        const ids = array(f.evidenceIds, 4, 1).map(x => string(x, 200, 1));
        const quotes = array(f.quotedSupport, 4, 1);
        const support: string[] = [];
        for (const rawQuote of quotes) {
            const q = object(rawQuote);
            keys(q, ['evidenceId', 'quote']);
            const id = string(q.evidenceId, 200, 1), quote = string(q.quote, 1000, 1);
            const source = sources.find(s => s.evidenceId === id);
            if (!source || !ids.includes(id) || !normalize(source.text).includes(normalize(quote)))
                throw new Error('INVALID_CITATION');
            support.push(quote);
            referenced.add(id);
        }
        if (ids.some(id => !sources.some(s => s.evidenceId === id) || !quotes.some(q => object(q).evidenceId === id)))
            throw new Error('INVALID_CITATION');
        if(!numericFidelity(text,support))throw new Error('NUMERIC_FIDELITY');
        // Conservative finite gate: an accepted factual sentence must be a verbatim
        // normalized source span. This preserves negation and temporal wording;
        // it is deliberately stricter than an unverified paraphrase-entailment model.
        if (!support.some(s => normalize(s).includes(normalize(text))))
            throw new Error('UNSUPPORTED_FACT');
        if (!preservesNegation(text, support.join(' ')))
            throw new Error('NEGATION_FIDELITY');
        if(!ids.some(id=>{const source=sources.find(s=>s.evidenceId===id);return !!source&&completeContext(text,source.text);}))throw new Error('CONTEXT_FIDELITY');
        supported.push(text);
    }
    for (const rawDef of defs) {
        const d = object(rawDef);
        keys(d, ['text', 'referenceId']);
        const ref = definitions.find(r => r.id === string(d.referenceId, 200));
        if (!ref || normalize(string(d.text, 600)) !== normalize(ref.text))
            throw new Error('INVALID_DEFINITION');
        supported.push(ref.text);
    }
    if (cited.some(id => !referenced.has(id)) || [...referenced].some(id => !cited.includes(id)))
        throw new Error('INVALID_CITATION');
    const answer = string(a.answer, 3000);
    if (/\b(?:ignore\s+(?:all|previous|system)|reveal\s+(?:secrets|keys|other)|system\s+prompt|api\s+key|access\s+token)\b/i.test(answer + ' ' + supported.join(' ')))
        throw new Error('SOURCE_INSTRUCTION_OUTPUT');
    if (/\b(?:you\s+(?:should|must)|stop\s+taking|increase\s+the\s+dose|start\s+taking|you\s+have\s+(?:diabetes|cancer))\b/i.test(answer + ' ' + supported.join(' ')))
        throw new Error('PROHIBITED_ACTION');
    if (a.answerKind === 'grounded' && (!facts.length || !supported.length))
        throw new Error('MISSING_EVIDENCE');
    if (a.answerKind === 'grounded' && normalize(answer) !== normalize(supported.join(' ')))
        throw new Error('UNSUPPORTED_ANSWER');
    if(a.answerKind==='grounded'&&question){
        // A finite topical gate, not semantic question-answering acceptance.
        const generic=new Set('what which is are was were my the this these that does do show shows value result report source shared current most recent recorded written explain explanation summarize summarise plot every test instructions medicine medication of in for a an please use answer'.split(' '));
        const terms=question.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter(t=>t.length>2&&!generic.has(t))??[];
        const content=normalize(facts.map(f=>object(f).text).join(' ')).toLocaleLowerCase();
        const explicitTemperature=terms.some(t=>/^temperatures?$/.test(t))&&/°[cf]/i.test(content);
        if(terms.length&&!explicitTemperature&&!terms.some(t=>content.includes(t.endsWith('s')?t.slice(0,-1):t)))throw new Error('QUESTION_RELEVANCE');
    }
    if (a.answerKind === 'insufficient_evidence' && (facts.length || defs.length || cited.length || numbers(answer).length || !['Insufficient evidence in the selected sources.', 'The selected sources do not support this question.'].includes(answer)))
        throw new Error('UNSUPPORTED_ANSWER');
    return raw as GroundedAnswer;
}
export function validateExtraction(raw: unknown, input: {
    baseRevision: number;
    throughSegmentId: string;
    sources: Evidence[];
    draft?: unknown;
}) {
    const p = object(raw);
    keys(p, ['operations']);
    const proposal = validateProposal({ baseRevision: input.baseRevision, throughSegmentId: input.throughSegmentId, operations: p.operations }, input.sources.map(s => ({ id: s.segmentId!, sequence: s.sequence!, text: s.text })));
    const draft = input.draft ?? emptySnapshot();
    validateClinicalSnapshot(draft);
    validateClinicalSnapshot(proposalCandidate(draft, input.baseRevision, proposal).snapshot);
    for (const op of proposal.operations) {
        if (op.op === 'mark_uncertain' || op.op === 'retract_fact')
            continue;
        const evidence = input.sources.filter(s => op.evidence_segment_ids.includes(s.segmentId!)).map(s => s.text).join(' ');
        const values: string[] = [];
        const walk = (v: unknown, key = '') => { if (typeof v === 'string' && !['id'].includes(key))
            values.push(v);
        else if (Array.isArray(v))
            v.forEach(x => walk(x, key));
        else if (v && typeof v === 'object')
            Object.entries(v).forEach(([k, x]) => { if (k !== 'unknownFields')
                walk(x, k); });
        else if (typeof v === 'number')
            values.push(String(v)); };
        walk(op.value);
        if (values.some(v => !normalize(evidence).includes(normalize(v))))
            throw new Error('EXTRACTION_FIDELITY');
        if (values.some(v => !preservesNegation(v, evidence)))
            throw new Error('NEGATION_FIDELITY');
        if(values.some(v=>!numericFidelity(v,[evidence])))throw new Error('NUMERIC_FIDELITY');
        if (op.path === 'diagnosis' && input.sources.filter(s => op.evidence_segment_ids.includes(s.segmentId!)).some(s => s.speaker !== 'clinician'))
            throw new Error('ASSESSMENT_NOT_CLINICIAN_STATED');
        if(op.path==='diagnosis'){
            const units=evidence.split(/(?<=[.!?।])\s+|\r?\n+/u).filter(s=>/^(?:assessment|diagnosis|impression|निदान)\s*:/iu.test(s.trim())).map(s=>s.replace(/^(?:assessment|diagnosis|impression|निदान)\s*:\s*/iu,''));
            if(values.some(v=>!units.some(s=>contextText(v)===contextText(s))))throw new Error('ASSESSMENT_CONTEXT_REQUIRED');
        }
        if(op.path==='medications'&&qualifiedContext.test(evidence))throw new Error('MEDICATION_CONTEXT_REVIEW_REQUIRED');
        if(op.path!=='medications'&&op.path!=='diagnosis'&&qualifiedContext.test(evidence)&&values.some(v=>!completeContext(v,evidence)))throw new Error('CONTEXT_FIDELITY');
    }
    return proposal;
}
