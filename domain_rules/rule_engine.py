"""
PackSure — Rule Engine Reference Implementation (v1.0)
Author: Riya (Person 5 - Domain/Rules)

Reference implementation showing how rules.json + exceptions.json should be
evaluated. Person 3: adapt into the actual FastAPI compliance engine - this
file's job is to make the LOGIC unambiguous, not to be production code as-is.

Run this file directly to see it evaluate a sample scan.
Run test_against_mock_tests() to check this logic against mock_tests.json.
"""

import json
from pathlib import Path

CONFIDENCE_REVIEW_THRESHOLD = 0.6

# Conditional rules and the product_context key each one depends on.
CONDITIONAL_RULES = {
    "PCR-R07": {"context_key": "is_imported", "not_applicable_status": "N/A"},
    "PCR-R08": {"context_key": "may_expire", "not_applicable_status": "N/A"},
    "PCR-R09": {"context_key": "requires_unit_sale_price", "not_applicable_status": "N/A"},
    "PCR-R10": {"context_key": "dimensions_relevant", "not_applicable_status": "N/A"},
}


def load_json(filename):
    with open(Path(__file__).parent / filename) as f:
        return json.load(f)


def check_applicability(rule, product_context):
    """
    Returns 'N/A', 'REVIEW', or None (rule is applicable, proceed to evidence check).
    Only rules in CONDITIONAL_RULES have conditional applicability.
    """
    rule_id = rule["rule_id"]
    if rule_id not in CONDITIONAL_RULES:
        return None  # package_scope rules always apply

    context_key = CONDITIONAL_RULES[rule_id]["context_key"]
    value = product_context.get(context_key)  # True / False / None(unknown)

    if value is False:
        return "N/A"
    if value is None:
        return "REVIEW"
    return None  # value is True -> applicable, proceed


def evaluate_rule(rule, evidence, product_context):
    """
    Core algorithm:
    1. Applicability check (conditional rules only)
    2. Experimental-rule short-circuit (PCR-R11)
    3. Evidence presence check
    4. Confidence check
    5. Validation (rule-type specific, including date_role and unit_status handling)
    """
    field = rule["field"]
    field_evidence = evidence.get(field, {})

    # Experimental / not-scored rules: evaluate for information only, never
    # let them produce a hard FAIL or count toward score.
    is_experimental = rule.get("status", "").startswith("EXPERIMENTAL") or not rule["validation"].get("required", True)

    # Step 1: applicability
    applicability_result = check_applicability(rule, product_context)
    if applicability_result == "N/A":
        return {
            "field": field, "rule_id": rule["rule_id"], "status": "N/A",
            "reason": rule["outputs"]["na"], "evidence": None, "scored": not is_experimental,
        }
    if applicability_result == "REVIEW":
        return {
            "field": field, "rule_id": rule["rule_id"], "status": "REVIEW",
            "reason": rule["outputs"]["review"], "evidence": field_evidence or None,
            "scored": not is_experimental,
        }

    if is_experimental:
        # PCR-R11 today: no reliable colocation check implemented in this
        # reference - always REVIEW to signal "not determined", never FAIL,
        # and never scored.
        return {
            "field": field, "rule_id": rule["rule_id"], "status": "REVIEW",
            "reason": "Placement/legibility could not be reliably confirmed from available evidence.",
            "evidence": field_evidence or None, "scored": False,
        }

    # Step 3: evidence presence
    value = field_evidence.get("value")
    if value is None:
        return {
            "field": field, "rule_id": rule["rule_id"], "status": "FAIL",
            "reason": rule["outputs"]["fail"], "evidence": None, "scored": True,
        }

    # Step 4: confidence check
    confidence = field_evidence.get("confidence")
    if confidence is not None and confidence < CONFIDENCE_REVIEW_THRESHOLD:
        return {
            "field": field, "rule_id": rule["rule_id"], "status": "REVIEW",
            "reason": rule["outputs"]["review"], "evidence": field_evidence, "scored": True,
        }

    # Step 5: validation
    validation = rule["validation"]
    valid = True

    if validation["type"] == "value_and_unit":
        unit = field_evidence.get("unit")
        unit_status = field_evidence.get("unit_status")
        if unit is None:
            if unit_status == "confirmed_absent":
                return {
                    "field": field, "rule_id": rule["rule_id"], "status": "FAIL",
                    "reason": rule["outputs"]["fail"], "evidence": field_evidence, "scored": True,
                }
            return {
                "field": field, "rule_id": rule["rule_id"], "status": "REVIEW",
                "reason": rule["outputs"]["review"], "evidence": field_evidence, "scored": True,
            }
        valid = unit in validation["unit_in"]

    elif validation["type"] == "presence_with_context":
        multiple_candidates = field_evidence.get("context_confirmed") is not None
        context_confirmed = field_evidence.get("context_confirmed", True)
        if multiple_candidates and not context_confirmed:
            return {
                "field": field, "rule_id": rule["rule_id"], "status": "REVIEW",
                "reason": rule["outputs"]["review"], "evidence": field_evidence, "scored": True,
            }
        valid = True

    elif validation["type"] == "presence_with_role":
        date_role = field_evidence.get("date_role")
        if date_role is None or date_role == "unclear":
            # CRITICAL: never infer manufacturing vs best_before_use_by here.
            return {
                "field": field, "rule_id": rule["rule_id"], "status": "REVIEW",
                "reason": rule["outputs"]["review"], "evidence": field_evidence, "scored": True,
            }
        valid = date_role == validation["expected_role"]

    # "presence" type: value already confirmed present above -> valid stays True

    status = "PASS" if valid else "FAIL"
    return {
        "field": field, "rule_id": rule["rule_id"], "status": status,
        "reason": rule["outputs"]["pass"] if valid else rule["outputs"]["fail"],
        "evidence": field_evidence, "scored": True,
    }


