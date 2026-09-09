"""
PackSure — OCR Engine
Person 2 (AI/CV — OCR & Extraction)

Wraps Tesseract OCR and turns its raw word-level output into LINE-level
text blocks, which is the unit field_extractors.py works on. Each line
carries a bounding box (in the original image's pixel coordinates) and a
confidence score, plus the image_index it came from (1-based, per the
architecture doc's multi-image convention).

Swap PytesseractBackend for a different OCR engine (Google Vision, an
EasyOCR/PaddleOCR model, etc.) later without touching field_extractors.py
or pipeline.py — that's the whole point of keeping this file separate.

--------------------------------------------------------------------------
FIX (photo-of-package OCR quality): Tesseract's models assume a fairly
uniform, high-contrast scanned page. Fed a raw phone photo of a glossy,
colourful package with small dense print, it can produce near-total
garbage. Addressed by preprocessing (_preprocess_variants) plus multi-pass
OCR, merged at the word level.

FIX (multi-pass merge dedup gap): merging passes used to dedup whole
*lines* by bbox IOU. Two passes segmenting a line slightly differently
meant both survived and their text ended up concatenated - e.g. "SIX
MONTHS" turning into "SI SIX MONTHS" - which broke exact-match regexes
downstream. Dedup now happens at the *word* level, across all passes,
before any line is assembled.

--------------------------------------------------------------------------
NEW FIXES IN THIS REVISION
--------------------------------------------------------------------------
1. LINE ORDERING (real bug). _words_to_lines built lines greedily from a
   y-sorted word list, but a line's bbox grows as words are added, so the
   emitted line order could drift out of top-to-bottom reading order. Every
   "label on its own line, value on the NEXT line" fallback in
   field_extractors.py (manufacturer, common_name, net_quantity,
   country_of_origin) depends on that order, as does _context_window().
   Lines are now explicitly sorted by (y0, x0) before being returned.

2. INVERTED / LOW-CONTRAST PRINT (recall). Global Otsu assumes dark text on
   a light background. Indian FMCG packs very often print white-on-colour,
   and glare regions get wiped out entirely by a single global threshold -
   which is exactly the "image issue" cause behind several of the null
   fields in the audit (e.g. the "110g" region "wasn't recognised as text by
   OCR at all"). _preprocess_variants() now produces up to three renderings
   (Otsu binary, an autocontrast grayscale that survives glare, and an
   inverted binary when the image is dark-dominant). Word-level dedup makes
   the extra passes safe: a word found by two renderings is merged, not
   duplicated.

3. PASS ISOLATION (robustness). A single Tesseract invocation failing (bad
   config, odd image mode) used to abort the entire scan. Each pass is now
   wrapped independently; surviving passes still produce output.

4. Removed dead code (_vertical_overlap was defined but never called) and
   moved _bbox_iou / _DEDUP_IOU_THRESHOLD above their first use.
--------------------------------------------------------------------------
"""

from dataclasses import dataclass, field
from typing import List, Optional, Tuple
import re

import numpy as np
import pytesseract
from PIL import Image, ImageFilter, ImageOps


@dataclass
class OCRLine:
    text: str
    bbox: List[int]          # [x_min, y_min, x_max, y_max] in pixel coords
    confidence: float        # 0.0 - 1.0
    image_index: int         # 1-based, matches architecture doc convention
    words: List[dict] = field(default_factory=list)  # word-level detail, kept for finer bbox lookups


# --------------------------------------------------------------------------
# Geometry helpers
# --------------------------------------------------------------------------

def _bbox_iou(a: List[int], b: List[int]) -> float:
    """Intersection-over-union of two [x0, y0, x1, y1] boxes."""
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ix0, iy0 = max(ax0, bx0), max(ay0, by0)
    ix1, iy1 = min(ax1, bx1), min(ay1, by1)
    if ix1 <= ix0 or iy1 <= iy0:
        return 0.0
    inter = (ix1 - ix0) * (iy1 - iy0)
    area_a = (ax1 - ax0) * (ay1 - ay0)
    area_b = (bx1 - bx0) * (by1 - by0)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def _bbox_containment(a: List[int], b: List[int]) -> float:
    """Intersection area divided by the area of the SMALLER box."""
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ix0, iy0 = max(ax0, bx0), max(ay0, by0)
    ix1, iy1 = min(ax1, bx1), min(ay1, by1)
    if ix1 <= ix0 or iy1 <= iy0:
        return 0.0
    inter = (ix1 - ix0) * (iy1 - iy0)
    smaller = min((ax1 - ax0) * (ay1 - ay0), (bx1 - bx0) * (by1 - by0))
    return inter / smaller if smaller > 0 else 0.0


