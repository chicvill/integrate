/**
 * apps/rent/frontend/js/state.js
 * 원룸 임차료 관리 시스템 전역 반응형 상태 관리 모듈.
 * 백엔드(integrat.db) 실시간 동기화 및 오프라인 localStorage 폴백 지원.
 */

import { apiGetRooms, apiGetExpenses, apiGetBranches, apiGetTenantHistories } from './api.js?v=2.0';

export const STORAGE_KEY = "ONEROOM_DATA_STORE_29_V5";
export const AUTH_STORAGE_KEY = "RENT_ADMIN_AUTH_V1";

export const ROOM_NUMBERS = [
  101,
  201, 202, 203, 204, 205,
  301, 302, 303, 304, 305,
  401, 402, 403, 404, 405,
  501, 502, 503, 504, 505,
  601, 602, 603, 604, 605,
  701, 702, 703
];

export const FLOOR_STRUCTURE = [
  { label: '7층', rooms: [701, 702, 703] },
  { label: '6층', rooms: [601, 602, 603, 604, 605] },
  { label: '5층', rooms: [501, 502, 503, 504, 505] },
  { label: '4층', rooms: [401, 402, 403, 404, 405] },
  { label: '3층', rooms: [301, 302, 303, 304, 305] },
  { label: '2층', rooms: [201, 202, 203, 204, 205] },
  { label: '1층', rooms: [101] }
];

const today = new Date();
export const currentYear = today.getFullYear();
export const currentMonth = today.getMonth() + 1;
export const formattedToday = today.toISOString().split('T')[0];

export const state = {
  currentBranch: 'main',
  branches: [],
  selectedRoom: 101,
  rooms: {},
  expenses: [],
  tenantHistories: [],
  isPastOpen: false, // 기본 전체 접힘, 펼치기 시 최근 1년간 기록 표시
  currentSlideView: 'main', // 'main' (당월 계약·수납 현황) | 'past' (과거 납부 내역)
  isContractOpen: false,
  pendingReceiptText: '',
  pendingReceiptRoom: null,
  lastSmsDeposit: null,
  isOnline: false,
  currentUser: null // { username, role, name, branch_id }
};

export const SESSION_DURATION_DAYS = 14;
export const SESSION_TTL_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000; // 14일 (밀리초)

// 저장된 관리자 인증 정보 복원 및 14일 슬라이딩 세션 자동 연장
try {
  const savedUser = localStorage.getItem(AUTH_STORAGE_KEY);
  if (savedUser) {
    const parsed = JSON.parse(savedUser);
    const now = Date.now();
    // 기존 데이터 호환: expiresAt이 없으면 loginAt 기준으로 계산, 없으면 지금부터 14일
    const baseTime = parsed.expiresAt ? new Date(parsed.expiresAt).getTime() : (parsed.loginAt ? new Date(parsed.loginAt).getTime() + SESSION_TTL_MS : now + SESSION_TTL_MS);
    
    if (now > baseTime) {
      // 14일 경과로 만료됨
      localStorage.removeItem(AUTH_STORAGE_KEY);
      state.currentUser = null;
    } else {
      // 유효 세션: 최근 접속일 기준 14일로 자동 연장 (Sliding Session)
      parsed.lastActiveAt = new Date(now).toISOString();
      parsed.expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
      state.currentUser = parsed;
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
    }
  }
} catch (e) {
  state.currentUser = null;
}

/**
 * 사용자 활동 시 14일 자동 연장 (Sliding Refresh)
 */
export function touchAuthSession() {
  if (!state.currentUser) return false;
  const now = Date.now();
  const expires = state.currentUser.expiresAt ? new Date(state.currentUser.expiresAt).getTime() : now;
  if (now > expires) {
    clearAuthUser();
    return false;
  }
  // 14일 연장
  state.currentUser.lastActiveAt = new Date(now).toISOString();
  state.currentUser.expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state.currentUser));
  return true;
}

/**
 * 남은 세션 시간 문자열 반환 (UI 표시용)
 */
export function getAuthSessionInfo() {
  if (!state.currentUser || !state.currentUser.expiresAt) return null;
  const diff = new Date(state.currentUser.expiresAt).getTime() - Date.now();
  if (diff <= 0) return { expired: true, text: '세션 만료' };
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return {
    expired: false,
    days: days,
    hours: hours,
    text: days > 0 ? `${days}일 후 만료 (접속 시 자동 연장)` : `${hours}시간 후 만료 (접속 시 자동 연장)`,
    expiresDate: new Date(state.currentUser.expiresAt).toISOString().split('T')[0]
  };
}