def run_all_rules(evidence, product_context):
    rules_config = load_json("rules.json")
    results = []
    for rule in rules_config["rules"]:
        results.append(evaluate_rule(rule, evidence, product_context))
    return results


def calculate_score(results):
    """
    Score = PASS applicable scored rules / all applicable scored rules x 100
    Excludes: N/A, and any rule marked scored=False (i.e. PCR-R11).
    """
    scored_applicable = [r for r in results if r["status"] != "N/A" and r["scored"]]
    if not scored_applicable:
        return 0
    passed = len([r for r in scored_applicable if r["status"] == "PASS"])
    return round((passed / len(scored_applicable)) * 100)


def test_against_mock_tests():
    """Runs mock_tests.json single-field cases through evaluate_rule directly."""
    rules_config = load_json("rules.json")
    rules_by_id = {r["rule_id"]: r for r in rules_config["rules"]}
    mock = load_json("mock_tests.json")

    passed_count, failed_count = 0, 0
    for test in mock["tests"]:
        if test["rule_id"] == "ALL" or "input" not in test or "field" not in test.get("input", {}):
            continue  # composite/manual tests - skip in this simple harness
        rule = rules_by_id.get(test["rule_id"])
        if rule is None:
            print(f"[SKIP] {test['id']}: unknown rule_id {test['rule_id']}")
            continue

        field = test["input"]["field"]
        evidence = {field: {k: v for k, v in test["input"].items() if k not in ("field",) and not k.startswith("product_")}}
        product_context = {k.replace("product_", ""): v for k, v in test["input"].items() if k.startswith("product_")}

        result = evaluate_rule(rule, evidence, product_context)
        expected = test["expected_status"]
        ok = result["status"] == expected
        passed_count += ok
        failed_count += not ok
        marker = "OK" if ok else "MISMATCH"
        print(f"[{marker}] {test['id']}: {test['description']} -> got {result['status']}, expected {expected}")

    print(f"\n{passed_count} passed, {failed_count} mismatched (composite/manual tests skipped)")


if __name__ == "__main__":
    print("=== Sample scan ===")
    example_evidence = {
        "manufacturer": {"value": "ABC Foods Pvt Ltd, Pune", "confidence": 0.93},
        "common_name": {"value": "Choco Biscuits", "confidence": 0.95},
        "net_quantity": {"value": "250", "unit": "g", "confidence": 0.9},
        "mrp": {"value": "45", "confidence": 0.94, "context_confirmed": True},
        "manufacturing_date": {"value": "JUL 2026", "date_role": "manufacturing", "confidence": 0.85},
        "expiry_date": {"value": "JAN 2027", "date_role": "best_before_use_by", "confidence": 0.88},
        "consumer_care": {"value": None},
        "country_of_origin": {"value": None},
        "unit_sale_price": {"value": None},
        "dimensions": {"value": None},
        "principal_display_panel_colocation": {},
    }
    example_product_context = {
        "is_imported": False,
        "may_expire": True,
        "requires_unit_sale_price": False,
        "dimensions_relevant": False,
    }

    results = run_all_rules(example_evidence, example_product_context)
    for r in results:
        scored_tag = "" if r["scored"] else " (not scored)"
        print(f"{r['rule_id']} {r['field']} -> {r['status']}{scored_tag} - {r['reason']}")
    print("\nScore:", calculate_score(results))

    print("\n=== Mock test harness ===")
    test_against_mock_tests()
