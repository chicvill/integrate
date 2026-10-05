import os
import json
import re
import httpx
from dotenv import load_dotenv, find_dotenv
from google import genai
from google.genai import types

load_dotenv(find_dotenv(), override=True)

class AITutor:
    def __init__(self, knowledge_repo=None):
        self.knowledge_repo = knowledge_repo
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        self.gemini_client = None

        if self.gemini_key and not self.gemini_key.startswith("MY_"):
            try:
                self.gemini_client = genai.Client(api_key=self.gemini_key)
                print(f"[OK] Gemini AI Engine configured (Model: {self.gemini_model}) for SelfStudy RAG.")
            except Exception as e:
                print(f"[WARN] Failed to configure Gemini: {e}")

    def _build_context(self, tags: list) -> str:
        if self.knowledge_repo:
            past_knowledges = self.knowledge_repo.search_knowledge_by_tags(tags, limit=3)
        else:
            past_knowledges = []
            
        if past_knowledges:
            context_text = "다음은 이전에 비슷한 목표를 가졌던 수험생들의 실제 경험 데이터입니다. 참고하여 새로운 수험생을 도와주세요:\n"
            for kb in past_knowledges:
                context_text += f"[{kb['domain_type']}] 태그: {kb['tags']} \n내용: {json.dumps(kb['payload'], ensure_ascii=False)}\n\n"
            return context_text
        return "이전에 비슷한 목표를 가진 수험생 데이터가 없습니다. 일반적인 최상의 전략을 바탕으로 생성해주세요.\n"

    async def call_llm(
        self, 
        prompt: str | None = None, 
        messages: list | None = None, 
        system_instruction: str | None = None, 
        response_mime_type: str = "application/json", 
        temperature: float = 0.7
    ) -> dict:
        """
        Unified LLM caller. Tries Gemini async first, falls back to OpenAI async if Gemini fails.
        """
        openai_key = os.getenv("OPENAI_API_KEY")
        has_openai = openai_key and not openai_key.startswith("MY_")
        
        # 1. Try Gemini first
        if self.gemini_client:
            try:
                if messages:
                    # Chat style call - using .aio (async) Client
                    response = await self.gemini_client.aio.models.generate_content(
                        model=self.gemini_model,
                        contents=messages,
                        config=types.GenerateContentConfig(
                            system_instruction=system_instruction,
                            response_mime_type=response_mime_type,
                            temperature=temperature
                        )
                    )
                else:
                    # Prompt style call - using .aio (async) Client
                    response = await self.gemini_client.aio.models.generate_content(
                        model=self.gemini_model,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type=response_mime_type, 
                            temperature=temperature
                        )
                    )
                
                raw_text = response.text
                text = raw_text.strip() if raw_text else ""
                
                # Robust JSON extraction
                json_match = re.search(r'```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```', text, re.DOTALL)
                if json_match:
                    text = json_match.group(1)
                else:
                    text = text.strip()
                    
                return json.loads(text)
            except Exception as e:
                print(f"[GEMINI ERROR] Exception: {e}")
                if not has_openai:
                    return {"error": f"Gemini 오류 및 OpenAI 미설정: {str(e)}"}
                print("[WARN] Gemini failed. Falling back to OpenAI (async)...")
        
        # 2. Fallback to OpenAI (Async using httpx)
        if not has_openai:
            return {"error": "AI 엔진 미설정 (Gemini 실패 및 OpenAI 키 없음)"}
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {openai_key}"
        }
        
        openai_messages = []
        if system_instruction:
            openai_messages.append({"role": "system", "content": system_instruction})
            
        if messages:
            # Translate Gemini message format to OpenAI
            for msg in messages:
                role = "assistant" if msg["role"] == "model" else msg["role"]
                text_val = ""
                if isinstance(msg.get("parts"), list) and len(msg["parts"]) > 0:
                    part = msg["parts"][0]
                    if isinstance(part, dict):
                        text_val = part.get("text", "")
                    else:
                        text_val = getattr(part, "text", str(part))
                else:
                    text_val = str(msg.get("parts", ""))
                openai_messages.append({"role": role, "content": text_val})
        else:
            openai_messages.append({"role": "user", "content": prompt})
            
        payload = {
            "model": "gpt-4o-mini",
            "messages": openai_messages,
            "temperature": temperature
        }
        if response_mime_type == "application/json":
            payload["response_format"] = {"type": "json_object"}
            if openai_messages:
                openai_messages[-1]["content"] += "\n\nCRITICAL: You must return the response in json format."
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=30.0)
                if response.status_code != 200:
                    print(f"[OPENAI ERROR] RAW RESPONSE: {response.text}")
                response.raise_for_status()
                res_json = response.json()
                text = res_json["choices"][0]["message"]["content"]
                return json.loads(text.strip())
        except Exception as e:
            print(f"[OPENAI ERROR] {e}")
            return {"error": f"AI 호출 오류 (OpenAI): {str(e)}"}

    async def _call_gemini(self, prompt: str) -> dict:
        return await self.call_llm(prompt=prompt)

    async def generate_rag_curriculum(self, user_goal: dict, tags: list) -> dict:
        """
        RAG 아키텍처: 주어진 태그로 과거 지식(유사한 목표, 일정, 실패/성공 사례)을 검색하고,
        이를 프롬프트의 맥락(Context)으로 제공하여 완전히 새로운 맞춤형 일정을 생성.
        """
        if not self.gemini_client:
            return {"error": "AI 엔진 미설정. (GEMINI_API_KEY 확인)"}

        # 1. 지식정보창고 검색 (Retrieval)
        context_text = self._build_context(tags)

        # 2. 프롬프트 생성 (Augmentation)
        prompt = f"""
당신은 모든 자격증과 개인 목표 달성을 도와주는 만능 AI 튜터입니다.
아래의 [과거 지식 데이터]를 분석하여 성공 요인은 취하고 실패 요인은 회피하는 전략을 세우세요.
그리고 [새로운 수험생 정보]를 바탕으로 정밀한 알고리즘 스케줄링을 위한 '과목 및 단원별 배분율' JSON을 작성해주세요.

[과거 지식 데이터 (Context)]
{context_text}

[새로운 수험생 정보]
목표: {json.dumps(user_goal, ensure_ascii=False)}

[요구사항]
- 수험생의 목표를 이루기 위해 필요한 과목들을 도출하고, 과목별 중요도에 따라 학습 시간 배분율(%)의 총합이 100%가 되도록 설정하세요.
- 각 과목 하위에 구체적인 단원(목차) 리스트를 생성하세요. 단, 교재의 단순한 '단원명'이나 '페이지 수'로 분할하지 말고, '성취해야 할 핵심 목표나 행동(Action)' 단위로 `unit_name`을 작성하세요. (예: '2단원. 방정식' 대신 '이차방정식의 근의 공식을 이해하고 3문제 설명하기')
- `overall_strategy` 항목에는 학생들이 선택할 수 있는 '다양한 학습 매체(영상 시청, 교재 읽기, 백지 복습 등) 추천 선택지'를 반드시 포함하여 자기주도학습을 가이드하세요.
- 해당 과목 내에서 단원별 배분율(%)의 총합이 100%가 되도록 설정하세요.
- 결과는 단일 JSON 객체여야 합니다.
- 다음과 같은 구조를 가져야 합니다:
  {{
    "plan_title": "목표 달성 진도 계획",
    "overall_strategy": "과거 데이터 분석을 반영한 학습 전략 및 추천 학습법 선택지 제시",
    "target_date_iso": "YYYY-MM-DD",
    "subjects": [
      {{
        "subject_name": "국어",
        "weight_percent": 40,
        "units": [
          {{"unit_name": "시의 화자가 느끼는 감정 3가지 찾아내어 설명하기", "weight_percent": 30}},
          {{"unit_name": "소설의 시점을 파악하고 주인공의 심리 변화 요약하기", "weight_percent": 70}}
        ]
      }},
      {{
        "subject_name": "수학",
        "weight_percent": 60,
        "units": [
          {{"unit_name": "일차방정식의 개념을 이해하고 동생에게 설명하듯 말해보기", "weight_percent": 50}},
          {{"unit_name": "함수의 그래프를 직접 그리고 특징 3가지 찾아내기", "weight_percent": 50}}
        ]
      }}
    ]
  }}
- target_date_iso는 사용자가 입력한 마감일(예: 2026.11.10, 다음달 말)을 무조건 정확한 날짜 포맷(YYYY-MM-DD)으로 파싱해야 합니다.
- 출력은 백틱(```json) 없이 원시 JSON 문자열로만 반환하십시오.
"""
        # 3. AI 답변 생성 (Generation)
        return await self._call_gemini(prompt)

    async def generate_subjects(self, user_goal: dict, tags: list) -> dict:
        context_text = self._build_context(tags)
        prompt = f"""
당신은 만능 AI 튜터입니다. [과거 지식 데이터]를 분석하여 [새로운 수험생 정보]를 바탕으로 학습해야 할 '과목 리스트'를 생성해주세요.
[과거 지식 데이터]
{context_text}

목표: {json.dumps(user_goal, ensure_ascii=False)}

[요구사항]
- 수험생의 목표를 이루기 위해 필요한 과목명들을 도출하세요.
- 전반적인 학습 전략(overall_strategy)과 예상 마감일(target_date_iso)도 함께 산출하세요.
- 출력 형식:
  {{
    "plan_title": "목표 달성 진도 계획",
    "overall_strategy": "추천 학습법 및 전략",
    "target_date_iso": "YYYY-MM-DD",
    "subjects": [
      {{"subject_name": "국어"}},
      {{"subject_name": "수학"}}
    ]
  }}
- 출력은 백틱(```json) 없이 원시 JSON 문자열로만 반환하십시오.
"""
        return await self._call_gemini(prompt)

    async def generate_subject_weights(self, subjects: list, user_goal: dict) -> dict:
        prompt = f"""
당신은 만능 AI 튜터입니다.
다음은 수험생이 확정한 과목 리스트입니다: {json.dumps(subjects, ensure_ascii=False)}
목표: {json.dumps(user_goal, ensure_ascii=False)}

[요구사항]
- 각 과목의 난이도와 중요도를 평가하여, 학습 시간 비중(%)을 산출하세요.
- 총합은 반드시 100%가 되어야 합니다.
- 출력 형식:
  {{
    "subjects": [
      {{"subject_name": "국어", "weight_percent": 40}},
      {{"subject_name": "수학", "weight_percent": 60}}
    ]
  }}
- 출력은 백틱(```json) 없이 원시 JSON 문자열로만 반환하십시오.
"""
        return await self._call_gemini(prompt)

    async def generate_units(self, subjects: list, user_goal: dict) -> dict:
        prompt = f"""
당신은 만능 AI 튜터입니다.
수험생의 목표: {json.dumps(user_goal, ensure_ascii=False)}
확정된 과목 리스트(비중 포함): {json.dumps(subjects, ensure_ascii=False)}

[요구사항]
- 각 과목 하위에 구체적인 단원(목차) 리스트를 생성하세요.
- '성취해야 할 핵심 목표나 행동(Action)' 단위로 `unit_name`을 작성하세요.
- 비중(weight_percent)은 아직 계산하지 마세요.
- 출력 형식:
  {{
    "subjects": [
      {{
        "subject_name": "국어",
        "weight_percent": 40,
        "units": [
          {{"unit_name": "시의 화자가 느끼는 감정 3가지 찾아내기"}},
          {{"unit_name": "소설의 시점을 파악하기"}}
        ]
      }}
    ]
  }}
"""
        return await self._call_gemini(prompt)

    async def generate_unit_weights(self, subjects_with_units: list, user_goal: dict) -> dict:
        prompt = f"""
당신은 만능 AI 튜터입니다.
수험생 목표: {json.dumps(user_goal, ensure_ascii=False)}
단원이 포함된 과목 리스트: {json.dumps(subjects_with_units, ensure_ascii=False)}

[요구사항]
- 각 과목(subject) 내에서, 단원(units)들의 중요도와 학습 분량을 평가하여 단원별 비중(weight_percent)을 산출하세요.
- '하나의 과목' 내에서 모든 단원 비중의 합은 100%가 되어야 합니다.
- 출력 형식:
  {{
    "subjects": [
      {{
        "subject_name": "국어",
        "weight_percent": 40,
        "units": [
          {{"unit_name": "시의 화자가 느끼는 감정 3가지 찾아내기", "weight_percent": 40}},
          {{"unit_name": "소설의 시점을 파악하기", "weight_percent": 60}}
        ]
      }}
    ]
  }}
"""
        return await self._call_gemini(prompt)
