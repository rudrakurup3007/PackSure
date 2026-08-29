# PackSure — Rules (Person 5 / Riya) — v1.0-final

## What's in this folder
- `rules.json` — **11 rules, IDs frozen (PCR-R01–PCR-R11).** PCR-R11 is experimental and never scored.
- `exceptions.json` — applicability/exception conditions for every conditional rule (R07, R08, R09, R10) plus the placement fallback (R11).
- `mock_tests.json` — 22 test cases covering every scenario in the spec, including the manufacturing-vs-best-before confusion case explicitly.
- `rule_engine_reference.py` — working Python reference implementing the exact 5-step evaluation logic, plus a harness (`test_against_mock_tests()`) that runs every mock test against it. All 22 pass.

## The 11 rules — FROZEN, do not renumber
| rule_id | field | applicability | checks |
|---|---|---|---|
| PCR-R01 | `manufacturer` | always | Name/address of manufacturer, packer, or importer present |
| PCR-R02 | `common_name` | always | Generic/common name of the product present |
| PCR-R03 | `net_quantity` | always | Value present AND unit confirmed (distinguishes "unit genuinely absent" = FAIL from "unit unclear" = REVIEW) |
| PCR-R04 | `mrp` | always | Price present AND `context_confirmed` if multiple prices detected |
| PCR-R05 | `manufacturing_date` | always | Date present AND `date_role == "manufacturing"` confirmed |
| PCR-R06 | `consumer_care` | always | Consumer complaint contact info present |
| PCR-R07 | `country_of_origin` | conditional: `product.is_imported` | PASS/FAIL if imported, N/A if domestic, REVIEW if unknown |
| PCR-R08 | `expiry_date` | conditional: `product.may_expire` | PASS/FAIL if perishable, N/A if not, REVIEW if unknown |
| PCR-R09 | `unit_sale_price` | conditional: `product.requires_unit_sale_price` | PASS/FAIL if required, N/A if exempt (RSP=USP, wholesale, combo/group/multi-piece, e-commerce), REVIEW if unknown |
| PCR-R10 | `dimensions` | conditional: `product.dimensions_relevant` | PASS/FAIL if relevant, N/A if not, REVIEW if unknown |
| PCR-R11 | `principal_display_panel_colocation` | always, **but never scored** | Experimental placement/legibility check. Real requirement (Rule 7/8) but not reliably verifiable from bbox alone in this MVP. Always REVIEW or N/A, never FAIL. |

## date_role — frozen field name, critical logic
`date_role` is the answer to "which kind of date is this." Allowed values: `manufacturing`, `best_before_use_by`, `unclear`. **Do not use `date_type` anywhere — the field name is frozen as `date_role`.**

A detected date is not by itself sufficient evidence of what it declares. If `date_role` is missing or `"unclear"`, the rule engine returns REVIEW — it never infers or defaults to either classification. This applies identically to PCR-R05 and PCR-R08.

## Scoring — frozen
```
Score = (PASS among applicable, scored rules) / (all applicable, scored rules) × 100
```
Excluded from both numerator and denominator: N/A rules, and PCR-R11 (always excluded regardless of its outcome). REVIEW is never silently converted to PASS or FAIL — it represents unresolved evidence or applicability and should be surfaced to a human reviewer, not folded into the score as if resolved.

## Field names — must match Person 3's structured extraction output exactly
`manufacturer`, `common_name`, `net_quantity` (+`unit`, `unit_status`), `mrp` (+`currency`, `context_confirmed`), `manufacturing_date` (+`date_role`), `expiry_date` (+`date_role`), `consumer_care`, `country_of_origin`, `unit_sale_price` (+`unit`, `currency`), `dimensions` (+`unit`). Every field additionally carries `value`, `raw_text`, `confidence`, `bbox`, `context`.

## Open items to confirm with the team today
- [ ] **Person 1/3**: does MVP attempt `is_imported`, `may_expire`, `requires_unit_sale_price`, `dimensions_relevant` classification at all, or are these always "unknown" (→ REVIEW) for the demo? See the `status: PROPOSED` notes in `exceptions.json`.
- [ ] **Person 2**: confirm OCR/extraction can produce `date_role` and `unit_status` per the Person 2 handoff doc.
- [ ] **Person 3**: confirm compliance engine can consume this exact JSON shape, or tell me what needs to change (rule_id/field names are now frozen from my side, so changes should flow the other way if needed).
- [ ] **Legal**: every `legal_reference` field marked "VERIFY AGAINST CURRENT PRIMARY SOURCE" is a working citation from secondary/legal-commentary sources, not confirmed against the bare gazetted text. Don't present these as certain in the demo or final report without checking the Dept. of Consumer Affairs source directly.

## Not in MVP scope (see `not_implemented_this_mvp` in exceptions.json)
Full sub-condition derivation for unit sale price exemptions (MVP treats it as one upstream boolean), QR/electronic declaration substitution, and automatic legal FAIL from measured font/pixel size (MVP only collects the evidence, does not compute a legal verdict from it).
