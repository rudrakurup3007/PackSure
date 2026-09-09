"""
PackSure — OCR Engine (PaddleOCR)
Person 2 (AI/CV — OCR & Extraction)

Turns package photos into LINE-level text blocks, which is the unit
field_extractors.py works on. Each OCRLine carries a bounding box in the
original image's pixel coordinates, a confidence score, and the 1-based
image_index it came from (per the architecture doc's multi-image
convention).

--------------------------------------------------------------------------
WHY PADDLEOCR, AND WHY TESSERACT WAS REMOVED
--------------------------------------------------------------------------
Tesseract's models assume solid-stroke type on a flat, evenly lit page.
Every extraction failure we could not fix in the logic layer broke that
assumption:

  * inkjet / dot-matrix variable data - MRP, batch, MFD and USE BY are
    sprayed at fill time as broken dot strokes. On one real pack Tesseract
    read roughly 40% of a panel that is perfectly legible to a human.
  * glare and shadow on glossy or curved film.
  * 6pt licence blocks printed at an angle.
  * photos taken upside down (Tesseract does not auto-orient).

PaddleOCR's detector is trained on scene text rather than scanned
documents, which is far closer to "photo of a package". It runs locally:
no API key, no billing, no network at demo time, no per-request cost.

--------------------------------------------------------------------------
A NOTE ON GRANULARITY
--------------------------------------------------------------------------
Paddle returns TEXT-LINE detections, not individual words, so a label like
"MFG. DATE:" usually arrives as one detection. Each detection is fed into
_words_to_lines as if it were a word.

That is deliberate. _words_to_lines gives us row clustering and, crucially,
_split_at_column_gaps - and the two-column rank matcher in
field_extractors depends on columns being split exactly the way that
function splits them. Using Paddle's own grouping instead would silently
bypass logic the test suite covers. Running detections through the same
path means a label and its value stay separate lines when they sit in
separate columns, and merge into one line when they genuinely sit together.

--------------------------------------------------------------------------
NO IMAGE PREPROCESSING
--------------------------------------------------------------------------
The old engine ran multi-variant preprocessing (Otsu binarisation, contrast
stretching, inversion) across several Tesseract passes. All of that existed
to compensate for Tesseract's assumptions and is removed. PaddleOCR does
its own normalisation internally, and hand-binarising in front of it
destroys the greyscale gradients its detector relies on.

--------------------------------------------------------------------------
SETUP
--------------------------------------------------------------------------
    pip install paddlepaddle paddleocr

The first run downloads detection/recognition models (~100-200MB) into
~/.paddleocr. Do this once on a good connection BEFORE any demo.
"""

from dataclasses import dataclass, field
from typing import List, Optional
import re
import os


@dataclass
class OCRLine:
    text: str
    bbox: List[int]          # [x_min, y_min, x_max, y_max] in pixel coords
    confidence: float        # 0.0 - 1.0
    image_index: int         # 1-based, matches architecture doc convention
    words: List[dict] = field(default_factory=list)  # detection-level detail
    # Layout coordinates from _words_to_lines' own clustering, made explicit
    # so downstream code can pair a label with its value by PHYSICAL ROW
    # instead of by list position. row_index counts rows top-to-bottom
    # within one image; column_index counts the column runs
    # _split_at_column_gaps produced within that row, left-to-right.
    # Both stay None for OCRLine objects built by hand or by any caller
    # that does not go through _words_to_lines - consumers must treat None
    # as "no layout information" and fall back to geometry.
    row_index: Optional[int] = None
    column_index: Optional[int] = None


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


