import React from 'react';

interface ComplianceScoreProps {
  score: number; // 0 - 100
  size?: 'sm' | 'md' | 'lg';
}

export const ComplianceScore: React.FC<ComplianceScoreProps> = ({ score, size = 'md' }) => {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));

  // Determine color based on standard compliance thresholds
  const isHigh = safeScore >= 85;
  const isMedium = safeScore >= 60 && safeScore < 85;

  const colorConfig = isHigh
    ? {
        stroke: '#059669', // Emerald
        text: 'text-emerald-800 dark:text-emerald-300',
        bg: 'bg-emerald-50/60 dark:bg-emerald-950/30',
        border: 'border-emerald-200/80 dark:border-emerald-800/60',
        label: 'High Compliance',
      }
    : isMedium
    ? {
        stroke: '#D97706', // Amber
        text: 'text-amber-800 dark:text-amber-300',
        bg: 'bg-amber-50/60 dark:bg-amber-950/30',
        border: 'border-amber-200/80 dark:border-amber-800/60',
        label: 'Violations Detected',
      }
    : {
        stroke: '#E11D48', // Rose
        text: 'text-rose-800 dark:text-rose-300',
        bg: 'bg-rose-50/60 dark:bg-rose-950/30',
        border: 'border-rose-200/80 dark:border-rose-800/60',
        label: 'Severe Non-Compliance',
      };

  const dimensions = {
    sm: { radius: 32, strokeWidth: 6, svgSize: 76, textSize: 'text-xl' },
    md: { radius: 40, strokeWidth: 7.5, svgSize: 96, textSize: 'text-2xl sm:text-3xl' },
    lg: { radius: 60, strokeWidth: 9, svgSize: 144, textSize: 'text-4xl sm:text-5xl' },
  }[size];

  const circumference = 2 * Math.PI * dimensions.radius;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  return (
    <div
      id="compliance-score-card"
      className={`flex items-center gap-3.5 sm:gap-4 p-4 sm:p-5 rounded-2xl border ${colorConfig.bg} ${colorConfig.border} shadow-xs transition-colors duration-200 overflow-hidden min-w-0 w-full max-w-full`}
    >
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          width={dimensions.svgSize}
          height={dimensions.svgSize}
          className="transform -rotate-90"
        >
          {/* Background circle track */}
          <circle
            cx={dimensions.svgSize / 2}
            cy={dimensions.svgSize / 2}
            r={dimensions.radius}
            stroke="currentColor"
            strokeWidth={dimensions.strokeWidth}
            className="text-slate-200 dark:text-slate-700"
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={dimensions.svgSize / 2}
            cy={dimensions.svgSize / 2}
            r={dimensions.radius}
            stroke={colorConfig.stroke}
            strokeWidth={dimensions.strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </svg>

        {/* Centered numeric score */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-black tracking-tight font-mono ${dimensions.textSize} ${colorConfig.text}`}>
            {safeScore}%
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-center space-y-1 min-w-0 flex-1 overflow-hidden">
        <span className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 break-words leading-tight">
          Compliance Score
        </span>
        <span className={`text-sm sm:text-base font-extrabold break-words leading-tight ${colorConfig.text}`}>
          {colorConfig.label}
        </span>
        <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-snug break-words">
          {safeScore >= 85
            ? 'Commodity meets Legal Metrology PCR 2011 standard requirements.'
            : 'Statutory violations detected requiring corrective notice.'}
        </p>
      </div>
    </div>
  );
};
