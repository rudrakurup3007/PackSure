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
        stroke: '#10b981', // emerald-500
        text: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-50/70 dark:bg-emerald-950/30',
        border: 'border-emerald-200 dark:border-emerald-800',
        label: 'High Compliance',
      }
    : isMedium
    ? {
        stroke: '#f59e0b', // amber-500
        text: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-50/70 dark:bg-amber-950/30',
        border: 'border-amber-200 dark:border-amber-800',
        label: 'Violations Detected',
      }
    : {
        stroke: '#ef4444', // red-500
        text: 'text-rose-700 dark:text-rose-400',
        bg: 'bg-rose-50/70 dark:bg-rose-950/30',
        border: 'border-rose-200 dark:border-rose-800',
        label: 'Severe Non-Compliance',
      };

  const dimensions = {
    sm: { radius: 36, strokeWidth: 7, svgSize: 88, textSize: 'text-2xl' },
    md: { radius: 52, strokeWidth: 9, svgSize: 128, textSize: 'text-3xl sm:text-4xl' },
    lg: { radius: 68, strokeWidth: 11, svgSize: 164, textSize: 'text-5xl' },
  }[size];

  const circumference = 2 * Math.PI * dimensions.radius;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  return (
    <div
      id="compliance-score-card"
      className={`flex items-center gap-5 p-5 rounded-2xl border ${colorConfig.bg} ${colorConfig.border} shadow-2xs`}
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

      <div className="flex flex-col justify-center space-y-1">
        <span className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
          Compliance Score
        </span>
        <span className={`text-base sm:text-lg font-extrabold ${colorConfig.text}`}>
          {colorConfig.label}
        </span>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
          {safeScore >= 85
            ? 'Commodity meets Legal Metrology PCR 2011 standard requirements.'
            : 'Statutory violations detected requiring corrective notice.'}
        </p>
      </div>
    </div>
  );
};
