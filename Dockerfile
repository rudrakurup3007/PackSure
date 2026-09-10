# PackSure Backend — Docker image for Render
# Python 3.11 (PaddlePaddle requires 3.8–3.12)

FROM python:3.11-slim

# System deps: libgomp1 for OpenMP (PaddlePaddle), libgl1 for OpenCV/PaddleOCR image decoding, libglib for Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir \
        "python-multipart>=0.0.9" \
        "uvicorn[standard]>=0.29" \
        "fastapi>=0.110" \
        "pillow>=10.0" \
        "pydantic>=2.0" && \
    python -c "from paddleocr import PaddleOCR; PaddleOCR(lang='en')" || true

# Copy source
COPY backend/ ./backend/
COPY domain_rules/ ./domain_rules/

# Render injects $PORT at runtime (default 10000).
EXPOSE 10000

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
