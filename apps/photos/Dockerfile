FROM python:3.11-slim

WORKDIR /workspace

# Install common dependencies
COPY requirements.txt /workspace/requirements.txt
RUN pip install --no-cache-dir -r /workspace/requirements.txt

# Copy shared modules and photos app
COPY shared /workspace/shared
COPY apps/photos /workspace/apps/photos

ENV PYTHONPATH=/workspace
ENV PHOTOS_DIR=/media
ENV CACHE_DIR=/cache
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/albums')" || exit 1

CMD ["python", "-m", "uvicorn", "apps.photos.backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
