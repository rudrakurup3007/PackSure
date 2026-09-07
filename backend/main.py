"""
PackSure FastAPI app — wires existing OCR/extraction + rule engine to the
frontend /scan and /health contracts. No OCR, extraction, or rule logic lives here.
"""

from __future__ import annotations

import os
import tempfile
import uuid
from io import BytesIO
from pathlib import Path
from typing import Any, Optional

import pytesseract
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError
from pytesseract import TesseractError, TesseractNotFoundError
from fastapi.openapi.utils import get_openapi

from backend.pipeline import run_pipeline
from backend.schemas import (
    DeclarationResponseItem,
    ErrorResponse,
    ProductApplicabilityContext,
    ProductInfo,
    ScanResponse,
    StructuredDeclarations,
)
from backend.services.compliance_service import evaluate_compliance

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

# Local Vite frontend (package.json: vite --port=3000)
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

_PDP_FIELD = "principal_display_panel_colocation"

tesseract_cmd = os.environ.get("TESSERACT_CMD")
if tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

app = FastAPI(
    title="PackSure API",
    description="Packaged commodity inspection: OCR extraction + Legal Metrology rules.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _error_response(
    status_code: int,
    code: str,
    message: str,
    details: Optional[dict[str, Any]] = None,
) -> JSONResponse:
    body = ErrorResponse(
        error=code,
        message=message,
        status_code=status_code,
        details=details,
    )
    return JSONResponse(status_code=status_code, content=body.model_dump(mode="json"))


def _is_allowed_image(upload: UploadFile) -> bool:
    name = (upload.filename or "").strip()
    suffix = Path(name).suffix.lower()
    content_type = (upload.content_type or "").lower().split(";")[0].strip()
    if suffix in ALLOWED_EXTENSIONS:
        return True
    if content_type in ALLOWED_CONTENT_TYPES:
        return True
    return False


def _validate_image_bytes(content: bytes) -> Optional[str]:
    if not content:
        return "The uploaded image is empty."
    try:
        with Image.open(BytesIO(content)) as img:
            img.verify()
    except UnidentifiedImageError:
        return "The uploaded image is invalid or corrupted."
    except OSError:
        return "The uploaded image is invalid or corrupted."
    return None


def _declaration_items(declarations: StructuredDeclarations) -> list[DeclarationResponseItem]:
    """Flatten extraction dict → frontend DeclarationItem[] (extracted fields only)."""
    items: list[DeclarationResponseItem] = []
    dumped = declarations.model_dump(mode="json")
    for field_name, evidence in dumped.items():
        if field_name == _PDP_FIELD:
            continue
        if not isinstance(evidence, dict) or evidence.get("value") is None:
            continue
        payload = dict(evidence)
        payload["value"] = str(payload["value"])
        items.append(DeclarationResponseItem(field=field_name, **payload))
    return items


def _product_info(declarations: StructuredDeclarations) -> ProductInfo:
    """Frontend requires product.type and product.name; pipeline does not classify type."""
    common = declarations.common_name
    name = common.value.strip() if common and common.value else "Packaged Commodity"
    return ProductInfo(type="packaged_commodity", name=name)


def _build_scan_response(pipeline_output: dict) -> ScanResponse:
    declarations = StructuredDeclarations.model_validate(pipeline_output["declarations"])
    product_context = ProductApplicabilityContext.model_validate(
        pipeline_output.get("product_context") or {}
    )
    evaluation = evaluate_compliance(declarations, product_context)
    return ScanResponse(
        inspection_id=f"insp_{uuid.uuid4().hex[:8]}",
        product=_product_info(declarations),
        overall_status=evaluation.overall_status,
        score=float(evaluation.score),
        declarations=_declaration_items(declarations),
        violations=evaluation.violations,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "packsure-backend", "version": "1.0.0"}


@app.post("/scan")
async def scan(images: Optional[list[UploadFile]] = File(default=None)):
    uploads = [
        upload for upload in (images or [])
        if (upload.filename and upload.filename.strip()) or upload.content_type
    ]
    if not uploads:
        return _error_response(
            400,
            "MISSING_IMAGES",
            "At least 1 image is required.",
        )
    if len(uploads) > 3:
        return _error_response(
            400,
            "TOO_MANY_IMAGES",
            "A maximum of 3 images is allowed.",
        )

    for upload in uploads:
        if not _is_allowed_image(upload):
            return _error_response(
                400,
                "UNSUPPORTED_FORMAT",
                "Supported image formats are JPG, JPEG, PNG, and WEBP.",
                details={"filename": upload.filename},
            )

    payloads: list[tuple[str, bytes]] = []
    for upload in uploads:
        content = await upload.read()
        invalid = _validate_image_bytes(content)
        if invalid:
            return _error_response(400, "INVALID_IMAGE", invalid, details={"filename": upload.filename})
        suffix = Path(upload.filename or "").suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            suffix = ".jpg"
        payloads.append((suffix, content))

    try:
        with tempfile.TemporaryDirectory(prefix="packsure_scan_") as tmpdir:
            paths: list[str] = []
            for index, (suffix, content) in enumerate(payloads, start=1):
                path = Path(tmpdir) / f"image_{index}{suffix}"
                path.write_bytes(content)
                paths.append(str(path))
            pipeline_output = run_pipeline(paths)
            response = _build_scan_response(pipeline_output)
    except ValueError as exc:
        return _error_response(400, "INVALID_IMAGE", str(exc))
    except ValidationError:
        return _error_response(
            500,
            "EXTRACTION_FAILED",
            "Failed to build a valid inspection result from extracted evidence.",
        )
    except UnidentifiedImageError:
        return _error_response(
            400,
            "INVALID_IMAGE",
            "The uploaded image is invalid or corrupted.",
        )
    except TesseractNotFoundError:
        return _error_response(
            503,
            "OCR_UNAVAILABLE",
            "Tesseract OCR is not installed or not on PATH. Install tesseract-ocr, or set TESSERACT_CMD to the tesseract executable.",
        )
    except TesseractError:
        return _error_response(
            500,
            "OCR_FAILED",
            "OCR failed while reading the uploaded package images.",
        )
    except Exception:
        return _error_response(
            500,
            "INTERNAL_SERVER_ERROR",
            "An unexpected server error occurred.",
        )

    return JSONResponse(content=response.model_dump(mode="json"))

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )

    def fix_file_schema(obj):
        if isinstance(obj, dict):
            # Fix a file schema
            if obj.get("contentMediaType") == "application/octet-stream":
                obj.pop("contentMediaType", None)
                obj["format"] = "binary"

            # Recursively inspect everything, including anyOf
            for value in obj.values():
                fix_file_schema(value)

        elif isinstance(obj, list):
            for item in obj:
                fix_file_schema(item)

    fix_file_schema(schema)

    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi
