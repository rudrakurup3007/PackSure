import React from 'react';
import { ViolationItem } from '../types/inspection';
import { StatusBadge } from './StatusBadge';
import { formatFieldLabel, isValidBbox } from '../utils/bbox';
import { Scale, AlertCircle, AlertTriangle, FileSearch, Crosshair, CheckCircle2, ShieldAlert } from 'lucide-react';

interface ViolationCardProps {
  violation: ViolationItem;
  onViewEvidence?: (violation: ViolationItem) => void;
  isSelected?: boolean;
}

export const ViolationCard: React.FC<ViolationCardProps> = ({
  violation,
  onViewEvidence,
  isSelected = false,
}) => {
  const evidence = violation.evidence;
  const hasBbox = isValidBbox(evidence?.bbox);

  // Determine severity based on rule type / status
  const isCritical =
    violation.rule_id?.includes('R9') ||
    violation.field?.includes('mrp') ||
    violation.field?.includes('quantity');
  const severityLabel = isCritical ? 'CRITICAL' : 'MAJOR';

  return (
    <div
      id={`violation-card-${violation.field}`}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isSelected
          ? 'border-rose-500 bg-rose-50/50 ring-2 ring-rose-400/80 dark:bg-rose-950/40 dark:border-rose-600 shadow-md'
          : 'border-rose-200/90 bg-white hover:border-rose-300 dark:bg-slate-900 dark:border-rose-900/60 dark:hover:border-rose-800 shadow-xs'
      }`}
    >
      <div className="p-5 sm:p-6 space-y-4">
        {/* WHAT IS WRONG: Field Header + Severity + Status + Rule Tag */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-rose-100 dark:border-rose-950/60">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white uppercase">
              {formatFieldLabel(violation.field)}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase border ${
                isCritical
                  ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/60 dark:text-rose-200 dark:border-rose-700'
                  : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700'
              }`}
            >
              <ShieldAlert size={11} />
              {severityLabel}
            </span>
            <StatusBadge status={violation.status || 'NON_COMPLIANT'} size="sm" />
          </div>

          {/* WHICH RULE: Rule Tag */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-rose-100/80 text-rose-950 border border-rose-200 dark:bg-rose-900/50 dark:text-rose-200 dark:border-rose-800 shrink-0 self-start sm:self-auto">
            <Scale size={13} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <span>Rule: {violation.rule_id}</span>
          </div>
        </div>

        {/* WHY IT IS WRONG: Detailed Statutory Reason (Readable directly) */}
        <div className="bg-rose-50/70 dark:bg-rose-950/40 p-3.5 rounded-xl border border-rose-200/90 dark:border-rose-900/60 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-900 dark:text-rose-300 uppercase tracking-wider">
            <AlertCircle size={13} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <span>Non-Compliance Reason</span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-rose-950 dark:text-rose-100 leading-relaxed pl-4">
            {violation.reason}
          </p>
        </div>

        {/* EVIDENCE: Detected Text & Image Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="space-y-1">
            <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px] block">
              Evidence Detected
            </span>
            <div className="font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs break-all">
              {evidence?.value ? (
                `"${evidence.value}"`
              ) : (
                <span className="text-slate-400 font-sans italic">No text found on panel</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px] block">
              Package Surface Location
            </span>
            <div className="font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
              <span>{evidence?.image_index ? `Surface ${evidence.image_index}` : 'Surface reference'}</span>
              {hasBbox ? (
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                  [{evidence?.bbox?.join(', ')}]
                </span>
              ) : (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  Coordinates unavailable
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ACTION: Jump to Evidence */}
        <div className="flex items-center justify-between pt-1">
          {isSelected ? (
            <div
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                hasBbox
                  ? 'text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-900/50 border-rose-200 dark:border-rose-800'
                  : 'text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/50 border-amber-200 dark:border-amber-800'
              }`}
            >
              {hasBbox ? (
                <>
                  <CheckCircle2 size={13} className="text-rose-600 dark:text-rose-400" />
                  <span>Evidence Verified in Viewer</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
                  <span>Location Unavailable (Review)</span>
                </>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
              <FileSearch size={13} className="text-slate-400" />
              <span>PCR 2011 Mandate</span>
            </div>
          )}

          <button
            type="button"
            id={`jump-to-evidence-${violation.rule_id}-${violation.field}`}
            onClick={() => onViewEvidence && onViewEvidence(violation)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 ${
              isSelected
                ? 'bg-rose-700 text-white shadow-xs focus:ring-rose-400'
                : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs focus:ring-rose-400'
            }`}
            title="Trace this violation directly to package surface and bounding coordinate"
          >
            <Crosshair size={14} className="stroke-[2.2]" />
            <span>Jump to Evidence</span>
          </button>
        </div>
      </div>
    </div>
  );
};
