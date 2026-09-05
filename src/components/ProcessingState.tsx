import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Scan, Sparkles } from 'lucide-react';

interface ProcessingStateProps {
  imageCount: number;
}

const STAGES = [
  { id: 1, label: 'Reading package information' },
  { id: 2, label: 'Extracting declarations' },
  { id: 3, label: 'Checking compliance' },
  { id: 4, label: 'Preparing results' },
];

export const ProcessingState: React.FC<ProcessingStateProps> = ({ imageCount }) => {
  const [activeStage, setActiveStage] = useState(1);

  // Progressive stage cycler (visual presentation only)
  useEffect(() => {
    const timer1 = setTimeout(() => setActiveStage(2), 600);
    const timer2 = setTimeout(() => setActiveStage(3), 1200);
    const timer3 = setTimeout(() => setActiveStage(4), 1800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div
      id="processing-state-container"
      className="max-w-2xl mx-auto my-12 p-8 sm:p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm text-center space-y-6"
    >
      {/* Animated Radar/Scan Icon */}
      <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-indigo-500/15 animate-ping opacity-75" />
        <div className="relative w-18 h-18 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
          <Scan size={36} className="animate-pulse stroke-[2.2]" />
        </div>
      </div>

      {/* Main Title & Subtitle */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800">
          <Loader2 size={13} className="animate-spin text-indigo-600 dark:text-indigo-400" />
          <span>Statutory Inspection in Progress</span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight uppercase">
          ANALYZING PACKAGE
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Processing {imageCount} package photograph{imageCount > 1 ? 's' : ''} through the Legal Metrology compliance evaluation engine.
        </p>
      </div>

      {/* Visual Pipeline Stages */}
      <div className="max-w-md mx-auto text-left bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
        {STAGES.map((stage) => {
          const isDone = activeStage > stage.id;
          const isCurrent = activeStage === stage.id;

          return (
            <div
              key={stage.id}
              className={`flex items-center gap-3 text-xs transition-colors ${
                isDone
                  ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                  : isCurrent
                  ? 'text-indigo-700 dark:text-indigo-300 font-bold'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <div className="shrink-0">
                {isDone ? (
                  <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                ) : isCurrent ? (
                  <Loader2 size={18} className="animate-spin text-indigo-600 dark:text-indigo-400 stroke-[2.5]" />
                ) : (
                  <div className="w-4.5 h-4.5 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[10px] font-mono">
                    {stage.id}
                  </div>
                )}
              </div>
              <span className="flex-1 text-sm">{stage.label}</span>
            </div>
          );
        })}
      </div>

      {/* Honest Presentation Note */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
        <Sparkles size={14} className="text-amber-500 shrink-0" />
        <span>Evaluating PCR 2011 declarations & spatial evidence coordinates</span>
      </div>
    </div>
  );
};
