import { ScanResult } from '../types/inspection';
import {
  DEFAULT_MOCK_SCAN_RESULT,
  COMPLIANT_MOCK_SCAN_RESULT,
  REVIEW_REQUIRED_MOCK_SCAN_RESULT,
} from './scanResult';

export interface HistoricalInspection {
  id: string;
  name: string;
  category: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'WARNING';
  score: number;
  timestamp: string;
  rawDate: string; // ISO or relative
  violationsCount: number;
  declarationsCount: number;
  meanConfidence: number;
  isDemo: boolean;
  fullResult?: ScanResult;
}

/**
 * Believable operational demo history for compliance demonstration.
 * Clearly identified with isDemo: true so that demo data is transparent.
 */
export const SAMPLE_HISTORICAL_INSPECTIONS: HistoricalInspection[] = [
  {
    id: 'insp_00889',
    name: 'Organic Whole Grain Oats (500g)',
    category: 'Packaged Staples',
    status: 'COMPLIANT',
    score: 98,
    timestamp: 'Today, 11:20 AM',
    rawDate: '2026-09-06T11:20:00Z',
    violationsCount: 0,
    declarationsCount: 5,
    meanConfidence: 0.97,
    isDemo: true,
    fullResult: COMPLIANT_MOCK_SCAN_RESULT,
  },
  {
    id: 'insp_00123',
    name: 'Crunchy Bites Choco Biscuits (250g)',
    category: 'Packaged Food',
    status: 'NON_COMPLIANT',
    score: 72,
    timestamp: 'Today, 10:45 AM',
    rawDate: '2026-09-06T10:45:00Z',
    violationsCount: 2,
    declarationsCount: 6,
    meanConfidence: 0.91,
    isDemo: true,
    fullResult: DEFAULT_MOCK_SCAN_RESULT,
  },
  {
    id: 'insp_00742',
    name: 'Artisan Spiced Herbal Chai (200g)',
    category: 'Packaged Beverage',
    status: 'WARNING',
    score: 68,
    timestamp: 'Today, 09:15 AM',
    rawDate: '2026-09-06T09:15:00Z',
    violationsCount: 2,
    declarationsCount: 6,
    meanConfidence: 0.81,
    isDemo: true,
    fullResult: REVIEW_REQUIRED_MOCK_SCAN_RESULT,
  },
  {
    id: 'insp_00884',
    name: 'Almond Milk Beverage (1L)',
    category: 'Packaged Beverage',
    status: 'NON_COMPLIANT',
    score: 64,
    timestamp: 'Yesterday, 04:30 PM',
    rawDate: '2026-09-05T16:30:00Z',
    violationsCount: 3,
    declarationsCount: 5,
    meanConfidence: 0.89,
    isDemo: true,
    fullResult: {
      ...DEFAULT_MOCK_SCAN_RESULT,
      inspection_id: 'insp_00884',
      product: { name: 'Almond Milk Beverage (1L)', type: 'Packaged Beverage' },
      score: 64,
      overall_status: 'NON_COMPLIANT',
    },
  },
  {
    id: 'insp_00880',
    name: 'Pure Kachi Ghani Mustard Oil (500ml)',
    category: 'Edible Oils',
    status: 'COMPLIANT',
    score: 94,
    timestamp: 'Yesterday, 02:15 PM',
    rawDate: '2026-09-05T14:15:00Z',
    violationsCount: 0,
    declarationsCount: 6,
    meanConfidence: 0.96,
    isDemo: true,
    fullResult: {
      ...COMPLIANT_MOCK_SCAN_RESULT,
      inspection_id: 'insp_00880',
      product: { name: 'Pure Kachi Ghani Mustard Oil (500ml)', type: 'Edible Oils' },
      score: 94,
      overall_status: 'COMPLIANT',
    },
  },
  {
    id: 'insp_00877',
    name: 'Himalayan Pink Rock Salt (1kg)',
    category: 'Staples & Seasoning',
    status: 'COMPLIANT',
    score: 92,
    timestamp: 'Sep 4, 11:00 AM',
    rawDate: '2026-09-04T11:00:00Z',
    violationsCount: 0,
    declarationsCount: 5,
    meanConfidence: 0.94,
    isDemo: true,
    fullResult: {
      ...COMPLIANT_MOCK_SCAN_RESULT,
      inspection_id: 'insp_00877',
      product: { name: 'Himalayan Pink Rock Salt (1kg)', type: 'Staples & Seasoning' },
      score: 92,
      overall_status: 'COMPLIANT',
    },
  },
  {
    id: 'insp_00865',
    name: 'Classic Roasted Cashews (100g)',
    category: 'Snacks & Nuts',
    status: 'NON_COMPLIANT',
    score: 76,
    timestamp: 'Sep 4, 09:40 AM',
    rawDate: '2026-09-04T09:40:00Z',
    violationsCount: 1,
    declarationsCount: 5,
    meanConfidence: 0.93,
    isDemo: true,
    fullResult: {
      ...DEFAULT_MOCK_SCAN_RESULT,
      inspection_id: 'insp_00865',
      product: { name: 'Classic Roasted Cashews (100g)', type: 'Snacks & Nuts' },
      score: 76,
      overall_status: 'NON_COMPLIANT',
    },
  },
  {
    id: 'insp_00850',
    name: 'Multigrain Energy Bars (6x40g)',
    category: 'Packaged Food',
    status: 'WARNING',
    score: 70,
    timestamp: 'Sep 3, 03:20 PM',
    rawDate: '2026-09-03T15:20:00Z',
    violationsCount: 1,
    declarationsCount: 6,
    meanConfidence: 0.85,
    isDemo: true,
    fullResult: {
      ...REVIEW_REQUIRED_MOCK_SCAN_RESULT,
      inspection_id: 'insp_00850',
      product: { name: 'Multigrain Energy Bars (6x40g)', type: 'Packaged Food' },
      score: 70,
      overall_status: 'WARNING',
    },
  },
];

