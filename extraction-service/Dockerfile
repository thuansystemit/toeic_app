FROM python:3.12-slim

WORKDIR /app

# Tesseract is the OCR engine used (via pytesseract) for scanned/image PDFs.
# pdfplumber/pdfminer and PyMuPDF are pure-python wheels and need nothing extra.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# The service is a worker — it consumes jobs from Redis, not an HTTP server.
CMD ["python", "-m", "app.worker"]
