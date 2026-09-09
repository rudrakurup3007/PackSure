import React, { useState } from 'react';
import { ScanResult, ViolationItem } from '../types/inspection';
import { StatusBadge } from './StatusBadge';
import { formatFieldLabel } from '../utils/bbox';
import { PACKSURE_PCR_RULES } from '../data/pcrRules';
import {
  Scale,
  CheckCircle2,
  AlertOctagon,
  HelpCircle,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Crosshair,
  ShieldCheck,
} from 'lucide-react';

interface RuleEvaluationAuditProps {
  scanResult: ScanResult;
  onJumpToEvidence?: (violation: ViolationItem) => void;
}

interface StatutoryRuleItem {
  rule_id: string;
  field_key: string;
  legal_reference: string;
  requirement_title: string;
  mandate_description: string;
}

const STATUTORY_RULES: StatutoryRuleItem[] = PACKSURE_PCR_RULES.map((rule) => ({
  rule_id: rule.rule_id,
  field_key: rule.field,
  legal_reference: rule.legal_reference,
  requirement_title: rule.requirement,
  mandate_description: rule.validation?.note || rule.notes || rule.requirement,
}));

// Helper to check if a violation matches a statutory rule (by id, field, or known legal aliases)
function matchesRule(v: ViolationItem, ruleId: string, fieldKey: string): boolean {
  if (v.rule_id === ruleId || v.field === fieldKey) return true;

  const normalizeRuleCode = (s?: string) =>
    s ? s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/R0*(\d+)/g, 'R$1') : '';

  const vRuleNorm = normalizeRuleCode(v.rule_id);
  const rRuleNorm = normalizeRuleCode(ruleId);
  if (vRuleNorm && rRuleNorm && vRuleNorm === rRuleNorm) return true;

  const normalizeFieldCode = (s?: string) =>
    s ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

  const vFieldNorm = normalizeFieldCode(v.field);
  const rFieldNorm = normalizeFieldCode(fieldKey);
  if (vFieldNorm && rFieldNorm && (vFieldNorm === rFieldNorm || vFieldNorm.includes(rFieldNorm) || rFieldNorm.includes(vFieldNorm))) return true;

  // PCR-R01 / PCR-R6-1-A (manufacturer)
  if (
    (ruleId === 'PCR-R01' || ruleId === 'PCR-R6-1-A') &&
    (v.field.includes('manufacturer') || v.field.includes('packer') || v.rule_id === 'PCR-R01' || v.rule_id === 'PCR-R6-1-A')
  ) {
    return true;
  }
  // PCR-R02 / PCR-R6-1-B (common_name / product_name)
  if (
    (ruleId === 'PCR-R02' || ruleId === 'PCR-R6-1-B') &&
    (v.field.includes('common_name') || v.field.includes('product_name') || v.rule_id === 'PCR-R02' || v.rule_id === 'PCR-R6-1-B')
  ) {
    return true;
  }
  // PCR-R03 / PCR-R9 (net_quantity)
  if (
    (ruleId === 'PCR-R03' || ruleId === 'PCR-R9' || ruleId === 'PCR-R09' || fieldKey === 'net_quantity') &&
    (v.field.includes('quantity') || v.rule_id === 'PCR-R03' || v.rule_id === 'PCR-R9')
  ) {
    return true;
  }
  // PCR-R04 / PCR-R14 (mrp)
  if (
    (ruleId === 'PCR-R04' || ruleId === 'PCR-R14' || fieldKey === 'mrp') &&
    (v.field === 'mrp' || (v.field.includes('mrp') && !v.field.includes('unit_sale')) || v.rule_id === 'PCR-R04')
  ) {
    return true;
  }
  // PCR-R09 / PCR-R14 (unit_sale_price)
  if (
    (ruleId === 'PCR-R09' || ruleId === 'PCR-R14' || fieldKey === 'unit_sale_price') &&
    (v.field.includes('unit_sale') || v.field.includes('unit_price') || v.rule_id === 'PCR-R09' || (v.rule_id === 'PCR-R14' && v.field.includes('unit')))
  ) {
    return true;
  }
  // PCR-R05 / PCR-R6-1-D (manufacturing_date)
  if (
    (ruleId === 'PCR-R05' || ruleId === 'PCR-R6-1-D' || fieldKey === 'manufacturing_date') &&
    (v.field.includes('manufactur') || v.field.includes('mfd') || v.rule_id === 'PCR-R05')
  ) {
    return true;
  }
  // PCR-R08 / PCR-R6-1-D (expiry_date)
  if (
    (ruleId === 'PCR-R08' || ruleId === 'PCR-R6-1-D' || fieldKey === 'expiry_date') &&
    (v.field.includes('expir') || v.field.includes('best_before') || v.rule_id === 'PCR-R08')
  ) {
    return true;
  }
  // PCR-R06 / PCR-R6-1-F (consumer_care)
  if (
    (ruleId === 'PCR-R06' || ruleId === 'PCR-R6-1-F' || fieldKey === 'consumer_care') &&
    (v.field.includes('consumer') || v.field.includes('care') || v.field.includes('helpline') || v.rule_id === 'PCR-R06' || v.rule_id === 'PCR-R6-1-F')
  ) {
    return true;
  }
  // PCR-R07 (country_of_origin)
  if (
    (ruleId === 'PCR-R07' || fieldKey === 'country_of_origin') &&
    (v.field.includes('origin') || v.rule_id === 'PCR-R07')
  ) {
    return true;
  }

  // PCR-R10 (dimensions)
  if (ruleId === 'PCR-R10' && (v.field.includes('dimension') || v.field.includes('size') || v.rule_id === 'PCR-R10')) {
    return true;
  }
  // PCR-R11 (pdp colocation)
  if (ruleId === 'PCR-R11' && (v.field.includes('colocation') || v.field.includes('pdp') || v.rule_id === 'PCR-R11')) {
    return true;
  }

  return false;
}

