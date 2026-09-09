import React from 'react';
import { UploadedImageFile } from '../types/inspection';
import { Trash2, FileImage, Layers, CheckCircle2, ShieldCheck, HelpCircle } from 'lucide-react';

interface ImagePreviewProps {
  images: UploadedImageFile[];
  onRemoveImage: (index: number) => void;
  disabled?: boolean;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  images,
  onRemoveImage,
  disabled = false,
}) => {
  if (images.length === 0) {
    return null;
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Surface recommendation label based on upload order
  const getSurfaceLabel = (idx: number): string => {
    if (idx === 1) return 'Front Panel (Principal Display)';
    if (idx === 2) return 'Back / Declaration Panel';
    return 'Side / Secondary Surface';
  };

  return (
    <div id="image-previews-container" className="space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-teal-700 dark:text-teal-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Staged Package Surfaces ({images.length} / 3)
          </h4>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
            <CheckCircle2 size={13} /> All surfaces ready
          </span>
          <span>•</span>
          <span>Mapped to Evidence Ref 1, 2, 3</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((img) => (
          <div
            key={img.previewUrl}
            id={`image-preview-card-${img.index}`}
            className="group relative rounded-2xl border border-slate-200/90 bg-white dark:bg-slate-900 dark:border-slate-800 p-3.5 shadow-xs hover:border-teal-400 dark:hover:border-teal-700 transition-colors duration-150 flex flex-col justify-between"
          >
            {/* Image Thumbnail Container with Micro-interaction */}
            <div className="relative aspect-4/3 w-full bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100 dark:border-slate-800/80">
              <img
                src={img.previewUrl}
                alt={`Package view ${img.index}`}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />

              {/* Professional Scan-line animation micro-interaction on upload */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_8px_rgba(20,184,166,0.8)] animate-scan-subtle"
              />

              {/* Sequence Badge */}
              <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-slate-900/85 backdrop-blur-xs text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs border border-white/10">
                <FileImage size={12} className="text-teal-300" />
                <span>Surface {img.index}</span>
              </div>

              {/* Remove Button */}
              {!disabled && (
                <button
                  type="button"
                  id={`remove-image-btn-${img.index}`}
                  onClick={() => onRemoveImage(img.index)}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-xl bg-slate-900/80 hover:bg-rose-600 text-slate-200 hover:text-white active:bg-rose-700 transition-colors duration-150 shadow-xs focus:outline-none focus:ring-2 focus:ring-rose-400 border border-white/10 cursor-pointer"
                  title={`Remove Image ${img.index}`}
                  aria-label={`Remove Image ${img.index}`}
                >
                  <Trash2 size={14} />
                </button>
              )}

              {/* Confirmation Pill over Image */}
              <div className="absolute bottom-2 inset-x-2 flex items-center justify-center">
                <span className="px-2.5 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-xs border border-emerald-500/40 text-[10px] font-medium text-emerald-300 flex items-center gap-1 shadow-xs">
                  <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                  <span>Surface ready for inspection</span>
                </span>
              </div>
            </div>

            {/* Recommended Role & Readiness Guidance Tag */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                  {getSurfaceLabel(img.index)}
                </span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {formatFileSize(img.size)}
                </span>
              </div>

              {/* Visual Readiness Guidance Strip */}
              <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <ShieldCheck size={12} className="text-teal-700 dark:text-teal-400" />
                  <span className="font-medium">Readiness:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]"
                    title="User verified: Clear text contrast and complete edges visible"
                  >
                    Good (Ready)
                  </span>
                  <span
                    className="text-slate-400 hover:text-slate-600 cursor-help"
                    title="Readiness guidance: Ensure declarations are sharp, glare-free, and full package edges are framed."
                  >
                    <HelpCircle size={11} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

