"""
tests/test_payment_rules.py
사용자 요구사항 단위 테스트:
1. 2026.10 완납 상태에서 중복 입금 시 오류 메시지로 안내 (중복 수납 차단)
2. 금액은 계약내용의 임차료와 관리비를 참조하여 분리 저장
3. 계약내용과 합계(송금)액이 틀린 경우 불일치 감지 및 차액 안내
"""
import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from apps.rent2.backend.kernel.base import use_store
from apps.rent2.backend.kernel.identity import User
from apps.rent2.backend.domain import bootstrap
from apps.rent2.backend.domain.rent import Building, Contract, Unit
from apps.rent2.backend.domain.parser import parse_bank_message
from apps.rent2.backend.routers.smart import smart_paste_payment
from apps.rent2.backend.routers.rooms import pay


class TestPaymentRules(unittest.TestCase):
    def setUp(self):
        use_store(":memory:")
        bootstrap()
        self.b = Building.require("main")
        self.admin = User(username="admin", role="superadmin", branch="main")

        # 402호: 임차인 김정두 (월세 290,000원, 관리비 150,000원, 합계 440,000원)
        u402 = self.b.unit(402)
        u402.update({
            "name": "김정두",
            "deposit": 5000000,
            "rent": 290000,
            "maintenance": 150000,
            "pay_timing": "후불",
            "move_in": "2025-12-19",
            "expiry": "2026-12-18",
            "phone": "010-3132-2713"
        })

    def test_split_rent_and_maintenance(self):
        """요구사항 2: 금액은 계약내용의 임차료와 관리비를 참조하여 분리 저장"""
        u = self.b.unit(402)
        # 계약 총액 440,000원 송금 시
        s_rent, s_maint, is_mismatch, c_tot = u.split_payment_amount(440000, 2026, 1)
        self.assertEqual(s_rent, 290000)
        self.assertEqual(s_maint, 150000)
        self.assertFalse(is_mismatch)
        self.assertEqual(c_tot, 440000)

        # 1월분 수납 처리 시 임차료/관리비가 정확히 분리 저장되는지 검증
        p = u.pay(1, 2026, rent_amount=440000)  # 총액만 넘어왔을 때
        self.assertEqual(p.rent_amount, 290000)
        self.assertEqual(p.maintenance_amount, 150000)

    def test_amount_mismatch_detection(self):
        """요구사항 3: 계약내용과 합계(송금)액이 틀린 경우 불일치 감지 및 차액 확인"""
        u = self.b.unit(402)
        # 계약 총액은 440,000원인데 400,000원만 송금된 경우
        s_rent, s_maint, is_mismatch, c_tot = u.split_payment_amount(400000, 2026, 2)
        self.assertTrue(is_mismatch)
        self.assertEqual(c_tot, 440000)
        self.assertEqual(s_rent, 290000)
        self.assertEqual(s_maint, 110000)

        # 파서에서도 불일치가 감지되는지 검증
        msg = "[입금] 402호 김정두 400,000원"
        parsed = parse_bank_message(msg, "main")
        self.assertTrue(parsed["success"])
        self.assertEqual(parsed["room_number"], 402)
        self.assertEqual(parsed["amount"], 400000)
        self.assertTrue(parsed["amount_mismatch"])
        self.assertEqual(parsed["expected_total"], 440000)
        self.assertEqual(parsed["diff"], -40000)

    def test_duplicate_payment_prevention_when_fully_paid(self):
        """요구사항 1: 2026.10 완납 상태에서 중복 입금 시 오류 메시지로 안내"""
        u = self.b.unit(402)

        # 2026년 1월부터 10월까지 완납 상태로 설정
        for m in range(1, 11):
            u.pay(m, 2026, paid_date=f"2026-{m:02d}-10")

        # 미납월이 0개인지 확인
        unpaids = u.unpaid_periods()
        self.assertEqual(len(unpaids), 0)
        self.assertTrue(u.period(2026, 10)["paid"])

        # 1) 문자 스마트 수납 시도 시 중복 입금 오류로 차단되는지 검증
        sms = "[KB] 10/26 402호 김정두 440,000원 입금"
        res = smart_paste_payment({"text": sms, "branch_id": "main", "auto_apply": True}, self.admin)
        self.assertFalse(res["success"])
        self.assertEqual(res["applied_count"], 0)
        self.assertIn("중복 입금 오류", res["message"])
        self.assertIn("완납", res["message"])

        # 2) pay API 직접 호출 시 400 오류 발생하는지 검증
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as ctx:
            pay(402, {"month": 10, "year": 2026, "amount": 440000}, branch_id="main", user=self.admin)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("중복 입금 오류", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()
