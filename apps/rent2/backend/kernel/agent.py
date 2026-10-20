"""
kernel/agent.py — AI 에이전트 공통 엔진 (Tool Calling).

도메인 객체의 행동(메서드)에 `@tool` 한 줄만 붙이면 AI가 쓸 수 있는 도구가 된다.
스키마(JSON)는 함수 시그니처·타입힌트·docstring에서 자동 생성 → SQL/테이블 지식이 필요 없다.
쓰기 도구는 기본적으로 '실행 대기(pending)'로 돌려 사람이 확인 후 실행한다.
"""
import inspect
import json
import os
import re
import time
import urllib.request
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple, get_type_hints
from uuid import uuid4

from .base import actor
from .identity import User

TOOLS: Dict[str, "Tool"] = {}
current_user: ContextVar[Optional[User]] = ContextVar("current_user", default=None)
_TYPES = {int: "INTEGER", float: "NUMBER", bool: "BOOLEAN", str: "STRING"}
MODELS = ["gemini-3.5-flash", "gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-latest"]


@dataclass
class Tool:
    name: str
    fn: Callable
    doc: str
    write: bool
    params: Dict[str, Any]
    required: List[str]
    scope_arg: str = "building"

    def declaration(self) -> dict:
        return {"name": self.name, "description": self.doc,
                "parameters": {"type": "OBJECT", "properties": self.params, "required": self.required}}


def tool(write: bool = False, scope_arg: str = "building") -> Callable:
    """함수 → AI 도구 등록. 시그니처에서 JSON 스키마를 자동 생성한다."""
    def wrap(fn: Callable) -> Callable:
        hints, sig = get_type_hints(fn), inspect.signature(fn)
        props, req = {}, []
        for pname, p in sig.parameters.items():
            props[pname] = {"type": _TYPES.get(hints.get(pname, str), "STRING"), "description": pname}
            if p.default is inspect.Parameter.empty:
                req.append(pname)
        TOOLS[fn.__name__] = Tool(fn.__name__, fn, inspect.getdoc(fn) or fn.__name__, write, props, req, scope_arg)
        return fn
    return wrap


def _coerce(kind: str, v: Any) -> Any:
    if kind == "INTEGER":
        return int(float(v))
    if kind == "NUMBER":
        return float(v)
    if kind == "BOOLEAN":
        return v if isinstance(v, bool) else str(v).lower() in ("true", "1", "y", "yes", "네")
    return str(v)


def run_tool(name: str, args: Dict[str, Any]) -> Any:
    """타입 보정 → 소속 강제 → 필수값 검증 → 권한 검사 → 실행. 호출자는 current_user 컨텍스트로 식별된다."""
    t, user = TOOLS.get(name), current_user.get()
    if not t:
        raise LookupError(f"알 수 없는 도구: {name}")
    try:
        args = {k: _coerce(t.params[k]["type"], v) for k, v in args.items() if k in t.params and v is not None}
    except (TypeError, ValueError) as e:
        raise ValueError(f"입력값 형식이 올바르지 않습니다: {e}")
    if t.scope_arg in t.params and not args.get(t.scope_arg) and user and user.branch:
        args[t.scope_arg] = user.branch          # 지점 관리자는 항상 본인 소속으로 고정
    missing = [r for r in t.required if args.get(r) in (None, "")]
    if missing:
        raise ValueError(f"필요한 정보가 빠졌습니다: {', '.join(missing)} (예: '201호 납부 처리')")
    if not user or not user.can("write" if t.write else "read", str(args.get(t.scope_arg, ""))):
        raise PermissionError(f"'{name}' 실행 권한이 없습니다 (사용자/소속 확인).")
    token = actor.set(f"ai:{user.username}")
    try:
        return t.fn(**args)
    finally:
        actor.reset(token)


# ── 쓰기 도구 확인 대기열 ──
PENDING: Dict[str, dict] = {}


def hold(name: str, args: dict, user: User) -> dict:
    pid = uuid4().hex[:8]
    PENDING[pid] = {"id": pid, "tool": name, "args": args, "user": user.id, "exp": time.time() + 600}
    return {"id": pid, "tool": name, "args": args}


def confirm(pid: str, user: User) -> Any:
    item = PENDING.pop(pid, None)
    if not item or item["exp"] < time.time() or item["user"] != user.id:
        raise LookupError("만료되었거나 존재하지 않는 실행 요청입니다. 다시 요청해 주세요.")
    token = current_user.set(user)
    try:
        return run_tool(item["tool"], item["args"])
    finally:
        current_user.reset(token)


# ── Gemini (Function Calling) ──
_api_key_cached: Optional[str] = None
_api_key_checked: bool = False


def api_key() -> Optional[str]:
    global _api_key_cached, _api_key_checked
    if _api_key_checked:
        return _api_key_cached
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key and not os.getenv("RENT2_DISABLE_VAULT"):
        try:
            from shared.core.vault import load_encrypted_env
            load_encrypted_env()
            key = os.getenv("GEMINI_API_KEY")
        except Exception:
            pass
    _api_key_cached = key
    _api_key_checked = True
    return key


