"""
PackSure — OCR Engine
Person 2 (AI/CV — OCR & Extraction)

Wraps Tesseract OCR and turns its raw word-level output into LINE-level
text blocks, which is the unit field_extractors.py works on. Each line
carries a bounding box (in the original image's pixel coordinates) and a
confidence score, plus the image_index it came from (1-based, per the
architecture doc's multi-image convention).

If an image is internally upscaled or otherwise resized for OCR, bounding
boxes are transformed back to the original uploaded image coordinates
before OCRLine objects are returned.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Sequence, Tuple

import pytesseract
from PIL import Image, ImageEnhance, ImageFilter, ImageOps


def _load_env_file() -> None:
    """Apply KEY=VALUE pairs from the project-root .env without adding a dependency."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.is_file():
        return
    try:
        text = env_path.read_text(encoding="utf-8")
    except OSError:
        return
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


_load_env_file()

# Honour TESSERACT_CMD for both the API (main.py) and CLI (python -m backend.pipeline).
_tesseract_cmd = os.environ.get("TESSERACT_CMD")
if _tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = _tesseract_cmd
elif os.name == "nt":
    for _candidate in (
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ):
        if Path(_candidate).is_file():
            pytesseract.pytesseract.tesseract_cmd = _candidate
            break


@dataclass
class OCRLine:
    text: str
    bbox: List[int]          # [x_min, y_min, x_max, y_max] in original-image pixel coords
    confidence: float        # 0.0 - 1.0
    image_index: int         # 1-based, matches architecture doc convention
    words: List[dict] = field(default_factory=list)  # word-level detail, kept for finer bbox lookups


# Tesseract page-segmentation modes suited to mixed package/label layouts.
# 3 = fully automatic; 4 = single column; 6 = uniform block; 11 = sparse text.
_TESSERACT_CONFIGS = (
    "--oem 3 --psm 3",
    "--oem 3 --psm 4",
    "--oem 3 --psm 6",
    "--oem 3 --psm 11",
)

_MIN_TARGET_SIDE = 1800
_MAX_UPSCALE = 3.0


def _otsu_threshold(histogram: Sequence[int]) -> int:
    """Otsu threshold from a 256-bin grayscale histogram (no numpy)."""
    total = sum(histogram)
    if total <= 0:
        return 128
    sum_total = sum(i * histogram[i] for i in range(256))
    sum_b = 0.0
    w_b = 0
    max_var = -1.0
    threshold = 128
    for i in range(256):
        w_b += histogram[i]
        if w_b == 0:
            continue
        w_f = total - w_b
        if w_f == 0:
            break
        sum_b += i * histogram[i]
        m_b = sum_b / w_b
        m_f = (sum_total - sum_b) / w_f
        var = w_b * w_f * (m_b - m_f) ** 2
        if var > max_var:
            max_var = var
            threshold = i
    return threshold


def _clamp_box(x0: float, y0: float, x1: float, y1: float, orig_w: int, orig_h: int) -> List[int]:
    x0 = max(0, min(orig_w, x0))
    y0 = max(0, min(orig_h, y0))
    x1 = max(0, min(orig_w, x1))
    y1 = max(0, min(orig_h, y1))
    if x1 < x0:
        x0, x1 = x1, x0
    if y1 < y0:
        y0, y1 = y1, y0
    return [int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))]


def _to_original_box(
    x: float, y: float, w: float, h: float, scale_x: float, scale_y: float, orig_w: int, orig_h: int
) -> List[int]:
    sx = scale_x if scale_x else 1.0
    sy = scale_y if scale_y else 1.0
    return _clamp_box(x / sx, y / sy, (x + w) / sx, (y + h) / sy, orig_w, orig_h)


