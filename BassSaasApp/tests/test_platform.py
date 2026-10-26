"""
tests/test_platform.py — BassSaasApp 플랫폼 핵심 기능 종합 검증 스위트.

검증 항목:
  1. Kernel Obj 스키마리스 문서 스토어 & 이력 로깅
  2. BaseSaaSApp 규격 검증 및 메타데이터 추출
  3. SaaSAppManager 자동 발견(Auto-Discovery) & 결함 격리(Sandbox)
  4. Laundry 도메인 비즈니스 규칙 (상태 전이, 금액 불일치 diff 계산, 시간 경과 sync)
  5. 공통 인증 & 기본 관리자 시드 1회 캐싱
  6. create_app.py 스캐폴딩 생성 & 자동 마운트
"""
import importlib
import os
import shutil
import sys
import unittest
from datetime import datetime, timedelta

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from fastapi.testclient import TestClient
from core.kernel import Obj, use_store, store
from core.errors import DomainError, Conflict, Mismatch, NotFound
from core.app_base import BaseSaaSApp, AppDefinitionError
from core.auth import User, issue_token, verify_token, ensure_default_admins
from core.gateway import create_gateway
from core.scaffold import create_app

# 동적 로딩으로 상위 워크스페이스 apps 패키지와의 네임스페이스 충돌 방지
laundry_domain = importlib.import_module("apps.laundry.backend.domain")
Machine = laundry_domain.Machine
Payment = laundry_domain.Payment
clock = laundry_domain.clock


class TestKernelObj(unittest.TestCase):
    def setUp(self):
        use_store(":memory:")

    def test_save_and_find_without_migrations(self):
        class Sample(Obj):
            namespace = "test"
            name: str
            age: int
            extra_feature: str = "default"

        s1 = Sample(name="홍길동", age=30, custom_field="새 필드 자유 추가").save("created")
        self.assertIsNotNone(s1.id)
        loaded = Sample.get(s1.id)
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.name, "홍길동")
        self.assertEqual(getattr(loaded, "custom_field", None), "새 필드 자유 추가")

        hist = store().history("test.sample")
        self.assertGreaterEqual(len(hist), 1)
        self.assertEqual(hist[0]["action"], "created")


class TestBaseSaaSApp(unittest.TestCase):
    def test_validation_rejects_bad_app_id(self):
        from fastapi import APIRouter

        class BadApp(BaseSaaSApp):
            app_id = "12_invalid!"
            app_name = "잘못된 앱"
            def get_router(self): return APIRouter()

        with self.assertRaises(AppDefinitionError):
            BadApp()

    def test_validation_rejects_reserved_id(self):
        from fastapi import APIRouter

        class ReservedApp(BaseSaaSApp):
            app_id = "auth"
            app_name = "예약어 앱"
            def get_router(self): return APIRouter()

        with self.assertRaises(AppDefinitionError):
            ReservedApp()


class TestLaundryDomain(unittest.TestCase):
    def setUp(self):
        use_store(":memory:")
        laundry_domain.seed()

    def test_exact_payment_and_state_transition(self):
        m = Machine.by_no("W-01")
        self.assertEqual(m.status, "IDLE")

        # 1. 요금 불일치 시 Mismatch 예외 발생 (차액 계산 검증)
        with self.assertRaises(Mismatch) as cm:
            m.start("standard", paid=3000)   # 표준 세탁은 4000원
        self.assertIn("1,000원 부족", cm.exception.message)

        # 2. 정확한 요금 결제 시 정상 가동
        payment = m.start("standard", paid=4000, phone="010-1234-5678")
        self.assertEqual(m.status, "RUNNING")
        self.assertEqual(payment.amount, 4000)
        self.assertGreater(m.remaining_minutes, 0)

        # 3. 가동 중 중복 시작 시 Conflict 발생
        with self.assertRaises(Conflict):
            m.start("standard", paid=4000)

        # 4. 시간 경과 시뮬레이션: 완료 시각을 과거로 이동 후 sync
        m.ends_at = (datetime.now() - timedelta(minutes=1)).isoformat()
        m.sync()
        self.assertEqual(m.status, "DONE")

        # 5. 수거 완료
        m.collect()
        self.assertEqual(m.status, "IDLE")


