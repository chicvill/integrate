"""
shared/auth/models.py
모든 앱이 공통으로 사용하는 User ORM 모델.
app_id 컬럼으로 어떤 앱의 회원인지 구분합니다.
"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from shared.core.base_database import Base, TimestampMixin, AppIdMixin


class User(Base, TimestampMixin, AppIdMixin):
    """
    통합 회원 모델.
    모든 앱의 회원이 하나의 테이블에 저장되며,
    app_id 컬럼으로 앱별 데이터 격리가 이루어집니다.
    
    상속 확장 예시 (각 앱에서):
        class StudyCafeMember(User):
            # 스터디카페 전용 컬럼은 별도 테이블에서 외래키로 연결
            __abstract__ = False
    """
    __tablename__ = "users"

    # 기본 식별자
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    
    # 인증 정보
    email = Column(String(255), nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    
    # 프로필
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    
    # 권한/역할
    role = Column(String(50), nullable=False, default="user")
    # role 값 예시:
    #   "user"       - 일반 사용자
    #   "admin"      - 해당 앱 관리자
    #   "superadmin" - 플랫폼 전체 관리자
    #   "owner"      - 매장/시설 오너
    #   "staff"      - 직원
    
    # 상태
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # 구독/요금제 (앱별 과금 정보)
    plan_id = Column(String(50), default="free")
    billing_status = Column(String(50), default="trial")
    # billing_status: trial | active | expired | cancelled
    
    # 테넌트 (매장/시설 식별자) - 멀티 테넌트 지원
    tenant_id = Column(String(100), nullable=True, index=True)

    def to_dict(self, include_sensitive: bool = False) -> dict:
        """안전한 사용자 정보 딕셔너리 반환 (비밀번호 제외)"""
        result = {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "phone": self.phone,
            "role": self.role,
            "app_id": self.app_id,
            "tenant_id": self.tenant_id,
            "plan_id": self.plan_id,
            "billing_status": self.billing_status,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_sensitive:
            result["hashed_password"] = self.hashed_password
        return result