def _prepare_image(image_path: str) -> Tuple[Image.Image, Image.Image, List[Image.Image], float, float, int, int]:
    """
    Load the original image and build OCR variants of equal (possibly upscaled) size.

    Returns (original_rgb, working_rgb, variants, scale_x, scale_y, orig_w, orig_h).
    scale_* maps working-image pixels -> original pixels via division.
    """
    with Image.open(image_path) as raw:
        raw = ImageOps.exif_transpose(raw) or raw
        original = raw.convert("RGB")

    orig_w, orig_h = original.size
    min_side = min(orig_w, orig_h)
    scale = 1.0
    if min_side < _MIN_TARGET_SIDE:
        scale = min(_MAX_UPSCALE, _MIN_TARGET_SIDE / float(min_side))

    if scale != 1.0:
        work = original.resize(
            (max(1, int(round(orig_w * scale))), max(1, int(round(orig_h * scale)))),
            Image.Resampling.LANCZOS,
        )
    else:
        work = original

    gray = work.convert("L")
    contrasted = ImageEnhance.Contrast(gray).enhance(1.8)
    brightened = ImageEnhance.Brightness(contrasted).enhance(1.1)
    sharpened = brightened.filter(ImageFilter.UnsharpMask(radius=1.8, percent=180, threshold=2))

    auto = ImageOps.autocontrast(gray)
    thresh = _otsu_threshold(auto.histogram())
    binary = auto.point(lambda p, t=thresh: 255 if p > t else 0)

    # Light-text-on-dark packaging (inverted binarization).
    inverted = ImageOps.invert(ImageOps.autocontrast(gray))
    inv_thresh = _otsu_threshold(inverted.histogram())
    binary_inv = inverted.point(lambda p, t=inv_thresh: 255 if p > t else 0)

    # Slight dilation helps small/thin pack text survive thresholding.
    thickened = ImageOps.autocontrast(sharpened.filter(ImageFilter.MaxFilter(3)))

    variants = [
        work,
        Image.merge("RGB", (sharpened, sharpened, sharpened)),
        Image.merge("RGB", (binary, binary, binary)),
        Image.merge("RGB", (binary_inv, binary_inv, binary_inv)),
        Image.merge("RGB", (thickened, thickened, thickened)),
    ]
    return original, work, variants, scale, scale, orig_w, orig_h


def _group_words_into_lines(
    ocr_data: dict,
    image_index: int,
    scale_x: float,
    scale_y: float,
    orig_w: int,
    orig_h: int,
) -> List[OCRLine]:
    """
    pytesseract.image_to_data returns one row per detected word. Tesseract
    already assigns each word a (block_num, par_num, line_num) triple, so we
    group by that to reconstruct lines rather than trying to re-derive line
    breaks from y-coordinates ourselves.

    Word/line boxes from the (possibly upscaled) OCR image are mapped back to
    the original uploaded image coordinate system.
    """
    n = len(ocr_data["text"])
    lines = {}

    for i in range(n):
        word = ocr_data["text"][i].strip()
        try:
            conf = int(float(ocr_data["conf"][i]))
        except (TypeError, ValueError):
            continue
        if not word or conf < 0:
            continue  # tesseract uses conf=-1 for non-text regions

        key = (ocr_data["block_num"][i], ocr_data["par_num"][i], ocr_data["line_num"][i])
        box = _to_original_box(
            ocr_data["left"][i],
            ocr_data["top"][i],
            ocr_data["width"][i],
            ocr_data["height"][i],
            scale_x,
            scale_y,
            orig_w,
            orig_h,
        )
        x0, y0, x1, y1 = box

        if key not in lines:
            lines[key] = {"words": [], "confs": [], "x0": x0, "y0": y0, "x1": x1, "y1": y1}

        entry = lines[key]
        entry["words"].append({"text": word, "bbox": box, "confidence": conf / 100.0})
        entry["confs"].append(conf)
        entry["x0"] = min(entry["x0"], x0)
        entry["y0"] = min(entry["y0"], y0)
        entry["x1"] = max(entry["x1"], x1)
        entry["y1"] = max(entry["y1"], y1)

    result = []
    for entry in lines.values():
        text = " ".join(w["text"] for w in entry["words"])
        avg_conf = sum(entry["confs"]) / len(entry["confs"]) / 100.0
        result.append(OCRLine(
            text=text,
            bbox=[entry["x0"], entry["y0"], entry["x1"], entry["y1"]],
            confidence=round(avg_conf, 3),
            image_index=image_index,
            words=entry["words"],
        ))
    return result


