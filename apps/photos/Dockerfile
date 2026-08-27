FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy source
COPY backend /app/backend
COPY frontend /app/frontend

# Runtime config
ENV PHOTOS_DIR=/media
ENV CACHE_DIR=/cache
EXPOSE 8000

# Health check (required by Coolify)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/albums')" || exit 1

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
