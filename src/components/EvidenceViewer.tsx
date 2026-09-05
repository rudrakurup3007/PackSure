import React, { useState, useEffect, useRef } from 'react';
import { UploadedImageFile, SelectedEvidenceTarget, BoundingBox } from '../types/inspection';
import { calculateScaledBbox, formatFieldLabel, isValidBbox } from '../utils/bbox';
import { StatusBadge } from './StatusBadge';
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileImage,
  AlertTriangle,
  Crosshair,
  Scale,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface EvidenceViewerProps {
  images: UploadedImageFile[];
  activeTarget: SelectedEvidenceTarget;
  onSelectTarget?: (target: SelectedEvidenceTarget) => void;
}

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({
  images,
  activeTarget,
}) => {
  // Active selected image index (1-based: 1, 2, 3)
  const initialIndex = activeTarget?.image_index ?? (images.length > 0 ? images[0].index : 1);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(initialIndex);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imgElementRef = useRef<HTMLImageElement>(null);

  // Sync image index when activeTarget changes
  useEffect(() => {
    if (activeTarget && typeof activeTarget.image_index === 'number') {
      setSelectedImageIndex(activeTarget.image_index);
      setZoomLevel(1); // Reset zoom on new target
    }
  }, [activeTarget]);

  // Find corresponding uploaded image
  const currentImage = images.find((img) => img.index === selectedImageIndex);
  const isImageIndexValid = !!currentImage;

  // Track image natural dimensions when loaded
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  };

  // Check if current target belongs to current image and has valid bbox
  const isTargetForCurrentImage = activeTarget && activeTarget.image_index === selectedImageIndex;
  const rawBbox = isTargetForCurrentImage ? activeTarget.bbox : undefined;
  const hasValidBbox = isValidBbox(rawBbox);

  // Calculate scaled box coordinates
  const scaledBbox =
    hasValidBbox && naturalDimensions.width > 0 && naturalDimensions.height > 0
      ? calculateScaledBbox(rawBbox as BoundingBox, naturalDimensions.width, naturalDimensions.height)
      : null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(2.5, prev + 0.25));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.75, prev - 0.25));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <div
      id="evidence-viewer-container"
      className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden"
    >
      {/* Header bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-2xs">
            <Crosshair size={18} className="stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
              <span>Evidence Spatial Inspector</span>
              {activeTarget && (
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/60">
                  Target: {formatFieldLabel(activeTarget.field)}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Correlating detected commodity declarations with visual package bounding coordinates
            </p>
          </div>
        </div>

        {/* Image Switcher Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-0.5">
            Surfaces:
          </span>
          {images.map((img) => {
            const isActive = img.index === selectedImageIndex;
            const hasTarget = activeTarget?.image_index === img.index;

            return (
              <button
                key={img.index}
                id={`select-evidence-image-${img.index}`}
                type="button"
                onClick={() => {
                  setSelectedImageIndex(img.index);
                  setZoomLevel(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                }`}
              >
                <FileImage size={13} />
                <span>Image {img.index}</span>
                {hasTarget && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isActive ? 'bg-amber-300' : 'bg-rose-500 animate-pulse'
                    }`}
                    title="Active evidence target located on this image"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px]">
        {/* LEFT: Package Viewport (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950 p-4 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative">
          {/* Zoom Toolbar */}
          <div className="flex items-center justify-between z-10 mb-2">
            <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-xs text-white p-1 rounded-lg border border-white/10 text-xs">
              <span className="px-2 font-mono font-medium">Image {selectedImageIndex}</span>
              {currentImage && (
                <span className="text-slate-400 text-[11px] truncate max-w-[120px] sm:max-w-[200px]">
                  ({currentImage.name})
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-xs p-1 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 text-slate-300 hover:text-white rounded hover:bg-white/10 transition"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-[11px] font-mono text-slate-300 px-1">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 text-slate-300 hover:text-white rounded hover:bg-white/10 transition"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1 text-slate-300 hover:text-white rounded hover:bg-white/10 transition"
                title="Reset Zoom"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* Viewport Canvas & BBox Overlay */}
          <div
            ref={imageContainerRef}
            className="flex-1 relative flex items-center justify-center overflow-auto rounded-xl bg-slate-900/80 border border-white/5 p-2 min-h-[360px]"
          >
            {isImageIndexValid ? (
              <div
                className="relative inline-block transition-transform duration-150 origin-center"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                <img
                  ref={imgElementRef}
                  src={currentImage.previewUrl}
                  alt={`Package evidence view ${currentImage.index}`}
                  onLoad={handleImageLoad}
                  className="max-h-[460px] w-auto object-contain rounded select-none block shadow-lg"
                  referrerPolicy="no-referrer"
                />

                {/* Scaled Bounding Box Overlay */}
                {isTargetForCurrentImage && scaledBbox && (
                  <div
                    id="evidence-bounding-box"
                    className="absolute border-2 border-rose-500 bg-rose-500/20 rounded shadow-lg pointer-events-none transition-all duration-300 animate-pulse"
                    style={{
                      left: `${scaledBbox.leftPercent}%`,
                      top: `${scaledBbox.topPercent}%`,
                      width: `${scaledBbox.widthPercent}%`,
                      height: `${scaledBbox.heightPercent}%`,
                    }}
                  >
                    {/* Floating Target Label Pin */}
                    <div className="absolute -top-7 left-0 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md whitespace-nowrap flex items-center gap-1">
                      <Crosshair size={10} />
                      <span>{formatFieldLabel(activeTarget.field)}</span>
                    </div>

                    {/* Corner Reticle Markers */}
                    <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-white" />
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-white" />
                    <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-white" />
                    <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-white" />
                  </div>
                )}
              </div>
            ) : (
              /* Invalid image index error fallback */
              <div
                id="invalid-image-index-alert"
                className="text-center p-6 space-y-2 text-rose-400"
              >
                <AlertTriangle size={32} className="mx-auto text-rose-500" />
                <h4 className="text-sm font-bold text-white">Evidence image could not be identified</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  The backend referenced Image #{selectedImageIndex}, which is not present in the {images.length} uploaded files.
                </p>
              </div>
            )}
          </div>

          {/* Viewport status footer */}
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>
                Natural Resolution: {naturalDimensions.width} × {naturalDimensions.height}px
              </span>
            </div>

            {hasValidBbox && isTargetForCurrentImage ? (
              <span className="font-mono text-slate-300">
                bbox: [{rawBbox?.join(', ')}]
              </span>
            ) : isTargetForCurrentImage ? (
              <span className="text-amber-400 flex items-center gap-1">
                <Info size={12} />
                Evidence location unavailable
              </span>
            ) : null}
          </div>
        </div>

        {/* RIGHT: Evidence Information Panel (5 cols) */}
        <div className="lg:col-span-5 p-5 flex flex-col justify-between space-y-4 bg-white dark:bg-slate-900">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                Inspection Record Details
              </span>
              {activeTarget?.status && (
                <StatusBadge status={activeTarget.status} size="sm" />
              )}
            </div>

            {activeTarget ? (
              <div className="space-y-4 text-left">
                {/* Field & Value */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    Mandatory Declaration Field
                  </span>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatFieldLabel(activeTarget.field)}
                  </div>
                </div>

                {/* Detected Value Card */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Detected Value on Package:
                  </span>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-white">
                    "{activeTarget.value}"
                  </div>
                </div>

                {/* Legal Rule & Violation Reason if applicable */}
                {activeTarget.rule_id && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/60 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-300">
                      <Scale size={14} className="text-rose-600" />
                      <span>Legal Metrology Clause: {activeTarget.rule_id}</span>
                    </div>
                    {activeTarget.reason && (
                      <p className="text-xs text-rose-900 dark:text-rose-200 leading-relaxed">
                        {activeTarget.reason}
                      </p>
                    )}
                  </div>
                )}

                {/* Source Mapping Info */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Image Index:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Image {activeTarget.image_index}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Detection Confidence:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {activeTarget.confidence !== undefined
                        ? `${Math.round(activeTarget.confidence * (activeTarget.confidence <= 1 ? 100 : 1))}%`
                        : 'Verified (100%)'}
                    </span>
                  </div>
                </div>

                {/* Bounding Box Coordinates details */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Crosshair size={12} />
                    Bounding Box Coordinates [x1, y1, x2, y2]:
                  </span>
                  {hasValidBbox ? (
                    <div className="font-mono text-xs text-slate-800 dark:text-slate-200 font-semibold">
                      [{rawBbox?.join(', ')}]
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600 dark:text-amber-400 italic">
                      Evidence location unavailable from backend OCR bounding module
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* No item selected state */
              <div className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
                <Info size={32} className="mx-auto text-slate-400" />
                <p className="text-sm font-medium">Select a declaration or violation below</p>
                <p className="text-xs max-w-xs mx-auto">
                  Clicking "View Evidence" on any compliance finding will highlight its exact location on the package.
                </p>
              </div>
            )}
          </div>

          {/* Quick Help text */}
          <div className="text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
            <span>Coordinates dynamically scaled to uploaded container dimensions</span>
          </div>
        </div>
      </div>
    </div>
  );
};
