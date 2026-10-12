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
  isContractOpen: false,
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
  }
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
  const DEFAULT_NAMES = ["김민준", "이서연", "박도윤", "정하은", "최지호", "강지우", "윤시우", "조서아", "임민서", "한준우", "오예은", "서지안", "신유준", "권다은", "황현우", "송지유", "안우진", "홍서현", "유동현", "고민서", "문도현", "양채원", "손정우", "배채은", "조민성", "백지아", "허성민", "남은서", "유준호"];
  const res = {};

  ROOM_NUMBERS.forEach((rNum, idx) => {
    const isJeonse = (rNum === 701);
    let rentVal = isJeonse ? 0 : (400000 + (rNum % 5) * 20000);
    let maintVal = 50000;
    let tenantName = DEFAULT_NAMES[idx % DEFAULT_NAMES.length];
    let phoneNum = `010-${2000 + idx}-${String(rNum).padStart(4, '0')}`;
    let moveInDate = "2024-03-01";
    let expiryDate = `${currentYear + 1}-12-31`;
    let depositVal = isJeonse ? 80000000 : (5000000 + (rNum % 3) * 5000000);

    // 201호: 정민준 고객 (2022-03-19 전입하여 현재까지 계속 거주 중)
    if (rNum === 201) {
      tenantName = "정민준";
      phoneNum = "010-5578-5358";
      rentVal = 290000;
      maintVal = 150000;
      moveInDate = "2022-03-19";
      expiryDate = "2023-03-18";
      depositVal = 5000000;
    }

    // 404호: 이종진 고객 (2026-06-08 전입, 월세 290,000원, 관리비 150,000원, 보증금 5,000,000원, 후불)
    if (rNum === 404) {
      tenantName = "이종진";
      phoneNum = "010-2345-4404";
      rentVal = 290000;
      maintVal = 150000;
      moveInDate = `${currentYear}-06-08`;
      expiryDate = `${currentYear + 1}-06-07`;
      depositVal = 5000000;
    }

    // 503호: 김백찬 고객
    if (rNum === 503) {
      tenantName = "김백찬";
      phoneNum = "010-3344-5503";
    }

    // 505호: 김정현 고객 (2026-06-29 전입, 월세 290,000원, 관리비 150,000원, 후불)
    if (rNum === 505) {
      tenantName = "김정현";
      phoneNum = "010-4499-5505";
      rentVal = 290000;
      maintVal = 150000;
      moveInDate = `${currentYear}-06-29`;
      expiryDate = `${currentYear + 1}-06-28`;
      depositVal = 5000000;
    }

    const dtComp = parseDateComponents(moveInDate) || { year: currentYear, month: 1 };
    const inY = dtComp.year;
    const inM = dtComp.month;
    const payments = {};
    for (let m = 1; m <= 12; m++) {
      const rule = evaluatePaymentRule({
        year: currentYear,
        month: m,
        inYear: inY,
        inMonth: inM,
        leaseType: isJeonse ? '전세' : '월세',
        payTiming: '후불',
        curYear: currentYear,
        curMonth: currentMonth,
        hasPrevHist: false
      });

      payments[m] = {
        month: m,
        year: currentYear,
        paid: rule.paid,
        paid_date: rule.paid ? `${currentYear}-${String(m).padStart(2, '0')}-10` : "",
        rent_amount: rentVal,
        maintenance_amount: maintVal,
        note: rule.note,
        tenant_name: tenantName,
        is_previous_tenant: false
      };
    }

    res[rNum] = {
      room_number: rNum,
      name: tenantName,
      phone: phoneNum,
      id_number: `960${(idx % 9) + 1}01-*******`,
      lease_type: isJeonse ? "전세" : "월세",
      pay_timing: "후불",
      deposit: depositVal,
      rent: rentVal,
      maintenance: maintVal,
      clean_fee: 80000,
      move_in: moveInDate,
      expiry: expiryDate,
      move_out: "",
      payments: payments
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
        { branch_id: 'main', name: '시크빌 (29개실)', billing_status: 'PAID' },
        { branch_id: 'branch_02', name: '원룸 별관 (29개실)', billing_status: 'PAID' }
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
        { branch_id: 'main', name: '시크빌 (29개실)', billing_status: 'PAID' },
        { branch_id: 'branch_02', name: '원룸 별관 (29개실)', billing_status: 'PAID' }
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
        if (!r503.phone) r503.phone = "010-3344-5503";
      }
    }

    // 404호 세입자 정보 검증 및 이종진(2026-06-08 전입, 월세/후불) 보정
    if (state.rooms && state.rooms[404]) {
      const r404 = state.rooms[404];
      if (r404.name !== "이종진" || !r404.move_in || r404.move_in.indexOf("06") === -1) {
        r404.name = "이종진";
        r404.phone = "010-2345-4404";
        r404.rent = 290000;
        r404.maintenance = 150000;
        r404.deposit = 5000000;
        r404.lease_type = "월세";
        r404.pay_timing = "후불";
        r404.move_in = `${currentYear}-06-08`;
        r404.expiry = `${currentYear + 1}-06-07`;
      }
    }

    // 505호 세입자 정보 검증 및 김정현(2026-06-29 전입, 월세/후불) 보정
    if (state.rooms && state.rooms[505]) {
      const r505 = state.rooms[505];
      if (r505.name !== "김정현" || r505.move_in !== `${currentYear}-06-29`) {
        r505.name = "김정현";
        r505.phone = "010-4499-5505";
        r505.rent = 290000;
        r505.maintenance = 150000;
        r505.deposit = 5000000;
        r505.lease_type = "월세";
        r505.pay_timing = "후불";
        r505.move_in = `${currentYear}-06-29`;
        r505.expiry = `${currentYear + 1}-06-28`;
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

      // 사용자가 명시적으로 취소(미납) 처리한 건은 완납으로 자동 덮어쓰지 않고 미납 유지
      const isExplicitlyCancelled = (existing.note === "납부 취소") || (existing.paid === false && !existing.paid_date);
      const isPaid = isExplicitlyCancelled ? false : (existing.paid !== undefined ? existing.paid : rule.paid);
      const payNote = isExplicitlyCancelled ? "납부 취소" : (existing.note || rule.note || '');

      const payObj = {
        ...existing,
        month: m,
        year: y,
        paid: isPaid,
        paid_date: isPaid ? (existing.paid_date || `${y}-${String(m).padStart(2, '0')}-10`) : '',
        rent_amount: hasPrev ? existing.rent_amount : rentVal,
        maintenance_amount: hasPrev ? existing.maintenance_amount : maintVal,
        note: payNote,
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
