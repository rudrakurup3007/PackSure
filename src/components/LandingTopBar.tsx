import React from 'react';
import { ShieldCheck, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const LandingTopBar: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header
      id="landing-top-bar"
      className="bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white sticky top-0 z-40 shadow-2xs transition-colors duration-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand identity */}
        <div
          id="landing-brand"
          className="flex items-center gap-3 select-none shrink-0"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-800 flex items-center justify-center text-white shadow-xs ring-1 ring-black/5 dark:ring-white/10 shrink-0">
            <ShieldCheck size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
                PackSure AI
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/80 hidden md:inline-block">
                Compliance Intelligence
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden lg:block font-normal">
              AI-Powered Packaged Commodity Compliance Scanner
            </p>
          </div>
        </div>

        {/* Right utility: Theme Toggle ONLY */}
        <div className="flex items-center">
          <button
            id="landing-theme-toggle-btn"
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900/90 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 transition-all duration-150 cursor-pointer shadow-2xs active:scale-90 hover:rotate-12 focus:outline-none focus:ring-2 focus:ring-teal-400 shrink-0"
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          >
            {isDark ? (
              <Sun size={16} className="text-amber-400 stroke-[2.2]" />
            ) : (
              <Moon size={16} className="text-teal-700 stroke-[2.2]" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
