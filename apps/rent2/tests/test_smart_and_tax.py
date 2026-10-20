"""
tests/test_smart_and_tax.py
rent2의 스마트 인제스트(입금 문자 파싱) 및 세무 집계(부가세/종합소득세) 단위 테스트
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
from apps.rent2.backend.domain.rent import Building, Expense
from apps.rent2.backend.domain.parser import parse_bank_message, parse_batch_bank_messages
from apps.rent2.backend.domain.vat import income_tax_report, income_tax_csv_bytes, income_tax_excel_bytes


class TestSmartAndTax(unittest.TestCase):
    def setUp(self):
        use_store(":memory:")
        bootstrap()
        self.b = Building.require("main")
        # 201호에 세입자 홍길동 계약 등록
        u = self.b.unit(201)
        u.update({
            "name": "홍길동",
            "deposit": 10000000,
            "rent": 450000,
            "maintenance": 50000,
            "pay_timing": "후불",
            "move_in": "2026-01-01",
            "expiry": "2027-01-01"
        })

    def test_bank_message_parser(self):
        # 1. 국민은행 문자 형태
        msg1 = "[KB] 05/10 14:20 201호 홍길동 500,000원 입금 잔액 15,000,000"
        res1 = parse_bank_message(msg1, "main")
        self.assertTrue(res1["success"])
        self.assertEqual(res1["room_number"], 201)
        self.assertEqual(res1["amount"], 500000)
        self.assertEqual(res1["target_month"], 5)
        self.assertEqual(res1["detected_tenant"], "홍길동")

        # 2. 신한/카카오뱅크 간단 형태 (만원 단위 표기)
        msg2 = "302호 45만원 입금완료 06/15"
        res2 = parse_bank_message(msg2, "main")
        self.assertTrue(res2["success"])
        self.assertEqual(res2["room_number"], 302)
        self.assertEqual(res2["amount"], 450000)
        self.assertEqual(res2["target_month"], 6)

    def test_income_tax_report_and_exports(self):
        # 지출 전표 2건 등록 (세금계산서, 간이영수증)
        Expense(building_id="main", date="2026-03-10", item="201호 도배 및 장판", amount=350000,
                receipt_type="세금계산서", note="도배 수리").save()
        Expense(building_id="main", date="2026-04-12", item="형광등 소모품 구입", amount=25000,
                receipt_type="간이영수증", note="철물점").save()

        # 201호 2월, 3월 월세 수납 처리
        u = self.b.unit(201)
        u.pay(2, 2026, "2026-02-10", note="2월분 완납", rent_amount=450000)
        u.pay(3, 2026, "2026-03-10", note="3월분 완납", rent_amount=450000)

        # 종합소득세 집계
        rep = income_tax_report(self.b, year=2026)
        self.assertTrue(rep["success"])
        self.assertGreaterEqual(rep["total_rent_income"], 900000)
        self.assertEqual(rep["total_expense"], 375000)
        self.assertEqual(rep["by_receipt"]["세금계산서"], 350000)
        self.assertEqual(rep["by_receipt"]["간이영수증"], 25000)
        self.assertEqual(rep["by_category"]["수선유지비"], 350000)
        self.assertEqual(rep["by_category"]["소모품비"], 25000)

        # 엑셀 및 CSV 바이트 정상 생성 검증
        csv_b = income_tax_csv_bytes(rep)
        excel_b = income_tax_excel_bytes(rep)
        self.assertTrue(len(csv_b) > 0)
        self.assertTrue(len(excel_b) > 0)
        self.assertIn("종합소득세".encode("utf-8"), excel_b)


if __name__ == "__main__":
    unittest.main()