_DEDUP_IOU_THRESHOLD = 0.5
_STRONG_OVERLAP = 0.70
# Intersection / area-of-smaller-box. Catches a sub-token sitting inside the
# word a different pass read whole ("250" inside "250g").
_CONTAINMENT_THRESHOLD = 0.80
_UPSCALE = 2.5


# --------------------------------------------------------------------------
# Preprocessing
# --------------------------------------------------------------------------

def _otsu_threshold(arr: np.ndarray) -> int:
    """
    Standard Otsu's method: pick the grayscale threshold (0-255) that
    minimises intra-class variance between the two resulting pixel
    populations (print vs. background/glare). Implemented directly on top
    of numpy so this file doesn't need an OpenCV dependency for one
    histogram scan.
    """
    hist, _ = np.histogram(arr.ravel(), bins=256, range=(0, 256))
    total = arr.size
    sum_total = np.dot(np.arange(256), hist)

    sum_bg = 0.0
    weight_bg = 0
    best_thresh, best_variance = 0, -1.0

    for t in range(256):
        weight_bg += hist[t]
        if weight_bg == 0:
            continue
        weight_fg = total - weight_bg
        if weight_fg == 0:
            break
        sum_bg += t * hist[t]
        mean_bg = sum_bg / weight_bg
        mean_fg = (sum_total - sum_bg) / weight_fg
        variance = weight_bg * weight_fg * (mean_bg - mean_fg) ** 2
        if variance > best_variance:
            best_variance = variance
            best_thresh = t

    return best_thresh


def _base_gray(img: Image.Image) -> Image.Image:
    """Upscale + denoise. Shared by every rendering variant so all variants
    live in the same coordinate system and their boxes can be compared."""
    gray = img.convert("L")

    # Upscale. Small printed text on a packaging photo is often only a
    # handful of pixels tall at native resolution; Tesseract's character
    # models need more than that to have a chance.
    w, h = gray.size
    gray = gray.resize(
        (max(1, int(w * _UPSCALE)), max(1, int(h * _UPSCALE))), Image.LANCZOS
    )

    # Denoise. A median filter clears the salt-and-pepper / JPEG compression
    # noise typical of phone photos without smearing character edges the way
    # a heavier Gaussian blur would.
    return gray.filter(ImageFilter.MedianFilter(size=3))


def _preprocess_variants(img: Image.Image) -> List[Image.Image]:
    """
    Returns the renderings of the image that Tesseract should be run over.

    Variant 1 - Otsu binary: the workhorse. Picks a global black/white
      threshold that best separates print from background.
    Variant 2 - autocontrast grayscale: no thresholding at all. A global
      threshold is destructive on a photo with uneven lighting - a glare
      patch pushes a whole region to one side of the threshold and the text
      inside it disappears. Keeping a contrast-stretched grayscale rendering
      gives Tesseract's own adaptive binarisation a chance at those regions.
    Variant 3 - inverted binary, only when the image is dark-dominant:
      white-on-colour print is extremely common on FMCG packaging, and Otsu
      hands Tesseract white glyphs on black, which its models are not
      trained for.

    All variants share _base_gray()'s geometry, so a word found by two
    variants dedups cleanly by bbox in _merge_words_across_passes().
    """
    gray = _base_gray(img)
    arr = np.array(gray)
    threshold = _otsu_threshold(arr)
    binary = Image.fromarray((arr > threshold).astype(np.uint8) * 255)

    variants = [binary, ImageOps.autocontrast(gray, cutoff=2)]

    # "Dark-dominant" = most pixels fall below the Otsu threshold, i.e. the
    # background is the dark class and the print is the light class.
    if float((arr <= threshold).mean()) > 0.55:
        variants.append(ImageOps.invert(binary.convert("L")))

    return variants


# --------------------------------------------------------------------------
# Word extraction, cross-pass dedup, and line grouping
# --------------------------------------------------------------------------

