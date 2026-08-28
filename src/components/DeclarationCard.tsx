import React from 'react';
import { DeclarationItem } from '../types/inspection';
import { formatFieldLabel } from '../utils/bbox';
import { Eye, FileImage, CheckCircle2, Crosshair } from 'lucide-react';

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
      className={`group relative rounded-2xl border p-4.5 transition-all duration-200 flex flex-col justify-between ${
        isSelected
          ? 'border-indigo-600 bg-indigo-50/60 shadow-sm ring-2 ring-indigo-500/40 dark:bg-indigo-950/30 dark:border-indigo-500'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700'
      }`}
    >
      <div className="space-y-3">
        {/* Top: FIELD label + CONFIDENCE pill */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {formatFieldLabel(declaration.field)}
          </span>

          {confidencePercent !== null && (
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 size={11} className="stroke-[2.5]" />
              <span>{confidencePercent}% conf.</span>
            </div>
          )}
        </div>

        {/* VALUE */}
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block">
            Extracted Value
          </span>
          <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white break-words bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 font-mono">
            {declaration.value || <span className="text-slate-400 font-sans italic">Not detected</span>}
          </div>
        </div>

        {/* IMAGE REFERENCE & SPATIAL TAG */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            <FileImage size={12} className="text-indigo-600 dark:text-indigo-400" />
            Image {declaration.image_index ?? 1}
          </span>
          {hasBbox && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700">
              <Crosshair size={11} />
              [{declaration.bbox?.join(',')}]
            </span>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end">
        <button
          type="button"
          onClick={() => onViewEvidence && onViewEvidence(declaration)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors focus:outline-none"
        >
          <Eye size={14} />
          <span>Inspect Evidence</span>
        </button>
      </div>
    </div>
  );
};
