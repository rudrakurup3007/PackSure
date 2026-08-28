import React, { useState, useEffect } from 'react';
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
import { formatFieldLabel } from '../utils/bbox';
import {
  Package,
  FileText,
  AlertOctagon,
  CheckCircle2,
  PlusCircle,
  Hash,
  Tag,
  Crosshair,
  ShieldCheck,
  Building2,
} from 'lucide-react';

interface ResultsDashboardProps {
  scanResult: ScanResult;
  uploadedImages: UploadedImageFile[];
  onNewInspection: () => void;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  scanResult,
  uploadedImages,
  onNewInspection,
}) => {
  // Active target for the spatial Evidence Viewer
  const [selectedTarget, setSelectedTarget] = useState<SelectedEvidenceTarget>(null);

  // Initialize with first violation if available, otherwise first declaration
  useEffect(() => {
    if (scanResult.violations && scanResult.violations.length > 0) {
      const firstV = scanResult.violations[0];
      setSelectedTarget({
        type: 'violation',
        field: firstV.field,
        value: firstV.evidence?.value ?? 'N/A',
        image_index: firstV.evidence?.image_index ?? 1,
        bbox: firstV.evidence?.bbox,
        status: firstV.status,
        rule_id: firstV.rule_id,
        reason: firstV.reason,
      });
    } else if (scanResult.declarations && scanResult.declarations.length > 0) {
      const firstD = scanResult.declarations[0];
      setSelectedTarget({
        type: 'declaration',
        field: firstD.field,
        value: firstD.value,
        image_index: firstD.image_index ?? 1,
        bbox: firstD.bbox,
        confidence: firstD.confidence,
      });
    }
  }, [scanResult]);

  const handleSelectViolation = (v: ViolationItem) => {
    setSelectedTarget({
      type: 'violation',
      field: v.field,
      value: v.evidence?.value ?? 'N/A',
      image_index: v.evidence?.image_index ?? 1,
      bbox: v.evidence?.bbox,
      status: v.status,
      rule_id: v.rule_id,
      reason: v.reason,
    });

    // Smoothly scroll to Evidence Viewer on mobile/small screens if needed
    const viewerElem = document.getElementById('evidence-viewer-container');
    if (viewerElem && window.innerWidth < 1024) {
      viewerElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSelectDeclaration = (d: DeclarationItem) => {
    setSelectedTarget({
      type: 'declaration',
      field: d.field,
      value: d.value,
      image_index: d.image_index ?? 1,
      bbox: d.bbox,
      confidence: d.confidence,
    });

    const viewerElem = document.getElementById('evidence-viewer-container');
    if (viewerElem && window.innerWidth < 1024) {
      viewerElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const violationsCount = scanResult.violations?.length ?? 0;
  const declarationsCount = scanResult.declarations?.length ?? 0;

  return (
    <div id="results-dashboard" className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* 1. OVERALL RESULT HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          {/* Metadata badges row */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs">
              INSPECTION RESULT
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <Hash size={13} className="text-indigo-600 dark:text-indigo-400" />
              ID: {scanResult.inspection_id}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              <Tag size={13} />
              {formatFieldLabel(scanResult.product?.type || 'Commodity')}
            </span>
            <StatusBadge status={scanResult.overall_status} size="sm" />
          </div>

          {/* Product Title & Regulation */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/60 shadow-2xs mt-0.5">
              <Package size={26} className="stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {scanResult.product?.name || 'Packaged Commodity Inspection'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Evaluation results benchmarked against Legal Metrology (Packaged Commodities) Rules 2011
              </p>
            </div>
          </div>
        </div>

        {/* Primary New Inspection CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            id="results-new-inspection-btn"
            type="button"
            onClick={onNewInspection}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-900"
          >
            <PlusCircle size={17} />
            <span>New Inspection</span>
          </button>
        </div>
      </div>

      {/* 2. COMPLIANCE SCORE & STATUS & EVIDENCE TALLY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Radial Compliance Score */}
        <ComplianceScore score={scanResult.score} size="md" />

        {/* Card 2: Overall Compliance Status */}
        <div
          id="overall-status-card"
          className="p-5 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-2xs flex flex-col justify-between"
        >
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">
              Overall Compliance Status
            </span>
            <div>
              <StatusBadge status={scanResult.overall_status} size="lg" />
            </div>
          </div>

          <div className="pt-4 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-medium">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-indigo-600 dark:text-indigo-400" />
              Statutory Threshold:
            </span>
            <span className="font-bold text-slate-900 dark:text-white">Strict PCR 2011</span>
          </div>
        </div>

        {/* Card 3: Evidence Tally Summary */}
        <div
          id="evidence-tally-card"
          className="p-5 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-2xs flex flex-col justify-between"
        >
          <span className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
            Inspection Evidence Tally
          </span>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50">
              <span className="text-2xl sm:text-3xl font-black text-rose-700 dark:text-rose-300 block font-mono">
                {violationsCount}
              </span>
              <span className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-tight">
                Violations Flagged
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 block font-mono">
                {declarationsCount}
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">
                Declarations Extracted
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Analyzed <strong>{uploadedImages.length} package image{uploadedImages.length > 1 ? 's' : ''}</strong>
          </div>
        </div>
      </div>

      {/* 3. VIOLATIONS SECTION (CRITICAL SIH JUDGING VIEW) */}
      <section id="violations-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              <AlertOctagon size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Compliance Violations ({violationsCount})
              </h2>
            </div>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Select "View Evidence" to highlight OCR findings on package
          </span>
        </div>

        {violationsCount > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scanResult.violations.map((violation, idx) => {
              const isSelected =
                selectedTarget?.type === 'violation' &&
                selectedTarget.field === violation.field &&
                selectedTarget.rule_id === violation.rule_id;

              return (
                <ViolationCard
                  key={`${violation.field}-${violation.rule_id}-${idx}`}
                  violation={violation}
                  isSelected={isSelected}
                  onViewEvidence={handleSelectViolation}
                />
              );
            })}
          </div>
        ) : (
          /* Empty state for 0 violations */
          <div
            id="no-violations-empty-state"
            className="p-8 rounded-3xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800 text-center space-y-2.5"
          >
            <CheckCircle2 size={40} className="mx-auto text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
            <h3 className="text-base sm:text-lg font-bold text-emerald-900 dark:text-emerald-300">
              No compliance violations detected
            </h3>
            <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 max-w-lg mx-auto">
              All mandatory statutory declarations evaluated conform strictly with the Legal Metrology (Packaged Commodities) Rules 2011.
            </p>
          </div>
        )}
      </section>

      {/* 4. DECLARATIONS SECTION */}
      <section id="declarations-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              <FileText size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Extracted Statutory Declarations ({declarationsCount})
              </h2>
            </div>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            OCR extracted text & confidence metrics
          </span>
        </div>

        {declarationsCount > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {scanResult.declarations.map((declaration, idx) => {
              const isSelected =
                selectedTarget?.type === 'declaration' &&
                selectedTarget.field === declaration.field;

              return (
                <DeclarationCard
                  key={`${declaration.field}-${idx}`}
                  declaration={declaration}
                  isSelected={isSelected}
                  onViewEvidence={handleSelectDeclaration}
                />
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
            No declarations extracted from the uploaded photographs.
          </div>
        )}
      </section>

      {/* 5. EVIDENCE SPATIAL INSPECTOR VIEWER */}
      <section id="evidence-viewer-section" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5 tracking-tight">
              <Crosshair size={22} className="text-indigo-600 dark:text-indigo-400 stroke-[2.2]" />
              <span>Visual Evidence & Bounding Coordinate Inspector</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Correlating OCR findings and compliance violations directly onto package surfaces
            </p>
          </div>
        </div>

        <EvidenceViewer
          images={uploadedImages}
          activeTarget={selectedTarget}
          onSelectTarget={setSelectedTarget}
        />
      </section>
    </div>
  );
};
