/**
 * apps/rent/frontend/js/state.js
 * 원룸 임차료 관리 시스템 전역 반응형 상태 관리 모듈.
 * 백엔드(integrat.db) 실시간 동기화 및 오프라인 localStorage 폴백 지원.
 */

import { apiGetRooms, apiGetExpenses, apiGetBranches } from './api.js?v=2.0';

export const STORAGE_KEY = "ONEROOM_DATA_STORE_29_V4";

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
  isContractOpen: false,
  isPastOpen: false,
  isOnline: false
};

// URL 쿼리 파라미터에서 branch 가져오기
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('branch')) {
  state.currentBranch = urlParams.get('branch');
}

/**
 * 백엔드 DB에서 전체 데이터 로드 (실패 시 localStorage 폴백)
 */
export async function loadInitialData() {
  try {
    // 1. 백엔드 API 호출 시도
    const [roomsRes, expRes, branchRes] = await Promise.all([
      apiGetRooms(state.currentBranch),
      apiGetExpenses(state.currentBranch),
      apiGetBranches()
    ]);

    state.rooms = roomsRes.rooms || {};
    state.expenses = expRes.expenses || [];
    state.branches = branchRes.branches || [];
    state.isOnline = true;

    // 저장된 마지막 선택 호실 복원
    const savedLastRoom = localStorage.getItem(`${STORAGE_KEY}_LAST_ROOM`);
    if (savedLastRoom && state.rooms[savedLastRoom]) {
      state.selectedRoom = parseInt(savedLastRoom, 10);
    } else {
      state.selectedRoom = roomsRes.selected_room || 101;
    }

    saveLocalFallback();
    console.log("✅ 백엔드 DB(integrat.db)와 실시간 동기화 완료");
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
      expenses: state.expenses
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(`${STORAGE_KEY}_LAST_ROOM`, String(state.selectedRoom));
  } catch (e) {
    console.error("Local save error:", e);
  }
}

export function generateDefaultSeedRooms() {
  const DEFAULT_NAMES = ["김민준", "이서연", "박도윤", "정하은", "최지호", "강지우", "윤시우", "조서아", "임민서", "한준우", "오예은", "서지안", "신유준", "권다은", "황현우", "송지유", "안우진", "홍서현", "유동현", "고민서", "문도현", "양채원", "손정우", "배채은", "조민성", "백지아", "허성민", "남은서", "유준호"];
  const res = {};

  ROOM_NUMBERS.forEach((rNum, idx) => {
    const isJeonse = (rNum === 701);
    const rentVal = isJeonse ? 0 : (400000 + (rNum % 5) * 20000);
    const maintVal = 50000;
    const payments = {};

    for (let m = 1; m <= 12; m++) {
      const isPaid = (m <= 9); // 1~9월 완납
      payments[m] = {
        month: m,
        paid: isPaid,
        paid_date: isPaid ? `2026-0${m}-10`.replace('-010', '-10') : "",
        rent_amount: rentVal,
        maintenance_amount: maintVal,
        note: isPaid ? "정상 입금" : ""
      };
    }

    res[rNum] = {
      room_number: rNum,
      name: DEFAULT_NAMES[idx % DEFAULT_NAMES.length],
      phone: `010-${2000 + idx}-${String(rNum).padStart(4, '0')}`,
      id_number: `950${(idx % 9) + 1}01-*******`,
      lease_type: isJeonse ? "전세" : "월세",
      pay_timing: "후불",
      deposit: isJeonse ? 80000000 : (5000000 + (rNum % 3) * 5000000),
      rent: rentVal,
      maintenance: maintVal,
      clean_fee: 80000,
      move_in: "2024-03-01",
      expiry: "2026-12-31",
      move_out: "",
      payments: payments
    };
  });
  return res;
}

export function loadLocalFallback() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.selectedRoom = parsed.selectedRoom || 101;
      state.rooms = parsed.rooms && Object.keys(parsed.rooms).length > 0 ? parsed.rooms : generateDefaultSeedRooms();
      state.expenses = parsed.expenses || [];
    } else {
      state.selectedRoom = 101;
      state.rooms = generateDefaultSeedRooms();
      state.expenses = [];
      saveLocalFallback();
    }
  } catch (e) {
    console.error("Local load error:", e);
    state.rooms = generateDefaultSeedRooms();
  }
}
