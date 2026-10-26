// apps/selfstudy/frontend/js/state.js
// 자기주도학습 반응형 상태 관리 모듈

export const state = {
  activeTab: 'planner', // 'timer' | 'planner' | 'ai' | 'report'
  
  // 타이머 & 뽀모도로 상태
  timer: {
    mode: 'pomodoro', // 'pomodoro' (25분 카운트다운) | 'stopwatch' (카운트업)
    isRunning: false,
    intervalId: null,
    remainingSeconds: 25 * 60,
    elapsedSeconds: 0,
    pomodoroInitialSeconds: 25 * 60,
    todayFocusSeconds: 145 * 60, // 2시간 25분 기본 시드
    todayGoalSeconds: 300 * 60,  // 5시간 목표
    activeSubject: '수학',
    activeTaskId: null,
    activeTask: null,
    whiteNoiseEnabled: true
  },

  // 과목 및 계획 목록
  subjects: ['수학', '영어', '국어', '탐구', '한국사'],
  plans: [],
  tasks: [
    { id: 1, subject: '수학', bookName: '수학기본서', startPage: 1, goalPage: 6, minutes: 48, startTime: null, expectedEndTime: null, completedPage: null, endTime: null, pph: null, status: 'ready', done: false },
    { id: 2, subject: '영어', bookName: '수능특강 영어', startPage: 1, goalPage: 4, minutes: 48, startTime: null, expectedEndTime: null, completedPage: null, endTime: null, pph: null, status: 'ready', done: false },
    { id: 3, subject: '국어', bookName: '국어 비문학', startPage: 1, goalPage: 5, minutes: 48, startTime: null, expectedEndTime: null, completedPage: null, endTime: null, pph: null, status: 'ready', done: false },
    { id: 4, subject: '탐구', bookName: '물리학 개념완성', startPage: 1, goalPage: 6, minutes: 48, startTime: null, expectedEndTime: null, completedPage: null, endTime: null, pph: null, status: 'ready', done: false },
    { id: 5, subject: '한국사', bookName: '한국사 압축정리', startPage: 1, goalPage: 4, minutes: 48, startTime: null, expectedEndTime: null, completedPage: null, endTime: null, pph: null, status: 'ready', done: false }
  ],

  // AI 멘토와의 대화 기록
  aiChat: [
    {
      id: 1,
      sender: 'ai',
      text: '반갑습니다! StudyCafe 자기주도학습 전담 AI 멘토입니다. 오늘 세운 목표 달성을 위해 어떤 과목부터 집중해 볼까요?',
      time: '오전 09:00'
    }
  ],

  // 스터디카페 연동 상태 (부모 앱 StudyCafe 좌석 정보)
  studycafeSeat: {
    hasSeat: false,
    seatNumber: null,
    zoneType: null,
    userType: 'GENERAL',
    checkInAt: null
  },

  // D-day 맞춤 진도계획표
  curriculum: null,

  // 사용자 정보
  currentUser: null
};

// 로컬스토리지 저장 진도계획 및 태스크 복원
try {
  const savedTasks = localStorage.getItem('mqnet_selfstudy_tasks');
  const savedCurr = localStorage.getItem('mqnet_selfstudy_curriculum');
  
  if (savedCurr) {
    state.curriculum = JSON.parse(savedCurr);
  }

  if (savedTasks) {
    state.tasks = JSON.parse(savedTasks);
  } else if (state.curriculum && state.curriculum.todayOrders && state.curriculum.todayOrders.length > 0) {
    state.tasks = state.curriculum.todayOrders.map((o, idx) => ({
      id: idx + 1,
      subject: o.subject,
      bookName: o.bookName || `${o.subject} 기본서`,
      startPage: o.startPage,
      goalPage: o.todayGoalPage,
      dailyPages: o.dailyPages,
      minutes: o.minutes || 48,
      startTime: null,
      startTimestamp: null,
      expectedEndTime: null,
      completedPage: null,
      endTime: null,
      endTimestamp: null,
      actualMinutes: null,
      pph: null,
      status: 'ready',
      done: false
    }));
  }
} catch (_) {}

