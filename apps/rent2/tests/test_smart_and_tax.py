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

        # 3. 계좌번호가 포함된 농협 문자 (계좌 앞자리 302가 아닌 세입자 홍길동 201호 매칭)
        msg3 = "[농협] 10/24 16:30 302-1234-5678-91 홍길동 입금 500,000 잔액 1,234,000"
        res3 = parse_bank_message(msg3, "main")
        self.assertTrue(res3["success"])
        self.assertEqual(res3["room_number"], 201)
        self.assertEqual(res3["amount"], 500000)
        self.assertEqual(res3["detected_tenant"], "홍길동")

        # 4. 계좌번호 123-45-678901가 포함된 국민은행 문자 (123호나 678901원 오인 방지)
        msg4 = "[KB] 10/24 16:30 123-45-678901 홍길동 입금 500,000"
        res4 = parse_bank_message(msg4, "main")
        self.assertTrue(res4["success"])
        self.assertEqual(res4["room_number"], 201)
        self.assertEqual(res4["amount"], 500000)

        # 5. 호실 번호 없이 송금자 이름만 있는 토스/카카오톡 입금 문자
        msg5 = "[토스] 홍길동님이 500,000원을 보냈습니다"
        res5 = parse_bank_message(msg5, "main")
        self.assertTrue(res5["success"])
        self.assertEqual(res5["room_number"], 201)
        self.assertEqual(res5["amount"], 500000)

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

    def test_reset_and_import_chicvill(self):
        """시크빌 1호점(본점) 일괄 등록 및 가짜/임시 호실 초기화(reset_and_import) 정상 동작 검증"""
        rows = [
            {"room_number": 201, "name": "김진우", "deposit": 5000000, "rent": 350000, "maintenance": 50000, "move_in": "2026-01-01", "expiry": "2027-01-01"},
            {"room_number": 202, "name": "안문철", "deposit": 10000000, "rent": 400000, "maintenance": 50000, "move_in": "2026-02-01", "expiry": "2027-02-01"},
            {"room_number": 301, "name": "김정두", "deposit": 5000000, "rent": 350000, "maintenance": 50000, "move_in": "2026-03-01", "expiry": "2027-03-01"}
        ]
        res = self.b.reset_and_import(rows, clear_existing=True)
        self.assertTrue(res["success"])
        self.assertEqual(res["imported_count"], 3)
        self.assertEqual(len(self.b.units), 29)  # Chicvill 29개 표준 호실 보존
        c201 = self.b.unit(201).active()
        self.assertIsNotNone(c201)
        assert c201 is not None
        self.assertEqual(c201.tenant_name, "김진우")
        c202 = self.b.unit(202).active()
        self.assertIsNotNone(c202)
        assert c202 is not None
        self.assertEqual(c202.tenant_name, "안문철")
        c301 = self.b.unit(301).active()
        self.assertIsNotNone(c301)
        assert c301 is not None
        self.assertEqual(c301.tenant_name, "김정두")

    def test_universal_ingest_contract_roster(self):
        """스마트 만능 붙여넣기 계약 대장 등록 검증"""
        from fastapi.testclient import TestClient
        from apps.rent2.backend.main import create_app
        app = create_app(":memory:")
        client = TestClient(app)
        admin = User.create("super_admin_test", "1212", role="superadmin", status="APPROVED")
        token = admin.token()

        roster_text = "호실\t세입자\t보증금\t월세\t관리비\n201\t김진우\t500만\t35만\t5만\n202\t안문철\t1000만\t40만\t5만"
        res = client.post("/api/smart/universal-ingest", json={"text": roster_text, "branch_id": "main", "clear_before_import": True}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["applied_count"], 2)

    def test_smart_paste_payment_clear_error_message(self):
        """호실 미지정 또는 미등록 호실 시 0호 대신 명확하고 친절한 안내 메시지 검증"""
        from fastapi.testclient import TestClient
        from apps.rent2.backend.main import create_app
        app = create_app(":memory:")
        client = TestClient(app)
        admin = User.create("super_admin_test2", "1212", role="superadmin", status="APPROVED")
        token = admin.token()

        # 알 수 없는 문자 입력 시
        res = client.post("/api/smart/paste-payment", json={"text": "임의의 메모 50,000원 입금", "branch_id": "main"}, headers={"Authorization": f"Bearer {token}"})
        body = res.json()
        self.assertFalse(body["success"])
        self.assertNotIn("0호", body.get("message", ""))


if __name__ == "__main__":
    unittest.main()