def _norm_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def _iou(a: Sequence[int], b: Sequence[int]) -> float:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ix0, iy0 = max(ax0, bx0), max(ay0, by0)
    ix1, iy1 = min(ax1, bx1), min(ay1, by1)
    iw, ih = max(0, ix1 - ix0), max(0, iy1 - iy0)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    area_a = max(0, ax1 - ax0) * max(0, ay1 - ay0)
    area_b = max(0, bx1 - bx0) * max(0, by1 - by0)
    union = area_a + area_b - inter
    return inter / union if union else 0.0


def _is_duplicate(a: OCRLine, b: OCRLine) -> bool:
    if a.image_index != b.image_index:
        return False
    ta, tb = _norm_text(a.text), _norm_text(b.text)
    if not ta or not tb:
        return False
    overlap = _iou(a.bbox, b.bbox)
    if ta == tb and overlap >= 0.25:
        return True
    if overlap >= 0.55 and (ta in tb or tb in ta):
        return True
    if overlap >= 0.8 and (ta[:12] == tb[:12] or abs(len(ta) - len(tb)) <= 2):
        return True
    return False


def _prefer(a: OCRLine, b: OCRLine) -> OCRLine:
    """Keep the more informative of two overlapping OCR hypotheses."""
    ta, tb = a.text.strip(), b.text.strip()
    # Prefer the longer unique reading when confidence is close; otherwise higher confidence.
    if abs(a.confidence - b.confidence) < 0.08:
        if len(ta) != len(tb):
            return a if len(ta) > len(tb) else b
        if len(a.words) != len(b.words):
            return a if len(a.words) > len(b.words) else b
    return a if a.confidence >= b.confidence else b


def _merge_lines(lines: List[OCRLine]) -> List[OCRLine]:
    """Deduplicate multi-pass OCR without concatenating the same text twice."""
    kept: List[OCRLine] = []
    for line in sorted(lines, key=lambda l: (-l.confidence, -len(l.text))):
        text = line.text.strip()
        if not text:
            continue
        dup_idx = next((i for i, existing in enumerate(kept) if _is_duplicate(existing, line)), None)
        if dup_idx is None:
            kept.append(line)
            continue
        kept[dup_idx] = _prefer(kept[dup_idx], line)

    kept.sort(key=lambda l: (l.image_index, l.bbox[1], l.bbox[0]))
    return kept


class PytesseractBackend:
    """Tesseract backend with generalized preprocessing and multi-PSM fusion."""

    def read_image(self, image_path: str, image_index: int) -> List[OCRLine]:
        _original, _work, variants, scale_x, scale_y, orig_w, orig_h = _prepare_image(image_path)
        collected: List[OCRLine] = []
        seen_cfgs = set()

        # Pair variants with complementary PSMs rather than running every combination.
        passes = [
            (variants[0], _TESSERACT_CONFIGS[0]),  # color, auto layout
            (variants[0], _TESSERACT_CONFIGS[2]),  # color, uniform block
            (variants[0], _TESSERACT_CONFIGS[3]),  # color, sparse text
            (variants[1], _TESSERACT_CONFIGS[2]),  # enhanced gray, uniform block
            (variants[1], _TESSERACT_CONFIGS[3]),  # enhanced gray, sparse text
            (variants[2], _TESSERACT_CONFIGS[1]),  # binary, single column
            (variants[3], _TESSERACT_CONFIGS[3]),  # inverted binary, sparse
        ]

        for img, cfg in passes:
            key = (id(img), cfg)
            if key in seen_cfgs:
                continue
            seen_cfgs.add(key)
            ocr_data = pytesseract.image_to_data(
                img,
                output_type=pytesseract.Output.DICT,
                config=cfg,
            )
            collected.extend(
                _group_words_into_lines(ocr_data, image_index, scale_x, scale_y, orig_w, orig_h)
            )

        return _merge_lines(collected)


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
