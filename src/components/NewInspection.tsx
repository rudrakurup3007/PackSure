import React, { useState } from 'react';
import { UploadedImageFile } from '../types/inspection';
import { UploadZone } from './UploadZone';
import { ImagePreview } from './ImagePreview';
import {
  Play,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Camera,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  ScanLine,
  Eye,
  SunMedium,
  Maximize2,
  Info
} from 'lucide-react';

interface NewInspectionProps {
  onStartScan: (files: File[]) => void;
  onCancel: () => void;
  isScanning?: boolean;
}

export const NewInspection: React.FC<NewInspectionProps> = ({
  onStartScan,
  onCancel,
  isScanning = false,
}) => {
  const [images, setImages] = useState<UploadedImageFile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleImagesSelected = (newFiles: File[]) => {
    setErrorMessage(null);
    const updated: UploadedImageFile[] = [...images];

    for (const file of newFiles) {
      if (updated.length >= 3) break;
      const previewUrl = URL.createObjectURL(file);
      updated.push({
        file,
        previewUrl,
        index: updated.length + 1,
        name: file.name,
        size: file.size,
        type: file.type,
      });
    }

    // Re-index to ensure strictly 1, 2, 3
    const reindexed = updated.map((item, idx) => ({
      ...item,
      index: idx + 1,
    }));

    setImages(reindexed);
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setErrorMessage(null);
    const filtered = images.filter((img) => img.index !== indexToRemove);
    // Revoke object URL of removed image to avoid memory leak
    const removed = images.find((img) => img.index === indexToRemove);
    if (removed) {
      URL.revokeObjectURL(removed.previewUrl);
    }

    // Re-index remaining images
    const reindexed = filtered.map((item, idx) => ({
      ...item,
      index: idx + 1,
    }));
    setImages(reindexed);
  };

  const handleTriggerScan = () => {
    if (images.length === 0) {
      setErrorMessage('Please upload at least one package image to begin statutory analysis.');
      return;
    }

    if (images.length > 3) {
      setErrorMessage('Maximum 3 images allowed per inspection.');
      return;
    }

    const filesToSend = images.map((item) => item.file);
    onStartScan(filesToSend);
  };

  // Determine current active step (visual guide only)
  const currentStep = images.length === 0 ? 1 : 2;

  return (
    <div id="new-inspection-view" className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* ====================================================
          TOP: HEADER & 4-STEP WORKFLOW INDICATOR
          ==================================================== */}
      <div className="space-y-6">
        {/* Title & Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="p-2.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              title="Return to Dashboard"
              aria-label="Return to Dashboard"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  New Package Inspection
                </h2>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  Legal Metrology • PCR 2011
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Upload 1–3 commodity photographs for automated Legal Metrology & FSSAI statutory verification
              </p>
            </div>
          </div>
        </div>

        {/* Step Indicator (1. Capture -> 2. Review -> 3. Scan -> 4. Results) */}
        <div
          id="workflow-step-indicator"
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs"
          aria-label="Inspection Workflow Steps"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {/* Step 1: Capture */}
            <div
              className={`flex items-center gap-2.5 p-2 rounded-xl transition-colors duration-150 ${
                currentStep >= 1
                  ? 'bg-teal-50/80 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 font-semibold'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  images.length > 0
                    ? 'bg-emerald-600 text-white'
                    : 'bg-teal-800 text-white'
                }`}
              >
                {images.length > 0 ? <CheckCircle2 size={14} /> : '1'}
              </div>
              <div className="truncate">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                  Step 1
                </span>
                <span className="text-xs font-semibold">1. Capture</span>
              </div>
            </div>

            {/* Step 2: Review */}
            <div
              className={`flex items-center gap-2.5 p-2 rounded-xl transition-colors duration-150 ${
                images.length > 0
                  ? 'bg-teal-50/80 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 font-semibold ring-1 ring-teal-200 dark:ring-teal-800'
                  : 'text-slate-400 dark:text-slate-500 opacity-60'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  images.length > 0
                    ? 'bg-teal-800 text-white'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                2
              </div>
              <div className="truncate">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                  Step 2
                </span>
                <span className="text-xs font-semibold">2. Review</span>
              </div>
            </div>

            {/* Step 3: Scan */}
            <div
              className={`flex items-center gap-2.5 p-2 rounded-xl transition-colors duration-150 ${
                images.length > 0
                  ? 'text-slate-700 dark:text-slate-300 font-medium'
                  : 'text-slate-400 dark:text-slate-500 opacity-60'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center text-xs font-bold shrink-0">
                3
              </div>
              <div className="truncate">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                  Step 3
                </span>
                <span className="text-xs font-semibold">3. Scan</span>
              </div>
            </div>

            {/* Step 4: Results */}
            <div className="flex items-center gap-2.5 p-2 rounded-xl text-slate-400 dark:text-slate-500 opacity-60">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center text-xs font-bold shrink-0">
                4
              </div>
              <div className="truncate">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                  Step 4
                </span>
                <span className="text-xs font-semibold">4. Results</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================
          MAIN AREA: IMAGE UPLOAD & PREVIEW WORKSPACE
          ==================================================== */}
      <section id="inspection-workspace-section" className="space-y-6">
        {/* Upload Zone */}
        <UploadZone
          onImagesSelected={handleImagesSelected}
          currentCount={images.length}
          maxImages={3}
          disabled={isScanning}
        />

        {/* Selected Image Previews with Sequence, Remove Actions & Scan Micro-interactions */}
        <ImagePreview
          images={images}
          onRemoveImage={handleRemoveImage}
          disabled={isScanning}
        />
      </section>

      {/* ====================================================
          SECONDARY AREA: GUIDANCE & SCAN READINESS
          ==================================================== */}
      <section id="inspection-guidance-section" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Package Image Guidance (Expected Panels) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300">
            <Camera size={16} className="stroke-[2.2]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Package Image Guidance
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            For rigorous statutory verification, capturing the following surfaces is strongly advised:
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                1. Front Panel (Principal Display)
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                Brand identity, common product name, net quantity declaration & veg/non-veg logo.
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                2. Back Panel (Nutritional & Details)
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                Nutritional table, ingredients, allergen warnings, customer care & manufacturer address.
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                3. Declaration Panel (Statutory Pricing)
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                MRP (inclusive of taxes), Unit Sale Price (USP), Mfg/Pkg Date, Batch & FSSAI lic.
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Smart Capture Tips */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300">
            <Eye size={16} className="stroke-[2.2]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Smart Capture Tips
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Ensure high OCR accuracy by following standard inspection capture protocols:
          </p>
          <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <li className="flex items-start gap-2">
              <SunMedium size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>Avoid glare:</strong> Position lighting to prevent flash reflections on glossy plastic or foil packaging.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ScanLine size={15} className="text-teal-600 shrink-0 mt-0.5" />
              <span>
                <strong>Keep text readable:</strong> Hold camera steady so fine statutory print (like USP & date codes) is crisp.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Maximize2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Capture complete edges:</strong> Frame the full package boundary to enable accurate font-height area calculations.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <FileCheck2 size={15} className="text-teal-600 shrink-0 mt-0.5" />
              <span>
                <strong>Visible declarations:</strong> Confirm MRP box, net weight, and FSSAI number are inside the camera frame.
              </span>
            </li>
          </ul>

          {/* Image Quality / Readiness UI (Advisory Guidance) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Readiness Self-Check:
              </span>
              <span className="text-slate-400 font-normal">Guidance</span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-[10px] text-center font-medium">
              <span className="py-1 px-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                Good ✓
              </span>
              <span className="py-1 px-1 rounded-md bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                Blurry ?
              </span>
              <span className="py-1 px-1 rounded-md bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                Dark ?
              </span>
              <span className="py-1 px-1 rounded-md bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                Partial ?
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Scan Readiness & Application State */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300">
                <ShieldCheck size={16} className="stroke-[2.2]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Scan Readiness Status
                </h3>
              </div>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  images.length > 0
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                }`}
              >
                {images.length > 0 ? 'Ready to Scan' : 'Awaiting Images'}
              </span>
            </div>

            {/* Real Application State Checklist */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300">Images Staged:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {images.length} of 3 surfaces
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300">Surface Coverage:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                  {images.length === 0
                    ? '0% coverage'
                    : images.length === 1
                    ? 'Front surface loaded'
                    : images.length === 2
                    ? 'Front & back surfaces'
                    : 'Complete 3-panel coverage'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300">OCR Engine:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-[11px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Ready for Extraction
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300">Statutory Ruleset:</span>
                <span className="font-semibold text-teal-800 dark:text-teal-300 text-[11px]">
                  PCR 2011 & FSSAI
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
            <Info size={13} className="shrink-0 mt-0.5 text-teal-600 dark:text-teal-400" />
            <span>
              All images undergo client-side validation and multi-surface coordinate binding before analysis.
            </span>
          </div>
        </div>
      </section>

      {/* Validation Message (if any) */}
      {errorMessage && (
        <div
          id="inspection-validation-alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs flex items-start gap-3 animate-fadeIn"
        >
          <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block text-sm">Inspection Notice:</span>
            <span className="text-xs">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* ====================================================
          BOTTOM: PRIMARY ACTION & CANCEL CONTROLS
          ==================================================== */}
      <div className="bg-white dark:bg-slate-900/95 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
          {images.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
              <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <strong>{images.length} surface{images.length > 1 ? 's' : ''} staged</strong> — ready for OCR extraction, declaration matching & compliance scoring.
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-slate-500">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <span>Please upload at least 1 package image to enable the analysis action.</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onCancel}
            disabled={isScanning}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer"
          >
            Cancel
          </button>

          {/* PRIMARY ACTION: ANALYZE PACKAGE */}
          <button
            id="start-scan-primary-btn"
            type="button"
            onClick={handleTriggerScan}
            disabled={images.length === 0 || isScanning}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-sm font-bold bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white shadow-xs hover:shadow-sm transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 cursor-pointer"
            title="Execute Legal Metrology and FSSAI compliance verification"
          >
            {isScanning ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Analyzing Package...</span>
              </>
            ) : (
              <>
                <Play size={16} className="fill-current stroke-[1.5]" />
                <span>Analyze Package</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

