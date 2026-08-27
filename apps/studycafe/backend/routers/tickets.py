from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.db import models
from backend.schemas import TicketCreate, TicketResponse

router = APIRouter(prefix="/api/tickets", tags=["Tickets & Payments"])

@router.post("/purchase", response_model=TicketResponse)
def purchase_ticket(ticket: TicketCreate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == ticket.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    new_ticket = models.Ticket(
        user_id=ticket.user_id,
        ticket_type=ticket.ticket_type,
        minutes_granted=ticket.minutes_granted,
        price=ticket.price
    )
    user.total_time_remaining += ticket.minutes_granted
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    return new_ticket