def gemini(contents: list, system: str = "", tools: Optional[list] = None, json_mode: bool = False) -> dict:
    """여러 모델을 순차 폴백하며 generateContent 호출 → 첫 성공 응답(dict)"""
    body: Dict[str, Any] = {"contents": contents}
    if system:
        body["system_instruction"] = {"parts": [{"text": system}]}
    if tools:
        body["tools"] = [{"functionDeclarations": tools}]
    if json_mode:
        body["generationConfig"] = {"response_mime_type": "application/json"}
    last: Exception = RuntimeError("GEMINI_API_KEY 없음")
    for model in MODELS:
        try:
            req = urllib.request.Request(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key()}",
                data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as r:
                return json.loads(r.read())
        except Exception as e:   # 모델/쿼터 오류 → 다음 모델
            last = e
    raise RuntimeError(f"Gemini 호출 실패: {last}")


def gemini_json(prompt: str, image_b64: str = "", mime: str = "image/png") -> Any:
    """프롬프트(+이미지) → 순수 JSON 파싱 결과 (계약서 OCR 등 비전 추출용)"""
    parts: list = [{"text": prompt}]
    if image_b64:
        parts.append({"inline_data": {"mime_type": mime, "data": image_b64}})
    text = gemini([{"parts": parts}], json_mode=True)["candidates"][0]["content"]["parts"][0]["text"].strip()
    return json.loads(re.sub(r"^```(?:json)?\s*|\s*```$", "", text))


# ── 에이전트: LLM 루프 / 오프라인 규칙 ──
Rule = Tuple[re.Pattern, Callable[[re.Match, dict], List[Tuple[str, dict]]]]
OFFLINE_RULES: List[Rule] = []   # 도메인이 채운다 (API 키 없이도 동작/테스트 가능)


def say(out: Any) -> str:
    """도구 결과 → 한국어 한 덩어리 (도구는 'message'를 돌려주면 그대로 노출)"""
    if isinstance(out, dict):
        if "error" in out:
            return f"⚠️ {out['error']}"
        if "pending" in out:
            return "📝 실행 전 확인이 필요합니다. 아래 [실행] 버튼을 눌러주세요."
        if "message" in out:
            return str(out["message"])
    return json.dumps(out, ensure_ascii=False)[:600]


def chat(message: str, user: User, context: dict, system: str, mode: str = "confirm") -> dict:
    """사용자의 자연어 → 도구 호출(들) → 응답. mode='confirm'이면 쓰기 도구는 실행 대기로 돌린다."""
    steps: List[dict] = []
    pending: List[dict] = []
    token = current_user.set(user)

    def call(name: str, args: dict) -> Any:
        args = {**{k: v for k, v in context.items() if k in TOOLS[name].params and k not in args}, **args}
        try:
            if TOOLS[name].write and mode == "confirm":
                p = hold(name, args, user)
                pending.append({**p, "summary": TOOLS[name].doc.splitlines()[0]})
                out: Any = {"pending": p["id"], "note": "사용자 확인 후 실행됩니다."}
            else:
                out = run_tool(name, args)
        except Exception as e:
            out = {"error": str(e)}
        steps.append({"tool": name, "args": args, "result": out})
        return out

    try:
        if api_key():
            try:
                return _llm_loop(message, system, call, steps, pending)
            except Exception as e:   # LLM 불가 → 오프라인 규칙으로 안전 폴백
                steps.append({"tool": "_llm", "args": {}, "result": {"error": str(e)}})
        for pattern, plan in OFFLINE_RULES:
            m = pattern.search(message)
            if m:
                for name, args in plan(m, context):
                    call(name, args)
                break
        else:
            call("search", {"query": message})
        return {"reply": "\n".join(say(s["result"]) for s in steps if s["tool"] != "_llm"), "steps": steps, "pending": pending, "engine": "offline"}
    finally:
        current_user.reset(token)


def _llm_loop(message: str, system: str, call: Callable, steps: list, pending: list) -> dict:
    contents: list = [{"role": "user", "parts": [{"text": message}]}]
    decls = [t.declaration() for t in TOOLS.values()]
    for _ in range(6):
        parts = gemini(contents, system, decls)["candidates"][0]["content"].get("parts", [])
        calls = [p["functionCall"] for p in parts if "functionCall" in p]
        if not calls:
            return {"reply": "".join(p.get("text", "") for p in parts), "steps": steps, "pending": pending, "engine": "gemini"}
        contents.append({"role": "model", "parts": parts})
        contents.append({"role": "user", "parts": [
            {"functionResponse": {"name": c["name"], "response": {"result": call(c["name"], dict(c.get("args", {})))}}} for c in calls]})
    return {"reply": "요청이 너무 복잡합니다. 더 구체적으로 말씀해 주세요.", "steps": steps, "pending": pending, "engine": "gemini"}
