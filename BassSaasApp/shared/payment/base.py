"""
shared/payment/base.py
MQnet 통합 SaaS 결제 서비스 공통 추상 인터페이스.
Stripe, 토스페이먼츠(Toss Payments), 카카오페이 등을 교체 가능하도록 설계합니다.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional


class BasePaymentService(ABC):
    @property
    @abstractmethod
    def is_available(self) -> bool:
        """결제 서비스 활성화 여부"""
        pass

    @abstractmethod
    async def create_payment_intent(
        self,
        amount: int,
        currency: str = "krw",
        order_id: Optional[str] = None,
        order_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """결제 의도/세션 생성"""
        pass
