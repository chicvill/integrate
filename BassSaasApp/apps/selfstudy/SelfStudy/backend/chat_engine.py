import json

class ChatEngine:
    def __init__(self, ai_tutor):
        self.ai_tutor = ai_tutor

    async def handle_chat_message(
        self, 
        session_id: str, 
        current_stage: int, 
        chat_history: list, 
        collected_data: dict, 
        draft_schedule: dict, 
        user_msg: str,
        user_name: str = ""
    ) -> dict:
        """
        초고속 대화형 온보딩 (Fast-track Refinement)
        - Mode 1 (current_stage == 1): 목표와 기간 수집
        - Mode 2 (current_stage == 2): 생성된 초안을 대화로 수정 (Refinement)
        - Mode 3 (current_stage == 3): 동적 일정 재조정 (Dynamic Rescheduling)
        """
        if not self.ai_tutor.gemini_client:
            return {"error": "AI 엔진 미설정"}

        name_instruction = f"\n[중요] 수험생의 이름은 '{user_name}'입니다. 대화 시 반드시 '{user_name} 님'이라고 다정하고 친근하게 부르며 다정하게 격려해 주세요.\n" if user_name else ""

        if current_stage == 1:
            # Mode 1: 정보 수집
            system_prompt = f"""
당신은 수험생의 목표와 기간을 빠르고 명확하게 파악하는 AI 튜터입니다.
현재 단계: Mode 1 (목표/기간 수집)
{name_instruction}
[지금까지 수집된 정보 요약]
{json.dumps(collected_data, ensure_ascii=False)}

[대화 원칙]
1. 수험생의 입력에서 '누가(학년/연령)', '무엇을(과목/목표)', '언제까지(시험일정)'가 유추 가능한지 먼저 파악하세요.
2. 융통성 발휘: "2학기 중간고사"라고 하면 굳이 정확한 날짜를 묻지 말고 '9월 말~10월 초'로 스스로 유추하여 기간을 설정하세요. 불필요한 질문(예: "어떤 학생이신가요?", "정확한 날짜가 언제인가요?")을 반복하지 마세요.
3. 수험생의 한 마디에 핵심 정보(예: "중2 2학기 중간 국영수 만점")가 모두 포함되어 있다면, 즉시 `stage_complete: true`를 반환하여 질문 없이 바로 계획 생성 단계로 넘어가세요.
4. 수험생이 "알아서 해줘"라고 막연하게 말할 때만 학년이나 선호도를 가볍게 묻고 객관식으로 제안하세요.
5. 꼬치꼬치 캐묻는 설문조사원처럼 행동하지 말고, 눈치껏 행간의 의미를 파악하는 똑똑한 비서처럼 행동하세요.

출력은 반드시 아래 JSON 구조여야 합니다.
{{
  "ai_response": "수험생에게 할 친절한 답변 및 질문",
  "stage_complete": boolean,
  "extracted_data": {{ // 추출한 데이터 }}
}}
"""
        elif current_stage == 2:
            # Mode 2: 초안 수정 (Refinement)
            spreadsheet_data = draft_schedule.get("spreadsheet_data", draft_schedule)
            system_prompt = f"""
당신은 수험생의 학습 비중을 조절하는 알고리즘 스케줄러 보조 AI입니다.
현재 단계: Mode 2 (과목/단원 비중 수정)
{name_instruction}
[현재 과목 및 단원 배분율(%) JSON]
{json.dumps(spreadsheet_data, ensure_ascii=False)}

[수험생의 요구사항 처리 원칙]
1. 수험생이 "국어 비중 늘려줘", "주말은 쉬게 해줘" 등 요구사항을 말하면, 이를 반영하여 위 JSON의 `weight_percent`를 조절하거나 요일 정보를 수정하세요.
2. 각 과목별 `weight_percent` 합은 100이 되어야 하고, 과목 내 `units`의 `weight_percent` 합도 100이 되어야 합니다.
3. 만약 수험생이 "이대로 할게" 등으로 동의하면, 수정 없이 기존 JSON을 반환하세요.
4. `ai_response`에는 "네, 국어 비중을 늘렸습니다. 좌측 표에서 확인해보세요!"와 같이 대화체로 답변하세요.

출력은 반드시 아래 JSON 구조여야 합니다.
{{
  "ai_response": "수험생에게 할 친절한 답변",
  "stage_complete": false,
  "extracted_data": {{}},
  "new_spreadsheet_data": {{ // 수정된 배분율 JSON 객체 }}
}}
"""
        else:
            # Mode 3: 동적 리스케줄링 (Dynamic Rescheduling)
            system_prompt = f"""
당신은 위기 극복을 돕는 리스케줄링(일정 재조정) AI 튜터입니다.
현재 단계: Mode 3 (일정 재조정)
{name_instruction}
[현재 수험생의 지연된 일정 및 진도율 JSON]
{json.dumps(draft_schedule, ensure_ascii=False)}

[대화 및 재조정 원칙]
1. 수험생이 "진도가 밀렸어", "아파서 못했어" 등 사유를 말하면, 위 JSON에서 `completed: false`이거나 아예 필드가 없는 미완료 태스크들을 파악하세요.
2. 수험생의 사유와 남은 기한을 고려하여, 미완료 태스크들을 뒤로 미루거나 요일을 재배치하여 새로운 전체 일정을 `new_draft_schedule`에 담아 반환하세요.
3. `ai_response`에는 수험생을 위로/격려하며 "남은 일정을 이렇게 조정해 보았습니다"라고 대답하세요.

출력은 반드시 아래 JSON 구조여야 합니다.
{{
  "ai_response": "격려와 수정된 일정 안내",
  "stage_complete": false,
  "extracted_data": {{}},
  "new_draft_schedule": {{ // 재조정된 전체 스케줄 JSON 객체 }}
}}
"""

        # 대화 기록 포맷팅
        messages = []
        for msg in chat_history:
            role = "user" if msg["role"] == "user" else "model"
            content = msg["content"]
            if isinstance(content, dict) and "ai_response" in content:
                content = content["ai_response"]
            messages.append({"role": role, "parts": [{"text": str(content)}]})
        
        # 현재 사용자 메시지 추가
        messages.append({"role": "user", "parts": [{"text": user_msg}]})

        try:
            # Await the async call_llm
            result = await self.ai_tutor.call_llm(messages=messages, system_instruction=system_prompt, temperature=0.7)
            
            if "error" in result:
                return result
            
            # 상태 업데이트
            new_stage = current_stage + 1 if result.get("stage_complete") else current_stage
            
            # 수집 데이터 병합
            new_collected_data = {**collected_data}
            if result.get("extracted_data"):
                new_collected_data.update(result["extracted_data"])
                
            return {
                "ai_response": result.get("ai_response", "네, 알겠습니다."),
                "new_stage": new_stage,
                "new_collected_data": new_collected_data,
                "new_draft_schedule": result.get("new_draft_schedule", draft_schedule)
            }
        except Exception as e:
            print(f"[CHAT AI ERROR] {e}")
            return {"error": str(e)}
