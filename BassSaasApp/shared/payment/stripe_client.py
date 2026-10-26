"""shared/payment/stripe_client.py - Stripe 결제 공통 클라이언트"""
import logging

logger = logging.getLogger("mqnet.payment")


class StripePaymentService:
    """
    Stripe 결제 공통 서비스 클래스.
    모든 앱의 결제 기능은 이 클래스를 사용합니다.
    """

    def __init__(self, secret_key: str, webhook_secret: str = ""):
        self.secret_key = secret_key
        self.webhook_secret = webhook_secret
        self._stripe = None
        if secret_key:
            try:
                import stripe
                stripe.api_key = secret_key
                self._stripe = stripe
                logger.info("Stripe 결제 클라이언트 초기화 완료")
            except ImportError:
                logger.warning("stripe 패키지 필요: pip install stripe")

    @property
    def is_available(self) -> bool:
        return self._stripe is not None

    async def create_payment_intent(self, amount: int, currency: str = "krw", metadata: dict = None) -> dict:
        """결제 의도 생성 (금액: 원 단위 정수)"""
        if not self.is_available:
            return {"mock": True, "client_secret": "mock_client_secret", "amount": amount}

        intent = self._stripe.PaymentIntent.create(
            amount=amount,
            currency=currency,
            metadata=metadata or {},
        )
        return {"client_secret": intent.client_secret, "payment_intent_id": intent.id, "amount": amount}

    async def verify_webhook(self, payload: bytes, sig_header: str) -> dict:
        """Stripe 웹훅 서명 검증"""
        if not self.is_available:
            return {}
        event = self._stripe.Webhook.construct_event(payload, sig_header, self.webhook_secret)
        return event
