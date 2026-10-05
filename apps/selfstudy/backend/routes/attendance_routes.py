import time
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException
from schemas import SaveAttendancePayload, ConsultTagPayload, NfcTagPayload
from deps import context

router = APIRouter(prefix="/knowledge/attendance", tags=["Attendance & NFC"])

def is_late_by_10_mins(now_time_str: str, scheduled_in_str: str | None) -> bool:
    if not scheduled_in_str or not now_time_str:
        return False
    try:
        now_h, now_m = map(int, now_time_str.split(':'))
        sch_h, sch_m = map(int, scheduled_in_str.split(':'))
        return (now_h * 60 + now_m) > (sch_h * 60 + sch_m + 10)
    except:
        return False

def is_past_exit_time(now_time_str: str, scheduled_out_str: str | None) -> bool:
    if not scheduled_out_str or not now_time_str:
        return False
    try:
        now_h, now_m = map(int, now_time_str.split(':'))
        sch_h, sch_m = map(int, scheduled_out_str.split(':'))
        return (now_h * 60 + now_m) > (sch_h * 60 + sch_m)
    except:
        return False

@router.get("/{session_id}")
async def api_get_attendance(session_id: str):
    history = context.attendance_repo.get_attendance_history(session_id)
    return {"status": "success", "data": history}

@router.post("")
async def api_save_attendance(payload: SaveAttendancePayload):
    inferred_tag_count = 0
    inferred_consult_start = None
    
    if payload.check_in_time:
        inferred_tag_count = 1
        if payload.check_out_time:
            if payload.consult_checked:
                inferred_tag_count = 3
                inferred_consult_start = payload.check_in_time
            else:
                inferred_tag_count = 2

    conn = context.db_manager.get_db_conn()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("SELECT consult_start_time FROM attendance WHERE session_id = ? AND date = ?", (payload.session_id, payload.date))
            row = cur.fetchone()
            if row and row[0]:
                inferred_consult_start = row[0]
        except:
            pass
        finally:
            conn.close()

    res = context.attendance_repo.save_attendance(
        session_id=payload.session_id,
        date=payload.date,
        check_in_time=payload.check_in_time,
        check_out_time=payload.check_out_time,
        is_managed=payload.is_managed,
        consult_checked=payload.consult_checked,
        consult_note=payload.consult_note,
        scheduled_in_time=payload.scheduled_in_time,
        scheduled_out_time=payload.scheduled_out_time,
        consult_start_time=inferred_consult_start,
        tag_count=inferred_tag_count
    )
    if res:
        return {"status": "success", "message": "출석 정보가 업데이트되었습니다."}
    else:
        raise HTTPException(status_code=500, detail="출석 정보 저장 실패")

@router.post("/consult_tag")
async def api_consult_tag(payload: ConsultTagPayload):
    res = context.attendance_repo.save_attendance(
        session_id=payload.session_id,
        date=payload.date,
        is_managed=True,
        consult_checked=True
    )
    context.save_latest_consult_tag(payload.session_id, int(time.time()))
    
    if res:
        return {"status": "success", "message": "상담용 NFC 태깅 기록이 처리되었습니다."}
    else:
        raise HTTPException(status_code=500, detail="상담 NFC 태깅 실패")

