import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Play,
  Eye,
  CheckCircle2,
  FileSearch,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { ScanResult } from '../types/inspection';
import {
  COMPLIANT_MOCK_SCAN_RESULT,
  DEFAULT_MOCK_SCAN_RESULT,
  REVIEW_REQUIRED_MOCK_SCAN_RESULT,
} from '../mock/scanResult';

export interface DemoScenarioItem {
  id: 'compliant' | 'non-compliant' | 'review-required';
  title: string;
  subtitle: string;
  badgeText: string;
  badgeVariant: 'compliant' | 'non-compliant' | 'warning';
  score: number;
  violationsCount: number;
  declarationsCount: number;
  description: string;
  keyAspects: string[];
  mockResult: ScanResult;
}

export const DEMO_SCENARIOS: DemoScenarioItem[] = [
  {
    id: 'compliant',
    title: 'Scenario 1: Fully Compliant Package',
    subtitle: 'Organic Whole Grain Oats (500g)',
    badgeText: '100% STATUTORY CLEARANCE',
    badgeVariant: 'compliant',
    score: 98,
    violationsCount: 0,
    declarationsCount: 5,
    description:
      'Exemplary compliance with all PCR 2011 provisions. Contains unit sale price (₹0.36/g) alongside MRP, standard SI units ("500 g"), FSSAI license, and registered facility.',
    keyAspects: [
      'Unit Sale Price (USP) declared cleanly per g',
      'Net Quantity with approved metric SI symbol',
      '14-Digit FSSAI License & Green Veg mark',
    ],
    mockResult: COMPLIANT_MOCK_SCAN_RESULT,
  },
  {
    id: 'non-compliant',
    title: 'Scenario 2: Non-Compliant Package',
    subtitle: 'Crunchy Bites Choco Biscuits (250g)',
    badgeText: 'STATUTORY INFRACTIONS FLAGGED',
    badgeVariant: 'non-compliant',
    score: 72,
    violationsCount: 2,
    declarationsCount: 6,
    description:
      'Realistic real-world infractions: Missing Unit Sale Price under Rule 6(1)(e) & bare numeral Net Quantity ("250" without "g") under Rule 9. Bound to spatial evidence.',
    keyAspects: [
      'Flagged: Missing USP on pack > 100g',
      'Flagged: Bare numeral without standard SI unit',
      'Instant spatial coordinate bounding boxes',
    ],
    mockResult: DEFAULT_MOCK_SCAN_RESULT,
  },
  {
    id: 'review-required',
    title: 'Scenario 3: Review Required / Low Confidence',
    subtitle: 'Artisan Spiced Herbal Chai (200g)',
    badgeText: 'HUMAN INSPECTOR REVIEW REQUIRED',
    badgeVariant: 'warning',
    score: 68,
    violationsCount: 2,
    declarationsCount: 6,
    description:
      'Edge case simulation with faint dot-matrix batch stamp (OCR confidence 62%) and partially cropped address fold. Demonstrates human-in-the-loop audit trigger.',
    keyAspects: [
      'Borderline OCR confidence threshold trigger',
      'Curved pouch fold obscuring facility PIN code',
      'Pre-flagged for officer review & manual verification',
    ],
    mockResult: REVIEW_REQUIRED_MOCK_SCAN_RESULT,
  },
];

interface DemoScenarioSelectorProps {
  onRunScenario: (scenarioId: 'compliant' | 'non-compliant' | 'review-required') => void;
  onQuickInspect: (result: ScanResult) => void;
  compact?: boolean;
}

export const DemoScenarioSelector: React.FC<DemoScenarioSelectorProps> = ({
  onRunScenario,
  onQuickInspect,
  compact = false,
}) => {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleRunClick = (scenarioId: 'compliant' | 'non-compliant' | 'review-required') => {
    if (activeAction) return;
    setActiveAction(`run-${scenarioId}`);
    timerRef.current = setTimeout(() => {
      setActiveAction(null);
      onRunScenario(scenarioId);
    }, 320);
  };

  const handleInspectClick = (scenarioId: string, result: ScanResult) => {
    if (activeAction) return;
    setActiveAction(`inspect-${scenarioId}`);
    timerRef.current = setTimeout(() => {
      setActiveAction(null);
      onQuickInspect(result);
    }, 280);
  };
  return (
    <div className="space-y-4" id="demo-scenarios-container">
      {!compact && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 mb-1">
              <Sparkles size={12} />
              Demonstration Suite
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              Three Representative Demonstration Scenarios
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evaluate PackSure AI across compliant, non-compliant, and edge-case packaging conditions.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DEMO_SCENARIOS.map((scenario) => {
          const isCompliant = scenario.badgeVariant === 'compliant';
          const isNonCompliant = scenario.badgeVariant === 'non-compliant';

          return (
            <div
              key={scenario.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md ${
                isCompliant
                  ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-400'
                  : isNonCompliant
                  ? 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900/60 hover:border-rose-400'
                  : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/60 hover:border-amber-400'
              }`}
            >
              <div className="space-y-3">
                {/* Header Badge */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase ${
                      isCompliant
                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300'
                        : isNonCompliant
                        ? 'bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-300'
                        : 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300'
                    }`}
                  >
                    {isCompliant ? (
                      <CheckCircle2 size={11} className="stroke-[2.5]" />
                    ) : isNonCompliant ? (
                      <AlertOctagon size={11} className="stroke-[2.5]" />
                    ) : (
                      <AlertTriangle size={11} className="stroke-[2.5]" />
                    )}
                    {scenario.badgeText}
                  </span>

                  <div className="flex items-center gap-1 font-mono text-xs font-extrabold">
                    <span
                      className={
                        scenario.score >= 85
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : scenario.score >= 70
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }
                    >
                      {scenario.score}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">/100</span>
                  </div>
                </div>

                {/* Scenario Title */}
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {scenario.subtitle}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    {scenario.title}
                  </p>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {scenario.description}
                </p>

                {/* Key Aspects Checklist */}
                <ul className="space-y-1.5 pt-1 text-[11px] text-slate-700 dark:text-slate-300">
                  {scenario.keyAspects.map((aspect, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-teal-700 dark:text-teal-400 font-bold shrink-0 mt-0.5">•</span>
                      <span>{aspect}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions: Run Scan Simulation vs Instant View */}
              <div className="pt-5 mt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <button
                  type="button"
                  disabled={activeAction !== null}
                  onClick={() => handleRunClick(scenario.id)}
                  className={`w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs transition-all duration-150 ${
                    activeAction === `run-${scenario.id}`
                      ? 'opacity-85 cursor-not-allowed'
                      : isCompliant
                      ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-[0.98] cursor-pointer'
                      : isNonCompliant
                      ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 active:scale-[0.98] cursor-pointer'
                      : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 active:scale-[0.98] cursor-pointer'
                  }`}
                >
                  {activeAction === `run-${scenario.id}` ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Loading Live Inspection...</span>
                    </>
                  ) : (
                    <>
                      <Play size={13} className="fill-current" />
                      <span>Run Live Inspection</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={activeAction !== null}
                  onClick={() => handleInspectClick(scenario.id, scenario.mockResult)}
                  className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-150 active:scale-[0.98] ${
                    activeAction === `inspect-${scenario.id}` ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  {activeAction === `inspect-${scenario.id}` ? (
                    <>
                      <RefreshCw size={13} className="animate-spin text-slate-400" />
                      <span>Opening Audit...</span>
                    </>
                  ) : (
                    <>
                      <Eye size={13} />
                      <span>Instant Results Audit</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
