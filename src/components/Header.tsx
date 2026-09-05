import React from 'react';
import { ShieldCheck, PlusCircle, RefreshCw, Layers, LayoutDashboard } from 'lucide-react';

interface HeaderProps {
  onNavigateDashboard?: () => void;
  onNewInspection?: () => void;
  currentView?: string;
  isScanning?: boolean;
  isMockMode?: boolean;
  onToggleMockMode?: () => void;
  showNewInspectionBtn?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigateDashboard,
  onNewInspection,
  currentView = 'dashboard',
  isScanning = false,
  isMockMode = true,
  onToggleMockMode,
  showNewInspectionBtn = false,
}) => {
  return (
    <header
      id="app-header"
      className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-xs"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand identity */}
        <div
          id="header-brand-container"
          onClick={onNavigateDashboard}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigateDashboard?.();
            }
          }}
          className="flex items-center gap-3 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded-xl p-1 -ml-1 transition"
          title="Return to Dashboard"
          aria-label="PackSure AI - Go to Dashboard"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-600 group-hover:bg-indigo-500 transition-colors flex items-center justify-center text-white shadow-sm ring-1 ring-white/10 shrink-0">
            <ShieldCheck size={24} className="stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white group-hover:text-indigo-200 transition-colors">
                PackSure AI
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hidden xs:inline-block">
                Compliance Intelligence
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block font-normal">
              AI-Powered Packaged Commodity Compliance Scanner
            </p>
          </div>
        </div>

        {/* Navigation & Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Nav back to Dashboard if in another view */}
          {currentView !== 'dashboard' && onNavigateDashboard && (
            <button
              id="header-nav-dashboard-btn"
              type="button"
              onClick={onNavigateDashboard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <LayoutDashboard size={14} />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
          )}

          {/* Mock / Live API Indicator & Toggle */}
          <button
            id="api-mode-toggle"
            type="button"
            onClick={onToggleMockMode}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/90 hover:bg-slate-700 active:bg-slate-800 text-slate-300 border border-slate-700/80 transition focus:outline-none focus:ring-2 focus:ring-indigo-400"
            title="Toggle between mock response mode and live API request"
            aria-label={`Switch API mode: currently ${isMockMode ? 'Mock Data' : 'Live /scan'}`}
          >
            <Layers size={13} className="text-slate-400" />
            <span className="hidden sm:inline text-slate-400">Mode:</span>
            <span className={`inline-flex items-center gap-1 font-semibold ${isMockMode ? 'text-amber-400' : 'text-emerald-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isMockMode ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              {isMockMode ? 'Mock' : 'Live /scan'}
            </span>
          </button>

          {/* New Inspection CTA */}
          {showNewInspectionBtn && (
            <button
              id="header-new-inspection-btn"
              type="button"
              onClick={onNewInspection}
              disabled={isScanning}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {isScanning ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <PlusCircle size={15} />
              )}
              <span>New Inspection</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

