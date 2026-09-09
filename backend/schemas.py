"""
PackSure — backend/schemas.py
==============================
Data contracts / Pydantic models for the FastAPI backend.

This file defines the CONTRACT that connects:

    Frontend  --POST /scan-->  FastAPI  -->  OCR  -->  structured extraction
    --> compliance rule engine --> FastAPI response --> Frontend

It contains ONLY data models. No business logic, no OCR calls, no rule
evaluation, no score/status calculation. See "ARCHITECTURAL NOTES" at the
bottom of this file for what pipeline.py / compliance_service.py are
expected to do with these models.

-----------------------------------------------------------------------
WHERE EVERY DECISION IN THIS FILE CAME FROM (repo-derived, not invented)
-----------------------------------------------------------------------
- domain_rules/README.md, rules.json, exceptions.json, rule_engine.py,
  mock_tests.json  -> frozen field names (manufacturer, common_name,
  net_quantity, mrp, manufacturing_date, expiry_date, consumer_care,
  country_of_origin, unit_sale_price, dimensions,
  principal_display_panel_colocation), frozen rule IDs (PCR-R01..R11),
  frozen `date_role` field name and its 3 allowed values, rule-level
  status vocabulary (PASS / FAIL / REVIEW / N/A), and the
  is_imported / may_expire / requires_unit_sale_price / dimensions_relevant
  tri-state (True/False/None=unknown) applicability signals.
- handoff/HANDOFF_Person2.md -> the 5-field evidence shape
  (value, raw_text, confidence, bbox, context) that every extracted
  field carries, plus the extra fields net_quantity/unit_status,
  mrp/currency+context_confirmed, date fields/date_role,
  unit_sale_price/unit+currency, dimensions/unit.
- src/types/inspection.ts, src/lib/api.ts, src/mock/scanResult.ts,
  src/utils/bbox.ts, src/components/*.tsx -> the actual, currently-coded
  frontend contract: field names (inspection_id, product, overall_status,
  score, declarations, violations), the bbox coordinate convention
  ([x1, y1, x2, y2], confirmed in bbox.ts + EvidenceViewer.tsx),
  1-based image_index, and the frontend's own 3-value
  COMPLIANT/NON_COMPLIANT/WARNING status vocabulary (StatusBadge.tsx).
- "Final System Architecture" PDF -> the /scan multipart contract
  (field name "images", 1-3 files), the OCR output example shape
  (text/confidence/bbox/image_index), and the GET /health shape.

See "MISMATCHES FOUND" at the bottom for places where these sources
disagreed and which one this file follows, and why.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union

from pydantic import BaseModel, ConfigDict, Field

# ============================================================================
# 1. SHARED PRIMITIVES
# ============================================================================

# [x1, y1, x2, y2] in the ORIGINAL uploaded image's pixel coordinate space.
# Confirmed against src/types/inspection.ts (`BoundingBox = [number, number,
# number, number]; // [x1, y1, x2, y2]`) and src/utils/bbox.ts /
# EvidenceViewer.tsx, which both consume/label it explicitly as
# [x1, y1, x2, y2] (NOT [x, y, width, height]). Do not change this shape.
BoundingBox = Tuple[float, float, float, float]


class RuleStatus(str, Enum):
    """
    Per-rule evaluation outcome, exactly as produced by
    domain_rules/rule_engine.py (`evaluate_rule` / `run_all_rules`).

    This is intentionally a DIFFERENT enum from ComplianceStatus below.
    Per the rule engine's own design (rules.json, README.md): REVIEW must
    never be silently folded into PASS/FAIL, and N/A must never be
    confused with a genuine PASS. Mixing this 4-value rule-level
    vocabulary with the frontend's 3-value scan-level vocabulary would
    destroy exactly the distinction the rule engine was built to
    preserve, so the two vocabularies are kept separate on purpose.
    """

    PASS = "PASS"
    FAIL = "FAIL"
    REVIEW = "REVIEW"
    NOT_APPLICABLE = "N/A"


class ComplianceStatus(str, Enum):
    """
    Scan-level / violation-level status, exactly matching the frontend's
    own `ComplianceStatus` type (src/types/inspection.ts) and the values
    StatusBadge.tsx actually renders. Used for `ScanResponse.overall_status`
    and `ViolationItem.status`.

    NOTE: the older architecture PDF's example lists a 3rd value as
    "NEEDS_REVIEW", but the frontend TypeScript source (the real,
    compiled contract) uses "WARNING". This file follows the frontend
    source code as authoritative. See MISMATCHES FOUND (1).
    """

    COMPLIANT = "COMPLIANT"
    NON_COMPLIANT = "NON_COMPLIANT"
    WARNING = "WARNING"


class DateRole(str, Enum):
    """
    Frozen field name is `date_role` (NOT `date_type`) per
    domain_rules/README.md and rules.json `date_role_policy`.
    An unresolved date (missing or "unclear") must always evaluate to
    REVIEW downstream — never silently defaulted to a specific role.
    """

    MANUFACTURING = "manufacturing"
    BEST_BEFORE_USE_BY = "best_before_use_by"
    UNCLEAR = "unclear"


class UnitStatus(str, Enum):
    """
    Only meaningful for `net_quantity` when `unit` is null. Distinguishes
    "we looked and there is genuinely no unit" (FAIL) from "we couldn't
    tell" (REVIEW). Values per HANDOFF_Person2.md.
    """

    CONFIRMED_ABSENT = "confirmed_absent"
    AMBIGUOUS = "ambiguous"
    CONFIRMED_PRESENT = "confirmed_present"
    # Set by field_extractors.py when a unit was RECONSTRUCTED from a
    # suspected OCR misread (e.g. "400g" read back as "4009", trailing digit
    # reversed to "g") rather than actually read off the pack.
    # rule_engine.py checks for this exact value to force net_quantity to
    # REVIEW instead of a silent PASS on a guessed character. Without this
    # enum member, that value fails Pydantic validation and
    # StructuredDeclarations.model_validate() raises, turning the whole
    # /scan request into a 500 instead of a REVIEW on one field.
    OCR_CORRECTED = "ocr_corrected"


# ============================================================================
# 2. OCR OUTPUT SCHEMAS (raw OCR -> normalized backend representation)
# ============================================================================


class OCRTextBlock(BaseModel):
    """
    One normalized unit of OCR-detected text.

    ASSUMPTION (flagged per instructions, see MISMATCHES/ASSUMPTIONS below):
    HANDOFF_Person2.md does not specify OCR granularity (word vs line vs
    block), and the architecture PDF's OCR example is a single flat
    {text, confidence, bbox, image_index} object. Rather than inventing a
    word/line/block hierarchy the OCR system was never confirmed to
    produce, this model is granularity-agnostic: it represents "one
    detected span of text with one bounding box", whatever granularity
    the OCR module actually emits. If Person 2 confirms word-level output
    is needed, extend this model rather than replacing it, since
    extraction.py will already depend on this shape.
    """

    model_config = ConfigDict(extra="forbid")

    text: str = Field(..., description="Raw OCR-detected text for this span.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="OCR confidence, 0.0-1.0.")
    bbox: Optional[BoundingBox] = Field(
        None, description="[x1, y1, x2, y2] in the source image's pixel space."
    )
    image_index: int = Field(
        ..., ge=1, le=3, description="1-based index of the uploaded image this text was found on."
    )
    page: Optional[int] = Field(
        None,
        description=(
            "Reserved for future multi-page document support. Not used by the "
            "current PackSure pipeline, which identifies source images via "
            "image_index only (1-3 uploaded photos, not paginated documents)."
        ),
    )
    raw_ocr_data: Optional[Dict[str, Any]] = Field(
        None,
        description="Opaque passthrough for OCR-engine-specific metadata, if the adapter needs to keep it.",
    )


class OCRResult(BaseModel):
    """Normalized OCR output for one /scan request, across all uploaded images."""

    model_config = ConfigDict(extra="forbid")

    blocks: List[OCRTextBlock] = Field(default_factory=list)


# ============================================================================
# 3. FIELD-LEVEL EVIDENCE (reusable across every structured declaration)
# ============================================================================


class DeclarationField(BaseModel):
    """
    Reusable evidence container for a single extracted declaration field.
    This is the schema-level realization of HANDOFF_Person2.md's
    "every field needs these 5" rule (value, raw_text, confidence, bbox,
    context), extended with the extra per-field keys the rule engine and
    handoff doc require for specific fields (unit, unit_status, currency,
    context_confirmed, date_role).

    Deliberately ONE flexible model rather than one subclass per field:
    domain_rules/rule_engine.py consumes evidence as
    `evidence.get(field, {})` and then `.get("unit")`, `.get("date_role")`,
    etc. — i.e. it already treats every field's evidence as "the same
    shape, with some keys populated and others not". Mirroring that here
    keeps `StructuredDeclarations.model_dump()` a direct drop-in for
    rule_engine.run_all_rules()'s expected `evidence` dict.

    ALL fields are optional: extraction may legitimately produce nothing
    for a given declaration (e.g. consumer_care simply isn't on the
    package), and the rule engine is explicitly designed to treat missing
    evidence as FAIL (not as an error).
    """

    model_config = ConfigDict(extra="ignore")

    value: Optional[str] = Field(
        None,
        description="The extracted declaration value as raw text (e.g. '250', 'Rs.45.00', '06/2026'). "
        "Kept as text, not parsed into numeric types — consistent with mock_tests.json and "
        "rule_engine.py, which never parses `value` numerically.",
    )
    raw_text: Optional[str] = Field(None, description="Full raw OCR text this value was derived from.")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Extraction confidence, 0.0-1.0.")
    bbox: Optional[BoundingBox] = Field(None, description="[x1, y1, x2, y2] evidence location on the source image.")
    context: Optional[str] = Field(
        None, description="Short string describing nearby label text, e.g. \"near text 'MFG'\"."
    )
    image_index: Optional[int] = Field(
        None,
        ge=1,
        le=3,
        description=(
            "1-based source image index. NOT currently required at the type level: "
            "HANDOFF_Person2.md's own 'every field needs these 5' evidence-shape list "
            "(value, raw_text, confidence, bbox, context) does not include image_index, "
            "so extraction.py is not yet guaranteed to populate it, even though the "
            "frontend EvidenceViewer needs it to route evidence to the right image. "
            "INTEGRATION DEPENDENCY: once Person 2 confirms every field-level evidence "
            "object carries image_index, this should become a required "
            "`int = Field(..., ge=1, le=3)` — do not tighten it before that's confirmed, "
            "and extraction.py must not invent/guess an image_index in the meantime."
        ),
    )
    page: Optional[int] = Field(None, description="Reserved for future multi-page support; unused today.")

    # --- field-specific extras (only populated for the relevant field) ---
    unit: Optional[str] = Field(
        None, description="Used by: net_quantity, unit_sale_price, dimensions."
    )
    unit_status: Optional[UnitStatus] = Field(
        None, description="Used by: net_quantity only, when `unit` is null."
    )
    currency: Optional[str] = Field(None, description="Used by: mrp, unit_sale_price.")
    context_confirmed: Optional[bool] = Field(
        None,
        description="Used by: mrp (true only for the price confirmed as MRP when multiple prices are detected).",
    )
    date_role: Optional[DateRole] = Field(
        None, description="Used by: manufacturing_date, expiry_date. See DateRole docstring."
    )
    origin_conflict: Optional[bool] = Field(
        None,
        description=(
            "Used by: country_of_origin only. Set True by field_extractors.py when a pack "
            "declares an origin AND names an importer that disagrees with it (e.g. 'Made in "
            "India' next to 'Imported by ABC Pvt Ltd'). rule_engine.py checks this on every "
            "validation type to force REVIEW even when the field otherwise validates cleanly. "
            "Without this declared field, extra=\"ignore\" silently drops it during "
            "StructuredDeclarations.model_validate(), and the rule_engine.py check can never "
            "fire in production."
        ),
    )
    inferred: Optional[bool] = Field(
        None,
        description=(
            "Used by: common_name and the two date fields. Set True by field_extractors.py "
            "when the date roles were assigned by CHRONOLOGY (of two unlabelled dates, "
            "the earlier is the manufacturing date and the later the expiry) rather than "
            "read off an MFG/EXP label - or, for common_name, when the value "
            "came from visual prominence (largest text on the panel) rather than from an "
            "explicit label or a commodity descriptor - i.e. the pack never declares a "
            "common name in a field we can point at, and this is the extractor's best "
            "reading of the product name off the front panel. rule_engine.py must route "
            "this to REVIEW rather than PASS: a prominent brand or marketing line can win "
            "this tier, and a guessed common name reported as a clean PASS is exactly the "
            "confident-wrong result the evidence contract exists to prevent. Declared here "
            "because extra=\"ignore\" would otherwise silently drop it during "
            "StructuredDeclarations.model_validate(), leaving the guess indistinguishable "
            "from a labelled declaration."
        ),
    )


class PlacementEvidence(BaseModel):
    """
    Evidence for PCR-R11 (`principal_display_panel_colocation`) only.
    Deliberately separate from DeclarationField: R11's
    `evidence_required` in rules.json is a different shape
    (mrp.bbox, net_quantity.bbox, nearby_text, context_confirmed,
    image_geometry, image_index) referencing OTHER fields' bounding
    boxes rather than carrying its own value/raw_text.

    `image_geometry`'s structure is not specified anywhere in the repo,
    so it is left as an open, unvalidated dict (ASSUMPTION — flagged
    below). R11 is experimental, never scored, and must never resolve to
    FAIL (rules.json: always REVIEW or N/A) — that logic lives in
    rule_engine.py, not here.

    INTEGRATION PRIORITY: R01-R10 are the core, scored rules and should
    be wired up first. This model exists so R11 evidence has somewhere
    to go, but no additional fields/logic should be added here beyond
    what rules.json's `evidence_required` for PCR-R11 already lists.
    """

    model_config = ConfigDict(extra="ignore")

    nearby_text: Optional[str] = None
    context_confirmed: Optional[bool] = None
    image_geometry: Optional[Dict[str, Any]] = Field(
        None, description="ASSUMPTION: shape not specified by any handoff doc; left as an opaque dict."
    )
    image_index: Optional[int] = Field(None, ge=1, le=3)


# ============================================================================
# 4. STRUCTURED EXTRACTION SCHEMA (OCR -> normalized declarations)
# ============================================================================


class StructuredDeclarations(BaseModel):
    """
    The normalized, per-field extraction output — one DeclarationField per
    frozen rule-engine field name (domain_rules/README.md field list).

    `.model_dump()` on an instance of this model produces exactly the
    `evidence` dict shape rule_engine.run_all_rules(evidence, product_context)
    expects: {"manufacturer": {...}, "common_name": {...}, ...,
    "principal_display_panel_colocation": {...}}.
    """

    model_config = ConfigDict(extra="ignore")

    manufacturer: Optional[DeclarationField] = None
    common_name: Optional[DeclarationField] = None
    net_quantity: Optional[DeclarationField] = None
    mrp: Optional[DeclarationField] = None
    manufacturing_date: Optional[DeclarationField] = None
    expiry_date: Optional[DeclarationField] = None
    consumer_care: Optional[DeclarationField] = None
    country_of_origin: Optional[DeclarationField] = None
    unit_sale_price: Optional[DeclarationField] = None
    dimensions: Optional[DeclarationField] = None
    principal_display_panel_colocation: Optional[PlacementEvidence] = None


class ProductApplicabilityContext(BaseModel):
    """
    The `product_context` dict rule_engine.py's conditional rules
    (PCR-R07/R08/R09/R10) check via `product_context.get(context_key)`.

    Every field is Optional[bool] and defaults to None (unknown) —
    per the task instructions and exceptions.json, None must NEVER be
    silently treated as False. None -> REVIEW; False -> N/A; True ->
    rule is evaluated. Whether the MVP pipeline actually classifies any
    of these (vs. always sending None) is an open integration question
    the domain_rules README explicitly leaves to Person 1/3 — this
    schema supports either answer without change.

    NOTE: this is a DIFFERENT "product" concept from `ProductInfo` below
    — see MISMATCHES FOUND (3).
    """

    model_config = ConfigDict(extra="ignore")

    is_imported: Optional[bool] = None
    may_expire: Optional[bool] = None
    requires_unit_sale_price: Optional[bool] = None
    dimensions_relevant: Optional[bool] = None


class RuleEngineInput(BaseModel):
    """
    Typed representation of Architecture Contract 3 (Backend -> Rule
    Engine). compliance_service.py is expected to call:

        rule_engine.run_all_rules(
            evidence=rule_engine_input.evidence.model_dump(),
            product_context=rule_engine_input.product_context.model_dump(),
        )

    This model exists for validation/typing in pipeline.py; it is not
    consumed directly by rule_engine.py, which expects plain dicts.
    """

    model_config = ConfigDict(extra="ignore")

    evidence: StructuredDeclarations
    product_context: ProductApplicabilityContext = Field(default_factory=ProductApplicabilityContext)


# ============================================================================
# 5. RULE RESULT SCHEMA (Rule Engine -> Backend, internal)
# ============================================================================


class RuleResult(BaseModel):
    """
    One rule's evaluation result, mirroring the dict shape returned by
    domain_rules/rule_engine.py `evaluate_rule()` exactly:
    {"field", "rule_id", "status", "reason", "evidence", "scored"}.

    This is an INTERNAL schema (Rule Engine -> Backend), distinct from
    the public-facing ViolationItem below. All 11 rules produce a
    RuleResult (including PASS and N/A); only a subset become
    ViolationItems in the final response. See RuleEvaluationSummary.
    """

    model_config = ConfigDict(extra="ignore")

    field: str = Field(..., description="Declaration field this rule evaluates, e.g. 'net_quantity'.")
    rule_id: str = Field(..., description="Frozen rule ID, e.g. 'PCR-R03'. See domain_rules/rules.json.")
    status: RuleStatus
    reason: str = Field(..., description="Human-readable reason, sourced from rules.json `outputs`.")
    evidence: Optional[Union[DeclarationField, PlacementEvidence]] = Field(
        None, description="The evidence this result was based on (None if evidence was absent)."
    )
    scored: bool = Field(
        ..., description="Whether this result counts toward the compliance score. PCR-R11 is always False."
    )


class RuleEvaluationSummary(BaseModel):
    """
    Full audit trail of all 11 rule results for one scan (internal,
    Rule Engine -> Backend handoff). Not part of the public /scan
    response — the frontend only sees the derived `violations` subset
    (see ScanResponse). Kept separate so compliance_service.py has a
    typed place to pass the complete evaluation to main.py before score/
    overall_status/violations are derived from it.
    """

    model_config = ConfigDict(extra="ignore")

    results: List[RuleResult] = Field(default_factory=list)


# ============================================================================
# 6. PUBLIC-FACING SCHEMAS (Backend -> Frontend, must match src/types/inspection.ts)
# ============================================================================


class ProductInfo(BaseModel):
    """
    Descriptive product info shown in the results header
    (ResultsDashboard.tsx). Matches frontend `ProductInfo` exactly.
    NOT the same as ProductApplicabilityContext above — see
    MISMATCHES FOUND (3).
    """

    model_config = ConfigDict(extra="ignore")

    type: str = Field(..., description="Product category, e.g. 'packaged_food'.")
    name: str = Field(..., description="Display name, e.g. 'Choco Biscuits'.")


class DeclarationResponseItem(DeclarationField):
    """
    One entry in the /scan response's `declarations` list.

    Extends DeclarationField with the `field` name, since the response
    is a flat list (src/types/inspection.ts `DeclarationItem[]`), not a
    dict keyed by field name the way StructuredDeclarations is.

    Per confirmed product decision: carries the FULL evidence bundle
    (raw_text, context, unit, unit_status, currency, context_confirmed,
    date_role — not just the minimal field/value/image_index/bbox/
    confidence the frontend currently types) so the EvidenceViewer and
    any future rule-engine-facing UI can use it without a backend
    contract change. Extra keys are harmless to the current frontend,
    which does not runtime-validate against the TS interface.
    """

    field: str = Field(..., description="Canonical declaration field name, e.g. 'mrp'.")


class ViolationEvidence(BaseModel):
    """
    Matches frontend `ViolationEvidence` exactly (src/types/inspection.ts).
    Deliberately a smaller shape than DeclarationField — the frontend's
    ViolationCard/EvidenceViewer only ever read value/image_index/bbox
    for violations (see ViolationCard.tsx, EvidenceViewer.tsx).
    """

    model_config = ConfigDict(extra="ignore")

    value: Optional[str] = Field(
        None,
        description="Kept Optional for backend safety even though the frontend TS type marks it required; "
        "rule_engine.py guarantees `value` is present whenever `evidence` itself is non-null.",
    )
    image_index: Optional[int] = Field(None, ge=1, le=3)
    bbox: Optional[BoundingBox] = None


class ViolationItem(BaseModel):
    """
    Matches frontend `ViolationItem` exactly (src/types/inspection.ts).

    `status` uses ComplianceStatus (COMPLIANT/NON_COMPLIANT/WARNING), NOT
    RuleStatus — per task instructions section 9's own carve-out ("...
    unless the existing frontend explicitly requires them"), which
    applies here since ViolationItem.status is explicitly typed
    ComplianceStatus in inspection.ts. The RuleStatus -> ComplianceStatus
    mapping (FAIL -> NON_COMPLIANT, REVIEW -> WARNING) is business logic
    for pipeline.py / compliance_service.py to perform when constructing
    this object from a RuleResult — NOT done in this file.

    Only rules whose RuleResult.status is FAIL or REVIEW should become a
    ViolationItem; PASS and N/A results are not violations. That
    filtering is also pipeline.py's responsibility, not this file's.
    """

    model_config = ConfigDict(extra="ignore")

    field: str = Field(..., description="Declaration field this violation concerns, e.g. 'net_quantity'.")
    status: ComplianceStatus
    rule_id: str = Field(..., description="Frozen rule ID, e.g. 'PCR-R09'.")
    reason: str
    evidence: Optional[ViolationEvidence] = None


class ScanResponse(BaseModel):
    """
    The main response returned by POST /scan.

    Field names and required fields verified directly against
    src/lib/api.ts's `scanPackage()`, which checks:
        data.inspection_id, typeof data.score === 'number', data.overall_status
    are present, and against src/types/inspection.ts `ScanResult` for the
    full shape.
    """

    model_config = ConfigDict(extra="ignore")

    inspection_id: str = Field(..., description="Stable scan identifier, e.g. 'insp_00123'. Not a UUID format.")
    product: ProductInfo
    overall_status: ComplianceStatus
    score: float = Field(..., ge=0, le=100, description="0-100. Calculated by compliance_service.py, not here.")
    declarations: List[DeclarationResponseItem] = Field(default_factory=list)
    violations: List[ViolationItem] = Field(default_factory=list)


# ============================================================================
# 7. ERROR RESPONSE SCHEMA
# ============================================================================


class ErrorResponse(BaseModel):
    """
    Standard API error shape. src/lib/api.ts reads `errorJson?.message`
    first, then falls back to `errorJson?.error` — both are included so
    either lookup succeeds. Covers 400 (bad upload), 413 (too
    many/large files), 422 (validation), 500 (pipeline/OCR/rule-engine
    failure), 503 (backend/OCR unavailable). No error-handling logic
    lives here — this only defines the shape.
    """

    model_config = ConfigDict(extra="ignore")

    error: str = Field(..., description="Short machine-oriented error code/category.")
    message: str = Field(..., description="Human-readable message; src/lib/api.ts prefers this field.")
    status_code: int = Field(..., description="HTTP status code, mirrored in the body for convenience.")
    details: Optional[Dict[str, Any]] = Field(None, description="Optional structured detail, e.g. validation errors.")


# ============================================================================
# 8. HEALTH CHECK SCHEMA
# ============================================================================


class BackendHealthResponse(BaseModel):
    """
    GET /health response. Frontend's `BackendHealthResponse` type only
    requires `status`; `service`/`version` are additive and harmless.
    """

    model_config = ConfigDict(extra="ignore")

    status: str = Field("ok", description="'ok' when the backend is healthy.")
    service: Optional[str] = Field(None, description="Optional service name, e.g. 'packsure-backend'.")
    version: Optional[str] = Field(None, description="Optional backend version string.")


# ============================================================================
# ARCHITECTURAL NOTES
# ============================================================================
#
# 1. IMAGE UPLOAD: no Pydantic model is defined for the multipart /scan
#    request body on purpose. The frontend sends 1-3 files under the
#    form field name "images" (confirmed in src/lib/api.ts:
#    `formData.append('images', image)`). FastAPI's own
#    `images: list[UploadFile] = File(...)` mechanism is the correct
#    tool for this, not a Pydantic model — forcing UploadFile into a
#    JSON request model would not work with FastAPI's multipart handling.
#    This will be wired up in main.py, not here.
#
# 2. NOTHING IN THIS FILE calls OCR, calls the rule engine, computes a
#    score, or computes overall_status. Those all belong in
#    ocr_service.py, extraction.py, compliance_service.py, and
#    pipeline.py respectively (not yet created).
#
# ============================================================================
# ASSUMPTIONS MADE (explicitly flagged per instructions)
# ============================================================================
#
# A. OCR granularity (OCRTextBlock) is modeled as one generic detected
#    text span, not word/line/block-specific, because no handoff doc
#    specifies the actual OCR granularity. See OCRTextBlock docstring.
# B. `image_index` on DeclarationField is kept Optional[int], NOT made
#    required, because HANDOFF_Person2.md's frozen "every field needs
#    these 5" list (value, raw_text, confidence, bbox, context) does not
#    include it — even though the architecture doc's example and the
#    frontend's non-optional image_index on DeclarationItem/
#    ViolationEvidence both want it. This is a genuine open integration
#    dependency, not resolved by this file: see the field's own
#    docstring for the exact condition under which it should become
#    required.
# C. `PlacementEvidence.image_geometry` is left as an unvalidated dict —
#    its shape is not specified anywhere in the repo.
# D. Declaration `value` is always a string (never parsed into int/float),
#    matching mock_tests.json and rule_engine.py's own treatment of value.
# E. No timestamp fields (created_at, etc.) are included anywhere — grep
#    of the frontend confirms no timestamp is read or displayed anywhere
#    in the current UI, and the task instructions say not to invent
#    fields the pipeline doesn't need.
# F. `inspection_id` is a plain `str` (e.g. "insp_00123"), not a
#    `uuid.UUID` — the mock data's ID format is a custom prefixed string,
#    not a UUID, so a UUID type would reject the project's own example ID.
#
# ============================================================================
# MISMATCHES FOUND (frontend vs. OCR handoff vs. extraction vs. rule engine)
# ============================================================================
#
# 1. STATUS VOCABULARY: domain_rules uses PASS/FAIL/REVIEW/N/A per rule.
#    The frontend's ComplianceStatus type uses COMPLIANT/NON_COMPLIANT/
#    WARNING. These are NOT the same enum and are kept separate in this
#    file (RuleStatus vs. ComplianceStatus) rather than merged into one,
#    because merging would either lose the rule engine's N/A-vs-FAIL
#    distinction or break the frontend's StatusBadge rendering. The
#    mapping is pipeline.py's job.
# 2. OVERALL STATUS NAMING: the architecture PDF's example list says
#    COMPLIANT / NON_COMPLIANT / NEEDS_REVIEW, but the actual frontend
#    TypeScript source says COMPLIANT / NON_COMPLIANT / WARNING. This
#    file follows the frontend source code (the real, enforced contract)
#    over the planning document.
# 3. TWO DIFFERENT "product" CONCEPTS SHARE THE WORD "product": the
#    architecture PDF's example response has `product: {type, name}`
#    (display info) — that's ProductInfo here. Separately, rule_engine.py
#    needs `product_context` booleans (is_imported, may_expire,
#    requires_unit_sale_price, dimensions_relevant) — that's
#    ProductApplicabilityContext here. They are unrelated data and are
#    modeled as two distinct classes to avoid conflating "what the
#    product is" with "what compliance rules apply to it".
# 4. STALE MOCK DATA: src/mock/scanResult.ts contains rule IDs and
#    declaration field names that are not part of the frozen
#    domain_rules/rules.json contract (verified directly against the
#    repo: e.g. the mock's rule_id "PCR-R14" does not exist among
#    rules.json's frozen PCR-R01..R11, and the mock's field name
#    "manufacturer_name" does not match the frozen field "manufacturer").
#    domain_rules/rules.json, rule_engine.py, and README.md are treated
#    as authoritative here, per README.md's own "rule_id/field names are
#    now frozen from my side" statement — NOT the mock. The mock file
#    should be regenerated once main.py exists; that is out of scope for
#    this task.
# 5. EVIDENCE FIELD LIST GAP: HANDOFF_Person2.md's "every field needs
#    these 5" (value, raw_text, confidence, bbox, context) omits
#    image_index, while the architecture doc's OCR example and every
#    frontend evidence-consuming component require it. Resolved per
#    Assumption B above.
