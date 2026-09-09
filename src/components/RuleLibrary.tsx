import React, { useState, useMemo } from 'react';
import {
  PACKSURE_PCR_RULES,
  RULES_METADATA,
  StatutoryRule,
  RuleException,
} from '../data/pcrRules';
import {
  Scale,
  Search,
  BookOpen,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Filter,
  Layers,
  Sparkles,
  Info,
  ExternalLink,
} from 'lucide-react';

export interface RuleLibraryProps {
  onStartInspection?: () => void;
  onNavigateDashboard?: () => void;
}

// Re-export for any external consumers
export const STATUTORY_RULE_CATALOG = PACKSURE_PCR_RULES;
export type { StatutoryRule };

export const RuleLibrary: React.FC<RuleLibraryProps> = ({
  onStartInspection,
  onNavigateDashboard,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [applicabilityFilter, setApplicabilityFilter] = useState<'ALL' | 'package_scope' | 'conditional'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'scored' | 'experimental'>('ALL');
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>('PCR-R01');
  const [showMetadataBanner, setShowMetadataBanner] = useState<boolean>(true);

  // Filtered rules logic
  const filteredRules = useMemo(() => {
    return PACKSURE_PCR_RULES.filter((rule) => {
      // Applicability filter
      if (applicabilityFilter !== 'ALL' && rule.applicability.type !== applicabilityFilter) {
        return false;
      }

      // Status / Scoring filter
      if (statusFilter === 'scored' && rule.status?.includes('EXPERIMENTAL')) {
        return false;
      }
      if (statusFilter === 'experimental' && !rule.status?.includes('EXPERIMENTAL')) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchId = rule.rule_id.toLowerCase().includes(q);
        const matchField = rule.field.toLowerCase().includes(q);
        const matchRequirement = rule.requirement.toLowerCase().includes(q);
        const matchLegal = rule.legal_reference.toLowerCase().includes(q);
        const matchCondition = rule.applicability.condition.toLowerCase().includes(q);
        const matchEvidence = rule.evidence_required.some((e) => e.toLowerCase().includes(q));
        const matchValidation = rule.validation.type.toLowerCase().includes(q);
        const matchOutputs =
          rule.outputs.pass.toLowerCase().includes(q) ||
          rule.outputs.fail.toLowerCase().includes(q) ||
          rule.outputs.review.toLowerCase().includes(q) ||
          rule.outputs.na.toLowerCase().includes(q);
        const matchExceptions = rule.exceptions?.some(
          (exc) =>
            exc.id.toLowerCase().includes(q) ||
            exc.condition.toLowerCase().includes(q) ||
            exc.reasoning.toLowerCase().includes(q)
        );

        if (
          !matchId &&
          !matchField &&
          !matchRequirement &&
          !matchLegal &&
          !matchCondition &&
          !matchEvidence &&
          !matchValidation &&
          !matchOutputs &&
          !matchExceptions
        ) {
          return false;
        }
      }

      return true;
    });
  }, [searchQuery, applicabilityFilter, statusFilter]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setApplicabilityFilter('ALL');
    setStatusFilter('ALL');
  };

  return (
    <div id="rule-library-view" className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              <Scale size={13} />
              Statutory Knowledge Base
            </span>
            <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
              11 Rules Codified • Version {RULES_METADATA.rules_version} (Frozen)
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 size={11} />
              Single Source of Truth
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Legal Metrology (PCR 2011) Rule Library
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Official statutory codification for Legal Metrology (Packaged Commodities) Rules, 2011 (LMPC Rules).
          </p>
        </div>

        {onStartInspection && (
          <button
            id="rule-lib-start-scan-btn"
            type="button"
            onClick={onStartInspection}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-teal-800 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <span>Scan a Package</span>
          </button>
        )}
      </div>

      {/* Statutory Scope & Food Carve-out Notice */}
      {showMetadataBanner && (
        <div
          id="statutory-scope-banner"
          className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-950 dark:text-amber-200 space-y-2 relative"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-300">
              <Info size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Statutory Scope & Legal Carve-Out Policy</span>
            </div>
            <button
              type="button"
              onClick={() => setShowMetadataBanner(false)}
              className="text-amber-700 dark:text-amber-400 hover:text-amber-900 text-xs font-semibold cursor-pointer"
              title="Dismiss note"
            >
              Dismiss
            </button>
          </div>
          <p className="leading-relaxed text-[11px] sm:text-xs text-amber-900/90 dark:text-amber-200/90">
            {RULES_METADATA.food_products_scope_note}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[10px] text-amber-800 dark:text-amber-300">
            <div className="p-2 rounded-lg bg-amber-100/60 dark:bg-amber-900/40 border border-amber-200/60 dark:border-amber-800/40">
              <span className="font-bold">Confidence Threshold:</span> &lt; {RULES_METADATA.confidence_threshold.review_below} triggers REVIEW
            </div>
            <div className="p-2 rounded-lg bg-amber-100/60 dark:bg-amber-900/40 border border-amber-200/60 dark:border-amber-800/40">
              <span className="font-bold">Date Role Policy:</span> Unresolved date role MUST result in REVIEW, never inferred
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-6 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="rules-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by rule ID (e.g. PCR-R01), field, requirement, legal reference..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
            />
          </div>

          {/* Applicability Filter */}
          <div className="md:col-span-3">
            <select
              id="rules-applicability-select"
              value={applicabilityFilter}
              onChange={(e) => setApplicabilityFilter(e.target.value as 'ALL' | 'package_scope' | 'conditional')}
              className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="ALL">All Applicability Scopes (11 Rules)</option>
              <option value="package_scope">Universal Retail Scope (7 Rules)</option>
              <option value="conditional">Conditional Scope (4 Rules)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3">
            <select
              id="rules-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'scored' | 'experimental')}
              className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="ALL">All Rule Statuses</option>
              <option value="scored">Scored Mandatory Rules (10 Rules)</option>
              <option value="experimental">Experimental / Not Scored (PCR-R11)</option>
            </select>
          </div>
        </div>

        {/* Active Filter status */}
        {(searchQuery || applicabilityFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <div className="flex items-center gap-2 flex-wrap pt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing {filteredRules.length} of {PACKSURE_PCR_RULES.length} statutory rules:
            </span>
            <button
              id="rules-reset-filters-btn"
              type="button"
              onClick={handleResetFilters}
              className="text-teal-700 hover:text-teal-800 dark:text-teal-400 font-semibold underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Rules List (All 11 Rules) */}
      {filteredRules.length > 0 ? (
        <div id="rules-accordion-container" className="space-y-4">
          {filteredRules.map((rule) => {
            const isExpanded = expandedRuleId === rule.rule_id;
            const isExperimental = rule.status?.includes('EXPERIMENTAL');
            const isConditional = rule.applicability.type === 'conditional';

            return (
              <div
                key={rule.rule_id}
                id={`rule-card-${rule.rule_id}`}
                className={`rounded-2xl border shadow-xs overflow-hidden transition-all duration-200 ${
                  isExperimental
                    ? 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-900/60 ring-1 ring-amber-400/30'
                    : isConditional
                    ? 'bg-white dark:bg-slate-900 border-amber-200/80 dark:border-amber-900/50'
                    : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800'
                }`}
              >
                {/* Rule Accordion Header */}
                <button
                  type="button"
                  onClick={() => setExpandedRuleId(isExpanded ? null : rule.rule_id)}
                  aria-expanded={isExpanded}
                  className="w-full text-left p-5 flex items-start justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Header Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded bg-teal-50 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                        {rule.rule_id}
                      </span>

                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        field: <span className="font-semibold">{rule.field}</span>
                      </span>

                      {isExperimental ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                          EXPERIMENTAL • NOT SCORED
                        </span>
                      ) : isConditional ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          CONDITIONAL • SCORED
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          MANDATORY • SCORED
                        </span>
                      )}

                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {rule.applicability.type === 'package_scope' ? 'All Retail Packages' : 'Conditional Applicability'}
                      </span>
                    </div>

                    {/* Rule Requirement Statement */}
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                      {rule.requirement}
                    </h2>

                    {/* Short Legal Citation Summary */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 font-serif italic">
                      {rule.legal_reference}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-1">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </button>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="p-5 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-5 bg-slate-50/40 dark:bg-slate-800/20 text-xs">
                    {/* EXPERIMENTAL NOTICE IF PCR-R11 */}
                    {isExperimental && (
                      <div
                        id="pcr-r11-experimental-notice"
                        className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-200 space-y-1"
                      >
                        <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-300">
                          <Sparkles size={15} className="text-amber-600 dark:text-amber-400" />
                          <span>Status: {rule.status}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                          This rule is strictly experimental and informational. It is excluded from the compliance score denominator. It cannot produce an automated hard legal failure or impact overall compliance status.
                        </p>
                      </div>
                    )}

                    {/* Statutory Legal Reference Box */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-teal-800 dark:text-teal-300">
                        <Scale size={14} />
                        <span>Statutory Basis & Primary Sourcing</span>
                      </div>
                      <p className="font-serif italic text-slate-700 dark:text-slate-300 leading-relaxed pl-3 border-l-2 border-teal-500">
                        {rule.legal_reference}
                      </p>
                    </div>

                    {/* Grid: Applicability & Validation Specifications */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Applicability & Conditions */}
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 space-y-2">
                        <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Layers size={13} className="text-teal-700 dark:text-teal-400" />
                          Applicability Scope
                        </span>
                        <div className="space-y-1 text-slate-700 dark:text-slate-300">
                          <div>
                            <span className="text-slate-500 font-medium">Type: </span>
                            <span className="font-mono font-semibold">{rule.applicability.type}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">Condition: </span>
                            <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {rule.applicability.condition}
                            </span>
                          </div>
                          {rule.applicability.note && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1 leading-snug">
                              Note: {rule.applicability.note}
                            </p>
                          )}
                        </div>

                        {/* Evidence Required */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[11px] font-bold text-slate-900 dark:text-white block mb-1.5">
                            Required Evidence Elements:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {rule.evidence_required.map((ev) => (
                              <span
                                key={ev}
                                className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              >
                                {ev}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right: Validation Logic */}
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 space-y-2">
                        <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                          Validation Architecture
                        </span>
                        <div className="space-y-1 text-slate-700 dark:text-slate-300">
                          <div>
                            <span className="text-slate-500 font-medium">Validation Type: </span>
                            <span className="font-mono font-semibold">{rule.validation.type}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">Required in Denominator: </span>
                            <span className="font-mono font-semibold">
                              {rule.validation.required ? 'true (Scored)' : 'false (Unscored / Experimental)'}
                            </span>
                          </div>
                          {rule.validation.unit_in && (
                            <div>
                              <span className="text-slate-500 font-medium">Permitted Metric Units: </span>
                              <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                {rule.validation.unit_in.join(', ')}
                              </span>
                            </div>
                          )}
                          {rule.validation.expected_role && (
                            <div>
                              <span className="text-slate-500 font-medium">Expected Date Role: </span>
                              <span className="font-mono text-[10px] bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 px-1.5 py-0.5 rounded">
                                {rule.validation.expected_role}
                              </span>
                            </div>
                          )}
                          {rule.validation.note && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1 leading-snug">
                              Note: {rule.validation.note}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Conditional Exceptions (Preserved from exceptions.json) */}
                    {rule.exceptions && rule.exceptions.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-2.5">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300 text-xs">
                          <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
                          <span>Conditional Applicability & Exceptions (exceptions.json)</span>
                        </div>
                        <div className="space-y-2">
                          {rule.exceptions.map((exc) => (
                            <div
                              key={exc.id}
                              className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-900/40 text-[11px] space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {exc.id}
                                </span>
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-semibold">
                                  {exc.effect}
                                </span>
                              </div>
                              <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                Condition: {exc.condition}
                              </div>
                              <p className="text-slate-600 dark:text-slate-400 leading-snug">
                                {exc.reasoning}
                              </p>
                              {exc.status && (
                                <p className="text-[10px] text-amber-800 dark:text-amber-300 italic pt-0.5">
                                  Policy: {exc.status}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Deterministic Engine Outputs (Pass, Fail, Review, N/A) */}
                    <div className="space-y-1.5">
                      <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                        Deterministic Engine Outputs
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block mb-0.5">
                            PASS Output
                          </span>
                          <p className="text-[11px] text-emerald-950 dark:text-emerald-200 leading-snug">
                            {rule.outputs.pass}
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 block mb-0.5">
                            FAIL Output
                          </span>
                          <p className="text-[11px] text-rose-950 dark:text-rose-200 leading-snug">
                            {rule.outputs.fail}
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block mb-0.5">
                            REVIEW Output
                          </span>
                          <p className="text-[11px] text-amber-950 dark:text-amber-200 leading-snug">
                            {rule.outputs.review}
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-0.5">
                            N/A (Exemption) Output
                          </span>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
                            {rule.outputs.na}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty Filter Search State */
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <BookOpen size={26} className="stroke-[1.8]" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No Statutory Rules Match Your Filter
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              No Legal Metrology (PCR 2011) rules match "{searchQuery}". Try searching for rule IDs like PCR-R01, PCR-R04, PCR-R09, or terms like "mrp", "net_quantity", "manufacturer", or reset your filters.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Reset All Filters</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
