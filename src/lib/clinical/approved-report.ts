import type { ClinicalSnapshot } from "@/lib/contracts/clinical";
// The existing report-generator.ts supplies the print-document pattern. Every
// interpolated value is escaped here; no HTML notes or external fonts/scripts.
export function escapeReport(value: unknown) { return String(value ?? "Unknown").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }
export function approvedReport(record: {
    id: string;
    reviewed_at: string;
    source_revision: number;
    snapshot: ClinicalSnapshot;
    amended_from_id?: string | null;
}) {
    const e = escapeReport, s = record.snapshot;
    const list = (a: string[]) => a.length ? a.map(x => `<li>${e(x)}</li>`).join('') : '<li>Not recorded</li>';
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CLINIQ+ approved record</title><style>body{font:16px/1.6 system-ui;max-width:850px;margin:40px auto;padding:20px;color:#172d2a}h1,h2{line-height:1.2}table{width:100%;border-collapse:collapse}td,th{padding:10px;border:1px solid #aaa;text-align:left;overflow-wrap:anywhere}p{white-space:pre-wrap;overflow-wrap:anywhere}@media print{body{margin:0}}</style><body><h1>Approved consultation record</h1><p>Educational synthetic-data product</p><p>Version ${e(record.id)} · reviewed ${e(record.reviewed_at)} · source revision ${e(record.source_revision)}</p>${record.amended_from_id ? `<p>Amends approved version ${e(record.amended_from_id)}. The previous version is retained.</p>` : ''}<h2>Chief complaint</h2><p>${e(s.chief_complaint)}</p><h2>Reported symptoms</h2><ul>${list(s.symptoms)}</ul><h2>Clinician assessment</h2><ul>${list(s.diagnosis)}</ul><h2>Examination</h2><p>${e(s.physical_examination)}</p><h2>Measurements</h2><ul>${s.vitals.map(v => `<li>${e(v.name)}: ${e(v.value)} ${e(v.unit)} · ${e(v.observedAt)}</li>`).join('') || '<li>Not recorded</li>'}</ul><h2>Prescriptions</h2><table><thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Route</th><th>Instructions</th></tr></thead><tbody>${s.medications.map(m => `<tr><td>${e(m.name)}</td><td>${e(m.dose)}</td><td>${e(m.frequency)}</td><td>${e(m.duration)}</td><td>${e(m.route)}</td><td>${e(m.instructions)}</td></tr>`).join('') || '<tr><td colspan="6">None recorded</td></tr>'}</tbody></table><h2>Tests ordered</h2><ul>${list(s.lab_tests_ordered)}</ul><h2>Clinician summary</h2><p>${s.clinical_summary ? e(s.clinical_summary) : 'Not recorded. No generated explanation is available.'}</p></body></html>`;
}
