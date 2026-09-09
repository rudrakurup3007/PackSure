# PackSure — OCR & Extraction Handoff

**Owner:** Person 2 (AI/CV)
**Consumers:** Person 3 (backend / FastAPI), Person 5 (domain rules)
**Status:** PaddleOCR only. Tesseract and Google Vision have been removed.

---

## 1. What Person 3 needs to do

### Install

```bash
pip install paddlepaddle paddleocr python-dateutil rapidfuzz
```

**Run once before any demo or deployment**, on a good connection:

```python
from paddleocr import PaddleOCR
PaddleOCR(lang="en")
```

This downloads ~100–200MB of detection/recognition models into `~/.paddleocr`.
If this has not been done, the first `/scan` request will either hang on the
download or fail. It is the single most likely cause of a broken deployment.

### Call it

```python
from pipeline import run_pipeline

result = run_pipeline(["front.jpg", "back.jpg"])   # 1 to 3 paths
```

Returns exactly two keys:

```python
{
  "declarations":    {...},   # -> rule_engine's `evidence` argument
  "product_context": {...},   # -> rule_engine's `product_context` argument
}
```

Feed them straight through — **no reshaping is needed**:

```python
from rule_engine import run_all_rules, calculate_score

results = run_all_rules(result["declarations"], result["product_context"])
score = calculate_score(results)
```

### Errors it raises

| Exception | Meaning |
|---|---|
| `TypeError` | `image_paths` was not a list/tuple |
| `ValueError` | fewer than 1 or more than 3 images |
| `FileNotFoundError` | a path does not exist on disk |
| `PaddleOCRError` | PaddleOCR could not be initialised (not installed, models missing) |

`PaddleOCRError` is the one to surface clearly in the API response.
**There is no fallback engine** — if Paddle is unavailable, the scan fails.
This was a deliberate team decision; see §6.

Latency is roughly 1–3s per image after the first call. The first call in a
process is slower because the models load into memory. If that matters,
warm it at app startup:

```python
from ocr_engine import PaddleOCRBackend
BACKEND = PaddleOCRBackend()          # module-level, loads models once
```

---

## 2. The evidence contract

`declarations` has exactly these 11 keys, always present, never missing:

```
manufacturer            common_name        net_quantity      mrp
manufacturing_date      expiry_date        consumer_care     country_of_origin
unit_sale_price         dimensions         principal_display_panel_colocation
```

Every value is a dict. `value` is `None` when nothing was found — the key is
still there.

```python
{
  "value": "400",                    # str or None
  "raw_text": "NET WEIGHT: 400g",    # the OCR line it came from
  "confidence": 0.87,                # 0.0-1.0
  "bbox": [x0, y0, x1, y1],          # pixel coords in the source image
  "image_index": 1,                  # 1-based; which uploaded image
  "context": "line above | this line | line below",
}
```

`bbox` + `image_index` are what the frontend's "View Evidence" highlight
needs. They are always in the coordinate space of the original uploaded
image.

### Field-specific extras

| Field | Extra keys |
|---|---|
| `net_quantity` | `unit`, `unit_status`, `corrected_from_ocr` |
| `manufacturing_date`, `expiry_date` | `date_role`, `parsed_date` |
| `mrp` | `context_confirmed`, `currency` |
| `manufacturer` | `label_match`, `label_type` |
| `common_name` | `match_method`, sometimes `partial` |
| `country_of_origin` | sometimes `importer_mentioned`, `origin_conflict` |
| `consumer_care` | sometimes `partial` |

`product_context`:

```python
{
  "is_imported": None,                 # True / False / None (unknown)
  "may_expire": True,
  "requires_unit_sale_price": None,    # see §5
  "dimensions_relevant": False,        # PCR-R10 retired, see §5
}
```

---

## 3. Values Person 5 must handle in the rule engine

Three evidence values are newer than the original rules spec. Two already
have branches in `rule_engine.py`; confirm they survived any merge.

**`unit_status: "ocr_corrected"`** — the unit was *reconstructed* from a
suspected misread (`"400g"` came back as the single token `"4009"`, and the
trailing `9` was reversed to `g`). It is not a unit that was actually read
off the pack. Without a branch for this, `unit` is populated and the rule
falls through to a clean PASS, so a guessed character silently satisfies a
net-quantity declaration. It should be **REVIEW**.

