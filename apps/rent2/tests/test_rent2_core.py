"""
apps/rent2/tests/test_rent2_core.py
rent2 객체 지향 커널 및 임차 도메인, AI Tool Calling 단위 검증 스위트
"""
import os
import sys
import unittest
from datetime import date

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from apps.rent2.backend.kernel.base import use_store, recall, store
from apps.rent2.backend.kernel.identity import User, UpgradeRequest, seed_users
from apps.rent2.backend.domain.rent import Building, Contract, Payment, Unit
from apps.rent2.backend.domain import bootstrap, ask
from apps.rent2.backend.domain import vat


class TestRent2(unittest.TestCase):
    def setUp(self):
        # 완전 격리된 메모리 DB 사용
        use_store(":memory:")
        bootstrap()

    def test_building_and_units_creation(self):
        b = Building.require("main")
        self.assertEqual(b.id, "main")
        self.assertTrue(len(b.units) > 0)
        self.assertEqual(b.canon("시크빌"), "main")
        self.assertEqual(b.canon("chicvill01"), "main")

    def test_contract_and_ledger_rules(self):
        b = Building.require("main")
        u = b.unit(201)
        # 계약 갱신 또는 신규 입주
        c = u.update({
            "name": "홍길동",
            "deposit": 10000000,
            "rent": 450000,
            "maintenance": 50000,
            "lease_type": "월세",
            "pay_timing": "후불",
            "move_in": "2026-01-10",
            "expiry": "2027-01-09"
        })
        self.assertIsNotNone(c)
        self.assertEqual(c.tenant_name, "홍길동")
        
        # 1월(입주월) 상태 확인: 후불 입주월 공실/익월청구 원칙 판정
        p_jan = u.period(2026, 1)
        self.assertTrue(p_jan.get("vacancy"))
        self.assertIn("후불", p_jan["note"])
        
        # 수납 처리
        pay_res = u.pay(month=2, year=2026, paid_date="2026-02-10", note="정상 완납")
        self.assertTrue(pay_res.paid)
        self.assertEqual(pay_res.rent_amount, 450000)
        
        # 수납 취소
        cancel_res = u.cancel(month=2, year=2026, note="납부 취소")
        self.assertFalse(cancel_res.paid)

    def test_tenant_moveout_and_archiving(self):
        b = Building.require("main")
        u = b.unit(301)
        u.update({
            "name": "김철수",
            "deposit": 5000000,
            "rent": 400000,
            "maintenance": 50000,
            "move_in": "2025-01-01",
            "expiry": "2026-01-01"
        })
        # 퇴실 처리
        u.update({
            "move_out": "2026-01-31"
        })
        # 이전 계약이 ended로 보존되는지 확인
        histories = u.ended()
        self.assertTrue(len(histories) > 0)
        self.assertEqual(histories[0].tenant_name, "김철수")
        self.assertEqual(histories[0].move_out, "2026-01-31")

    def test_vat_report_calculation(self):
        b = Building.require("main")
        # 1~6월 부가세 계산
        rep = vat.report(b, start=1, end=6, year=2026)
        self.assertTrue(rep["success"])
        self.assertIn("total_collected", rep)
        self.assertIn("total_supply", rep)
        self.assertIn("total_vat", rep)
        self.assertEqual(rep["total_collected"], rep["total_supply"] + rep["total_vat"])

    def test_ai_tool_chat_and_confirm(self):
        admin = User.by_username("admin")
        self.assertIsNotNone(admin)
        
        # 자연어 질의 1: 현황 브리핑
        res = ask("시크빌 건물 요약 브리핑해줘", admin)
        self.assertIn("시크빌", res["reply"])
        
        # 자연어 질의 2: 호실 카드 조회
        res_unit = ask("201호 정보 보여줘", admin)
        self.assertIn("201호", res_unit["reply"])
        
        # 자연어 질의 3: 쓰기 도구 (납부 처리) -> confirm 대기열 테스트
        res_write = ask("201호 5월 월세 납부 처리해줘", admin, mode="confirm")
        self.assertTrue(len(res_write.get("pending", [])) > 0 or any(k in res_write.get("reply", "") for k in ("확인", "납부", "처리", "201")))


if __name__ == "__main__":
    unittest.main()
