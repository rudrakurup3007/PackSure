import React from 'react';
import { UploadedImageFile } from '../types/inspection';
import { Trash2, FileImage, Layers } from 'lucide-react';

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

  return (
    <div id="image-previews-container" className="space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-indigo-600 dark:text-indigo-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Selected Package Views ({images.length} / 3)
          </h4>
        </div>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Mapped as Image 1, 2, 3 in spatial evidence references
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((img) => (
          <div
            key={img.previewUrl}
            id={`image-preview-card-${img.index}`}
            className="group relative rounded-2xl border border-slate-200/90 bg-white dark:bg-slate-900 dark:border-slate-800 p-3 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col justify-between"
          >
            {/* Image Thumbnail Container */}
            <div className="relative aspect-4/3 w-full bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100 dark:border-slate-800/80">
              <img
                src={img.previewUrl}
                alt={`Package view ${img.index}`}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />

              {/* Sequence Badge */}
              <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-slate-900/85 backdrop-blur-xs text-white text-xs font-bold flex items-center gap-1.5 shadow-xs border border-white/10">
                <FileImage size={12} className="text-indigo-300" />
                <span>Image {img.index}</span>
              </div>

              {/* Remove Button */}
              {!disabled && (
                <button
                  type="button"
                  id={`remove-image-btn-${img.index}`}
                  onClick={() => onRemoveImage(img.index)}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-900/80 hover:bg-rose-600 text-slate-200 hover:text-white active:scale-95 transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-rose-400 border border-white/10"
                  title={`Remove Image ${img.index}`}
                  aria-label={`Remove Image ${img.index}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Metadata footer */}
            <div className="mt-2.5 px-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span className="truncate max-w-[150px] font-semibold text-slate-800 dark:text-slate-200 text-xs" title={img.name}>
                {img.name}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {formatFileSize(img.size)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
