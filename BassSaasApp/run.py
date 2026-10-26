"""
run.py — BassSaasApp 통합 실행 스크립트.

사용법:
    # 1. 통합 SaaS 모드 (포털 + 자동 발견된 모든 마이크로앱 서빙)
    py -3.14 run.py

    # 2. 독립 패키지(Standalone) 모드 (특정 앱 1개만 루트 / 에 단독 서빙)
    py -3.14 run.py --app laundry --port 9050

    # 3. 개발 핫리로드 활성화
    py -3.14 run.py --reload
"""
import argparse
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 현재 디렉터리를 sys.path 맨 앞에 추가하여 모듈 임포트 보장
ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from core.gateway import create_gateway


def main():
    parser = argparse.ArgumentParser(description="BassSaasApp 플랫폼 실행기")
    parser.add_argument("--host", default="0.0.0.0", help="바인딩 호스트 (기본: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "8000")), help="바인딩 포트 (기본: 환경변수 PORT 또는 8000)")
    parser.add_argument("--app", default=None, help="독립 실행할 단일 앱 ID (예: laundry)")
    parser.add_argument("--reload", action="store_true", help="코드 변경 시 자동 재시작")
    args = parser.parse_args()

    standalone = bool(args.app)
    only_apps = [args.app] if args.app else None

    print("=" * 60)
    print("🚀 BassSaasApp 멀티 테넌트 SaaS 플랫폼 가동")
    print(f"• 실행 모드 : {'[단독 Standalone 모드]' if standalone else '[통합 SaaS 게이트웨이 모드]'}")
    if standalone:
        print(f"• 서비스 앱 : {args.app} (루트 / 에서 서빙)")
    print(f"• 접속 주소 : http://localhost:{args.port}/")
    print(f"• API 문서  : http://localhost:{args.port}/docs")
    print("=" * 60)

    app = create_gateway(
        apps_root=os.path.join(ROOT, "apps"),
        db_path=os.path.join(ROOT, "data", "platform.db"),
        only=only_apps,
        standalone=standalone
    )

    import uvicorn
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
