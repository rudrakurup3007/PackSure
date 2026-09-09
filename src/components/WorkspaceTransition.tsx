import React, { useEffect, useState, useRef } from 'react';
import {
  ShieldCheck,
  Scale,
  ScanLine,
  LayoutDashboard,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface WorkspaceTransitionProps {
  onComplete: () => void;
  durationMs?: number;
}

interface TelemetryStep {
  id: string;
  label: string;
  sub: string;
  threshold: number;
}

const TELEMETRY_STEPS: TelemetryStep[] = [
  {
    id: 'rules',
    label: 'Statutory Rule Engine',
    sub: 'Legal Metrology (PCR 2011) & FSSAI provisions',
    threshold: 25,
  },
  {
    id: 'ocr',
    label: 'Multi-Surface OCR Pipeline',
    sub: 'Pixel-level spatial evidence mapping',
    threshold: 60,
  },
  {
    id: 'dashboard',
    label: 'Compliance Ledger',
    sub: 'Operational shift KPIs & inspection history',
    threshold: 90,
  },
];

export const WorkspaceTransition: React.FC<WorkspaceTransitionProps> = ({
  onComplete,
  durationMs = 2400,
}) => {
  const [progress, setProgress] = useState<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const completedRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const failsafeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFinish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (failsafeTimeoutRef.current) {
      clearTimeout(failsafeTimeoutRef.current);
    }
    onComplete();
  };

  useEffect(() => {
    startTimeRef.current = Date.now();
    completedRef.current = false;

    // Failsafe timeout to guarantee the user is NEVER trapped on this screen
    failsafeTimeoutRef.current = setTimeout(() => {
      handleFinish();
    }, durationMs + 800);

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const rawProgress = Math.min(100, (elapsed / durationMs) * 100);

      // Smooth progress update
      setProgress(rawProgress);

      if (rawProgress >= 100) {
        // Brief moment at 100% before triggering transition
        setTimeout(handleFinish, 120);
      } else {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (failsafeTimeoutRef.current) {
        clearTimeout(failsafeTimeoutRef.current);
      }
    };
  }, [durationMs]);

  // Current primary phase text based on progress
  let phaseStatus = 'Preparing your inspection workspace';
  let phaseDetail = 'Loading the Legal Metrology compliance rule set...';

  if (progress > 30 && progress <= 70) {
    phaseStatus = 'Setting up rule & evidence pipelines';
    phaseDetail = 'Calibrating multi-surface OCR mapping and verification checks...';
  } else if (progress > 70) {
    phaseStatus = 'Workspace ready';
    phaseDetail = 'Connecting to your inspection history and dashboard...';
  }

  return (
    <div
      id="workspace-transition-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none px-4 sm:px-6 overflow-hidden transition-colors"
    >
      {/* Subtle geometric grid background, quiet in both themes */}
      <div
        className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(#145967 1px, transparent 1px), radial-gradient(#145967 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          backgroundPosition: '0 0, 16px 16px',
        }}
        aria-hidden="true"
      />

      {/* Central inspection panel */}
      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center text-center space-y-6">
        {/* Inspection shield mark */}
        <div className="relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24">
          <div className="absolute -inset-2 rounded-2xl border border-teal-600/20 dark:border-teal-500/20" />

          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm overflow-hidden">
            {/* Restrained scanning sweep */}
            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-teal-500 dark:via-teal-400 to-transparent animate-scan-beam opacity-70" />

            <ShieldCheck size={34} className="text-teal-700 dark:text-teal-400 stroke-[1.8]" />
          </div>
        </div>

        {/* Status text */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-900/60 text-teal-800 dark:text-teal-300 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 animate-pulse" />
            <span>PackSure AI</span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {phaseStatus}
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            {phaseDetail}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full space-y-2">
          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-teal-600 dark:bg-teal-500 transition-all duration-75 ease-out"
              style={{ width: `${Math.min(100, Math.max(4, progress))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <ScanLine size={12} className="text-teal-600 dark:text-teal-400" />
              <span>Initializing modules</span>
            </span>
            <span className="text-teal-700 dark:text-teal-300 font-semibold">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Checkpoints */}
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 text-left space-y-2.5 shadow-xs">
          {TELEMETRY_STEPS.map((step) => {
            const isReady = progress >= step.threshold;
            return (
              <div
                key={step.id}
                className="flex items-center justify-between gap-3 text-xs transition-colors duration-200"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      isReady
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {isReady ? (
                      <CheckCircle2 size={11} className="stroke-[2.5]" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                    )}
                  </div>
                  <div className="truncate">
                    <span
                      className={`font-semibold transition-colors ${
                        isReady ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="hidden sm:inline text-[11px] text-slate-400 dark:text-slate-500 ml-2">
                      ({step.sub})
                    </span>
                  </div>
                </div>

                <span
                  className={`font-mono text-[10px] uppercase tracking-wider shrink-0 font-medium ${
                    isReady ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {isReady ? 'Ready' : 'Loading...'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Skip control */}
        <div className="pt-2 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleFinish}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors py-1 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <span>Skip to dashboard</span>
            <ArrowRight size={13} />
          </button>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            Legal Metrology (Packaged Commodities) Rules, 2011
          </span>
        </div>
      </div>
    </div>
  );
};