class TestGatewayAndFaultIsolation(unittest.TestCase):
    def setUp(self):
        self.test_apps_dir = os.path.join(ROOT, "tests", "scratch_apps")
        os.makedirs(self.test_apps_dir, exist_ok=True)
        # 정상 앱 복사
        shutil.copytree(os.path.join(ROOT, "apps", "laundry"),
                        os.path.join(self.test_apps_dir, "laundry"), dirs_exist_ok=True)
        # 고장난 앱 생성 (문법/런타임 에러 고의 유발)
        broken_dir = os.path.join(self.test_apps_dir, "broken")
        os.makedirs(broken_dir, exist_ok=True)
        with open(os.path.join(broken_dir, "app.py"), "w", encoding="utf-8") as f:
            f.write("raise RuntimeError('고의로 유발한 로드 실패')\n")

    def tearDown(self):
        if os.path.exists(self.test_apps_dir):
            shutil.rmtree(self.test_apps_dir, ignore_errors=True)

    def test_fault_isolation_sandbox(self):
        app = create_gateway(apps_root=self.test_apps_dir, db_path=":memory:")
        client = TestClient(app)

        # 1. 정상 앱 laundry는 100% 정상 작동
        res = client.get("/api/laundry/status")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["success"])

        # 2. 고장난 앱 broken은 게이트웨이를 죽이지 않고 안전 격리(503 응답)
        res_broken = client.get("/api/broken")
        self.assertEqual(res_broken.status_code, 503)
        self.assertFalse(res_broken.json()["success"])
        self.assertEqual(res_broken.json()["stage"], "import")

        # 3. 플랫폼 카탈로그 조회 시 정상 앱과 격리된 앱이 명확히 분류됨
        catalog = client.get("/api/apps").json()
        self.assertIn("laundry", [a["app_id"] for a in catalog["apps"]])
        self.assertIn("broken", [f["folder"] for f in catalog["failed"]])


class TestScaffoldCLI(unittest.TestCase):
    def test_create_app_generation(self):
        temp_app_id = "testpet"
        temp_dir = os.path.join(ROOT, "apps", temp_app_id)
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

        try:
            create_app(temp_app_id, "테스트 펫", "🐶", "business", "테스트용 설명")
            self.assertTrue(os.path.exists(os.path.join(temp_dir, "app.py")))
            self.assertTrue(os.path.exists(os.path.join(temp_dir, "frontend", "manual.html")))

            # 게이트웨이 로더가 새 앱을 즉시 인식하는지 검증
            app = create_gateway(db_path=":memory:")
            client = TestClient(app)
            res = client.get(f"/api/{temp_app_id}/status")
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["app_id"], temp_app_id)
        finally:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)


class TestRent2Migration(unittest.TestCase):
    def test_rent2_auto_mounted_and_authenticated(self):
        app = create_gateway(db_path=":memory:")
        client = TestClient(app)

        # 1. 포털 카탈로그에 rent2가 자동으로 노출되는지 검증
        catalog = client.get("/api/apps").json()
        app_ids = [a["app_id"] for a in catalog["apps"]]
        self.assertIn("rent2", app_ids)

        # 2. 미인증 시 401 차단 검증
        unauth_res = client.get("/api/rent2/status")
        self.assertEqual(unauth_res.status_code, 401)

        # 3. 플랫폼 관리자 로그인 후 정상 200 반환 및 방 29개 로드 검증
        login_res = client.post("/auth/login", json={"username": "admin", "password": "1212"}).json()
        token = login_res["token"]
        auth_res = client.get("/api/rent2/status", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(auth_res.status_code, 200)
        self.assertEqual(auth_res.json()["app_id"], "rent2")
        self.assertEqual(auth_res.json()["total_rooms"], 29)


if __name__ == "__main__":
    unittest.main()