@router.post("/nfc_tag")
async def api_nfc_tag(payload: NfcTagPayload):
    conn = context.db_manager.get_db_conn()
    if not conn:
        raise HTTPException(status_code=500, detail="DB 연결 실패")
    
    now_time_str = datetime.now().strftime("%H:%M")
    
    try:
        cur = conn.cursor()
        cur.execute("SELECT form_data FROM study_knowledge_bundles WHERE id = ?", (f"profile_{payload.session_id}",))
        row = cur.fetchone()
        is_managed = False
        scheduled_in = None
        scheduled_out = None
        
        if row:
            fd = json.loads(row[0]) if row[0] else {}
            is_managed = (fd.get("관리방식") == "관리형")
            
            days = ['일', '월', '화', '수', '목', '금', '토']
            day_name = days[datetime.strptime(payload.date, "%Y-%m-%d").weekday()]
            sched = fd.get("등하원예약시간", {}).get(day_name, {})
            scheduled_in = sched.get("in")
            scheduled_out = sched.get("out")

        cur.execute("SELECT check_in_time, check_out_time, consult_start_time, tag_count, tag1_time, tag2_time, tag3_time FROM attendance WHERE session_id = ? AND date = ?", (payload.session_id, payload.date))
        att = cur.fetchone()
        
        if not att or not att[0]:
            is_absent = is_late_by_10_mins(now_time_str, scheduled_in)
            context.attendance_repo.save_attendance(
                session_id=payload.session_id,
                date=payload.date,
                check_in_time=now_time_str,
                is_managed=is_managed,
                scheduled_in_time=scheduled_in,
                scheduled_out_time=scheduled_out,
                tag_count=1,
                tag1_time=now_time_str,
                consult_note="[결석] 10분 이상 지각으로 자동 결석 처리" if is_absent else ""
            )
            if is_absent:
                return {"status": "success", "tag_type": "absent", "time": now_time_str, "message": f"[{payload.session_id}] 10분 초과 지각으로 결석 처리되었습니다."}
            else:
                return {"status": "success", "tag_type": "check_in", "time": now_time_str, "message": f"[{payload.session_id}] 등원 처리 완료 ({now_time_str})"}
        
        check_in, check_out, consult_start, tag_cnt, tag1, tag2, tag3 = att
        tag_cnt = tag_cnt or 1
        
        if is_late_by_10_mins(tag1, scheduled_in):
            return {"status": "success", "tag_type": "absent_blocked", "message": "결석 처리된 학생이므로 추가 태깅을 진행할 수 없습니다."}
            
        if check_out:
            return {"status": "success", "tag_type": "already_completed", "message": "오늘의 등하원 및 상담 일정이 모두 완료되었습니다."}
        
        if tag_cnt == 1:
            if is_past_exit_time(now_time_str, scheduled_out):
                context.attendance_repo.save_attendance(
                    session_id=payload.session_id,
                    date=payload.date,
                    check_out_time=now_time_str,
                    is_managed=is_managed,
                    consult_checked=False,
                    tag_count=2,
                    tag2_time=now_time_str,
                    consult_note="[상담 미이행] 상담 없이 조기 하원"
                )
                return {"status": "success", "tag_type": "check_out_no_consult", "time": now_time_str, "message": f"[{payload.session_id}] 퇴장 시간 초과로 상담 없이 퇴장 처리 완료 ({now_time_str})"}
            else:
                context.attendance_repo.save_attendance(
                    session_id=payload.session_id,
                    date=payload.date,
                    is_managed=is_managed,
                    consult_checked=True,
                    consult_start_time=now_time_str,
                    tag_count=2,
                    tag2_time=now_time_str
                )
                context.save_latest_consult_tag(payload.session_id, int(time.time()))
                return {"status": "success", "tag_type": "consult_start", "time": now_time_str, "message": f"[{payload.session_id}] 퇴실 상담 시작 등록 및 대시보드 연동 완료 ({now_time_str})"}
        
        if tag_cnt == 2:
            context.attendance_repo.save_attendance(
                session_id=payload.session_id,
                date=payload.date,
                check_out_time=now_time_str,
                is_managed=is_managed,
                tag_count=3,
                tag3_time=now_time_str
            )
            return {"status": "success", "tag_type": "check_out", "time": now_time_str, "message": f"[{payload.session_id}] 최종 하원(퇴장) 처리 완료 ({now_time_str})"}
            
        return {"status": "success", "tag_type": "already_completed", "message": "오늘의 등하원 및 상담 일정이 모두 완료되었습니다."}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NFC 통합 태깅 중 오류: {e}")
    finally:
        conn.close()
