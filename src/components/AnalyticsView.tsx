import React, { useState } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  AlertOctagon,
  Cpu,
  Package,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from 'lucide-react';
import { getStoredInspections } from '../mock/demoData';

interface AnalyticsViewProps {
  onStartNewInspection?: () => void;
  onNavigateHistory?: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  onStartNewInspection,
  onNavigateHistory,
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');

  const inspections = getStoredInspections();
  const totalCount = inspections.length;
  const compliantCount = inspections.filter((i) => i.status === 'COMPLIANT').length;
  const nonCompliantCount = inspections.filter((i) => i.status === 'NON_COMPLIANT').length;
  const warningCount = inspections.filter((i) => i.status === 'WARNING').length;

  const complianceRate = totalCount > 0 ? Math.round((compliantCount / totalCount) * 1000) / 10 : 0;
  const totalViolations = inspections.reduce((acc, curr) => acc + curr.violationsCount, 0);

  // Mean OCR confidence across history
  const avgConfidence =
    totalCount > 0
      ? Math.round(
          (inspections.reduce((acc, curr) => acc + (curr.meanConfidence || 0.92), 0) / totalCount) *
            1000
        ) / 10
      : 0;

  // 7-Day Trend data
  const trendDays = [
    { day: 'Mon', total: 18, passed: 15, failed: 3, rate: 83 },
    { day: 'Tue', total: 14, passed: 10, failed: 4, rate: 71 },
    { day: 'Wed', total: 20, passed: 18, failed: 2, rate: 90 },
    { day: 'Thu', total: 16, passed: 13, failed: 3, rate: 81 },
    { day: 'Fri', total: 22, passed: 16, failed: 6, rate: 73 },
    { day: 'Sat', total: 15, passed: 12, failed: 3, rate: 80 },
    { day: 'Today', total: totalCount, passed: compliantCount, failed: nonCompliantCount, rate: Math.round(complianceRate) },
  ];

  // Top Violations Breakdown
  const topViolations = [
    {
      ruleId: 'PCR-R14 (Rule 6(1)(e))',
      name: 'Unit Sale Price (USP) Omission',
      count: 14,
      percentage: 38,
      severity: 'CRITICAL',
      color: 'bg-rose-600',
    },
    {
      ruleId: 'PCR-R9 (Rule 6(1)(c))',
      name: 'Net Quantity Missing Standard SI Unit',
      count: 10,
      percentage: 27,
      severity: 'CRITICAL',
      color: 'bg-rose-500',
    },
    {
      ruleId: 'PCR-R6-1-A (Rule 6(1)(a))',
      name: 'Incomplete Manufacturing Premises Address',
      count: 7,
      percentage: 19,
      severity: 'HIGH',
      color: 'bg-amber-500',
    },
    {
      ruleId: 'FSSAI-SEC-23',
      name: 'FSSAI License Font Contrast / Legibility',
      count: 6,
      percentage: 16,
      severity: 'MODERATE',
      color: 'bg-slate-400',
    },
  ];

  // OCR confidence breakdown by statutory field
  const fieldConfidence = [
    { field: 'Maximum Retail Price (MRP)', score: 96.8, bar: 'w-[97%]' },
    { field: 'FSSAI 14-Digit License', score: 95.4, bar: 'w-[95%]' },
    { field: 'Net Quantity & SI Units', score: 92.1, bar: 'w-[92%]' },
    { field: 'Date of Packaging / Expiry', score: 88.6, bar: 'w-[89%]' },
    { field: 'Manufacturer & Care Address', score: 86.2, bar: 'w-[86%]' },
  ];

  // Category breakdown
  const categoryCompliance = [
    { category: 'Packaged Staples & Grains', total: 16, rate: 94, status: 'EXCELLENT' },
    { category: 'Edible Oils & Fats', total: 10, rate: 90, status: 'HIGH' },
    { category: 'Packaged Food & Confectionery', total: 24, rate: 68, status: 'ATTENTION' },
    { category: 'Beverages & Ready-to-Drink', total: 12, rate: 75, status: 'SATISFACTORY' },
  ];

