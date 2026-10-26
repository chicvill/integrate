"""
scripts/create_app.py — 신규 마이크로 SaaS 앱 1초 원클릭 스캐폴더 CLI.

사용법:
    py -3.14 scripts/create_app.py --id petcare --name "스마트 애견호텔" --icon "🐶" --category business
"""
import argparse
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from core.scaffold import create_app


def main():
    parser = argparse.ArgumentParser(description="신규 마이크로 SaaS 앱 1초 스캐폴더")
    parser.add_argument("--id", required=True, help="앱 고유 영문 ID (예: petcare)")
    parser.add_argument("--name", required=True, help="앱 표시 이름 (예: '스마트 애견호텔')")
    parser.add_argument("--icon", default="📦", help="아이콘 이모지 (기본: 📦)")
    parser.add_argument("--category", default="business", choices=["business", "education", "iot", "media", "utility", "ai"], help="카테고리")
    parser.add_argument("--desc", default="", help="앱 설명")
    args = parser.parse_args()

    create_app(args.id, args.name, args.icon, args.category, args.desc)


if __name__ == "__main__":
    main()
