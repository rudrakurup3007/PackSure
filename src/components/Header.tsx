import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  Layers,
  LayoutDashboard,
  History,
  TrendingUp,
  BookOpen,
  Sliders,
  ClipboardCheck,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  onNavigateLanding?: () => void;
  onNavigateDashboard?: () => void;
  onNavigateHistory?: () => void;
  onNavigateAnalytics?: () => void;
  onNavigateRules?: () => void;
  onNavigateSettings?: () => void;
  onNavigateReport?: () => void;
  currentView?: string;
  isScanning?: boolean;
  isMockMode?: boolean;
  onToggleMockMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigateLanding,
  onNavigateDashboard,
  onNavigateHistory,
  onNavigateAnalytics,
  onNavigateRules,
  onNavigateSettings,
  onNavigateReport,
  currentView = 'dashboard',
  isScanning = false,
  isMockMode = true,
  onToggleMockMode,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastClickRef = useRef<number>(0);

  const handleNavClick = (callback?: () => void) => {
    const now = Date.now();
    if (now - lastClickRef.current < 350) return;
    lastClickRef.current = now;
    setMobileMenuOpen(false);
    callback?.();
  };

  return (
    <header
      id="app-header"
      className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white sticky top-0 z-40 shadow-xs transition-colors duration-200"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Brand identity */}
        <div
          id="header-brand-container"
          onClick={() => handleNavClick(onNavigateLanding || onNavigateDashboard)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleNavClick(onNavigateLanding || onNavigateDashboard);
            }
          }}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-teal-500 rounded-xl p-1 -ml-1 transition duration-150 shrink-0"
          title="PackSure AI Compliance Platform"
          aria-label="PackSure AI - Go to Home"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-teal-800 group-hover:bg-teal-700 transition-colors duration-150 flex items-center justify-center text-white shadow-xs ring-1 ring-black/5 dark:ring-white/10 shrink-0">
            <ShieldCheck size={18} className="sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base lg:text-lg tracking-tight text-slate-900 dark:text-white group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors duration-150 whitespace-nowrap">
                PackSure AI
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/80 hidden xl:inline-block">
                Compliance Intelligence
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden xl:block font-normal">
              AI-Powered Packaged Commodity Compliance Scanner
            </p>
          </div>
        </div>

        {/* Desktop / Tablet Navigation Items */}
        <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Dashboard link */}
          {onNavigateDashboard && (
            <button
              id="header-nav-dashboard-btn"
              type="button"
              onClick={() => handleNavClick(onNavigateDashboard)}
              aria-current={currentView === 'dashboard' ? 'page' : undefined}
              aria-label="Dashboard"
              className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                currentView === 'dashboard'
                  ? 'bg-teal-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80'
              }`}
              title="Dashboard"
            >
              <LayoutDashboard size={14} className="shrink-0" />
              <span>Dashboard</span>
            </button>
          )}

          {/* History link */}
          {onNavigateHistory && (
            <button
              id="header-nav-history-btn"
              type="button"
              onClick={() => handleNavClick(onNavigateHistory)}
              aria-current={currentView === 'history' ? 'page' : undefined}
              aria-label="Inspection History"
              className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                currentView === 'history'
                  ? 'bg-teal-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80'
              }`}
              title="Inspection History"
            >
              <History size={14} className="shrink-0" />
              <span>History</span>
            </button>
          )}

          {/* Analytics link */}
          {onNavigateAnalytics && (
            <button
              id="header-nav-analytics-btn"
              type="button"
              onClick={() => handleNavClick(onNavigateAnalytics)}
              aria-current={currentView === 'analytics' ? 'page' : undefined}
              aria-label="Compliance Analytics"
              className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                currentView === 'analytics'
                  ? 'bg-teal-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80'
              }`}
              title="Compliance Analytics"
            >
              <TrendingUp size={14} className="shrink-0" />
              <span className="hidden lg:inline">Analytics</span>
            </button>
          )}

          {/* Rule Library link */}
          {onNavigateRules && (
            <button
              id="header-nav-rules-btn"
              type="button"
              onClick={() => handleNavClick(onNavigateRules)}
              aria-current={currentView === 'rules' ? 'page' : undefined}
              aria-label="Statutory Rule Library"
              className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                currentView === 'rules'
                  ? 'bg-teal-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80'
              }`}
              title="Statutory Rule Library"
            >
              <BookOpen size={14} className="shrink-0" />
              <span className="hidden lg:inline">Rule Library</span>
            </button>
          )}

          {/* Settings link */}
          {onNavigateSettings && (
            <button
              id="header-nav-settings-btn"
              type="button"
              onClick={() => handleNavClick(onNavigateSettings)}
              aria-current={currentView === 'settings' ? 'page' : undefined}
              aria-label="Settings and System Configuration"
              className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                currentView === 'settings'
                  ? 'bg-teal-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80'
              }`}
              title="Settings & System Configuration"
            >
              <Sliders size={14} className="shrink-0" />
              <span className="hidden xl:inline">Settings</span>
            </button>
          )}

          {/* Official Compliance Audit Report Navigation */}
          {onNavigateReport && (
            <button
              id="header-nav-report-btn"
              type="button"
              onClick={() => handleNavClick(onNavigateReport)}
              aria-current={currentView === 'results' || currentView === 'report' ? 'page' : undefined}
              aria-label="Official Compliance Audit Report"
              className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                currentView === 'results' || currentView === 'report'
                  ? 'bg-teal-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80'
              }`}
              title="Official Compliance Audit Report"
            >
              <ClipboardCheck size={14} className="shrink-0" />
              <span className="hidden xl:inline">Audit Report</span>
            </button>
          )}

          {/* Mock / Live API Indicator & Toggle */}
          <button
            id="api-mode-toggle"
            type="button"
            onClick={onToggleMockMode}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 transition-all duration-150 cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 shrink-0"
            title="Toggle between mock response mode and live API request"
            aria-label={`Switch API mode: currently ${isMockMode ? 'Mock Data' : 'Live /scan'}`}
          >
            <Layers size={13} className="text-slate-400 hidden xl:inline shrink-0" />
            <span className={`inline-flex items-center gap-1.5 font-semibold ${isMockMode ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isMockMode ? 'bg-amber-500 dark:bg-amber-400' : 'bg-emerald-500 dark:bg-emerald-400'}`} />
              <span className="hidden lg:inline">{isMockMode ? 'Mock' : 'Live /scan'}</span>
              <span className="lg:hidden">{isMockMode ? 'Mock' : 'Live'}</span>
            </span>
          </button>

          {/* Theme Toggle (Light / Dark Mode) */}
          <button
            id="theme-toggle-btn"
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 transition-all duration-150 cursor-pointer shadow-2xs active:scale-90 hover:rotate-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 shrink-0"
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          >
            {isDark ? (
              <Sun size={15} className="text-amber-400 stroke-[2.2]" />
            ) : (
              <Moon size={15} className="text-teal-800 stroke-[2.2]" />
            )}
          </button>
        </nav>

        {/* Mobile Header Controls (< md) */}
        <div className="flex md:hidden items-center gap-1 shrink-0">
          {/* Quick Dashboard link */}
          {onNavigateDashboard && (
            <button
              type="button"
              onClick={onNavigateDashboard}
              aria-label="Dashboard"
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                currentView === 'dashboard'
                  ? 'bg-teal-800 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Dashboard"
            >
              <LayoutDashboard size={16} />
            </button>
          )}

          {/* Quick History link */}
          {onNavigateHistory && (
            <button
              type="button"
              onClick={onNavigateHistory}
              aria-label="Inspection History"
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                currentView === 'history'
                  ? 'bg-teal-800 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Inspection History"
            >
              <History size={16} />
            </button>
          )}

          {/* Compact Mock / Live Indicator */}
          <button
            type="button"
            onClick={onToggleMockMode}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
            title={`API Mode: ${isMockMode ? 'Mock Data' : 'Live /scan'}`}
            aria-label={`API Mode: ${isMockMode ? 'Mock Data' : 'Live /scan'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isMockMode ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span className={isMockMode ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
              {isMockMode ? 'Mock' : 'Live'}
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          >
            {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-teal-800" />}
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            id="mobile-menu-toggle-btn"
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            className="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown (< md) */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-drawer"
          className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/98 dark:bg-slate-950/98 px-4 py-3 space-y-1 shadow-lg animate-in slide-in-from-top-2 duration-150"
        >
          {onNavigateDashboard && (
            <button
              type="button"
              onClick={() => handleNavClick(onNavigateDashboard)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[44px] ${
                currentView === 'dashboard'
                  ? 'bg-teal-800 text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard size={17} />
              <span>Operational Dashboard</span>
            </button>
          )}

          {onNavigateHistory && (
            <button
              type="button"
              onClick={() => handleNavClick(onNavigateHistory)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[44px] ${
                currentView === 'history'
                  ? 'bg-teal-800 text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <History size={17} />
              <span>Inspection History Archive</span>
            </button>
          )}

          {onNavigateAnalytics && (
            <button
              type="button"
              onClick={() => handleNavClick(onNavigateAnalytics)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[44px] ${
                currentView === 'analytics'
                  ? 'bg-teal-800 text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <TrendingUp size={17} />
              <span>Compliance Analytics</span>
            </button>
          )}

          {onNavigateRules && (
            <button
              type="button"
              onClick={() => handleNavClick(onNavigateRules)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[44px] ${
                currentView === 'rules'
                  ? 'bg-teal-800 text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <BookOpen size={17} />
              <span>Statutory Rule Library (PCR 2011)</span>
            </button>
          )}

          {onNavigateReport && (
            <button
              type="button"
              onClick={() => handleNavClick(onNavigateReport)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[44px] ${
                currentView === 'results' || currentView === 'report'
                  ? 'bg-teal-800 text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <ClipboardCheck size={17} />
              <span>Current Audit Report</span>
            </button>
          )}

          {onNavigateSettings && (
            <button
              type="button"
              onClick={() => handleNavClick(onNavigateSettings)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[44px] ${
                currentView === 'settings'
                  ? 'bg-teal-800 text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Sliders size={17} />
              <span>System Settings</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};

