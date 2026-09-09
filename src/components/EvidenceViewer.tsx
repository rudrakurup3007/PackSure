import React, { useState, useEffect, useRef } from 'react';
import {
  UploadedImageFile,
  SelectedEvidenceTarget,
  BoundingBox,
  ViolationItem,
  DeclarationItem,
} from '../types/inspection';
import { calculateScaledBbox, formatFieldLabel, isValidBbox } from '../utils/bbox';
import { StatusBadge } from './StatusBadge';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileImage,
  AlertTriangle,
  Crosshair,
  Scale,
  CheckCircle2,
  Info,
  Layers,
  Sparkles,
  Maximize2,
} from 'lucide-react';

interface EvidenceViewerProps {
  images: UploadedImageFile[];
  activeTarget: SelectedEvidenceTarget;
  onSelectTarget?: (target: SelectedEvidenceTarget) => void;
  violations?: ViolationItem[];
  declarations?: DeclarationItem[];
  layoutMode?: 'split' | 'canvas-only';
}

function getSurfaceLabel(index: number, fileName?: string): string {
  if (index === 1) return 'Surface 1: Front Panel';
  if (index === 2) return 'Surface 2: Back Panel';
  if (index === 3) return 'Surface 3: Declarations';
  return `Surface ${index}${fileName ? ` (${fileName})` : ''}`;
}

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({
  images,
  activeTarget,
  onSelectTarget,
  violations = [],
  declarations = [],
  layoutMode = 'canvas-only',
}) => {
  // Active selected image index (1-based: 1, 2, 3)
  const initialIndex = activeTarget?.image_index ?? (images.length > 0 ? images[0].index : 1);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(initialIndex);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showAllBoxes, setShowAllBoxes] = useState<boolean>(true);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imgElementRef = useRef<HTMLImageElement>(null);

  // Sync image index and reset zoom when activeTarget changes
  useEffect(() => {
    if (activeTarget && typeof activeTarget.image_index === 'number') {
      setSelectedImageIndex(activeTarget.image_index);
      setZoomLevel(1);
    }
  }, [activeTarget]);

  // Find corresponding uploaded image
  const currentImage = images.find((img) => img.index === selectedImageIndex);
  const isImageIndexValid = !!currentImage;

  // Read natural dimensions if image is already cached/complete
  useEffect(() => {
    if (imgElementRef.current && imgElementRef.current.complete && imgElementRef.current.naturalWidth > 0) {
      setNaturalDimensions({
        width: imgElementRef.current.naturalWidth,
        height: imgElementRef.current.naturalHeight,
      });
    }
  }, [selectedImageIndex, currentImage]);

  // Track image natural dimensions when loaded
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  };

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(3, +(prev + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.5, +(prev - 0.25).toFixed(2)));
  const handleResetZoom = () => setZoomLevel(1);

  // Check if current target belongs to current image and has valid bbox
  const isTargetForCurrentImage = activeTarget && activeTarget.image_index === selectedImageIndex;
  const rawTargetBbox = isTargetForCurrentImage ? activeTarget.bbox : undefined;
  const hasValidTargetBbox = isValidBbox(rawTargetBbox);

  const effectiveWidth =
    naturalDimensions.width > 0
      ? naturalDimensions.width
      : (imgElementRef.current?.naturalWidth && imgElementRef.current.naturalWidth > 0
          ? imgElementRef.current.naturalWidth
          : (currentImage?.naturalWidth || 600));

  const effectiveHeight =
    naturalDimensions.height > 0
      ? naturalDimensions.height
      : (imgElementRef.current?.naturalHeight && imgElementRef.current.naturalHeight > 0
          ? imgElementRef.current.naturalHeight
          : (currentImage?.naturalHeight || 600));

  // Scaled target bbox
  const scaledTargetBbox =
    hasValidTargetBbox && effectiveWidth > 0 && effectiveHeight > 0
      ? calculateScaledBbox(rawTargetBbox as BoundingBox, effectiveWidth, effectiveHeight)
      : null;

  // Gather other bounding boxes on the current surface
  const violationsOnCurrentSurface = violations.filter(
    (v) => v.evidence?.image_index === selectedImageIndex && isValidBbox(v.evidence?.bbox)
  );

  const declarationsOnCurrentSurface = declarations.filter(
    (d) => d.image_index === selectedImageIndex && isValidBbox(d.bbox)
  );

  return (
    <div
      id="evidence-viewer-container"
      tabIndex={-1}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col scroll-mt-24 outline-none transition-shadow"
    >
      {/* Top Header & Surface Switcher */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
            <Crosshair size={18} className="stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Spatial Evidence Inspector
              </h3>
              {activeTarget && (
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  Target: {formatFieldLabel(activeTarget.field)}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Interactive package surface evidence verification
            </p>
          </div>
        </div>

        {/* Surface Selection Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 hidden sm:inline">
            Surfaces:
          </span>
          {images.map((img) => {
            const isActive = img.index === selectedImageIndex;
            const hasTarget = activeTarget?.image_index === img.index;
            const hasViolation = violations.some((v) => v.evidence?.image_index === img.index);

            return (
              <button
                key={img.index}
                id={`select-evidence-image-${img.index}`}
                type="button"
                onClick={() => {
                  setSelectedImageIndex(img.index);
                  setZoomLevel(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                }`}
              >
                <FileImage size={13} />
                <span>{getSurfaceLabel(img.index)}</span>
                {hasViolation && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isActive ? 'bg-amber-300' : 'bg-rose-500'
                    }`}
                    title="Violation detected on this surface"
                  />
                )}
                {hasTarget && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-white ring-1 ring-white"
                    title="Active target"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Viewport Workspace */}
      <div className={`grid ${layoutMode === 'split' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'} flex-1`}>
        {/* Canvas Area */}
        <div
          className={`${
            layoutMode === 'split' ? 'lg:col-span-7' : 'col-span-1'
          } bg-slate-950 p-4 sm:p-5 flex flex-col justify-between relative min-h-[460px]`}
        >
          {/* Zoom & Overlay Toolbar */}
          <div className="flex items-center justify-between z-10 mb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-xs text-white px-2.5 py-1.5 rounded-xl border border-white/10 text-xs">
              <span className="font-mono font-medium">Surface {selectedImageIndex}</span>
              {currentImage && (
                <span className="text-slate-400 text-[11px] truncate max-w-[140px] sm:max-w-[200px]">
                  • {currentImage.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Toggle all regions */}
              <button
                type="button"
                onClick={() => setShowAllBoxes((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  showAllBoxes
                    ? 'bg-indigo-600/90 text-white border-indigo-400/40'
                    : 'bg-slate-900/80 text-slate-300 border-white/10 hover:bg-slate-800'
                }`}
                title="Toggle showing all bounding boxes on this surface"
              >
                <Layers size={13} />
                <span className="hidden sm:inline">All Regions</span>
              </button>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-xs p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="text-[11px] font-mono text-slate-200 px-1 min-w-[36px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Reset Zoom"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Viewport Canvas */}
          <div
            ref={imageContainerRef}
            className="flex-1 relative flex items-center justify-center overflow-auto rounded-xl bg-slate-900/90 border border-white/5 p-4 min-h-[360px]"
          >
            {/* Signature "Evidence Verified" Floating Badge */}
            {isTargetForCurrentImage && hasValidTargetBbox && (
              <div
                id="evidence-verified-badge"
                className="absolute top-4 left-4 z-20 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shadow-lg backdrop-blur-xs animate-in fade-in duration-200"
              >
                <CheckCircle2 size={14} className="text-emerald-400 stroke-[2.5]" />
                <span>Evidence Verified • Surface {selectedImageIndex}</span>
                <span className="font-mono text-[10px] text-emerald-400/80">
                  [{rawTargetBbox?.join(', ')}]
                </span>
              </div>
            )}

            {/* Unavailable / Review State Floating Badge */}
            {isTargetForCurrentImage && !hasValidTargetBbox && (
              <div
                id="evidence-unavailable-badge"
                className="absolute top-4 left-4 z-20 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-950/90 text-amber-300 border border-amber-500/40 shadow-lg backdrop-blur-xs animate-in fade-in duration-200"
              >
                <AlertTriangle size={14} className="text-amber-400 stroke-[2.5]" />
                <span>Coordinates Unavailable • Surface {selectedImageIndex}</span>
                <span className="text-[10px] text-amber-300/80 font-medium">
                  (Manual Visual Review)
                </span>
              </div>
            )}

            {/* Unavailable / Review State Overlay Banner */}
            {isTargetForCurrentImage && !hasValidTargetBbox && (
              <div
                id="evidence-bbox-missing-banner"
                className="absolute bottom-4 left-4 right-4 z-20 bg-slate-900/95 border border-amber-500/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-200 backdrop-blur-xs shadow-xl pointer-events-auto"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-white block">
                      Bounding Box Unavailable: {formatFieldLabel(activeTarget.field)}
                    </span>
                    <span className="text-[11px] text-amber-200/90">
                      Visual boundary coordinates were not extracted. Please visually inspect package Surface {selectedImageIndex}.
                    </span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 self-start sm:self-auto px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  Review Required
                </span>
              </div>
            )}

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
                  className="max-h-[460px] w-auto object-contain rounded-lg select-none block shadow-xl"
                  referrerPolicy="no-referrer"
                />

                {/* Render All Bounding Boxes if showAllBoxes is true */}
                {naturalDimensions.width > 0 && naturalDimensions.height > 0 && (
                  <>
                    {/* Declarations on this surface (Indigo) */}
                    {showAllBoxes &&
                      declarationsOnCurrentSurface.map((d, idx) => {
                        const isThisActive = activeTarget?.field === d.field;
                        if (isThisActive) return null; // Rendered separately with highlight

                        const box = calculateScaledBbox(
                          d.bbox as BoundingBox,
                          naturalDimensions.width,
                          naturalDimensions.height
                        );

                        return (
                          <div
                            key={`decl-box-${d.field}-${idx}`}
                            onClick={() =>
                              onSelectTarget &&
                              onSelectTarget({
                                field: d.field,
                                value: d.value,
                                image_index: d.image_index,
                                bbox: d.bbox,
                                confidence: d.confidence,
                                status: 'COMPLIANT',
                              })
                            }
                            className="absolute border-2 border-indigo-400/80 bg-indigo-500/10 hover:bg-indigo-500/25 rounded-sm transition-all duration-150 cursor-pointer group"
                            style={{
                              left: `${box.leftPercent}%`,
                              top: `${box.topPercent}%`,
                              width: `${box.widthPercent}%`,
                              height: `${box.heightPercent}%`,
                            }}
                            title={`Declaration: ${formatFieldLabel(d.field)} - "${d.value}"`}
                          >
                            <div className="absolute -top-5 left-0 bg-indigo-600/90 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap pointer-events-none">
                              {formatFieldLabel(d.field)}
                            </div>
                          </div>
                        );
                      })}

                    {/* Violations on this surface (Rose / Red) */}
                    {showAllBoxes &&
                      violationsOnCurrentSurface.map((v, idx) => {
                        const isThisActive = activeTarget?.field === v.field;
                        if (isThisActive) return null; // Rendered with highlight

                        const box = calculateScaledBbox(
                          v.evidence!.bbox as BoundingBox,
                          naturalDimensions.width,
                          naturalDimensions.height
                        );

                        return (
                          <div
                            key={`viol-box-${v.field}-${idx}`}
                            onClick={() =>
                              onSelectTarget &&
                              onSelectTarget({
                                field: v.field,
                                value: v.evidence?.value || 'Non-compliant',
                                image_index: v.evidence?.image_index || selectedImageIndex,
                                bbox: v.evidence?.bbox,
                                rule_id: v.rule_id,
                                reason: v.reason,
                                status: v.status || 'NON_COMPLIANT',
                              })
                            }
                            className="absolute border-2 border-rose-500 bg-rose-500/20 hover:bg-rose-500/35 rounded-sm transition-all duration-150 cursor-pointer group animate-pulse"
                            style={{
                              left: `${box.leftPercent}%`,
                              top: `${box.topPercent}%`,
                              width: `${box.widthPercent}%`,
                              height: `${box.heightPercent}%`,
                            }}
                            title={`Violation: ${formatFieldLabel(v.field)} - Rule: ${v.rule_id}`}
                          >
                            <div className="absolute -top-5 left-0 bg-rose-600 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap pointer-events-none flex items-center gap-1">
                              <AlertTriangle size={9} />
                              {v.rule_id}
                            </div>
                          </div>
                        );
                      })}

                    {/* Active Selected Target Highlight (Subtle Glow + Reticles) */}
                    {isTargetForCurrentImage && scaledTargetBbox && (
                      <div
                        id="evidence-bounding-box"
                        className={`absolute border-2 rounded-md transition-all duration-200 z-10 ${
                          activeTarget.status === 'NON_COMPLIANT' || activeTarget.rule_id
                            ? 'border-rose-500 bg-rose-500/20 ring-2 ring-rose-400/60 shadow-md'
                            : 'border-indigo-400 bg-indigo-500/20 ring-2 ring-indigo-400/60 shadow-md'
                        }`}
                        style={{
                          left: `${scaledTargetBbox.leftPercent}%`,
                          top: `${scaledTargetBbox.topPercent}%`,
                          width: `${scaledTargetBbox.widthPercent}%`,
                          height: `${scaledTargetBbox.heightPercent}%`,
                        }}
                      >
                        {/* Floating Pin Label */}
                        <div
                          className={`absolute -top-7 left-0 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md whitespace-nowrap flex items-center gap-1.5 ${
                            activeTarget.status === 'NON_COMPLIANT' || activeTarget.rule_id
                              ? 'bg-rose-600'
                              : 'bg-indigo-600'
                          }`}
                        >
                          <Crosshair size={11} className="stroke-[2.5]" />
                          <span>{formatFieldLabel(activeTarget.field)}</span>
                          {activeTarget.value && (
                            <span className="font-mono text-white/90">
                              "{activeTarget.value}"
                            </span>
                          )}
                        </div>

                        {/* Corner Reticle Accents */}
                        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-white" />
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-white" />
                        <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-white" />
                        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-white" />
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              /* Invalid image index alert */
              <div id="invalid-image-index-alert" className="text-center p-6 space-y-2 text-rose-400">
                <AlertTriangle size={32} className="mx-auto text-rose-500" />
                <h4 className="text-sm font-bold text-white">Evidence image not found</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Surface #{selectedImageIndex} was not found among uploaded images.
                </p>
              </div>
            )}
          </div>

          {/* Viewport Footer & Semantic Legend */}
          <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Violation (Rose)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span>Declaration (Indigo)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 ring-2 ring-rose-400/60" />
                <span>Active Target (Glow)</span>
              </span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto font-mono text-[10px] text-slate-500">
              {naturalDimensions.width > 0 && (
                <span>
                  {naturalDimensions.width} × {naturalDimensions.height}px
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Optional Split-Mode Details Panel (Only if layoutMode === 'split') */}
        {layoutMode === 'split' && (
          <div className="lg:col-span-5 p-6 flex flex-col justify-between space-y-4 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-slate-800">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                  Target Inspection Record
                </span>
                {activeTarget?.status && <StatusBadge status={activeTarget.status} size="sm" />}
              </div>

              {activeTarget ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Mandatory Declaration Field
                    </span>
                    <div className="text-base font-bold text-slate-900 dark:text-white">
                      {formatFieldLabel(activeTarget.field)}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      Detected Value on Package:
                    </span>
                    <div className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                      "{activeTarget.value}"
                    </div>
                  </div>

                  {activeTarget.rule_id && (
                    <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 rounded-xl border border-rose-200/80 dark:border-rose-900/60 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-300">
                        <Scale size={13} className="text-rose-600" />
                        <span>Rule: {activeTarget.rule_id}</span>
                      </div>
                      {activeTarget.reason && (
                        <p className="text-xs text-rose-900 dark:text-rose-200 leading-relaxed">
                          {activeTarget.reason}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Select any violation or declaration to inspect bounding location
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