/**
 * Resolves a full ScanResult object for any historical inspection item.
 */
export function resolveHistoricalScanResult(item: HistoricalInspection): ScanResult {
  if (item.fullResult) return item.fullResult;
  if (item.status === 'COMPLIANT') {
    return {
      ...COMPLIANT_MOCK_SCAN_RESULT,
      inspection_id: item.id,
      product: { name: item.name, type: item.category },
      score: item.score,
      overall_status: 'COMPLIANT',
    };
  }
  if (item.status === 'WARNING') {
    return {
      ...REVIEW_REQUIRED_MOCK_SCAN_RESULT,
      inspection_id: item.id,
      product: { name: item.name, type: item.category },
      score: item.score,
      overall_status: 'WARNING',
    };
  }
  return {
    ...DEFAULT_MOCK_SCAN_RESULT,
    inspection_id: item.id,
    product: { name: item.name, type: item.category },
    score: item.score,
    overall_status: 'NON_COMPLIANT',
  };
}

const LOCAL_STORAGE_KEY = 'packsure_inspections_history_v1';

/**
 * Loads inspections combining stored live scans with believable demo records.
 */
export function getStoredInspections(): HistoricalInspection[] {
  if (typeof window === 'undefined') return SAMPLE_HISTORICAL_INSPECTIONS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return SAMPLE_HISTORICAL_INSPECTIONS;
    const parsed = JSON.parse(raw) as HistoricalInspection[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Merge live user scans in front of sample demo scans (avoiding duplicates)
      const liveItems = parsed.filter((item) => !item.isDemo);
      const demoItems = SAMPLE_HISTORICAL_INSPECTIONS;
      return [...liveItems, ...demoItems];
    }
  } catch (err) {
    console.warn('Failed to load local inspections history', err);
  }
  return SAMPLE_HISTORICAL_INSPECTIONS;
}

/**
 * Saves a new live scan result into localStorage inspection history.
 */
export function saveInspectionToHistory(scanResult: ScanResult): HistoricalInspection {
  const newItem: HistoricalInspection = {
    id: scanResult.inspection_id,
    name: scanResult.product?.name || 'Packaged Commodity',
    category: scanResult.product?.type || 'Packaged Goods',
    status: scanResult.overall_status,
    score: scanResult.score,
    timestamp: 'Just now',
    rawDate: new Date().toISOString(),
    violationsCount: scanResult.violations?.length || 0,
    declarationsCount: scanResult.declarations?.length || 0,
    meanConfidence:
      scanResult.declarations && scanResult.declarations.length > 0
        ? Math.round(
            (scanResult.declarations.reduce((acc, d) => acc + (d.confidence || 0.9), 0) /
              scanResult.declarations.length) *
              100
          ) / 100
        : 0.92,
    isDemo: false,
    fullResult: scanResult,
  };

  if (typeof window !== 'undefined') {
    try {
      const existing = getStoredInspections();
      const filtered = existing.filter((item) => item.id !== newItem.id && !item.isDemo);
      const updated = [newItem, ...filtered];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to persist inspection to localStorage', err);
    }
  }

  return newItem;
}

/**
 * Clears user-created inspections from localStorage cache.
 */
export function clearHistoryCache(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to clear history cache', err);
    }
  }
}
