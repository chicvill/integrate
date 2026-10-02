FROM python:3.11-slim

WORKDIR /app

# 시스템 패키지 설치 (psycopg2 빌드, ffmpeg 미디어 인코딩, nodejs JS 런타임 지원)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    ffmpeg \
    nodejs \
    && rm -rf /var/lib/apt/lists/*

# 파이썬 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 전체 애플리케이션 및 빌드된 프론트엔드 에셋 복사
COPY . .

# 환경변수 설정
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# 통합 포털 및 개별 서비스 포트 노출
EXPOSE 10000 8000 8001 8002 8003 8004 8005

# 기본 실행: 통합 게이트웨이 및 포털 (Port 10000)
CMD ["python", "-m", "uvicorn", "gateway.main:app", "--host", "0.0.0.0", "--port", "10000"]
