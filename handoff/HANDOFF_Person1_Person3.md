# PackSure — Rules Handoff (v1.0-final)
**From:** Riya (Person 5 — Domain/Rules)
**To:** Person 1 (Lead/Architect) & Person 3 (Backend/Compliance Engine)

## What I'm giving you
1. `rules.json` — **11 rules, IDs now frozen: PCR-R01 through PCR-R11.** This is final from my side — please build against these IDs rather than the R9-example numbering from the earlier architecture doc.
2. `exceptions.json` — every applicability/exception condition, for all conditional rules
3. `mock_tests.json` — 22 test cases with expected outcomes
4. `rule_engine_reference.py` — working reference implementation. All 22 mock tests pass against it (`test_against_mock_tests()` in the file). Use it to validate your own implementation matches.

## The 11 rules — frozen, final
| rule_id | field | applicability |
|---|---|---|
| PCR-R01 | `manufacturer` | always |
| PCR-R02 | `common_name` | always |
| PCR-R03 | `net_quantity` | always (unit confirmed vs. ambiguous distinguished via `unit_status`) |
| PCR-R04 | `mrp` | always (`context_confirmed` used when multiple prices detected) |
| PCR-R05 | `manufacturing_date` | always (`date_role` must be confirmed "manufacturing") |
| PCR-R06 | `consumer_care` | always |
| PCR-R07 | `country_of_origin` | conditional on `product.is_imported` |
| PCR-R08 | `expiry_date` (Best Before/Use By) | conditional on `product.may_expire` |
| PCR-R09 | `unit_sale_price` **(new)** | conditional on `product.requires_unit_sale_price` |
| PCR-R10 | `dimensions` **(new)** | conditional on `product.dimensions_relevant` |
| PCR-R11 | `principal_display_panel_colocation` | always evaluated but **never scored** — experimental |

Every rule outputs **PASS / FAIL / REVIEW / N/A**. REVIEW means evidence or applicability is unresolved — it must never silently become PASS or FAIL.

## Critical logic change: date_role
Both date fields (`manufacturing_date`, `expiry_date`) now require a `date_role` field from extraction: `"manufacturing"`, `"best_before_use_by"`, or `"unclear"`. **A detected date is not sufficient evidence of the declaration type on its own.** If `date_role` is missing or `"unclear"`, the rule returns REVIEW — never an inferred classification. This directly addresses the manufacturing-vs-expiry misread risk your teammate flagged.

## Score formula — frozen
```
Score = PASS among (applicable AND scored) rules / all (applicable AND scored) rules × 100
```
N/A rules and PCR-R11 are excluded from both numerator and denominator, always — PCR-R11's outcome (even if it were somehow PASS) never affects the score.

## What I need YOU to do
1. **Build the compliance engine against these 11 frozen rule_ids and field names.** No further ID changes expected from my side.
2. **Decide which of the four conditional-applicability signals your MVP actually classifies:** `product.is_imported`, `product.may_expire`, `product.requires_unit_sale_price`, `product.dimensions_relevant`. If any of these are out of scope for the demo, they'll simply always resolve to REVIEW under the current exception logic — confirm that's acceptable, or tell me to hardcode a default.
3. **Confirm the unit_sale_price applicability sub-conditions are out of scope for MVP as a compound check.** I've collapsed "RSP=USP / wholesale / combination / group / multi-piece / e-commerce" into a single upstream boolean (`requires_unit_sale_price`) rather than re-deriving each sub-condition in the rule engine — flag if you want it decomposed further.
4. **Wire `rules.json` + `exceptions.json` into the compliance engine** using the logic in `rule_engine_reference.py`, and run `test_against_mock_tests()` (or equivalent) against your implementation.

## What's still unverified (flag this, don't present as fact)
Every `legal_reference` field marked "VERIFY AGAINST CURRENT PRIMARY SOURCE" is a working citation from secondary/legal-commentary sources (legal blogs, law-firm summaries, FAQ documents), not the bare gazetted Rule 6 text checked clause-by-clause. This is true for exact sub-clause letters on R01–R06, the Rule 6(1)(da) reference for R08, the Rule 6(11) exemption list for R09, and especially R10 (dimensions) which has NOT been independently confirmed as a general requirement at all. Do not state any of these as certain in the demo or final report without checking https://doca.gov.in directly.

## PCR-R11 (placement) — explicit scope note
This is a real requirement (Principal Display Panel under Rule 7, manner of declaration under Rule 8), but the MVP does not implement a universal placement rule like "MRP must be at position X" — no such specific claim exists in this ruleset. It only collects evidence (`bbox`, `nearby_text`, `context_confirmed`, `image_geometry`) for a possible experimental check. If your team doesn't get to implementing panel-boundary detection, that's an acceptable known gap — don't spend demo-day time on it.
