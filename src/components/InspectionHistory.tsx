import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Package,
  Calendar,
  Clock,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Eye,
  Hash,
  Download,
  Tag,
  ArrowUpDown,
  Archive,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import { ScanResult } from '../types/inspection';
import { HistoricalInspection, getStoredInspections, resolveHistoricalScanResult } from '../mock/demoData';
import { StatusBadge } from './StatusBadge';

interface InspectionHistoryProps {
  onSelectInspection: (scanResult: ScanResult) => void;
}

export const InspectionHistory: React.FC<InspectionHistoryProps> = ({
  onSelectInspection,
}) => {
  const [inspections, setInspections] = useState<HistoricalInspection[]>(() =>
    getStoredInspections()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLIANT' | 'NON_COMPLIANT' | 'WARNING'>(
    'ALL'
  );
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'LIVE' | 'DEMO'>('ALL');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'score-desc' | 'score-asc'>(
    'date-desc'
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setInspections(getStoredInspections());
  }, []);

  const handleOpenInspection = (item: HistoricalInspection) => {
    const result = item.fullResult || resolveHistoricalScanResult(item);
    onSelectInspection(result);
  };

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter and sort logic
  const filteredInspections = useMemo(() => {
    return inspections
      .filter((item) => {
        // Status filter
        if (statusFilter !== 'ALL' && item.status !== statusFilter) {
          return false;
        }

        // Source filter
        if (sourceFilter === 'LIVE' && item.isDemo) return false;
        if (sourceFilter === 'DEMO' && !item.isDemo) return false;

        // Search query filter
        if (searchQuery.trim() !== '') {
          const query = searchQuery.toLowerCase().trim();
          const matchName = item.name.toLowerCase().includes(query);
          const matchId = item.id.toLowerCase().includes(query);
          const matchCat = item.category.toLowerCase().includes(query);
          if (!matchName && !matchId && !matchCat) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          return new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime();
        }
        if (sortBy === 'date-asc') {
          return new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime();
        }
        if (sortBy === 'score-desc') {
          return b.score - a.score;
        }
        if (sortBy === 'score-asc') {
          return a.score - b.score;
        }
        return 0;
      });
  }, [inspections, searchQuery, statusFilter, sourceFilter, sortBy]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setSourceFilter('ALL');
    setSortBy('date-desc');
  };

  const handleExportJson = (item: HistoricalInspection, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = item.fullResult || resolveHistoricalScanResult(item);
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(result, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${item.id}_compliance_audit.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const totalCount = inspections.length;
  const compliantCount = inspections.filter((i) => i.status === 'COMPLIANT').length;
  const nonCompliantCount = inspections.filter((i) => i.status === 'NON_COMPLIANT').length;
  const warningCount = inspections.filter((i) => i.status === 'WARNING').length;

  return (
    <div id="inspection-history-view" className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header & Context */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            <Calendar size={13} />
            Statutory Inspection Archive
          </span>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Total Audits: {totalCount}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Inspection History & Audit Logs
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Historical packaging compliance evaluations under Legal Metrology (PCR 2011) and FSSAI Directives.
        </p>
      </div>

      {/* Professional Inspection Archive Banner */}
      <div
        id="history-archive-banner"
        className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 p-4 text-xs flex items-start gap-3.5 text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
      >
        <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/80 flex items-center justify-center shrink-0 mt-0.5">
          <Archive size={16} />
        </div>
        <div className="space-y-0.5">
          <h2 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
            Inspection Archive Active
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
            Review previously analyzed packages, compare compliance outcomes, and reopen evidence-backed audit records from your inspection workspace.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="history-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name, inspection ID, or category..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3">
            <select
              id="history-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="ALL">All Statuses ({totalCount})</option>
              <option value="COMPLIANT">Compliant Only ({compliantCount})</option>
              <option value="NON_COMPLIANT">Non-Compliant Only ({nonCompliantCount})</option>
              <option value="WARNING">Review Required ({warningCount})</option>
            </select>
          </div>

          {/* Source Filter (Demo vs Live) */}
          <div className="md:col-span-2">
            <select
              id="history-source-select"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="ALL">All Sources</option>
              <option value="LIVE">Live User Audits</option>
              <option value="DEMO">Demo Samples</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="md:col-span-2">
            <select
              id="history-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="score-desc">Highest Score</option>
              <option value="score-asc">Lowest Score</option>
            </select>
          </div>
        </div>

        {/* Active Filter Badges */}
        {(searchQuery || statusFilter !== 'ALL' || sourceFilter !== 'ALL') && (
          <div className="flex items-center gap-2 flex-wrap pt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>Active filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                Query: "{searchQuery}"
              </span>
            )}
            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                Status: {statusFilter}
              </span>
            )}
            {sourceFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                Source: {sourceFilter}
              </span>
            )}
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-teal-700 hover:text-teal-800 dark:text-teal-400 font-semibold underline cursor-pointer ml-1"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Results Table & Cards */}
      {filteredInspections.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 sm:px-6">Product / Commodity</th>
                  <th className="py-3 px-4">Inspection ID</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Compliance Status</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Violations</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredInspections.map((item) => {
                  const isCompliant = item.status === 'COMPLIANT';
                  const isNonCompliant = item.status === 'NON_COMPLIANT';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleOpenInspection(item)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Product Name & Category */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                              isCompliant
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/40'
                                : isNonCompliant
                                ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900/40'
                                : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900/40'
                            }`}
                          >
                            <Package size={17} />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>{item.category}</span>
                              {item.isDemo ? (
                                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  DEMO
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  LIVE
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Inspection ID with Copy */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <button
                          type="button"
                          onClick={(e) => handleCopyId(item.id, e)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                          title="Copy Inspection ID"
                        >
                          <Hash size={11} className="text-teal-600 dark:text-teal-400" />
                          <span>{item.id}</span>
                          {copiedId === item.id ? (
                            <Check size={11} className="text-emerald-500 ml-1" />
                          ) : (
                            <Copy size={11} className="text-slate-400 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <Clock size={12} className="text-slate-400" />
                          <span>{item.timestamp}</span>
                        </div>
                      </td>

                      {/* Compliance Status Badge */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={item.status} size="sm" />
                      </td>

                      {/* Score */}
                      <td className="py-3.5 px-4 font-mono font-extrabold">
                        <span
                          className={
                            item.score >= 85
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : item.score >= 70
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }
                        >
                          {item.score}
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal"> / 100</span>
                      </td>

                      {/* Violation Count */}
                      <td className="py-3.5 px-4">
                        {item.violationsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-xs">
                            <AlertOctagon size={12} />
                            {item.violationsCount} {item.violationsCount === 1 ? 'flag' : 'flags'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 text-xs">
                            <CheckCircle2 size={12} />
                            0 flags
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleExportJson(item, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Export JSON report"
                          >
                            <Download size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenInspection(item);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-800 hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-900/60 transition-colors cursor-pointer"
                          >
                            <Eye size={13} />
                            <span>View Audit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Polished Empty State for Filter/Search */
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Search size={26} className="stroke-[1.8]" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No Inspections Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              No historical inspection records match your current search query or status filter. Try resetting your search filters.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Reset Search Filters</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
