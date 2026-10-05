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
            subj_name = subj["subject_name"]
            subj_w = subj.get("weight_percent", 0) / 100.0
            subj_total_mins = total_capacity * subj_w
            
            unit_q = []
            for u in subj.get("units", []):
                u_w = u.get("weight_percent", 0) / 100.0
                u_mins = int(subj_total_mins * u_w)
                unit_q.append({
                    "unit_name": u["unit_name"],
                    "required_mins": u_mins,
                    "remaining_mins": u_mins
                })
            subject_queues[subj_name] = unit_q

        # 3. Fill Calendar
        schedule_result = []
        week_num = 1
        
        for idx, day_info in enumerate(calendar):
            if idx > 0 and idx % len(avail_days) == 0:
                week_num += 1
                
            daily_tasks = []
            
            for subj in ai_draft.get("subjects", []):
                subj_name = subj["subject_name"]
                subj_w = subj.get("weight_percent", 0) / 100.0
                alloc_mins = int(day_info["capacity"] * subj_w)
                
                q = subject_queues[subj_name]
                
                while alloc_mins > 0 and q:
                    curr_unit = q[0]
                    if curr_unit["remaining_mins"] <= alloc_mins:
                        spent = curr_unit["remaining_mins"]
                        alloc_mins -= spent
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
                        
            week_entry = next((w for w in schedule_result if w["week_number"] == week_num), None)
            if not week_entry:
                week_entry = {"week_number": week_num, "week_theme": f"{week_num}주차 학습", "daily_tasks": []}
                schedule_result.append(week_entry)
                
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
            for task in week.get("daily_tasks", []):
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
        
        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d")
            if target_date < start_date:
                target_date = start_date + timedelta(days=30)
        except:
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
            
        if not calendar:
            calendar = [{"date": (start_date + timedelta(days=i)).strftime("%Y-%m-%d"), "day_str": "월", "capacity": 120} for i in range(1, 8)]

        # 4. 새로운 달력에 남은 큐 분배
        schedule_result = []
        max_completed_week = max([t.get("week_number", 0) for t in completed_tasks]) if completed_tasks else 0
        week_num = max_completed_week + 1
        
        subjects_weights = {s["subject_name"]: s.get("weight_percent", 0)/100.0 for s in active_schedule_payload.get("spreadsheet_data", {}).get("subjects", [])}
        if not subjects_weights:
            subjects_weights = {subj: 1.0/len(subject_queues) for subj in subject_queues}
            
        for idx, day_info in enumerate(calendar):
            if idx > 0 and idx % len(avail_days) == 0:
                week_num += 1
                
            daily_tasks = []
            
            for subj_name, q in list(subject_queues.items()):
                subj_w = subjects_weights.get(subj_name, 0.1)
                alloc_mins = int(day_info["capacity"] * subj_w)
                
                while alloc_mins > 0 and q:
                    curr_unit = q[0]
                    if curr_unit["remaining_mins"] <= alloc_mins:
                        spent = curr_unit["remaining_mins"]
                        alloc_mins -= spent
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
