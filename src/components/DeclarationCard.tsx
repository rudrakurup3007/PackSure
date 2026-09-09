import React from 'react';
import { DeclarationItem } from '../types/inspection';
import { formatFieldLabel } from '../utils/bbox';
import { FileImage, CheckCircle2, Crosshair } from 'lucide-react';

interface DeclarationCardProps {
  declaration: DeclarationItem;
  onViewEvidence?: (declaration: DeclarationItem) => void;
  isSelected?: boolean;
}

export const DeclarationCard: React.FC<DeclarationCardProps> = ({
  declaration,
  onViewEvidence,
  isSelected = false,
}) => {
  const confidencePercent = declaration.confidence !== undefined
    ? Math.round(declaration.confidence * (declaration.confidence <= 1 ? 100 : 1))
    : null;

  const hasBbox = Array.isArray(declaration.bbox) && declaration.bbox.length === 4;

  return (
    <div
      id={`declaration-card-${declaration.field}`}
      className={`group relative rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between ${
        isSelected
          ? 'border-teal-700 bg-teal-50/60 shadow-md ring-2 ring-teal-500/50 dark:bg-teal-950/40 dark:border-teal-500'
          : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700'
      }`}
    >
      <div className="space-y-3.5">
        {/* Top: FIELD label + CONFIDENCE pill */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {formatFieldLabel(declaration.field)}
          </span>

          {confidencePercent !== null && (
            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 size={11} className="stroke-[2.2] text-emerald-600 dark:text-emerald-400" />
              <span>{confidencePercent}% conf.</span>
            </div>
          )}
        </div>

        {/* VALUE */}
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block">
            Extracted Declaration
          </span>
          <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white break-words bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 font-mono">
            {declaration.value || <span className="text-slate-400 font-sans italic">Not detected</span>}
          </div>
        </div>

        {/* IMAGE REFERENCE & SPATIAL TAG */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            <FileImage size={12} className="text-teal-700 dark:text-teal-400" />
            Surface {declaration.image_index ?? 1}
          </span>
          {hasBbox && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700">
              <Crosshair size={11} />
              [{declaration.bbox?.join(',')}]
            </span>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        {isSelected ? (
          <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-1">
            <CheckCircle2 size={12} className="text-teal-700 dark:text-teal-400" />
            <span>Active in Viewer</span>
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">Mandatory Rule 6(1)</span>
        )}

        <button
          type="button"
          onClick={() => onViewEvidence && onViewEvidence(declaration)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-2 ${
            isSelected
              ? 'bg-teal-800 text-white shadow-xs focus:ring-teal-400'
              : 'bg-teal-50 text-teal-800 hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 focus:ring-teal-400'
          }`}
        >
          <Crosshair size={13} />
          <span>Jump to Evidence</span>
        </button>
      </div>
    </div>
  );
};
