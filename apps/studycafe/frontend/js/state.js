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
