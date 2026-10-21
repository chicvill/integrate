"""
tests/test_unpaid_range_and_fifo.py — 호실별 미납 현황 판정 범위, FIFO 수납, LIFO 취소 검증
"""
import unittest
from datetime import date
from apps.rent2.backend.kernel.base import use_store
from apps.rent2.backend.domain.rent import Building, Contract, Unit


class TestUnpaidRangeAndFIFO(unittest.TestCase):
    def setUp(self):
        use_store(":memory:")
        self.b = Building(id="test_b", name="테스트 건물", units=[101, 102]).save()

    def test_postpaid_billable_range(self):
        """후불 계약: 입주월+1부터 당월/전출월까지 판정"""
        c = Contract(
            building_id="test_b",
            unit=101,
            tenant_name="김후불",
            lease_type="월세",
            pay_timing="후불",
            rent=300000,
            maintenance=50000,
            move_in="2026-01-15",
            move_out=""
        ).save()

        u = self.b.unit(101)
        s_idx, e_idx = u.billable_bounds()
        # 2026년 1월 입주, 후불이므로 2026년 2월부터 시작
        self.assertEqual(s_idx, 2026 * 12 + 2)
        # 입주월(2026-01)은 미납 판정 대상이 아님
        self.assertFalse(u.is_billable_period(2026, 1))
        # 2026-02는 미납 판정 대상임
        self.assertTrue(u.is_billable_period(2026, 2))

    def test_prepaid_billable_range(self):
        """선불 계약: 입주월부터 즉시 청구 판정"""
        c = Contract(
            building_id="test_b",
            unit=102,
            tenant_name="이선불",
            lease_type="월세",
            pay_timing="선불",
            rent=350000,
            maintenance=50000,
            move_in="2026-03-01",
            move_out=""
        ).save()

        u = self.b.unit(102)
        s_idx, e_idx = u.billable_bounds()
        # 선불이므로 2026년 3월부터 즉시 시작
        self.assertEqual(s_idx, 2026 * 12 + 3)
        self.assertTrue(u.is_billable_period(2026, 3))
        self.assertFalse(u.is_billable_period(2026, 2))

    def test_move_out_billable_range(self):
        """퇴실자: 전출월까지만 청구 판정, 전출월 이후는 제외"""
        c = Contract(
            building_id="test_b",
            unit=101,
            tenant_name="박퇴실",
            lease_type="월세",
            pay_timing="선불",
            rent=300000,
            maintenance=50000,
            move_in="2026-01-01",
            move_out="2026-05-20"
        ).save()

        u = self.b.unit(101)
        s_idx, e_idx = u.billable_bounds()
        self.assertEqual(s_idx, 2026 * 12 + 1)
        self.assertEqual(e_idx, 2026 * 12 + 5)
        self.assertTrue(u.is_billable_period(2026, 5))
        self.assertFalse(u.is_billable_period(2026, 6))

    def test_no_move_out_limited_to_current_month(self):
        """전출월이 정해지지 않은 경우: 현재월까지로 엄격히 한정 (미래월은 미납 대상 제외)"""
        c = Contract(
            building_id="test_b",
            unit=101,
            tenant_name="김거주",
            lease_type="월세",
            pay_timing="선불",
            rent=300000,
            maintenance=50000,
            move_in="2026-01-01",
            expiry="2027-12-31",  # 만기일은 내년 말
            move_out=""           # 전출월 미정
        ).save()

        u = self.b.unit(101)
        s_idx, e_idx = u.billable_bounds()
        # 종료월은 만기일(2027년)이 아니라 반드시 현재월(2026-10)로 한정되어야 함
        self.assertEqual(e_idx, 2026 * 12 + 10)
        self.assertTrue(u.is_billable_period(2026, 10))
        # 미래월(11월, 12월)은 청구/미납 판정 범위에서 제외
        self.assertFalse(u.is_billable_period(2026, 11))
        self.assertFalse(u.is_billable_period(2026, 12))

        # 미래월의 상태는 미납이 아니라 '청구 예정'이어야 함
        nov_info = u.period(2026, 11)
        self.assertTrue(nov_info["is_future"])
        self.assertEqual(nov_info["note"], "청구 예정 (미도래)")

    def test_fifo_payment_allocation(self):
        """입금 시 미납월 중 가장 오래된 월부터 FIFO 우선 충당"""
        c = Contract(
            building_id="test_b",
            unit=101,
            tenant_name="홍길동",
            lease_type="월세",
            pay_timing="선불",
            rent=300000,
            maintenance=50000,
            move_in="2026-01-01"
        ).save()

        u = self.b.unit(101)
        # 7월, 8월을 미납(취소) 상태로 생성
        u.cancel(7, 2026, note="납부 취소")
        u.cancel(8, 2026, note="납부 취소")

        unpaids = u.unpaid_periods()
        self.assertIn((2026, 7), unpaids)
        self.assertIn((2026, 8), unpaids)
        self.assertEqual(unpaids[0], (2026, 7))  # 가장 오래된 미납은 7월

        # 1차 입금: 7월에 우선 적용되어야 함
        p1, y1, m1, oldest1 = u.pay_fifo(fallback_month=10, fallback_year=2026)
        self.assertEqual((y1, m1), (2026, 7))
        self.assertTrue(oldest1)
        self.assertTrue(u.period(2026, 7)["paid"])

        # 2차 입금: 그 다음 오래된 8월에 적용되어야 함
        p2, y2, m2, oldest2 = u.pay_fifo(fallback_month=10, fallback_year=2026)
        self.assertEqual((y2, m2), (2026, 8))
        self.assertTrue(oldest2)
        self.assertTrue(u.period(2026, 8)["paid"])

    def test_lifo_cancellation(self):
        """취소 시 가장 최근월에 LIFO 적용"""
        c = Contract(
            building_id="test_b",
            unit=101,
            tenant_name="홍길동",
            lease_type="월세",
            pay_timing="선불",
            rent=300000,
            maintenance=50000,
            move_in="2026-01-01"
        ).save()

        u = self.b.unit(101)
        # 7월, 8월, 9월 완납 상태
        u.pay(7, 2026)
        u.pay(8, 2026)
        u.pay(9, 2026)

        # 1차 취소: 가장 최근월인 10월(당월)이 취소되어야 함
        p1, cy1, cm1 = u.cancel_lifo(note="납부 취소")
        self.assertEqual((cy1, cm1), (2026, 10))
        self.assertFalse(u.period(2026, 10)["paid"])
        self.assertTrue(u.period(2026, 9)["paid"])

        # 2차 취소: 그 다음 최근월인 9월이 취소되어야 함
        p2, cy2, cm2 = u.cancel_lifo(note="납부 취소")
        self.assertEqual((cy2, cm2), (2026, 9))
        self.assertFalse(u.period(2026, 9)["paid"])
        self.assertTrue(u.period(2026, 8)["paid"])

        # 3차 취소: 그 다음 최근월인 8월이 취소되어야 함
        p3, cy3, cm3 = u.cancel_lifo(note="납부 취소")
        self.assertEqual((cy3, cm3), (2026, 8))
        self.assertFalse(u.period(2026, 8)["paid"])
        self.assertTrue(u.period(2026, 7)["paid"])


if __name__ == "__main__":
    unittest.main()
