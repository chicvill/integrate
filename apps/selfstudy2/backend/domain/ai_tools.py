"""
domain/ai_tools.py — 관리형 독서실/셀프스터디 객체를 AI 도구로 노출 (@tool).
"""
import re
from typing import Any, Dict, List, Tuple
from ..kernel import agent
from ..kernel.agent import tool
from .selfstudy import Center, Student, Attendance, Consultation, StudyPlan, today_str, now_str


# ───────────── 읽기 도구 ─────────────
@tool()
def daily_briefing(center: str = "selfstudy-main") -> Dict[str, Any]:
    """오늘 관리형 독서실 전체 현황: 총 학생, 현재 학습 중, 하원, 결석, 총 순공시간."""
    c = Center.require(center)
    s = c.stats()
    return {
        **s,
        "message": f"📚 {s['center_name']} ({s['date']})\n· 재원생 {s['total_students']}명 중 현재 {s['studying_count']}명 열공 중 (하원 {s['checked_out_count']}명 / 미등원 {s['absent_count']}명)\n· 출석률 {s['attendance_rate']}% · 오늘 누적 순공시간 {s['total_study_hours']}시간"
    }


@tool()
def student_report(query: str, center: str = "selfstudy-main") -> Dict[str, Any]:
    """학생 학습 리포트: 이름 또는 전화번호로 오늘 출결, 순공시간, 최근 상담 내역을 확인한다."""
    stud = next((s for s in Student.find(center) if query in s.name or query in s.phone), None)
    if not stud:
        return {"found": False, "message": f"'{query}' 학생을 찾지 못했습니다."}
    
    card = stud.card()
    cons = sorted(Consultation.find(center, student_id=stud.id), key=lambda x: x.date, reverse=True)
    recent_note = cons[0].notes if cons else "상담 기록 없음"

    return {
        "found": True,
        "student": card,
        "recent_consultation": recent_note,
        "message": f"👤 {stud.name} 학생 ({stud.assigned_seat}석 / {stud.target_exam})\n· 현재 상태: {stud.status}\n· 등원: {card['check_in_at']} | 하원: {card['check_out_at']}\n· 오늘 순공: {card['pure_study_hours']}시간\n· 최근 지도일지: {recent_note}"
    }


# ───────────── 쓰기 도구 ─────────────
@tool(write=True)
def check_in_student(name_or_phone: str, center: str = "selfstudy-main") -> Dict[str, Any]:
    """학생 등원(체크인) 처리: 지정석 입실 및 순공 타이머를 가동한다."""
    stud = next((s for s in Student.find(center) if name_or_phone in s.name or name_or_phone in s.phone), None)
    if not stud:
        raise LookupError(f"'{name_or_phone}' 학생을 찾을 수 없습니다.")
    
    att = stud.check_in()
    late_text = " (⚠️ 08:30 이후 지각 등원)" if att.is_late else " (정시 등원)"
    return {
        "student_id": stud.id,
        "check_in_at": att.check_in_at,
        "message": f"🔔 {stud.name} 학생 등원 처리 완료 ({att.check_in_at}){late_text} → {stud.assigned_seat}석 학습 시작"
    }


@tool(write=True)
def check_out_student(name_or_phone: str, center: str = "selfstudy-main") -> Dict[str, Any]:
    """학생 하원(체크아웃) 처리: 학습 종료 및 오늘 총 순공시간을 산출한다."""
    stud = next((s for s in Student.find(center) if name_or_phone in s.name or name_or_phone in s.phone), None)
    if not stud:
        raise LookupError(f"'{name_or_phone}' 학생을 찾을 수 없습니다.")
    
    att = stud.check_out()
    hours = round(att.study_minutes / 60, 1)
    return {
        "student_id": stud.id,
        "study_minutes": att.study_minutes,
        "study_hours": hours,
        "message": f"🏠 {stud.name} 학생 하원 완료 ({att.check_out_at}) → 오늘 총 순공시간: {hours}시간 ({att.study_minutes}분)"
    }


@tool(write=True)
def log_consultation(name_or_phone: str, notes: str, focus_rating: str = "우수", center: str = "selfstudy-main") -> Dict[str, Any]:
    """대면 학습 상담 일지 기록: 학생의 태도 및 지도 피드백을 기록한다."""
    stud = next((s for s in Student.find(center) if name_or_phone in s.name or name_or_phone in s.phone), None)
    if not stud:
        raise LookupError(f"'{name_or_phone}' 학생을 찾을 수 없습니다.")
    
    c = Consultation(
        center_id=center,
        student_id=stud.id,
        student_name=stud.name,
        focus_rating=focus_rating,
        notes=notes
    ).save("consulted")

    return {
        "consult_id": c.id,
        "message": f"📝 {stud.name} 학생 상담 일지 등록 완료 (집중도: {focus_rating})\n내용: {notes}"
    }


# ───────────── 오프라인 빠른 규칙 ─────────────
def _args(msg: str, ctx: dict, **extra: Any) -> dict:
    a = dict(ctx)
    for s in Student.find(ctx.get("center", "selfstudy-main")):
        if s.name in msg or (s.phone and s.phone[-4:] in msg):
            a["name_or_phone"] = s.name
            break
    if (m := re.search(r"(01[016789]-?\d{3,4}-?\d{4})", msg)):
        a["name_or_phone"] = m.group(1)
    return {**a, **extra}


def _in_rule(m: re.Match, ctx: dict) -> List[Tuple[str, dict]]:
    return [("check_in_student", _args(m.string, ctx))]


def _out_rule(m: re.Match, ctx: dict) -> List[Tuple[str, dict]]:
    return [("check_out_student", _args(m.string, ctx))]


def _brief_rule(m: re.Match, ctx: dict) -> List[Tuple[str, dict]]:
    return [("daily_briefing", _args(m.string, ctx))]


def _report_rule(m: re.Match, ctx: dict) -> List[Tuple[str, dict]]:
    return [("student_report", {"query": m.string})]


agent.OFFLINE_RULES[:] = [(re.compile(p, re.I), fn) for p, fn in [
    (r"등원|입실|출석|공부\s*시작", _in_rule),
    (r"하원|퇴실|귀가|집에", _out_rule),
    (r"현황|브리핑|요약|출결|순공", _brief_rule),
    (r"리포트|성적|진도|보고서", _report_rule),
]]


def system_prompt(user: Any) -> str:
    return (
        f"당신은 관리형 독서실(SelfStudy) 전담 학습코칭 AI 비서입니다. 학생, 출결, 순공시간, 상담일지 객체를 제어합니다.\n"
        f"사용자: {user.summary()}. 수험생의 학습 루틴과 순공시간 유지를 돕기 위해 간결하고 정확하게 도구를 호출하세요."
    )
