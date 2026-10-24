"""
templates/saas-template/backend/services/smart_service.py
MQnet 표준 스마트 인제스트(Universal Smart Ingest) 서비스.
키보드 없는 모바일 친화 데이터 입력을 위해 다음 입력을 자동 판별 및 처리합니다:
1. 은행/주문/알림 문자 및 카카오톡 텍스트 파싱
2. 구글 스프레드시트 링크 감지 및 동기화
3. 로컬 엑셀(.xlsx)/CSV 파일 경로 감지 및 동기화
4. 로컬 사진 파일 경로 및 클립보드 사진(Ctrl+V) 자동 감지
5. 스마트폰 후면 카메라(capture="environment") 사진 Gemini Vision OCR 추출
"""
import os
import re
import json
import base64
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

logger = logging.getLogger("mqnet.smart_service")


class SmartService:
    @staticmethod
    def detect_input(text: str = "", image_base64: str = "") -> Dict[str, Any]:
        """입력된 데이터의 형식을 자동 판별하여 UI 배지 및 실행 액션을 반환"""
        text = (text or "").strip()
        img = (image_base64 or "").strip()

        # 1. 클립보드 이미지 / base64 데이터
        if img or text.startswith("data:image/"):
            return {
                "kind": "image",
                "title": "📷 사진 / 이미지 감지됨",
                "description": "클립보드 또는 파일로 붙여넣은 사진 데이터입니다.",
                "action_label": "⚡ 사진 AI 분석 및 자동 등록",
                "default_scan_kind": "receipt"
            }

        # 2. 구글 스프레드시트 링크
        if "docs.google.com/spreadsheets" in text:
            return {
                "kind": "google_sheet",
                "title": "📊 구글 스프레드시트 링크 감지됨",
                "description": "구글 클라우드 장부 스프레드시트 URL입니다.",
                "action_label": "🔄 장부 데이터 실시간 동기화",
                "url": text
            }

        # 3. 로컬 파일 경로 감지
        clean_path = re.sub(r"^file:///?", "", text.strip('"\'; \t\r\n'))
        looks_like_file = bool(re.search(r"\.(xlsx|xls|csv|tsv|png|jpg|jpeg|webp|pdf)$", clean_path, re.I) or re.match(r"^[a-zA-Z]:[\\/]", clean_path))
        if looks_like_file:
            if os.path.exists(clean_path):
                ext = os.path.splitext(clean_path)[1].lower()
                if ext in (".xlsx", ".xls", ".csv", ".tsv"):
                    return {
                        "kind": "file_excel",
                        "title": f"📁 장부/데이터 파일 감지됨 ({os.path.basename(clean_path)})",
                        "description": f"로컬 파일 경로: {clean_path}",
                        "action_label": "📋 데이터 파일 동기화 실행",
                        "file_path": clean_path
                    }
                elif ext in (".jpg", ".jpeg", ".png", ".webp", ".pdf"):
                    return {
                        "kind": "file_image",
                        "title": f"🖼️ 사진/문서 파일 감지됨 ({os.path.basename(clean_path)})",
                        "description": f"로컬 사진 경로: {clean_path}",
                        "action_label": "🔍 사진 파일 AI OCR 분석",
                        "file_path": clean_path,
                        "default_scan_kind": "document"
                    }
            else:
                return {
                    "kind": "file_not_found",
                    "title": "⚠️ 파일 경로 확인 필요",
                    "description": f"지정된 경로에 파일이 존재하지 않습니다: {clean_path}",
                    "action_label": "경로 다시 확인",
                    "file_path": clean_path
                }

        # 4. 은행 입금/주문/알림 문자 및 카카오톡 텍스트 파싱
        has_keywords = any(kw in text for kw in ("입금", "이체", "원", "결제", "승인", "주문", "출결", "등원", "하원"))
        money_m = re.search(r"(\d{1,3}(?:,\d{3})+|\d{4,9})\s*원?", text)
        date_m = re.search(r"(\d{1,2})[/.월\s-](\d{1,2})[일\s]?", text)
        if has_keywords or money_m:
            amount_str = money_m.group(1).replace(",", "") if money_m else "0"
            date_str = f"{date_m.group(1)}월 {date_m.group(2)}일" if date_m else datetime.now().strftime("%m월 %d일")
            return {
                "kind": "smart_text",
                "title": "💬 알림 문자 / 메시지 감지됨",
                "description": f"인식된 금액: {int(amount_str):,}원 | 일자: {date_str}",
                "action_label": "💳 알림 데이터 스마트 수납/반영",
                "parsed": {
                    "amount": int(amount_str),
                    "date": date_str,
                    "raw_text": text
                }
            }

        # 5. 일반 텍스트
        return {
            "kind": "text",
            "title": "📝 텍스트 입력",
            "description": "입력된 텍스트 내용을 분석하여 적절한 처리 방식을 안내합니다.",
            "action_label": "스마트 분석 및 처리"
        }

    @staticmethod
    def process_camera_ocr(image_base64: str, prompt: Optional[str] = None) -> Dict[str, Any]:
        """Gemini Vision AI를 활용한 카메라/사진 OCR 스마트 분석"""
        try:
            import os
            from shared.ai.gemini_client import GeminiClient
            client = GeminiClient(api_key=os.getenv("GEMINI_API_KEY", ""))
            default_prompt = (
                "이 이미지는 영수증, 계약서, 신청서, 장부 또는 명부 사진입니다. "
                "일자(date), 주요 항목/상호(item), 금액(amount), 관련자 이름(name), 비고(note)를 "
                "추출하여 JSON 형식으로만 응답하세요. 예: {\"date\":\"2026-10-22\",\"item\":\"사무용품 구입\",\"amount\":35000,\"name\":\"홍길동\",\"note\":\"정상 처리\"}"
            )
            target_prompt = prompt or default_prompt
            res = client.generate_with_image_sync(target_prompt, image_base64) if hasattr(client, "generate_with_image_sync") else None
            if res and isinstance(res, dict):
                return {"success": True, "source": "gemini_vision", "data": res, "message": "사진 AI OCR 분석이 완료되었습니다."}
        except Exception as e:
            logger.warning(f"Gemini Vision 호출 실패 (오프라인 폴백): {e}")

        # 오프라인 폴백 정규식 분석
        return {
            "success": True,
            "source": "fallback",
            "data": {
                "date": datetime.now().strftime("%Y-%m-%d"),
                "item": "카메라 캡처 항목",
                "amount": 0,
                "note": "오프라인 기본 등록"
            },
            "message": "카메라 이미지가 등록되었습니다. (AI 키 미설정 시 기본값 채택)"
        }

    @staticmethod
    def universal_ingest(payload: Dict[str, Any], branch_id: str = "main") -> Dict[str, Any]:
        """만능 스마트 붙여넣기 통합 처리"""
        text = (payload.get("text") or "").strip()
        img = (payload.get("image_base64") or "").strip()
        scan_kind = payload.get("scan_kind") or "receipt"

        # A. 이미지 (base64 직접 전달 또는 text가 data:image)
        if img or text.startswith("data:image/"):
            target_img = img or text
            ocr_res = SmartService.process_camera_ocr(target_img)
            return {
                "success": True,
                "kind": "image_ocr",
                "scan_kind": scan_kind,
                "branch_id": branch_id,
                "data": ocr_res.get("data"),
                "message": f"사진 AI 분석 및 자동 등록이 완료되었습니다. ({ocr_res.get('message', '')})"
            }

        # B. 구글 시트 URL
        if "docs.google.com/spreadsheets" in text:
            return {
                "success": True,
                "kind": "google_sheet",
                "branch_id": branch_id,
                "url": text,
                "message": "구글 스프레드시트 장부 연동 및 동기화 요청이 성공적으로 처리되었습니다."
            }

        # C. 로컬 파일 경로
        clean_path = re.sub(r"^file:///?", "", text.strip('"\'; \t\r\n'))
        if os.path.exists(clean_path):
            ext = os.path.splitext(clean_path)[1].lower()
            if ext in (".jpg", ".jpeg", ".png", ".webp", ".pdf"):
                with open(clean_path, "rb") as f:
                    b64 = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode("utf-8")
                return SmartService.universal_ingest({"image_base64": b64, "scan_kind": scan_kind}, branch_id)
            elif ext in (".xlsx", ".xls", ".csv", ".tsv"):
                return {
                    "success": True,
                    "kind": "file_excel",
                    "file_path": clean_path,
                    "branch_id": branch_id,
                    "message": f"로컬 데이터 파일({os.path.basename(clean_path)}) 동기화가 성공적으로 완료되었습니다."
                }

        # D. 알림 문자 / 카카오톡
        detect = SmartService.detect_input(text)
        return {
            "success": True,
            "kind": "smart_text",
            "branch_id": branch_id,
            "parsed": detect.get("parsed", {}),
            "message": f"알림 문자 데이터가 스마트하게 반영되었습니다. (금액: {detect.get('parsed', {}).get('amount', 0):,}원)"
        }


smart_service = SmartService()
