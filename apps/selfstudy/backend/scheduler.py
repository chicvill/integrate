from datetime import datetime, timedelta
import math

class Scheduler:
    def __init__(self):
        self.day_map = {"월": 0, "화": 1, "수": 2, "목": 3, "금": 4, "토": 5, "일": 6}

    def calculate_schedule(self, form_data: dict, ai_draft: dict) -> dict:
        """
        form_data:
        {
          "마감일": "2026-10-05" (or string like "4주 뒤"),
          "공부가능요일": ["월", "수", "금"],
          "일일학습시간": "2", # hours
        }
        
        ai_draft:
        {
          "plan_title": "...",
          "subjects": [
            {"subject_name": "국어", "weight_percent": 50, "units": [{"unit_name": "1단원", "weight_percent": 100}]}
          ]
        }
        """
        
        # 1. Parse Dates and calculate total available days
        start_date = datetime.now()
        target_date_str = ai_draft.get("target_date_iso")
        if target_date_str:
            try:
                target_date = datetime.strptime(target_date_str, "%Y-%m-%d")
                if target_date < start_date:
                    target_date = start_date + timedelta(days=30)
            except:
                target_date = start_date + timedelta(days=30)
        else:
            target_date = start_date + timedelta(days=30)

        avail_days_str = form_data.get("공부가능요일", [])
        avail_days = [self.day_map[d] for d in avail_days_str if d in self.day_map]
        if not avail_days:
            avail_days = [0, 1, 2, 3, 4] # default to weekdays
            
        raw_hours = form_data.get("일일학습시간", "2")
        day_mins_map = {}
        
        if isinstance(raw_hours, dict):
            for day_str, hours in raw_hours.items():
                if day_str in self.day_map:
                    try:
                        day_mins_map[self.day_map[day_str]] = int(float(hours) * 60)
                    except:
                        day_mins_map[self.day_map[day_str]] = 120
        else:
            try:
                default_hours = float(str(raw_hours).replace("시간", "").strip())
            except:
                default_hours = 2.0
            default_mins = int(default_hours * 60)
            for d in avail_days:
                day_mins_map[d] = default_mins
                
        calendar = []
        curr_date = start_date
        while curr_date <= target_date:
            wd = curr_date.weekday()
            if wd in avail_days:
                capacity = day_mins_map.get(wd, 120)
                calendar.append({"date": curr_date.strftime("%Y-%m-%d"), "day_str": list(self.day_map.keys())[wd], "capacity": capacity})
            curr_date += timedelta(days=1)
            
        total_capacity = sum([day["capacity"] for day in calendar])
        
        # 2. Calculate unit requirements
        subject_queues = {}
        for subj in ai_draft.get("subjects", []):
            if not isinstance(subj, dict):
                continue
            subj_name = subj.get("subject_name", "미정 과목")
            try:
                subj_w = float(subj.get("weight_percent") or 0) / 100.0
            except (ValueError, TypeError):
                subj_w = 0.0
            subj_total_mins = total_capacity * subj_w
            
            unit_q = []
            raw_units = subj.get("units", [])
            for u in raw_units:
                if isinstance(u, dict):
                    u_name = u.get("unit_name", "단원")
                    start_p = u.get("start_page")
                    end_p = u.get("end_page")
                    tb_title = u.get("textbook_title") or subj.get("textbook_title") or ""
                    mult = float(u.get("weight_multiplier") or 1.0)
                    try:
                        u_w = float(u.get("weight_percent") or 0) / 100.0
                    except (ValueError, TypeError):
                        u_w = 0.0
                else:
                    u_name = str(u)
                    start_p = None
                    end_p = None
                    tb_title = ""
                    mult = 1.0
                    u_w = (1.0 / len(raw_units)) if raw_units else 1.0

                u_mins = max(1, int(subj_total_mins * u_w)) if subj_total_mins > 0 else 30
                unit_q.append({
                    "unit_name": u_name,
                    "textbook_title": tb_title,
                    "start_page": start_p,
                    "end_page": end_p,
                    "curr_page": start_p,
                    "multiplier": mult,
                    "required_mins": u_mins,
                    "remaining_mins": u_mins
                })
            subject_queues[subj_name] = unit_q

        # 3. Fill Calendar
        schedule_result = []
        week_num = 1
        is_buffer_sunday_enabled = bool(form_data.get("buffer_sunday", True))
        
        for idx, day_info in enumerate(calendar):
            if idx > 0 and idx % len(avail_days) == 0:
                week_num += 1
                
            daily_tasks = []

            # 일요일 Buffer Day 처리
            if is_buffer_sunday_enabled and day_info['day_str'] == '일':
                daily_tasks.append({
                    "day": f"Week {week_num} - {day_info['day_str']}",
                    "date": day_info["date"],
                    "subject": "전과목 공통",
                    "unit_name": "주간 미진한 과목 보충 및 자율 복습",
                    "task_title": "🗓️ 보충 학습 및 주간 복습 (Buffer Day)",
                    "estimated_minutes": day_info["capacity"],
                    "completed": False,
                    "is_buffer": True
                })
            else:
                for subj in ai_draft.get("subjects", []):
                    if not isinstance(subj, dict):
                        continue
                    subj_name = subj.get("subject_name", "미정 과목")
                    try:
                        subj_w = float(subj.get("weight_percent") or 0) / 100.0
                    except (ValueError, TypeError):
                        subj_w = 0.0
                    alloc_mins = int(day_info["capacity"] * subj_w)
                    
                    q = subject_queues.get(subj_name, [])
                    
                    while alloc_mins > 0 and q:
                        curr_unit = q[0]
                        if curr_unit["remaining_mins"] <= 0:
                            q.pop(0)
                            continue

                        if curr_unit["remaining_mins"] <= alloc_mins:
                            spent = curr_unit["remaining_mins"]
                            alloc_mins -= spent
                            
                            # 페이지 범위 계산
                            start_p = curr_unit.get("curr_page") or curr_unit.get("start_page")
                            end_p = curr_unit.get("end_page")
                            page_range_str = f"p.{start_p}~p.{end_p}" if (start_p and end_p) else ""
                            tb_prefix = f"[{curr_unit['textbook_title']}] " if curr_unit.get("textbook_title") else ""
                            
                            if spent > 0:
                                daily_tasks.append({
                                    "day": f"Week {week_num} - {day_info['day_str']}",
                                    "date": day_info["date"],
                                    "subject": subj_name,
                                    "unit_name": curr_unit["unit_name"],
                                    "task_title": f"{tb_prefix}{curr_unit['unit_name']} {page_range_str}".strip(),
                                    "page_range": page_range_str,
                                    "estimated_minutes": spent,
                                    "completed": False
                                })
                            q.pop(0)
                        else:
                            curr_unit["remaining_mins"] -= alloc_mins
                            start_p = curr_unit.get("curr_page") or curr_unit.get("start_page")
                            end_p = curr_unit.get("end_page")
                            page_range_str = f"p.{start_p}~p.{end_p}" if (start_p and end_p) else ""
                            tb_prefix = f"[{curr_unit['textbook_title']}] " if curr_unit.get("textbook_title") else ""
                            
                            daily_tasks.append({
                                "day": f"Week {week_num} - {day_info['day_str']}",
                                "date": day_info["date"],
                                "subject": subj_name,
                                "unit_name": curr_unit["unit_name"],
                                "task_title": f"{tb_prefix}{curr_unit['unit_name']} {page_range_str}".strip(),
                                "page_range": page_range_str,
                                "estimated_minutes": alloc_mins,
                                "completed": False
                            })
                            alloc_mins = 0
                            
            if daily_tasks:
                week_entry = next((w for w in schedule_result if w["week_number"] == week_num), None)
                if not week_entry:
                    week_entry = {"week_number": week_num, "week_theme": f"{week_num}주차 학습", "daily_tasks": []}
                    schedule_result.append(week_entry)
                
                if isinstance(week_entry.get("daily_tasks"), list):
                    week_entry["daily_tasks"].extend(daily_tasks)

        return {
            "plan_title": ai_draft.get("plan_title", "맞춤형 진도 계획"),
            "overall_strategy": ai_draft.get("overall_strategy", ""),
            "curriculum": schedule_result,
            "spreadsheet_data": ai_draft
        }

    def reschedule_auto(self, form_data: dict, active_schedule_payload: dict) -> dict:
        """
        진도가 밀렸을 때, 완료된 일정을 보존하고 미완료 일정만 오늘부터 마감일까지 알고리즘 기반 재조정
        """
        # 1. 완료된 태스크와 미완료 태스크 분리
        completed_tasks = []
        uncompleted_tasks = []
        
        for week in active_schedule_payload.get("curriculum", []):
            if isinstance(week, dict):
                for task in week.get("daily_tasks", []):
                    if isinstance(task, dict):
                        # Ensure week_number is preserved inside the task object for tracking
                        task_with_week = {**task}
                        if "week_number" not in task_with_week:
                            task_with_week["week_number"] = week.get("week_number", 1)
                        
                        if task.get("completed"):
                            completed_tasks.append(task_with_week)
                        else:
                            uncompleted_tasks.append(task_with_week)
                    
        # 2. 미완료 태스크들로부터 과목별 남은 분량(큐) 재구성
        subject_queues = {}
        for task in uncompleted_tasks:
            subj = task["subject"]
            unit = task["unit_name"]
            mins = task["estimated_minutes"]
            
            if subj not in subject_queues:
                subject_queues[subj] = []
                
            existing_unit = next((u for u in subject_queues[subj] if u["unit_name"] == unit), None)
            if existing_unit:
                existing_unit["remaining_mins"] += mins
            else:
                subject_queues[subj].append({
                    "unit_name": unit,
                    "remaining_mins": mins,
                    "required_mins": mins
                })
                
        # 3. 오늘부터 목표일까지의 남은 공부 가능 요일 계산
        start_date = datetime.now()
        target_date_str = active_schedule_payload.get("target_date_iso") or form_data.get("마감일")
        
        if target_date_str and isinstance(target_date_str, str):
            try:
                target_date = datetime.strptime(target_date_str, "%Y-%m-%d")
                if target_date < start_date:
                    target_date = start_date + timedelta(days=30)
            except Exception:
                target_date = start_date + timedelta(days=30)
        else:
            target_date = start_date + timedelta(days=30)
            
        avail_days_str = form_data.get("공부가능요일", [])
        avail_days = [self.day_map[d] for d in avail_days_str if d in self.day_map]
        if not avail_days:
            avail_days = [0, 1, 2, 3, 4]
            
        raw_hours = form_data.get("일일학습시간", "2")
        day_mins_map = {}
        if isinstance(raw_hours, dict):
            for day_str, hours in raw_hours.items():
                if day_str in self.day_map:
                    try:
                        day_mins_map[self.day_map[day_str]] = int(float(hours) * 60)
                    except (ValueError, TypeError):
                        day_mins_map[self.day_map[day_str]] = 120
        else:
            try:
                default_hours = float(str(raw_hours).replace("시간", "").strip())
            except (ValueError, TypeError):
                default_hours = 2.0
            default_mins = int(default_hours * 60)
            for d in avail_days:
                day_mins_map[d] = default_mins
                
        calendar = []
        curr_date = start_date
        while curr_date <= target_date:
            wd = curr_date.weekday()
            if wd in avail_days:
                capacity = day_mins_map.get(wd, 120)
                calendar.append({"date": curr_date.strftime("%Y-%m-%d"), "day_str": list(self.day_map.keys())[wd], "capacity": capacity})
            curr_date += timedelta(days=1)
            
        if not calendar:
            calendar = [{"date": (start_date + timedelta(days=i)).strftime("%Y-%m-%d"), "day_str": "월", "capacity": 120} for i in range(1, 8)]

        # 4. 새로운 달력에 남은 큐 분배
        schedule_result = []
        max_completed_week = max([int(t.get("week_number", 0)) for t in completed_tasks]) if completed_tasks else 0
        week_num = max_completed_week + 1
        
        spreadsheet_data = active_schedule_payload.get("spreadsheet_data")
        raw_subjects = (spreadsheet_data if isinstance(spreadsheet_data, dict) else {}).get("subjects", [])
        subjects_weights = {}
        if isinstance(raw_subjects, list):
            for s in raw_subjects:
                if isinstance(s, dict) and "subject_name" in s:
                    try:
                        subjects_weights[s["subject_name"]] = float(s.get("weight_percent") or 0) / 100.0
                    except (ValueError, TypeError):
                        subjects_weights[s["subject_name"]] = 0.0

        if not subjects_weights:
            subjects_weights = {subj: 1.0/len(subject_queues) for subj in subject_queues}
            
        for idx, day_info in enumerate(calendar):
            if idx > 0 and idx % len(avail_days) == 0:
                week_num += 1
                
            daily_tasks = []
            
            for subj_name, q in list(subject_queues.items()):
                subj_w = float(subjects_weights.get(subj_name, 0.1) or 0.1)
                alloc_mins = int(day_info["capacity"] * subj_w)
                
                while alloc_mins > 0 and q:
                    curr_unit = q[0]
                    if curr_unit["remaining_mins"] <= 0:
                        q.pop(0)
                        continue

                    if curr_unit["remaining_mins"] <= alloc_mins:
                        spent = curr_unit["remaining_mins"]
                        alloc_mins -= spent
                        if spent > 0:
                            daily_tasks.append({
                                "day": f"Week {week_num} - {day_info['day_str']}",
                                "date": day_info["date"],
                                "subject": subj_name,
                                "unit_name": curr_unit["unit_name"],
                                "task_title": curr_unit["unit_name"],
                                "estimated_minutes": spent,
                                "completed": False
                            })
                        q.pop(0)
                    else:
                        curr_unit["remaining_mins"] -= alloc_mins
                        daily_tasks.append({
                            "day": f"Week {week_num} - {day_info['day_str']}",
                            "date": day_info["date"],
                            "subject": subj_name,
                            "unit_name": curr_unit["unit_name"],
                            "task_title": curr_unit["unit_name"],
                            "estimated_minutes": alloc_mins,
                            "completed": False
                        })
                        alloc_mins = 0
                        
            if daily_tasks:
                week_entry = next((w for w in schedule_result if w["week_number"] == week_num), None)
                if not week_entry:
                    week_entry = {"week_number": week_num, "week_theme": f"{week_num}주차 학습", "daily_tasks": []}
                    schedule_result.append(week_entry)
                
                if isinstance(week_entry.get("daily_tasks"), list):
                    week_entry["daily_tasks"].extend(daily_tasks)

        # 5. 완료된 태스크들과 새로 생성된 태스크들 병합
        final_curriculum = []
        for week_n in sorted(list(set([t["week_number"] for t in completed_tasks]))):
            week_tasks = [t for t in completed_tasks if t["week_number"] == week_n]
            final_curriculum.append({
                "week_number": week_n,
                "week_theme": f"{week_n}주차 학습 (완료)",
                "daily_tasks": week_tasks
            })
            
        final_curriculum.extend(schedule_result)
        
        new_payload = {
            "plan_title": active_schedule_payload.get("plan_title", "재조정된 진도 계획"),
            "overall_strategy": active_schedule_payload.get("overall_strategy", ""),
            "target_date_iso": target_date.strftime("%Y-%m-%d"),
            "observer_code": active_schedule_payload.get("observer_code"),
            "session_id": active_schedule_payload.get("session_id"),
            "ref_goal_id": active_schedule_payload.get("ref_goal_id"),
            "ref_previous_schedule_id": active_schedule_payload.get("doc_id"),
            "curriculum": final_curriculum,
            "spreadsheet_data": active_schedule_payload.get("spreadsheet_data", {})
        }
        
        return new_payload
