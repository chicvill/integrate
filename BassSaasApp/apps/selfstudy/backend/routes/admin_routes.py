from datetime import datetime
from fastapi import APIRouter
from deps import context

router = APIRouter(prefix="/knowledge", tags=["Admin Services"])

@router.get("/admin/students")
async def api_admin_get_students():
    profiles = context.user_repo.get_all_user_profiles()
    return {"status": "success", "data": profiles}

@router.get("/admin/latest_consult_tag")
async def api_get_latest_consult_tag():
    latest_tag = context.get_latest_consult_tag()
    return {"status": "success", "data": latest_tag}

@router.get("/admin/alerts")
async def api_get_admin_alerts():
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    days = ['월', '화', '수', '목', '금', '토', '일']
    today_day = days[now.weekday()]
    curr_mins = now.hour * 60 + now.minute

    profiles = context.user_repo.get_all_user_profiles()
    late_students = []
    recent_messages = []

    try:
        with context.db_manager.connection() as conn:
            cur = conn.cursor()
            
            for p in profiles:
                form_data = p.get('form_data') or {}
                if form_data.get('관리방식') == '관리형':
                    session_id = p.get('user_id')
                    name = p.get('name') or session_id
                    sched_map = form_data.get('등하원예약시간') or {}
                    sched_today = sched_map.get(today_day) or {'in': '09:00'}
                    sched_in = sched_today.get('in', '09:00')
                    
                    try:
                        sh, sm = map(int, sched_in.split(':'))
                        sched_mins = sh * 60 + sm
                    except Exception:
                        sched_mins = 9 * 60
                    
                    if curr_mins >= (sched_mins + 10):
                        cur.execute("SELECT check_in_time FROM attendance WHERE session_id = ? AND date = ?", (session_id, today_str))
                        att_row = cur.fetchone()
                        if not att_row or not att_row['check_in_time']:
                            minutes_late = curr_mins - sched_mins
                            late_students.append({
                                "user_id": session_id,
                                "name": name,
                                "scheduled_in": sched_in,
                                "minutes_late": minutes_late,
                                "goal": form_data.get('목표', '')
                            })
            
            cur.execute("""
                SELECT session_id, sender_role, content, created_at
                FROM study_messages
                WHERE sender_role IN ('student', 'parent')
                ORDER BY id DESC LIMIT 15
            """)
            rows = cur.fetchall()
            seen_sessions = set()
            for r in rows:
                sid = r['session_id']
                if sid not in seen_sessions:
                    seen_sessions.add(sid)
                    p_match = next((p for p in profiles if p.get('user_id') == sid), None)
                    s_name = (p_match.get('name') if p_match else None) or sid
                    recent_messages.append({
                        "user_id": sid,
                        "name": s_name,
                        "sender_role": r['sender_role'],
                        "content": r['content'],
                        "created_at": r['created_at']
                    })
    except Exception as e:
        print(f"Admin alerts API error: {e}")

    return {
        "status": "success",
        "data": {
            "late_students": late_students,
            "recent_messages": recent_messages
        }
    }

@router.get("/admin_risk_students")
async def api_admin_risk_students():
    all_schedules = context.knowledge_repo.search_knowledge_by_tags(["최종스케줄"], limit=100)
    risk_list = []
    for doc in all_schedules:
        payload = doc.get("payload", {})
        sess_id = payload.get("session_id")
        curriculum = payload.get("curriculum", [])
        total_tasks = 0
        completed_tasks = 0
        for week in curriculum:
            if isinstance(week, dict):
                for t in week.get("daily_tasks", []):
                    if isinstance(t, dict):
                        total_tasks += 1
                        if t.get("completed"):
                            completed_tasks += 1
        rate = int((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 100
        if rate < 60:
            user_info = context.user_repo.get_user_info(sess_id) if sess_id else None
            name = user_info.get("name", sess_id) if (user_info and isinstance(user_info, dict)) else (sess_id or "수험생")
            risk_list.append({
                "session_id": sess_id,
                "name": name,
                "completion_rate": rate,
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "plan_title": payload.get("plan_title", "진도 계획")
            })
    return {"status": "success", "data": risk_list}
