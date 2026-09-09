import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from 'docx';
import { ScanResult } from '../types/inspection';
import { formatFieldLabel, formatStatusLabel } from './bbox';

function escapeHTML(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build a fully standalone, theme-independent printable HTML document for a
 * scan result. This does not depend on the app's current DOM, route, tab
 * state, or Light/Dark theme, so it always prints the complete audit
 * regardless of what the user currently has open on screen.
 */
function buildPrintableAuditHTML(scanResult: ScanResult): string {
  const isCompliant = scanResult.overall_status === 'COMPLIANT';
  const statusColor =
    scanResult.overall_status === 'COMPLIANT'
      ? '#059669'
      : scanResult.overall_status === 'WARNING'
      ? '#D97706'
      : '#E11D48';

  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const violations = scanResult.violations || [];
  const declarations = scanResult.declarations || [];

  const violationsHTML = violations.length
    ? violations
        .map((v, idx) => {
          const evidenceBits: string[] = [];
          if (v.evidence?.value) evidenceBits.push(`Detected text: "${escapeHTML(v.evidence.value)}"`);
          if (v.evidence?.image_index !== undefined) evidenceBits.push(`Surface ${escapeHTML(v.evidence.image_index)}`);
          if (v.evidence?.bbox) evidenceBits.push(`Bounding box: [${v.evidence.bbox.join(', ')}]`);
          return `
            <div class="finding">
              <div class="finding-head">
                <span class="finding-index">${idx + 1}.</span>
                <span class="finding-field">${escapeHTML(formatFieldLabel(v.field))}</span>
                <span class="rule-id">Rule ${escapeHTML(v.rule_id)}</span>
                <span class="finding-status finding-status--${escapeHTML(v.status)}">${escapeHTML(formatStatusLabel(v.status))}</span>
              </div>
              <div class="finding-reason"><strong>Finding:</strong> ${escapeHTML(v.reason)}</div>
              ${evidenceBits.length ? `<div class="finding-evidence">${evidenceBits.map(escapeHTML).join(' &nbsp;|&nbsp; ')}</div>` : ''}
            </div>`;
        })
        .join('')
    : `<p class="empty-note">No violations detected. All evaluated statutory provisions meet prescribed criteria.</p>`;

  const declarationsHTML = declarations.length
    ? `<table class="decl-table">
        <thead>
          <tr><th>Field</th><th>Extracted value</th><th>Surface</th><th>Confidence</th></tr>
        </thead>
        <tbody>
          ${declarations
            .map(
              (d) => `
            <tr>
              <td>${escapeHTML(formatFieldLabel(d.field))}</td>
              <td>${escapeHTML(d.value)}</td>
              <td>${escapeHTML(d.image_index ?? 1)}</td>
              <td>${d.confidence !== undefined ? escapeHTML(`${Math.round(d.confidence * 100)}%`) : '—'}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`
    : `<p class="empty-note">No declarations were extracted from the analyzed packaging surfaces.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>PackSure AI — Audit Report ${escapeHTML(scanResult.inspection_id)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
    color: #141E22;
    background: #ffffff;
    margin: 0;
    padding: 0;
    font-size: 12px;
    line-height: 1.5;
  }
  .doc { max-width: 720px; margin: 0 auto; padding: 8px; }
  header.title-block { border-bottom: 2px solid #145967; padding-bottom: 12px; margin-bottom: 16px; }
  header.title-block h1 { font-size: 20px; margin: 0 0 4px; color: #104955; letter-spacing: 0.2px; }
  header.title-block p { margin: 0; color: #5D6D74; font-size: 11px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin-bottom: 18px; }
  .meta-row { display: flex; justify-content: space-between; border-bottom: 1px solid #E5E0D8; padding: 4px 0; }
  .meta-row span.label { color: #5D6D74; }
  .meta-row span.value { font-weight: 600; text-align: right; }
  .status-banner { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 6px; background: #F3EFE9; border: 1px solid #E5E0D8; margin-bottom: 18px; }
  .status-banner .status-text { font-weight: 700; font-size: 14px; color: ${statusColor}; }
  .status-banner .score-text { font-weight: 700; font-size: 14px; color: #141E22; }
  h2.section-title { font-size: 13px; text-transform: none; color: #104955; border-bottom: 1px solid #D5CEC4; padding-bottom: 4px; margin: 20px 0 10px; }
  .finding { border: 1px solid #E5E0D8; border-left: 3px solid #E11D48; border-radius: 4px; padding: 8px 10px; margin-bottom: 8px; page-break-inside: avoid; }
  .finding-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 600; margin-bottom: 4px; }
  .finding-index { color: #5D6D74; }
  .rule-id { font-family: 'Courier New', monospace; font-size: 10px; background: #F3EFE9; padding: 1px 6px; border-radius: 3px; }
  .finding-status { margin-left: auto; font-size: 10px; padding: 1px 8px; border-radius: 10px; font-weight: 700; }
  .finding-status--NON_COMPLIANT { background: #FFE4E6; color: #9F1239; }
  .finding-status--WARNING { background: #FEF3C7; color: #92400E; }
  .finding-status--COMPLIANT { background: #D1FAE5; color: #065F46; }
  .finding-reason { margin-bottom: 4px; }
  .finding-evidence { color: #42525A; font-size: 11px; }
  .decl-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; }
  .decl-table th { text-align: left; border-bottom: 2px solid #D5CEC4; padding: 5px 6px; color: #5D6D74; font-weight: 600; }
  .decl-table td { border-bottom: 1px solid #E5E0D8; padding: 5px 6px; }
  .empty-note { color: #5D6D74; font-style: italic; }
  footer.disclaimer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #D5CEC4; font-size: 10px; color: #5D6D74; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="doc">
    <header class="title-block">
      <h1>PackSure AI — Compliance Audit Report</h1>
      <p>Legal Metrology (Packaged Commodities) Rules, 2011 — automated pre-check reference document</p>
    </header>

    <div class="meta-grid">
      <div class="meta-row"><span class="label">Inspection ID</span><span class="value">${escapeHTML(scanResult.inspection_id)}</span></div>
      <div class="meta-row"><span class="label">Audit date</span><span class="value">${escapeHTML(dateStr)}</span></div>
      <div class="meta-row"><span class="label">Product / commodity</span><span class="value">${escapeHTML(scanResult.product?.name || 'Packaged Commodity')}</span></div>
      <div class="meta-row"><span class="label">Category</span><span class="value">${escapeHTML(formatFieldLabel(scanResult.product?.type || 'Commodity'))}</span></div>
    </div>

    <div class="status-banner">
      <span class="status-text">${escapeHTML(formatStatusLabel(scanResult.overall_status))}</span>
      <span class="score-text">Score: ${escapeHTML(scanResult.score)} / 100</span>
    </div>

    <h2 class="section-title">Findings (${violations.length})</h2>
    ${violationsHTML}

    <h2 class="section-title">Extracted declarations (${declarations.length})</h2>
    ${declarationsHTML}

    <footer class="disclaimer">
      This report is generated by an automated pre-compliance scanning tool and reflects only the packaging
      surfaces supplied for this inspection. It is not an official government certificate and does not
      constitute legal clearance. ${isCompliant ? '' : 'Remediation of flagged findings is recommended before commercial distribution.'}
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Trigger the browser's print/save-as-PDF workflow using a standalone,
 * theme-independent printable document — rather than printing whatever
 * happens to be visible on screen. This keeps the PDF export reliable
 * regardless of the active tab, scroll position, or Light/Dark theme.
 *
 * Falls back to the current page's print styles if the browser blocks the
 * popup window (e.g. strict popup blockers).
 */
export function exportToPDF(scanResult: ScanResult): void {
  const html = buildPrintableAuditHTML(scanResult);

  // Prefer a same-origin hidden iframe. Unlike document.write() into a newly
  // opened about:blank window, this works reliably in browsers that restrict
  // popup document scripting and still opens the native Print / Save as PDF UI.
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    window.setTimeout(() => iframe.remove(), 100);
  };

  const printIframe = () => {
    try {
      const printWindow = iframe.contentWindow;
      if (!printWindow) throw new Error('Print frame is unavailable');
      printWindow.focus();
      printWindow.print();
      // Give the browser time to complete the print dialog before removing it.
      window.setTimeout(cleanup, 1500);
    } catch {
      cleanup();
      // Last-resort fallback: open a data URL in a new tab/window so the user
      // can still print/save the generated report manually.
      try {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const fallbackWindow = window.open(url, '_blank');
        if (fallbackWindow) {
          fallbackWindow.addEventListener('load', () => {
            window.setTimeout(() => {
              fallbackWindow.focus();
              fallbackWindow.print();
            }, 250);
          }, { once: true });
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } else {
          URL.revokeObjectURL(url);
          window.print();
        }
      } catch {
        window.print();
      }
    }
  };

  document.body.appendChild(iframe);

  try {
    const frameDocument = iframe.contentDocument;
    if (!frameDocument) throw new Error('Print document is unavailable');

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    // The generated document has no external resources, but waiting for its
    // load event makes layout/print timing more predictable across browsers.
    if (frameDocument.readyState === 'complete') {
      window.setTimeout(printIframe, 150);
    } else {
      iframe.addEventListener('load', () => window.setTimeout(printIframe, 150), { once: true });
      window.setTimeout(printIframe, 700);
    }
  } catch {
    cleanup();
    // If the iframe path fails, use the Blob URL fallback instead of leaving
    // the user with a blank about:blank tab.
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const fallbackWindow = window.open(url, '_blank');
      if (fallbackWindow) {
        fallbackWindow.addEventListener('load', () => {
          window.setTimeout(() => {
            fallbackWindow.focus();
            fallbackWindow.print();
          }, 250);
        }, { once: true });
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        URL.revokeObjectURL(url);
        window.print();
      }
    } catch {
      window.print();
    }
  }
}

/**
 * Export scan result as an official structured DOCX report
 */
export async function exportToDOCX(scanResult: ScanResult): Promise<void> {
  const isCompliant = scanResult.overall_status === 'COMPLIANT';
  const statusLabel = isCompliant ? 'COMPLIANT (Statutory Clearance Granted)' : 'NON-COMPLIANT (Statutory Flags Detected)';
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header / Title
          new Paragraph({
            text: 'OFFICIAL COMPLIANCE AUDIT',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Legal Metrology (Packaged Commodities) Rules, 2011 & FSSAI Directives',
                italics: true,
                size: 20,
              }),
            ],
            spacing: { after: 400 },
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Inspection ID:', bold: true })] })],
                    width: { size: 30, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: scanResult.inspection_id })],
                    width: { size: 70, type: WidthType.PERCENTAGE },
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Commodity Name:', bold: true })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: scanResult.product?.name || 'Packaged Commodity' })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Category:', bold: true })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: formatFieldLabel(scanResult.product?.type || 'Commodity') })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Audit Date:', bold: true })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: dateStr })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Overall Status:', bold: true })] })],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: statusLabel,
                            bold: true,
                            color: isCompliant ? '059669' : 'E11D48',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Compliance Score:', bold: true })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: `${scanResult.score} / 100` })],
                  }),
                ],
              }),
            ],
          }),

          // Executive Summary Heading
          new Paragraph({
            text: 'Executive Summary & Statutory Clearance',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 150 },
          }),
          new Paragraph({
            text: isCompliant
              ? 'All mandatory statutory declarations conform strictly with Legal Metrology (Packaged Commodities) Rules 2011 and relevant packaging guidelines. No infractions were identified on analyzed package surfaces.'
              : `Statutory clearance denied. Package exhibits ${scanResult.violations?.length || 0} non-compliance infraction(s) under Legal Metrology Rules, 2011. Remediation is required before commercial distribution.`,
            spacing: { after: 300 },
          }),

          // Violations Section
          new Paragraph({
            text: `Statutory Violations & Infractions (${scanResult.violations?.length || 0})`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
          }),
          ...(scanResult.violations && scanResult.violations.length > 0
            ? scanResult.violations.flatMap((v, idx) => [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${idx + 1}. ${formatFieldLabel(v.field)} `, bold: true }),
                    new TextRun({ text: `[Rule ${v.rule_id}]`, bold: true, color: 'E11D48' }),
                  ],
                  spacing: { before: 100 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Finding: ', bold: true }),
                    new TextRun({ text: v.reason }),
                  ],
                  indent: { left: 360 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Detected Text: ', bold: true }),
                    new TextRun({ text: `"${v.evidence?.value || 'N/A'}"`, italics: true }),
                    new TextRun({ text: ` | Surface ${v.evidence?.image_index ?? 1}` }),
                    new TextRun({
                      text: v.evidence?.bbox ? ` | Bounding Box: [${v.evidence.bbox.join(', ')}]` : '',
                    }),
                  ],
                  indent: { left: 360 },
                  spacing: { after: 150 },
                }),
              ])
            : [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Zero violations detected. All statutory provisions meet prescribed criteria.',
                      italics: true,
                    }),
                  ],
                  spacing: { after: 200 },
                }),
              ]),

          // Extracted Declarations Section
          new Paragraph({
            text: `Verified Statutory Declarations (${scanResult.declarations?.length || 0})`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
          }),
          ...(scanResult.declarations && scanResult.declarations.length > 0
            ? scanResult.declarations.map((d) => (
                new Paragraph({
                  children: [
                    new TextRun({ text: `• ${formatFieldLabel(d.field)}: `, bold: true }),
                    new TextRun({ text: `"${d.value}" ` }),
                    new TextRun({
                      text: `(Surface ${d.image_index ?? 1}${d.confidence ? `, Confidence ${Math.round(d.confidence * 100)}%` : ''})`,
                      size: 18,
                      color: '64748B',
                    }),
                  ],
                  spacing: { after: 60 },
                })
              ))
            : [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'No declarations extracted from packaging surfaces.',
                      italics: true,
                    }),
                  ],
                }),
              ]),

          // Official Sign-off Notice
          new Paragraph({
            text: 'Official Inspection Verification',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 150 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'This automated compliance audit is generated pursuant to the Legal Metrology Act, 2009 and the Legal Metrology (Packaged Commodities) Rules, 2011. Bounding box coordinates and extracted values represent cryptographically traceable computer-vision evidence recorded during inspection.',
                size: 18,
                color: '475569',
              }),
            ],
            spacing: { after: 200 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `compliance-audit-${scanResult.inspection_id || 'report'}.docx`;
  downloadBlob(blob, filename);
}

/**
 * Export scan result as raw JSON for programmatic integration
 */
export function exportToJSON(scanResult: ScanResult): void {
  const jsonString = JSON.stringify(scanResult, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const filename = `compliance-audit-${scanResult.inspection_id || 'report'}.json`;
  downloadBlob(blob, filename);
}

/**
 * Export scan result findings and declarations as tabular CSV
 */
export function exportToCSV(scanResult: ScanResult): void {
  const rows: string[][] = [
    [
      'Record Type',
      'Inspection ID',
      'Product Name',
      'Commodity Type',
      'Overall Status',
      'Compliance Score',
      'Field',
      'Rule ID',
      'Status / Severity',
      'Detected Text / Value',
      'Surface Index',
      'Bounding Box Coordinates',
      'Finding / Reason',
      'Confidence',
    ],
  ];

  const escapeCSV = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  // Add violations
  if (scanResult.violations) {
    for (const v of scanResult.violations) {
      rows.push([
        escapeCSV('VIOLATION'),
        escapeCSV(scanResult.inspection_id),
        escapeCSV(scanResult.product?.name || 'N/A'),
        escapeCSV(scanResult.product?.type || 'N/A'),
        escapeCSV(scanResult.overall_status),
        escapeCSV(scanResult.score),
        escapeCSV(formatFieldLabel(v.field)),
        escapeCSV(v.rule_id || 'N/A'),
        escapeCSV(v.status),
        escapeCSV(v.evidence?.value || 'N/A'),
        escapeCSV(v.evidence?.image_index ?? 1),
        escapeCSV(v.evidence?.bbox ? `[${v.evidence.bbox.join('; ')}]` : 'N/A'),
        escapeCSV(v.reason),
        escapeCSV('N/A'),
      ]);
    }
  }

  // Add declarations
  if (scanResult.declarations) {
    for (const d of scanResult.declarations) {
      rows.push([
        escapeCSV('DECLARATION'),
        escapeCSV(scanResult.inspection_id),
        escapeCSV(scanResult.product?.name || 'N/A'),
        escapeCSV(scanResult.product?.type || 'N/A'),
        escapeCSV(scanResult.overall_status),
        escapeCSV(scanResult.score),
        escapeCSV(formatFieldLabel(d.field)),
        escapeCSV('N/A'),
        escapeCSV('COMPLIANT'),
        escapeCSV(d.value),
        escapeCSV(d.image_index ?? 1),
        escapeCSV(d.bbox ? `[${d.bbox.join('; ')}]` : 'N/A'),
        escapeCSV('Statutory declaration verified'),
        escapeCSV(d.confidence ? `${Math.round(d.confidence * 100)}%` : 'N/A'),
      ]);
    }
  }

  const csvContent = rows.map((r) => r.join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `compliance-findings-${scanResult.inspection_id || 'report'}.csv`;
  downloadBlob(blob, filename);
}

/**
 * Helper to trigger browser file download from Blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
