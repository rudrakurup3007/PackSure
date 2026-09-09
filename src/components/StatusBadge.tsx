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

  const isCompliant = normalizedStatus === 'COMPLIANT' || normalizedStatus === 'PASSED';
  const isNonCompliant = normalizedStatus === 'NON_COMPLIANT' || normalizedStatus === 'FAILED';
  const isWarning =
    normalizedStatus === 'WARNING' ||
    normalizedStatus === 'REVIEW_REQUIRED' ||
    normalizedStatus === 'REVIEW_NEEDED' ||
    normalizedStatus === 'REVIEW REQUIRED';

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
        className={`inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/80 shadow-2xs font-semibold ${sizeClasses[size]}`}
      >
        {showIcon && <CheckCircle2 size={iconSizes[size]} className="text-emerald-600 dark:text-emerald-400 shrink-0 stroke-[2.2]" />}
        <span>COMPLIANT</span>
      </span>
    );
  }

  if (isNonCompliant) {
    return (
      <span
        id="status-badge-non-compliant"
        className={`inline-flex items-center rounded-full bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/80 shadow-2xs font-semibold ${sizeClasses[size]}`}
      >
        {showIcon && <XCircle size={iconSizes[size]} className="text-rose-600 dark:text-rose-400 shrink-0 stroke-[2.2]" />}
        <span>NON-COMPLIANT</span>
      </span>
    );
  }

  if (isWarning) {
    return (
      <span
        id="status-badge-warning"
        className={`inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/80 shadow-2xs font-semibold ${sizeClasses[size]}`}
      >
        {showIcon && <AlertTriangle size={iconSizes[size]} className="text-amber-600 dark:text-amber-400 shrink-0 stroke-[2.2]" />}
        <span>REVIEW NEEDED</span>
      </span>
    );
  }

  return (
    <span
      id="status-badge-unknown"
      className={`inline-flex items-center rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-semibold ${sizeClasses[size]}`}
    >
      <span>{status || 'PENDING'}</span>
    </span>
  );
};

