// ─── Medical Report Generator ─────────────────────────────────────────────────
// Generates a styled HTML consultation report and opens it in a new tab
// for print / save-as-PDF. Zero external dependencies.

interface ReportData {
    patientName: string;
    consultationId: string;
    doctorName?: string;
    startedAt?: string;
    endedAt?: string;
    durationMs?: number;
    chiefComplaint?: string;
    symptoms?: string[];
    vitals?: Record<string, string | number>;
    physicalExamination?: string;
    diagnosis?: string[];
    icdCodes?: Array<{ code: string; description: string }>;
    medications?: Array<{
        name: string;
        dose?: string;
        frequency?: string;
        duration?: string;
        route?: string;
    }>;
    labTestsOrdered?: string[];
    clinicalSummary?: string;
    patientSummary?: string;
    safetyAlerts?: Array<{ title: string; severity: string; acknowledged: boolean }>;
    billing?: {
        items: Array<{ description: string; fee: number }>;
        subtotal: number;
        gst: number;
        total: number;
    };
}

export function generateMedicalReport(data: ReportData): void {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
    });

    const durationMin = data.durationMs
        ? Math.round(data.durationMs / 60000)
        : null;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Medical Report — ${data.patientName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px;
      color: #1a1a1a;
      background: #fff;
      line-height: 1.6;
      padding: 0;
    }

    .page {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 48px;
    }

    /* ─── Header ─── */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header-left h1 {
      font-size: 22px;
      font-weight: 700;
      color: #1e40af;
      letter-spacing: -0.3px;
    }
    .header-left p {
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
      font-size: 11px;
      color: #6b7280;
    }
    .header-right .doc-name {
      font-weight: 600;
      color: #1a1a1a;
      font-size: 13px;
    }

    /* ─── Patient Info Bar ─── */
    .patient-bar {
      display: flex;
      gap: 24px;
      background: #f0f7ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }
    .patient-bar .field {
      display: flex;
      flex-direction: column;
    }
    .patient-bar .field-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #6b7280;
      font-weight: 600;
    }
    .patient-bar .field-value {
      font-size: 13px;
      font-weight: 600;
      color: #1e40af;
    }

    /* ─── Sections ─── */
    .section {
      margin-bottom: 18px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #2563eb;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .section-body {
      padding-left: 4px;
    }

    /* ─── Lists ─── */
    ul { padding-left: 18px; }
    li { margin-bottom: 2px; }

    /* ─── Vitals Grid ─── */
    .vitals-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 8px;
    }
    .vital-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 8px 10px;
    }
    .vital-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #9ca3af;
      font-weight: 600;
    }
    .vital-value {
      font-size: 15px;
      font-weight: 700;
      color: #1a1a1a;
    }

    /* ─── Medications Table ─── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th {
      background: #f3f4f6;
      text-align: left;
      padding: 6px 10px;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 6px 10px;
      border-bottom: 1px solid #f3f4f6;
    }

    /* ─── Alerts ─── */
    .alert-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 6px;
      margin-bottom: 4px;
      font-size: 12px;
    }
    .alert-critical { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }
    .alert-high { background: #fff7ed; border: 1px solid #fdba74; color: #9a3412; }
    .alert-medium { background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; }
    .alert-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    }
    .dot-critical { background: #ef4444; }
    .dot-high { background: #f97316; }
    .dot-medium { background: #eab308; }

    /* ─── Billing ─── */
    .billing-total {
      display: flex;
      justify-content: space-between;
      font-weight: 700;
      font-size: 14px;
      padding-top: 6px;
      border-top: 2px solid #1e40af;
      margin-top: 4px;
      color: #1e40af;
    }

    /* ─── Footer ─── */
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .footer-left {
      font-size: 10px;
      color: #9ca3af;
    }
    .footer-right {
      text-align: right;
    }
    .signature-line {
      width: 180px;
      border-bottom: 1px solid #1a1a1a;
      margin-bottom: 4px;
      margin-left: auto;
    }
    .signature-label {
      font-size: 10px;
      color: #6b7280;
    }

    /* ─── Patient Summary Box ─── */
    .patient-summary {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 12px;
      color: #166534;
      line-height: 1.7;
    }
    .patient-summary-title {
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
      color: #15803d;
    }

    /* ─── Print Styles ─── */
    @media print {
      body { padding: 0; }
      .page { padding: 24px 32px; }
      .no-print { display: none !important; }
    }

    /* ─── Print Button ─── */
    .print-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #1e40af;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 10px;
      z-index: 100;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .print-bar button {
      padding: 8px 20px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-print {
      background: #fff;
      color: #1e40af;
    }
    .btn-print:hover {
      background: #f0f7ff;
    }
    .print-bar span {
      color: #bfdbfe;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <!-- Print controls -->
  <div class="print-bar no-print">
    <span>📋 Medical Report Ready</span>
    <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>

  <div class="page" style="margin-top: 52px;">
    <!-- HEADER -->
    <div class="header">
      <div class="header-left">
        <h1>CliniQ</h1>
        <p>AI-Powered Clinical Report · Smart EMR System</p>
      </div>
      <div class="header-right">
        <p class="doc-name">${data.doctorName ?? "Dr. Arjun Sharma"}</p>
        <p>MBBS, MD (General Medicine)</p>
        <p>Reg. No: MH-12345</p>
      </div>
    </div>

    <!-- PATIENT INFO -->
    <div class="patient-bar">
      <div class="field">
        <span class="field-label">Patient</span>
        <span class="field-value">${data.patientName}</span>
      </div>
      <div class="field">
        <span class="field-label">Date</span>
        <span class="field-value">${dateStr}</span>
      </div>
      <div class="field">
        <span class="field-label">Time</span>
        <span class="field-value">${timeStr}</span>
      </div>
      ${durationMin ? `
      <div class="field">
        <span class="field-label">Duration</span>
        <span class="field-value">${durationMin} min</span>
      </div>` : ""}
      <div class="field">
        <span class="field-label">Consultation ID</span>
        <span class="field-value" style="font-size:10px;font-family:monospace">${data.consultationId.substring(0, 8)}</span>
      </div>
    </div>

    <!-- CHIEF COMPLAINT -->
    ${data.chiefComplaint ? `
    <div class="section">
      <div class="section-title">Chief Complaint</div>
      <div class="section-body">
        <p>${data.chiefComplaint}</p>
      </div>
    </div>` : ""}

    <!-- SYMPTOMS -->
    ${data.symptoms && data.symptoms.length > 0 ? `
    <div class="section">
      <div class="section-title">Symptoms</div>
      <div class="section-body">
        <ul>
          ${data.symptoms.map((s) => `<li>${s}</li>`).join("\n          ")}
        </ul>
      </div>
    </div>` : ""}

    <!-- VITALS -->
    ${data.vitals && Object.keys(data.vitals).length > 0 ? `
    <div class="section">
      <div class="section-title">Vitals</div>
      <div class="vitals-grid">
        ${Object.entries(data.vitals)
                .filter(([, v]) => v !== "" && v !== null && v !== undefined)
                .map(([k, v]) => `
        <div class="vital-card">
          <div class="vital-label">${k.replace(/_/g, " ")}</div>
          <div class="vital-value">${v}</div>
        </div>`).join("")}
      </div>
    </div>` : ""}

    <!-- PHYSICAL EXAMINATION -->
    ${data.physicalExamination ? `
    <div class="section">
      <div class="section-title">Physical Examination</div>
      <div class="section-body">
        <p>${data.physicalExamination}</p>
      </div>
    </div>` : ""}

    <!-- DIAGNOSIS -->
    ${data.diagnosis && data.diagnosis.length > 0 ? `
    <div class="section">
      <div class="section-title">Diagnosis</div>
      <div class="section-body">
        <ul>
          ${data.diagnosis.map((d) => `<li><strong>${d}</strong></li>`).join("\n          ")}
        </ul>
        ${data.icdCodes && data.icdCodes.length > 0 ? `
        <p style="margin-top:6px;font-size:11px;color:#6b7280">
          ICD-10: ${data.icdCodes.map((c) => `${c.code} (${c.description})`).join(", ")}
        </p>` : ""}
      </div>
    </div>` : ""}

    <!-- MEDICATIONS -->
    ${data.medications && data.medications.length > 0 ? `
    <div class="section">
      <div class="section-title">Prescribed Medications</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Medication</th>
            <th>Dose</th>
            <th>Frequency</th>
            <th>Duration</th>
            <th>Route</th>
          </tr>
        </thead>
        <tbody>
          ${data.medications.map((m, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${m.name}</strong></td>
            <td>${m.dose ?? "—"}</td>
            <td>${m.frequency ?? "—"}</td>
            <td>${m.duration ?? "—"}</td>
            <td>${m.route ?? "Oral"}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}

    <!-- LAB TESTS -->
    ${data.labTestsOrdered && data.labTestsOrdered.length > 0 ? `
    <div class="section">
      <div class="section-title">Lab Tests Ordered</div>
      <div class="section-body">
        <ul>
          ${data.labTestsOrdered.map((t) => `<li>${t}</li>`).join("\n          ")}
        </ul>
      </div>
    </div>` : ""}

    <!-- SAFETY ALERTS -->
    ${data.safetyAlerts && data.safetyAlerts.length > 0 ? `
    <div class="section">
      <div class="section-title">⚠ Safety Alerts</div>
      <div class="section-body">
        ${data.safetyAlerts.map((a) => `
        <div class="alert-row alert-${a.severity}">
          <div class="alert-dot dot-${a.severity}"></div>
          <span>${a.title}</span>
          ${a.acknowledged ? '<span style="margin-left:auto;font-size:10px;color:#16a34a">✓ Acknowledged</span>' : ''}
        </div>`).join("")}
      </div>
    </div>` : ""}

    <!-- CLINICAL SUMMARY -->
    ${data.clinicalSummary ? `
    <div class="section">
      <div class="section-title">Clinical Summary</div>
      <div class="section-body">
        <p>${data.clinicalSummary}</p>
      </div>
    </div>` : ""}

    <!-- PATIENT SUMMARY (in simple language) -->
    ${data.patientSummary ? `
    <div class="section">
      <div class="patient-summary">
        <div class="patient-summary-title">📝 Patient's Summary (in simple language)</div>
        <p>${data.patientSummary}</p>
      </div>
    </div>` : ""}

    <!-- BILLING -->
    ${data.billing && data.billing.total > 0 ? `
    <div class="section">
      <div class="section-title">Billing Summary</div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th style="text-align:right">Fee (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${data.billing.items.map((item) => `
          <tr>
            <td>${item.description}</td>
            <td style="text-align:right">₹${item.fee.toFixed(2)}</td>
          </tr>`).join("")}
          <tr>
            <td>GST (18%)</td>
            <td style="text-align:right">₹${data.billing.gst.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      <div class="billing-total">
        <span>Total</span>
        <span>₹${data.billing.total.toFixed(2)}</span>
      </div>
    </div>` : ""}

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-left">
        <p>Generated by CliniQ Smart EMR</p>
        <p>Report ID: ${data.consultationId.substring(0, 8)} · ${dateStr} ${timeStr}</p>
        <p style="margin-top:4px;font-size:9px">This is a computer-generated report. Verify with a healthcare provider.</p>
      </div>
      <div class="footer-right">
        <div class="signature-line"></div>
        <p class="signature-label">${data.doctorName ?? "Dr. Arjun Sharma"}</p>
        <p class="signature-label">Signature</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const reportWindow = window.open("", "_blank");
    if (reportWindow) {
        reportWindow.document.write(html);
        reportWindow.document.close();
    }
}
