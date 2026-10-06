"""
shared/monitoring/router.py
저장공간/메모리 한계 사전 경보 및 앱별 관리자 이메일 설정 API 라우터.
"""
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from .service import monitor_service

router = APIRouter(prefix="/api/monitoring", tags=["시스템 - 저장 메모리 모니터링 & 경보"])


class MonitoringConfigUpdateRequest(BaseModel):
    default_admin_email: Optional[str] = None
    app_admin_emails: Optional[Dict[str, str]] = None
    disk_warning_percent: Optional[float] = None
    disk_critical_percent: Optional[float] = None
    memory_warning_percent: Optional[float] = None
    check_interval_seconds: Optional[int] = None
    enabled: Optional[bool] = None
    smtp: Optional[Dict[str, Any]] = None


class TestAlertRequest(BaseModel):
    app_id: Optional[str] = None
    target_email: Optional[str] = None
    custom_message: Optional[str] = None


@router.get("/status", summary="실시간 저장공간 및 메모리 사용 현황 지표 조회")
async def get_monitoring_status():
    """
    현재 서버의 디스크 사용률, 남은 여유 공간(GB), RAM 사용률 및 데몬 실행 상태를 반환합니다.
    """
    metrics = monitor_service.get_system_metrics()
    current_interval = monitor_service.compute_next_check_interval(metrics)
    return {
        "success": True,
        "daemon_running": monitor_service.is_running,
        "metrics": metrics,
        "current_interval_seconds": current_interval,
        "current_interval_minutes": round(current_interval / 60, 1),
        "adaptive_rules": {
            "normal_under_70pct": "30분 (1800초)",
            "caution_70_to_80pct": "10분 (600초)",
            "critical_over_80pct": "3분 (180초)"
        },
        "thresholds": {
            "disk_warning": monitor_service.config.get("disk_warning_percent", 80.0),
            "disk_critical": monitor_service.config.get("disk_critical_percent", 90.0),
            "memory_warning": monitor_service.config.get("memory_warning_percent", 85.0),
        },
        "default_admin_email": monitor_service.config.get("default_admin_email"),
        "target_emails": monitor_service.get_all_target_emails()
    }


@router.get("/config", summary="앱별 관리자 이메일 및 경보 임계치 설정 조회")
async def get_monitoring_config():
    """
    등록된 앱별 관리자 이메일 및 알림 주기 설정을 반환합니다.
    초기 기본값: himin5004@gmail.com
    """
    return {
        "success": True,
        "config": monitor_service.config
    }


@router.post("/config", summary="앱별 관리자 이메일 및 경보 임계치 설정 갱신")
async def update_monitoring_config(payload: MonitoringConfigUpdateRequest):
    """
    특정 앱의 관리자 이메일(예: studycafe, store 등)을 변경하거나
    경보 발생 임계치(기본: 80% 주의, 90% 위험)를 수정하여 파일에 영속 저장합니다.
    """
    update_data = payload.model_dump(exclude_unset=True)
    updated = monitor_service.update_config(update_data)
    return {
        "success": True,
        "message": "모니터링 및 앱별 관리자 이메일 설정이 성공적으로 갱신되었습니다.",
        "config": updated
    }


@router.post("/test-alert", summary="관리자 이메일 사전 경보 테스트 발송")
async def send_test_alert(payload: Optional[TestAlertRequest] = None):
    """
    관리자 이메일(himin5004@gmail.com 또는 지정 이메일)로 즉시 테스트 사전 경보를 발송합니다.
    """
    recipients = None
    if payload and payload.target_email:
        recipients = [payload.target_email.strip()]
    elif payload and payload.app_id:
        recipients = [monitor_service.get_email_for_app(payload.app_id)]

    metrics = monitor_service.get_system_metrics()
    subject = f"🔔 [테스트] MQnet 구글 서버 저장 메모리 사전 경보 시스템 정상 가동"
    custom_text = (payload and payload.custom_message) or "사전 모니터링 데몬이 정상 작동 중입니다."

    body_html = f"""
    <div style="font-family: Pretendard, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #38bdf8; border-radius: 12px; background: #0f172a; color: #f8fafc;">
      <h2 style="color: #38bdf8; margin-top: 0;">🔔 사전 경보 모니터링 테스트 알림</h2>
      <p style="color: #cbd5e1; font-size: 14px;">{custom_text}</p>
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 4px 0; color: #94a3b8;">💾 <strong>디스크 사용률</strong>: {metrics['disk']['percent']}% (여유: {metrics['disk']['free_gb']} GB / 총 {metrics['disk']['total_gb']} GB)</p>
        <p style="margin: 4px 0; color: #94a3b8;">🧠 <strong>RAM 사용률</strong>: {metrics['memory']['percent']}% (여유: {metrics['memory']['free_gb']} GB / 총 {metrics['memory']['total_gb']} GB)</p>
        <p style="margin: 4px 0; color: #94a3b8;">⏰ <strong>발송 시각</strong>: {metrics['timestamp']}</p>
      </div>
      <p style="font-size: 12px; color: #64748b;">수신 대상: {', '.join(recipients or monitor_service.get_all_target_emails())}</p>
    </div>
    """

    delivered = monitor_service.send_alert_email(subject, body_html, recipients=recipients)
    return {
        "success": True,
        "message": "테스트 사전 경보가 관리자 수신 목록으로 발송되었습니다.",
        "recipients": recipients or monitor_service.get_all_target_emails(),
        "delivered": delivered,
        "metrics": metrics
    }


@router.get("/history", summary="최근 경보 발송 히스토리 조회")
async def get_alert_history():
    """최근 발생한 경보 발송 내역을 반환합니다."""
    return {
        "success": True,
        "total": len(monitor_service.alert_history),
        "history": monitor_service.alert_history
    }
