#!/bin/bash
set -e

echo "======================================================="
echo "  [StudyCafe & SelfStudy] Xubuntu Auto-Deploy Process"
echo "======================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STUDYCAFE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SELFSTUDY_DIR="$(cd "$STUDYCAFE_DIR/../selfstudy" && pwd)"

echo ""
echo "[1/4] Syncing StudyCafe → $STUDYCAFE_DIR"
echo "  Current branch: $(git -C "$STUDYCAFE_DIR" branch --show-current)"

echo ""
echo "[2/4] Syncing SelfStudy → $SELFSTUDY_DIR"
if [ -d "$SELFSTUDY_DIR" ]; then
    echo "  SelfStudy directory found."
else
    echo "  ERROR: SelfStudy directory not found at $SELFSTUDY_DIR"
    exit 1
fi

echo ""
echo "[3/4] Syncing .env file..."
ROOT_ENV="$STUDYCAFE_DIR/../.env"
if [ -f "$ROOT_ENV" ]; then
    echo "  Copying root .env → studycafe/.env"
    cp -f "$ROOT_ENV" "$STUDYCAFE_DIR/.env"
else
    echo "  No root .env found, using existing studycafe/.env"
fi

echo ""
echo "[4/4] Rebuilding Docker Stack..."
echo "  StudyCafe: http://localhost:8001"
echo "  SelfStudy: http://localhost:8005"
cd "$STUDYCAFE_DIR"
docker compose down
docker compose up -d --build

echo ""
echo "======================================================="
echo "  Container Status:"
echo "======================================================="
docker compose ps

echo ""
echo "======================================================="
echo "  [SUCCESS] Deploy Completed! $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================="
