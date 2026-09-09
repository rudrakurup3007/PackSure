import React, { useState, useRef, useEffect } from 'react';
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
  AlertOctagon,
  AlertTriangle,
  Clock,
  ChevronRight,
  FileCheck2,
  AlertCircle,
  Package,
  PlusCircle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Tag,
  Hash,
  Eye,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { ScanResult } from '../types/inspection';
import { DemoScenarioSelector } from './DemoScenarioSelector';

interface DashboardProps {
  onStartNewInspection: () => void;
  onLoadSampleInspection: () => void;
  onSelectInspection?: (result: ScanResult) => void;
  onNavigateHistory?: () => void;
  onNavigateAnalytics?: () => void;
  onNavigateRules?: () => void;
  onRunScenario?: (scenario: 'compliant' | 'non-compliant' | 'review-required') => void;
  currentScanResult?: ScanResult | null;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onStartNewInspection,
  onLoadSampleInspection,
  onSelectInspection,
  onNavigateHistory,
  onNavigateAnalytics,
  onNavigateRules,
  onRunScenario,
  currentScanResult,
}) => {
  const [isStartingNew, setIsStartingNew] = useState<boolean>(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState<boolean>(false);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timers on component unmount
  useEffect(() => {
    return () => {
      if (actionTimerRef.current) {
        clearTimeout(actionTimerRef.current);
      }
    };
  }, []);

  const handleStartNewClick = () => {
    if (isStartingNew || isLoadingDemo) return;
    setIsStartingNew(true);
    actionTimerRef.current = setTimeout(() => {
      setIsStartingNew(false);
      onStartNewInspection();
    }, 320);
  };

  const handleLoadDemoClick = () => {
    if (isLoadingDemo || isStartingNew) return;
    setIsLoadingDemo(true);
    actionTimerRef.current = setTimeout(() => {
      setIsLoadingDemo(false);
      onLoadSampleInspection();
    }, 380);
  };
  // Dynamic time-of-day greeting
  const hour = new Date().getHours();
  let greeting = 'Good evening, Inspector';
  if (hour < 12) {
    greeting = 'Good morning, Inspector';
  } else if (hour < 17) {
    greeting = 'Good afternoon, Inspector';
  }

  // Operational shift KPIs
  const totalInspectionsToday = currentScanResult ? 15 : 14;
  const compliantCount = currentScanResult?.overall_status === 'COMPLIANT' ? 13 : 12;
  const complianceRate = Math.round((compliantCount / totalInspectionsToday) * 1000) / 10;
  const violationsFoundCount = 3 + (currentScanResult?.violations?.length || 0);

  // Compact 7-day trend data
  const trendDays = [
    { day: 'Mon', rate: 85, passed: 17, total: 20 },
    { day: 'Tue', rate: 71, passed: 10, total: 14 },
    { day: 'Wed', rate: 90, passed: 18, total: 20 },
    { day: 'Thu', rate: 83, passed: 15, total: 18 },
    { day: 'Fri', rate: 72, passed: 13, total: 18 },
    { day: 'Sat', rate: 80, passed: 12, total: 15 },
    { day: 'Today', rate: complianceRate, passed: compliantCount, total: totalInspectionsToday },
  ];

  // Statutory Rule Watchlist
  const ruleWatchlist = [
    {
      ruleId: 'PCR Rule 6(1)(e)',
      name: 'Unit Sale Price (USP) Omission',
      frequency: '38% of non-compliances',
      severity: 'HIGH',
      description:
        'Missing price per g/ml declaration alongside MRP on pre-packaged commodities. Mandatory for items > 100g/ml.',
    },
    {
      ruleId: 'PCR Rule 9 & Sched. II',
      name: 'Net Quantity Font Area Ratio',
      frequency: '28% of non-compliances',
      severity: 'HIGH',
      description:
        'Numeral font height below statutory minimum (< 2mm font height for packages under 200g, or < 4mm for 1kg).',
    },
    {
      ruleId: 'PCR Rule 6(1)(a)',
      name: 'Incomplete Manufacturing Address',
      frequency: '20% of non-compliances',
      severity: 'MEDIUM',
      description:
        'Registered office address declared without actual factory or manufacturing facility geographical location.',
    },
    {
      ruleId: 'FSSAI Sec 23',
      name: '14-Digit License Low Contrast',
      frequency: '14% of non-compliances',
      severity: 'MEDIUM',
      description:
        'FSSAI registration number illegible against dark packaging or obscured by promotional typography.',
    },
  ];

  return (
    <div id="overview-dashboard" className="max-w-7xl mx-auto space-y-5 sm:space-y-6 py-4 sm:py-6 lg:py-7 px-3.5 sm:px-6 lg:px-8">
      {/* ========================================================================= */}
      {/* 1. CONTEXTUAL WELCOME AREA + PRIMARY ACTION */}
      {/* ========================================================================= */}
      <section
        id="dashboard-welcome-banner"
        className="rounded-2xl bg-slate-900 text-white border border-slate-800 p-4 sm:p-6 lg:p-7 shadow-xs relative overflow-hidden"
      >
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
          {/* Context & Welcome Headline */}
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-950/80 text-teal-300 border border-teal-800/80">
                <ShieldCheck size={13} className="text-teal-400" />
                Operational Command Center
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-900 text-slate-300 border border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Engine v2.4 Online
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono text-slate-400 bg-slate-900/60 border border-slate-800">
                <Clock size={12} />
                Sync: 10:45 AM
              </span>
            </div>

            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                {greeting}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                Statutory oversight active for Legal Metrology (Packaged Commodities) Rules, 2011 & FSSAI Directives.
              </p>
            </div>

            {/* Quick status line */}
            <div className="pt-0.5 text-xs text-slate-400 flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="font-semibold text-slate-200">Current Shift Status:</span>
              <span className="text-slate-300">14 packages audited</span>
              <span>•</span>
              <span className="text-amber-300 font-medium">3 statutory flags require attention</span>
              <span>•</span>
              <span className="text-emerald-400 font-medium">0 system faults</span>
            </div>
          </div>

          {/* PRIMARY ACTION (HIGHLY VISIBLE) */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2.5 sm:gap-3 shrink-0">
            <button
              id="dashboard-primary-start-btn"
              type="button"
              disabled={isStartingNew || isLoadingDemo}
              onClick={handleStartNewClick}
              className={`inline-flex items-center justify-center gap-2.5 px-5 sm:px-6 py-3 rounded-xl text-sm sm:text-base font-semibold shadow-xs transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                isStartingNew
                  ? 'bg-teal-900 text-teal-100 cursor-not-allowed opacity-90'
                  : 'bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white active:scale-[0.98] cursor-pointer'
              }`}
            >
              {isStartingNew ? (
                <>
                  <RefreshCw size={18} className="animate-spin text-white stroke-[2.2]" />
                  <span>Opening Inspection...</span>
                </>
              ) : (
                <>
                  <PlusCircle size={18} className="stroke-[2.2]" />
                  <span>Start New Inspection</span>
                  <ArrowRight size={17} className="stroke-[2.2]" />
                </>
              )}
            </button>

            <button
              id="dashboard-secondary-demo-btn"
              type="button"
              disabled={isLoadingDemo || isStartingNew}
              onClick={handleLoadDemoClick}
              className={`inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border shadow-xs transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                isLoadingDemo
                  ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed'
                  : 'bg-slate-900/90 hover:bg-slate-800 active:bg-slate-900 text-slate-300 border border-slate-700 active:scale-[0.98] cursor-pointer'
              }`}
              title="Load pre-built 3-panel commodity images for instant inspection test"
            >
              {isLoadingDemo ? (
                <>
                  <RefreshCw size={15} className="animate-spin text-amber-400" />
                  <span>Loading Demo Scan...</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} className="text-amber-400" />
                  <span>Run Sample Demo Scan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. KPI SECTION (USEFUL OPERATIONAL METRICS) */}
      {/* ========================================================================= */}
      <section id="dashboard-kpi-section" aria-label="Operational Key Performance Indicators">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Inspections Today */}
          <div
            id="kpi-inspections-today"
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Inspections Today
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center">
                <Package size={17} />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                {totalInspectionsToday}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+3</span> vs yesterday • 100% processed
              </p>
            </div>
          </div>

          {/* KPI 2: Compliance Rate */}
          <div
            id="kpi-compliance-rate"
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Compliance Rate
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShieldCheck size={17} />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                {complianceRate}%
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{compliantCount} passed</span> • {totalInspectionsToday - compliantCount} non-compliant
              </p>
            </div>
          </div>

          {/* KPI 3: Violations Found */}
          <div
            id="kpi-violations-found"
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Violations Found
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <AlertOctagon size={17} />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                {violationsFoundCount}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Highest flag: <span className="font-semibold text-rose-600 dark:text-rose-400">Unit Sale Price (USP)</span>
              </p>
            </div>
          </div>

          {/* KPI 4: Average OCR Confidence */}
          <div
            id="kpi-ocr-confidence"
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Mean OCR Confidence
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center">
                <Cpu size={17} />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                94.8%
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Across 42 extracted statutory text declarations
              </p>
            </div>
          </div>
        </div>

        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 text-right px-1">
          * Metrics reflect today&apos;s verified audits and baseline operational records for packaging compliance evaluation.
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. WHAT NEEDS ATTENTION (OPERATIONAL ACTION CALLOUT) */}
      {/* ========================================================================= */}
      <section
        id="dashboard-attention-callout"
        className="rounded-2xl border border-amber-200/90 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/50 p-5 sm:p-6"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={20} className="stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-amber-950 dark:text-amber-200">
                Action Required: 3 Packages Flagged for Statutory Enforcement
              </h2>
              <p className="text-xs sm:text-sm text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                Packaged commodities exhibit missing Unit Sale Price (Rule 6(1)(e)) and Net Quantity bare numerals (Rule 9). Review spatial evidence before issuance.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLoadSampleInspection}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs transition-colors duration-150 shrink-0 cursor-pointer"
          >
            <span>Inspect Flagged Sample</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3B. DEMONSTRATION SCENARIOS (DEMONSTRATION SUITE) */}
      {/* ========================================================================= */}
      <section id="dashboard-demo-scenarios-suite" className="bg-slate-50/70 dark:bg-slate-900/50 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs">
        <DemoScenarioSelector
          onRunScenario={(scenario) => {
            if (onRunScenario) onRunScenario(scenario);
            else onLoadSampleInspection();
          }}
          onQuickInspect={(mockRes) => {
            if (onSelectInspection) onSelectInspection(mockRes);
          }}
        />
      </section>

      {/* ========================================================================= */}
      {/* 4. CURRENT OPERATIONAL & INSPECTION ACTIVITY */}
      {/* ========================================================================= */}
      <section id="dashboard-current-activity-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Activity size={20} className="text-teal-700 dark:text-teal-400" />
              Current Inspection Activity
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Active inspection workspace session status and real-time operational packaging evaluations.
            </p>
          </div>

          {onNavigateHistory && (
            <button
              id="dashboard-full-archive-btn"
              type="button"
              onClick={onNavigateHistory}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200/80 dark:border-teal-800/80 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Archive size={14} />
              <span>View History / Full Archive</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        {currentScanResult ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-100 dark:border-teal-900/50 flex items-center justify-center shrink-0">
                  <Package size={24} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      ID: {currentScanResult.inspection_id}
                    </span>
                    {currentScanResult.overall_status === 'COMPLIANT' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 size={12} />
                        COMPLIANT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        <AlertOctagon size={12} />
                        NON-COMPLIANT
                      </span>
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      • Current Session Inspection
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {currentScanResult.product?.name || 'Inspected Commodity'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Category: <span className="font-medium text-slate-700 dark:text-slate-300">{currentScanResult.product?.type || 'Packaged Commodity'}</span>
                    {' '}&bull; Score: <span className="font-mono font-bold text-slate-900 dark:text-white">{currentScanResult.score}/100</span>
                    {' '}&bull; Declarations: <span className="font-medium text-slate-700 dark:text-slate-300">{currentScanResult.declarations?.length || 0}</span>
                    {' '}&bull; Violations: <span className="font-semibold text-rose-600 dark:text-rose-400">{currentScanResult.violations?.length || 0} flagged</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                {onSelectInspection && (
                  <button
                    type="button"
                    onClick={() => onSelectInspection(currentScanResult)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <Eye size={15} />
                    <span>View Inspection Audit</span>
                    <ArrowRight size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onStartNewInspection}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <PlusCircle size={15} />
                  <span>Start New</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                      Scanner Ready • Current Session Idle
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Ready for Package Verification
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
                    Upload single or multi-surface packaging images to run statutory evaluations against Legal Metrology Rules, 2011 and FSSAI Directives, or browse past audits in the archive.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={onStartNewInspection}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white shadow-xs transition-colors cursor-pointer"
                >
                  <PlusCircle size={15} />
                  <span>New Inspection</span>
                </button>
                {onNavigateHistory && (
                  <button
                    type="button"
                    onClick={onNavigateHistory}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    <Archive size={14} />
                    <span>View Archive</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 5. COMPLIANCE TREND & SEVERITY BREAKDOWN */}
      {/* ========================================================================= */}
      <section id="dashboard-trend-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trend Bar Chart */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-teal-700 dark:text-teal-400" />
                7-Day Compliance Pass Rate
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Weekly compliance proportion across inspected commodity batches.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                Benchmark: 75%
              </span>
              {onNavigateAnalytics && (
                <button
                  type="button"
                  onClick={onNavigateAnalytics}
                  className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 cursor-pointer"
                >
                  <span>Analytics</span>
                  <ArrowRight size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Simple Clean Accessible SVG Bar Chart */}
          <div className="pt-4 space-y-2">
            <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-40 pb-2 border-b border-slate-200 dark:border-slate-700">
              {trendDays.map((t) => {
                const heightPercent = Math.max(15, Math.min(100, t.rate));
                const isCompliant = t.rate >= 75;

                return (
                  <div key={t.day} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {t.rate}%
                    </span>
                    <div className="w-full max-w-[36px] bg-slate-100 dark:bg-slate-800 rounded-t-lg overflow-hidden flex items-end h-32">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full transition-all duration-300 rounded-t-md ${
                          isCompliant
                            ? 'bg-teal-800 dark:bg-teal-700 group-hover:bg-teal-900'
                            : 'bg-rose-500 dark:bg-rose-600 group-hover:bg-rose-700'
                        }`}
                        title={`${t.day}: ${t.rate}% compliance (${t.passed}/${t.total})`}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      {t.day}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-teal-800 inline-block" />
                  Passed Threshold (&gt;= 75%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                  Below Threshold
                </span>
              </div>
              <span>Target: 95%</span>
            </div>
          </div>
        </div>

        {/* Infraction Category Distribution */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity size={18} className="text-teal-700 dark:text-teal-400" />
              Violation Category Distribution
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Breakdown of statutory infractions flagged across current operations.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {[
              { label: 'Unit Sale Price (PCR-R14)', count: '38%', bar: 'w-[38%]', color: 'bg-rose-600' },
              { label: 'Net Quantity Units & Area (PCR-R9)', count: '28%', bar: 'w-[28%]', color: 'bg-rose-500' },
              { label: 'Manufacturer Facility Address (PCR-R6)', count: '20%', bar: 'w-[20%]', color: 'bg-amber-500' },
              { label: 'FSSAI License & Dates (PCR-R6d)', count: '14%', bar: 'w-[14%]', color: 'bg-slate-400' },
            ].map((cat) => (
              <div key={cat.label} className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span className="font-medium truncate">{cat.label}</span>
                  <span className="font-mono font-semibold ml-2">{cat.count}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full ${cat.color} ${cat.bar}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. STATUTORY RULE WATCHLIST */}
      {/* ========================================================================= */}
      <section
        id="dashboard-rule-watchlist"
        className="rounded-2xl border border-slate-200/90 bg-white dark:bg-slate-900 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Scale size={18} className="text-teal-700 dark:text-teal-400" />
              Statutory Rule Watchlist
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              High-frequency statutory non-compliance focus areas under the Legal Metrology (Packaged Commodities) Rules, 2011.
            </p>
          </div>
          {onNavigateRules && (
            <button
              type="button"
              onClick={onNavigateRules}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 hover:bg-teal-100 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <span>Explore Rule Library</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ruleWatchlist.map((rule) => (
            <div
              key={rule.ruleId}
              className="p-5 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded border border-teal-100 dark:border-teal-900/60">
                  {rule.ruleId}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    rule.severity === 'HIGH'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  {rule.severity} WATCH
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {rule.name}
                </h4>
                <div className="text-[11px] font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                  Occurrence: {rule.frequency}
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {rule.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
