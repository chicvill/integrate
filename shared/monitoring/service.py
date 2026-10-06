"""
shared/monitoring/service.py
서버 저장공간(Disk) 및 메모리(RAM) 한계 사전 감지 & 앱별 관리자 이메일 경보 모니터링 데몬.
- psutil 기반 실시간 디스크/메모리 사용률 측정
- 80% 주의, 90% 긴급 단계별 사전 알림
- 앱별 관리자 이메일 동적 설정 및 영속화 (초기값: himin5004@gmail.com)
- 알림 중복 폭주 방지(Cooldown) 및 알림 히스토리 관리
"""
import os
import json
import time
import smtplib
import logging
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List, Optional
import psutil

logger = logging.getLogger("mqnet.monitoring")

CONFIG_FILE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "monitoring_config.json"))

DEFAULT_CONFIG: Dict[str, Any] = {
    "enabled": True,
    "adaptive_interval_enabled": True,  # 상태별 동적 가변 주기 (70%미만 30분, 70%~80% 10분, 80%이상 3분)
    "interval_normal_seconds": 1800,    # ~70% 미만: 30분
    "interval_caution_seconds": 600,    # 70%~80% 구간: 10분
    "interval_critical_seconds": 180,   # 80% 초과 긴급 구간: 3분
    "disk_warning_percent": 80.0,
    "disk_critical_percent": 90.0,
    "memory_warning_percent": 85.0,
    "cooldown_minutes": 60,  # 동일 알림 재발송 방지 1시간
    "default_admin_email": "himin5004@gmail.com",
    "app_admin_emails": {
        "gateway": "himin5004@gmail.com",
        "studycafe": "himin5004@gmail.com",
        "selfstudy": "himin5004@gmail.com",
        "store": "himin5004@gmail.com",
        "mqfarm": "himin5004@gmail.com",
        "photos": "himin5004@gmail.com",
        "saas-template": "himin5004@gmail.com"
    },
    "smtp": {
        "enabled": False,
        "host": "smtp.gmail.com",
        "port": 587,
        "username": "",
        "password": "",
        "from_email": "mqnet-system@noreply.com"
    }
}