export function setAuthUser(user) {
  if (user) {
    const now = Date.now();
    user.lastActiveAt = new Date(now).toISOString();
    user.expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
    state.currentUser = user;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    state.currentUser = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export function clearAuthUser() {
  state.currentUser = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

// URL 쿼리 파라미터 또는 localStorage에서 branch 가져오기
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('branch')) {
  state.currentBranch = urlParams.get('branch');
} else {
  const savedBranch = localStorage.getItem(`${STORAGE_KEY}_BRANCH`);
  if (savedBranch) state.currentBranch = savedBranch;
}

/**
 * 백엔드 DB에서 전체 데이터 로드 (실패 시 localStorage 폴백)
 */
export async function loadInitialData() {
  try {
    // 1. 백엔드 API 호출 시도
    const [roomsRes, expRes, branchRes, histRes] = await Promise.all([
      apiGetRooms(state.currentBranch),
      apiGetExpenses(state.currentBranch),
      apiGetBranches(),
      apiGetTenantHistories(state.currentBranch)
    ]);

    state.rooms = roomsRes.rooms || {};
    applyAutoLeaseRenewal(state.rooms);
    state.expenses = expRes.expenses || [];
    state.branches = branchRes.branches || [];
    state.tenantHistories = histRes.histories || [];
    state.isOnline = true;

    // 저장된 마지막 선택 호실 복원
    const savedLastRoom = localStorage.getItem(`${STORAGE_KEY}_LAST_ROOM_${state.currentBranch}`);
    if (savedLastRoom && state.rooms[savedLastRoom]) {
      state.selectedRoom = parseInt(savedLastRoom, 10);
    } else {
      state.selectedRoom = roomsRes.selected_room || 101;
    }

    saveLocalFallback();
    console.log("✅ 백엔드 DB(integrat.db)와 실시간 동기화 완료 - 지점:", state.currentBranch);
  } catch (err) {
    console.warn("⚠️ 백엔드 연결 불가, 로컬 캐시(localStorage)로 폴백합니다:", err);
    state.isOnline = false;
    loadLocalFallback();
    applyAutoLeaseRenewal(state.rooms);
  }
}

/**
 * 묵시적 갱신: 만기일이 지났으나 전출(퇴실)하지 않은 호실 자동 1년 연장
 */
export function applyAutoLeaseRenewal(rooms) {
  if (!rooms) return false;
  const todayStr = formattedToday;
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const todayTime = new Date(ty, tm - 1, td).getTime();

  let modified = false;
  Object.values(rooms).forEach(r => {
    if (r && r.name && !r.move_out && r.expiry) {
      const parts = r.expiry.split('-').map(Number);
      if (parts.length === 3) {
        let [ey, em, ed] = parts;
        let expTime = new Date(ey, em - 1, ed).getTime();
        if (expTime < todayTime) {
          while (expTime < todayTime) {
            ey += 1;
            expTime = new Date(ey, em - 1, ed).getTime();
          }
          const newExpStr = `${ey}-${String(em).padStart(2, '0')}-${String(ed).padStart(2, '0')}`;
          r.expiry = newExpStr;
          r.auto_renewed = true;
          modified = true;
        }
      }
    }
  });
  return modified;
}

/**
 * 만기 3일·1·3개월 전 (0~95일 이내) 도래 호실 목록 계산
 * ★ 1년 자동 연장은 오늘부터 만기일까지의 날짜 계산을 위한 필수 전처리 과정!
 *   만기일이 지난 호실은 자동으로 1년 연장 후 새 만기일을 기준으로 잔여 일수를 파악합니다.
 */
export function getExpiringRoomsList(daysWindow = 95) {
  // 1. 필수 전처리: 만기일 경과 호실 자동 1년 연장
  const renewed = applyAutoLeaseRenewal(state.rooms);
  if (renewed) {
    saveLocalFallback();
  }

  const list = [];
  const todayStr = formattedToday;
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const todayTime = new Date(ty, tm - 1, td).getTime();

  ROOM_NUMBERS.forEach(rNum => {
    const r = state.rooms[rNum];
    if (r && r.name && !r.move_out && r.expiry) {
      const parts = r.expiry.split('-').map(Number);
      if (parts.length === 3) {
        const [ey, em, ed] = parts;
        const expTime = new Date(ey, em - 1, ed).getTime();
        const diffDays = Math.ceil((expTime - todayTime) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= daysWindow) {
          let category = '3개월 전';
          if (diffDays <= 3) {
            category = '3일 전';
          } else if (diffDays <= 35) {
            category = '1개월 전';
          }
          list.push({
            room_number: rNum,
            name: r.name,
            phone: r.phone || '',
            expiry: r.expiry,
            diff_days: diffDays,
            period_category: category,
            deposit: r.deposit || 0,
            rent: r.rent || 0,
            maintenance: r.maintenance || 0
          });
        }
      }
    }
  });

  list.sort((a, b) => a.diff_days - b.diff_days);
  return list;
}

export function saveLocalFallback() {
  try {
    const payload = {
      selectedRoom: state.selectedRoom,
      rooms: state.rooms,
      expenses: state.expenses,
      branches: state.branches,
      tenantHistories: state.tenantHistories
    };
    localStorage.setItem(`${STORAGE_KEY}_${state.currentBranch}`, JSON.stringify(payload));
    localStorage.setItem(`${STORAGE_KEY}_LAST_ROOM_${state.currentBranch}`, String(state.selectedRoom));
    localStorage.setItem(`${STORAGE_KEY}_BRANCH`, state.currentBranch);
  } catch (e) {
    console.error("Local save error:", e);
  }
}

// ── 도메인 공통 계산 규칙 (Clean Architecture: 롤링 12개월 & 후불 규칙 모듈화) ──
export function getRollingPeriods(curYear = currentYear, curMonth = currentMonth, count = 12) {
  const periods = [];
  for (let i = 0; i < count; i++) {
    let m = curMonth - i;
    let y = curYear;
    if (m <= 0) {
      m += 12;
      y -= 1;
    }
    periods.push({ year: y, month: m });
  }
  for (let mFuture = curMonth + 1; mFuture <= 12; mFuture++) {
    if (!periods.some(p => p.year === curYear && p.month === mFuture)) {
      periods.push({ year: curYear, month: mFuture });
    }
  }
  return periods;
}

export function parseDateComponents(val) {
  if (!val) return null;
  const s = String(val).trim();
  const m = s.match(/(\d{4})\s*[-./년\s]\s*(\d{1,2})\s*[-./월\s]\s*(\d{1,2})/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    if (!isNaN(y) && !isNaN(mo) && !isNaN(d)) {
      return { year: y, month: mo, day: d, formatted: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
    }
  }
  const m2 = s.match(/(\d{4})(\d{2})(\d{2})/);
  if (m2) {
    const y = parseInt(m2[1], 10);
    const mo = parseInt(m2[2], 10);
    const d = parseInt(m2[3], 10);
    if (!isNaN(y) && !isNaN(mo) && !isNaN(d)) {
      return { year: y, month: mo, day: d, formatted: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
    }
  }
  return null;
}

export function evaluatePaymentRule({ year, month, inYear, inMonth, leaseType = '월세', payTiming = '후불', curYear = currentYear, curMonth = currentMonth, hasPrevHist = false }) {
  const isBeforeMoveIn = (year < inYear) || (year === inYear && month < inMonth);
  const isMoveInMonth = (year === inYear && month === inMonth);
  const isFuture = (year > curYear) || (year === curYear && month > curMonth);
  const isPostpaid = (payTiming === '후불' || !payTiming);
  const isMonthly = (leaseType === '월세' || !leaseType);

  if (isBeforeMoveIn) {
    return {
      isBeforeMoveIn: true,
      isMoveInMonth: false,
      isFuture: false,
      paid: hasPrevHist,
      note: hasPrevHist ? '이전 세입자 정상 입금 (전출)' : '전입 이전 (기록 없음/미납)'
    };
  }

  if (isMoveInMonth) {
    const isPaid = !(isMonthly && isPostpaid);
    return {
      isBeforeMoveIn: false,
      isMoveInMonth: true,
      isFuture: false,
      paid: isPaid,
      note: isPaid ? '입주월 정상 입금 (선불)' : '입주월 (후불 익월 납부)'
    };
  }

  if (!isFuture) {
    return {
      isBeforeMoveIn: false,
      isMoveInMonth: false,
      isFuture: false,
      paid: true,
      note: '정상 입금'
    };
  }

  return {
    isBeforeMoveIn: false,
    isMoveInMonth: false,
    isFuture: true,
    paid: false,
    note: ''
  };
}

export function generateDefaultSeedRooms() {
  const SEED_BACKUP_ROOMS = {
  "101": {
    "room_number": 101,
    "branch_id": "main",
    "name": "배종봉",
    "id_number": "701127-1520023",
    "phone": "010-5424-5780",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 2000000,
    "rent": 150000,
    "maintenance": 100000,
    "clean_fee": 0,
    "move_in": "2025-06-04",
    "expiry": "2026-12-10",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-02",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-02",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-02",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-02",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-03",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 150000,
        "maintenance_amount": 100000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "배종봉",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "201": {
    "room_number": 201,
    "branch_id": "main",
    "name": "정민준",
    "id_number": "921013-1025438",
    "phone": "010-5578-5358",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2022-03-19",
    "expiry": "2026-12-12",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-22",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-22",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-21",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-21",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-21",
        "rent_amount": 0,
        "maintenance_amount": 44000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-21",
        "rent_amount": 0,
        "maintenance_amount": 44000,
        "note": "",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "정민준",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "202": {
    "room_number": 202,
    "branch_id": "main",
    "name": "안동기",
    "id_number": "701110-1814911",
    "phone": "010-9429-4688",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 3000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2015-04-10",
    "expiry": "2027-04-10",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-24",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-24",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-24",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-24",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-08",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-08",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-08",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-08",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-08",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-08",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2026-01-29",
        "rent_amount": 1610000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2026-01-29",
        "rent_amount": 1610000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "안동기",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "203": {
    "room_number": 203,
    "branch_id": "main",
    "name": "이광훈",
    "id_number": "580115-1268113",
    "phone": "010-8417-7858",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2024-08-01",
    "expiry": "2027-07-31",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-25",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-25",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-25",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-25",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-25",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-25",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-25",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-25",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-24",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-24",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-24",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-24",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-24",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-24",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "이광훈",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "204": {
    "room_number": 204,
    "branch_id": "main",
    "name": "주예란",
    "id_number": "770925-2169514",
    "phone": "010-8982-8146",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 250000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2021-06-05",
    "expiry": "2027-06-04",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-02",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-02",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-04",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-04",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-04",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-04",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-04",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-04",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "주예란",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "205": {
    "room_number": 205,
    "branch_id": "main",
    "name": "서재민",
    "id_number": "980706-1122013",
    "phone": "010-4947-8994",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 250000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2024-01-27",
    "expiry": "2027-01-26",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-23",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-23",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-21",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-21",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-22",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-22",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-21",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-21",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-20",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-20",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-21",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-21",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-21",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-21",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-21",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-21",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-22",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-22",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-22",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-22",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "서재민",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "301": {
    "room_number": 301,
    "branch_id": "main",
    "name": "성민병원",
    "id_number": "124233-0000347",
    "phone": "010-9938-6293",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 390000,
    "maintenance": 50000,
    "clean_fee": 80000,
    "move_in": "2022-03-28",
    "expiry": "2027-03-27",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-30",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-30",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-30",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-30",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 390000,
        "maintenance_amount": 50000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 390000,
        "maintenance_amount": 50000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 390000,
        "maintenance_amount": 50000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 390000,
        "maintenance_amount": 50000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 390000,
        "maintenance_amount": 50000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 390000,
        "maintenance_amount": 50000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "성민병원",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "302": {
    "room_number": 302,
    "branch_id": "main",
    "name": "김지영",
    "id_number": "690120-2150013",
    "phone": "010-2668-9764",
    "lease_type": "전세",
    "pay_timing": "후불",
    "deposit": 40000000,
    "rent": 0,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2019-03-21",
    "expiry": "2027-03-20",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-18",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-18",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-19",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-19",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-18",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-18",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-19",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-19",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-19",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-19",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-18",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-18",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-19",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-19",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-19",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-19",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-17",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-17",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-21",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-21",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "김지영",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "303": {
    "room_number": 303,
    "branch_id": "main",
    "name": "김진수",
    "id_number": "960617-1479024",
    "phone": "010-9169-0757",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2025-09-12",
    "expiry": "2027-09-11",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-12",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-12",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-16",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-16",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-16",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-16",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-12",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-12",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-14",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-14",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "김진수",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "304": {
    "room_number": 304,
    "branch_id": "main",
    "name": "노송병원",
    "id_number": "137-91-92800",
    "phone": "010-4293-5511",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 10000000,
    "rent": 340000,
    "maintenance": 50000,
    "clean_fee": 80000,
    "move_in": "2022-05-01",
    "expiry": "2027-04-30",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-08",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-08",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-20",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-20",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-04",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-04",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-02",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-02",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-04",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-04",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-02",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-02",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-06",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-06",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-03",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-03",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-02",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-02",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-01",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-01",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 340000,
        "maintenance_amount": 50000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 340000,
        "maintenance_amount": 50000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-01-08",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 340000,
        "maintenance_amount": 50000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-01-08",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 340000,
        "maintenance_amount": 50000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "노송병원",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "305": {
    "room_number": 305,
    "branch_id": "main",
    "name": "정우메탈",
    "id_number": "137-14-88402",
    "phone": "010-9026-2596",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 3000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2023-04-13",
    "expiry": "2027-04-12",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-14",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-14",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "정우메탈",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "401": {
    "room_number": 401,
    "branch_id": "main",
    "name": "이정도",
    "id_number": "521010-1231421",
    "phone": "010-2763-7108",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2023-04-09",
    "expiry": "2027-04-08",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-16",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-16",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-14",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-14",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "이정도",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "402": {
    "room_number": 402,
    "branch_id": "main",
    "name": "한윤철",
    "id_number": "760813-1156821",
    "phone": "010-9279-7975",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 3000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2024-02-28",
    "expiry": "2027-02-28",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "한윤철",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "403": {
    "room_number": 403,
    "branch_id": "main",
    "name": "김정두",
    "id_number": "910905-1125625",
    "phone": "010-3132-2713",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2025-12-19",
    "expiry": "2026-12-18",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 12/19",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 12/19",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "김정두",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "404": {
    "room_number": 404,
    "branch_id": "main",
    "name": "이종진",
    "id_number": "670219-1251211",
    "phone": "010-4808-9078",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2026-07-01",
    "expiry": "2027-06-07",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "성민형",
        "is_previous_tenant": true
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "성민형",
        "is_previous_tenant": true
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "성민형",
        "is_previous_tenant": true
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "성민형",
        "is_previous_tenant": true
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "성민형",
        "is_previous_tenant": true
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "성민형",
        "is_previous_tenant": true
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "성민형",
        "is_previous_tenant": true
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "성민형",
        "is_previous_tenant": true
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-06",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "이종진",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-06",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "이종진",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-06",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "이종진",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-06",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "이종진",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-06",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "이종진",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-06",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "이종진",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-06",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "이종진",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-06",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "이종진",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "성민형",
        "is_previous_tenant": true
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이종진",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "성민형",
        "is_previous_tenant": true
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이종진",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "성민형",
        "is_previous_tenant": true
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "성민형",
        "is_previous_tenant": true
      }
    },
    "tenant_histories": [
      {
        "id": "0318d835-e7a2-4ca9-b806-ff955e502247",
        "name": "성민형",
        "id_number": "880101-1******",
        "phone": "010-1234-5678",
        "lease_type": "월세",
        "pay_timing": "후불",
        "deposit": 5000000,
        "rent": 290000,
        "maintenance": 150000,
        "move_in": "2025-01-01",
        "move_out": "2026-04-30",
        "retention_until": "2027-04-30"
      }
    ]
  },
  "405": {
    "room_number": 405,
    "branch_id": "main",
    "name": "김병현",
    "id_number": "880107-1168012",
    "phone": "010-7170-8629",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2026-04-01",
    "expiry": "2027-03-08",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-09",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-09",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-08",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-08",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-08",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-08",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-05",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-05",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-04",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-04",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-04",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-04",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-05",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-05",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-25",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "정다윤",
        "is_previous_tenant": true
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-25",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "정다윤",
        "is_previous_tenant": true
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김병현",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-25",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "정다윤",
        "is_previous_tenant": true
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-25",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "정다윤",
        "is_previous_tenant": true
      }
    },
    "tenant_histories": [
      {
        "id": "06f08171-13a1-45f0-ad54-747c8926ee4c",
        "name": "정다윤",
        "id_number": "931120-2******",
        "phone": "010-5678-9012",
        "lease_type": "월세",
        "pay_timing": "후불",
        "deposit": 5000000,
        "rent": 250000,
        "maintenance": 150000,
        "move_in": "2024-01-01",
        "move_out": "2025-12-31",
        "retention_until": "2026-12-31"
      }
    ]
  },
  "501": {
    "room_number": 501,
    "branch_id": "main",
    "name": "김민규",
    "id_number": "960426-1860829",
    "phone": "010-3528-9240",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2024-08-30",
    "expiry": "2027-08-31",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-31",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-31",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-02",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-02",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-31",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-31",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-30",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-30",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-02",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-02",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-30",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-30",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-31",
        "rent_amount": 350000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-31",
        "rent_amount": 350000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "김민규",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "502": {
    "room_number": 502,
    "branch_id": "main",
    "name": "강홍식",
    "id_number": "800629-1223315",
    "phone": "010-6605-5279",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2023-02-01",
    "expiry": "2027-02-01",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-10",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "강홍식",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "503": {
    "room_number": 503,
    "branch_id": "main",
    "name": "강백찬",
    "id_number": "020507-3937718",
    "phone": "010-8864-2674",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2026-09-01",
    "expiry": "2027-09-29",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강백찬",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강백찬",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강백찬",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "강백찬",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 160000,
        "note": "",
        "tenant_name": "강백찬",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 160000,
        "note": "",
        "tenant_name": "강백찬",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-20",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "지순기",
        "is_previous_tenant": true
      }
    },
    "tenant_histories": [
      {
        "id": "246045f3-6eb8-48f5-b6e4-2ea178559ec9",
        "name": "지순기",
        "id_number": "850715-1******",
        "phone": "010-3456-7890",
        "lease_type": "월세",
        "pay_timing": "후불",
        "deposit": 5000000,
        "rent": 290000,
        "maintenance": 150000,
        "move_in": "2025-01-01",
        "move_out": "2026-07-31",
        "retention_until": "2027-07-31"
      }
    ]
  },
  "504": {
    "room_number": 504,
    "branch_id": "main",
    "name": "이수현",
    "id_number": "910607-1183615",
    "phone": "010-5059-2191",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2025-04-01",
    "expiry": "2027-03-31",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-19",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "이수현",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "505": {
    "room_number": 505,
    "branch_id": "main",
    "name": "김정현",
    "id_number": "981001-1338617",
    "phone": "010-9810-0443",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2026-07-01",
    "expiry": "2027-06-28",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-26",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "최승렬",
        "is_previous_tenant": true
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-26",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "최승렬",
        "is_previous_tenant": true
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-26",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "최승렬",
        "is_previous_tenant": true
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-26",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "최승렬",
        "is_previous_tenant": true
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-29",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정현",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-29",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정현",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-17",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정현",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-17",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정현",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정현",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정현",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정현",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정현",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-26",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "최승렬",
        "is_previous_tenant": true
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정현",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-26",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "최승렬",
        "is_previous_tenant": true
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김정현",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-26",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "최승렬",
        "is_previous_tenant": true
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-26",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "최승렬",
        "is_previous_tenant": true
      }
    },
    "tenant_histories": [
      {
        "id": "3cf5f0a3-8ee8-4a32-a22b-990f65690601",
        "name": "최승렬",
        "id_number": "820412-1******",
        "phone": "010-4567-8901",
        "lease_type": "월세",
        "pay_timing": "후불",
        "deposit": 5000000,
        "rent": 250000,
        "maintenance": 150000,
        "move_in": "2025-01-01",
        "move_out": "2026-02-28",
        "retention_until": "2027-02-28"
      }
    ]
  },
  "601": {
    "room_number": 601,
    "branch_id": "main",
    "name": "노우영",
    "id_number": "710719-1538528",
    "phone": "010-8764-0958",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 350000,
    "maintenance": 90000,
    "clean_fee": 80000,
    "move_in": "2024-09-23",
    "expiry": "2027-09-22",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-24",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-24",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 350000,
        "maintenance_amount": 90000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 350000,
        "maintenance_amount": 90000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 350000,
        "maintenance_amount": 90000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 350000,
        "maintenance_amount": 90000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 350000,
        "maintenance_amount": 90000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 350000,
        "maintenance_amount": 90000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "노우영",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "602": {
    "room_number": 602,
    "branch_id": "main",
    "name": "박정자",
    "id_number": "560210-2005915",
    "phone": "010-8025-8400",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 250000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2014-06-02",
    "expiry": "2027-06-02",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-02",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-02",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-02",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-02",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-04",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-04",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-02",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-02",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-03",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-10-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-01",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "박정자",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "603": {
    "room_number": 603,
    "branch_id": "main",
    "name": "김수현",
    "id_number": "921203-1235714",
    "phone": "010-9277-9233",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2025-07-27",
    "expiry": "2027-07-26",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-27",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-28",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "김수현",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "604": {
    "room_number": 604,
    "branch_id": "main",
    "name": "김동주",
    "id_number": "990913-1155417",
    "phone": "010-7709-8970",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2024-04-16",
    "expiry": "2027-04-15",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-14",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-14",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-13",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-16",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-16",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-16",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-16",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-15",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "김동주",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "605": {
    "room_number": 605,
    "branch_id": "main",
    "name": "배은미",
    "id_number": "960124-2157011",
    "phone": "010-7367-0187",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 100000,
    "clean_fee": 80000,
    "move_in": "2024-05-26",
    "expiry": "2027-05-26",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-26",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-26",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-25",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-25",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-25",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-25",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-26",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-26",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-25",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-25",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-25",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-25",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-26",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-26",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-26",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-26",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-26",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-26",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 100000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-26",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 100000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-26",
        "rent_amount": 240000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 100000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "배은미",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "701": {
    "room_number": 701,
    "branch_id": "main",
    "name": "주인세대",
    "id_number": "",
    "phone": "",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 0,
    "rent": 0,
    "maintenance": 0,
    "clean_fee": 80000,
    "move_in": "",
    "expiry": "",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "주인세대 거주",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "주인세대 거주",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "주인세대",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "702": {
    "room_number": 702,
    "branch_id": "main",
    "name": "이범주",
    "id_number": "901106-1158022",
    "phone": "010-5749-1106",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 6000000,
    "rent": 290000,
    "maintenance": 250000,
    "clean_fee": 80000,
    "move_in": "2024-04-05",
    "expiry": "2027-04-04",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-05",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-05",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-05",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-05",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-06",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-06",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-05",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-05",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-06",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-06",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-06",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-06",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-06",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-06",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-06",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-06",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-06",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-06",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-05",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-01-05",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 250000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 250000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-05",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 250000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-05",
        "rent_amount": 390000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 250000,
        "note": "전입 이전 (기록 없음/미납)",
        "tenant_name": "이범주",
        "is_previous_tenant": false
      }
    },
    "tenant_histories": []
  },
  "703": {
    "room_number": 703,
    "branch_id": "main",
    "name": "김상호",
    "id_number": "570709-1006015",
    "phone": "010-8212-9257",
    "lease_type": "월세",
    "pay_timing": "후불",
    "deposit": 5000000,
    "rent": 290000,
    "maintenance": 150000,
    "clean_fee": 80000,
    "move_in": "2026-02-01",
    "expiry": "2027-01-22",
    "auto_renewed": false,
    "move_out": "",
    "payments": {
      "1": {
        "month": 1,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "2026-1": {
        "month": 1,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 0,
        "maintenance_amount": 0,
        "note": "공실",
        "tenant_name": "공실",
        "is_previous_tenant": false
      },
      "2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-24",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "2026-2": {
        "month": 2,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-02-24",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "2026-3": {
        "month": 3,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-03-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "2026-4": {
        "month": 4,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-04-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-26",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "2026-5": {
        "month": 5,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-05-26",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "2026-6": {
        "month": 6,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-06-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "2026-7": {
        "month": 7,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-07-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-25",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "2026-8": {
        "month": 8,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-08-25",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "2026-9": {
        "month": 9,
        "year": 2026,
        "paid": true,
        "paid_date": "2026-09-23",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "2026-10": {
        "month": 10,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-23",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "황태훈",
        "is_previous_tenant": true
      },
      "2026-11": {
        "month": 11,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-23",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "황태훈",
        "is_previous_tenant": true
      },
      "2026-12": {
        "month": 12,
        "year": 2026,
        "paid": false,
        "paid_date": "",
        "rent_amount": 290000,
        "maintenance_amount": 150000,
        "note": "",
        "tenant_name": "김상호",
        "is_previous_tenant": false
      },
      "2025-12": {
        "month": 12,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-12-23",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "황태훈",
        "is_previous_tenant": true
      },
      "2025-11": {
        "month": 11,
        "year": 2025,
        "paid": true,
        "paid_date": "2025-11-23",
        "rent_amount": 250000,
        "maintenance_amount": 150000,
        "note": "정상 입금",
        "tenant_name": "황태훈",
        "is_previous_tenant": true
      }
    },
    "tenant_histories": [
      {
        "id": "12341bbe-ac81-4b87-9a2e-d14058253c84",
        "name": "황태훈",
        "id_number": "790514-1******",
        "phone": "010-6789-0123",
        "lease_type": "월세",
        "pay_timing": "후불",
        "deposit": 5000000,
        "rent": 250000,
        "maintenance": 150000,
        "move_in": "2024-01-01",
        "move_out": "2025-12-31",
        "retention_until": "2026-12-31"
      }
    ]
  }
};
  const res = {};
  
  Object.keys(SEED_BACKUP_ROOMS).forEach(rKey => {
    const r = SEED_BACKUP_ROOMS[rKey];
    const rNum = parseInt(rKey, 10);
    res[rNum] = {
      room_number: rNum,
      branch_id: r.branch_id || 'main',
      name: r.name || '',
      id_number: r.id_number || '',
      phone: r.phone || '',
      lease_type: r.lease_type || '월세',
      pay_timing: r.pay_timing || '후불',
      deposit: r.deposit || 0,
      rent: r.rent || 0,
      maintenance: r.maintenance || 0,
      clean_fee: r.clean_fee || 0,
      move_in: r.move_in || '',
      expiry: r.expiry || '',
      move_out: r.move_out || '',
      auto_renewed: r.auto_renewed || false,
      payments: r.payments || {},
      tenant_histories: r.tenant_histories || []
    };
  });
  return res;
}

export function loadLocalFallback() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${state.currentBranch}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.selectedRoom = parsed.selectedRoom || 101;
      state.rooms = parsed.rooms && Object.keys(parsed.rooms).length > 0 ? parsed.rooms : generateDefaultSeedRooms();
      state.expenses = parsed.expenses || [];
      state.branches = (parsed.branches && parsed.branches.length > 0 ? parsed.branches : [
        { branch_id: 'main', name: '시크빌 (29개실)', billing_status: 'PAID' }
      ]).map(b => b.branch_id === 'main' ? { ...b, name: '시크빌 (29개실)' } : b);
      state.tenantHistories = parsed.tenantHistories || [
        {
          id: 'prev-tenant-201',
          branch_id: state.currentBranch,
          room_number: 201,
          name: '박지훈',
          id_number: '940315-1******',
          phone: '010-9876-0201',
          lease_type: '월세',
          pay_timing: '후불',
          deposit: 5000000,
          rent: 420000,
          maintenance: 50000,
          clean_fee: 80000,
          move_in: `${currentYear - 1}-07-01`,
          expiry: `${currentYear}-06-30`,
          move_out: `${currentYear}-06-30`,
          retention_until: `${currentYear + 1}-06-30`
        }
      ];
    } else {
      state.selectedRoom = 101;
      state.rooms = generateDefaultSeedRooms();
      state.expenses = [];
      state.branches = [
        { branch_id: 'main', name: '시크빌 (29개실)', billing_status: 'PAID' }
      ];
      state.tenantHistories = [
        {
          id: 'prev-tenant-201',
          branch_id: state.currentBranch,
          room_number: 201,
          name: '박지훈',
          id_number: '940315-1******',
          phone: '010-9876-0201',
          lease_type: '월세',
          pay_timing: '후불',
          deposit: 5000000,
          rent: 420000,
          maintenance: 50000,
          clean_fee: 80000,
          move_in: `${currentYear - 1}-07-01`,
          expiry: `${currentYear}-06-30`,
          move_out: `${currentYear}-06-30`,
          retention_until: `${currentYear + 1}-06-30`
        }
      ];
      saveLocalFallback();
    }

    // 201호 세입자 정보 검증 및 정민준(2022-03-19 전입) 보정
    if (state.rooms && state.rooms[201]) {
      const r201 = state.rooms[201];
      if (r201.name === "이서연" || r201.name === "정민준" || !r201.name) {
        r201.name = "정민준";
        r201.phone = "010-5578-5358";
        r201.rent = 290000;
        r201.maintenance = 150000;
        r201.deposit = 5000000;
        r201.move_in = "2022-03-19";
        r201.expiry = "2023-03-18";
      }
    }

    // 503호 세입자 정보 검증 및 김백찬 보정
    if (state.rooms && state.rooms[503]) {
      const r503 = state.rooms[503];
      if (r503.name === "장지아" || r503.name === "김백찬" || !r503.name) {
        r503.name = "김백찬";
        if (!r503.phone || r503.phone === "010-3344-5503") r503.phone = "010-8864-2674";
      }
    }

    // 404호 세입자 정보 검증 및 이종진(2026-06-08 전입, 월세/후불) 보정
    if (state.rooms && state.rooms[404]) {
      const r404 = state.rooms[404];
      if (r404.name !== "이종진" || !r404.move_in || r404.move_in.indexOf("06") === -1) {
        r404.name = "이종진";
        r404.phone = "010-4808-9078";
        r404.rent = 290000;
        r404.maintenance = 150000;
        r404.deposit = 5000000;
        r404.lease_type = "월세";
        r404.pay_timing = "후불";
        r404.move_in = `${currentYear}-06-08`;
        r404.expiry = `${currentYear + 1}-06-07`;
      } else if (!r404.phone || r404.phone === "010-2345-4404") {
        r404.phone = "010-4808-9078";
      }
    }

    // 505호 세입자 정보 검증 및 김정현(2026-06-29 전입, 월세/후불) 보정
    if (state.rooms && state.rooms[505]) {
      const r505 = state.rooms[505];
      if (r505.name !== "김정현" || r505.move_in !== `${currentYear}-06-29`) {
        r505.name = "김정현";
        r505.phone = "010-9810-0443";
        r505.rent = 290000;
        r505.maintenance = 150000;
        r505.deposit = 5000000;
        r505.lease_type = "월세";
        r505.pay_timing = "후불";
        r505.move_in = `${currentYear}-06-29`;
        r505.expiry = `${currentYear + 1}-06-28`;
      } else if (!r505.phone || r505.phone === "010-4499-5505") {
        r505.phone = "010-9810-0443";
      }
    }

    // 전입일부터 현재까지의 납부 내역 자동 보정 동기화 (구버전 캐시 자동 치유)
    fillTenantPaymentsState();
  } catch (e) {
    console.error("Local load error:", e);
    state.rooms = generateDefaultSeedRooms();
  }
}

export function fillTenantPaymentsState(roomNumber = null) {
  if (!state.rooms) return;
  const roomsToProcess = roomNumber ? [state.rooms[roomNumber]].filter(Boolean) : Object.values(state.rooms);
  
  roomsToProcess.forEach(room => {
    if (!room || !room.name) return;
    const isJeonse = (room.lease_type === '전세');
    const rentVal = isJeonse ? 0 : (room.rent || 0);
    const maintVal = room.maintenance || 0;

    let inYear = currentYear;
    let inMonth = 1;
    if (room.move_in) {
      const dtComp = parseDateComponents(room.move_in);
      if (dtComp) {
        inYear = dtComp.year;
        inMonth = dtComp.month;
      }
    }

    if (!room.payments) room.payments = {};
    const periods = getRollingPeriods(currentYear, currentMonth, 12);

    periods.forEach(({ year: y, month: m }) => {
      const pKey = `${y}-${m}`;
      const existing = room.payments[pKey] || (y === currentYear ? room.payments[m] : {}) || {};
      const hasPrev = Boolean(existing.is_previous_tenant && existing.tenant_name);

      const rule = evaluatePaymentRule({
        year: y,
        month: m,
        inYear,
        inMonth,
        leaseType: room.lease_type || '월세',
        payTiming: room.pay_timing || '후불',
        curYear: currentYear,
        curMonth: currentMonth,
        hasPrevHist: hasPrev
      });

      const payObj = {
        ...existing,
        month: m,
        year: y,
        paid: rule.paid,
        paid_date: rule.paid ? (existing.paid_date || `${y}-${String(m).padStart(2, '0')}-10`) : '',
        rent_amount: hasPrev ? existing.rent_amount : rentVal,
        maintenance_amount: hasPrev ? existing.maintenance_amount : maintVal,
        note: rule.note || existing.note || '',
        tenant_name: hasPrev ? existing.tenant_name : room.name,
        is_previous_tenant: hasPrev
      };

      room.payments[pKey] = payObj;
      if (y === currentYear) room.payments[m] = payObj;
    });
  });

  saveLocalFallback();
}

export const saveState = saveLocalFallback;