  return (
    <div id="analytics-view" className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              <TrendingUp size={13} />
              Compliance Telemetry & Trends
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              Inspection Intelligence
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Packaging Compliance Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Operational intelligence covering compliance pass rates, recurring rule infractions, and OCR confidence.
          </p>
        </div>

        {/* Time Window Tabs */}
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => setTimeRange('7d')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              timeRange === '7d'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('30d')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              timeRange === '30d'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              timeRange === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* 1. Core KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Compliance Rate */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Statutory Compliance Rate
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {complianceRate}%
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              <ArrowUpRight size={14} />
              <span>+4.2% vs previous period</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Total Audits */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Package Audits
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center">
              <Package size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {totalCount}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {compliantCount} compliant • {nonCompliantCount} flagged • {warningCount} review
            </p>
          </div>
        </div>

        {/* Metric 3: Total Violations */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Infractions Detected
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertOctagon size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
              {totalViolations}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Across Legal Metrology PCR 2011 clauses
            </p>
          </div>
        </div>

        {/* Metric 4: Mean OCR Confidence */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Mean OCR Confidence
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center">
              <Cpu size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {avgConfidence}%
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              High text clarity on 92% of package surfaces
            </p>
          </div>
        </div>
      </section>

      {/* 2. Inspections Over Time & Top Violations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Inspections Over Time Bar Chart (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar size={18} className="text-teal-700 dark:text-teal-400" />
                Inspections Over Time (7-Day Trend)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daily package batch inspection volume and statutory pass rates.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              Avg: 17 scans/day
            </span>
          </div>

          <div className="pt-4 space-y-3">
            <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 pb-2 border-b border-slate-200 dark:border-slate-800">
              {trendDays.map((t) => {
                const heightPercent = Math.max(18, Math.min(100, t.rate));
                const isCompliant = t.rate >= 75;

                return (
                  <div key={t.day} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {t.rate}%
                    </span>
                    <div className="w-full max-w-[40px] bg-slate-100 dark:bg-slate-800 rounded-t-lg overflow-hidden flex items-end h-36">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full transition-all duration-300 rounded-t-md ${
                          isCompliant
                            ? 'bg-teal-800 dark:bg-teal-700 group-hover:bg-teal-900'
                            : 'bg-rose-500 dark:bg-rose-600 group-hover:bg-rose-700'
                        }`}
                        title={`${t.day}: ${t.passed} passed, ${t.failed} non-compliant (${t.rate}%)`}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      {t.day}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-teal-800 inline-block" />
                  Pass Benchmark (&gt;= 75%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                  Below Threshold
                </span>
              </div>
              <span className="font-mono text-[11px]">Statutory Target: 90%</span>
            </div>
          </div>
        </div>

        {/* Top Violations Leaderboard (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertOctagon size={18} className="text-rose-600 dark:text-rose-400" />
              Top Statutory Violations
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Most frequent non-compliance provisions flagged by PackSure AI.
            </p>
          </div>

          <div className="space-y-3.5 pt-1">
            {topViolations.map((v) => (
              <div key={v.ruleId} className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                    {v.name}
                  </span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 shrink-0">
                    {v.percentage}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-mono">{v.ruleId}</span>
                  <span>{v.count} flagged instances</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    style={{ width: `${v.percentage}%` }}
                    className={`h-full rounded-full ${v.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. OCR Confidence Breakdown & Category Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* OCR Confidence Breakdown (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu size={18} className="text-teal-700 dark:text-teal-400" />
              Optical OCR Confidence by Declaration Field
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Model accuracy and extraction confidence across statutory text segments.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {fieldConfidence.map((fc) => (
              <div key={fc.field} className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span className="font-medium">{fc.field}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {fc.score}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    style={{ width: `${fc.score}%` }}
                    className="h-full rounded-full bg-teal-700 dark:bg-teal-600"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Commodity Category Compliance (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Scale size={18} className="text-teal-700 dark:text-teal-400" />
              Commodity Category Compliance Matrix
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pass rates partitioned across regulated consumer commodity categories.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {categoryCompliance.map((cc) => (
              <div
                key={cc.category}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{cc.category}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {cc.total} packages audited
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                    {cc.rate}%
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      cc.rate >= 85
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {cc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
