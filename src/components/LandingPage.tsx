import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  ArrowRight,
  Sparkles,
  FileText,
  Scale,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Cpu,
  ScanLine,
  LayoutDashboard,
  Check,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

interface LandingPageProps {
  onNavigateDashboard: () => void;
  onRunInteractiveDemo: () => void;
  isTransitioningToDashboard?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigateDashboard,
  onRunInteractiveDemo,
  isTransitioningToDashboard = false,
}) => {
  const [isStartingDemo, setIsStartingDemo] = useState<boolean>(false);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timers on component unmount
  useEffect(() => {
    return () => {
      if (demoTimerRef.current) {
        clearTimeout(demoTimerRef.current);
      }
    };
  }, []);

  const handleDashboardClick = () => {
    if (isTransitioningToDashboard || isStartingDemo) return;
    onNavigateDashboard();
  };

  const handleDemoClick = () => {
    if (isStartingDemo || isTransitioningToDashboard) return;
    setIsStartingDemo(true);
    demoTimerRef.current = setTimeout(() => {
      setIsStartingDemo(false);
      onRunInteractiveDemo();
    }, 400);
  };
  const trustTechStrip = [
    {
      label: 'OCR',
      desc: 'Multi-surface text extraction',
      icon: ScanLine,
    },
    {
      label: 'Rule Engine',
      desc: 'Legal Metrology (PCR 2011) validation',
      icon: Scale,
    },
    {
      label: 'Evidence Mapping',
      desc: 'Pixel-level spatial bounding boxes',
      icon: MapPin,
    },
    {
      label: 'Audit-ready Output',
      desc: 'Itemized violation explanations',
      icon: CheckCircle2,
    },
  ];

  const statutoryHighlights = [
    {
      code: 'Rule 6(1)(e)',
      name: 'MRP & Unit Sale Price',
      desc: 'Detects missing Unit Sale Price (USP) declarations alongside Maximum Retail Price on packages.',
    },
    {
      code: 'Rule 9 & Sched. II',
      name: 'Net Quantity Units & Ratios',
      desc: 'Validates mandatory metric SI units (g, kg, ml, l) and minimum font size to packaging area ratios.',
    },
    {
      code: 'Rule 6(1)(a)',
      name: 'Manufacturer & Packer Details',
      desc: 'Audits complete corporate facility registration, production location, and origin declarations.',
    },
    {
      code: 'FSSAI Sec 23',
      name: 'License & Consumer Care',
      desc: 'Extracts 14-digit FSSAI licenses, consumer grievance emails, helplines, and dates.',
    },
  ];

  return (
    <div id="landing-page" className="space-y-16 pb-16 transition-colors duration-200">
      {/* 1. HERO SECTION */}
      <section
        id="landing-hero"
        className="relative bg-slate-100/35 dark:bg-slate-950/25 text-slate-900 dark:text-white pt-12 sm:pt-16 pb-16 sm:pb-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200"
      >
        <div className="relative max-w-5xl mx-auto text-center space-y-7">
          {/* Context & Classification Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white dark:bg-slate-900/90 text-teal-800 dark:text-teal-300 text-xs font-semibold border border-teal-200 dark:border-teal-800/80 shadow-2xs backdrop-blur-xs">
            <span className="w-2 h-2 rounded-full bg-teal-600 dark:bg-teal-400 animate-pulse" />
            <span className="tracking-tight text-slate-800 dark:text-white font-medium">
              Evidence-First • Regulatory Intelligence
            </span>
          </div>

          {/* Brand & Subtitle */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-center gap-2 text-teal-700 dark:text-teal-400 font-mono text-xs sm:text-sm font-semibold tracking-wider uppercase">
              <ShieldCheck size={18} className="text-teal-700 dark:text-teal-400" />
              <span>Compliance Intelligence Platform</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              PACKSURE AI
            </h1>
          </div>

          {/* Main Headline */}
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight max-w-3xl mx-auto leading-tight sm:leading-tight">
            &ldquo;Verify every package.{' '}
            <span className="text-teal-800 dark:text-teal-300">
              Explain every violation.
            </span>
            &rdquo;
          </h2>

          {/* Concise Explanation */}
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            PackSure AI combines package image analysis, multi-surface OCR, statutory rule
            evaluation, and spatial evidence mapping to help compliance officers and quality teams
            identify and explain Legal Metrology compliance issues.
          </p>

          {/* Two Prominent Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 max-w-md mx-auto">
            {/* PRIMARY CTA: Enter Live Dashboard (ONE CLICK) */}
            <button
              id="landing-enter-dashboard-btn"
              type="button"
              disabled={isTransitioningToDashboard || isStartingDemo}
              onClick={handleDashboardClick}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl text-sm sm:text-base font-semibold shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                isTransitioningToDashboard
                  ? 'bg-teal-900 text-teal-100 cursor-not-allowed opacity-90'
                  : 'bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white hover:shadow-teal-900/20 active:scale-[0.98] cursor-pointer'
              }`}
            >
              {isTransitioningToDashboard ? (
                <>
                  <ShieldCheck size={18} className="text-teal-200 animate-pulse stroke-[2.2]" />
                  <span>Launching Workspace...</span>
                  <ArrowRight size={18} className="stroke-[2.2] animate-pulse" />
                </>
              ) : (
                <>
                  <LayoutDashboard size={18} />
                  <span>Enter Live Dashboard</span>
                  <ArrowRight size={18} className="stroke-[2.2]" />
                </>
              )}
            </button>

            {/* SECONDARY CTA: Run Interactive Demo */}
            <button
              id="landing-run-demo-btn"
              type="button"
              disabled={isStartingDemo || isTransitioningToDashboard}
              onClick={handleDemoClick}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm sm:text-base font-semibold border shadow-2xs transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                isStartingDemo
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700 cursor-not-allowed'
                  : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/90 dark:hover:bg-slate-800 dark:active:bg-slate-900 dark:text-slate-200 dark:border-slate-700 active:scale-[0.98] cursor-pointer'
              }`}
            >
              {isStartingDemo ? (
                <>
                  <RefreshCw size={17} className="text-amber-500 animate-spin shrink-0" />
                  <span>Preparing Demo Package...</span>
                </>
              ) : (
                <>
                  <Sparkles size={17} className="text-amber-500 dark:text-amber-400 shrink-0" />
                  <span>Run Interactive Demo</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            No registration required. Instant one-click access to operational metrics or automated commodity scan.
          </p>
        </div>
      </section>

      {/* 2. TRUST / TECHNOLOGY STRIP */}
      <section
        id="landing-trust-strip"
        aria-label="Technology and Core Processing Capabilities"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10"
      >
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-5 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
            {trustTechStrip.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  id={`trust-tech-step-${idx + 1}`}
                  className={`flex items-center gap-3.5 ${idx > 0 ? 'pt-3 md:pt-0 md:pl-6' : ''}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center shrink-0 border border-teal-100 dark:border-teal-900/50">
                    <Icon size={19} className="stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      {item.label}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. MINIMAL COMPLIANCE & SCANNING VISUAL MOCKUP */}
      <section
        id="landing-preview-mockup"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6"
      >
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Automated Inspection Workflow
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            From multi-surface packaging inputs to rule-verified evidence outputs in seconds.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs space-y-8">
          {/* Pipeline visual steps */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left: Simulated Multi-Surface Package Image Inspection with minimal scanner bar */}
            <div className="lg:col-span-7 bg-slate-950 rounded-xl p-5 border border-slate-800 text-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-mono text-slate-300">INSPECTION TARGET: BISCUITS_PKG_01</span>
                </div>
                <span className="font-mono text-teal-300 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/60">
                  Surface 2/3 (Back Panel)
                </span>
              </div>

              {/* Package Surface Simulation Container with Bounding Boxes */}
              <div className="relative bg-slate-900 rounded-lg p-4 border border-slate-800 text-xs font-mono space-y-3">
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>MANDATORY STATUTORY DECLARATIONS</span>
                  <span className="text-amber-400">2 Violations Flagged</span>
                </div>

                {/* Simulated Bounding Box 1: Non-Compliant Net Quantity */}
                <div className="p-3 rounded-lg border-2 border-rose-500 bg-rose-500/10 text-rose-200 space-y-1 relative">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-400">NET QTY: 250</span>
                    <span className="text-[10px] bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded border border-rose-800">
                      Rule PCR-R9 Violation
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-300 font-sans">
                    No standard metric SI unit found (bare numeral &apos;250&apos; without g/kg).
                  </p>
                </div>

                {/* Simulated Bounding Box 2: Compliant Expiry */}
                <div className="p-3 rounded-lg border border-emerald-500/60 bg-emerald-500/10 text-emerald-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400">BEST BEFORE 12/2026</span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800">
                      Rule PCR-R6(1)(d) Compliant
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans">
                    Statutory month and year statement verified.
                  </p>
                </div>

                {/* Simulated Bounding Box 3: Non-Compliant Unit Sale Price */}
                <div className="p-3 rounded-lg border-2 border-rose-500 bg-rose-500/10 text-rose-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-400">MRP: Rs.45.00</span>
                    <span className="text-[10px] bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded border border-rose-800">
                      Rule PCR-R14 Violation
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-300 font-sans">
                    Unit sale price (USP per g/100g) missing alongside retail price.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Automated Evaluation Output Summary */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Compliance Audit Report
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                    NON-COMPLIANT
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                    72
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    / 100 Statutory Compliance Score
                  </span>
                </div>

                <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700/80 text-xs">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span>Declarations Analyzed:</span>
                    <span className="font-mono font-semibold">6 fields</span>
                  </div>
                  <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 font-medium">
                    <span>Statutory Infractions:</span>
                    <span className="font-mono font-bold">2 violations</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span>Mean OCR Confidence:</span>
                    <span className="font-mono font-semibold">94.2%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isTransitioningToDashboard || isStartingDemo}
                  onClick={handleDashboardClick}
                  className={`w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-xs transition-colors duration-150 ${
                    isTransitioningToDashboard
                      ? 'bg-teal-900/80 cursor-not-allowed opacity-90'
                      : 'bg-teal-800 hover:bg-teal-900 active:bg-teal-950 cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  {isTransitioningToDashboard ? (
                    <>
                      <ShieldCheck size={16} className="text-teal-200 animate-pulse" />
                      <span>Initializing Workspace...</span>
                    </>
                  ) : (
                    <>
                      <span>Open Live Operations Dashboard</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. STATUTORY STANDARDS & RULE ENGINE */}
      <section
        id="landing-statutory-rules"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6"
      >
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Statutory Legal Framework
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Configured against the Legal Metrology (Packaged Commodities) Rules, 2011 and FSSAI packaging regulations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {statutoryHighlights.map((rule) => (
            <div
              key={rule.code}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-150"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-md border border-teal-100 dark:border-teal-900/60">
                  {rule.code}
                </span>
                <Scale size={15} className="text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white pt-1">
                {rule.name}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {rule.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. BOTTOM CTA BANNER */}
      <section
        id="landing-bottom-cta"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 sm:p-10 text-center text-white space-y-6">
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ready to verify packaging compliance?
            </h2>
            <p className="text-slate-300 text-sm sm:text-base">
              Enter the operational command center to inspect commodities or run an interactive demo with pre-configured multi-panel packages.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <button
              type="button"
              disabled={isTransitioningToDashboard || isStartingDemo}
              onClick={handleDashboardClick}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-xs transition-colors duration-150 ${
                isTransitioningToDashboard
                  ? 'bg-teal-900/80 cursor-not-allowed opacity-90'
                  : 'bg-teal-800 hover:bg-teal-700 active:bg-teal-900 cursor-pointer active:scale-[0.98]'
              }`}
            >
              {isTransitioningToDashboard ? (
                <>
                  <ShieldCheck size={17} className="text-teal-200 animate-pulse" />
                  <span>Launching Workspace...</span>
                </>
              ) : (
                <>
                  <LayoutDashboard size={17} />
                  <span>Enter Live Dashboard</span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={isStartingDemo || isTransitioningToDashboard}
              onClick={handleDemoClick}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold border shadow-xs transition-colors duration-150 ${
                isStartingDemo
                  ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-slate-800 active:bg-slate-900 text-slate-200 border-slate-700 cursor-pointer active:scale-[0.98]'
              }`}
            >
              {isStartingDemo ? (
                <>
                  <RefreshCw size={16} className="text-amber-400 animate-spin shrink-0" />
                  <span>Preparing Demo...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} className="text-amber-400" />
                  <span>Run Interactive Demo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
