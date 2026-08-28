import { BoundingBox } from '../types/inspection';

export interface ScaledRect {
  left: number;
  top: number;
  width: number;
  height: number;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
}

/**
 * Validates whether a bbox has valid numeric dimensions
 */
export function isValidBbox(bbox?: unknown): bbox is BoundingBox {
  if (!Array.isArray(bbox) || bbox.length !== 4) {
    return false;
  }
  return bbox.every((val) => typeof val === 'number' && !isNaN(val) && val >= 0);
}

/**
 * Calculates display coordinates and percentage scaling for a bounding box
 * given the original image natural dimensions and displayed container dimensions.
 */
export function calculateScaledBbox(
  bbox: BoundingBox,
  naturalWidth: number,
  naturalHeight: number,
  displayedWidth?: number,
  displayedHeight?: number
): ScaledRect | null {
  if (!isValidBbox(bbox) || naturalWidth <= 0 || naturalHeight <= 0) {
    return null;
  }

  const [rawX1, rawY1, rawX2, rawY2] = bbox;

  // Normalize order in case x1 > x2 or y1 > y2
  const x1 = Math.min(rawX1, rawX2);
  const y1 = Math.min(rawY1, rawY2);
  const x2 = Math.max(rawX1, rawX2);
  const y2 = Math.max(rawY1, rawY2);

  // Clamp within image natural bounds
  const clampedX1 = Math.max(0, Math.min(x1, naturalWidth));
  const clampedY1 = Math.max(0, Math.min(y1, naturalHeight));
  const clampedX2 = Math.max(0, Math.min(x2, naturalWidth));
  const clampedY2 = Math.max(0, Math.min(y2, naturalHeight));

  const boxWidth = Math.max(2, clampedX2 - clampedX1);
  const boxHeight = Math.max(2, clampedY2 - clampedY1);

  // Calculate percentage values (0 - 100%)
  const leftPercent = (clampedX1 / naturalWidth) * 100;
  const topPercent = (clampedY1 / naturalHeight) * 100;
  const widthPercent = (boxWidth / naturalWidth) * 100;
  const heightPercent = (boxHeight / naturalHeight) * 100;

  // Calculate pixel values if displayed dimensions are provided
  const dispW = displayedWidth ?? naturalWidth;
  const dispH = displayedHeight ?? naturalHeight;
  const scaleX = dispW / naturalWidth;
  const scaleY = dispH / naturalHeight;

  return {
    left: clampedX1 * scaleX,
    top: clampedY1 * scaleY,
    width: boxWidth * scaleX,
    height: boxHeight * scaleY,
    leftPercent,
    topPercent,
    widthPercent,
    heightPercent,
  };
}

/**
 * Format field keys into clean, human-readable labels
 */
export function formatFieldLabel(fieldName: string): string {
  if (!fieldName) return 'Unknown Field';
  return fieldName
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Format status for presentation
 */
export function formatStatusLabel(status: string): string {
  if (status === 'COMPLIANT') return 'Compliant';
  if (status === 'NON_COMPLIANT') return 'Non-Compliant';
  if (status === 'WARNING') return 'Review Needed';
  return status;
}
