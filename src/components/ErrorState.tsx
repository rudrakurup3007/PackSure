import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft, WifiOff } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onGoBack?: () => void;
  isNetworkError?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Inspection Error',
  message,
  onRetry,
  onGoBack,
  isNetworkError = false,
}) => {
  return (
    <div
      id="error-state-card"
      role="alert"
      className="max-w-lg mx-auto my-12 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200/90 dark:border-rose-900/60 shadow-xs text-center space-y-6"
    >
      <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/40 shadow-xs">
        {isNetworkError ? <WifiOff size={30} className="stroke-[2.2]" /> : <AlertTriangle size={30} className="stroke-[2.2]" />}
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
          {message}
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-rose-400"
          >
            <RefreshCw size={15} />
            <span>Try Again</span>
          </button>
        )}

        {onGoBack && (
          <button
            type="button"
            onClick={onGoBack}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 transition-colors duration-150 shadow-xs focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <ArrowLeft size={15} />
            <span>Return to Upload</span>
          </button>
        )}
      </div>
    </div>
  );
};

