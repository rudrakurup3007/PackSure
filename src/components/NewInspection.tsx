import React, { useState } from 'react';
import { UploadedImageFile } from '../types/inspection';
import { UploadZone } from './UploadZone';
import { ImagePreview } from './ImagePreview';
import { Play, ArrowLeft, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

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
      setErrorMessage('Upload at least one package image to begin.');
      return;
    }

    if (images.length > 3) {
      setErrorMessage('Maximum 3 images allowed.');
      return;
    }

    const filesToSend = images.map((item) => item.file);
    onStartScan(filesToSend);
  };

  return (
    <div id="new-inspection-view" className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-indigo-400"
            title="Return to Dashboard"
            aria-label="Return to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Upload Package Images
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload 1–3 photographs of the packaged commodity for statutory verification
            </p>
          </div>
        </div>

        {/* 3-Step Intake Progression Indicator */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 self-start sm:self-auto bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className={`px-1.5 py-0.5 rounded ${images.length === 0 ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400'}`}>
            1. UPLOAD
          </span>
          <span className="text-slate-400">→</span>
          <span className={`px-1.5 py-0.5 rounded ${images.length > 0 ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400'}`}>
            2. REVIEW
          </span>
          <span className="text-slate-400">→</span>
          <span className="text-slate-500 dark:text-slate-400 px-1.5 py-0.5">
            3. START SCAN
          </span>
        </div>
      </div>

      {/* Upload Zone */}
      <UploadZone
        onImagesSelected={handleImagesSelected}
        currentCount={images.length}
        maxImages={3}
        disabled={isScanning}
      />

      {/* Selected Image Previews with Sequence & Remove Actions */}
      <ImagePreview
        images={images}
        onRemoveImage={handleRemoveImage}
        disabled={isScanning}
      />

      {/* Validation Message */}
      {errorMessage && (
        <div
          id="inspection-validation-alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs flex items-start gap-3 animate-fadeIn"
        >
          <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Inspection Notice:</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Bottom Action Footer */}
      <div className="bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
          {images.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
              <ShieldCheck size={15} className="text-indigo-600 dark:text-indigo-400" />
              <span><strong>{images.length} image{images.length > 1 ? 's' : ''}</strong> staged for Legal Metrology compliance scan.</span>
            </span>
          ) : (
            <span>Please select 1 to 3 package photographs to enable the scan action.</span>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onCancel}
            disabled={isScanning}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 transition focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            Cancel
          </button>

          <button
            id="start-scan-primary-btn"
            type="button"
            onClick={handleTriggerScan}
            disabled={images.length === 0 || isScanning}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-7 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-900"
          >
            {isScanning ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Play size={15} className="fill-current stroke-[1.5]" />
                <span>Start Scan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
