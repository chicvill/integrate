// apps/studycafe/frontend/js/state.js
// 반응형 상태 관리 모듈

export const state = {
  activeTab: 'seats', // 'seats' | 'tickets' | 'door' | 'selfstudy'
  selectedZone: 'ALL', // 'ALL' | 'FOCUS' | 'NORMAL' | 'LAPTOP'
  seats: [],
  totalSeats: 20,
  occupiedCount: 0,
  availableCount: 20,
  congestion: { status: '쾌적', level: 'LOW', recommendation: '포커스존 또는 일반존을 자유롭게 이용하세요.' },
  
  tickets: [],
  userTickets: [],
  activeTicket: null, // { id, ticket_type, remaining_minutes, valid_until, is_managed }
  
  mySeat: null, // { seat_number, zone_type, status, user_name, check_in_at }
  currentUser: null, // MQnetAuth 사용자 객체
  
  doorStatus: {
    isOpen: false,
    remainingSeconds: 0,
    logs: []
  },

  // 셀프스터디 연동 요약 상태
  selfstudySummary: {
    todayFocusMinutes: 145,
    todayGoalMinutes: 300,
    activeSubject: '수학',
    completedTasks: 3,
    totalTasks: 5
  }
};

/** 🎯 당일권 판정 (2시간 당일권, 4시간 당일권, hourly 요금제) */
export function isSameDayTicket(ticket) {
  if (!ticket) return false;
  const name = ticket.ticket_type || ticket.name || '';
  if (name.includes('당일')) return true;
  if (ticket.plan_id === 'time_2h' || ticket.plan_id === 'time_4h') return true;
  if (ticket.type === 'hourly') return true;
  if (ticket.duration_minutes && ticket.duration_minutes <= 240) return true;
  return false;
}

/** 🎯 당일권이 아닌 회원으로 유효 사용기간 중인 이용권 판정 (정기권, 기간권, 관리형 패스) */
export function isActiveNonSameDayTicket(ticket) {
  if (!ticket || !ticket.is_active) return false;
  if (ticket.is_held) return false;
  if (isSameDayTicket(ticket)) return false;

  // 유효 기간 및 잔여 시간 확인
  const now = new Date();
  if (ticket.valid_until) {
    const validUntil = new Date(ticket.valid_until);
    if (validUntil < now) return false;
  }
  if (ticket.remaining_minutes !== undefined && ticket.remaining_minutes !== null && ticket.remaining_minutes <= 0) {
    return false;
  }
  return true;
}

/** 🎯 4주 관리형 프리미엄 패스 또는 12주 D-day 올인원 패스 판정 (고정석 배정 및 LMS 허용 대상) */
export function isFixedSeatManagedTicket(ticket) {
  if (!ticket) return false;
  const name = ticket.ticket_type || ticket.name || '';
  if (name.includes('4주 관리형') || name.includes('관리형 프리미엄') || name.includes('12주') || name.includes('올인원')) {
    return true;
  }
  if (ticket.plan_id === 'managed_4w' || ticket.plan_id === 'managed_12w') {
    return true;
  }
  if (ticket.type === 'managed' || name.includes('관리형')) {
    return true;
  }
  return false;
}

/** 🎯 자기주도학습 LMS 연동 사용 권한 확인 (당일권/정기권 차단, 관리형 패스 회원만 허용) */
export function isLmsAllowed(user, ticket) {
  if (ticket && isFixedSeatManagedTicket(ticket) && ticket.is_active && !ticket.is_held) {
    return true;
  }
  if (user && user.user_type === 'MANAGED') {
    return true;
  }
  return false;
}
