import {reportStyles} from './report-style';
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
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CLINIQ+ approved record</title><style>${reportStyles} .page{max-width:850px;margin:0 auto;padding:28px} .clinical-content h2{font-size:14px;margin:22px 0 8px;border-bottom:1px solid #ddd;padding-bottom:5px} .clinical-content p,.clinical-content li{white-space:pre-wrap;overflow-wrap:anywhere} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:8px;text-align:left} @media print{.page{margin:0;padding:0}.print-hint{display:none}}</style><body><div class="page"><header class="header"><div class="header-left"><h1>CLINIQ+</h1><p>Approved consultation record</p></div></header><p class="print-hint">Print / Save as PDF: use the browser print command (Ctrl+P).</p><main class="clinical-content"><p>Educational synthetic-data product</p><p>Version ${e(record.id)} · reviewed ${e(record.reviewed_at)} · source revision ${e(record.source_revision)}</p>${record.amended_from_id ? `<p>Amends approved version ${e(record.amended_from_id)}. The previous version is retained.</p>` : ''}<h2>Chief complaint</h2><p>${e(s.chief_complaint)}</p><h2>Reported symptoms</h2><ul>${list(s.symptoms)}</ul><h2>Clinician assessment</h2><ul>${list(s.diagnosis)}</ul><h2>Examination</h2><p>${e(s.physical_examination)}</p><h2>Measurements</h2><ul>${s.vitals.map(v => `<li>${e(v.name)}: ${e(v.value)} ${e(v.unit)} · ${e(v.observedAt)}</li>`).join('') || '<li>Not recorded</li>'}</ul><h2>Prescriptions</h2><table><thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Route</th><th>Instructions</th></tr></thead><tbody>${s.medications.map(m => `<tr><td>${e(m.name)}</td><td>${e(m.dose)}</td><td>${e(m.frequency)}</td><td>${e(m.duration)}</td><td>${e(m.route)}</td><td>${e(m.instructions)}</td></tr>`).join('') || '<tr><td colspan="6">None recorded</td></tr>'}</tbody></table><h2>Tests ordered</h2><ul>${list(s.lab_tests_ordered)}</ul><h2>Clinician summary</h2><p>${s.clinical_summary ? e(s.clinical_summary) : 'Not recorded. No generated explanation is available.'}</p></main></div></body></html>`;
}
