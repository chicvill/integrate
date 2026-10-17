/**
 * apps/rent/frontend/js/state.js
 * 원룸 임차료 관리 시스템 전역 반응형 상태 관리 모듈.
 * 백엔드(integrat.db) 실시간 동기화 및 오프라인 localStorage 폴백 지원.
 */

import { apiGetRooms, apiGetExpenses, apiGetBranches, apiGetTenantHistories } from './api.js?v=2.0';
import { CANONICAL_ROOMS_DATA, DEFAULT_EXPENSES, DEFAULT_TENANT_HISTORIES } from './seed_data.js?v=2.0';

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
  return JSON.parse(JSON.stringify(CANONICAL_ROOMS_DATA));
}

export function loadLocalFallback() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${state.currentBranch}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.selectedRoom = parsed.selectedRoom || 101;
      state.rooms = parsed.rooms && Object.keys(parsed.rooms).length > 0 ? parsed.rooms : generateDefaultSeedRooms();
      state.expenses = (parsed.expenses && parsed.expenses.length > 0) ? parsed.expenses : JSON.parse(JSON.stringify(DEFAULT_EXPENSES));
      state.branches = (parsed.branches && parsed.branches.length > 0 ? parsed.branches : [
        { branch_id: 'main', name: '시크빌 (29개실)', billing_status: 'PAID' }
      ]).map(b => b.branch_id === 'main' ? { ...b, name: '시크빌 (29개실)' } : b);
      state.tenantHistories = (parsed.tenantHistories && parsed.tenantHistories.length > 0) ? parsed.tenantHistories : JSON.parse(JSON.stringify(DEFAULT_TENANT_HISTORIES));
    } else {
      state.selectedRoom = 101;
      state.rooms = generateDefaultSeedRooms();
      state.expenses = JSON.parse(JSON.stringify(DEFAULT_EXPENSES));
      state.branches = [
        { branch_id: 'main', name: '시크빌 (29개실)', billing_status: 'PAID' }
      ];
      state.tenantHistories = JSON.parse(JSON.stringify(DEFAULT_TENANT_HISTORIES));
      saveLocalFallback();
    }

    // 전입일부터 현재까지의 납부 내역 자동 보정 동기화 (구버전 캐시 자동 치유)
    fillTenantPaymentsState();
  } catch (e) {
    console.error("Local load error:", e);
    state.rooms = generateDefaultSeedRooms();
    state.expenses = JSON.parse(JSON.stringify(DEFAULT_EXPENSES));
    state.tenantHistories = JSON.parse(JSON.stringify(DEFAULT_TENANT_HISTORIES));
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

      const finalPaid = (existing.paid !== undefined) ? existing.paid : rule.paid;
      const payObj = {
        ...existing,
        month: m,
        year: y,
        paid: finalPaid,
        paid_date: finalPaid ? (existing.paid_date || `${y}-${String(m).padStart(2, '0')}-10`) : '',
        rent_amount: hasPrev ? existing.rent_amount : rentVal,
        maintenance_amount: hasPrev ? existing.maintenance_amount : maintVal,
        note: existing.note || rule.note || '',
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
