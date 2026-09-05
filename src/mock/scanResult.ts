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
