# PackSure — Evidence Requirements for OCR/Extraction (v1.0-final)
**From:** Riya (Person 5 — Domain/Rules)
**To:** Person 2 (AI/CV — OCR & Extraction)

## Why you're getting this
The rules engine never looks at raw OCR text or images — only at the **structured evidence** your pipeline produces. This doc is final for now: field names and required evidence are frozen. Two things changed since the last version: a general `context` field was added everywhere, and the date fields now require `date_role`.

## The golden rule for your pipeline
**You extract and describe evidence. You never decide compliance, and you never guess ambiguous legal information.** If something is unclear — which date is which, which price is MRP, whether a unit is present — say so explicitly (`"unclear"`, `null`, low confidence) rather than picking the more likely answer. The rules engine is built to handle "I don't know" safely (→ REVIEW); it is not built to recover from a wrong guess presented as a confident answer.

## Evidence shape — every field needs these 5
For **every** field: `value`, `raw_text`, `confidence` (0.0–1.0), `bbox`, `context` (short string — nearby label text or surrounding words that helped you identify the field, e.g. `"near text 'MFG'"` or `"below product name"`).

## Field-by-field requirements
| field | extra fields needed | notes |
|---|---|---|
| `manufacturer` | — | One block of text is fine |
| `common_name` | — | Distinguish from brand/slogan if possible — a brand name alone should NOT satisfy this |
| `net_quantity` | `unit`, `unit_status` | `unit_status` must be `"confirmed_absent"` if you looked and found no unit at all, or `"ambiguous"` if you're not sure. These lead to different outcomes (FAIL vs REVIEW) — don't skip this distinction |
| `mrp` | `currency`, `context_confirmed` | If multiple price-like values appear on the package, set `context_confirmed: true` only for the one you're confident is MRP (e.g. near the text "MRP" or "Rs."); if you can't confirm which is MRP, send your best candidate with `context_confirmed: false` |
| `manufacturing_date` | **`date_role`** | Must be `"manufacturing"`, `"best_before_use_by"`, or `"unclear"` — see below |
| `expiry_date` | **`date_role`** | Same three values. This is a separate field from `manufacturing_date`, even if only one date is found on the package |
| `consumer_care` | — | Partial matches (e.g. only a phone number) are fine to send, flag as partial if you can |
| `country_of_origin` | — | Also send `product.is_imported: true/false` at the product level if your pipeline can detect it separately from the country text itself |
| `unit_sale_price` | `unit`, `currency` | New field. Also send `product.requires_unit_sale_price` at the product level if determinable (depends on package type — wholesale/combination/group/multi-piece packages and cases where MRP equals unit price are exempt) |
| `dimensions` | `unit` | New field, only relevant for specific commodity categories. Send `product.dimensions_relevant` if you can classify the commodity category, otherwise leave it out |

## date_role — the most important addition, please read carefully
Classify **based on nearby keywords**, not just "a date was found":
- Keywords like "MFG", "Manufacturing Date", "Mfd", "Packed on", "Date of Manufacture" → `date_role: "manufacturing"`
- Keywords like "Best Before", "Use By", "Exp", "Expiry" → `date_role: "best_before_use_by"`
- A date with no reliable nearby keyword → `date_role: "unclear"` — **do not guess based on which date looks earlier/later, or which field you're currently trying to fill.** A confident-looking date extraction is not evidence of *which* declaration it satisfies.

### Example
```json
{
  "manufacturing_date": {
    "value": "06/2026", "date_role": "manufacturing",
    "raw_text": "MFD: 06/2026", "confidence": 0.9,
    "bbox": [100, 400, 220, 420], "context": "near text 'MFD'"
  },
  "expiry_date": {
    "value": "06/2027", "date_role": "best_before_use_by",
    "raw_text": "BEST BEFORE: 06/2027", "confidence": 0.92,
    "bbox": [100, 430, 240, 450], "context": "near text 'BEST BEFORE'"
  }
}
```
If you found only one date and no clear keyword context (e.g. just `"06/2027"` floating on the package with nothing nearby to anchor it):
```json
{
  "manufacturing_date": {
    "value": "06/2027", "date_role": "unclear",
    "raw_text": "06/2027", "confidence": 0.9,
    "bbox": [100, 400, 220, 420], "context": null
  }
}
```
This will correctly become REVIEW, not a guessed PASS.

## Open questions for you
1. Can your pipeline separate **import status**, **perishability**, **unit-sale-price applicability**, and **dimension relevance** from the raw text, or only extract the text itself? If any of these product-level classifications are out of scope for your MVP, tell me — the affected rules will default to REVIEW rather than guessing.
2. For `net_quantity`, can you reliably distinguish "confirmed no unit present" from "couldn't parse the unit"? This determines FAIL vs REVIEW.

## What NOT to worry about
You don't decide if something is compliant. Even a low-confidence, partial, or `"unclear"` detection is useful — don't withhold it just because it's uncertain. The rules engine is designed to handle uncertainty safely; a false-confident guess is the one thing that can actually cause harm downstream.
