/**
 * apps/rent/frontend/bundle.js
 * Standalone bundle supporting both file:/// and http:// protocols.
 */
(function() {
/**
 * apps/rent/frontend/js/state.js
 * 원룸 임차료 관리 시스템 전역 반응형 상태 관리 모듈.
 * 백엔드(integrat.db) 실시간 동기화 및 오프라인 localStorage 폴백 지원.
 */



const STORAGE_KEY = "ONEROOM_DATA_STORE_29_V4";

const ROOM_NUMBERS = [
  101,
  201, 202, 203, 204, 205,
  301, 302, 303, 304, 305,
  401, 402, 403, 404, 405,
  501, 502, 503, 504, 505,
  601, 602, 603, 604, 605,
  701, 702, 703
];

const FLOOR_STRUCTURE = [
  { label: '7층', rooms: [701, 702, 703] },
  { label: '6층', rooms: [601, 602, 603, 604, 605] },
  { label: '5층', rooms: [501, 502, 503, 504, 505] },
  { label: '4층', rooms: [401, 402, 403, 404, 405] },
  { label: '3층', rooms: [301, 302, 303, 304, 305] },
  { label: '2층', rooms: [201, 202, 203, 204, 205] },
  { label: '1층', rooms: [101] }
];

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth() + 1;
const formattedToday = today.toISOString().split('T')[0];

const state = {
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
async function loadInitialData() {
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

function saveLocalFallback() {
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

function generateDefaultSeedRooms() {
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

function loadLocalFallback() {
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


/**
 * apps/rent/frontend/js/api.js
 * MQnet SaaS 표준 동적 API Base URL 판정 및 백엔드(integrat.db) 통신 클라이언트.
 * 오프라인/로컬 실행 시 localStorage 자동 폴백 지원.
 */

function getApiBase(appName = 'rent') {
  const p = window.location.pathname.toLowerCase();
  if (p.startsWith(`/${appName.toLowerCase()}`)) {
    return `/api/${appName}`;
  }
  return '/api';
}

function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'X-App-ID': 'rent'
  };
  const token = localStorage.getItem('mqnet_auth_token') || sessionStorage.getItem('mqnet_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithAuth(url, options = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {})
  };
  const sep = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${sep}_t=${Date.now()}`;

  const res = await fetch(fullUrl, {
    ...options,
    headers,
    cache: 'no-store'
  });

  if (!res.ok) {
    let errMsg = `HTTP Error ${res.status}`;
    try {
      const errData = await res.json();
      errMsg = errData.detail || errData.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }
  return await res.json();
}

// ── 핵심 원룸 API ──
async function apiGetRooms(branchId = 'main') {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/rooms?branch_id=${encodeURIComponent(branchId)}`);
}

async function apiUpdateContract(roomNumber, data, branchId = 'main') {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/rooms/${roomNumber}?branch_id=${encodeURIComponent(branchId)}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

async function apiProcessPayment(roomNumber, month, branchId = 'main', paidDate = null, note = '정상 입금') {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/rooms/${roomNumber}/payment?branch_id=${encodeURIComponent(branchId)}`, {
    method: 'POST',
    body: JSON.stringify({ month, paid_date: paidDate, note })
  });
}

async function apiCancelPayment(roomNumber, month, branchId = 'main') {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/rooms/${roomNumber}/cancel-payment?branch_id=${encodeURIComponent(branchId)}`, {
    method: 'POST',
    body: JSON.stringify({ month })
  });
}

async function apiGetExpenses(branchId = 'main') {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/expenses?branch_id=${encodeURIComponent(branchId)}`);
}

async function apiCreateExpense(data, branchId = 'main') {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/expenses?branch_id=${encodeURIComponent(branchId)}`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// ── 다중 건물/지점 API ──
async function apiGetBranches(activeOnly = false) {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/branches?active_only=${activeOnly}`);
}

async function apiCreateBranch(data) {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/branches`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

async function apiUpdateBranchBilling(branchId, billingStatus, lastPaidAt = null) {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/branches/${branchId}/billing`, {
    method: 'PATCH',
    body: JSON.stringify({ billing_status: billingStatus, last_paid_at: lastPaidAt })
  });
}

// ── 관리자 로그인 & 등업 신청 ──
async function apiAdminLogin(username, password) {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/auth/admin-login`, {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

async function apiRequestUpgrade(data) {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/upgrade-request`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// ── 부가가치세(VAT) 기간별 수납 집계 API ──
async function apiGetVatReport(startMonth = 1, endMonth = 6, year = 2026, branchId = 'main') {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/vat-report?start_month=${startMonth}&end_month=${endMonth}&year=${year}&branch_id=${encodeURIComponent(branchId)}`);
}



/**
 * apps/rent/frontend/js/ui.js
 * 원룸 임차료 관리 시스템 DOM 렌더링 및 UI 유틸리티.
 */




function selectRoom(roomNum) {
  state.selectedRoom = parseInt(roomNum, 10);
  saveLocalFallback();
  renderAll();
}

function renderAll() {
  const roomNum = state.selectedRoom;
  const room = state.rooms[roomNum];
  if (!room) return;

  renderFloorMap();
  renderBranchSelector();
  renderContractSummary(room);
  renderCurrentMonthSection(room);
  renderPastHistorySection(room);
}

function renderBranchSelector() {
  const sel = document.getElementById('branchSelector');
  if (!sel) return;

  sel.innerHTML = '';
  if (state.branches.length === 0) {
    const opt = document.createElement('option');
    opt.value = 'main';
    opt.textContent = '원룸 본관 (29개실)';
    sel.appendChild(opt);
  } else {
    state.branches.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.branch_id;
      opt.textContent = `${b.name} (${b.billing_status === 'PAID' ? '정상' : '미납'})`;
      if (b.branch_id === state.currentBranch) opt.selected = true;
      sel.appendChild(opt);
    });
  }
}

function renderFloorMap() {
  const container = document.getElementById('roomFloorMap');
  if (!container) return;
  container.innerHTML = '';

  FLOOR_STRUCTURE.forEach(floor => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 flex-wrap sm:flex-nowrap';

    const label = document.createElement('span');
    label.className = 'text-xs font-bold text-slate-400 w-9 shrink-0 text-center py-1 bg-surface-850 rounded border border-slate-800 font-mono';
    label.textContent = floor.label;
    row.appendChild(label);

    const roomsContainer = document.createElement('div');
    roomsContainer.className = 'flex items-center gap-1.5 flex-1 flex-wrap';

    floor.rooms.forEach(rNum => {
      const rData = state.rooms[rNum] || {};
      const isSelected = (rNum === state.selectedRoom);
      const isVacant = !rData.name || !!rData.move_out;
      const curPay = (rData.payments && rData.payments[currentMonth]) || {};
      const isPaid = !isVacant && !!curPay.paid;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.onclick = () => selectRoom(rNum);

      let dotColor = 'bg-slate-500';
      if (!isVacant) {
        dotColor = isPaid ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse';
      }

      if (isSelected) {
        btn.className = 'px-2.5 py-1 text-xs font-black rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 ring-2 ring-cyan-200 shadow-md shadow-cyan-900/40 flex items-center gap-1.5 transition-all transform scale-105 cursor-pointer';
      } else {
        btn.className = 'px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-800 hover:bg-surface-700 text-slate-200 border border-slate-700/80 flex items-center gap-1.5 transition hover:border-slate-500 cursor-pointer';
      }

      btn.innerHTML = `
        <span class="w-2 h-2 rounded-full ${dotColor}"></span>
        <span class="font-mono">${rNum}호</span>
        <span class="text-[10px] ${isSelected ? 'text-slate-900 font-bold' : 'text-slate-400'}">${isVacant ? '공실' : (rData.name || '')}</span>
      `;

      roomsContainer.appendChild(btn);
    });

    row.appendChild(roomsContainer);
    container.appendChild(row);
  });
}

function renderContractSummary(room) {
  const rNum = room.room_number;
  const isVacant = !room.name || !!room.move_out;
  const leaseType = room.lease_type || '월세';
  const payTiming = room.pay_timing || '후불';

  // 1. Large Room Badges
  const titleBig = document.getElementById('cardRoomTitleBig');
  if (titleBig) titleBig.textContent = `${rNum}호`;

  const curBig = document.getElementById('curRoomNumberLarge');
  if (curBig) curBig.textContent = `${rNum}호`;

  const select = document.getElementById('roomSelect');
  if (select && select.value !== String(rNum)) {
    select.value = rNum;
  }

  // 2. Tenant Summary
  document.getElementById('cardTenantName').textContent = isVacant ? '공실 (미계약)' : `${room.name} 고객`;
  document.getElementById('cardPhoneText').textContent = isVacant ? '등록된 임차인 없음' : `연락처: ${room.phone || '미등록'}`;

  const statusBadge = document.getElementById('cardStatusBadge');
  if (isVacant) {
    statusBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-800 text-slate-400 border border-slate-700';
    statusBadge.textContent = '공실';
  } else {
    statusBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    statusBadge.textContent = '입주중';
  }

  const leaseBadge = document.getElementById('cardLeaseTypeBadge');
  if (leaseType === '전세') {
    leaseBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30';
    leaseBadge.textContent = '전세';
  } else {
    leaseBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30';
    leaseBadge.textContent = '월세';
  }

  document.getElementById('cardPayTimingBadge').textContent = payTiming;

  // 3. Contract Detail Grid
  document.getElementById('cIdNumber').textContent = isVacant ? '-' : (room.id_number || '-');
  document.getElementById('cTypeTimingSummary').textContent = `${leaseType} / ${payTiming}`;
  document.getElementById('cDeposit').textContent = `${Number(room.deposit || 0).toLocaleString()}원`;
  document.getElementById('cRent').textContent = leaseType === '전세' ? '0원 (전세)' : `${Number(room.rent || 0).toLocaleString()}원`;
  document.getElementById('cMaintenance').textContent = `${Number(room.maintenance || 0).toLocaleString()}원`;
  document.getElementById('cCleanFee').textContent = `${Number(room.clean_fee || 0).toLocaleString()}원`;
  document.getElementById('cPeriod').textContent = (room.move_in && room.expiry) ? `${room.move_in} ~ ${room.expiry}` : '-';
  document.getElementById('cMoveOut').textContent = room.move_out || '해당 없음';
}

function renderCurrentMonthSection(room) {
  const rNum = room.room_number;
  const isVacant = !room.name || !!room.move_out;
  const leaseType = room.lease_type || '월세';
  const payTiming = room.pay_timing || '후불';

  if (!room.payments) room.payments = {};
  if (!room.payments[currentMonth]) {
    room.payments[currentMonth] = {
      month: currentMonth,
      paid: false,
      paid_date: '',
      rent_amount: leaseType === '전세' ? 0 : room.rent,
      maintenance_amount: room.maintenance,
      note: ''
    };
  }

  const curPay = room.payments[currentMonth];
  const curRent = (leaseType === '전세') ? 0 : (curPay.rent_amount !== undefined ? curPay.rent_amount : room.rent);
  const curMaint = curPay.maintenance_amount !== undefined ? curPay.maintenance_amount : room.maintenance;
  const curTotal = curRent + curMaint;

  document.getElementById('curMonthTitle').textContent = `${currentMonth}월`;
  document.getElementById('curTodayDate').textContent = formattedToday;
  document.getElementById('curTimingTag').textContent = `${payTiming} (${payTiming === '선불' ? '당월 선납' : '전월분 후납'})`;

  document.getElementById('curPaidDate').textContent = curPay.paid ? (curPay.paid_date || formattedToday) : '-';
  document.getElementById('curRentAmount').textContent = `${Number(curRent).toLocaleString()}원`;
  document.getElementById('curMaintAmount').textContent = `${Number(curMaint).toLocaleString()}원`;
  document.getElementById('curTotalAmount').textContent = `${Number(curTotal).toLocaleString()}원`;

  const statusBadge = document.getElementById('curMonthStatusBadge');
  const actionArea = document.getElementById('curMonthActionArea');

  if (isVacant) {
    statusBadge.className = 'px-2.5 py-0.5 rounded-full font-bold text-xs bg-slate-800 text-slate-400 border border-slate-700';
    statusBadge.textContent = '공실';
    actionArea.innerHTML = `<span class="text-xs text-slate-500">계약 등록 후 납부 가능</span>`;
  } else if (curPay.paid) {
    statusBadge.className = 'px-2.5 py-0.5 rounded-full font-bold text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    statusBadge.textContent = '완납';
    actionArea.innerHTML = `
      <div class="flex items-center gap-2">
        <button type="button" disabled class="px-4 py-2 rounded-xl text-xs font-semibold bg-surface-800 text-slate-400 border border-slate-700/80 cursor-not-allowed flex items-center gap-1.5 opacity-60">
          <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
          이번 달 납부 완료
        </button>
        <button type="button" id="btnCancelPay" class="px-3.5 py-2 rounded-xl text-xs bg-surface-800 hover:bg-surface-700 text-slate-300 hover:text-rose-300 border border-slate-700 transition flex items-center gap-1 cursor-pointer">
          납부 취소
        </button>
      </div>
    `;
    document.getElementById('btnCancelPay').onclick = () => handleCancelPayment(rNum, currentMonth);
  } else {
    statusBadge.className = 'px-2.5 py-0.5 rounded-full font-bold text-xs bg-rose-500/20 text-rose-300 border border-rose-500/40';
    statusBadge.textContent = '미납';
    actionArea.innerHTML = `
      <button type="button" id="btnProcessPay" class="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-lg shadow-cyan-950/60 flex items-center gap-1.5 cursor-pointer">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
        💳 이번 달(${currentMonth}월) 즉시 납부 (${payTiming})
      </button>
    `;
    document.getElementById('btnProcessPay').onclick = () => handleProcessPayment(rNum, currentMonth);
  }
}

function renderPastHistorySection(room) {
  const rNum = room.room_number;
  const tbody = document.getElementById('pastPaymentTableBody');
  const subtitle = document.getElementById('pastTableSubtitle');
  if (!tbody || !subtitle) return;
  tbody.innerHTML = '';

  let moveInMonth = 1;
  if (room.move_in) {
    const parts = room.move_in.split('-');
    if (parts.length >= 2) {
      const mIn = parseInt(parts[1], 10);
      if (!isNaN(mIn) && mIn >= 1 && mIn <= 12) moveInMonth = mIn;
    }
  }

  const prevMonth = currentMonth - 1;
  subtitle.textContent = `(전입 ${moveInMonth}월 ~ 전월 ${prevMonth >= 1 ? prevMonth : 0}월)`;

  if (prevMonth < 1 || moveInMonth > prevMonth || !room.name) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-6 text-center text-slate-500 italic">
          표시할 과거 납부 내역이 없습니다. (전입월이 당월이거나 전출/공실 상태)
        </td>
      </tr>
    `;
    return;
  }

  const isJeonse = (room.lease_type === '전세');

  for (let m = moveInMonth; m <= prevMonth; m++) {
    const p = (room.payments && room.payments[m]) || {
      month: m,
      paid: false,
      paid_date: '',
      rent_amount: isJeonse ? 0 : room.rent,
      maintenance_amount: room.maintenance,
      note: ''
    };

    const rAmt = isJeonse ? 0 : (p.rent_amount !== undefined ? p.rent_amount : room.rent);
    const mAmt = p.maintenance_amount !== undefined ? p.maintenance_amount : room.maintenance;
    const tot = rAmt + mAmt;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-surface-850/60 transition';
    tr.innerHTML = `
      <td class="py-2.5 px-3 text-center border-r border-slate-800 font-bold text-slate-300">
        ${m}월 ${m === moveInMonth ? '<span class="text-[10px] text-cyan-400 font-normal block">(전입월)</span>' : ''}
      </td>
      <td class="py-2.5 px-3 border-r border-slate-800 text-center text-slate-300 font-mono">
        ${p.paid ? (p.paid_date || '-') : '-'}
      </td>
      <td class="py-2.5 px-3 border-r border-slate-800 text-right text-slate-300 font-mono">
        ${Number(rAmt).toLocaleString()}
      </td>
      <td class="py-2.5 px-3 border-r border-slate-800 text-right text-slate-300 font-mono">
        ${Number(mAmt).toLocaleString()}
      </td>
      <td class="py-2.5 px-3 border-r border-slate-800 text-right font-bold text-slate-100 font-mono">
        ${Number(tot).toLocaleString()}
      </td>
      <td class="py-2.5 px-3 border-r border-slate-800 text-center">
        <span class="inline-block px-2 py-0.5 rounded text-[11px] font-bold ${p.paid ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}">
          ${p.paid ? '완납' : '미납'}
        </span>
      </td>
      <td class="py-2.5 px-3 text-center">
        ${p.paid ? `
          <button type="button" class="btn-cancel-past px-2.5 py-1 rounded text-[11px] bg-surface-800 hover:bg-surface-700 text-slate-300 hover:text-rose-300 border border-slate-700 transition cursor-pointer" data-month="${m}">
            취소
          </button>
        ` : `
          <button type="button" class="btn-pay-past px-2.5 py-1 rounded text-[11px] bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition shadow-sm cursor-pointer" data-month="${m}">
            납부
          </button>
        `}
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('.btn-cancel-past').forEach(btn => {
    btn.onclick = () => handleCancelPayment(rNum, parseInt(btn.dataset.month, 10));
  });
  tbody.querySelectorAll('.btn-pay-past').forEach(btn => {
    btn.onclick = () => handleProcessPayment(rNum, parseInt(btn.dataset.month, 10));
  });
}

// ── 수납 처리 비동기 액션 ──
async function handleProcessPayment(roomNum, month) {
  try {
    if (state.isOnline) {
      const res = await apiProcessPayment(roomNum, month, state.currentBranch, formattedToday, "정상 입금");
      state.rooms[roomNum] = res;
    } else {
      // 오프라인 폴백
      const r = state.rooms[roomNum];
      if (r && r.payments) {
        if (!r.payments[month]) r.payments[month] = {};
        r.payments[month].paid = true;
        r.payments[month].paid_date = formattedToday;
        r.payments[month].note = "정상 입금";
      }
    }
    saveLocalFallback();
    renderAll();
  } catch (err) {
    alert("수납 처리 실패: " + err.message);
  }
}

async function handleCancelPayment(roomNum, month) {
  try {
    if (state.isOnline) {
      const res = await apiCancelPayment(roomNum, month, state.currentBranch);
      state.rooms[roomNum] = res;
    } else {
      // 오프라인 폴백
      const r = state.rooms[roomNum];
      if (r && r.payments && r.payments[month]) {
        r.payments[month].paid = false;
        r.payments[month].paid_date = "";
        r.payments[month].note = "납부 취소";
      }
    }
    saveLocalFallback();
    renderAll();
  } catch (err) {
    alert("납부 취소 실패: " + err.message);
  }
}


/**
 * apps/rent/frontend/js/modals.js
 * 원룸 임차료 관리 시스템 모달 팝업 및 계약/지출 폼 제어 모듈.
 */





function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('hidden');
    m.classList.add('flex');
  }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('flex');
    m.classList.add('hidden');
  }
}

// ── 계약 수정 모달 ──
function openContractEditModal() {
  const rNum = state.selectedRoom;
  const room = state.rooms[rNum];
  if (!room) return;

  document.getElementById('modalRoomTitle').textContent = `${rNum}호`;
  document.getElementById('formLeaseType').value = room.lease_type || '월세';
  document.getElementById('formPayTiming').value = room.pay_timing || '후불';
  document.getElementById('formName').value = room.name || '';
  document.getElementById('formIdNumber').value = room.id_number || '';
  document.getElementById('formPhone').value = room.phone || '';
  document.getElementById('formDeposit').value = room.deposit || 0;
  document.getElementById('formRent').value = room.rent || 0;
  document.getElementById('formMaintenance').value = room.maintenance || 0;
  document.getElementById('formCleanFee').value = room.clean_fee || 0;
  document.getElementById('formMoveIn').value = room.move_in || '';
  document.getElementById('formExpiry').value = room.expiry || '';
  document.getElementById('formMoveOut').value = room.move_out || '';

  handleLeaseTypeChangeInForm();
  openModal('contractModal');
}

function handleLeaseTypeChangeInForm() {
  const leaseType = document.getElementById('formLeaseType').value;
  const rentInput = document.getElementById('formRent');
  if (leaseType === '전세') {
    rentInput.value = 0;
    rentInput.disabled = true;
    rentInput.classList.add('opacity-50');
  } else {
    rentInput.disabled = false;
    rentInput.classList.remove('opacity-50');
  }
}

async function handleContractFormSubmit(e) {
  e.preventDefault();
  const rNum = state.selectedRoom;
  const room = state.rooms[rNum];
  if (!room) return;

  const leaseType = document.getElementById('formLeaseType').value;
  const payload = {
    lease_type: leaseType,
    pay_timing: document.getElementById('formPayTiming').value,
    name: document.getElementById('formName').value.trim(),
    id_number: document.getElementById('formIdNumber').value.trim(),
    phone: document.getElementById('formPhone').value.trim(),
    deposit: Number(document.getElementById('formDeposit').value || 0),
    rent: leaseType === '전세' ? 0 : Number(document.getElementById('formRent').value || 0),
    maintenance: Number(document.getElementById('formMaintenance').value || 0),
    clean_fee: Number(document.getElementById('formCleanFee').value || 0),
    move_in: document.getElementById('formMoveIn').value,
    expiry: document.getElementById('formExpiry').value,
    move_out: document.getElementById('formMoveOut').value
  };

  try {
    if (state.isOnline) {
      const res = await apiUpdateContract(rNum, payload, state.currentBranch);
      state.rooms[rNum] = res;
    } else {
      // 오프라인 로컬 반영
      Object.assign(room, payload);
    }
    saveLocalFallback();
    closeModal('contractModal');
    renderAll();
  } catch (err) {
    alert("계약 정보 저장 실패: " + err.message);
  }
}

// ── 지출 모달 & 장부 ──
function openExpenseModal() {
  document.getElementById('expItem').value = '';
  document.getElementById('expAmount').value = '';
  document.getElementById('expNote').value = '';
  openModal('expenseModal');
}

async function handleExpenseFormSubmit(e) {
  e.preventDefault();
  const item = document.getElementById('expItem').value.trim();
  const amount = Number(document.getElementById('expAmount').value || 0);
  const note = document.getElementById('expNote').value.trim();

  const payload = {
    date: formattedToday,
    item: item,
    amount: amount,
    note: note
  };

  try {
    if (state.isOnline) {
      const res = await apiCreateExpense(payload, state.currentBranch);
      state.expenses.unshift(res);
    } else {
      payload.id = Date.now().toString();
      state.expenses.unshift(payload);
    }
    saveLocalFallback();
    closeModal('expenseModal');
    openLedgerModal();
  } catch (err) {
    alert("지출 등록 실패: " + err.message);
  }
}

function openLedgerModal() {
  const container = document.getElementById('ledgerListContainer');
  const badge = document.getElementById('ledgerTotalSumBadge');
  if (!container || !badge) return;
  container.innerHTML = '';

  let totalSum = 0;
  if (state.expenses.length === 0) {
    container.innerHTML = '<div class="py-8 text-center text-slate-500 text-xs">등록된 지출 내역이 없습니다.</div>';
  } else {
    state.expenses.forEach(exp => {
      totalSum += Number(exp.amount || 0);
      const div = document.createElement('div');
      div.className = 'p-3 rounded-xl bg-surface-850 border border-slate-800 flex items-center justify-between text-xs';
      div.innerHTML = `
        <div>
          <div class="font-bold text-slate-200">${exp.item}</div>
          <div class="text-[11px] text-slate-400 mt-0.5">${exp.date} · ${exp.note || '비고 없음'}</div>
        </div>
        <div class="text-right">
          <span class="font-bold text-amber-400 font-mono text-sm">${Number(exp.amount).toLocaleString()}원</span>
        </div>
      `;
      container.appendChild(div);
    });
  }

  badge.textContent = `합계: ${totalSum.toLocaleString()}원`;
  openModal('ledgerModal');
}

// ── CSV 엑셀 내보내기 ──
function exportCurrentRoomCSV() {
  const rNum = state.selectedRoom;
  const r = state.rooms[rNum];
  if (!r) return;

  let csv = "\uFEFF"; // UTF-8 BOM
  csv += `호실,${rNum}호\n`;
  csv += `임차인,${r.name || '공실'}\n`;
  csv += `임차유형,${r.lease_type || '월세'}\n`;
  csv += `납부방식,${r.pay_timing || '후불'}\n`;
  csv += `전화번호,${r.phone || ''}\n`;
  csv += `보증금,${r.deposit || 0}\n`;
  csv += `월세,${r.rent || 0}\n`;
  csv += `관리비,${r.maintenance || 0}\n`;
  csv += `계약기간,${r.move_in || ''} ~ ${r.expiry || ''}\n\n`;

  csv += "월,납부여부,납부일자,임차료,관리비,합계\n";
  for (let m = 1; m <= 12; m++) {
    const p = (r.payments && r.payments[m]) || {};
    const isPaid = p.paid ? "완납" : "미납";
    const date = p.paid_date || "";
    const rent = p.rent_amount !== undefined ? p.rent_amount : r.rent;
    const maint = p.maintenance_amount !== undefined ? p.maintenance_amount : r.maintenance;
    const sum = rent + maint;
    csv += `${m}월,${isPaid},${date},${rent},${maint},${sum}\n`;
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `원룸_${rNum}호_납부내역_${formattedToday}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ── 등업 신청 모달 ──
function openUpgradeModal() {
  document.getElementById('upgradeName').value = '';
  document.getElementById('upgradePhone').value = '';
  document.getElementById('upgradeReason').value = '';
  openModal('upgradeModal');
}

async function handleUpgradeSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('upgradeName').value.trim();
  const phone = document.getElementById('upgradePhone').value.trim();
  const reason = document.getElementById('upgradeReason').value.trim();

  try {
    await apiRequestUpgrade({
      user_name: name,
      contact: phone,
      target_branch_id: state.currentBranch,
      reason: reason
    });
    closeModal('upgradeModal');
    alert("✅ 관리자 등업 신청이 완료되었습니다.\n본사 승인 후 권한이 부여됩니다.");
  } catch (err) {
    alert("등업 신청 실패: " + err.message);
  }
}

// ── 5. 부가가치세(VAT) 및 기간별 호실 수납 집계 ──
let currentVatData = null;
let currentVatParams = {
  year: 2026,
  startMonth: 1,
  endMonth: 6,
  label: '1기 (1~6월)'
};

async function openVatModal() {
  openModal('vatModal');
  // 기본 1기 (1~6월, 2026년) 자동 조회
  await setVatPeriod(1, 6, '1기 (1~6월)');
}

async function setVatPeriod(startMonth, endMonth, label) {
  currentVatParams.startMonth = Number(startMonth);
  currentVatParams.endMonth = Number(endMonth);
  currentVatParams.label = label;
  currentVatParams.year = Number(document.getElementById('vatYearSelect')?.value || 2026);

  // 셀렉트 박스 동기화
  const sSelect = document.getElementById('vatStartMonthSelect');
  const eSelect = document.getElementById('vatEndMonthSelect');
  if (sSelect) sSelect.value = startMonth;
  if (eSelect) eSelect.value = endMonth;

  // 프리셋 버튼 active 상태 스타일 토글
  document.querySelectorAll('.vat-preset-btn').forEach(btn => {
    if (btn.textContent.trim() === label || (label.startsWith(btn.textContent.trim()))) {
      btn.className = 'vat-preset-btn px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/80 font-bold transition';
    } else {
      btn.className = 'vat-preset-btn px-2.5 py-1 rounded-lg bg-surface-800 hover:bg-surface-700 text-slate-300 border border-slate-700 font-medium transition';
    }
  });

  await fetchAndRenderVat(currentVatParams.startMonth, currentVatParams.endMonth, currentVatParams.year, label);
}

async function handleVatCustomQuery() {
  const year = Number(document.getElementById('vatYearSelect')?.value || 2026);
  const startMonth = Number(document.getElementById('vatStartMonthSelect')?.value || 1);
  const endMonth = Number(document.getElementById('vatEndMonthSelect')?.value || 12);

  if (startMonth > endMonth) {
    alert("시작월은 종료월보다 작거나 같아야 합니다.");
    return;
  }

  // 프리셋 버튼 active 해제
  document.querySelectorAll('.vat-preset-btn').forEach(btn => {
    btn.className = 'vat-preset-btn px-2.5 py-1 rounded-lg bg-surface-800 hover:bg-surface-700 text-slate-300 border border-slate-700 font-medium transition';
  });

  const label = `${startMonth}~${endMonth}월`;
  currentVatParams = { year, startMonth, endMonth, label };
  await fetchAndRenderVat(startMonth, endMonth, year, label);
}

async function fetchAndRenderVat(startMonth, endMonth, year, label) {
  const labelEl = document.getElementById('vatCurrentPeriodLabel');
  if (labelEl) {
    labelEl.textContent = `${year}년 ${label}`;
  }

  const thead = document.getElementById('vatTableHead');
  const tbody = document.getElementById('vatTableBody');
  const tfoot = document.getElementById('vatTableFoot');

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="15" class="py-8 text-center text-slate-400">데이터를 집계하고 있습니다...</td></tr>`;
  }

  let data = null;
  try {
    if (state.isOnline) {
      data = await apiGetVatReport(startMonth, endMonth, year, state.currentBranch);
    }
  } catch (err) {
    console.warn("온라인 부가세 API 호출 실패, 로컬 데이터로 대체 계산합니다:", err);
  }

  // 오프라인 fallback 또는 API 에러 시 프론트엔드 자체 계산
  if (!data || !data.rows) {
    data = calculateLocalVatReport(startMonth, endMonth, year);
  }

  currentVatData = data;
  renderVatReportUI(data);
}

function calculateLocalVatReport(startMonth, endMonth, year) {
  const months = [];
  for (let m = startMonth; m <= endMonth; m++) months.push(m);

  let total_collected = 0;
  let total_supply = 0;
  let total_vat = 0;
  const rows = [];

  const sortedRoomKeys = Object.keys(state.rooms || {}).sort((a, b) => Number(a) - Number(b));

  for (const rNum of sortedRoomKeys) {
    const r = state.rooms[rNum] || {};
    const monthly_amounts = {};
    let room_period_total = 0;

    for (const m of months) {
      const p = (r.payments && r.payments[m]) || {};
      let amt = 0;
      if (p.paid) {
        amt = (p.rent_amount !== undefined ? p.rent_amount : (r.rent || 0)) + 
              (p.maintenance_amount !== undefined ? p.maintenance_amount : (r.maintenance || 0));
      }
      monthly_amounts[m] = amt;
      room_period_total += amt;
    }

    const supply_val = Math.round(room_period_total / 1.1);
    const vat_val = room_period_total - supply_val;

    total_collected += room_period_total;
    total_supply += supply_val;
    total_vat += vat_val;

    const isAllPaid = months.every(m => r.payments && r.payments[m] && r.payments[m].paid);
    rows.push({
      room_number: Number(rNum),
      tenant_name: r.name || '공실',
      lease_type: r.lease_type || '월세',
      deposit: r.deposit || 0,
      monthly_amounts: monthly_amounts,
      period_total: room_period_total,
      supply_value: supply_val,
      vat_value: vat_val,
      status: isAllPaid ? '완납' : (room_period_total === 0 ? '미납' : '부분완납')
    });
  }

  return {
    success: true,
    year: year,
    start_month: startMonth,
    end_month: endMonth,
    months: months,
    total_collected: total_collected,
    total_supply: total_supply,
    total_vat: total_vat,
    rows: rows
  };
}

function renderVatReportUI(data) {
  // 1. KPI Cards
  const kpiTotal = document.getElementById('vatKpiTotalAmount');
  const kpiSupply = document.getElementById('vatKpiSupplyValue');
  const kpiVat = document.getElementById('vatKpiVatAmount');
  const kpiCount = document.getElementById('vatKpiCountSummary');

  if (kpiTotal) kpiTotal.textContent = `${Number(data.total_collected || 0).toLocaleString()}원`;
  if (kpiSupply) kpiSupply.textContent = `${Number(data.total_supply || 0).toLocaleString()}원`;
  if (kpiVat) kpiVat.textContent = `${Number(data.total_vat || 0).toLocaleString()}원`;

  const paidRoomsCount = data.rows.filter(r => r.status === '완납').length;
  if (kpiCount) kpiCount.textContent = `${data.rows.length}개실 / ${paidRoomsCount}개실 완납`;

  // 2. Table Header
  const thead = document.getElementById('vatTableHead');
  if (thead) {
    let thHtml = `
      <tr>
        <th class="py-2.5 px-3 border border-slate-700 bg-surface-850 text-cyan-300 font-bold text-center">호실</th>
        <th class="py-2.5 px-3 border border-slate-700 bg-surface-850 text-slate-200 text-left">임차인</th>
        <th class="py-2.5 px-2 border border-slate-700 bg-surface-850 text-slate-300 text-center">유형</th>
        <th class="py-2.5 px-3 border border-slate-700 bg-surface-850 text-slate-300 text-right">보증금</th>
    `;
    data.months.forEach(m => {
      thHtml += `<th class="py-2.5 px-2 border border-slate-700 bg-surface-850 text-cyan-200 text-right">${m}월</th>`;
    });
    thHtml += `
        <th class="py-2.5 px-3 border border-slate-700 bg-surface-850 text-amber-300 font-bold text-right">합계(VAT포함)</th>
        <th class="py-2.5 px-3 border border-slate-700 bg-surface-850 text-cyan-300 font-bold text-right">공급가액</th>
        <th class="py-2.5 px-3 border border-slate-700 bg-surface-850 text-emerald-300 font-bold text-right">부가가치세</th>
        <th class="py-2.5 px-2 border border-slate-700 bg-surface-850 text-slate-300 text-center">상태</th>
      </tr>
    `;
    thead.innerHTML = thHtml;
  }

  // 3. Table Body
  const tbody = document.getElementById('vatTableBody');
  const monthSums = {};
  data.months.forEach(m => { monthSums[m] = 0; });
  let totalDeposit = 0;

  if (tbody) {
    if (!data.rows || data.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${7 + data.months.length}" class="py-6 text-center text-slate-500">조회된 호실 데이터가 없습니다.</td></tr>`;
    } else {
      let trHtml = '';
      data.rows.forEach(row => {
        totalDeposit += Number(row.deposit || 0);

        let statusBadge = '<span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">완납</span>';
        if (row.status === '미납') {
          statusBadge = '<span class="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30">미납</span>';
        } else if (row.status === '부분완납') {
          statusBadge = '<span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30">부분</span>';
        }

        trHtml += `
          <tr class="hover:bg-surface-800/60 transition">
            <td class="py-2 px-3 border border-slate-800 text-cyan-300 font-bold text-center bg-surface-900/40">${row.room_number}호</td>
            <td class="py-2 px-3 border border-slate-800 font-sans text-slate-200 font-medium">${row.tenant_name}</td>
            <td class="py-2 px-2 border border-slate-800 font-sans text-center text-slate-400 text-[11px]">${row.lease_type}</td>
            <td class="py-2 px-3 border border-slate-800 text-right text-slate-300">${Number(row.deposit).toLocaleString()}원</td>
        `;

        data.months.forEach(m => {
          const amt = (row.monthly_amounts && row.monthly_amounts[m]) || 0;
          monthSums[m] += amt;
          const amtText = amt > 0 ? `${amt.toLocaleString()}원` : `<span class="text-slate-600">-</span>`;
          const amtColor = amt > 0 ? `text-slate-100` : ``;
          trHtml += `<td class="py-2 px-2 border border-slate-800 text-right ${amtColor}">${amtText}</td>`;
        });

        trHtml += `
            <td class="py-2 px-3 border border-slate-800 text-right font-bold text-amber-300">${Number(row.period_total).toLocaleString()}원</td>
            <td class="py-2 px-3 border border-slate-800 text-right font-semibold text-cyan-300">${Number(row.supply_value).toLocaleString()}원</td>
            <td class="py-2 px-3 border border-slate-800 text-right font-semibold text-emerald-300">${Number(row.vat_value).toLocaleString()}원</td>
            <td class="py-2 px-2 border border-slate-800 text-center font-sans">${statusBadge}</td>
          </tr>
        `;
      });
      tbody.innerHTML = trHtml;
    }
  }

  // 4. Table Footer (Total Sum Row)
  const tfoot = document.getElementById('vatTableFoot');
  if (tfoot) {
    let tfHtml = `
      <tr class="bg-surface-850 font-bold border-t-2 border-cyan-500/80">
        <td class="py-2.5 px-3 border border-slate-700 text-center text-cyan-300 font-sans" colspan="3">전체 합계 (총계)</td>
        <td class="py-2.5 px-3 border border-slate-700 text-right text-slate-300">${totalDeposit.toLocaleString()}원</td>
    `;
    data.months.forEach(m => {
      tfHtml += `<td class="py-2.5 px-2 border border-slate-700 text-right text-cyan-200">${monthSums[m].toLocaleString()}원</td>`;
    });
    tfHtml += `
        <td class="py-2.5 px-3 border border-slate-700 text-right text-amber-300 text-sm font-black">${Number(data.total_collected || 0).toLocaleString()}원</td>
        <td class="py-2.5 px-3 border border-slate-700 text-right text-cyan-300 text-sm font-black">${Number(data.total_supply || 0).toLocaleString()}원</td>
        <td class="py-2.5 px-3 border border-slate-700 text-right text-emerald-300 text-sm font-black">${Number(data.total_vat || 0).toLocaleString()}원</td>
        <td class="py-2.5 px-2 border border-slate-700 text-center text-slate-400 font-sans">-</td>
      </tr>
    `;
    tfoot.innerHTML = tfHtml;
  }
}

// ── 6. 부가가치세 CSV 내보내기 ──
function exportVatCSV() {
  if (!currentVatData || !currentVatData.rows || currentVatData.rows.length === 0) {
    alert("내보낼 수납 집계 데이터가 없습니다.");
    return;
  }

  const d = currentVatData;
  let csv = "\uFEFF"; // UTF-8 BOM (Excel 한글 깨짐 방지)

  // 상단 헤더 정보
  csv += `부동산 임차관리 - 부가가치세 및 호실별 수납현황\n`;
  csv += `조회기간,${d.year}년 ${d.start_month}월 ~ ${d.end_month}월 (${d.rows.length}개실)\n`;
  csv += `총 수납액,${d.total_collected}원\n`;
  csv += `공급가액,${d.total_supply}원\n`;
  csv += `부가가치세(10%),${d.total_vat}원\n`;
  csv += `출력일시,${formattedToday}\n\n`;

  // 컬럼 헤더
  let headerRow = ["호실", "임차인", "임대유형", "보증금"];
  d.months.forEach(m => {
    headerRow.push(`${m}월 수납액`);
  });
  headerRow.push("기간총합계(VAT포함)", "공급가액", "부가가치세", "수납상태");
  csv += headerRow.join(",") + "\n";

  // 데이터 행
  const monthSums = {};
  d.months.forEach(m => { monthSums[m] = 0; });
  let totalDeposit = 0;

  d.rows.forEach(r => {
    totalDeposit += Number(r.deposit || 0);
    const row = [
      `"${r.room_number}호"`,
      `"${r.tenant_name}"`,
      `"${r.lease_type}"`,
      r.deposit || 0
    ];

    d.months.forEach(m => {
      const amt = (r.monthly_amounts && r.monthly_amounts[m]) || 0;
      monthSums[m] += amt;
      row.push(amt);
    });

    row.push(r.period_total, r.supply_value, r.vat_value, `"${r.status}"`);
    csv += row.join(",") + "\n";
  });

  // 합계 행
  const summaryRow = ["합계", `"${d.rows.length}개실"`, '""', totalDeposit];
  d.months.forEach(m => {
    summaryRow.push(monthSums[m]);
  });
  summaryRow.push(d.total_collected, d.total_supply, d.total_vat, '""');
  csv += summaryRow.join(",") + "\n";

  // CSV 파일 다운로드 생성
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `부동산_부가가치세_수납현황_${d.year}년_${d.start_month}월~${d.end_month}월_${formattedToday}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}



/**
 * apps/rent/frontend/app.js
 * MQnet Canonical SaaS 번들리스 프론트엔드 메인 진입점.
 */





// ── 전역 윈도우 핸들러 바인딩 (인라인 HTML 호출 호환) ──
window.openVatModal = openVatModal;
window.setVatPeriod = setVatPeriod;
window.handleVatCustomQuery = handleVatCustomQuery;
window.exportVatCSV = exportVatCSV;
window.selectRoom = selectRoom;

window.handleRoomChange = function() {
  const sel = document.getElementById('roomSelect');
  if (sel) selectRoom(sel.value);
};

window.handleBranchChange = function() {
  const sel = document.getElementById('branchSelector');
  if (sel) {
    window.location.href = `./?branch=${encodeURIComponent(sel.value)}`;
  }
};

window.openContractEditModal = openContractEditModal;
window.handleContractFormSubmit = handleContractFormSubmit;
window.handleLeaseTypeChangeInForm = handleLeaseTypeChangeInForm;

window.openExpenseModal = openExpenseModal;
window.handleExpenseFormSubmit = handleExpenseFormSubmit;
window.openLedgerModal = openLedgerModal;
window.exportCurrentRoomCSV = exportCurrentRoomCSV;

window.openUpgradeModal = openUpgradeModal;
window.handleUpgradeSubmit = handleUpgradeSubmit;

window.openModal = openModal;
window.closeModal = closeModal;

// 아코디언 토글
window.toggleContractAccordion = function() {
  state.isContractOpen = !state.isContractOpen;
  const body = document.getElementById('contractAccordionBody');
  const text = document.getElementById('contractToggleText');
  const arrow = document.getElementById('contractToggleArrow');

  if (state.isContractOpen) {
    body.classList.remove('collapse-hidden');
    body.classList.add('collapse-open');
    text.textContent = '계약내용 접기';
    arrow.classList.add('rotate-180');
  } else {
    body.classList.remove('collapse-open');
    body.classList.add('collapse-hidden');
    text.textContent = '계약내용 펼치기';
    arrow.classList.remove('rotate-180');
  }
};

window.togglePastAccordion = function() {
  state.isPastOpen = !state.isPastOpen;
  const body = document.getElementById('pastAccordionBody');
  const text = document.getElementById('pastToggleText');
  const arrow = document.getElementById('pastToggleArrow');

  if (state.isPastOpen) {
    body.classList.remove('collapse-hidden');
    body.classList.add('collapse-open');
    text.textContent = '과거 내역 접기';
    arrow.classList.add('rotate-180');
  } else {
    body.classList.remove('collapse-open');
    body.classList.add('collapse-hidden');
    text.textContent = '과거 내역 펼치기';
    arrow.classList.remove('rotate-180');
  }
};

// ── 앱 부트스트랩 ──
window.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 MQnet Rent SaaS v2.0 초기화 중...");
  await loadInitialData();

  // Populate 29 Rooms dropdown
  const select = document.getElementById('roomSelect');
  if (select) {
    select.innerHTML = '';
    const roomKeys = Object.keys(state.rooms).map(Number).sort((a, b) => a - b);
    roomKeys.forEach(room => {
      const opt = document.createElement('option');
      opt.value = room;
      opt.textContent = `${room}호`;
      select.appendChild(opt);
    });
  }

  renderAll();
});


})();
