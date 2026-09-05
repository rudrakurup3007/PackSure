import React, { useRef, useState } from 'react';
import { createSamplePackageFiles } from '../utils/sampleImages';
import { UploadCloud, FolderOpen, Sparkles, AlertCircle, CheckCircle2, FileImage } from 'lucide-react';

interface UploadZoneProps {
  onImagesSelected: (files: File[]) => void;
  currentCount: number;
  maxImages?: number;
  disabled?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onImagesSelected,
  currentCount,
  maxImages = 3,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  const remainingSlots = Math.max(0, maxImages - currentCount);

  const validateAndAddFiles = (fileList: FileList | File[]) => {
    setValidationError(null);
    const filesArray = Array.from(fileList);

    if (filesArray.length === 0) return;

    // Check count limit
    if (filesArray.length > remainingSlots) {
      setValidationError('Maximum 3 images allowed.');
      return;
    }

    // Supported formats check: JPG, JPEG, PNG, WEBP
    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const invalidFile = filesArray.find((f) => {
      const isExtValid = /\.(jpe?g|png|webp)$/i.test(f.name);
      return !validMimes.includes(f.type) && !isExtValid;
    });

    if (invalidFile) {
      setValidationError('Please upload a JPG, JPEG, PNG or WEBP image.');
      return;
    }

    onImagesSelected(filesArray);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled || remainingSlots === 0) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || remainingSlots === 0) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
      // Reset input value to allow re-selection
      e.target.value = '';
    }
  };

  const handleLoadSample = async () => {
    try {
      setIsLoadingSample(true);
      setValidationError(null);
      const sampleFiles = await createSamplePackageFiles();
      onImagesSelected(sampleFiles);
    } catch {
      setValidationError('Failed to generate sample package images.');
    } finally {
      setIsLoadingSample(false);
    }
  };

  return (
    <div id="upload-zone-container" className="space-y-3">
      {/* Drag & Drop Area */}
      <div
        id="drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center transition-all ${
          disabled || remainingSlots === 0
            ? 'border-slate-200 bg-slate-50/70 cursor-not-allowed dark:bg-slate-900/50 dark:border-slate-800'
            : isDragOver
            ? 'border-indigo-600 bg-indigo-50/80 scale-[1.01] shadow-md dark:bg-indigo-950/40 ring-4 ring-indigo-100 dark:ring-indigo-900/40'
            : validationError
            ? 'border-rose-300 bg-rose-50/30 hover:border-rose-400 dark:border-rose-800 dark:bg-rose-950/20'
            : 'border-slate-300 bg-white hover:bg-slate-50/70 hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-900/90 shadow-2xs'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          id="package-file-input"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled || remainingSlots === 0}
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="max-w-lg mx-auto space-y-4 flex flex-col items-center">
          {/* Upload Icon Circle */}
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-2xs ${
              isDragOver
                ? 'bg-indigo-600 text-white scale-110'
                : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60'
            }`}
          >
            <UploadCloud size={32} className="stroke-[2.2]" />
          </div>

          {/* Heading & Instructions */}
          <div className="space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {remainingSlots === 0
                ? 'Maximum 3 images selected'
                : isDragOver
                ? 'Drop package photographs to upload'
                : 'Upload 1–3 package images'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Drag & drop commodity images covering front face, back declaration panel, or side nutritional surfaces.
            </p>
          </div>

          {/* Action buttons inside dropzone */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              id="browse-files-btn"
              type="button"
              disabled={disabled || remainingSlots === 0}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-2xs transition disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <FolderOpen size={16} />
              <span>Browse Files</span>
            </button>

            <button
              id="load-sample-package-btn"
              type="button"
              disabled={disabled || isLoadingSample}
              onClick={handleLoadSample}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 transition focus:outline-none focus:ring-2 focus:ring-indigo-400"
              title="Load pre-built 3-panel commodity images for instant inspection test"
            >
              <Sparkles size={15} className="text-amber-500 shrink-0" />
              <span>{isLoadingSample ? 'Generating...' : 'Load Sample Package'}</span>
            </button>
          </div>

          {/* Supported format specs */}
          <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-3 flex-wrap font-medium">
            <span className="inline-flex items-center gap-1">
              <FileImage size={13} className="text-slate-400" />
              Formats: <strong>JPG, JPEG, PNG, WEBP</strong>
            </span>
            <span>•</span>
            <span>Limit: <strong>1 to 3 images</strong></span>
          </div>
        </div>
      </div>

      {/* Validation alert if error occurred */}
      {validationError && (
        <div
          id="upload-validation-error"
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn"
        >
          <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Upload Notice:</span>
            <span>{validationError}</span>
          </div>
        </div>
      )}

      {/* Intake Status Bar */}
      <div className="flex items-center justify-between text-xs px-1 text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Selected Count:</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {currentCount} / {maxImages} images
          </span>
        </div>

        <div className="flex items-center gap-1">
          {currentCount >= 1 ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 size={14} className="stroke-[2.5]" />
              Ready to Start Inspection
            </span>
          ) : (
            <span className="text-slate-400 italic">
              Upload at least 1 image to enable scan
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
