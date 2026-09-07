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
"""

from dataclasses import dataclass, field
from typing import List

import pytesseract
from PIL import Image


@dataclass
class OCRLine:
    text: str
    bbox: List[int]          # [x_min, y_min, x_max, y_max] in pixel coords
    confidence: float        # 0.0 - 1.0
    image_index: int         # 1-based, matches architecture doc convention
    words: List[dict] = field(default_factory=list)  # word-level detail, kept for finer bbox lookups


def _group_words_into_lines(ocr_data: dict, image_index: int) -> List[OCRLine]:
    """
    pytesseract.image_to_data returns one row per detected word. Tesseract
    already assigns each word a (block_num, par_num, line_num) triple, so we
    group by that to reconstruct lines rather than trying to re-derive line
    breaks from y-coordinates ourselves.
    """
    n = len(ocr_data["text"])
    lines = {}

    for i in range(n):
        word = ocr_data["text"][i].strip()
        conf = int(ocr_data["conf"][i])
        if not word or conf < 0:
            continue  # tesseract uses conf=-1 for non-text regions

        key = (ocr_data["block_num"][i], ocr_data["par_num"][i], ocr_data["line_num"][i])
        x, y, w, h = (ocr_data["left"][i], ocr_data["top"][i],
                      ocr_data["width"][i], ocr_data["height"][i])

        if key not in lines:
            lines[key] = {"words": [], "confs": [], "x0": x, "y0": y, "x1": x + w, "y1": y + h}

        entry = lines[key]
        entry["words"].append({"text": word, "bbox": [x, y, x + w, y + h], "confidence": conf / 100.0})
        entry["confs"].append(conf)
        entry["x0"] = min(entry["x0"], x)
        entry["y0"] = min(entry["y0"], y)
        entry["x1"] = max(entry["x1"], x + w)
        entry["y1"] = max(entry["y1"], y + h)

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


class PytesseractBackend:
    """Thin OCR backend. Swap this class out to change OCR engines."""

    def read_image(self, image_path: str, image_index: int) -> List[OCRLine]:
        img = Image.open(image_path).convert("RGB")
        ocr_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
        return _group_words_into_lines(ocr_data, image_index)


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