def _extract_words(ocr_data: dict, image_index: int, pass_index: int = 0,
                   scale: float = 1.0) -> List[dict]:
    """Flatten one pass's pytesseract.image_to_data output into a list of
    per-word dicts. No line grouping happens here - that's done once, after
    words from all passes have been merged and deduped."""
    words = []
    n = len(ocr_data["text"])
    for i in range(n):
        text = ocr_data["text"][i].strip()
        try:
            conf = int(float(ocr_data["conf"][i]))
        except (TypeError, ValueError):
            continue
        if not text or conf < 0:
            continue  # tesseract uses conf=-1 for non-text regions

        x, y, w, h = (ocr_data["left"][i], ocr_data["top"][i],
                      ocr_data["width"][i], ocr_data["height"][i])
        # Tesseract sees the preprocessed (upscaled) image. Convert its boxes
        # back to the original image coordinate system required by the
        # evidence contract.
        inv_scale = 1.0 / scale if scale else 1.0
        words.append({
            "text": text,
            "bbox": [round(x * inv_scale), round(y * inv_scale),
                     round((x + w) * inv_scale), round((y + h) * inv_scale)],
            "confidence": conf / 100.0,
            "image_index": image_index,
            "pass_index": pass_index,
        })
    return words


def _normalise_ocr_token(text: str) -> str:
    """Normalise harmless OCR differences for duplicate-token comparison."""
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def _merge_words_across_passes(all_words: List[dict]) -> List[dict]:
    """
    Merge duplicate detections from different Tesseract passes.

    A duplicate must:
      1. come from different passes,
      2. have substantially overlapping geometry, and
      3. either have similar OCR text or be a very strong geometric overlap.

    This prevents two adjacent legitimate words from being collapsed merely
    because their bounding boxes touch.
    """
    merged: List[dict] = []

    for word in sorted(all_words, key=lambda w: (w["bbox"][1], w["bbox"][0])):
        duplicate_idx = None

        for idx, existing in enumerate(merged):
            if word.get("pass_index", 0) == existing.get("pass_index", 0):
                continue

            iou = _bbox_iou(word["bbox"], existing["bbox"])
            containment = _bbox_containment(word["bbox"], existing["bbox"])

            same_token = (
                _normalise_ocr_token(word["text"])
                == _normalise_ocr_token(existing["text"])
            )

            # FIX (found on real pack photos): IOU alone cannot catch the
            # most common cross-pass duplicate, which is a TOKENISATION
            # difference rather than a reading difference. One pass reads
            # "250g" as a single word; another splits it into "250" + "g".
            # The "250" box sits inside the "250g" box, so their IOU is only
            # ~0.6 and their normalised tokens differ - both survived, and
            # the line came out as "Net Qty: 250g 250 g". Same cause behind
            # "USP PERG: PER g:" and the duplicated price fragments.
            #
            # Containment (intersection / smaller box area) catches exactly
            # this: a sub-token is almost entirely inside its parent. It is
            # safe against collapsing genuine neighbours, whose boxes abut
            # but do not contain one another.
            if same_token and iou >= _DEDUP_IOU_THRESHOLD:
                duplicate_idx = idx
                break
            if iou >= _STRONG_OVERLAP or containment >= _CONTAINMENT_THRESHOLD:
                duplicate_idx = idx
                break

        if duplicate_idx is None:
            merged.append(word)
        else:
            existing = merged[duplicate_idx]
            # Prefer the fuller reading. When one pass split a token, the
            # unsplit version carries more of the original text, so length
            # decides first and confidence only breaks ties.
            new_len = len(_normalise_ocr_token(word["text"]))
            old_len = len(_normalise_ocr_token(existing["text"]))
            if (new_len, word["confidence"]) > (old_len, existing["confidence"]):
                merged[duplicate_idx] = word

    return merged