def _normalise_ocr_token(text: str) -> str:
    """Normalise harmless OCR differences for duplicate-token comparison."""
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def _merge_words_across_passes(all_words: List[dict]) -> List[dict]:
    """
    Deduplicate overlapping OCR detections.

    PaddleOCR currently supplies one OCR pass, so this normally acts as
    a no-op while preserving the existing word-processing contract.

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
    # Rows are numbered top-to-bottom by their running centre, so row_index
    # is a stable physical coordinate rather than an artefact of the order
    # clusters happened to be created in. The column runs below inherit
    # their row's number, which is what lets a label and the value printed
    # beside it be recognised as the same row later.
    for row_index, ln in enumerate(sorted(lines, key=lambda l: l["centre"])):
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
        for column_index, run in enumerate(_split_at_column_gaps(ordered)):
            line = _line_from_words(run, image_index,
                                    row_index=row_index,
                                    column_index=column_index)
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


# --------------------------------------------------------------------------
# Page orientation
# --------------------------------------------------------------------------
# A pack photographed upside down (a carton held with the straw tab toward
# the camera, a can rolled over to find the code) is not an exotic case -
# the declarations block is printed on whichever panel the filler line
# reached, and the person scanning has no reason to know which way up it is.
#
# PaddleOCR's angle classifier rotates each detected text line's CROP before
# recognition, so the TEXT usually comes back correct. The detection boxes
# do not move: they stay in the photo's frame. On a 180-degree photo that
# leaves every string readable and every coordinate inverted - labels sit to
# the RIGHT of their values and rows run bottom-to-top. _column_bands then
# reads the value column as the label band, _is_known_label rejects it, and
# the whole declaration table is silently dropped. Confidence stays high
# throughout, so nothing downstream can tell this happened.
#
# The frame is corrected here, at the only layer that still has the raw
# geometry, so everything downstream keeps its "labels are on the left,
# reading order is top-to-bottom" assumption unchanged.

_ORIENTATION_LABEL_RE = re.compile(
    r"\b(m\.?r\.?p|usp|mfd|mfg|manufactured|exp|expiry|use\s*by|best\s*before|"
    r"batch|net\s*(?:qty|wt|weight|quantity)|pkd|packed)\b",
    re.IGNORECASE,
)


def _flip_words_180(words: List[dict]) -> List[dict]:
    """Rotates the word geometry 180 degrees about the content's own extent.

    Flipping about the detected content rather than the image frame means
    no image load and no new dependency - every downstream consumer
    (row clustering, column gaps, label->value geometry) is translation
    invariant, so the arbitrary origin costs nothing.
    """
    if not words:
        return words
    width = max(w["bbox"][2] for w in words)
    height = max(w["bbox"][3] for w in words)
    flipped = []
    for w in words:
        x0, y0, x1, y1 = w["bbox"]
        rotated = dict(w)
        rotated["bbox"] = [width - x1, height - y1, width - x0, height - y0]
        flipped.append(rotated)
    return flipped


def _orientation_score(lines: List[OCRLine]) -> float:
    """How much a reading looks like an upright declaration panel.

    Scored on layout, not on text: with the angle classifier doing its job
    both orientations produce the same strings at the same confidence, so
    text quality cannot distinguish them. What does distinguish them is
    that a label is printed to the LEFT of, or ABOVE, the value it
    introduces - never to the right of it, and never below it.
    """
    score = 0.0
    for label in lines:
        if not _ORIENTATION_LABEL_RE.search(label.text):
            continue
        score += 1.0
        height = max(1, label.bbox[3] - label.bbox[1])
        for other in lines:
            if other is label or other.image_index != label.image_index:
                continue
            if _ORIENTATION_LABEL_RE.search(other.text):
                continue
            same_row = (min(other.bbox[3], label.bbox[3])
                        - max(other.bbox[1], label.bbox[1])) > 0
            if same_row and other.bbox[0] >= label.bbox[2]:
                score += 1.0          # value to the right: table layout
                break
            below = other.bbox[1] - label.bbox[3]
            if 0 <= below <= 2 * height:
                score += 0.5          # value underneath: stacked layout
                break
    return score


def _orient(words: List[dict], image_index: int) -> List[OCRLine]:
    """Builds lines from `words`, flipping the frame first if the photo
    reads as upside down. Ties keep the original orientation."""
    upright = _words_to_lines(_merge_words_across_passes(words), image_index)
    flipped_words = _flip_words_180(words)
    flipped = _words_to_lines(_merge_words_across_passes(flipped_words), image_index)
    if _orientation_score(flipped) > _orientation_score(upright):
        return flipped
    return upright


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


def _line_from_words(ordered: List[dict], image_index: int,
                     row_index: Optional[int] = None,
                     column_index: Optional[int] = None) -> Optional[OCRLine]:
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
        row_index=row_index,
        column_index=column_index,
    )



# --------------------------------------------------------------------------
# Dot-matrix / inkjet preprocessing variants
# --------------------------------------------------------------------------
# Coded declarations (MFG/EXP/BATCH/MRP) are inkjet-sprayed as loose dot
# grids onto the base of a can or a foil lid: low contrast, specular glare,
# curvature, and characters made of disconnected dots. A single OCR pass on
# the raw photo reads these at character level roughly, not at all - "28"
# comes back as "2B", "JUL" as "1UL", and the date then fails to parse. No
# regex fixes that, and repairing the digits downstream would be guessing.
#
# The answer is more looks at the same pixels: several cheap preprocessing
# variants, one OCR pass each, then _merge_words_across_passes (which has
# always supported this and has been running on a single pass) keeps the
# reading two passes agree on.
#
# Deliberately NOT done here: morphological opening or aggressive denoise.
# The dots ARE the characters - erosion deletes the text it is meant to
# clean up.

MAX_OCR_PASSES = 4


def _preprocess_variants(image):
    """Yields (name, image) preprocessing variants, cheapest first.

    Returns the original unchanged as variant 0, so the existing
    single-pass behaviour is always still in the result set and a variant
    can only ever ADD readings.
    """
    try:
        import cv2
    except ImportError:
        return [("original", image)]

    variants = [("original", image)]
    if image is None or getattr(image, "ndim", 0) < 2:
        return variants

    grey = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image

    # CLAHE: local contrast, which is what a glare-lit metal base needs -
    # a global threshold that works on the lit half blows out the shadowed
    # half of the same curved surface.
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)).apply(grey)
    variants.append(("clahe", clahe))

    # Upscale: dot-matrix glyphs are small and the recogniser needs the
    # dots to merge into strokes. INTER_CUBIC keeps the dot structure that
    # INTER_NEAREST would alias away.
    variants.append(("clahe_2x", cv2.resize(clahe, None, fx=2.0, fy=2.0,
                                            interpolation=cv2.INTER_CUBIC)))

    # Adaptive threshold on the upscaled image: binarises per-neighbourhood,
    # so it survives the illumination gradient across a cylinder.
    variants.append(("adaptive", cv2.adaptiveThreshold(
        variants[-1][1], 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 31, 10)))

    return variants[:MAX_OCR_PASSES]


def _rescale_words(words: List[dict], scale: float) -> List[dict]:
    """Maps word boxes from an upscaled variant back to original-image
    coordinates, so every pass reports geometry in one frame and
    _merge_words_across_passes can compare boxes across passes at all."""
    if scale == 1.0:
        return words
    rescaled = []
    for w in words:
        scaled = dict(w)
        scaled["bbox"] = [int(round(v / scale)) for v in w["bbox"]]
        rescaled.append(scaled)
    return rescaled


# --------------------------------------------------------------------------
# Backend
# --------------------------------------------------------------------------

class PaddleOCRError(RuntimeError):
    """PaddleOCR could not be initialised or produced no usable result."""


class PaddleOCRBackend:
    """OCR backend backed by PaddleOCR. Swap this class to change engines."""

    def __init__(self, engine=None, lang: str = "en"):
        self._engine = engine if engine is not None else self._build_engine(lang)

    @staticmethod
    def _build_engine(lang: str):
        try:
            os.environ.setdefault("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "0")
            from paddleocr import PaddleOCR
        except ImportError as exc:
            raise PaddleOCRError(
                "paddleocr is not installed. Run: pip install paddlepaddle paddleocr"
            ) from exc

        # PaddleOCR's constructor keywords changed across versions
        # (use_angle_cls was renamed use_textline_orientation in 3.x, and
        # show_log was removed). Try the richest form first and degrade,
        # rather than pinning to a version we cannot verify on every
        # machine. Getting this wrong throws TypeError at startup, which is
        # at least loud - unlike the result-shape problem below.
        attempts = [
            {"use_angle_cls": True, "lang": lang, "show_log": False},
            {"use_angle_cls": True, "lang": lang},
            {"use_textline_orientation": True, "lang": lang},
            {"lang": lang},
        ]
        last_error = None
        for kwargs in attempts:
            try:
                return PaddleOCR(**kwargs)
            except (TypeError, ValueError) as exc:
                last_error = exc
            except Exception as exc:
                raise PaddleOCRError(f"Could not initialise PaddleOCR: {exc}") from exc
        raise PaddleOCRError(
            f"Could not initialise PaddleOCR with any known argument set: {last_error}"
        )

    # ----------------------------------------------------------------
    # Result parsing
    # ----------------------------------------------------------------

    @staticmethod
    def _poly_to_bbox(polygon) -> Optional[List[int]]:
        """Paddle returns a four-point quad, which is NOT axis-aligned when
        text is rotated or the photo skewed. Downstream expects
        [x0, y0, x1, y1], so take the polygon's extent. A slightly loose box
        on rotated text beats dropping the detection - the row/column logic
        only needs roughly where a detection sits and how tall it is.
        """
        try:
            xs = [float(p[0]) for p in polygon]
            ys = [float(p[1]) for p in polygon]
        except (TypeError, IndexError, ValueError):
            return None
        if not xs or not ys:
            return None
        return [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]

    def _detections(self, result):
        """Yields (text, confidence, polygon) across PaddleOCR versions.

        The return shape changed between 2.x and 3.x. Handling only one
        produces an EMPTY SCAN WITH NO ERROR on the other - the worst kind
        of failure to diagnose - so both are supported explicitly.

          2.x:  [[ [poly, (text, score)], ... ]]
          3.x:  [{"rec_texts": [...], "rec_scores": [...], "rec_polys": [...]}]
        """
        if result is None:
            return

        # PaddleOCR 3.x .predict() may return an iterator/generator.
        if not isinstance(result, (list, tuple, dict)):
            try:
                result = list(result)
            except TypeError:
                pass

        if result is None:
            return

        first = result[0] if isinstance(result, (list, tuple)) and result else result

        # PaddleOCR 3.x result objects may expose their data through .json.
        if not isinstance(first, dict):
            try:
                data = first.json
                if callable(data):
                    data = data()

                if isinstance(data, str):
                    import json
                    data = json.loads(data)

                if isinstance(data, dict):
                    first = data
            except (AttributeError, TypeError, ValueError):
                pass

        # PaddleOCR 3.x dictionary result
        if isinstance(first, dict):
            texts = first.get("rec_texts")
            scores = first.get("rec_scores")
            polys = first.get("rec_polys")

            if texts is None:
                texts = []

            if scores is None:
                scores = []

            if polys is None:
                polys = first.get("dt_polys")

            if polys is None:
                polys = []

            for i, text in enumerate(texts):
                if i < len(polys):
                    score = scores[i] if i < len(scores) else 0.9
                    yield text, score, polys[i]
            return

        # PaddleOCR 3.x result object attributes
        texts = getattr(first, "rec_texts", None)

        if texts is not None:
            scores = getattr(first, "rec_scores", None)
            polys = getattr(first, "rec_polys", None)

            if scores is None:
                scores = []

            if polys is None:
                polys = getattr(first, "dt_polys", None)

            if polys is None:
                polys = []

            for i, text in enumerate(texts):
                if i < len(polys):
                    score = scores[i] if i < len(scores) else 0.9
                    yield text, score, polys[i]
            return

        # PaddleOCR 2.x result
        page = first if isinstance(first, (list, tuple)) else result

        for entry in page or []:
            try:
                poly, payload = entry[0], entry[1]
                yield payload[0], payload[1], poly
            except (TypeError, IndexError, KeyError):
                continue

    def _words_from_result(self, result, image_index: int) -> List[dict]:
        words: List[dict] = []
        for text, score, poly in self._detections(result):
            text = (text or "").strip()
            if not text:
                continue
            bbox = self._poly_to_bbox(poly)
            if bbox is None or bbox[2] <= bbox[0] or bbox[3] <= bbox[1]:
                continue  # degenerate box - unusable for layout
            words.append({
                "text": text,
                "bbox": bbox,
                # Paddle scores are already 0.0-1.0, the scale
                # field_extractors' confidence gates expect.
                "confidence": float(score) if score is not None else 0.9,
                "image_index": image_index,
                # Single pass. Kept for shape compatibility with
                # _merge_words_across_passes, which no-ops on one pass.
                "pass_index": 0,
            })
        return words

    # ----------------------------------------------------------------
    # Backend interface
    # ----------------------------------------------------------------

    def _run_engine(self, target):
        """One OCR inference on a path or an ndarray. .ocr(cls=True) is 2.x;
        .predict() is 3.x - same version-tolerance reasoning as
        _build_engine."""
        if hasattr(self._engine, "ocr"):
            try:
                return self._engine.ocr(target, cls=True)
            except TypeError:
                return self._engine.ocr(target)
        if hasattr(self._engine, "predict"):
            return self._engine.predict(target)
        raise PaddleOCRError(
            "PaddleOCR object exposes neither .ocr() nor .predict()"
        )

    def read_image(self, image_path: str, image_index: int) -> List[OCRLine]:
        words = self._words_from_result(
            self._run_engine(image_path), image_index)

        # Extra passes over preprocessing variants, for inkjet/dot-matrix
        # codes the raw pass reads at character level wrongly or not at
        # all. Each variant's words are tagged with their own pass_index
        # and mapped back to original-image coordinates, which is what lets
        # _merge_words_across_passes compare them and keep the reading more
        # than one pass agrees on.
        #
        # Strictly additive: pass 0 is the original image, exactly the
        # single-pass behaviour that shipped before, so a variant can only
        # contribute readings - never remove one.
        for pass_index, (name, variant, scale) in enumerate(
                self._variant_images(image_path), start=1):
            try:
                extra = self._words_from_result(
                    self._run_engine(variant), image_index)
            except Exception:
                continue  # a variant that upsets the engine is skipped, not fatal
            for word in extra:
                word["pass_index"] = pass_index
                word["ocr_variant"] = name
            words.extend(_rescale_words(extra, scale))

        if not words:
            return []
        return _orient(words, image_index)

    @staticmethod
    def _variant_images(image_path: str):
        """(name, image, scale) for each extra preprocessing pass. Empty
        when OpenCV is unavailable or the file cannot be decoded, so the
        pipeline degrades to the original single pass rather than failing."""
        try:
            import cv2
        except ImportError:
            return []
        image = cv2.imread(image_path)
        if image is None:
            return []
        out = []
        for name, variant in _preprocess_variants(image)[1:]:
            scale = variant.shape[0] / image.shape[0]
            out.append((name, variant, scale))
        return out


def run_ocr(image_paths: List[str], backend=None) -> List[OCRLine]:
    """
    Runs OCR over 1-3 images (per the /scan contract) and returns a flat
    list of OCRLine objects across all images, each tagged with its 1-based
    image_index so downstream evidence/bbox can point back to the right
    uploaded image.

    A single PaddleOCRBackend is constructed per call and reused across the
    images: model loading is the expensive part, and building one per image
    would triple a three-image scan's latency.
    """
    if not (1 <= len(image_paths) <= 3):
        raise ValueError("Expected 1 to 3 images per the /scan contract, got "
                         f"{len(image_paths)}")

    backend = backend or PaddleOCRBackend()
    all_lines: List[OCRLine] = []
    for idx, path in enumerate(image_paths, start=1):
        all_lines.extend(backend.read_image(path, idx))
    return all_lines
