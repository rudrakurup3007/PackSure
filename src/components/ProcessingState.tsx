import React, { useEffect, useState, useRef } from 'react';
import { UploadedImageFile } from '../types/inspection';
import {
  Loader2,
  CheckCircle2,
  Scan,
  ShieldCheck,
  Cpu,
  FileCheck2,
  Crosshair,
  Layers,
  ArrowRight,
  Sparkles,
  Package,
  Activity,
  Clock,
  ExternalLink
} from 'lucide-react';

interface ProcessingStateProps {
  imageCount: number;
  images?: UploadedImageFile[];
  isMockMode?: boolean;
}

interface PipelineStageConfig {
  id: number;
  phaseCode: string;
  name: string;
  subtext: string;
  statutoryRef: string;
  declarations?: string[];
}

const COMPLIANCE_STAGES: PipelineStageConfig[] = [
  {
    id: 1,
    phaseCode: 'READING',
    name: 'Reading Surface Geometry',
    subtext: 'Detecting package perimeter, optical plane alignment & contrast equalization',
    statutoryRef: 'ISO/IEC 30112 Surface Normalization',
  },
  {
    id: 2,
    phaseCode: 'EXTRACTING',
    name: 'Extracting OCR Streams',
    subtext: 'Isolating bilingual typography, numeral streams & barcode matrix clusters',
    statutoryRef: 'Multi-layer Optical Character Recognition Engine',
  },
  {
    id: 3,
    phaseCode: 'UNDERSTANDING',
    name: 'Understanding Mandatory Declarations',
    subtext: 'Semantic mapping of MRP, Net Quantity, Dates, Manufacturer & FSSAI Lic',
    statutoryRef: 'Rule 6(1) Legal Metrology (PC) Rules, 2011',
    declarations: ['MRP', 'Net Quantity', 'Mfg Date', 'Manufacturer', 'FSSAI Lic'],
  },
  {
    id: 4,
    phaseCode: 'VALIDATING',
    name: 'Validating Legal Metrology Rules',
    subtext: 'Threshold evaluation against Schedule II font heights, unit pricing & rules',
    statutoryRef: 'PCR 2011 Rule 6, 18 & Schedule II Table 1',
  },
  {
    id: 5,
    phaseCode: 'EVIDENCE MAPPING',
    name: 'Mapping Spatial Evidence',
    subtext: 'Binding statutory findings to normalized 1000×1000 coordinate bounding boxes',
    statutoryRef: 'Court-Admissible Statutory Audit Matrix',
  },
  {
    id: 6,
    phaseCode: 'REPORT',
    name: 'Compiling Compliance Report',
    subtext: 'Synthesizing violation breakdown, penalty assessment & official certificate',
    statutoryRef: 'PackSure Official Statutory Audit Notice',
  },
];