def _words_to_lines(words: List[dict], image_index: int) -> List[OCRLine]:
    """
    Group deduped words into lines by vertical (y-axis) proximity. We can't
    rely on tesseract's (block_num, par_num, line_num) triple here the way
    a single-pass grouping could, because after merging words from
    different passes there's no guarantee two passes numbered the same
    physical line the same way - the merged list is just a flat bag of
    words. Clustering by y-overlap reconstructs lines directly from
    geometry instead, then each line's words are ordered left-to-right by
    x0 to rebuild reading order.

    FIX: the returned list is now explicitly sorted top-to-bottom. Lines
    were previously emitted in the order they happened to be created while
    scanning a y-sorted word list, and a line's y-range grows as words are
    appended to it, so the emitted order could drift out of reading order.
    Every "label on one line, value on the next" fallback downstream reads
    lines[i + 1], so that drift silently broke those fallbacks.
    """
    # FIX (found on real pack photos - two physical lines merging into one).
    # The previous rule grew each line's y-range to the UNION of its words'
    # boxes and then tested a new word with
    #     overlap / min(word_height, line_height) > 0.5
    # Both halves of that are unsafe together. The union grows every time a
    # word is added, so one tall glyph stretches the line's range over the
    # row below; and dividing by min_height means a short word only has to
    # overlap half of ITSELF to be swallowed by that stretched range. Once
    # one word from the next row joins, the range grows again and the rest
    # follow. On the Mixed Nuts pack this merged the brand block into
    #     "MIXED ROASTED & NUTS SALTED"        (91px tall, two rows)
    # and, worse, the manufacturer block into
    #     "Manufactured a Nutri Manufactured Foods Pvt. by: 'te. Ltd. by:"
    # where "manufactured by" no longer appears contiguously - no regex or
    # fuzzy match downstream can recover a manufacturer from that.
    #
    # The replacement compares vertical CENTRES against the line's running
    # median centre and median word height. A centre is stable as words are
    # added (unlike a growing union), and a row's own text height is the
    # right yardstick for "is this the same row". Two rows of different type
    # sizes now separate cleanly, while ordinary words on one row - whose
    # centres coincide - still group.
    lines: List[dict] = []  # {"words", "centre", "heights"}

    def _centre(box):
        return (box[1] + box[3]) / 2.0

    for w in sorted(words, key=lambda w: (_centre(w["bbox"]), w["bbox"][0])):
        w_centre = _centre(w["bbox"])
        w_height = max(1, w["bbox"][3] - w["bbox"][1])

        target = None
        for ln in lines:
            line_height = ln["heights"][len(ln["heights"]) // 2]
            tolerance = _ROW_CENTRE_TOLERANCE * min(w_height, line_height)
            if abs(w_centre - ln["centre"]) <= tolerance:
                target = ln
                break

        if target is None:
            lines.append({"words": [w], "centre": w_centre, "heights": [w_height]})
        else:
            target["words"].append(w)
            # Running mean centre: resistant to one outlier glyph dragging
            # the row up or down, which is what let the old union-based
            # range creep into the neighbouring row.
            n = len(target["words"])
            target["centre"] += (w_centre - target["centre"]) / n
            target["heights"] = sorted(target["heights"] + [w_height])

    result = []
    for ln in lines:
        ordered = sorted(ln["words"], key=lambda w: w["bbox"][0])
        # PROBLEM 9 — column merging (demonstrated, not speculative).
        # Clustering purely by y-overlap joins everything sitting at the same
        # height across the FULL width of the photo. Two columns printed side
        # by side - completely normal on a back panel, where a declarations
        # block sits beside a nutrition table - became one OCRLine:
        #
        #   ['MRP', 'Rs', '60.00']  +  ['NET', 'QTY', '400g']
        #     -> "MRP Rs 60.00 NET QTY 400g"
        #
        # That is not just untidy. Every same-line label pattern in
        # field_extractors.py captures `(.+)` to end of line, so a
        # "MANUFACTURED FOR:" in the left column would swallow whatever
        # happened to be printed to its right as the manufacturer's name.
        #
        # Split where the horizontal gap between consecutive words is large
        # relative to the text size. Inter-word spacing in a line of print is
        # roughly 0.3-0.6x the glyph height; a column gutter is several times
        # it. The 2.0x threshold sits well clear of both, so ordinary spacing
        # (including the wide spacing OCR reports around punctuation) is
        # never split.
        for run in _split_at_column_gaps(ordered):
            line = _line_from_words(run, image_index)
            if line is not None:
                result.append(line)

    # Reading order: top-to-bottom, then left-to-right. See docstring.
    result.sort(key=lambda line: (line.bbox[1], line.bbox[0]))
    return result


_COLUMN_GAP_RATIO = 2.0
# How far a word's vertical centre may sit from a row's centre and still be
# considered part of that row, as a fraction of the smaller text height.
# 0.5 would mean "within half a character height", which is about the
# tightest that still tolerates baseline jitter on a curved package.
_ROW_CENTRE_TOLERANCE = 0.5


def _split_at_column_gaps(ordered: List[dict]) -> List[List[dict]]:
    """Splits a left-to-right ordered word run wherever the horizontal gap
    indicates a column boundary rather than ordinary word spacing."""
    if len(ordered) < 2:
        return [ordered] if ordered else []

    heights = sorted(w["bbox"][3] - w["bbox"][1] for w in ordered)
    median_height = heights[len(heights) // 2] or 1
    max_gap = median_height * _COLUMN_GAP_RATIO

    runs = [[ordered[0]]]
    for prev, word in zip(ordered, ordered[1:]):
        if word["bbox"][0] - prev["bbox"][2] > max_gap:
            runs.append([word])
        else:
            runs[-1].append(word)
    return runs


def _line_from_words(ordered: List[dict], image_index: int) -> Optional[OCRLine]:
    """Assembles one OCRLine from an ordered, single-column word run."""
    # Defensive cleanup: if two surviving OCR detections produce an identical
    # consecutive token on the same physical line, keep one. This only
    # removes adjacent exact-token stutter, never legitimate separated
    # repetitions. (Preserved from the word-level dedup work - do not remove.)
    cleaned = []
    for w in ordered:
        token = _normalise_ocr_token(w["text"])
        if cleaned and token and token == _normalise_ocr_token(cleaned[-1]["text"]):
            if w["confidence"] > cleaned[-1]["confidence"]:
                cleaned[-1] = w
        else:
            cleaned.append(w)
    if not cleaned:
        return None

    return OCRLine(
        text=" ".join(w["text"] for w in cleaned),
        bbox=[min(w["bbox"][0] for w in cleaned),
              min(w["bbox"][1] for w in cleaned),
              max(w["bbox"][2] for w in cleaned),
              max(w["bbox"][3] for w in cleaned)],
        confidence=round(sum(w["confidence"] for w in cleaned) / len(cleaned), 3),
        image_index=image_index,
        words=cleaned,
    )


# --------------------------------------------------------------------------
# Backend
# --------------------------------------------------------------------------

class PytesseractBackend:
    """Thin OCR backend. Swap this class out to change OCR engines."""

    # Pass config 1: default page segmentation (assumes a fairly uniform
    #   block of text - good for the bulk of the label).
    # Pass config 2: sparse text mode (--psm 11) - looks for text anywhere on
    #   the page with no layout assumption, so it catches isolated blocks
    #   (e.g. a "MANUFACTURED FOR:" / "CONSUMER CARE CELL" panel in a corner)
    #   that the default layout analysis skips entirely.
    _PASS_CONFIGS: Tuple[Optional[str], ...] = (None, "--psm 11")

    # The extra image renderings (see _preprocess_variants) are only run in
    # sparse-text mode. They exist to rescue regions the primary Otsu
    # rendering destroys; running every config over every variant would
    # multiply runtime for very little extra recall.
    _SECONDARY_CONFIG: str = "--psm 11"

    def read_image(self, image_path: str, image_index: int) -> List[OCRLine]:
        img = Image.open(image_path).convert("RGB")
        variants = _preprocess_variants(img)
        primary = variants[0]

        # (image, config) pairs, each getting its own pass_index.
        jobs = [(primary, config) for config in self._PASS_CONFIGS]
        jobs += [(variant, self._SECONDARY_CONFIG) for variant in variants[1:]]

        # Collect every word from every pass first - no line grouping yet.
        # Dedup happens on this flat word list (by bounding-box overlap, not
        # text equality, since passes frequently read the same physical word
        # slightly differently, e.g. "60.00" vs "6O.OO") so that a word
        # duplicated across passes is gone *before* it can end up
        # concatenated into a line's text.
        all_words: List[dict] = []
        scale_x = primary.width / max(1, img.width)
        scale_y = primary.height / max(1, img.height)
        # Preprocessing currently uses uniform scaling, but keep the two axes
        # explicit so bbox conversion stays correct if that changes later.
        scale = (scale_x + scale_y) / 2.0

        for pass_index, (image, config) in enumerate(jobs):
            kwargs = {"config": config} if config else {}
            try:
                ocr_data = pytesseract.image_to_data(
                    image, output_type=pytesseract.Output.DICT, **kwargs
                )
            except Exception:
                # FIX: one failing pass used to abort the whole scan. A
                # partial read from the surviving passes is far better than
                # no evidence at all - and the rule engine is built to treat
                # missing evidence as REVIEW, not as a pass.
                continue
            all_words.extend(_extract_words(
                ocr_data, image_index, pass_index=pass_index, scale=scale
            ))

        deduped_words = _merge_words_across_passes(all_words)
        return _words_to_lines(deduped_words, image_index)


def run_ocr(image_paths: List[str], backend=None) -> List[OCRLine]:
    """
    Runs OCR over 1-3 images (per the /scan contract) and returns a flat
    list of OCRLine objects across all images, each tagged with its
    1-based image_index so downstream evidence/bbox can point back to the
    right uploaded image.
    """
    if not (1 <= len(image_paths) <= 3):
        raise ValueError("Expected 1 to 3 images per the /scan contract, got "
                         f"{len(image_paths)}")

    backend = backend or PytesseractBackend()
    all_lines: List[OCRLine] = []
    for idx, path in enumerate(image_paths, start=1):
        all_lines.extend(backend.read_image(path, idx))
    return all_lines
