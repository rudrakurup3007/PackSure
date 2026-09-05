"""
PackSure — backend/services/compliance_service.py
====================================================
Adapter between the typed backend models (backend/schemas.py) and the
authoritative compliance engine (domain_rules/rule_engine.py).

This module contains NO compliance logic of its own. Rule evaluation,
applicability, and scoring all live in domain_rules/rule_engine.py
(`run_all_rules`, `calculate_score`) and are only wrapped/typed here.

Flow:

    StructuredDeclarations + ProductApplicabilityContext
            |  .model_dump()
            v
    domain_rules.rule_engine.run_all_rules(evidence, product_context)
            |  raw dicts: {field, rule_id, status, reason, evidence, scored}
            v
    RuleResult objects (typed, all 11 rules, PASS/FAIL/REVIEW/N/A included)
            |  filter to FAIL/REVIEW, map status
            v
    ViolationItem objects  +  calculate_score(...)  +  overall ComplianceStatus
"""

from __future__ import annotations

from typing import NamedTuple, Optional

from domain_rules.rule_engine import calculate_score, run_all_rules

from backend.schemas import (
    ComplianceStatus,
    DeclarationField,
    PlacementEvidence,
    ProductApplicabilityContext,
    RuleResult,
    RuleStatus,
    StructuredDeclarations,
    ViolationEvidence,
    ViolationItem,
)

# The one field whose evidence shape is PlacementEvidence, not
# DeclarationField (see rules.json PCR-R11 / schemas.py PlacementEvidence).
_PLACEMENT_FIELD = "principal_display_panel_colocation"


class ComplianceEvaluation(NamedTuple):
    """Everything a caller (e.g. main.py) needs to build the /scan response."""

    results: list[RuleResult]
    violations: list[ViolationItem]
    score: float
    overall_status: ComplianceStatus


def _parse_evidence(field: str, raw_evidence: Optional[dict]):
    """Parse one rule result's raw evidence dict into its typed model."""
    if not raw_evidence:
        return None
    if field == _PLACEMENT_FIELD:
        return PlacementEvidence(**raw_evidence)
    return DeclarationField(**raw_evidence)


def _to_rule_result(raw: dict) -> RuleResult:
    """Convert one raw dict from rule_engine.evaluate_rule() into a RuleResult."""
    return RuleResult(
        field=raw["field"],
        rule_id=raw["rule_id"],
        status=RuleStatus(raw["status"]),
        reason=raw["reason"],
        evidence=_parse_evidence(raw["field"], raw.get("evidence")),
        scored=raw["scored"],
    )


def _to_violation(result: RuleResult) -> Optional[ViolationItem]:
    """
    Map a RuleResult to a public ViolationItem.

    FAIL   -> NON_COMPLIANT violation
    REVIEW -> WARNING violation
    PASS   -> no violation (None)
    N/A    -> no violation (None)
    """
    if result.status == RuleStatus.FAIL:
        compliance_status = ComplianceStatus.NON_COMPLIANT
    elif result.status == RuleStatus.REVIEW:
        compliance_status = ComplianceStatus.WARNING
    else:
        return None

    evidence = None
    if result.evidence is not None:
        evidence = ViolationEvidence(
            value=getattr(result.evidence, "value", None),
            image_index=getattr(result.evidence, "image_index", None),
            bbox=getattr(result.evidence, "bbox", None),
        )

    return ViolationItem(
        field=result.field,
        status=compliance_status,
        rule_id=result.rule_id,
        reason=result.reason,
        evidence=evidence,
    )


def _overall_status(results: list[RuleResult]) -> ComplianceStatus:
    """
    NON_COMPLIANT if any SCORED result is FAIL.
    Else WARNING if any SCORED result is REVIEW.
    Else COMPLIANT.

    Only scored results count (PCR-R11 has scored=False and never
    affects this, matching its "informational only" status in
    rules.json). N/A results never affect this either.
    """
    scored = [r for r in results if r.scored]
    if any(r.status == RuleStatus.FAIL for r in scored):
        return ComplianceStatus.NON_COMPLIANT
    if any(r.status == RuleStatus.REVIEW for r in scored):
        return ComplianceStatus.WARNING
    return ComplianceStatus.COMPLIANT


def evaluate_compliance(
    declarations: StructuredDeclarations,
    product_context: ProductApplicabilityContext,
) -> ComplianceEvaluation:
    """
    Run the authoritative domain_rules rule engine against typed
    extraction output and return typed results, violations, score, and
    overall status.

    Delegates all rule evaluation to
    domain_rules.rule_engine.run_all_rules() and all scoring to
    domain_rules.rule_engine.calculate_score() — no rule logic or
    scoring formula is reimplemented here.
    """
    raw_results = run_all_rules(
        evidence=declarations.model_dump(),
        product_context=product_context.model_dump(),
    )

    results = [_to_rule_result(raw) for raw in raw_results]
    violations = [v for v in (_to_violation(r) for r in results) if v is not None]
    score = calculate_score(raw_results)
    overall_status = _overall_status(results)

    return ComplianceEvaluation(
        results=results,
        violations=violations,
        score=score,
        overall_status=overall_status,
    )
