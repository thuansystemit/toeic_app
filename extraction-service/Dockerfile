FROM python:3.12-slim

WORKDIR /app

# System deps for pdfplumber (pdfminer) are pure-python; nothing extra needed.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# The service is a worker — it consumes jobs from Redis, not an HTTP server.
CMD ["python", "-m", "app.worker"]
