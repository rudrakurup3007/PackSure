import React from 'react';
import { ViolationItem } from '../types/inspection';
import { StatusBadge } from './StatusBadge';
import { formatFieldLabel } from '../utils/bbox';
import { Eye, Scale, AlertCircle, FileSearch, HelpCircle } from 'lucide-react';

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
  const hasBbox = Array.isArray(evidence?.bbox) && evidence.bbox.length === 4;

  return (
    <div
      id={`violation-card-${violation.field}`}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isSelected
          ? 'border-rose-500 bg-rose-50/50 ring-2 ring-rose-400 dark:bg-rose-950/30 dark:border-rose-600 shadow-sm'
          : 'border-rose-200 bg-white hover:border-rose-300 dark:bg-slate-900 dark:border-rose-900/60 dark:hover:border-rose-800 shadow-2xs'
      }`}
    >
      <div className="p-5 space-y-4">
        {/* WHAT IS WRONG: Field Header + Status Badge + Rule Tag */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-100 dark:border-rose-950/60">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">
              {formatFieldLabel(violation.field)}
            </span>
            <StatusBadge status={violation.status || 'NON_COMPLIANT'} size="sm" />
          </div>

          {/* WHICH RULE: Rule Tag */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-100/80 text-rose-900 border border-rose-200 dark:bg-rose-900/50 dark:text-rose-200 dark:border-rose-800 shrink-0 self-start sm:self-auto">
            <Scale size={13} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <span>Rule: {violation.rule_id}</span>
          </div>
        </div>

        {/* WHY IT IS WRONG: Detailed Statutory Reason */}
        <div className="bg-rose-50/70 dark:bg-rose-950/40 p-3.5 rounded-xl border border-rose-200/80 dark:border-rose-900/50 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900 dark:text-rose-300 uppercase tracking-wider">
            <AlertCircle size={14} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <span>Non-Compliance Reason</span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-rose-900 dark:text-rose-200 leading-relaxed pl-5">
            {violation.reason}
          </p>
        </div>

        {/* EVIDENCE: Detected Text & Image Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px] block">
              Evidence Detected
            </span>
            <div className="font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs break-all">
              {evidence?.value ? `"${evidence.value}"` : <span className="text-slate-400 italic">No text found on panel</span>}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px] block">
              Package Source
            </span>
            <div className="font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
              <span>{evidence?.image_index ? `Image ${evidence.image_index}` : 'Surface reference'}</span>
              {hasBbox && (
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                  [{evidence?.bbox?.join(',')}]
                </span>
              )}
            </div>
          </div>
        </div>

        {/* VIEW EVIDENCE: Action Button */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
            <FileSearch size={13} className="text-slate-400" />
            <span>PCR 2011 Mandate</span>
          </div>

          <button
            type="button"
            onClick={() => onViewEvidence && onViewEvidence(violation)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-2xs transition-all focus:outline-none focus:ring-2 focus:ring-rose-400"
            title="Inspect violation evidence on package photograph"
          >
            <Eye size={15} />
            <span>View Evidence</span>
          </button>
        </div>
      </div>
    </div>
  );
};
