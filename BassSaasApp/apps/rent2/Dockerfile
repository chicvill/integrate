FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=9016

# 기본 의존성 설치
RUN pip install --no-cache-dir fastapi uvicorn pydantic python-multipart requests httpx pyyaml

# 앱 소스 복사
COPY . /app/apps/rent2
WORKDIR /app

EXPOSE 9016

CMD ["python", "apps/rent2/run.py"]