class StorageMonitorService:
    def __init__(self):
        self.config = self._load_config()
        self.is_running = False
        self._thread: Optional[threading.Thread] = None
        self._last_alert_time: Dict[str, float] = {}  # {level: timestamp}
        self.alert_history: List[Dict[str, Any]] = []

    def _load_config(self) -> Dict[str, Any]:
        """설정 파일 로드 (없으면 기본값 생성)"""
        if os.path.exists(CONFIG_FILE_PATH):
            try:
                with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    # 누락된 기본 키 병합
                    for k, v in DEFAULT_CONFIG.items():
                        if k not in data:
                            data[k] = v
                    return data
            except Exception as e:
                logger.error(f"모니터링 설정 로드 오류: {e}")
        self._save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()

    def _save_config(self, cfg: Dict[str, Any]):
        """설정 파일 디스크 영속화"""
        try:
            os.makedirs(os.path.dirname(CONFIG_FILE_PATH), exist_ok=True)
            with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(cfg, f, ensure_ascii=False, indent=2)
            self.config = cfg
        except Exception as e:
            logger.error(f"모니터링 설정 저장 실패: {e}")

    def update_config(self, new_cfg: Dict[str, Any]) -> Dict[str, Any]:
        """앱별 관리자 이메일 및 임계치 업데이트"""
        current = self._load_config()
        if "default_admin_email" in new_cfg and new_cfg["default_admin_email"]:
            current["default_admin_email"] = new_cfg["default_admin_email"].strip()
        if "app_admin_emails" in new_cfg and isinstance(new_cfg["app_admin_emails"], dict):
            current["app_admin_emails"].update(new_cfg["app_admin_emails"])
        if "disk_warning_percent" in new_cfg:
            current["disk_warning_percent"] = float(new_cfg["disk_warning_percent"])
        if "disk_critical_percent" in new_cfg:
            current["disk_critical_percent"] = float(new_cfg["disk_critical_percent"])
        if "memory_warning_percent" in new_cfg:
            current["memory_warning_percent"] = float(new_cfg["memory_warning_percent"])
        if "check_interval_seconds" in new_cfg:
            current["check_interval_seconds"] = int(new_cfg["check_interval_seconds"])
        if "enabled" in new_cfg:
            current["enabled"] = bool(new_cfg["enabled"])
        if "smtp" in new_cfg and isinstance(new_cfg["smtp"], dict):
            current["smtp"].update(new_cfg["smtp"])

        self._save_config(current)
        return current

    def get_email_for_app(self, app_id: str) -> str:
        """특정 앱의 담당 관리자 이메일 조회 (미지정 시 기본 이메일 반환)"""
        emails = self.config.get("app_admin_emails", {})
        return emails.get(app_id) or self.config.get("default_admin_email", "himin5004@gmail.com")

    def get_all_target_emails(self) -> List[str]:
        """알림을 수신할 모든 관리자 이메일 목록(중복 제거)"""
        result = set()
        default_email = self.config.get("default_admin_email", "himin5004@gmail.com")
        if default_email:
            result.add(default_email)
        for email in self.config.get("app_admin_emails", {}).values():
            if email and email.strip():
                result.add(email.strip())
        return sorted(list(result))

    def get_system_metrics(self) -> Dict[str, Any]:
        """현재 시스템 저장공간(디스크) 및 메모리 실시간 지표 반환"""
        # 디스크 (작업 디렉토리 기준)
        try:
            cwd_root = os.path.splitdrive(os.getcwd())[0] or "/"
            if os.name == "nt" and not cwd_root.endswith("\\"):
                cwd_root += "\\"
            disk = psutil.disk_usage(cwd_root)
            disk_total_gb = round(disk.total / (1024 ** 3), 2)
            disk_used_gb = round(disk.used / (1024 ** 3), 2)
            disk_free_gb = round(disk.free / (1024 ** 3), 2)
            disk_percent = disk.percent
        except Exception:
            disk_total_gb = disk_used_gb = disk_free_gb = disk_percent = 0.0

        # 메모리
        try:
            mem = psutil.virtual_memory()
            mem_total_gb = round(mem.total / (1024 ** 3), 2)
            mem_used_gb = round(mem.used / (1024 ** 3), 2)
            mem_free_gb = round(mem.available / (1024 ** 3), 2)
            mem_percent = mem.percent
        except Exception:
            mem_total_gb = mem_used_gb = mem_free_gb = mem_percent = 0.0

        return {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "disk": {
                "total_gb": disk_total_gb,
                "used_gb": disk_used_gb,
                "free_gb": disk_free_gb,
                "percent": disk_percent,
                "is_warning": disk_percent >= self.config.get("disk_warning_percent", 80.0),
                "is_critical": disk_percent >= self.config.get("disk_critical_percent", 90.0),
            },
            "memory": {
                "total_gb": mem_total_gb,
                "used_gb": mem_used_gb,
                "free_gb": mem_free_gb,
                "percent": mem_percent,
                "is_warning": mem_percent >= self.config.get("memory_warning_percent", 85.0),
            }
        }

    def send_alert_email(self, subject: str, body_html: str, recipients: Optional[List[str]] = None) -> bool:
        """관리자 이메일 발송 실행"""
        target_emails = recipients or self.get_all_target_emails()
        if not target_emails:
            target_emails = ["himin5004@gmail.com"]

        smtp_cfg = self.config.get("smtp", {})
        alert_record = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "subject": subject,
            "recipients": target_emails,
            "delivered": False,
            "method": "SMTP" if smtp_cfg.get("enabled") else "SYSTEM_LOG"
        }

        # 1. 실제 SMTP 발송 시도 (설정된 경우)
        if smtp_cfg.get("enabled") and smtp_cfg.get("username") and smtp_cfg.get("password"):
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = smtp_cfg.get("from_email", smtp_cfg.get("username"))
                msg["To"] = ", ".join(target_emails)
                msg.attach(MIMEText(body_html, "html", "utf-8"))

                with smtplib.SMTP(smtp_cfg.get("host", "smtp.gmail.com"), smtp_cfg.get("port", 587)) as server:
                    server.starttls()
                    server.login(smtp_cfg["username"], smtp_cfg["password"])
                    server.sendmail(msg["From"], target_emails, msg.as_string())
                alert_record["delivered"] = True
                logger.info(f"경보 이메일 발송 성공 -> {target_emails}")
            except Exception as e:
                logger.error(f"SMTP 이메일 전송 실패: {e}")
                alert_record["error"] = str(e)
        else:
            # 2. 로컬 콘솔 및 시스템 경보 로깅 (SMTP 미설정 시에도 안전하게 알림 큐 기록)
            logger.warning(f"🚨 [STORAGE ALERT EMAIL QUEUE] 수신자: {target_emails}\n제목: {subject}\n{body_html[:300]}...")
            alert_record["delivered"] = True
            alert_record["note"] = "SMTP 미설정으로 시스템 경보 큐 및 관제 로그에 성공적으로 기록되었습니다."

        self.alert_history.insert(0, alert_record)
        if len(self.alert_history) > 100:
            self.alert_history = self.alert_history[:100]

        return alert_record["delivered"]

    def evaluate_and_notify(self, force: bool = False) -> Optional[Dict[str, Any]]:
        """시스템 상태 평가 및 임계치 초과 시 경보 트리거"""
        metrics = self.get_system_metrics()
        disk_pct = metrics["disk"]["percent"]
        mem_pct = metrics["memory"]["percent"]

        disk_warn = self.config.get("disk_warning_percent", 80.0)
        disk_crit = self.config.get("disk_critical_percent", 90.0)
        mem_warn = self.config.get("memory_warning_percent", 85.0)
        cooldown = self.config.get("cooldown_minutes", 60) * 60

        now = time.time()
        level = None

        if disk_pct >= disk_crit:
            level = "CRITICAL"
        elif disk_pct >= disk_warn or mem_pct >= mem_warn:
            level = "WARNING"

        if not level and not force:
            return None

        # 쿨다운 검사
        if not force and level in self._last_alert_time:
            if (now - self._last_alert_time[level]) < cooldown:
                logger.debug(f"경보 쿨다운 유지 중 ({level})")
                return None

        if level:
            self._last_alert_time[level] = now

        # 이메일 메시지 조립
        prefix = "🚨 [긴급/CRITICAL]" if level == "CRITICAL" else "⚠️ [주의/WARNING]"
        subject = f"{prefix} MQnet 구글 서버 저장 메모리 한계 경보 (디스크 {disk_pct}%, RAM {mem_pct}%)"
        
        body_html = f"""
        <div style="font-family: Pretendard, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #0f172a; color: #f8fafc;">
          <h2 style="color: {'#ef4444' if level == 'CRITICAL' else '#f59e0b'}; margin-top: 0;">
            {prefix} 서버 용량 한계 사전 경보
          </h2>
          <p style="color: #cbd5e1; font-size: 14px;">
            구글 서버의 저장 메모리가 사전 설정된 임계치에 도달하였습니다. 서비스 장애를 방지하기 위해 사전 조치를 취해주십시오.
          </p>
          <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin: 15px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #f1f5f9;">
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">💾 <strong>디스크 사용률</strong>:</td>
                <td style="padding: 6px 0; text-align: right; color: {'#f87171' if disk_pct >= disk_warn else '#38bdf8'}; font-weight: bold;">
                  {disk_pct}% ({metrics['disk']['used_gb']} GB 사용 / {metrics['disk']['free_gb']} GB 여유 / 총 {metrics['disk']['total_gb']} GB)
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">🧠 <strong>RAM 사용률</strong>:</td>
                <td style="padding: 6px 0; text-align: right; color: {'#f87171' if mem_pct >= mem_warn else '#38bdf8'}; font-weight: bold;">
                  {mem_pct}% ({metrics['memory']['used_gb']} GB 사용 / {metrics['memory']['free_gb']} GB 여유 / 총 {metrics['memory']['total_gb']} GB)
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">⏰ <strong>측정 시각</strong>:</td>
                <td style="padding: 6px 0; text-align: right;">{metrics['timestamp']}</td>
              </tr>
            </table>
          </div>
          <div style="background: rgba(56, 189, 248, 0.1); border-left: 4px solid #38bdf8; padding: 10px 14px; border-radius: 4px; font-size: 13px; color: #bae6fd;">
            <strong>권장 운영 조치:</strong><br/>
            1. 임시 캐시 디렉토리(<code>/cache</code>, <code>dist</code> 빌드 산출물, 오래된 로그 파일) 정리<br/>
            2. GCP 콘솔에서 디스크 볼륨 확장 또는 불필요한 백업 데이터 외부 오브젝트 스토리지로 이전<br/>
            3. 메모리 누수 발생 프로세스 점검
          </div>
          <p style="font-size: 11px; color: #64748b; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
            본 알림은 MQnet 자동 모니터링 데몬 시스템에서 등록된 관리자 이메일({', '.join(self.get_all_target_emails())})로 자동 발송되었습니다.
          </p>
        </div>
        """

        self.send_alert_email(subject, body_html)
        return {"level": level, "subject": subject, "metrics": metrics}

    def compute_next_check_interval(self, metrics: Optional[Dict[str, Any]] = None) -> int:
        """
        저장 메모리 사용률에 따른 동적 가변 주기 계산:
        - 80% 이상 (경고/위험): 3분 (180초) 집중 감시
        - 70% ~ 80% (주의 진입): 10분 (600초) 감시
        - ~70% 미만 (정상/여유): 30분 (1800초) 저부하 감시
        """
        if not self.config.get("adaptive_interval_enabled", True):
            return int(self.config.get("check_interval_seconds", 180))

        if not metrics:
            metrics = self.get_system_metrics()

        disk_pct = metrics["disk"]["percent"]
        mem_pct = metrics["memory"]["percent"]

        if disk_pct >= 80.0 or mem_pct >= 85.0:
            return int(self.config.get("interval_critical_seconds", 180))   # 3분
        elif disk_pct >= 70.0 or mem_pct >= 75.0:
            return int(self.config.get("interval_caution_seconds", 600))    # 10분
        else:
            return int(self.config.get("interval_normal_seconds", 1800))    # 30분

    def _daemon_loop(self):
        """백그라운드 모니터링 무한 루프 (가변 동적 주기 적용)"""
        logger.info("MQnet 저장 메모리 백그라운드 모니터링 데몬 가동 시작 (동적 가변 주기 활성화).")
        while self.is_running:
            metrics = None
            try:
                if self.config.get("enabled", True):
                    res = self.evaluate_and_notify()
                    metrics = (res and res.get("metrics")) or self.get_system_metrics()
            except Exception as e:
                logger.error(f"모니터링 데몬 루프 에러: {e}")

            interval = self.compute_next_check_interval(metrics)
            logger.debug(f"다음 모니터링 검사까지 대기: {interval}초 ({round(interval/60, 1)}분)")
            for _ in range(interval):
                if not self.is_running:
                    break
                time.sleep(1)

    def start(self):
        """데몬 스레드 가동"""
        if self.is_running:
            return
        self.is_running = True
        self._thread = threading.Thread(target=self._daemon_loop, daemon=True, name="StorageMonitorDaemon")
        self._thread.start()
        logger.info("MQnet StorageMonitorDaemon 시작됨.")

    def stop(self):
        """데몬 스레드 정지"""
        self.is_running = False
        if self._thread:
            self._thread.join(timeout=2)
            logger.info("MQnet StorageMonitorDaemon 정지됨.")


monitor_service = StorageMonitorService()
