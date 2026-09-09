/**
 * PackSure AI - Statutory Rule Catalog
 * SINGLE SOURCE OF TRUTH: rules.json and exceptions.json
 * Legal Metrology (Packaged Commodities) Rules, 2011 (LMPC Rules)
 * Rules Version: 1.0 (Rule IDs Frozen)
 */

export interface RuleApplicability {
  type: 'package_scope' | 'conditional';
  condition: string;
  exception_ref?: string;
  note?: string;
}

export interface RuleValidation {
  type: string;
  required: boolean;
  unit_in?: string[];
  expected_role?: string;
  note?: string;
}

export interface RuleOutputs {
  pass: string;
  fail: string;
  review: string;
  na: string;
}

export interface RuleException {
  id: string;
  applies_to_rule: string;
  condition: string;
  effect: string;
  reasoning: string;
  status?: string;
}

export interface StatutoryRule {
  rule_id: string;
  field: string;
  requirement: string;
  legal_reference: string;
  applicability: RuleApplicability;
  evidence_required: string[];
  validation: RuleValidation;
  outputs: RuleOutputs;
  notes?: string;
  status?: string;
  exceptions?: RuleException[];
}

export const RULES_METADATA = {
  rules_version: '1.0',
  note: 'Rule IDs are FROZEN as of this version. Do not renumber without a version bump and team-wide notice.',
  confidence_threshold: {
    review_below: 0.6,
    note: "If OCR confidence for a field's evidence is below this, result = REVIEW regardless of validation outcome (unless evidence is fully absent, in which case FAIL).",
  },
  date_role_policy: {
    field_name: 'date_role',
    allowed_values: ['manufacturing', 'best_before_use_by', 'unclear'],
    rule: "A detected date is not sufficient evidence of the declaration type. The extraction must identify date_role. An unresolved date role (null or 'unclear') MUST result in REVIEW - it must never be inferred or defaulted to 'manufacturing' or 'best_before_use_by'.",
    applies_to_rules: ['PCR-R05', 'PCR-R08'],
  },
  food_products_scope_note:
    "For packages containing food articles, several Rule 6(1) clauses in the LMPC Rules, 2011 explicitly carve out food and defer to food-specific legislation instead (originally the Prevention of Food Adulteration Act, 1954; now superseded in practice by the Food Safety and Standards Act, 2006 and FSSAI regulations). This carve-out is confirmed to apply to at least the manufacturer/packer/importer declaration (Rule 6(1)(a), Explanation III) and the manufacturing-date declaration (Rule 6(1)(d), first proviso), and the 2023 amendment extends a similar food carve-out to the unit sale price declaration (Rule 6(11)). PackSure's rule set (PCR-R01-R11) implements the Legal Metrology / LMPC framework only. It is NOT a complete compliance framework for food products - food packages may have additional or substituted requirements under FSSAI that this MVP does not evaluate. This should be stated plainly wherever PackSure's scope is described to users, teammates, or judges.",
};

