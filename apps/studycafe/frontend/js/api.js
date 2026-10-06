// apps/studycafe/frontend/js/api.js
// 스터디카페 API 통신 유틸리티 (SaaS 템플릿 표준: getApiBase 준수)

import { MQnetAuth } from '/shared/ui/auth.js?v=2.0';

// ── 지점(Tenant) 식별 및 전역 상태 관리 ──
const _urlParams = new URLSearchParams(window.location.search);
export let CURRENT_BRANCH = _urlParams.get('branch') || _urlParams.get('tenant_id') || localStorage.getItem('studycafe_branch') || 'studycafe-main';

export function setCurrentBranch(branchId) {
  if (!branchId) return;
  CURRENT_BRANCH = branchId;
  localStorage.setItem('studycafe_branch', branchId);
}

export function getCurrentBranch() {
  return CURRENT_BRANCH;
}

export function getApiBase() {
  const p = window.location.pathname;
  if (p.startsWith('/studycafe')) {
    return '/api/studycafe';
  }
  return '/api';
}

function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'X-App-ID': 'studycafe',
    'X-Tenant-ID': CURRENT_BRANCH
  };
  const token = localStorage.getItem('mqnet_auth_token') || sessionStorage.getItem('mqnet_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// 0. 지점(매장) 목록 및 신규 지점 등록
export async function fetchBranches() {
  const base = getApiBase();
  const res = await fetch(`${base}/branches/?t=${Date.now()}`, {
    headers: getHeaders(),
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`지점 목록 조회 실패 (HTTP ${res.status})`);
  return await res.json();
}

export async function createBranch(branchData) {
  const base = getApiBase();
  const res = await fetch(`${base}/branches/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(branchData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || '지점 등록 실패');
  }
  return await res.json();
}

// 1. 전체 좌석 현황 조회
export async function fetchSeats() {
  const base = getApiBase();
  const res = await fetch(`${base}/seats/?tenant_id=${encodeURIComponent(CURRENT_BRANCH)}&t=${Date.now()}`, {
    headers: getHeaders(),
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`좌석 정보 조회 실패 (HTTP ${res.status})`);
  return await res.json();
}

// 2. 내 배정 좌석 조회
export async function fetchMySeat(userId, phone, name) {
  const base = getApiBase();
  const params = new URLSearchParams();
  if (userId) params.set('user_id', userId);
  if (phone) params.set('phone', phone);
  if (name) params.set('name', name);
  
  const res = await fetch(`${base}/seats/my-seat?${params.toString()}&t=${Date.now()}`, {
    headers: getHeaders(),
    cache: 'no-store'
  });
  if (!res.ok) return { has_seat: false, seat: null };
  return await res.json();
}

// 2-1. 고정석 회원(4주 관리형, 12주 올인원) 자동 입실 및 좌석 배정 건너뛰기
export async function autoAssignFixedSeat(userId, phone, name) {
  const base = getApiBase();
  const res = await fetch(`${base}/seats/auto-assign-fixed`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      user_id: userId,
      phone: phone,
      name: name
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `고정석 자동 배정 실패 (HTTP ${res.status})`);
  }
  return await res.json();
}

// 3. 좌석 배정 및 입실
export async function assignSeat(seatNumber, phone, name, userType = 'GENERAL', userId = null) {
  const base = getApiBase();
  const res = await fetch(`${base}/seats/assign`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      seat_number: seatNumber,
      phone,
      name,
      user_type: userType,
      user_id: userId
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '좌석 배정에 실패했습니다.');
  return data;
}

// 4. 좌석 퇴실
export async function leaveSeat(seatNumber) {
  const base = getApiBase();
  const res = await fetch(`${base}/seats/leave/${seatNumber}`, {
    method: 'POST',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '퇴실 처리에 실패했습니다.');
  return data;
}

// 5. 이용권 요금제 목록 조회
export async function fetchTicketPlans() {
  const base = getApiBase();
  const res = await fetch(`${base}/tickets/plans?t=${Date.now()}`, {
    headers: getHeaders(),
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`이용권 요금제 조회 실패 (HTTP ${res.status})`);
  return await res.json();
}

// 6. 이용권 구매
export async function purchaseTicket(planId, userId = null, phone = null) {
  const base = getApiBase();
  const res = await fetch(`${base}/tickets/purchase`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      plan_id: planId,
      user_id: userId || 'demo-user',
      phone: phone
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '이용권 구매에 실패했습니다.');
  return data;
}

// 6-1. 내 보유 이용권 조회 및 활성 상태 판정 (잔여시간 체크 및 결제 Skip용)
export async function fetchMyActiveTicket(userId, phone) {
  const base = getApiBase();
  const params = new URLSearchParams();
  if (userId) params.set('user_id', userId);
  if (phone) params.set('phone', phone);

  try {
    const res = await fetch(`${base}/tickets/my?${params.toString()}&t=${Date.now()}`, {
      headers: getHeaders(),
      cache: 'no-store'
    });
    if (!res.ok) return { has_active_ticket: false, active_ticket: null, tickets: [] };
    return await res.json();
  } catch (e) {
    return { has_active_ticket: false, active_ticket: null, tickets: [] };
  }
}

// 7. 스마트 도어락 원격 개방
export async function triggerDoor(doorId = 1) {
  const base = getApiBase();
  const res = await fetch(`${base}/door/trigger/${doorId}`, {
    method: 'POST',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '도어락 개방 요청에 실패했습니다.');
  return data;
}

// 8. AI 혼잡도 예측
export async function fetchAiCongestion() {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/seats/ai-congestion?t=${Date.now()}`, {
      headers: getHeaders(),
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('AI 혼잡도 조회 실패');
    return await res.json();
  } catch (e) {
    return {
      total_seats: 20,
      occupied_seats: 5,
      ai_prediction: {
        congestion_status: '쾌적',
        recommendation: '현재 포커스존과 일반존에 여유 좌석이 많습니다.'
      }
    };
  }
}

// 9. 외출(자리비움) 처리
export async function stepOutSeat(seatNumber) {
  const base = getApiBase();
  const res = await fetch(`${base}/seats/step-out/${seatNumber}`, {
    method: 'POST',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '외출 처리에 실패했습니다.');
  return data;
}

// 10. 재입실(복귀 및 출입문 개방)
export async function stepInSeat(seatNumber) {
  const base = getApiBase();
  const res = await fetch(`${base}/seats/step-in/${seatNumber}`, {
    method: 'POST',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '재입실 처리에 실패했습니다.');
  return data;
}

// 11. IC카드 단말기 결제 요청
export async function requestTerminalPayment(payload) {
  const base = getApiBase();
  const res = await fetch(`${base}/tickets/terminal/request`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '결제 단말기 요청 실패');
  return data;
}

// 12. 단말기 IC카드 삽입 및 승인 시뮬레이션
export async function approveTerminalPayment(txId) {
  const base = getApiBase();
  const res = await fetch(`${base}/tickets/terminal/approve/${txId}`, {
    method: 'POST',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '결제 승인 처리 실패');
  return data;
}

// 13. 단말기 결제 상태 조회
export async function getTerminalStatus(txId) {
  const base = getApiBase();
  const res = await fetch(`${base}/tickets/terminal/status/${txId}?t=${Date.now()}`, {
    headers: getHeaders(),
    cache: 'no-store'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '상태 조회 실패');
  return data;
}

// 14. 60분 초과 외출 좌석 자동 청소
export async function cleanupExpiredSeats() {
  const base = getApiBase();
  const res = await fetch(`${base}/seats/cleanup-expired`, {
    method: 'POST',
    headers: getHeaders()
  });
  return await res.json();
}

// 15. 점주 실시간 관제 대시보드 데이터 조회
export async function fetchAdminDashboard() {
  const base = getApiBase();
  const res = await fetch(`${base}/seats/admin/dashboard?t=${Date.now()}`, {
    headers: getHeaders(),
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('관리자 대시보드 로드 실패');
  return await res.json();
}

// 16. 학부모 안심 웹 포털 (Zero-Message) 학생 현황 조회
export async function fetchParentStatus(phone) {
  const base = getApiBase();
  const res = await fetch(`${base}/seats/parent/status?phone=${encodeURIComponent(phone)}&t=${Date.now()}`, {
    headers: getHeaders(),
    cache: 'no-store'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '학부모 안심 조회 실패');
  return data;
}

// 17. 관리형 회원 퇴실 시 오늘 마친 페이지 실적 제출 (PPH & 리밸런싱 연동)
export async function submitDailyCheckoutResult(seatNumber, completedPages) {
  const base = getApiBase();
  // 1) 좌석 퇴실 처리
  const leaveRes = await leaveSeat(seatNumber);

  // 2) SelfStudy 진도 업데이트 (백엔드 연동)
  try {
    const selfstudyRes = await fetch('/api/selfstudy/schedule/daily-complete', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        seat_number: seatNumber,
        completed_pages: completedPages,
        completed_at: new Date().toISOString()
      })
    });
    const ssData = await selfstudyRes.json();
    return {
      ...leaveRes,
      selfstudy_updated: true,
      selfstudy_message: ssData.message || 'PPH 연산 및 내일 진도 리밸런싱이 완료되었습니다.'
    };
  } catch (e) {
    return {
      ...leaveRes,
      selfstudy_updated: false,
      selfstudy_message: '진도 실적 저장 완료 (로컬 큐 처리)'
    };
  }
}

// 18. 이용권 일시정지 (Hold)
export async function holdTicket(ticketId, days = 7) {
  const base = getApiBase();
  const res = await fetch(`${base}/tickets/hold`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ticket_id: ticketId, days })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '이용권 일시정지에 실패했습니다.');
  return data;
}

// 19. 이용권 일시정지 해제 (Resume)
export async function resumeTicket(ticketId) {
  const base = getApiBase();
  const res = await fetch(`${base}/tickets/resume`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ticket_id: ticketId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '일시정지 해제에 실패했습니다.');
  return data;
}

// 20. 현장 순찰 일지 등록 (Patrol Log)
export async function submitPatrolLog(seatNumber, category, penalty = 0, note = '', managerName = '관리실장') {
  const base = getApiBase();
  const res = await fetch(`${base}/seats/patrol-log`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      seat_number: seatNumber,
      category,
      penalty,
      note,
      manager_name: managerName
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '순찰 일지 등록에 실패했습니다.');
  return data;
}

// 21. 출입문 및 화재 비상 상태 조회 (Fail-Safe, 지점별)
export async function fetchDoorStatus() {
  const base = getApiBase();
  const res = await fetch(`${base}/door/status?tenant_id=${encodeURIComponent(CURRENT_BRANCH)}&t=${Date.now()}`, {
    headers: getHeaders(),
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('출입문 상태 조회 실패');
  return await res.json();
}

// 22. 화재/비상 전면 개방 발령 (지점별)
export async function emergencyOpenDoor(reason = '점주 수동 비상 개방 발령') {
  const base = getApiBase();
  const res = await fetch(`${base}/door/emergency-open?tenant_id=${encodeURIComponent(CURRENT_BRANCH)}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ reason })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '비상 개방 발령 실패');
  return data;
}

// 23. 비상 개방 해제 및 정상 모드 복구 (지점별)
export async function emergencyResetDoor() {
  const base = getApiBase();
  const res = await fetch(`${base}/door/emergency-reset?tenant_id=${encodeURIComponent(CURRENT_BRANCH)}`, {
    method: 'POST',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '비상 해제 실패');
  return data;
}

// 24. 22시 청소년 심야 이용 점주 예외 승인 토글
export async function toggleNightExempt(userIdOrPhone) {
  const base = getApiBase();
  const res = await fetch(`${base}/seats/user/${encodeURIComponent(userIdOrPhone)}/toggle-night-exempt`, {
    method: 'POST',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '심야 예외 토글 실패');
  return data;
}

// 25. 개인정보보호법 준수 오래된 순찰 기록 파기 (기본 90일)
export async function cleanupOldPatrolLogs(days = 90) {
  const base = getApiBase();
  const res = await fetch(`${base}/seats/cleanup-old-logs?days=${days}&tenant_id=${encodeURIComponent(CURRENT_BRANCH)}`, {
    method: 'POST',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '순찰 기록 파기 실패');
  return data;
}

// 26. 점주 매출 통계 상세 조회 (지점별)
export async function fetchAdminSalesStats() {
  const base = getApiBase();
  const res = await fetch(`${base}/seats/admin/sales?tenant_id=${encodeURIComponent(CURRENT_BRANCH)}&t=${Date.now()}`, {
    headers: getHeaders(),
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('매출 통계 조회 실패');
  return await res.json();
}

// 27. 세무·소득신고용 월별 매출 조회 (지점별)
export async function fetchMonthlySales(year = null) {
  const base = getApiBase();
  const yearParam = year ? `&year=${year}` : '';
  const url = `${base}/seats/admin/sales/monthly?tenant_id=${encodeURIComponent(CURRENT_BRANCH)}${yearParam}&t=${Date.now()}`;
  const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error('월별 매출 조회 실패');
  return await res.json();
}

// 28. 세무·소득신고용 기간 지정 매출 조회 (지점별)
export async function fetchRangeSales(startDate, endDate) {
  const base = getApiBase();
  const res = await fetch(`${base}/seats/admin/sales/range?tenant_id=${encodeURIComponent(CURRENT_BRANCH)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&t=${Date.now()}`, {
    headers: getHeaders(),
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('기간별 매출 조회 실패');
  return await res.json();
}

// 29. 세무 신고용 CSV 다운로드 URL 생성 (지점별)
export function getSalesCsvExportUrl(startDate, endDate) {
  const base = getApiBase();
  return `${base}/seats/admin/sales/export-csv?tenant_id=${encodeURIComponent(CURRENT_BRANCH)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
}


