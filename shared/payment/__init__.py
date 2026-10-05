from typing import Optional
from shared.payment.base import BasePaymentService
from shared.payment.stripe_client import StripePaymentService
from shared.payment.toss_client import TossPaymentService


def get_payment_service(provider: str = "toss", settings=None) -> BasePaymentService:
    """
    제공자('toss' 또는 'stripe')에 맞는 결제 서비스 인스턴스를 반환합니다.
    """
    if settings is None:
        from shared.core.base_config import get_base_settings
        settings = get_base_settings()

    provider_clean = provider.lower()
    if provider_clean == "stripe":
        return StripePaymentService(
            secret_key=getattr(settings, "STRIPE_SECRET_KEY", ""),
            webhook_secret=getattr(settings, "STRIPE_WEBHOOK_SECRET", ""),
        )
    # 기본값: 토스페이먼츠
    return TossPaymentService(
        secret_key=getattr(settings, "TOSS_SECRET_KEY", ""),
        client_key=getattr(settings, "TOSS_CLIENT_KEY", ""),
    )


__all__ = [
    "BasePaymentService",
    "StripePaymentService",
    "TossPaymentService",
    "get_payment_service",
]
