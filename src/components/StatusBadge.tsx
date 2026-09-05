import React from 'react';
import { ComplianceStatus } from '../types/inspection';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface StatusBadgeProps {
  status: ComplianceStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
}) => {
  const normalizedStatus = (status || '').toUpperCase();

  const isCompliant = normalizedStatus === 'COMPLIANT';
  const isNonCompliant = normalizedStatus === 'NON_COMPLIANT';
  const isWarning = normalizedStatus === 'WARNING';

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-0.5 gap-1.5 font-bold',
    md: 'text-xs sm:text-sm px-3 py-1 gap-1.5 font-bold',
    lg: 'text-sm sm:text-base px-4 py-2 gap-2 font-extrabold tracking-wide',
  };

  const iconSizes = {
    sm: 13,
    md: 16,
    lg: 19,
  };

  if (isCompliant) {
    return (
      <span
        id="status-badge-compliant"
        className={`inline-flex items-center rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700 shadow-2xs ${sizeClasses[size]}`}
      >
        {showIcon && <CheckCircle2 size={iconSizes[size]} className="text-emerald-600 dark:text-emerald-400 shrink-0 stroke-[2.5]" />}
        <span>COMPLIANT</span>
      </span>
    );
  }

  if (isNonCompliant) {
    return (
      <span
        id="status-badge-non-compliant"
        className={`inline-flex items-center rounded-xl bg-rose-50 text-rose-950 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-700 shadow-2xs ${sizeClasses[size]}`}
      >
        {showIcon && <XCircle size={iconSizes[size]} className="text-rose-600 dark:text-rose-400 shrink-0 stroke-[2.5]" />}
        <span>NON-COMPLIANT</span>
      </span>
    );
  }

  if (isWarning) {
    return (
      <span
        id="status-badge-warning"
        className={`inline-flex items-center rounded-xl bg-amber-50 text-amber-950 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700 shadow-2xs ${sizeClasses[size]}`}
      >
        {showIcon && <AlertTriangle size={iconSizes[size]} className="text-amber-600 dark:text-amber-400 shrink-0 stroke-[2.5]" />}
        <span>REVIEW NEEDED</span>
      </span>
    );
  }

  return (
    <span
      id="status-badge-unknown"
      className={`inline-flex items-center rounded-xl bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 ${sizeClasses[size]}`}
    >
      <span>{status || 'PENDING'}</span>
    </span>
  );
};

