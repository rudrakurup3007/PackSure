import React from 'react';
import {
  ShieldCheck,
  ArrowRight,
  UploadCloud,
  Cpu,
  CheckCircle,
  FileSearch,
  Scale,
  Sparkles,
  Layers,
  ChevronRight,
  FileCheck2,
  AlertCircle,
  Package,
} from 'lucide-react';

interface DashboardProps {
  onStartNewInspection: () => void;
  onLoadSampleInspection: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onStartNewInspection,
  onLoadSampleInspection,
}) => {
  const steps = [
    {
      step: '01',
      title: 'UPLOAD',
      badge: 'Multi-Surface Input',
      desc: 'Package photographs are provided (1 to 3 multi-view surfaces: front, back, and declaration panels).',
      icon: UploadCloud,
    },
    {
      step: '02',
      title: 'ANALYZE',
      badge: 'OCR & Extraction',
      desc: 'Statutory declarations (MRP, Net Quantity, Dates, FSSAI, Manufacturer) are identified from image surfaces.',
      icon: Cpu,
    },
    {
      step: '03',
      title: 'VERIFY',
      badge: 'Rule Evaluation',
      desc: 'Extracted values are evaluated against Legal Metrology (Packaged Commodities) Rules, 2011 requirements.',
      icon: Scale,
    },
    {
      step: '04',
      title: 'COMPLIANCE',
      badge: 'Evidence Output',
      desc: 'Overall status, compliance score, itemized violations, and spatial evidence references are generated.',
      icon: CheckCircle,
    },
  ];

  const statutoryRules = [
    {
      rule: 'PCR Rule 6(1)(e)',
      title: 'Maximum Retail Price (MRP)',
      desc: 'Statutory inclusive of all taxes pricing declaration with standardized unit sale price (USP) format.',
      icon: Package,
    },
    {
      rule: 'PCR Rule 9 & Sched. II',
      title: 'Standard Net Quantity',
      desc: 'Mandatory standard metric units (g, kg, ml, l) with prescribed font-height and packaging area ratios.',
      icon: Scale,
    },
    {
      rule: 'PCR Rule 6(1)(a)',
      title: 'Manufacturer / Packer Identity',
      desc: 'Complete registered corporate name and physical facility address of manufacturer or packer.',
      icon: FileCheck2,
    },
    {
      rule: 'PCR Rule 6(1)(d)',
      title: 'Manufacturing / Expiry Dates',
      desc: 'Month and year of manufacture, packaging date, and unambiguous best-before statement.',
      icon: FileSearch,
    },
    {
      rule: 'PCR Rule 6(1)(h)',
      title: 'Consumer Grievance Redressal',
      desc: 'Dedicated contact officer details, helpline telephone number, email, and physical redressal address.',
      icon: AlertCircle,
    },
    {
      rule: 'FSSAI Sec 23 / Rule 6(1)',
      title: 'FSSAI License & Country of Origin',
      desc: '14-digit statutory FSSAI registration number and clear origin declaration for imported or domestic commodities.',
      icon: ShieldCheck,
    },
  ];

  return (
    <div id="dashboard-landing" className="max-w-6xl mx-auto space-y-12 py-10 px-4 sm:px-6 lg:px-8">
      {/* 1. HERO SECTION: Brand + What it does + Primary CTA */}
      <section
        id="dashboard-hero-section"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-white via-slate-50/80 to-slate-100/90 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 border border-slate-200/90 dark:border-slate-800 p-8 sm:p-12 text-center shadow-sm"
      >
        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          {/* Statutory Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800/80 shadow-2xs">
            <ShieldCheck size={14} className="text-indigo-600 dark:text-indigo-400 stroke-[2.5]" />
            <span>Legal Metrology & Packaging Compliance Intelligence</span>
          </div>

          {/* Product Brand & Headline */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              PackSure AI
            </h1>
            <p className="text-base sm:text-xl font-medium text-slate-700 dark:text-slate-200 tracking-tight">
              AI-Powered Packaged Commodity Compliance Scanner
            </p>
          </div>

          {/* Truthful Core Explanation */}
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Inspect packaged consumer commodities against statutory Legal Metrology rules.
            Extract mandatory declarations, detect non-compliance violations, and inspect spatial evidence across package surfaces.
          </p>

          {/* Primary Action Group */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              id="start-inspection-hero-btn"
              type="button"
              onClick={onStartNewInspection}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl text-sm sm:text-base font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm hover:shadow transition-all focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-900"
            >
              <span>New Inspection</span>
              <ArrowRight size={18} className="stroke-[2.2]" />
            </button>

            <button
              id="try-demo-sample-btn"
              type="button"
              onClick={onLoadSampleInspection}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 dark:bg-slate-800/90 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800 transition shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <Sparkles size={16} className="text-amber-500 shrink-0" />
              <span>Load Sample Commodity Demo</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. WORKFLOW SECTION: UPLOAD -> ANALYZE -> VERIFY -> COMPLIANCE */}
      <section id="dashboard-workflow-section" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Layers size={18} className="text-indigo-600 dark:text-indigo-400" />
              <span>Inspection Workflow Architecture</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Deterministic, evidence-grounded statutory evaluation pipeline
            </p>
          </div>
          <span className="text-xs font-mono font-medium text-slate-400 dark:text-slate-500">
            4-Stage Pipeline
          </span>
        </div>

        {/* 4-Step Connected Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                id={`workflow-step-${idx + 1}`}
                className="relative rounded-2xl border border-slate-200/90 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-2xs flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group"
              >
                <div className="space-y-4">
                  {/* Step Header */}
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                      <Icon size={20} className="stroke-[2.2]" />
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                      STEP {item.step}
                    </span>
                  </div>

                  {/* Title & Badge */}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                        {item.title}
                      </h3>
                    </div>
                    <span className="inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {item.badge}
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>

                {/* Pipeline Arrow Connector (Desktop) */}
                {idx < steps.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full items-center justify-center text-slate-400 shadow-2xs"
                  >
                    <ChevronRight size={14} className="stroke-[2.5]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. STATUTORY STANDARDS REFERENCE MATRIX */}
      <section
        id="dashboard-statutory-rules-section"
        className="rounded-3xl border border-slate-200/90 bg-slate-50/60 dark:bg-slate-900/40 dark:border-slate-800 p-6 sm:p-8 space-y-6"
      >
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSearch size={18} className="text-indigo-600 dark:text-indigo-400" />
            <span>Statutory Declarations Evaluated</span>
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Automated verification is conducted under the statutory provisions of the Legal Metrology (Packaged Commodities) Rules, 2011 (as amended):
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          {statutoryRules.map((ruleItem) => {
            const RuleIcon = ruleItem.icon;
            return (
              <div
                key={ruleItem.rule}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">
                    {ruleItem.rule}
                  </span>
                  <RuleIcon size={14} className="text-slate-400 shrink-0" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                  {ruleItem.title}
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                  {ruleItem.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

