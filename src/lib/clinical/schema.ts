import type { ClinicalSnapshot } from '@/lib/contracts/clinical';
const obj = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new Error('CLINICAL_SCHEMA'); return v as Record<string, unknown>; };
const exact = (v: Record<string, unknown>, keys: string[]) => { if (Object.keys(v).sort().join() !== keys.sort().join())
    throw new Error('CLINICAL_SCHEMA'); };
const text = (v: unknown, max: number, nullable = true) => { if (v === null && nullable)
    return; if (typeof v !== 'string' || v.length > max)
    throw new Error('CLINICAL_SCHEMA'); };
const arr = (v: unknown, max: number): unknown[] => { if (!Array.isArray(v) || v.length > max)
    throw new Error('CLINICAL_SCHEMA'); return v; };
const units: Record<string, string[]> = { bp_systolic: ['mmHg'], bp_diastolic: ['mmHg'], heart_rate: ['bpm'], respiratory_rate: ['breaths/min'], temperature: ['°C', '°F'], spo2: ['%'], weight: ['kg'], height: ['cm'], glucose: ['mg/dL', 'mmol/L'], hba1c: ['%'] };
export function validateClinicalSnapshot(value: unknown): asserts value is ClinicalSnapshot {
    const s = obj(value);
    exact(s, ['chief_complaint', 'physical_examination', 'symptoms', 'diagnosis', 'medications', 'lab_tests_ordered', 'vitals', 'clinical_summary']);
    if (JSON.stringify(s).length > 65536)
        throw new Error('CLINICAL_SCHEMA');
    for (const k of ['chief_complaint', 'physical_examination', 'clinical_summary'])
        text(s[k], 8000);
    for (const k of ['symptoms', 'diagnosis', 'lab_tests_ordered'])
        for (const v of arr(s[k], 50)) {
            text(v, 500, false);
            if (!(v as string).trim())
                throw new Error('CLINICAL_SCHEMA');
        }
    const ids = new Set<string>();
    for (const item of arr(s.medications, 30)) {
        const m = obj(item);
        exact(m, ['id', 'name', 'dose', 'frequency', 'duration', 'route', 'instructions', 'unknownFields']);
        if (typeof m.id !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(m.id) || ids.has(m.id))
            throw new Error('CLINICAL_SCHEMA');
        ids.add(m.id);
        text(m.name, 200, false);
        if (!(m.name as string).trim())
            throw new Error('CLINICAL_SCHEMA');
        const unknown = arr(m.unknownFields, 4);
        if (unknown.some(f => !['dose', 'frequency', 'duration', 'route'].includes(String(f))))
            throw new Error('CLINICAL_SCHEMA');
        for (const f of ['dose', 'frequency', 'duration', 'route', 'instructions']) {
            text(m[f], 1000);
            if (unknown.includes(f) && m[f] !== null)
                throw new Error('CLINICAL_SCHEMA');
        }
    }
    for (const item of arr(s.vitals, 20)) {
        const v = obj(item);
        exact(v, ['name', 'value', 'unit', 'observedAt']);
        if (typeof v.name !== 'string' || !Object.hasOwn(units, v.name) || typeof v.unit !== 'string' || !units[v.name].includes(v.unit) || v.value !== null && (typeof v.value !== 'number' || !Number.isFinite(v.value) || v.value < 0 || v.value > 10000))
            throw new Error('CLINICAL_SCHEMA');
        text(v.observedAt, 40);
        if (v.observedAt !== null && Number.isNaN(Date.parse(v.observedAt as string)))
            throw new Error('CLINICAL_SCHEMA');
    }
}