export const ProcessingState: React.FC<ProcessingStateProps> = ({
  imageCount,
  images = [],
  isMockMode = true,
}) => {
  const [activeStage, setActiveStage] = useState<number>(1);
  const [progressPercent, setProgressPercent] = useState<number>(16);
  const [selectedSurfaceIndex, setSelectedSurfaceIndex] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Timers and intervals tracker for safe cleanup
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    // Clear any previous timers
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    intervalRef.current.forEach((i) => clearInterval(i));
    intervalRef.current = [];

    if (isMockMode) {
      // MOCK MODE: Smooth analytical progression across ~1.4s matching the mock delay
      timersRef.current.push(
        setTimeout(() => {
          setActiveStage(2);
          setProgressPercent(34);
        }, 280)
      );

      timersRef.current.push(
        setTimeout(() => {
          setActiveStage(3);
          setProgressPercent(52);
        }, 580)
      );

      timersRef.current.push(
        setTimeout(() => {
          setActiveStage(4);
          setProgressPercent(70);
        }, 880)
      );

      timersRef.current.push(
        setTimeout(() => {
          setActiveStage(5);
          setProgressPercent(86);
        }, 1180)
      );

      timersRef.current.push(
        setTimeout(() => {
          setActiveStage(6);
          setProgressPercent(96);
        }, 1380)
      );
    } else {
      // LIVE API MODE:
      // Realistic pipeline progression as request travels to /scan backend.
      // Must NEVER fabricate completion or claim Stage 6 is "Done" until the real API resolves!
      timersRef.current.push(
        setTimeout(() => {
          setActiveStage(2);
          setProgressPercent(32);
        }, 800)
      );

      timersRef.current.push(
        setTimeout(() => {
          setActiveStage(3);
          setProgressPercent(52);
        }, 1800)
      );

      timersRef.current.push(
        setTimeout(() => {
          setActiveStage(4);
          setProgressPercent(68);
        }, 3000)
      );

      timersRef.current.push(
        setTimeout(() => {
          setActiveStage(5);
          setProgressPercent(82);
        }, 4400)
      );

      timersRef.current.push(
        setTimeout(() => {
          setActiveStage(6);
          setProgressPercent(89);
        }, 6000)
      );

      // In live mode, track real elapsed time and gently creep progress to at most 94%
      const liveTimer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
        setProgressPercent((prevProgress) => {
          // Never exceed 94% until the real response arrives and App transitions view
          if (prevProgress < 94) {
            return prevProgress + 1;
          }
          return 94;
        });
      }, 1000);
      intervalRef.current.push(liveTimer);
    }

    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
      intervalRef.current.forEach((i) => clearInterval(i));
      intervalRef.current = [];
    };
  }, [isMockMode]);

  // Determine active preview image
  const currentImage = images[selectedSurfaceIndex] || images[0];

  // Visual concept pipeline breadcrumb steps
  const visualFlowSteps = [
    { label: 'PACKAGE IMAGE', stageId: 1, icon: Package },
    { label: 'READING', stageId: 1, icon: Scan },
    { label: 'EXTRACTING', stageId: 2, icon: Cpu },
    { label: 'UNDERSTANDING', stageId: 3, icon: Layers },
    { label: 'VALIDATING', stageId: 4, icon: ShieldCheck },
    { label: 'EVIDENCE MAPPING', stageId: 5, icon: Crosshair },
    { label: 'REPORT', stageId: 6, icon: FileCheck2 },
  ];

  return (
    <div
      id="processing-pipeline-view"
      className="max-w-6xl mx-auto my-6 sm:my-8 px-4 sm:px-6 lg:px-8 space-y-6"
    >
      {/* ====================================================
          TOP ENGINE HEADER & AUDIT SESSION BAR
          ==================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-teal-800 dark:bg-teal-700 flex items-center justify-center text-white shadow-xs shrink-0">
            <ShieldCheck size={22} className="stroke-[2.2] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                PackSure Statutory Compliance Verification
              </h2>
              {isMockMode ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-medium">
                  <Activity size={12} className="text-teal-700 dark:text-teal-400" />
                  Simulation Mode • {imageCount} Surface{imageCount > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-mono font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Live API: POST /scan ({elapsedSeconds}s)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Legal Metrology (Packaged Commodities) Rules, 2011 & FSSAI Packaging Directives
            </p>
          </div>
        </div>

        {/* Real-time Progress Metric */}
        <div className="w-full md:w-56 text-right space-y-1.5 self-stretch md:self-auto">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {activeStage === 6 && !isMockMode ? 'Awaiting Backend Verdict' : 'Inspection Progress'}
            </span>
            <span className="font-mono font-bold text-teal-800 dark:text-teal-400">
              {progressPercent}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-teal-800 dark:bg-teal-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono text-left truncate">
            {activeStage === 6 && !isMockMode
              ? `Waiting for /scan response (${elapsedSeconds}s)...`
              : `Stage 0${activeStage} of 06: ${COMPLIANCE_STAGES[activeStage - 1]?.phaseCode}`}
          </div>
        </div>
      </div>

      {/* ====================================================
          VISUAL CONCEPT FLOW STRIP
          PACKAGE IMAGE → READING → EXTRACTING → UNDERSTANDING → VALIDATING → EVIDENCE MAPPING → REPORT
          ==================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs overflow-x-auto">
        <div className="flex items-center justify-between min-w-[700px] gap-2">
          {visualFlowSteps.map((step, idx) => {
            const Icon = step.icon;
            // The step is done if activeStage > step.stageId, or if it's the package image step and activeStage >= 1
            const isCompleted =
              step.label === 'PACKAGE IMAGE'
                ? activeStage >= 1
                : activeStage > step.stageId;
            const isCurrent =
              step.label === 'PACKAGE IMAGE'
                ? false
                : activeStage === step.stageId;

            return (
              <React.Fragment key={step.label}>
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 shrink-0 ${
                    isCurrent
                      ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                      : isCompleted
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200/80 dark:border-slate-800 opacity-60'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 stroke-[2.4]" />
                  ) : isCurrent ? (
                    <Loader2 size={13} className="animate-spin text-white" />
                  ) : (
                    <Icon size={13} className="text-slate-400" />
                  )}
                  <span className="font-mono text-[11px] tracking-wide">{step.label}</span>
                </div>

                {idx < visualFlowSteps.length - 1 && (
                  <ArrowRight
                    size={13}
                    className={`shrink-0 ${
                      activeStage > step.stageId
                        ? 'text-emerald-500 dark:text-emerald-400'
                        : 'text-slate-300 dark:text-slate-700'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ====================================================
          MAIN WORKSPACE: VIEWFINDER (LEFT) + PIPELINE STAGES (RIGHT)
          ==================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ====================================================
            LEFT: UPLOADED PACKAGE WITH SUBTLE SCAN BEAM & BOUNDING HIGHLIGHTS
            ==================================================== */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs flex flex-col justify-between space-y-4">
          {/* Header & Surface Switcher */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scan size={16} className="text-teal-700 dark:text-teal-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Package Inspection Viewfinder
              </h3>
            </div>

            {/* Surface Selector Pills (if multiple images uploaded) */}
            {images.length > 1 && (
              <div className="flex items-center gap-1.5">
                {images.map((img, idx) => (
                  <button
                    key={img.previewUrl}
                    type="button"
                    onClick={() => setSelectedSurfaceIndex(idx)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors duration-150 cursor-pointer ${
                      selectedSurfaceIndex === idx
                        ? 'bg-teal-800 dark:bg-teal-700 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Surface {idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Viewfinder Canvas Container */}
          <div
            id="scanner-viewfinder-canvas"
            className="relative aspect-4/3 sm:aspect-16/10 w-full bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner group select-none"
          >
            {/* Precision Viewfinder Reticle Corners (Thin, Clean, Professional) */}
            <div className="pointer-events-none absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-slate-400/70 z-20" />
            <div className="pointer-events-none absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-slate-400/70 z-20" />
            <div className="pointer-events-none absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-slate-400/70 z-20" />
            <div className="pointer-events-none absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-slate-400/70 z-20" />

            {/* Uploaded Package Image */}
            {currentImage ? (
              <img
                src={currentImage.previewUrl}
                alt="Package undergoing compliance scan"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
                <Package size={38} className="text-slate-600 animate-pulse" />
                <span className="text-xs font-medium">Acquiring package surface...</span>
              </div>
            )}

            {/* Subtle Scan Beam (Clean 1.5px laser bar with gentle 8px trailing gradient) */}
            <div
              id="active-scan-beam"
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_6px_rgba(20,89,103,0.5)] z-10 animate-scan-beam"
            />

            {/* STAGE 1: Subtle Package Perimeter Outline (Primary Display Panel) */}
            <div
              className={`absolute inset-5 border border-dashed border-teal-400/40 rounded-lg pointer-events-none transition-opacity duration-300 z-10 ${
                activeStage >= 1 ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="absolute top-1 left-2 text-[8px] font-mono text-teal-300/90 tracking-widest uppercase">
                PRIMARY DISPLAY PANEL BOUNDARY
              </div>
            </div>

            {/* STAGE 2: Subtle OCR Line Stream Highlight Effect */}
            <div
              className={`absolute top-[18%] left-[20%] right-[20%] space-y-2 pointer-events-none transition-opacity duration-300 z-10 ${
                activeStage === 2 ? 'opacity-90' : 'opacity-0'
              }`}
            >
              <div className="h-2 bg-teal-400/15 border-l-2 border-teal-400 rounded-xs animate-pulse" />
              <div className="h-2 w-3/4 bg-teal-400/15 border-l-2 border-teal-400 rounded-xs animate-pulse delay-75" />
              <div className="h-2 w-1/2 bg-teal-400/15 border-l-2 border-teal-400 rounded-xs animate-pulse delay-150" />
            </div>

            {/* STAGE 3+: DECLARATION BOUNDING BOX 1: MRP & UNIT SALE PRICE */}
            <div
              className={`absolute top-[26%] left-[16%] w-[38%] h-[20%] border border-teal-400/80 bg-teal-500/10 rounded pointer-events-none transition-all duration-300 z-10 ${
                activeStage >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
            >
              {/* Corner accents */}
              <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-teal-400" />
              <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-teal-400" />
              <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-teal-400" />
              <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-teal-400" />

              {/* Tag header */}
              <div className="absolute -top-4 left-0 px-1.5 py-0.5 rounded bg-teal-800/90 text-white text-[8px] font-mono tracking-wider flex items-center gap-1 shadow-xs whitespace-nowrap">
                <Crosshair size={8} />
                <span>DECLARATION: MRP ₹ 149.00</span>
                {activeStage >= 4 && (
                  <span className="text-emerald-300 font-bold ml-1">✓ PASS</span>
                )}
              </div>

              {/* Coordinate Callout in Stage 5 */}
              {activeStage >= 5 && (
                <div className="absolute -bottom-3.5 right-0 text-[7px] font-mono text-teal-200 bg-slate-900/90 px-1 py-0.2 rounded border border-teal-500/40">
                  CRS: [160, 260, 540, 460]
                </div>
              )}
            </div>

            {/* STAGE 3+: DECLARATION BOUNDING BOX 2: NET QUANTITY */}
            <div
              className={`absolute bottom-[20%] right-[14%] w-[36%] h-[20%] border border-teal-500/80 bg-teal-600/10 rounded pointer-events-none transition-all duration-300 z-10 ${
                activeStage >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
            >
              {/* Corner accents */}
              <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-teal-500" />
              <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-teal-500" />
              <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-teal-500" />
              <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-teal-500" />

              {/* Tag header */}
              <div className="absolute -top-4 left-0 px-1.5 py-0.5 rounded bg-teal-800/90 text-white text-[8px] font-mono tracking-wider flex items-center gap-1 shadow-xs whitespace-nowrap">
                <Crosshair size={8} />
                <span>DECLARATION: NET QTY 400 g</span>
                {activeStage >= 4 && (
                  <span className="text-emerald-300 font-bold ml-1">✓ SCH-II OK</span>
                )}
              </div>

              {/* Coordinate Callout in Stage 5 */}
              {activeStage >= 5 && (
                <div className="absolute -bottom-3.5 right-0 text-[7px] font-mono text-teal-200 bg-slate-900/90 px-1 py-0.2 rounded border border-teal-500/40">
                  CRS: [640, 800, 1000, 1000]
                </div>
              )}
            </div>

            {/* STAGE 4+: DECLARATION BOUNDING BOX 3: FSSAI LIC & DATES */}
            <div
              className={`absolute bottom-[16%] left-[14%] w-[34%] h-[18%] border border-emerald-400/80 bg-emerald-500/10 rounded pointer-events-none transition-all duration-300 z-10 ${
                activeStage >= 4 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
            >
              <div className="absolute -top-4 left-0 px-1.5 py-0.5 rounded bg-emerald-700/90 text-white text-[8px] font-mono tracking-wider flex items-center gap-1 shadow-xs whitespace-nowrap">
                <ShieldCheck size={8} />
                <span>FSSAI LIC & MFG DATE</span>
                <span className="text-emerald-200 font-bold ml-1">✓</span>
              </div>
            </div>

            {/* Top Viewfinder Metadata Strip */}
            <div className="absolute top-2.5 inset-x-3.5 flex items-center justify-between text-[10px] text-white/80 font-mono pointer-events-none z-20">
              <span className="bg-slate-900/85 px-2 py-0.5 rounded backdrop-blur-xs border border-white/10">
                SURFACE {currentImage ? currentImage.index : 1} OF {imageCount}
              </span>
              <span className="bg-slate-900/85 px-2 py-0.5 rounded backdrop-blur-xs border border-white/10 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                OPTICAL PASS ACTIVE
              </span>
            </div>

            {/* Bottom Status Ribbon */}
            <div className="absolute bottom-2.5 inset-x-3.5 flex items-center justify-between text-[10px] text-white/80 font-mono pointer-events-none z-20">
              <span className="bg-slate-900/85 px-2 py-0.5 rounded backdrop-blur-xs border border-white/10">
                FRAME: NORMALIZED 1000×1000
              </span>
              <span className="bg-slate-900/85 px-2 py-0.5 rounded backdrop-blur-xs border border-white/10">
                STD: PCR 2011 • RULE 6
              </span>
            </div>
          </div>

          {/* Real-time Evidence Telemetry Ticker */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Activity size={13} className="text-teal-700 dark:text-teal-400" />
                <span>Real-Time Statutory Telemetry</span>
              </span>
              <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                {isMockMode ? 'MOCK ENGINE' : 'LIVE API (/scan)'}
              </span>
            </div>

            <div className="space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
              {activeStage >= 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-teal-600 dark:text-teal-400 shrink-0">[READING]</span>
                  <span className="truncate">Surface plane aligned; optical contrast normalized</span>
                </div>
              )}
              {activeStage >= 2 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-teal-700 dark:text-teal-400 shrink-0">[EXTRACTING]</span>
                  <span className="truncate">Raw typography & numeral character streams isolated</span>
                </div>
              )}
              {activeStage >= 3 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-600 dark:text-amber-400 shrink-0">[UNDERSTANDING]</span>
                  <span className="truncate">Mandatory fields identified: MRP, Net Qty, Dates, FSSAI</span>
                </div>
              )}
              {activeStage >= 4 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600 dark:text-emerald-400 shrink-0">[VALIDATING]</span>
                  <span className="truncate">PCR 2011 Schedule II font ratios verified</span>
                </div>
              )}
              {activeStage >= 5 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-teal-600 dark:text-teal-400 shrink-0">[EVIDENCE]</span>
                  <span className="truncate">Spatial coordinate boxes mapped to audit index</span>
                </div>
              )}
              {activeStage >= 6 && (
                <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-semibold">
                  <span className="text-teal-700 dark:text-teal-400 shrink-0">[REPORT]</span>
                  <span className="truncate">
                    {isMockMode
                      ? 'Finalizing official compliance audit report...'
                      : `Awaiting statutory backend verdict from /scan (${elapsedSeconds}s)...`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ====================================================
            RIGHT: THE 6 STATUTORY PIPELINE STAGES
            ==================================================== */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <FileCheck2 size={16} className="text-teal-700 dark:text-teal-400" />
                <span>Statutory Pipeline Stages</span>
              </h3>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Stage {activeStage} of 6
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Deterministic verification sequence under Indian Packaging Directives
            </p>
          </div>

          {/* Progressive Checklist Cards */}
          <div className="space-y-2.5 flex-1">
            {COMPLIANCE_STAGES.map((stage) => {
              // In live mode, stage 6 is never marked "done" until unmounted!
              const isDone = activeStage > stage.id;
              const isCurrent = activeStage === stage.id;

              return (
                <div
                  key={stage.id}
                  id={`pipeline-stage-${stage.id}`}
                  className={`p-3 rounded-xl border transition-all duration-200 ${
                    isCurrent
                      ? 'bg-teal-50/70 border-teal-200 dark:bg-slate-800/80 dark:border-teal-700/80 ring-1 ring-teal-300 dark:ring-teal-700'
                      : isDone
                      ? 'bg-emerald-50/40 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/60'
                      : 'bg-slate-50/60 border-slate-200/60 dark:bg-slate-800/30 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Status Icon */}
                    <div className="shrink-0 mt-0.5">
                      {isDone ? (
                        <CheckCircle2
                          size={18}
                          className="text-emerald-600 dark:text-emerald-400 stroke-[2.2]"
                        />
                      ) : isCurrent ? (
                        <Loader2
                          size={18}
                          className="animate-spin text-teal-700 dark:text-teal-400 stroke-[2.2]"
                        />
                      ) : (
                        <div className="w-4.5 h-4.5 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[10px] font-mono text-slate-400">
                          0{stage.id}
                        </div>
                      )}
                    </div>

                    {/* Stage Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold truncate ${
                            isCurrent
                              ? 'text-teal-950 dark:text-teal-200'
                              : isDone
                              ? 'text-emerald-900 dark:text-emerald-300'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          0{stage.id} — {stage.name}
                        </span>

                        {isDone && (
                          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                            Verified
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[10px] font-semibold text-teal-800 dark:text-teal-300 uppercase tracking-wide animate-pulse">
                            {stage.id === 6 && !isMockMode ? 'Awaiting API' : 'Active'}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {stage.subtext}
                      </p>

                      {/* Declaration Tags for Stage 3 */}
                      {stage.declarations && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {stage.declarations.map((tag) => (
                            <span
                              key={tag}
                              className={`text-[9px] font-mono font-medium px-2 py-0.5 rounded-md border ${
                                isDone || (isCurrent && activeStage >= 3)
                                  ? 'bg-teal-100/70 text-teal-800 border-teal-200 dark:bg-slate-800 dark:text-teal-300 dark:border-slate-700'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {tag} ✓
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Security / Authenticity Assurance */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Court-Admissible Statutory Evidence Trail</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400">PCR-2011</span>
          </div>
        </div>
      </div>

      {/* ====================================================
          BOTTOM AUDIT EXPLANATION NOTE
          ==================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-amber-500 shrink-0" />
          <span>
            <strong>Statutory Rule Engine:</strong> Inspections evaluate mandatory declarations, font heights (Schedule II), and unit sale prices without simulated or hallucinatory results.
          </span>
        </div>
        {!isMockMode && (
          <div className="flex items-center gap-1 text-[11px] text-teal-700 dark:text-teal-400 font-medium shrink-0">
            <Clock size={12} />
            <span>Real-time API latency tracked</span>
          </div>
        )}
      </div>
    </div>
  );
};
