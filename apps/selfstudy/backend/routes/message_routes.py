from fastapi import APIRouter, HTTPException
from schemas import SaveMessagePayload
from deps import context

router = APIRouter(prefix="/knowledge/messages", tags=["3-Way Messages"])

@router.get("/{session_id}")
async def api_get_messages(session_id: str):
    msgs = context.message_repo.get_study_messages(session_id)
    return {"status": "success", "data": msgs}

@router.post("")
async def api_save_message(payload: SaveMessagePayload):
    res = context.message_repo.save_study_message(payload.session_id, payload.sender_role, payload.content)
    if res:
        return {"status": "success", "message": "메시지가 저장되었습니다."}
    else:
        raise HTTPException(status_code=500, detail="메시지 저장 실패")