export const STATUTORY_EXCEPTIONS: RuleException[] = [
  {
    id: 'country_of_origin_not_imported',
    applies_to_rule: 'PCR-R07',
    condition: 'product.is_imported == false',
    effect: 'result = N/A',
    reasoning:
      'Country of origin is only a mandatory declaration for imported packages. Do not fail a domestic product for missing it.',
  },
  {
    id: 'import_status_unknown',
    applies_to_rule: 'PCR-R07',
    condition: 'product.is_imported == unknown',
    effect: 'result = REVIEW',
    reasoning:
      'If we cannot confirm whether the product is imported, do not guess. An unresolved applicability question must not silently become N/A (which would hide a possible violation) or FAIL (which could wrongly penalize a domestic product).',
    status:
      "MVP INTEGRATION DECISION (not a legal ambiguity) - the legal requirement itself (country of origin for imports) is settled; what's open is whether this MVP's pipeline attempts import-status classification at all. Confirm with Person 1 whether that's in scope, or whether this rule always REVIEWs for the demo.",
  },
  {
    id: 'expiry_date_not_perishable',
    applies_to_rule: 'PCR-R08',
    condition: 'product.may_expire == false',
    effect: 'result = N/A',
    reasoning:
      'Best before/use by is only required for commodities that may become unfit for consumption over time (Rule 6(1)(da)). Non-perishable items (e.g. steel utensils, stationery) should not be failed for lacking this.',
  },
  {
    id: 'expiry_status_unknown',
    applies_to_rule: 'PCR-R08',
    condition: 'product.may_expire == unknown',
    effect: 'result = REVIEW',
    reasoning:
      "If perishability isn't confirmed, treat it as unresolved applicability, not N/A or FAIL.",
    status:
      "MVP INTEGRATION DECISION (not a legal ambiguity) - Rule 6(1)(da)'s requirement for perishable goods is settled; what's open is whether this MVP's pipeline classifies perishability at all, or treats every product as 'unknown' (→ REVIEW). Confirm scope with Person 1/3.",
  },
  {
    id: 'unit_sale_price_not_applicable',
    applies_to_rule: 'PCR-R09',
    condition: 'product.requires_unit_sale_price == false',
    effect: 'result = N/A',
    reasoning:
      "Confirmed: unit sale price does not apply to combination/group/multi-piece packages (2023 amendment), or to food articles (FSSAI carve-out, 2023 amendment). Plausible but NOT independently confirmed this pass: RSP-equals-USP exemption, wholesale-package exemption. An earlier version of this file also claimed an e-commerce exemption for unit sale price specifically - that claim was NOT confirmed and has been removed; the confirmed e-commerce carve-out (Rule 6(10)) applies to the manufacturing-date declaration, not unit sale price. See rule's legal_reference in rules.json for full sourcing.",
  },
  {
    id: 'unit_sale_price_status_unknown',
    applies_to_rule: 'PCR-R09',
    condition: 'product.requires_unit_sale_price == unknown',
    effect: 'result = REVIEW',
    reasoning:
      'Applicability of unit sale price depends on package type and pricing, which may not always be determinable from the image alone. Do not guess.',
    status:
      "MVP INTEGRATION DECISION (not a legal ambiguity) - the exemption conditions confirmed this pass (combination/group/multi-piece packages, food articles) are settled by Rule 6(11) and its 2023 amendment; RSP=USP and wholesale-package exemptions remain plausible but unconfirmed. What's open is whether this MVP's pipeline classifies package type well enough to apply any of these. Confirm scope with Person 1/3.",
  },
  {
    id: 'dimensions_not_relevant',
    applies_to_rule: 'PCR-R10',
    condition: 'product.dimensions_relevant == false',
    effect: 'result = N/A',
    reasoning:
      'Dimensions are only meaningful for specific commodity categories, not all packaged goods.',
  },
  {
    id: 'dimensions_status_unknown',
    applies_to_rule: 'PCR-R10',
    condition: 'product.dimensions_relevant == unknown',
    effect: 'result = REVIEW',
    reasoning:
      "If commodity category/relevance isn't confirmed, treat as unresolved rather than guessing N/A or FAIL.",
    status:
      "MVP INTEGRATION DECISION (not a legal ambiguity) - what's open here is engineering scope (does the pipeline classify commodity category), not legal uncertainty. Note separately: PCR-R10's underlying legal basis is now partially verified (a dimensions declaration requirement, conditional on relevance, is confirmed to exist within Rule 6(1) via secondary sources) but the exact sub-clause letter is still unconfirmed - see rules.json legal_reference. That letter-level detail remains a genuine open legal-verification item, distinct from this classification-scope decision.",
  },
  {
    id: 'placement_unavailable',
    applies_to_rule: 'PCR-R11',
    condition:
      'colocation cannot be reliably determined from available bbox/image_geometry evidence',
    effect: 'result = REVIEW (informational only - PCR-R11 is never scored regardless of outcome)',
    reasoning:
      "PCR-R11 is experimental. When the system can't reliably assess placement, it must say so (REVIEW) rather than defaulting to PASS or FAIL. This never affects the compliance score.",
  },
];

