# PackSure Backend — Docker image for Render
# Python 3.11 (PaddlePaddle requires 3.8–3.12)

FROM python:3.11-slim

# System deps: libGL for PaddleOCR image decoding, libglib for Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir uvicorn[standard] fastapi pillow

# Copy source
COPY backend/ ./backend/
COPY domain_rules/ ./domain_rules/

# Render injects $PORT at runtime (default 10000).
# We expose 10000 for documentation; the CMD reads $PORT dynamically.
EXPOSE 10000

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
