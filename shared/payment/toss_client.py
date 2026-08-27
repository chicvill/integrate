"""
shared/payment/toss_client.py
토스페이먼츠(Toss Payments) 결제 연동 클라이언트.
한국형 SaaS 앱(스터디카페, 매장 주문, 관상 분석 등)에 최적화된 결제 서비스.
"""
import base64
import logging
from typing import Dict, Any, Optional
import httpx
from shared.payment.base import BasePaymentService

logger = logging.getLogger("mqnet.payment.toss")


class TossPaymentService(BasePaymentService):
    """토스페이먼츠 v1 API 클라이언트"""

    def __init__(self, secret_key: str = "", client_key: str = ""):
        self.secret_key = secret_key
        self.client_key = client_key
        self.base_url = "https://api.tosspayments.com/v1/payments"

    @property
    def is_available(self) -> bool:
        return bool(self.secret_key)

    def _get_auth_header(self) -> Dict[str, str]:
        encoded = base64.b64encode(f"{self.secret_key}:".encode("utf-8")).decode("utf-8")
        return {"Authorization": f"Basic {encoded}", "Content-Type": "application/json"}

    async def create_payment_intent(
        self,
        amount: int,
        currency: str = "krw",
        order_id: Optional[str] = None,
        order_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """토스 결제 준비 데이터 반환"""
        import uuid
        actual_order_id = order_id or f"order_{uuid.uuid4().hex[:12]}"
        actual_order_name = order_name or "MQnet 서비스 이용권"

        if not self.is_available:
            return {
                "mock": True,
                "client_key": "test_ck_mock",
                "order_id": actual_order_id,
                "order_name": actual_order_name,
                "amount": amount,
            }

        return {
            "client_key": self.client_key,
            "order_id": actual_order_id,
            "order_name": actual_order_name,
            "amount": amount,
            "currency": currency.upper(),
        }

    async def confirm_payment(self, payment_key: str, order_id: str, amount: int) -> Dict[str, Any]:
        """결제 승인 API 호출"""
        if not self.is_available:
            return {"mock": True, "status": "DONE", "paymentKey": payment_key, "totalAmount": amount}

        url = f"{self.base_url}/confirm"
        payload = {"paymentKey": payment_key, "orderId": order_id, "amount": amount}

        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=payload, headers=self._get_auth_header(), timeout=10.0)
            if res.status_code == 200:
                return res.json()
            logger.error(f"토스 결제 승인 실패: {res.status_code} {res.text}")
            return {"error": res.text, "status_code": res.status_code}