**`origin_conflict: True`** — the pack declares an origin *and* names an
importer that disagrees with it (`"Made in India"` beside `"Imported by ABC
Pvt Ltd"`). The extractor resolves `is_imported` in favour of the explicit
origin declaration, which is the right call, but the disagreement is a real
anomaly a human should see. Should be **REVIEW**.

**`label_type`** on `manufacturer` — `"manufacturer"` or
`"packer_importer_marketer"`. No rule change needed: Rule 6(1)(a) accepts
the manufacturer *or* the packer *or* the importer, so either satisfies
PCR-R01. The flag exists so a reviewer can tell which role was declared.

---

## 4. Files

| File | Role |
|---|---|
| `ocr_engine.py` | PaddleOCR backend, line reconstruction, column splitting |
| `field_extractors.py` | Per-field extraction, the two-column rank matcher |
| `pipeline.py` | Entry point. `run_pipeline()` / `extract_declarations()` |
| `test_extraction_smoke.py` | 78 tests, no images or OCR required (~0.5s) |

Modules import each other **flat** (`from ocr_engine import ...`), so all
four must sit in the same directory and that directory must be on the
import path. If you prefer a package, add `__init__.py` and change the four
import lines to relative (`from .ocr_engine import ...`).

Run the tests after any merge:

```bash
python -m pytest test_extraction_smoke.py -q     # expect: 78 passed
```

They construct `OCRLine` objects directly, so they need neither PaddleOCR
nor image files. They are the fastest way to confirm a merge did not break
extraction.

---

## 5. Two open policy decisions

Both are one-line changes in `pipeline.py`. **They are the rules owner's
call, not the AI/CV owner's.**

**`ASSUME_UNIT_SALE_PRICE_APPLICABLE = None`** — this MVP has no
product-category classifier, so it cannot know which SKUs are legally
required to declare a unit sale price. `None` sends PCR-R09 to REVIEW.
`True` would FAIL every pack lacking the declaration, and since most
single-unit FMCG is exempt, that means a wrong result on the majority of
scans. `False` would exclude it from scoring entirely, but we have no
evidence of exemption, so that would be a lie.

**`ASSUME_DIMENSIONS_APPLICABLE = False`** — PCR-R10 is retired at the
team's decision. `False` makes it N/A, and `calculate_score()` excludes N/A
from both numerator and denominator, so the rule leaves the score cleanly.
`extract_dimensions` still runs and still populates `declarations`, so the
rule can be revived by flipping this back.

To remove the DIMENSIONS card from the UI as well, delete its entry from
`rules.json` — the switch controls scoring, not rendering.

---

## 6. Known limitations — read before promising anything

**No fallback engine.** Tesseract and Google Vision were removed on
2026-09-09. If PaddleOCR fails to initialise, `/scan` fails. Restoring a
fallback means re-adding a backend class exposing
`read_image(path, image_index) -> List[OCRLine]` and passing it to
`run_ocr(paths, backend=...)`, which still accepts one.

**PaddleOCR API drift.** The library changed both its constructor keywords
and its result shape between 2.x and 3.x. `PaddleOCRBackend` handles both,
but a future 4.x could break parsing and would show up as an **empty scan
with no error**. If every field is suddenly null on packs that used to
work, suspect this first: check `_detections()` against the installed
version's output.

**Misregistered label/value columns.** On fill-time-printed stickers the
value column is often offset a row from the label column. The rank matcher
in `field_extractors.merge_label_value_columns` handles this, but only when
OCR reads *both* columns completely. If a label is unreadable, the block is
rejected whole (by design — a shifted pairing would report a batch code as
an expiry date).

**Image quality is the binding constraint.** Straight-on, evenly lit photos
with no glare on the declarations panel produce dramatically better results
than anything achievable in the extraction layer. This is worth telling
users in the UI.

**The 78 tests do not cover the OCR engine.** They construct `OCRLine`
objects directly. Nothing exercises PaddleOCR inference, model loading, or
the real multi-image path end to end. That needs image fixtures and is the
most valuable next piece of test work.