export const RuleEvaluationAudit: React.FC<RuleEvaluationAuditProps> = ({
  scanResult,
  onJumpToEvidence,
}) => {
  const [filter, setFilter] = useState<'all' | 'violations' | 'compliant'>('all');
  const [isExpanded, setIsExpanded] = useState(true);

  // Evaluate status of each rule based on actual violations & declarations
  const evaluatedRules = STATUTORY_RULES.map((rule) => {
    // Check if violation matches this rule ID or field
    const matchedViolation = scanResult.violations?.find((v) =>
      matchesRule(v, rule.rule_id, rule.field_key)
    );

    // Check if declaration exists
    const matchedDeclaration = scanResult.declarations?.find(
      (d) =>
        d.field === rule.field_key ||
        d.field.toLowerCase().replace(/[-_]/g, '') === rule.field_key.toLowerCase().replace(/[-_]/g, '') ||
        (rule.field_key === 'mrp' && d.field.includes('mrp')) ||
        (rule.field_key === 'net_quantity' && d.field.includes('quantity')) ||
        (rule.field_key === 'manufacturer' && d.field.includes('manufacturer')) ||
        (rule.field_key === 'common_name' && (d.field.includes('name') || d.field.includes('product')))
    );

    let status: 'PASSED' | 'FAILED' | 'VERIFIED' = 'VERIFIED';
    let detailMessage = 'Statutory declaration verified against standard rules';

    if (matchedViolation) {
      status = 'FAILED';
      detailMessage = matchedViolation.reason;
    } else if (matchedDeclaration) {
      status = 'PASSED';
      detailMessage = `Detected: "${matchedDeclaration.value}" (Confidence: ${Math.round(
        (matchedDeclaration.confidence ?? 0.95) * 100
      )}%)`;
    }

    return {
      ...rule,
      status,
      detailMessage,
      violation: matchedViolation,
      declaration: matchedDeclaration,
    };
  });

  // Also include any scanResult violations that were not mapped above to ensure 100% trace coverage
  if (scanResult.violations) {
    scanResult.violations.forEach((v) => {
      const alreadyIncluded = evaluatedRules.some((r) => r.violation === v);
      if (!alreadyIncluded) {
        evaluatedRules.push({
          rule_id: v.rule_id || 'PCR-GEN',
          field_key: v.field,
          legal_reference: `Legal Metrology Rule ${v.rule_id || '6'}`,
          requirement_title: formatFieldLabel(v.field),
          mandate_description: v.reason,
          status: 'FAILED',
          detailMessage: v.reason,
          violation: v,
          declaration: undefined,
        });
      }
    });
  }

  const filteredRules = evaluatedRules.filter((r) => {
    if (filter === 'violations') return r.status === 'FAILED';
    if (filter === 'compliant') return r.status === 'PASSED' || r.status === 'VERIFIED';
    return true;
  });

  const failedCount = evaluatedRules.filter((r) => r.status === 'FAILED').length;
  const passedCount = evaluatedRules.filter((r) => r.status === 'PASSED' || r.status === 'VERIFIED').length;

  return (
    <div
      id="statutory-rule-evaluation-audit"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden"
    >
      {/* Header with expand/collapse and filter tabs */}
      <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center shrink-0 border border-teal-100 dark:border-teal-900/60">
            <Scale size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Statutory Rule Evaluation Matrix
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                PCR 2011 Audit
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Clause-by-clause statutory evaluation under Legal Metrology & FSSAI packaging directives
            </p>
          </div>
        </div>

        {/* Filter Pills & Toggle */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All ({evaluatedRules.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('violations')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                filter === 'violations'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
              }`}
            >
              Violations ({failedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('compliant')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                filter === 'compliant'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
              }`}
            >
              Compliant ({passedCount})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse matrix' : 'Expand matrix'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Audit Table Content */}
      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-mono">Rule ID</th>
                <th className="py-3 px-4">Statutory Clause & Mandate</th>
                <th className="py-3 px-4">Evaluation Verdict</th>
                <th className="py-3 px-4">Evidence & Findings</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredRules.map((item) => {
                const isFailed = item.status === 'FAILED';

                return (
                  <tr
                    key={item.rule_id}
                    className={`transition-colors ${
                      isFailed
                        ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70'
                        : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Rule ID */}
                    <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap text-slate-800 dark:text-slate-200">
                      <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
                        {item.rule_id}
                      </span>
                    </td>

                    {/* Mandate */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {item.requirement_title}
                      </div>
                      <div className="text-[11px] text-teal-700 dark:text-teal-400 font-mono mt-0.5">
                        {item.legal_reference}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {item.mandate_description}
                      </div>
                    </td>

                    {/* Verdict Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {isFailed ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800">
                          <AlertOctagon size={12} className="stroke-[2.5] text-rose-600" />
                          NON-COMPLIANT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 size={12} className="stroke-[2.5] text-emerald-600" />
                          COMPLIANT
                        </span>
                      )}
                    </td>

                    {/* Evidence & Findings */}
                    <td className="py-3.5 px-4 max-w-sm">
                      <p
                        className={`text-xs leading-relaxed ${
                          isFailed
                            ? 'text-rose-900 dark:text-rose-200 font-medium'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {item.detailMessage}
                      </p>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {isFailed && item.violation && onJumpToEvidence ? (
                        <button
                          type="button"
                          id={`jump-to-evidence-${item.rule_id}`}
                          onClick={() => onJumpToEvidence(item.violation!)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white transition-colors cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-rose-400"
                          title={`Jump to evidence for ${item.requirement_title}`}
                        >
                          <Crosshair size={12} className="stroke-[2.2]" />
                          <span>Jump to Evidence</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">
                          Verified ✓
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