export const PACKSURE_PCR_RULES: StatutoryRule[] = [
  {
    rule_id: 'PCR-R01',
    field: 'manufacturer',
    requirement: 'Name and address of the manufacturer, or packer, or importer must be declared.',
    legal_reference:
      'Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(a) - manufacturer/packer/importer declaration. VERIFIED against bare-text excerpts (indiankanoon.org, cwnm.nic.in) - clause (a) is confirmed. Note: Explanation III to this clause states that for food articles, this sub-rule does not apply and food-specific law (originally Prevention of Food Adulteration Act 1954, now effectively FSSAI/Food Safety and Standards Act 2006) applies instead - see food_products_scope_note above.',
    applicability: {
      type: 'package_scope',
      condition: 'applies_to_all_retail_packages',
    },
    evidence_required: ['value', 'raw_text', 'confidence', 'bbox', 'context'],
    validation: {
      type: 'presence',
      required: true,
    },
    outputs: {
      pass: 'Manufacturer/packer/importer details detected.',
      fail: 'Manufacturer/packer/importer details not found.',
      review: 'Manufacturer/packer/importer text detected but confidence too low to confirm.',
      na: 'Not applicable.',
    },
  },
  {
    rule_id: 'PCR-R02',
    field: 'common_name',
    requirement: 'Common or generic name of the commodity must be declared.',
    legal_reference:
      "Rule 6(1)(b) - common/generic name declaration. Clause letter (b) confirmed via a government-hosted source (cdnbbsr.s3waas.gov.in, official Gazette PDF) which quotes '(b) The common or generic names of the commodity...' directly following clause (a). Confidence: reasonably verified, though a full line-by-line cross-check against the current consolidated e-book has not been done - recommend a final check before formal submission.",
    applicability: {
      type: 'package_scope',
      condition: 'applies_to_all_retail_packages',
    },
    evidence_required: ['value', 'raw_text', 'confidence', 'bbox', 'context'],
    validation: {
      type: 'presence',
      required: true,
    },
    outputs: {
      pass: 'Commodity name detected.',
      fail: 'Commodity name not detected.',
      review: 'Text present but could not reliably identify the commodity name (e.g. only brand/slogan visible).',
      na: 'Not applicable.',
    },
  },
  {
    rule_id: 'PCR-R03',
    field: 'net_quantity',
    requirement: 'Net quantity must be declared with a standard unit.',
    legal_reference:
      'Rule 6(1) - net quantity declaration is confirmed to exist within the Rule 6(1) list (commonly cited by secondary sources as clause (c), sitting between the common-name clause (b) and the manufacturing-date clause (d)). The exact sub-clause letter was NOT directly confirmed against bare statutory text in this pass - VERIFY AGAINST CURRENT PRIMARY SOURCE before citing the letter specifically.',
    applicability: {
      type: 'package_scope',
      condition: 'applies_to_all_retail_packages',
    },
    evidence_required: ['value', 'unit', 'unit_status', 'raw_text', 'confidence', 'bbox', 'context'],
    validation: {
      type: 'value_and_unit',
      required: true,
      unit_in: ['g', 'kg', 'ml', 'l', 'mg', 'cm', 'm'],
      note: "unit_status distinguishes a confirmed-absent unit (FAIL - the declaration is genuinely incomplete) from an ambiguous/unclear unit (REVIEW - extraction couldn't tell). Do not default an unclear case to FAIL.",
    },
    outputs: {
      pass: 'Net quantity and valid unit detected.',
      fail: 'Net quantity value found but no unit was declared on the package.',
      review: 'Net quantity detected but unit is ambiguous or extraction confidence is low.',
      na: 'Not applicable.',
    },
  },
  {
    rule_id: 'PCR-R04',
    field: 'mrp',
    requirement: 'Maximum Retail Price (inclusive of all taxes) must be declared.',
    legal_reference:
      "Rule 6(1)(e) - MRP/retail sale price declaration. Clause letter (e) confirmed via multiple secondary sources referencing amendments to 'Clause (e) of sub-rule (1)' and 'Clause 6(1)(e)' directly (a government-hosted amendment PDF and a legal-commentary site independently agree on this letter).",
    applicability: {
      type: 'package_scope',
      condition: 'applies_to_all_retail_packages',
    },
    evidence_required: ['value', 'currency', 'raw_text', 'confidence', 'bbox', 'context', 'context_confirmed'],
    validation: {
      type: 'presence_with_context',
      required: true,
      note: 'context_confirmed must be explicitly true if multiple price-like values are detected on the package. A price cannot be assumed to be MRP just because it was found.',
    },
    outputs: {
      pass: 'Valid MRP declaration detected.',
      fail: 'No MRP declaration found.',
      review: 'A price was detected but MRP context is uncertain (e.g. multiple prices present, none confirmed as MRP).',
      na: 'Not applicable.',
    },
  },
  {
    rule_id: 'PCR-R05',
    field: 'manufacturing_date',
    requirement: 'Month and year of manufacture (or import/packing, as applicable) must be declared.',
    legal_reference:
      "Rule 6(1)(d) - date of manufacture declaration. VERIFIED against bare-text excerpt (indiankanoon.org): '(d) The month and year in which the commodity is manufactured or pre-packed or imported shall be mentioned...' Confirmed provisos/carve-outs: food articles are excluded (Prevention of Food Adulteration Act 1954 applies instead - see food_products_scope_note); seeds certified under the Seeds Act, 1966 are excluded; and per the 2023 amendment (effective 1 Apr 2024), spare parts/accessories used for warranty servicing (not sold to end customers) are exempt, and electronic products/spare parts must show the date visibly and legibly anywhere on the retail package.",
    applicability: {
      type: 'package_scope',
      condition: 'applies_to_all_retail_packages',
    },
    evidence_required: ['value', 'date_role', 'raw_text', 'confidence', 'bbox', 'context'],
    validation: {
      type: 'presence_with_role',
      required: true,
      expected_role: 'manufacturing',
      note: "evidence.date_role must be explicitly 'manufacturing'. If date_role is null or 'unclear', this MUST return REVIEW, never PASS or an inferred classification.",
    },
    outputs: {
      pass: 'Manufacturing/packing date detected and confirmed as manufacturing date.',
      fail: 'No manufacturing/packing date found.',
      review: 'A date was detected but its role (manufacturing vs. best-before/use-by) could not be reliably established.',
      na: 'Not applicable.',
    },
  },
  {
    rule_id: 'PCR-R06',
    field: 'consumer_care',
    requirement: 'Name, address, telephone/email of the person or office to be contacted for consumer complaints must be declared.',
    legal_reference:
      "Consumer-care declaration is confirmed to exist in Rule 6, but this pass found evidence suggesting it may sit at Rule 6(2) - 'Every package shall bear the name, address, telephone number, e-mail address, if available, of the person who can be or the office which can be, contacted...' (wbconsumers.gov.in, government-hosted PDF) - rather than as a lettered sub-clause of 6(1) as earlier assumed. This is a CORRECTION from the previous version, which cited an unverified 6(1)(f). Still recommend a final check against the current consolidated text before formal submission, since this was read from an OCR'd/scanned government PDF excerpt rather than a clean bare-text database entry.",
    applicability: {
      type: 'package_scope',
      condition: 'applies_to_all_retail_packages',
    },
    evidence_required: ['value', 'raw_text', 'confidence', 'bbox', 'context'],
    validation: {
      type: 'presence',
      required: true,
    },
    outputs: {
      pass: 'Consumer care details detected.',
      fail: 'Consumer care details not found.',
      review: 'Partial consumer care information found (e.g. only a name, no contact method).',
      na: 'Not applicable.',
    },
  },
  {
    rule_id: 'PCR-R07',
    field: 'country_of_origin',
    requirement: 'Country of origin must be declared for imported products.',
    legal_reference:
      "Rule 6(1)(aa) - country of origin declaration for imported packages. VERIFIED against bare-text excerpt (rajnivesh.rajasthan.gov.in, government-hosted PDF): '(aa) The name of the country of origin or manufacture or assembly in case of imported products shall be...' Inserted via GSR 784(E) dated 24.10.2011 and GSR 832(E) dated 23.11.2011.",
    applicability: {
      type: 'conditional',
      condition: 'product.is_imported == true',
      exception_ref: 'see exceptions.json -> country_of_origin_not_imported, import_status_unknown',
    },
    evidence_required: ['value', 'raw_text', 'confidence', 'bbox', 'context'],
    validation: {
      type: 'presence',
      required: true,
    },
    outputs: {
      pass: 'Country of origin detected for imported product.',
      fail: 'Product flagged as imported but no country of origin declared.',
      review: 'Import status or country-of-origin evidence is ambiguous.',
      na: 'Product not identified as imported; requirement does not apply.',
    },
    exceptions: STATUTORY_EXCEPTIONS.filter((e) => e.applies_to_rule === 'PCR-R07'),
  },
  {
    rule_id: 'PCR-R08',
    field: 'expiry_date',
    requirement:
      "For commodities that may become unfit for consumption over time, the 'best before' or 'use by' date, month, and year must be declared.",
    legal_reference:
      "Rule 6(1)(da) - best before/use by declaration. VERIFIED against bare-text excerpt (rajnivesh.rajasthan.gov.in, government-hosted PDF): 'after clause (d), the following clause shall be inserted, namely:- (da) If a package contains a commodity which may become unfit for human consumption after a period of time, the best before or use by the date, month and year shall also be mentioned...' Inserted via GSR 629(E) dated 23.06.2017, effective 1-1-2018. Proviso confirmed: does not apply if another law already covers it.",
    applicability: {
      type: 'conditional',
      condition: 'product.may_expire == true',
      exception_ref: 'see exceptions.json -> expiry_date_not_perishable, expiry_status_unknown',
    },
    evidence_required: ['value', 'date_role', 'raw_text', 'confidence', 'bbox', 'context'],
    validation: {
      type: 'presence_with_role',
      required: true,
      expected_role: 'best_before_use_by',
      note: "evidence.date_role must be explicitly 'best_before_use_by'. If date_role is null or 'unclear', this MUST return REVIEW, never PASS or an inferred classification.",
    },
    outputs: {
      pass: 'Best before/use by date detected and confirmed.',
      fail: 'Product may expire but no best before/use by date found.',
      review: 'A date was detected but its role (manufacturing vs. best-before/use-by) could not be reliably established.',
      na: 'Product not identified as perishable/time-sensitive; requirement does not apply.',
    },
    exceptions: STATUTORY_EXCEPTIONS.filter((e) => e.applies_to_rule === 'PCR-R08'),
  },
  {
    rule_id: 'PCR-R09',
    field: 'unit_sale_price',
    requirement:
      'The unit sale price (price per gram/kg, per cm/m, per ml/l, or per number/unit as applicable) must be declared, unless an exemption applies.',
    legal_reference:
      'Rule 6(11) - unit sale price declaration. Sub-rule number (11) confirmed via multiple independent sources including a regulatory-compliance tracker (TeamLease RegTech) quoting the 2023 amendment text directly. Confirmed exemptions: (1) Combination Packages, Group Packages, and Multi-Piece Packages are exempt (2023 amendment, effective 1 Jan 2024, with defined terms); (2) for food articles, the Food Safety and Standards Act, 2006 applies instead (2023 amendment). The RSP=USP and wholesale-package exemptions cited in the earlier version of this file are still NOT independently confirmed with bare-text quotes - VERIFY AGAINST CURRENT PRIMARY SOURCE for those two specifically.',
    applicability: {
      type: 'conditional',
      condition: 'product.requires_unit_sale_price == true',
      exception_ref: 'see exceptions.json -> unit_sale_price_not_applicable, unit_sale_price_status_unknown',
      note: 'Applicability depends on package/commodity type (single retail package sold by weight/length/volume/number, not wholesale/combination/group/multi-piece, and RSP != USP). This is a compound condition - MVP should treat it as a single upstream boolean (product.requires_unit_sale_price) rather than re-deriving all sub-conditions in the rule engine, unless Person 1/3 want to encode the sub-conditions separately.',
    },
    evidence_required: ['value', 'unit', 'currency', 'raw_text', 'confidence', 'bbox', 'context'],
    validation: {
      type: 'presence',
      required: true,
    },
    outputs: {
      pass: 'Unit sale price detected.',
      fail: 'Unit sale price is applicable but not found.',
      review: 'Applicability or evidence for unit sale price is ambiguous.',
      na: 'Unit sale price does not apply to this package (confirmed exemptions: combination/group/multi-piece package, or food article under FSSAI carve-out. RSP-equals-USP and wholesale-package exemptions are plausible per earlier notes but NOT independently confirmed with bare-text quotes this pass - do not cite them as certain without checking the primary source. The earlier version of this rule also cited an e-commerce exemption for unit sale price specifically; that was NOT confirmed in this verification pass - the confirmed e-commerce carve-out found (Rule 6(10)) applies to the manufacturing-date declaration, not unit sale price - so this claim has been removed pending verification).',
    },
    exceptions: STATUTORY_EXCEPTIONS.filter((e) => e.applies_to_rule === 'PCR-R09'),
  },
  {
    rule_id: 'PCR-R10',
    field: 'dimensions',
    requirement:
      'Where the sizes of the commodity contained in the package are relevant, the dimensions of the commodity must be declared; if a package contains multiple pieces of differing dimensions, each piece\'s dimensions must be declared.',
    legal_reference:
      'UPDATED THIS PASS - previously marked \'not independently verified at all\'; now partially confirmed. A dimensions declaration requirement is confirmed to exist within the Rule 6(1) list via a legal-commentary source quoting language close to the requirement text above (\'Where the sizes of the commodity contained in the package are relevant, the dimensions... and if the dimensions of the different pieces are different, the dimensions of each such different piece shall be mentioned\'), consistent across two independent secondary sources. The exact sub-clause letter is still NOT confirmed against bare statutory text - VERIFY AGAINST CURRENT PRIMARY SOURCE for the letter specifically. IMPORTANT: this requirement is conditional/commodity-specific in the primary language itself (\'where relevant\') - it is NOT a universal requirement for every packaged commodity, and this rule must not be represented as such.',
    applicability: {
      type: 'conditional',
      condition: 'product.dimensions_relevant == true',
      exception_ref: 'see exceptions.json -> dimensions_not_relevant, dimensions_status_unknown',
    },
    evidence_required: ['value', 'unit', 'raw_text', 'confidence', 'bbox', 'context'],
    validation: {
      type: 'presence',
      required: true,
    },
    outputs: {
      pass: 'Dimensions detected for a commodity category where they are relevant.',
      fail: 'Dimensions are relevant for this commodity but not found.',
      review: 'Relevance of dimensions to this commodity category is unclear.',
      na: 'Dimensions are not relevant to this commodity category.',
    },
    exceptions: STATUTORY_EXCEPTIONS.filter((e) => e.applies_to_rule === 'PCR-R10'),
  },
  {
    rule_id: 'PCR-R11',
    field: 'principal_display_panel_colocation',
    requirement:
      'Certain declarations (notably MRP and net quantity) are expected to appear together on the Principal Display Panel, presented legibly, rather than scattered across the package.',
    legal_reference:
      'Rule 7 - Principal Display Panel provisions, and Rule 8 - manner/size of declaration. Real requirement, confirmed to exist, but exact operative text, current wording, and precise co-location/legibility thresholds are NOT independently verified. VERIFY AGAINST CURRENT PRIMARY SOURCE. Do not invent a universal rule such as \'MRP must always be at position X\' - no such specific claim is made or implemented here.',
    status: 'EXPERIMENTAL - NOT SCORED. Excluded from the compliance score denominator regardless of applicability or outcome.',
    applicability: {
      type: 'package_scope',
      condition: 'applies_to_all_retail_packages',
    },
    evidence_required: [
      'mrp.bbox',
      'net_quantity.bbox',
      'nearby_text',
      'context_confirmed',
      'image_geometry',
      'image_index',
    ],
    validation: {
      type: 'colocation_check',
      required: false,
      note: 'Verifying true panel co-location and legibility from bounding boxes/OCR confidence alone is unreliable without panel-boundary detection, which is out of scope for this MVP. Implement only if time permits. If the system cannot reliably determine the relevant panel/placement, return REVIEW, never FAIL - this rule must never contribute to a hard FAIL or to the compliance score.',
    },
    outputs: {
      pass: 'MRP and net quantity appear co-located and legible, consistent with Principal Display Panel expectations. Informational only.',
      fail: 'Not used - this rule cannot produce a scored FAIL; see validation.required and status.',
      review: 'Placement/legibility could not be reliably confirmed from available evidence. Informational only.',
      na: 'Not evaluated for this scan.',
    },
    exceptions: STATUTORY_EXCEPTIONS.filter((e) => e.applies_to_rule === 'PCR-R11'),
  },
];
