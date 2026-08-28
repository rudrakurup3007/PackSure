/**
 * PackSure AI - Compliance Inspection Type Definitions
 * Strict contract definitions for backend API communication and UI rendering.
 */

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'WARNING';

export type BoundingBox = [number, number, number, number]; // [x1, y1, x2, y2]

export interface ProductInfo {
  type: string;
  name: string;
}

export interface DeclarationItem {
  field: string;
  value: string;
  image_index: number;
  bbox?: BoundingBox;
  confidence?: number;
}

export interface ViolationEvidence {
  value: string;
  image_index: number;
  bbox?: BoundingBox;
}

export interface ViolationItem {
  field: string;
  status: ComplianceStatus;
  rule_id: string;
  reason: string;
  evidence?: ViolationEvidence;
}

export interface ScanResult {
  inspection_id: string;
  product: ProductInfo;
  overall_status: ComplianceStatus;
  score: number; // 0 to 100
  declarations: DeclarationItem[];
  violations: ViolationItem[];
}

export interface UploadedImageFile {
  file: File;
  previewUrl: string;
  index: number; // 1-based index (1, 2, 3)
  name: string;
  size: number;
  type: string;
  naturalWidth?: number;
  naturalHeight?: number;
}

export type SelectedEvidenceTarget = {
  type: 'violation' | 'declaration';
  field: string;
  value: string;
  image_index: number;
  bbox?: BoundingBox;
  status?: ComplianceStatus;
  rule_id?: string;
  reason?: string;
  confidence?: number;
} | null;

export interface BackendHealthResponse {
  status: string;
}
