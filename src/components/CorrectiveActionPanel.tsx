import React from 'react';
import { ViolationItem } from '../types/inspection';
import { formatFieldLabel } from '../utils/bbox';
import {
  Wrench,
  CheckCircle2,
  Crosshair,
  Scale,
  MapPin,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Printer,
  FileCheck,
} from 'lucide-react';

interface CorrectiveActionPanelProps {
  violations: ViolationItem[];
  onJumpToEvidence?: (violation: ViolationItem) => void;
}

/**
 * Returns practical statutory corrective guidance based on field and violation reason
 */
function getCorrectiveGuidance(violation: ViolationItem): string {
  const f = (violation.field || '').toLowerCase();
  const r = (violation.reason || '').toLowerCase();

  if (f.includes('quantity') || r.includes('unit')) {
    return 'Declare net quantity with mandatory metric SI unit symbol (g, kg, ml, or l) with space between numeral and symbol (e.g. "250 g"). Ensure numeral height complies with Schedule II minimum font height standards for the package area.';
  }
  if (f.includes('mrp') || f.includes('unit_sale_price') || r.includes('unit sale')) {
    return 'Print the Unit Sale Price (USP) clearly adjacent to the Maximum Retail Price (MRP) in standard format: "₹X.XX per g" or "₹X.XX per ml" in font size not less than prescribed under Rule 6(11) of PCR 2011.';
  }
  if (f.includes('date') || f.includes('expiry') || r.includes('month')) {
    return 'Format date of manufacture/packaging in standard statutory format: "MM/YYYY" or "Month and Year" on principal display panel alongside "Best Before" duration.';
  }
  if (f.includes('fssai') || r.includes('license')) {
    return 'Display 14-digit FSSAI License Number with FSSAI statutory logo and green/brown Veg/Non-Veg icon conforming to FSSAI Packaging & Labelling Regulations 2018.';
  }
  if (f.includes('consumer') || f.includes('care') || r.includes('grievance')) {
    return 'Provide complete consumer grievance redressal contact including telephone number, verified email address, and postal address of designated grievance officer.';
  }
  if (f.includes('manufacturer') || f.includes('packer') || r.includes('address')) {
    return 'Provide full registered corporate entity name and complete physical address (including premise, locality, city, state, and pincode) of manufacturer or packer.';
  }

  return 'Rectify packaging declaration to strictly satisfy statutory requirements of Legal Metrology (Packaged Commodities) Rules, 2011 before commercial market release.';
}

export const CorrectiveActionPanel: React.FC<CorrectiveActionPanelProps> = ({
  violations,
  onJumpToEvidence,
}) => {
  const hasViolations = violations && violations.length > 0;

  return (
    <div
      id="corrective-action-plan"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Wrench size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Statutory Corrective Action Plan
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                {hasViolations ? `${violations.length} Actions Required` : '0 Actions Required'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Actionable remediation directives answering what failed, why it failed, and legal remediation steps
            </p>
          </div>
        </div>

        {hasViolations && (
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer self-end sm:self-auto"
          >
            <Printer size={13} />
            <span>Print Action Notice</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-5 sm:p-6">
        {hasViolations ? (
          <div className="space-y-4">
            {violations.map((v, idx) => {
              const evidence = v.evidence;
              const hasBbox = Array.isArray(evidence?.bbox) && evidence.bbox.length === 4;
              const correctiveText = getCorrectiveGuidance(v);

              return (
                <div
                  key={`${v.field}-${v.rule_id}-${idx}`}
                  id={`corrective-directive-${v.field}`}
                  className="p-5 rounded-2xl border border-amber-200/80 bg-amber-50/30 dark:bg-amber-950/15 dark:border-amber-900/40 space-y-4 transition-all duration-150"
                >
                  {/* Title & Rule header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 dark:border-amber-900/40 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-mono font-bold">
                        {idx + 1}
                      </span>
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        {formatFieldLabel(v.field)}
                      </h4>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                        <Scale size={11} />
                        Rule {v.rule_id}
                      </span>
                    </div>

                    {onJumpToEvidence && (
                      <button
                        type="button"
                        id={`inspect-evidence-${v.rule_id}-${v.field}`}
                        onClick={() => onJumpToEvidence(v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white shadow-2xs transition-colors cursor-pointer self-start sm:self-auto focus:outline-none focus:ring-2 focus:ring-teal-500"
                        title={`Inspect evidence for ${formatFieldLabel(v.field)}`}
                      >
                        <Crosshair size={13} className="stroke-[2.2]" />
                        <span>Inspect Evidence Location</span>
                      </button>
                    )}
                  </div>

                  {/* 5-Question Clarity Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* 1. What failed? */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block flex items-center gap-1">
                        <AlertTriangle size={11} />
                        1. What Failed?
                      </span>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatFieldLabel(v.field)} statutory declaration
                      </div>
                    </div>

                    {/* 2. Why did it fail? */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block flex items-center gap-1">
                        <AlertTriangle size={11} />
                        2. Why Did It Fail?
                      </span>
                      <div className="text-slate-700 dark:text-slate-300 font-medium">
                        {v.reason}
                      </div>
                    </div>

                    {/* 3. Where is the evidence? */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 block flex items-center gap-1">
                        <MapPin size={11} />
                        3. Where Is The Evidence?
                      </span>
                      <div className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                        Surface {evidence?.image_index ?? 1} • Value: "{evidence?.value ?? 'N/A'}"
                        {hasBbox && ` • [${evidence?.bbox?.join(', ')}]`}
                      </div>
                    </div>

                    {/* 4. What rule applies? */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 block flex items-center gap-1">
                        <Scale size={11} />
                        4. What Rule Applies?
                      </span>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        Rule {v.rule_id} — Legal Metrology (Packaged Commodities) Rules, 2011
                      </div>
                    </div>
                  </div>

                  {/* 5. What should be corrected? (Remedy Directive) */}
                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/80 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <Lightbulb size={13} className="text-emerald-600 dark:text-emerald-400" />
                      5. What Should Be Corrected? (Statutory Remedy)
                    </span>
                    <p className="text-xs text-emerald-950 dark:text-emerald-100 font-medium leading-relaxed pl-5">
                      {correctiveText}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-emerald-50/40 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-2">
            <CheckCircle2 size={36} className="mx-auto text-emerald-600 dark:text-emerald-400 stroke-[2.2]" />
            <h4 className="text-base font-bold text-emerald-900 dark:text-emerald-300">
              No Corrective Action Required
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 max-w-md mx-auto">
              This package exhibits zero non-compliance infractions under the Legal Metrology (Packaged Commodities) Rules 2011 and is fully authorized for trade.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
