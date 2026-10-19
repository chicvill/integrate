import sys
from apps.rent.backend.services.payment_service import PaymentService
from apps.rent.backend.db.database import SessionLocal

db = SessionLocal()
res = PaymentService.batch_collect_payments(
    db,
    branch_id="branch_9348",
    year=2025,
    start_month=1,
    end_month=12,
    include_unoccupied=True
)
print("Result:", res)
