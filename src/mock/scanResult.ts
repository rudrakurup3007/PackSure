import { ScanResult } from '../types/inspection';

/**
 * Standard mock scan result as specified in the PackSure AI technical contract.
 */
export const DEFAULT_MOCK_SCAN_RESULT: ScanResult = {
  inspection_id: 'insp_00123',
  product: {
    type: 'packaged_food',
    name: 'Choco Biscuits',
  },
  overall_status: 'NON_COMPLIANT',
  score: 72,
  declarations: [
    {
      field: 'mrp',
      value: 'Rs.45.00',
      image_index: 1,
      bbox: [112, 88, 240, 110],
      confidence: 0.94,
    },
    {
      field: 'net_quantity',
      value: '250',
      image_index: 2,
      bbox: [120, 300, 210, 330],
      confidence: 0.81,
    },
    {
      field: 'manufacturer_name',
      value: 'Apex Confectionery Foods Pvt Ltd',
      image_index: 1,
      bbox: [60, 430, 420, 465],
      confidence: 0.96,
    },
    {
      field: 'expiry_date',
      value: 'BEST BEFORE 12/2026',
      image_index: 2,
      bbox: [290, 85, 470, 115],
      confidence: 0.91,
    },
    {
      field: 'fssai_license',
      value: 'Lic. No. 10019022009871',
      image_index: 2,
      bbox: [60, 520, 360, 550],
      confidence: 0.98,
    },
    {
      field: 'consumer_care',
      value: 'care@apexconfectionery.in',
      image_index: 3,
      bbox: [70, 180, 430, 212],
      confidence: 0.89,
    },
  ],
  violations: [
    {
      field: 'net_quantity',
      status: 'NON_COMPLIANT',
      rule_id: 'PCR-R9',
      reason: 'No standard unit found (e.g. g, kg, ml). Quantity declared as bare numeral without mandatory SI unit of measurement under Legal Metrology (Packaged Commodities) Rules.',
      evidence: {
        value: '250',
        image_index: 2,
        bbox: [120, 300, 210, 330],
      },
    },
    {
      field: 'mrp_unit_sale_price',
      status: 'NON_COMPLIANT',
      rule_id: 'PCR-R14',
      reason: 'Unit sale price declaration missing alongside Maximum Retail Price (mandatory for pre-packaged commodities > 100g/ml).',
      evidence: {
        value: 'Rs.45.00',
        image_index: 1,
        bbox: [112, 88, 240, 110],
      },
    },
  ],
};

/**
 * Fully Compliant scenario mock for testing clean 100% compliance pass
 */
export const COMPLIANT_MOCK_SCAN_RESULT: ScanResult = {
  inspection_id: 'insp_00889',
  product: {
    type: 'packaged_staple',
    name: 'Organic Whole Grain Oats',
  },
  overall_status: 'COMPLIANT',
  score: 98,
  declarations: [
    {
      field: 'mrp',
      value: '₹ 180.00 (Incl. of all taxes)',
      image_index: 1,
      bbox: [110, 80, 340, 115],
      confidence: 0.98,
    },
    {
      field: 'unit_sale_price',
      value: '₹ 0.36 / g',
      image_index: 1,
      bbox: [110, 120, 260, 145],
      confidence: 0.95,
    },
    {
      field: 'net_quantity',
      value: '500 g',
      image_index: 2,
      bbox: [120, 280, 240, 315],
      confidence: 0.97,
    },
    {
      field: 'country_of_origin',
      value: 'India',
      image_index: 2,
      bbox: [120, 340, 220, 370],
      confidence: 0.99,
    },
    {
      field: 'fssai_license',
      value: 'Lic. No. 11220334000123',
      image_index: 2,
      bbox: [60, 480, 360, 510],
      confidence: 0.97,
    },
  ],
  violations: [],
};

/**
 * Review Required / Low Confidence scenario mock for testing edge cases
 */
export const REVIEW_REQUIRED_MOCK_SCAN_RESULT: ScanResult = {
  inspection_id: 'insp_00742',
  product: {
    type: 'packaged_beverage',
    name: 'Artisan Spiced Herbal Chai',
  },
  overall_status: 'WARNING',
  score: 68,
  declarations: [
    {
      field: 'mrp',
      value: '₹ 240.00 (Incl. of all taxes)',
      image_index: 1,
      bbox: [110, 80, 340, 115],
      confidence: 0.92,
    },
    {
      field: 'unit_sale_price',
      value: '₹ 1.20 / g',
      image_index: 1,
      bbox: [110, 120, 260, 145],
      confidence: 0.88,
    },
    {
      field: 'net_quantity',
      value: '200 g',
      image_index: 2,
      bbox: [120, 280, 240, 315],
      confidence: 0.94,
    },
    {
      field: 'expiry_date',
      value: 'LOT #98 EXP: 08/2026?',
      image_index: 2,
      bbox: [280, 90, 460, 120],
      confidence: 0.62,
    },
    {
      field: 'manufacturer_name',
      value: 'Himalayan Botanicals & Herbs Co.',
      image_index: 1,
      bbox: [50, 420, 390, 455],
      confidence: 0.74,
    },
    {
      field: 'fssai_license',
      value: 'Lic. No. 10021011000456',
      image_index: 2,
      bbox: [60, 480, 360, 510],
      confidence: 0.95,
    },
  ],
  violations: [
    {
      field: 'expiry_date',
      status: 'WARNING',
      rule_id: 'PCR-R6-1-D',
      reason: 'Low OCR confidence (62%) on dot-matrix stamp. Character legibility is borderline due to curved surface; manual verification recommended under Rule 6(1)(d).',
      evidence: {
        value: 'LOT #98 EXP: 08/2026?',
        image_index: 2,
        bbox: [280, 90, 460, 120],
      },
    },
    {
      field: 'manufacturer_name',
      status: 'WARNING',
      rule_id: 'PCR-R6-1-A',
      reason: 'Physical manufacturing facility address appears partially obscured near package seam. Physical inspection recommended to ensure complete postal PIN code.',
      evidence: {
        value: 'Himalayan Botanicals & Herbs Co.',
        image_index: 1,
        bbox: [50, 420, 390, 455],
      },
    },
  ],
};
