import React, { useState, useEffect, useRef } from 'react';
import {
  ScanResult,
  UploadedImageFile,
  SelectedEvidenceTarget,
  ViolationItem,
  DeclarationItem,
} from '../types/inspection';
import { ComplianceScore } from './ComplianceScore';
import { StatusBadge } from './StatusBadge';
import { ViolationCard } from './ViolationCard';
import { DeclarationCard } from './DeclarationCard';
import { EvidenceViewer } from './EvidenceViewer';
import { RuleEvaluationAudit } from './RuleEvaluationAudit';
import { CorrectiveActionPanel } from './CorrectiveActionPanel';
import { formatFieldLabel, isValidBbox } from '../utils/bbox';
import { createSamplePackageFiles } from '../utils/sampleImages';
import {
  exportToPDF,
  exportToDOCX,
  exportToJSON,
  exportToCSV,
} from '../utils/exportReport';
import {
  Package,
  Hash,
  Tag,
  Crosshair,
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Printer,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Braces,
  ClipboardCheck,
  PlusCircle,
} from 'lucide-react';

interface ResultsDashboardProps {
  scanResult?: ScanResult | null;
  uploadedImages?: UploadedImageFile[];
  onStartInspection?: () => void;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  scanResult,
  uploadedImages = [],
  onStartInspection,
}) => {
  // Empty state handling when no scan exists yet
  if (!scanResult) {
    return (
      <div id="audit-report-empty-state" className="max-w-4xl mx-auto py-20 px-4 sm:px-6 lg:px-8 text-center space-y-6 animate-in fade-in duration-200">
        <div className="w-20 h-20 rounded-3xl bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-900/60 flex items-center justify-center mx-auto shadow-sm">
          <ClipboardCheck size={40} className="stroke-[1.8]" />
        </div>
        <div className="space-y-2 max-w-md mx-auto">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Audit report unavailable
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Complete a package inspection to generate an evidence-backed compliance audit.
          </p>
        </div>
        {onStartInspection && (
          <div className="pt-2">
            <button
              id="empty-state-start-inspection-btn"
              type="button"
              onClick={onStartInspection}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white shadow-xs transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <PlusCircle size={16} />
              <span>Start Inspection</span>
            </button>
          </div>
        )}
        <div className="pt-2 flex items-center justify-center gap-6 text-xs text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
            Awaiting Package Data
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
            PCR 2011 Rules Engine Ready
          </span>
        </div>
      </div>
    );
  }

  // Active target for the spatial Evidence Viewer
  const [selectedTarget, setSelectedTarget] = useState<SelectedEvidenceTarget>(null);

  // Active findings tab on the right side: 'violations' | 'declarations'
  const [activeTab, setActiveTab] = useState<'violations' | 'declarations'>(
    (scanResult.violations?.length ?? 0) > 0 ? 'violations' : 'declarations'
  );

  // Export dropdown state
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Ensure package images exist for surfaces 1, 2, 3 even if uploadedImages is initially empty
  const [resolvedImages, setResolvedImages] = useState<UploadedImageFile[]>(uploadedImages);

  useEffect(() => {
    if (uploadedImages && uploadedImages.length > 0) {
      setResolvedImages(uploadedImages);
    } else if (scanResult) {
      createSamplePackageFiles().then((files) => {
        const fallbacks: UploadedImageFile[] = files.map((file, idx) => ({
          file,
          previewUrl: URL.createObjectURL(file),
          index: idx + 1,
          name: file.name,
          size: file.size,
          type: file.type,
          naturalWidth: 600,
          naturalHeight: 600,
        }));
        setResolvedImages(fallbacks);
      }).catch(() => {
        // Safe fallback
      });
    }
  }, [uploadedImages, scanResult]);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize with first violation if available, otherwise first declaration
  useEffect(() => {
    if (scanResult.violations && scanResult.violations.length > 0) {
      const firstV = scanResult.violations[0];
      const validBbox = isValidBbox(firstV.evidence?.bbox) ? firstV.evidence!.bbox : undefined;
      setSelectedTarget({
        type: 'violation',
        field: firstV.field,
        value: firstV.evidence?.value ?? 'N/A',
        image_index: firstV.evidence?.image_index ?? 1,
        bbox: validBbox,
        status: firstV.status,
        rule_id: firstV.rule_id,
        reason: firstV.reason,
      });
      setActiveTab('violations');
    } else if (scanResult.declarations && scanResult.declarations.length > 0) {
      const firstD = scanResult.declarations[0];
      const validBbox = isValidBbox(firstD.bbox) ? firstD.bbox : undefined;
      setSelectedTarget({
        type: 'declaration',
        field: firstD.field,
        value: firstD.value,
        image_index: firstD.image_index ?? 1,
        bbox: validBbox,
        confidence: firstD.confidence,
        status: 'COMPLIANT',
      });
      setActiveTab('declarations');
    }
  }, [scanResult]);

  const focusEvidenceViewer = () => {
    const viewerElem = document.getElementById('evidence-viewer-container');
    if (viewerElem) {
      // Calculate scroll position accounting for sticky top bar on mobile/tablet/desktop
      const rect = viewerElem.getBoundingClientRect();
      const headerOffset = 90;
      const targetScrollY = window.pageYOffset + rect.top - headerOffset;

      try {
        window.scrollTo({
          top: Math.max(0, targetScrollY),
          behavior: 'smooth',
        });
      } catch {
        viewerElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // Safe accessible focus
      try {
        viewerElem.focus({ preventScroll: true });
      } catch {
        // Fallback
      }

      // Visual highlight pulsation ring on the viewer to guide user's attention
      viewerElem.classList.remove('ring-4', 'ring-teal-500/60', 'ring-rose-500/60');
      void viewerElem.offsetWidth;
      viewerElem.classList.add('ring-4', 'ring-teal-500/60');
      setTimeout(() => {
        viewerElem.classList.remove('ring-4', 'ring-teal-500/60');
      }, 1800);
    }
  };

  const handleSelectViolation = (v: ViolationItem) => {
    // 1. Identify the exact ViolationItem from scanResult
    const normalizeRule = (r?: string) =>
      r ? r.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/R0*(\d+)/g, 'R$1') : '';
    const normalizeField = (f?: string) =>
      f ? f.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

    const exactViolation =
      scanResult.violations?.find((item) => {
        if (item === v) return true;
        if (item.field === v.field && item.rule_id === v.rule_id) return true;
        if (v.field && item.field === v.field) return true;
        const normItemRule = normalizeRule(item.rule_id);
        const normVRule = normalizeRule(v.rule_id);
        if (normItemRule && normVRule && normItemRule === normVRule) return true;
        const normItemField = normalizeField(item.field);
        const normVField = normalizeField(v.field);
        if (normItemField && normVField && (normItemField === normVField || normItemField.includes(normVField) || normVField.includes(normItemField))) {
          return true;
        }
        return false;
      }) || v;

    const evidence = exactViolation.evidence || v.evidence;
    const rawImageIndex = evidence?.image_index;

    // Identify confidence from evidence, violation item, or matched declaration
    const matchedDecl = scanResult.declarations?.find((d) => {
      if (d.field === exactViolation.field) return true;
      const normDField = normalizeField(d.field);
      const normVField = normalizeField(exactViolation.field);
      return normDField && normVField && (normDField === normVField || normDField.includes(normVField) || normVField.includes(normDField));
    });

    const confidence =
      (evidence as any)?.confidence ??
      (exactViolation as any)?.confidence ??
      matchedDecl?.confidence;

    const targetImageIndex =
      typeof rawImageIndex === 'number' && rawImageIndex > 0
        ? rawImageIndex
        : (typeof matchedDecl?.image_index === 'number' && matchedDecl.image_index > 0
            ? matchedDecl.image_index
            : 1);

    // Validate bbox: Do not invent coordinates. If missing or invalid, do not pass fake coordinates.
    const rawBbox = evidence?.bbox;
    const validBbox = isValidBbox(rawBbox) ? rawBbox : undefined;

    // 2. Create/update the existing SelectedEvidenceTarget with all required properties
    setSelectedTarget({
      type: 'violation',
      field: exactViolation.field,
      rule_id: exactViolation.rule_id,
      image_index: targetImageIndex,
      bbox: validBbox,
      value: evidence?.value ?? (exactViolation as any).value ?? matchedDecl?.value ?? 'N/A',
      status: exactViolation.status || 'NON_COMPLIANT',
      reason: exactViolation.reason,
      confidence: typeof confidence === 'number' ? confidence : undefined,
    });

    // Switch findings tab to violations
    setActiveTab('violations');

    // 3. Scroll and focus Evidence Viewer on desktop, tablet, and mobile
    focusEvidenceViewer();
  };

  const handleSelectDeclaration = (d: DeclarationItem) => {
    const exactDecl =
      scanResult.declarations?.find(
        (item) => item === d || (item.field === d.field && item.image_index === d.image_index)
      ) || d;

    setSelectedTarget({
      type: 'declaration',
      field: exactDecl.field,
      value: exactDecl.value,
      image_index: exactDecl.image_index ?? 1,
      bbox: exactDecl.bbox,
      confidence: exactDecl.confidence,
      status: 'COMPLIANT',
    });

    setActiveTab('declarations');
    focusEvidenceViewer();
  };

  const violationsCount = scanResult.violations?.length ?? 0;
  const declarationsCount = scanResult.declarations?.length ?? 0;
  const isNonCompliant = scanResult.overall_status === 'NON_COMPLIANT';
  const isCompliant = scanResult.overall_status === 'COMPLIANT';

  return (
    <div id="results-dashboard" className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8 w-full max-w-full min-w-0">
      {/* ========================================================
          PART 1: COMPLIANCE DECISION ABOVE THE FOLD
          ======================================================== */}
      <section
        id="compliance-decision-header"
        className={`rounded-2xl border p-5 sm:p-6 lg:p-8 shadow-xs overflow-hidden transition-all duration-200 w-full max-w-full min-w-0 ${
          isNonCompliant
            ? 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900/60'
            : isCompliant
            ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900/60'
            : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/60'
        }`}
      >
        {/* Top Dominant Header Row: OFFICIAL COMPLIANCE AUDIT + Export Menu */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs">
                OFFICIAL COMPLIANCE AUDIT
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <Hash size={13} className="text-teal-700 dark:text-teal-400" />
                ID: {scanResult.inspection_id}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                <Tag size={13} />
                {formatFieldLabel(scanResult.product?.type || 'Commodity')}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Standard: Legal Metrology (PCR 2011)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>Statutory Inspection Findings</span>
            </h1>
          </div>

          {/* Export Report Action with Popover */}
          <div className="relative self-start sm:self-auto" ref={exportDropdownRef}>
            <button
              id="export-report-dropdown-btn"
              type="button"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white shadow-xs transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500"
              aria-expanded={isExportMenuOpen}
              aria-haspopup="true"
            >
              <Download size={15} />
              <span>Export Report</span>
              <ChevronDown size={14} className={`transition-transform duration-150 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportMenuOpen && (
              <div
                id="export-report-menu-popover"
                role="menu"
                className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80 mb-1">
                  Available Export Formats
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    exportToPDF(scanResult);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Printer size={15} className="text-teal-700 dark:text-teal-400 shrink-0" />
                  <div className="flex flex-col">
                    <span>Save as PDF</span>
                    <span className="text-[10px] text-slate-400 font-normal">Browser print & PDF document</span>
                  </div>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={isExportingDocx}
                  onClick={async () => {
                    try {
                      setIsExportingDocx(true);
                      await exportToDOCX(scanResult);
                    } finally {
                      setIsExportingDocx(false);
                      setIsExportMenuOpen(false);
                    }
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileText size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="flex flex-col">
                    <span>{isExportingDocx ? 'Generating DOCX...' : 'Export DOCX'}</span>
                    <span className="text-[10px] text-slate-400 font-normal">Official Word inspection report</span>
                  </div>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    exportToJSON(scanResult);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Braces size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="flex flex-col">
                    <span>Export JSON</span>
                    <span className="text-[10px] text-slate-400 font-normal">Raw inspection payload</span>
                  </div>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    exportToCSV(scanResult);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="flex flex-col">
                    <span>Export CSV</span>
                    <span className="text-[10px] text-slate-400 font-normal">Spreadsheet tabular findings</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Executive Decision Banner */}
        <div className="pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center w-full max-w-full min-w-0">
          {/* Left / Title area (6 cols on lg, 7 cols on xl) */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-4 min-w-0 w-full max-w-full">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs ${
                  isNonCompliant
                    ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900'
                    : isCompliant
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900'
                    : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900'
                }`}
              >
                {isNonCompliant ? (
                  <AlertOctagon size={32} className="stroke-[2.2]" />
                ) : (
                  <ShieldCheck size={32} className="stroke-[2.2]" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {scanResult.product?.name || 'Packaged Commodity'}
                  </h1>
                  <StatusBadge status={scanResult.overall_status} size="lg" />
                </div>

                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Automated regulatory compliance scan under Legal Metrology (Packaged Commodities) Rules, 2011
                </p>
              </div>
            </div>

            {/* Clear Executive Explanation */}
            <div
              className={`p-4 rounded-xl border text-xs sm:text-sm leading-relaxed font-medium ${
                isNonCompliant
                  ? 'bg-rose-50/70 text-rose-950 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900/60'
                  : isCompliant
                  ? 'bg-emerald-50/70 text-emerald-950 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/60'
                  : 'bg-amber-50/70 text-amber-950 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/60'
              }`}
            >
              {isNonCompliant ? (
                <div className="space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-900 dark:text-rose-200">
                    <ShieldAlert size={15} />
                    <span>Statutory Clearance Denied — {violationsCount} Non-Compliance Infractions Detected</span>
                  </div>
                  <p className="text-xs text-rose-900 dark:text-rose-300">
                    This package fails mandatory statutory provisions under the Legal Metrology (Packaged Commodities) Rules, 2011. Remediation is required before commercial distribution.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200">
                    <CheckCircle2 size={15} />
                    <span>Statutory Clearance Granted — Fully Compliant</span>
                  </div>
                  <p className="text-xs text-emerald-900 dark:text-emerald-300">
                    All mandatory statutory declarations conform strictly with Legal Metrology (Packaged Commodities) Rules 2011 and FSSAI packaging guidelines.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right / Score & Metrics (6 cols on lg, 5 cols on xl) */}
          <div className="lg:col-span-6 xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0 w-full max-w-full">
            {/* Radial Compliance Score Card */}
            <ComplianceScore score={scanResult.score} size="md" />

            {/* Evidence & Violation Metrics Box */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-slate-50/60 dark:bg-slate-800/50 dark:border-slate-800 flex flex-col justify-between space-y-3 overflow-hidden min-w-0 w-full max-w-full">
              <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 truncate block">
                Package Evidence Tally
              </span>

              <div className="grid grid-cols-2 gap-2 min-w-0">
                <div className="p-2 sm:p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/50 min-w-0 overflow-hidden">
                  <span className="text-xl sm:text-2xl font-extrabold text-rose-700 dark:text-rose-300 block font-mono truncate">
                    {violationsCount}
                  </span>
                  <span className="text-[10px] font-bold text-rose-900 dark:text-rose-200 uppercase tracking-tight block truncate">
                    Violations
                  </span>
                </div>

                <div className="p-2 sm:p-3 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-200 dark:border-teal-900/50 min-w-0 overflow-hidden">
                  <span className="text-xl sm:text-2xl font-extrabold text-teal-800 dark:text-teal-300 block font-mono truncate">
                    {declarationsCount}
                  </span>
                  <span className="text-[10px] font-bold text-teal-900 dark:text-teal-200 uppercase tracking-tight block truncate">
                    Declarations
                  </span>
                </div>
              </div>

              <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                Mapped across <strong>{(resolvedImages.length > 0 ? resolvedImages : uploadedImages).length} package surface{(resolvedImages.length > 0 ? resolvedImages : uploadedImages).length > 1 ? 's' : ''}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          PART 2: PROFESSIONAL INVESTIGATION WORKSPACE
          Left: Evidence Viewer (Signature Spatial Inspector)
          Right: Selected Evidence Context + Violations & Declarations
          ======================================================== */}
      <section id="investigation-workspace" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Crosshair size={22} className="text-teal-700 dark:text-teal-400 stroke-[2.2]" />
              <span>Package Compliance Investigation Workspace</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Trace any statutory finding directly to its exact physical location on the package photograph
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Interactive Spatial Binding Active</span>
          </div>
        </div>

        {/* 12-Column Split Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* MAIN LEFT: Evidence Viewer (7 cols) */}
          <div className="lg:col-span-7">
            <EvidenceViewer
              images={resolvedImages.length > 0 ? resolvedImages : uploadedImages}
              activeTarget={selectedTarget}
              onSelectTarget={setSelectedTarget}
              violations={scanResult.violations}
              declarations={scanResult.declarations}
              layoutMode="canvas-only"
            />
          </div>

          {/* MAIN RIGHT: Selected Evidence Context & Finding Cards (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* 1. Selected Evidence Context Card */}
            <div
              id="selected-evidence-context-card"
              className={`rounded-2xl border p-5 transition-all duration-200 shadow-xs ${
                selectedTarget?.status === 'NON_COMPLIANT' || selectedTarget?.type === 'violation'
                  ? 'border-rose-300 bg-rose-50/40 dark:bg-rose-950/30 dark:border-rose-900/60'
                  : 'border-teal-200 bg-teal-50/40 dark:bg-teal-950/30 dark:border-teal-900/60'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${
                      selectedTarget?.status === 'NON_COMPLIANT' || selectedTarget?.type === 'violation'
                        ? 'bg-rose-600'
                        : 'bg-teal-800'
                    }`}
                  >
                    <Crosshair size={14} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-900 dark:text-white">
                      Selected Evidence Context
                    </span>
                  </div>
                </div>

                {selectedTarget?.status ? (
                  <StatusBadge status={selectedTarget.status} size="sm" />
                ) : (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-900 dark:bg-teal-900/60 dark:text-teal-300">
                    DECLARATION
                  </span>
                )}
              </div>

              {selectedTarget ? (
                <div className="pt-3.5 space-y-3">
                  {/* Field Name & Rule */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-base font-extrabold text-slate-900 dark:text-white">
                      {formatFieldLabel(selectedTarget.field)}
                    </div>
                    {selectedTarget.rule_id && (
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-rose-100 text-rose-950 dark:bg-rose-900/60 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
                        Rule {selectedTarget.rule_id}
                      </span>
                    )}
                  </div>

                  {/* Non-compliance reason if violation */}
                  {selectedTarget.reason && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-900/60 text-xs font-medium text-rose-950 dark:text-rose-200">
                      {selectedTarget.reason}
                    </div>
                  )}

                  {/* Detected Value */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Detected Package Text
                    </span>
                    <div className="font-mono text-xs font-bold text-slate-900 dark:text-white break-all">
                      "{selectedTarget.value}"
                    </div>
                  </div>

                  {/* Spatial coordinate binding */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">Surface:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        Surface {selectedTarget.image_index ?? 1}
                      </span>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">Spatial Coordinates:</span>
                      <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                        {isValidBbox(selectedTarget.bbox) ? (
                          `[${selectedTarget.bbox.join(', ')}]`
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-sans font-medium">
                            Unavailable (Review)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Extraction Confidence if present */}
                  {typeof selectedTarget.confidence === 'number' && (
                    <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
                      <span className="text-[10px] uppercase font-semibold text-slate-500">Extraction Confidence:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {(selectedTarget.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}

                  {/* Signature Verification or Unavailable State Banner */}
                  {isValidBbox(selectedTarget.bbox) ? (
                    <div className="pt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                      <span>Evidence Bounding Box Verified on Surface {selectedTarget.image_index ?? 1}</span>
                    </div>
                  ) : (
                    <div className="pt-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-800">
                      <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 stroke-[2.5]" />
                      <span>Coordinates Unavailable — Manual Visual Review on Surface {selectedTarget.image_index ?? 1}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  Select a card below to inspect package evidence
                </div>
              )}
            </div>

            {/* 2. Findings Selection Tabs */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-4">
              {/* Tab Selector */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('violations')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'violations'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <AlertOctagon size={14} />
                  <span>Violations ({violationsCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('declarations')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'declarations'
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <FileText size={14} />
                  <span>Declarations ({declarationsCount})</span>
                </button>
              </div>

              {/* Tab 1: Violations List */}
              {activeTab === 'violations' && (
                <div className="space-y-3.5 max-h-[580px] overflow-y-auto pr-1">
                  {violationsCount > 0 ? (
                    scanResult.violations.map((violation, idx) => {
                      const isSelected =
                        selectedTarget?.field === violation.field &&
                        selectedTarget?.rule_id === violation.rule_id;

                      return (
                        <ViolationCard
                          key={`${violation.field}-${violation.rule_id}-${idx}`}
                          violation={violation}
                          isSelected={isSelected}
                          onViewEvidence={handleSelectViolation}
                        />
                      );
                    })
                  ) : (
                    <div className="p-8 text-center bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-2">
                      <CheckCircle2 size={36} className="mx-auto text-emerald-600 dark:text-emerald-400 stroke-[2.2]" />
                      <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                        Zero Violations Detected
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        All statutory mandates comply with Legal Metrology PCR 2011.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Declarations List */}
              {activeTab === 'declarations' && (
                <div className="space-y-3.5 max-h-[580px] overflow-y-auto pr-1">
                  {declarationsCount > 0 ? (
                    scanResult.declarations.map((declaration, idx) => {
                      const isSelected =
                        selectedTarget?.field === declaration.field &&
                        selectedTarget?.type === 'declaration';

                      return (
                        <DeclarationCard
                          key={`${declaration.field}-${idx}`}
                          declaration={declaration}
                          isSelected={isSelected}
                          onViewEvidence={handleSelectDeclaration}
                        />
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No statutory declarations extracted from image OCR.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          PART 3: DETAILS THIRD — AUDIT & CORRECTIVE ACTION
          ======================================================== */}
      <section id="compliance-details-audit-section" className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
        {/* Corrective Action Panel */}
        <CorrectiveActionPanel
          violations={scanResult.violations || []}
          onJumpToEvidence={handleSelectViolation}
        />

        {/* Statutory Rule Evaluation Matrix */}
        <RuleEvaluationAudit
          scanResult={scanResult}
          onJumpToEvidence={handleSelectViolation}
        />
      </section>
    </div>
  );
};
