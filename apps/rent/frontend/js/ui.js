/**
 * apps/rent/frontend/js/ui.js
 * 원룸 임차료 관리 시스템 모바일 최적화 DOM 렌더링 및 UI 슬라이드 드로어 제어.
 */

import { state, FLOOR_STRUCTURE, ROOM_NUMBERS, currentMonth, currentYear, formattedToday, saveLocalFallback, loadInitialData, fillTenantPaymentsState, evaluatePaymentRule, parseDateComponents, STORAGE_KEY } from './state.js?v=2.0';
import { apiProcessPayment, apiCancelPayment, apiFillTenantPayments, apiGetRooms, apiDeleteBranch, apiUpdateBranch } from './api.js?v=2.0';
import { switchRoomSlideView, toggleRoomSlideView, initRoomSwipe } from './slider.js?v=2.0';

export function selectRoom(roomNum) {
  state.selectedRoom = parseInt(roomNum, 10);
  saveLocalFallback();
  closeRoomDrawer();
  if (typeof switchRoomSlideView === 'function') {
    switchRoomSlideView('main', false);
  }
  renderAll();
}

export function navigatePrevRoom() {
  const roomKeys = Object.keys(state.rooms || {});
  const roomList = roomKeys.length > 0 ? roomKeys.map(Number).sort((a,b)=>a-b) : ROOM_NUMBERS;
  if (!roomList.length) return;
  const curIdx = roomList.indexOf(Number(state.selectedRoom));
  const newIdx = (curIdx <= 0) ? (roomList.length - 1) : (curIdx - 1);
  selectRoom(roomList[newIdx]);
}

export function navigateNextRoom() {
  const roomKeys = Object.keys(state.rooms || {});
  const roomList = roomKeys.length > 0 ? roomKeys.map(Number).sort((a,b)=>a-b) : ROOM_NUMBERS;
  if (!roomList.length) return;
  const curIdx = roomList.indexOf(Number(state.selectedRoom));
  const newIdx = (curIdx < 0 || curIdx >= roomList.length - 1) ? 0 : (curIdx + 1);
  selectRoom(roomList[newIdx]);
}

export async function switchBranch(branchId) {
  const user = state.currentUser;
  if (user && user.role === 'branch_admin' && user.branch_id) {
    if (!isSameBranchId(branchId, user.branch_id)) {
      alert(`🔒 접근 제한: 점주(${user.name || user.username})는 배정된 담당 건물만 관제할 수 있습니다.`);
      return;
    }
  }
  if (state.currentBranch === branchId) return;
  state.currentBranch = branchId;
  saveLocalFallback();
  closeMenuDrawer();

  // URL 업데이트 (히스토리 지원)
  const url = new URL(window.location.href);
  url.searchParams.set('branch', branchId);
  window.history.pushState({}, '', url.toString());

  await loadInitialData();
  renderAll();
}

// ── 슬라이드 드로어 제어 ──
export function openMenuDrawer() {
  const drawer = document.getElementById('leftMenuDrawer');
  const backdrop = document.getElementById('menuDrawerBackdrop');
  if (drawer && backdrop) {
    backdrop.classList.remove('hidden');
    requestAnimationFrame(() => {
      drawer.classList.remove('-translate-x-full');
      drawer.classList.add('translate-x-0');
      backdrop.classList.remove('opacity-0');
      backdrop.classList.add('opacity-100');
    });
  }
}

export function closeMenuDrawer() {
  const drawer = document.getElementById('leftMenuDrawer');
  const backdrop = document.getElementById('menuDrawerBackdrop');
  if (drawer && backdrop) {
    drawer.classList.remove('translate-x-0');
    drawer.classList.add('-translate-x-full');
    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
    setTimeout(() => {
      backdrop.classList.add('hidden');
    }, 200);
  }
}

export function toggleMenuDrawer() {
  const drawer = document.getElementById('leftMenuDrawer');
  if (drawer && drawer.classList.contains('-translate-x-full')) {
    openMenuDrawer();
  } else {
    closeMenuDrawer();
  }
}

export function openRoomDrawer() {
  const drawer = document.getElementById('rightRoomDrawer');
  const backdrop = document.getElementById('roomDrawerBackdrop');
  if (drawer && backdrop) {
    if (typeof renderRightRoomDrawer === 'function') {
      renderRightRoomDrawer();
    }
    backdrop.classList.remove('hidden');
    requestAnimationFrame(() => {
      drawer.classList.remove('translate-x-full');
      drawer.classList.add('translate-x-0');
      backdrop.classList.remove('opacity-0');
      backdrop.classList.add('opacity-100');
    });
  }
}

export function closeRoomDrawer() {
  const drawer = document.getElementById('rightRoomDrawer');
  const backdrop = document.getElementById('roomDrawerBackdrop');
  if (drawer && backdrop) {
    drawer.classList.remove('translate-x-0');
    drawer.classList.add('translate-x-full');
    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
    setTimeout(() => {
      backdrop.classList.add('hidden');
    }, 200);
  }
}

export function toggleRoomDrawer() {
  const drawer = document.getElementById('rightRoomDrawer');
  if (drawer && drawer.classList.contains('translate-x-full')) {
    openRoomDrawer();
  } else {
    closeRoomDrawer();
  }
}

export function togglePastAccordion(event) {
  if (event && event.stopPropagation) {
    event.stopPropagation();
  }
  toggleRoomSlideView();
}

// slider.js 모듈 함수 re-export
export { switchRoomSlideView, toggleRoomSlideView, initRoomSwipe };

// ── 종합 렌더링 ──
export function renderAll() {
  const roomNum = state.selectedRoom;
  let room = state.rooms[roomNum];
  if (!room) {
    // 선택 호실이 없으면 해당 건물의 첫 호실로 대체
    const keys = Object.keys(state.rooms || {}).map(Number).sort((a, b) => a - b);
    if (keys.length > 0) {
      state.selectedRoom = keys[0];
      room = state.rooms[keys[0]];
    }
  }

  if (!room) {
    // 호실이 아직 없는 신규 건물: 이전 건물 화면을 지우고 안내 + 건물 전환 드로어는 항상 렌더링
    renderEmptyBranch();
    renderLeftMenuDrawer();
    return;
  }

  const emptyBanner = document.getElementById('emptyBranchBanner');
  if (emptyBanner) {
    const hidden = emptyBanner.nextElementSibling;
    if (hidden) hidden.style.display = '';
    emptyBanner.remove();
  }

  renderHeaderSummary(room);
  renderBuildingSummary();
  renderMainRoomCard(room);
  renderCurrentMonthSection(room);
  renderPastHistorySection(room);
  renderExpenseLedgerSection();
  renderRightRoomDrawer();
  renderLeftMenuDrawer();
}

function renderEmptyBranch() {
  const curBranchObj = (state.branches || []).find(b => b.branch_id === state.currentBranch);
  const branchName = curBranchObj ? curBranchObj.name : state.currentBranch;

  const branchTitleEl = document.getElementById('headerBranchName');
  if (branchTitleEl) branchTitleEl.textContent = branchName;
  const bNameEl = document.getElementById('sumBuildingName');
  if (bNameEl) bNameEl.textContent = `${branchName} 호실 0실`;

  const card = document.getElementById('cardRoomNumber');
  const anchor = card ? (card.closest('section, article, div.rounded-2xl, div') || card.parentElement) : null;
  if (anchor && anchor.parentElement) {
    let banner = document.getElementById('emptyBranchBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'emptyBranchBanner';
      anchor.parentElement.insertBefore(banner, anchor);
    }
    banner.className = 'w-full p-4 mb-3 rounded-xl bg-amber-950/60 border border-amber-500/60 text-amber-200 text-xs font-bold';
    banner.innerHTML = `⚠️ <b>${branchName}</b>에는 아직 등록된 호실이 없습니다.<br><span class="font-normal text-amber-300/90">좌측 메뉴(☰) → 호실/임차 정보 신규등록(캡처·사진·텍스트·CSV)으로 입력하세요. 다른 건물은 좌측 메뉴에서 선택할 수 있습니다.</span>`;
    anchor.style.display = 'none';
  }
}

export function renderBuildingSummary() {
  const rooms = state.rooms || {};
  const roomKeys = Object.keys(rooms);
  const totalRooms = roomKeys.length || 29;

  let totalDeposit = 0;
  let vacantCount = 0;
  let monthlyGoal = 0;
  let monthlyPaid = 0;

  roomKeys.forEach(rNum => {
    const r = rooms[rNum];
    if (!r) return;

    totalDeposit += Number(r.deposit || 0);

    const isVacant = !r.name || !!r.move_out;
    if (isVacant) {
      vacantCount++;
    }

    const leaseType = r.lease_type || '월세';
    const p = (r.payments && r.payments[currentMonth]) || {};
    const rent = p.rent_amount !== undefined ? p.rent_amount : (leaseType === '전세' ? 0 : Number(r.rent || 0));
    const maint = p.maintenance_amount !== undefined ? p.maintenance_amount : Number(r.maintenance || 0);
    const charge = (leaseType === '전세' ? 0 : rent) + maint;

    monthlyGoal += charge;
    if (p.paid) {
      monthlyPaid += charge;
    }
  });

  const payRate = monthlyGoal > 0 ? (monthlyPaid / monthlyGoal * 100) : 0;
  const payRateFormatted = payRate.toFixed(1);

  const curBranchObj = state.branches.find(b => b.branch_id === state.currentBranch);
  const branchName = (state.currentBranch === 'main') ? '시크빌' : (curBranchObj ? curBranchObj.name : '시크빌');

  const bNameEl = document.getElementById('sumBuildingName');
  if (bNameEl) bNameEl.textContent = `${branchName} 공실 ${vacantCount}/${totalRooms}실`;

  const totRoomsEl = document.getElementById('sumTotalRooms');
  if (totRoomsEl) totRoomsEl.textContent = `${totalRooms}실`;

  const vacRoomsEl = document.getElementById('sumVacantRooms');
  if (vacRoomsEl) vacRoomsEl.textContent = `${vacantCount}실`;

  const totDepEl = document.getElementById('sumTotalDeposit');
  if (totDepEl) totDepEl.textContent = `${totalDeposit.toLocaleString()}원`;

  const mProgEl = document.getElementById('sumMonthlyProgressText');
  if (mProgEl) {
    mProgEl.innerHTML = `
      <div class="w-full flex items-center justify-between flex-wrap gap-x-2 gap-y-0.5 text-[10px] sm:text-[11px] font-mono font-bold leading-tight">
        <span class="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
          <span class="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[9px] sm:text-[10px]">[보증금 누계]</span>
          <span class="text-amber-300">${totalDeposit.toLocaleString()}원</span>
        </span>
        <span class="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
          <span class="px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold text-[9px] sm:text-[10px]">[${currentYear}.${String(currentMonth).padStart(2, '0')} 누계]</span>
          <span class="text-cyan-200">${monthlyPaid.toLocaleString()}/${monthlyGoal.toLocaleString()}원(${payRateFormatted}%)</span>
        </span>
      </div>
    `;
  }

  const roomDrawerTitle = document.getElementById('roomDrawerTitle');
  if (roomDrawerTitle) {
    roomDrawerTitle.textContent = `${branchName}(${totalRooms}개실)`;
  }

  const mGoalEl = document.getElementById('sumMonthlyGoal');
  if (mGoalEl) mGoalEl.textContent = `${monthlyGoal.toLocaleString()}원`;

  const mPaidEl = document.getElementById('sumMonthlyPaid');
  if (mPaidEl) mPaidEl.textContent = `${monthlyPaid.toLocaleString()}원`;

  const rateBadgeEl = document.getElementById('sumPaymentRateBadge');
  if (rateBadgeEl) {
    rateBadgeEl.textContent = `${payRateFormatted}%`;
    if (payRate >= 100) {
      rateBadgeEl.className = 'text-[11px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 font-mono';
    } else if (payRate >= 50) {
      rateBadgeEl.className = 'text-[11px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono';
    } else {
      rateBadgeEl.className = 'text-[11px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono';
    }
  }

  const pBarEl = document.getElementById('sumProgressBar');
  if (pBarEl) {
    pBarEl.style.width = `${Math.min(100, Math.max(0, payRate))}%`;
  }
}

export function renderHeaderSummary(room) {
  // 현재 활성 건물 이름 표시
  const curBranchObj = state.branches.find(b => b.branch_id === state.currentBranch);
  const branchName = curBranchObj ? curBranchObj.name : '시크빌';

  const branchTitleEl = document.getElementById('headerBranchName');
  if (branchTitleEl) {
    branchTitleEl.textContent = (state.currentBranch === 'main' ? '시크빌' : branchName);
  }

  const headerRoomBadge = document.getElementById('headerRoomBadge');
  if (headerRoomBadge) headerRoomBadge.textContent = `${room.room_number}호 ▾`;

  const midRoomBadge = document.getElementById('midRoomBadge');
  if (midRoomBadge) midRoomBadge.textContent = `${room.room_number}호 ▾`;

  // 서버 온라인/오프라인 연결 상태 배너 표시 제어
  const statusBanner = document.getElementById('serverStatusBanner');
  if (statusBanner) {
    if (state.isOnline) {
      statusBanner.classList.add('hidden');
    } else {
      statusBanner.classList.remove('hidden');
    }
  }
}

export function renderMainRoomCard(room) {
  const rNum = room.room_number;
  const isVacant = !room.name || !!room.move_out;
  const leaseType = room.lease_type || '월세';
  const payTiming = room.pay_timing || '후불';

  // 1. 호실 및 세입자 정보
  const cardRoomNumber = document.getElementById('cardRoomNumber');
  if (cardRoomNumber) cardRoomNumber.textContent = `${rNum}호`;

  const cardTenantName = document.getElementById('cardTenantName');
  if (cardTenantName) cardTenantName.textContent = isVacant ? '공실 (미계약)' : `${room.name}님`;

  const cardIdNumber = document.getElementById('cardIdNumber');
  if (cardIdNumber) {
    if (isVacant) {
      cardIdNumber.innerHTML = `<span class="text-slate-500">-</span>`;
    } else if (!room.id_number) {
      cardIdNumber.innerHTML = `<span class="text-amber-400 font-normal">주민번호 미등록</span>`;
    } else {
      cardIdNumber.innerHTML = `<span class="text-cyan-300 font-mono font-medium">${room.id_number}</span>`;
    }
  }

  const cardPhone = document.getElementById('cardPhone');
  if (cardPhone) {
    if (isVacant || !room.phone) {
      cardPhone.innerHTML = `<span class="text-slate-500">연락처 없음</span>`;
    } else {
      cardPhone.innerHTML = `
        <span class="inline-flex items-center gap-1.5 bg-surface-850 px-1.5 py-0.5 rounded-lg border border-slate-700/80">
          <a href="javascript:void(0)" onclick="handlePhoneMessageClick('${room.phone}', '${room.name || ''}', ${room.room_number})" class="text-cyan-300 hover:text-cyan-200 underline font-mono flex items-center gap-1 font-semibold text-xs" title="문자 메시지 창 열기 (영수증 자동 복사)">
            <span>💬 ${room.phone}</span>
          </a>
          <a href="tel:${room.phone}" class="text-[10px] text-slate-400 hover:text-white px-1 py-0.5 rounded hover:bg-slate-700" title="전화 걸기">
            📞
          </a>
        </span>
      `;
    }
  }

  // 뱃지 상태
  const statusBadge = document.getElementById('cardStatusBadge');
  if (statusBadge) {
    if (isVacant) {
      statusBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-800 text-slate-400 border border-slate-700';
      statusBadge.textContent = '공실';
    } else {
      statusBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
      statusBadge.textContent = '입주중';
    }
  }

  const leaseBadge = document.getElementById('cardLeaseTypeBadge');
  if (leaseBadge) {
    leaseBadge.className = `text-xs px-2 py-0.5 rounded-md font-semibold ${leaseType === '전세' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`;
    leaseBadge.textContent = leaseType;
  }

  const payTimingBadge = document.getElementById('cardPayTimingBadge');
  if (payTimingBadge) {
    payTimingBadge.className = 'text-xs px-2 py-0.5 rounded-md font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30';
    payTimingBadge.textContent = payTiming;
  }

  // 보증금 / 월세 / 관리비 요약
  const cDeposit = document.getElementById('cDeposit');
  if (cDeposit) cDeposit.textContent = `${Number(room.deposit || 0).toLocaleString()}원`;

  const cRent = document.getElementById('cRent');
  if (cRent) cRent.textContent = leaseType === '전세' ? '0원' : `${Number(room.rent || 0).toLocaleString()}원`;

  const cMaintenance = document.getElementById('cMaintenance');
  if (cMaintenance) cMaintenance.textContent = `${Number(room.maintenance || 0).toLocaleString()}원`;

  // 전입일 / 만기일 요약
  const cPeriod = document.getElementById('cPeriod');
  const cPeriodSub = document.getElementById('cPeriodSub');
  let pText = (room.move_in && room.expiry) ? `${room.move_in} ~ ${room.expiry}` : '-';
  if (room.auto_renewed) {
    pText += ' (자동연장)';
  }
  if (cPeriod) cPeriod.textContent = pText;
  if (cPeriodSub) cPeriodSub.textContent = pText;

  const periodTypeTag = document.getElementById('cardPeriodTypeTag');
  if (periodTypeTag) {
    periodTypeTag.textContent = `${leaseType} · ${payTiming}`;
    periodTypeTag.className = `text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
      leaseType === '전세' 
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
        : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
    }`;
  }
}

export function renderCurrentMonthSection(room) {
  const rNum = room.room_number;
  const isVacant = !room.name || !!room.move_out;
  const leaseType = room.lease_type || '월세';
  const payTiming = room.pay_timing || '후불';

  if (!room.payments) room.payments = {};
  if (!room.payments[currentMonth]) {
    room.payments[currentMonth] = {
      month: currentMonth,
      year: currentYear,
      paid: false,
      paid_date: '',
      rent_amount: leaseType === '전세' ? 0 : room.rent,
      maintenance_amount: room.maintenance,
      note: '',
      tenant_name: room.name,
      is_previous_tenant: false
    };
  }

  const curPay = room.payments[currentMonth];
  const curRent = (leaseType === '전세') 
    ? 0 
    : (curPay.paid ? (curPay.rent_amount !== undefined ? curPay.rent_amount : room.rent) : (room.rent !== undefined ? room.rent : curPay.rent_amount));
  const curMaint = curPay.paid 
    ? (curPay.maintenance_amount !== undefined ? curPay.maintenance_amount : room.maintenance) 
    : (room.maintenance !== undefined ? room.maintenance : curPay.maintenance_amount);
  const curTotal = (Number(curRent) || 0) + (Number(curMaint) || 0);

  const curMonthTitle = document.getElementById('curMonthTitle');
  if (curMonthTitle) curMonthTitle.textContent = `${currentYear}.${String(currentMonth).padStart(2, '0')}월분`;

  const curTotalAmount = document.getElementById('curTotalAmount');
  if (curTotalAmount) curTotalAmount.textContent = `${Number(curTotal).toLocaleString()}원`;

  const curRentDetail = document.getElementById('curRentDetail');
  if (curRentDetail) curRentDetail.textContent = `(${Number(curRent).toLocaleString()} + ${Number(curMaint).toLocaleString()}원)`;

  const statusBadge = document.getElementById('curMonthStatusBadge');
  const actionArea = document.getElementById('curMonthActionArea');

  // 미납 개월 수 계산 (현재 세입자 기준 당해연도 1월부터 currentMonth까지)
  let unpaidMonthsCount = 0;
  if (!isVacant) {
    let inYear = currentYear;
    let inMonth = 1;
    if (room.move_in) {
      const dtComp = parseDateComponents(room.move_in);
      if (dtComp) {
        inYear = dtComp.year;
        inMonth = dtComp.month;
      }
    }

    for (let m = 1; m <= currentMonth; m++) {
      if (inYear > currentYear || (inYear === currentYear && m < inMonth)) {
        continue;
      }
      const pKey = `${currentYear}-${String(m).padStart(2, '0')}`;
      const p = (room.payments && (room.payments[pKey] || room.payments[m]));
      if (!p || !p.paid) {
        unpaidMonthsCount++;
      }
    }
  }

  if (isVacant) {
    if (statusBadge) {
      statusBadge.className = 'px-2 py-0.5 rounded-full font-bold text-xs bg-slate-800 text-slate-400 border border-slate-700 shrink-0';
      statusBadge.textContent = '공실 (미부과)';
    }
    if (actionArea) {
      actionArea.innerHTML = `
        <button type="button" onclick="openContractEditModal(${rNum})" class="w-full py-1 px-2.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-xs sm:text-sm flex items-center justify-between shadow-sm border border-emerald-400/40 transition cursor-pointer active:scale-[0.98]" title="공실 신규 입주 계약 등록">
          <span class="flex items-center gap-1.5 min-w-0">
            <span class="text-sm sm:text-base shrink-0">🚪</span>
            <span class="tracking-tight text-white font-black truncate">${rNum}호 신규 입주 계약 등록하기</span>
          </span>
          <span class="text-[10px] sm:text-[11px] text-emerald-200 flex items-center gap-1 font-semibold shrink-0">
            <span>입주 등록</span>
            <span class="text-xs font-bold">➔</span>
          </span>
        </button>
      `;
    }
  } else if (curPay.paid) {
    if (statusBadge) {
      statusBadge.className = 'px-2 py-0.5 rounded-full font-bold text-xs bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shrink-0';
      statusBadge.textContent = '완납';
    }
    if (actionArea) {
      actionArea.innerHTML = `
        <button type="button" onclick="handleSendSmsReceipt()" class="w-full py-1 px-2.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-between shadow-sm border border-cyan-400/40 transition cursor-pointer active:scale-[0.98]" title="클릭하여 영수증 문자 전송">
          <span class="flex items-center gap-1.5 min-w-0">
            <span class="text-sm sm:text-base text-emerald-300 font-black shrink-0">✓</span>
            <span class="tracking-tight text-white font-black truncate">${rNum}호 ${currentYear}.${String(currentMonth).padStart(2, '0')}월분 ${Number(curTotal).toLocaleString()}원</span>
          </span>
          <span class="text-[10px] sm:text-[11px] text-cyan-200 flex items-center gap-1 font-semibold shrink-0">
            <span>영수문자 전송</span>
            <span class="text-xs font-bold">➔</span>
          </span>
        </button>
      `;
    }
  } else {
    if (statusBadge) {
      statusBadge.className = 'px-2 py-0.5 rounded-full font-bold text-xs bg-rose-500/25 text-rose-300 border border-rose-500/50 shrink-0';
      statusBadge.textContent = unpaidMonthsCount > 1 ? `미납 ${unpaidMonthsCount}` : '미납';
    }
    if (actionArea) {
      actionArea.innerHTML = `
        <button type="button" id="btnProcessPay" class="w-full py-1 px-2.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-between shadow-sm border border-cyan-400/40 transition cursor-pointer active:scale-[0.98]">
          <span class="flex items-center gap-1.5 min-w-0">
            <span class="text-sm sm:text-base shrink-0">💳</span>
            <span class="tracking-tight text-white font-black truncate">${rNum}호 ${currentYear}.${String(currentMonth).padStart(2, '0')}월분</span>
            <span class="text-[9px] sm:text-[10px] font-bold text-cyan-100 bg-cyan-950/70 border border-cyan-400/40 px-1.5 py-0.1 rounded-full shrink-0">${Number(curTotal).toLocaleString()}원</span>
          </span>
          <span class="text-[10px] sm:text-[11px] text-cyan-200 flex items-center gap-1 font-semibold shrink-0">
            <span>수납 후 영수증</span>
            <span class="text-xs font-bold">➔</span>
          </span>
        </button>
      `;
      document.getElementById('btnProcessPay').onclick = () => handleProcessPayment(rNum, currentMonth);
    }
  }
}

export function renderPastHistorySection(room) {
  const rNum = room.room_number;
  const tbody = document.getElementById('pastPaymentTableBody');
  const pastRoomTitleBadge = document.getElementById('pastRoomTitleBadge');
  if (pastRoomTitleBadge) {
    pastRoomTitleBadge.textContent = `${rNum}호`;
  }
  if (!tbody) return;

  const accordionBody = document.getElementById('pastAccordionBody');
  if (accordionBody) {
    accordionBody.classList.remove('hidden');
  }

  tbody.innerHTML = '';
  const isJeonse = (room.lease_type === '전세');

  const lastYear = currentYear - 1;

  // ── 해당 건물 또는 호실에 작년도(lastYear 이하) 결제/수납 데이터가 존재하는지 확인 ──
  let hasLastYearData = false;
  if (room && room.payments) {
    hasLastYearData = Object.keys(room.payments).some(k => {
      const p = room.payments[k];
      const y = (p && p.year) ? p.year : (k.includes('-') ? parseInt(k.split('-')[0], 10) : null);
      return y !== null && y <= lastYear && (p.paid || (p.rent_amount && p.rent_amount > 0) || p.tenant_name || p.note);
    });
  }
  if (!hasLastYearData && state.rooms) {
    hasLastYearData = Object.values(state.rooms).some(r => {
      return r && r.payments && Object.keys(r.payments).some(k => {
        const p = r.payments[k];
        const y = (p && p.year) ? p.year : (k.includes('-') ? parseInt(k.split('-')[0], 10) : null);
        return y !== null && y <= lastYear && (p.paid || (p.rent_amount && p.rent_amount > 0) || p.tenant_name || p.note);
      });
    });
  }

  // ── 상단 헤더 기간 배지 업데이트 (2025.01 ~ 현재 vs 2026.01 ~ 현재) ──
  const periodBadge = document.getElementById('pastRoomPeriodBadge');
  if (periodBadge) {
    periodBadge.textContent = hasLastYearData ? `(${lastYear}.01 ~ 현재)` : `(${currentYear}.01 ~ 현재)`;
  }

  // ── 표시 월 목록 구성 ──
  // 작년도 데이터가 있는 건물(시크빌 등): 작년 1월부터 당해연도 당월까지 (2025.01 ~ 2026.10 내림차순)
  // 작년도 데이터가 없는 다른 건물: 작년 데이터가 없으므로 당해연도(2026.01 ~ 2026.10) 있는 데이터만 표시
  const startYear = hasLastYearData ? lastYear : currentYear;
  const targetMonths = [];

  for (let y = currentYear; y >= startYear; y--) {
    const maxM = (y === currentYear) ? currentMonth : 12;
    const minM = 1;
    for (let m = maxM; m >= minM; m--) {
      targetMonths.push({ year: y, month: m });
    }
  }

  targetMonths.forEach(item => {
    const y = item.year;
    const m = item.month;
    const pKey = `${y}-${m}`;
    const pKeyPad = `${y}-${String(m).padStart(2, '0')}`;

    // 결제 데이터 조회 (연도-월 키 우선, 2자리 패딩 키, 당해연도 월 키)
    const existingP = (room.payments && (room.payments[pKey] || room.payments[pKeyPad] || (y === currentYear ? room.payments[m] : null)));

    // 1. 현재 세입자 전입일 기준 거주 기간 판별
    let inYear = currentYear;
    let inMonth = 1;
    let hasMoveIn = false;
    if (room.name && room.move_in) {
      const dtComp = parseDateComponents(room.move_in);
      if (dtComp) {
        inYear = dtComp.year;
        inMonth = dtComp.month;
        hasMoveIn = true;
      }
    }

    // 기존 결제 기록이 있고 세입자명이 현재 세입자와 일치하며 '완납'인 경우(이전 계약 연속 완납)에만 현재 세입자로 인정
    const isDuringContract = Boolean(room.name && hasMoveIn && (y > inYear || (y === inYear && m >= inMonth)));
    const isPriorPaidByCurrent = Boolean(room.name && existingP && existingP.paid && existingP.tenant_name === room.name);
    const isCurrentTenant = isDuringContract || isPriorPaidByCurrent;

    // 2. 전출자 이력 매칭
    const histories = room.tenant_histories || [];
    let matchedHist = null;
    if (!isCurrentTenant) {
      for (const h of histories) {
        let outY = 0, outM = 0;
        if (h.move_out) {
          const outComp = parseDateComponents(h.move_out);
          if (outComp) {
            outY = outComp.year;
            outM = outComp.month;
          }
        }
        let hInY = 0, hInM = 0;
        if (h.move_in) {
          const inComp = parseDateComponents(h.move_in);
          if (inComp) {
            hInY = inComp.year;
            hInM = inComp.month;
          }
        }
        if (outY && outM) {
          let inPeriod = (y < outY || (y === outY && m <= outM));
          if (hInY && hInM) {
            inPeriod = inPeriod && (y > hInY || (y === hInY && m >= hInM));
          }
          if (inPeriod) {
            matchedHist = h;
            break;
          }
        }
      }
      if (!matchedHist && existingP && existingP.tenant_name && existingP.tenant_name !== '공실' && existingP.tenant_name !== room.name && existingP.paid) {
        matchedHist = {
          name: existingP.tenant_name,
          rent: existingP.rent_amount !== undefined ? existingP.rent_amount : (room.rent || 0),
          maintenance: existingP.maintenance_amount !== undefined ? existingP.maintenance_amount : (room.maintenance || 0),
          lease_type: existingP.lease_type || '월세'
        };
      }
    }

    // 3. 공실 여부 판정:
    // - 명시적 공실: note 또는 tenant_name에 '공실'이 지정된 경우
    // - 전입월 이전 미납: 현재 세입자 전입일 이전(y < inYear || (y === inYear && m < inMonth))이면서 완납이 아니고 전출자 거주 기간도 아니면 100% 공실!
    //   (이전 임차인 퇴실 후 공실 발생 시 다음 입주월 사이는 모두 공실 원칙)
    // - 현재 세입자도 아니고 전출자도 아니며 실입금 완납 기록도 없는 경우: 공실!
    const isExplicitVacancy = Boolean(existingP && (existingP.note === '공실' || existingP.tenant_name === '공실' || (typeof existingP.note === 'string' && existingP.note.includes('공실'))));
    const isBeforeMoveInUnpaid = Boolean(hasMoveIn && (y < inYear || (y === inYear && m < inMonth)) && (!existingP || !existingP.paid) && !matchedHist);
    const hasRecordedPaid = Boolean(existingP && existingP.paid);

    const isVacancy = isExplicitVacancy || isBeforeMoveInUnpaid || (!isCurrentTenant && !matchedHist && !hasRecordedPaid);

    // 납부 객체 p 준비
    let p = existingP ? { ...existingP } : {
      month: m,
      year: y,
      paid: false,
      paid_date: '',
      rent_amount: isJeonse ? 0 : room.rent,
      maintenance_amount: room.maintenance,
      note: isVacancy ? '공실' : '',
      tenant_name: isCurrentTenant ? room.name : (matchedHist ? matchedHist.name : ''),
      is_previous_tenant: Boolean(matchedHist)
    };

    if (isVacancy) {
      p.paid = false;
      p.paid_date = '';
      p.note = '공실';
    }

    // 세입자 표시 정보 및 청구 금액 산정
    let displayName = '';
    let isPrev = false;
    let rAmt = 0;
    let mAmt = 0;

    if (isVacancy) {
      displayName = '공실';
      rAmt = 0;
      mAmt = 0;
    } else if (isCurrentTenant) {
      displayName = (existingP && existingP.tenant_name) ? existingP.tenant_name : room.name;
      isPrev = false;
      rAmt = isJeonse ? 0 : (p.rent_amount !== undefined ? p.rent_amount : room.rent);
      mAmt = p.maintenance_amount !== undefined ? p.maintenance_amount : (room.maintenance || 0);
    } else if (matchedHist) {
      displayName = matchedHist.name;
      isPrev = true;
      const histJeonse = (matchedHist.lease_type === '전세');
      rAmt = histJeonse ? 0 : (p.rent_amount !== undefined ? p.rent_amount : (matchedHist.rent || 0));
      mAmt = p.maintenance_amount !== undefined ? p.maintenance_amount : (matchedHist.maintenance || 0);
    } else if (existingP && existingP.tenant_name && existingP.paid) {
      displayName = existingP.tenant_name;
      isPrev = (existingP.tenant_name !== room.name);
      rAmt = p.rent_amount !== undefined ? p.rent_amount : (room.rent || 0);
      mAmt = p.maintenance_amount !== undefined ? p.maintenance_amount : (room.maintenance || 0);
    }

    const tot = rAmt + mAmt;

    const tr = document.createElement('tr');
    tr.className = `hover:bg-surface-850/60 transition ${isPrev ? 'bg-amber-950/25' : (isVacancy ? 'opacity-85' : '')}`;

    // 세입자 라벨 생성
    let tenantLabel = '';
    if (isVacancy) {
      tenantLabel = `<span class="text-slate-500 font-normal whitespace-nowrap">공실</span>`;
    } else if (isPrev) {
      tenantLabel = `
        <div class="font-bold text-amber-300 flex items-center gap-1 whitespace-nowrap">
          <span>${displayName || '전출 세입자'}</span>
          <span class="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-normal whitespace-nowrap">전출</span>
        </div>
      `;
    } else {
      tenantLabel = `
        <div class="font-medium text-slate-200 whitespace-nowrap">
          ${displayName || room.name}
        </div>
      `;
    }

    // 금액란 생성 (공실은 빈칸 '-', 미납/완납은 해당 시점 계약 금액 표시 및 수정 지원)
    let amountHtml = '';
    if (isVacancy) {
      amountHtml = `<span class="text-slate-600 font-mono text-[11px]">-</span>`;
    } else {
      const isPaid = Boolean(p.paid && p.paid_date);
      const btnStyle = isPaid
        ? 'hover:bg-emerald-950/80 text-emerald-400 hover:text-emerald-300 border-slate-700/80 hover:border-emerald-500/60'
        : 'hover:bg-rose-950/50 text-rose-300 hover:text-rose-200 border-rose-900/60 hover:border-rose-500/50';
      amountHtml = `
        <button type="button" class="btn-change-payamount inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-900/90 ${btnStyle} border font-mono text-[11px] font-bold transition cursor-pointer shadow-xs whitespace-nowrap" title="클릭하여 납부/청구 금액 수정" data-year="${y}" data-month="${m}" data-rent="${rAmt}" data-maint="${mAmt}" data-tot="${tot}">
          <span>✏️</span><span>${Number(tot).toLocaleString()}원</span>
        </button>
      `;
    }

    // 납부일자 생성
    let payDateHtml = '';
    if (!isVacancy && p.paid && p.paid_date) {
      const displayDate = p.paid_date;
      payDateHtml = `
        <button type="button" class="btn-change-paydate inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-900/90 hover:bg-cyan-950/80 text-cyan-300 hover:text-cyan-200 border border-slate-700/80 hover:border-cyan-500/60 font-mono text-[11px] font-semibold transition cursor-pointer shadow-xs whitespace-nowrap" title="클릭하여 은행 실입금일자로 수정" data-year="${y}" data-month="${m}" data-date="${displayDate}">
          <span class="text-[10px] opacity-70">📅</span><span>${displayDate}</span>
        </button>
      `;
    } else {
      payDateHtml = `<span class="text-slate-600 font-mono text-[11px]">-</span>`;
    }

    const isMoveInPostpaid = Boolean(isCurrentTenant && (y === inYear && m === inMonth && (room.pay_timing === '후불' || !room.pay_timing)));

    // 상태 배지 생성 (공실/미납/입주월은 클릭 시 즉시 공실↔미납 전환 지원)
    let statusHtml = '';
    if (isVacancy) {
      statusHtml = `<button type="button" class="btn-toggle-status-past inline-block px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500 transition cursor-pointer shadow-xs" title="클릭하여 미납으로 전환" data-year="${y}" data-month="${m}" data-status="공실">공실</button>`;
    } else if (p.paid) {
      statusHtml = `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">완납</span>`;
    } else if (isMoveInPostpaid) {
      statusHtml = `<button type="button" class="btn-toggle-status-past inline-block px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap bg-amber-500/25 text-amber-300 border border-amber-500/40 hover:border-amber-400 transition cursor-pointer shadow-xs" title="후불 입주월 (클릭하여 공실로 전환)" data-year="${y}" data-month="${m}" data-status="입주월">입주월</button>`;
    } else {
      statusHtml = `<button type="button" class="btn-toggle-status-past inline-block px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:border-rose-400 transition cursor-pointer shadow-xs" title="클릭하여 공실로 전환" data-year="${y}" data-month="${m}" data-status="미납">미납</button>`;
    }

    // 조작 버튼 생성:
    // - 공실: [미납] 청구 복원 및 [수납] 처리 지원
    // - 완납: [취소] 버튼
    // - 미납/입주월: [수납] 처리 및 [공실] 즉시 전환 지원
    let actionHtml = '';
    if (isVacancy) {
      actionHtml = `
        <div class="inline-flex items-center justify-center gap-1">
          <button type="button" class="btn-set-unpay-past inline-block px-1.5 py-0.5 rounded text-[10px] font-normal bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition cursor-pointer shadow-xs whitespace-nowrap" title="공실 해제 및 미납으로 전환" data-year="${y}" data-month="${m}">
            미납
          </button>
          <button type="button" class="btn-pay-past inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-900/60 hover:bg-cyan-800 text-cyan-300 border border-cyan-700/60 transition cursor-pointer shadow-xs whitespace-nowrap" title="해당 월 수납 처리" data-year="${y}" data-month="${m}">
            수납
          </button>
        </div>
      `;
    } else if (p.paid) {
      actionHtml = `
        <button type="button" class="btn-cancel-past inline-block px-2 py-0.5 rounded text-[10px] font-normal bg-slate-800/80 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-slate-700/60 hover:border-rose-500/40 transition whitespace-nowrap cursor-pointer shadow-xs" data-year="${y}" data-month="${m}">
          취소
        </button>
      `;
    } else {
      actionHtml = `
        <div class="inline-flex items-center justify-center gap-1">
          <button type="button" class="btn-pay-past inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-xs whitespace-nowrap cursor-pointer" title="수납 처리" data-year="${y}" data-month="${m}">
            수납
          </button>
          <button type="button" class="btn-set-vacancy-past inline-block px-1.5 py-0.5 rounded text-[10px] font-normal bg-slate-800/90 hover:bg-amber-950/60 text-slate-400 hover:text-amber-300 border border-slate-700/70 hover:border-amber-500/50 transition cursor-pointer shadow-xs whitespace-nowrap" title="공실로 전환" data-year="${y}" data-month="${m}">
            공실
          </button>
        </div>
      `;
    }

    tr.innerHTML = `
      <td class="py-2 px-2 text-center border-r border-slate-800 font-bold font-mono text-xs whitespace-nowrap">
        <span class="text-[10px] text-slate-400">${y}.</span><span class="text-xs text-white">${String(m).padStart(2, '0')}월</span>
      </td>
      <td class="py-2 px-2.5 border-r border-slate-800 text-xs whitespace-nowrap">
        ${tenantLabel}
      </td>
      <td class="py-2 px-2 border-r border-slate-800 text-right font-mono text-xs whitespace-nowrap">
        ${amountHtml}
      </td>
      <td class="py-2 px-2 border-r border-slate-800 text-center whitespace-nowrap">
        ${payDateHtml}
      </td>
      <td class="py-2 px-1.5 border-r border-slate-800 text-center whitespace-nowrap">
        ${statusHtml}
      </td>
      <td class="py-2 px-2 text-center whitespace-nowrap">
        ${actionHtml}
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-change-payamount').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const yr = parseInt(btn.dataset.year, 10);
      const mo = parseInt(btn.dataset.month, 10);
      const curTot = parseInt(btn.dataset.tot, 10) || 0;
      const curRent = parseInt(btn.dataset.rent, 10) || 0;
      const curMaint = parseInt(btn.dataset.maint, 10) || 0;

      const newTotStr = window.prompt(`[${rNum}호 ${yr}년 ${mo}월분]\n수정할 납부/청구 금액(원)을 입력하세요:\n(현재: ${curTot.toLocaleString()}원)`, String(curTot));
      if (newTotStr !== null && newTotStr.trim() !== '') {
        const newTot = parseInt(newTotStr.replace(/[^\d]/g, ''), 10);
        if (!isNaN(newTot) && newTot >= 0 && newTot !== curTot) {
          await handleChangePaymentAmount(rNum, mo, yr, newTot, curRent, curMaint);
        }
      }
    };
  });

  tbody.querySelectorAll('.btn-change-paydate').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const yr = parseInt(btn.dataset.year, 10);
      const mo = parseInt(btn.dataset.month, 10);
      const curDate = btn.dataset.date || `${yr}-${String(mo).padStart(2, '0')}-10`;
      const newDate = window.prompt(`[${rNum}호 ${yr}년 ${mo}월분]\n은행 거래내역상 실제 입금일자를 입력하세요 (YYYY-MM-DD):`, curDate);
      if (newDate && newDate.trim() && newDate.trim() !== curDate) {
        await handleChangePaymentDate(rNum, mo, yr, newDate.trim());
      }
    };
  });

  tbody.querySelectorAll('.btn-cancel-past').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      handleCancelPayment(rNum, parseInt(btn.dataset.month, 10), parseInt(btn.dataset.year || currentYear, 10));
    };
  });
  tbody.querySelectorAll('.btn-pay-past').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      handleProcessPayment(rNum, parseInt(btn.dataset.month, 10), parseInt(btn.dataset.year || currentYear, 10));
    };
  });
  tbody.querySelectorAll('.btn-set-vacancy-past').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      handleSetPastVacancy(rNum, parseInt(btn.dataset.month, 10), parseInt(btn.dataset.year || currentYear, 10));
    };
  });
  tbody.querySelectorAll('.btn-set-unpay-past').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      handleSetPastUnpaid(rNum, parseInt(btn.dataset.month, 10), parseInt(btn.dataset.year || currentYear, 10));
    };
  });
  tbody.querySelectorAll('.btn-toggle-status-past').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const status = btn.dataset.status;
      const yr = parseInt(btn.dataset.year, 10);
      const mo = parseInt(btn.dataset.month, 10);
      if (status === '공실') {
        handleSetPastUnpaid(rNum, mo, yr);
      } else {
        handleSetPastVacancy(rNum, mo, yr);
      }
    };
  });
}

// ── 지출 장부 내역 표 렌더링 (엑셀 규격: 일자 | 적요 | 금액 | 합계) ──
export function renderExpenseLedgerSection() {
  const tbody = document.getElementById('expenseLedgerTableBody');
  const tfoot = document.getElementById('expenseLedgerTableFoot');
  const totalSumBadge = document.getElementById('expenseLedgerTotalBadge');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (tfoot) tfoot.innerHTML = '';
  const expenses = state.expenses || [];

  if (expenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-6 text-center text-slate-500 text-xs font-sans">
          등록된 지출 내역이 없습니다. 상단 <b>[💰 지출 등록]</b> 버튼으로 경비를 등록하세요.
        </td>
      </tr>
    `;
    if (totalSumBadge) totalSumBadge.textContent = '0원';
    return;
  }

  // 시간순 정렬로 누적 합계 계산
  const sorted = [...expenses].sort((a, b) => {
    const diff = (a.date || '').localeCompare(b.date || '');
    if (diff !== 0) return diff;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  let running = 0;
  const withRunning = sorted.map(exp => {
    running += Number(exp.amount || 0);
    return { ...exp, runningTotal: running };
  });

  // 최신 지출이 상단에 오도록 역순 표시 (누적합계는 발생시점 기준 정확히 유지)
  const displayList = [...withRunning].reverse();

  displayList.forEach(exp => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-surface-850/60 transition text-xs';
    const noteText = exp.note ? ` <span class="text-[11px] text-slate-400">(${exp.note})</span>` : '';
    const rType = exp.receipt_type || '영수증';
    const isPhoto = exp.receipt_info && (exp.receipt_info.startsWith('data:image/') || exp.receipt_info.startsWith('http'));
    const photoBtn = isPhoto
      ? `<button type="button" onclick="viewReceiptImage('${exp.id}')" class="ml-1 px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/60 text-[10px] text-cyan-300 font-bold hover:bg-cyan-900 cursor-pointer shadow-xs active:scale-95" title="영수증 사진 확대">📷 보기</button>`
      : '';

    tr.innerHTML = `
      <td class="py-2.5 px-3 text-center text-slate-300 font-mono whitespace-nowrap">${exp.date || '-'}</td>
      <td class="py-2.5 px-3 text-left font-sans text-slate-200">${exp.item || '-'}${noteText}</td>
      <td class="py-2.5 px-3 text-right font-mono font-bold text-amber-400 whitespace-nowrap">${Number(exp.amount || 0).toLocaleString()}원</td>
      <td class="py-2.5 px-3 text-center whitespace-nowrap">
        <span class="inline-flex items-center gap-1">
          <span class="px-1.5 py-0.5 rounded bg-surface-800 border border-slate-700 text-[10px] text-slate-300 font-sans">${rType}</span>
          ${photoBtn}
        </span>
      </td>
      <td class="py-2.5 px-3 text-right font-mono font-bold text-cyan-400 whitespace-nowrap">${Number(exp.runningTotal || 0).toLocaleString()}원</td>
    `;
    tbody.appendChild(tr);
  });

  // 테이블 푸터 요약 행 (합계)
  if (tfoot) {
    tfoot.innerHTML = `
      <tr>
        <td class="py-2.5 px-3 text-center border-r border-slate-700 text-slate-300 font-bold">합계</td>
        <td class="py-2.5 px-3 text-left border-r border-slate-700 text-slate-400 font-sans">총 ${expenses.length}건 지출 누계</td>
        <td class="py-2.5 px-3 text-right border-r border-slate-700 text-amber-400 font-mono font-bold">${running.toLocaleString()}원</td>
        <td class="py-2.5 px-3 text-center border-r border-slate-700 text-slate-400 text-[10px]">-</td>
        <td class="py-2.5 px-3 text-right text-cyan-400 font-mono font-bold">${running.toLocaleString()}원</td>
      </tr>
    `;
  }

  if (totalSumBadge) {
    totalSumBadge.textContent = `${running.toLocaleString()}원`;
  }
}

export function getDynamicFloorStructure(roomsObj) {
  const rooms = roomsObj || {};
  const roomKeys = Object.keys(rooms);
  if (!roomKeys.length) return FLOOR_STRUCTURE;

  const floorMap = {};
  roomKeys.forEach(key => {
    const rNum = parseInt(key, 10);
    if (isNaN(rNum)) return;
    const floor = Math.floor(rNum / 100);
    if (!floorMap[floor]) {
      floorMap[floor] = [];
    }
    floorMap[floor].push(rNum);
  });

  const sortedFloors = Object.keys(floorMap).map(Number).sort((a, b) => b - a);
  if (!sortedFloors.length) return FLOOR_STRUCTURE;

  return sortedFloors.map(f => ({
    label: `${f}층`,
    rooms: floorMap[f].sort((a, b) => a - b)
  }));
}

// ── 우측 슬라이드 바: 호실 선택 그리드 (동적 층수/호실 완벽 지원) ──
export function renderRightRoomDrawer() {
  const container = document.getElementById('drawerFloorMap');
  if (!container) return;
  container.innerHTML = '';

  const curBranchObj = state.branches.find(b => b.branch_id === state.currentBranch);
  const branchName = curBranchObj ? curBranchObj.name : '건물';
  const totalCount = Object.keys(state.rooms || {}).length;
  const drawerTitleEl = document.getElementById('roomDrawerTitle');
  if (drawerTitleEl) {
    drawerTitleEl.textContent = `${branchName}(${totalCount}개실)`;
  }

  const dynamicFloors = getDynamicFloorStructure(state.rooms);
  dynamicFloors.forEach(floor => {
    const floorBox = document.createElement('div');
    floorBox.className = 'mb-2.5';

    const floorHeader = document.createElement('div');
    floorHeader.className = 'text-[11px] font-bold text-slate-400 mb-1 px-1 flex items-center justify-between font-mono';
    floorHeader.textContent = floor.label;
    floorBox.appendChild(floorHeader);

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-3 sm:grid-cols-5 gap-1.5';

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
        btn.className = 'p-2 rounded-xl bg-cyan-400 text-slate-950 font-black ring-2 ring-cyan-200 shadow-md text-left flex flex-col justify-between cursor-pointer transition';
      } else {
        btn.className = 'p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-slate-200 border border-slate-700/80 text-left flex flex-col justify-between cursor-pointer transition hover:border-cyan-500/50';
      }

      btn.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="font-mono text-xs ${isSelected ? 'text-slate-950 font-black' : 'text-slate-200 font-bold'}">${rNum}호</span>
          <span class="w-2 h-2 rounded-full ${dotColor}"></span>
        </div>
        <div class="text-[10px] mt-1 truncate ${isSelected ? 'text-slate-900 font-bold' : 'text-slate-400'}">
          ${isVacant ? '공실' : (rData.name || '')}
        </div>
      `;

      grid.appendChild(btn);
    });

    floorBox.appendChild(grid);
    container.appendChild(floorBox);
  });
}

function isSameBranchId(id1, id2) {
  if (!id1 || !id2) return false;
  const a = String(id1).trim().toLowerCase();
  const b = String(id2).trim().toLowerCase();
  if (a === b) return true;
  const isMainA = (a === 'main' || a === 'chicvill' || a === 'chicvill1' || a === 'chicvill01' || a === '시크빌' || a === '시크빌1호점' || a === '시크빌 1호점');
  const isMainB = (b === 'main' || b === 'chicvill' || b === 'chicvill1' || b === 'chicvill01' || b === '시크빌' || b === '시크빌1호점' || b === '시크빌 1호점');
  if (isMainA && isMainB) return true;

  const isB2A = (a === 'branch_9027' || a === 'chicvill2' || a === 'chicvill02' || a === '시크빌2호점');
  const isB2B = (b === 'branch_9027' || b === 'chicvill2' || b === 'chicvill02' || b === '시크빌2호점');
  if (isB2A && isB2B) return true;

  return false;
}

// ── 좌측 슬라이드 바: 부동산 선택 및 메뉴 (RBAC 권한 분리) ──
export function renderLeftMenuDrawer() {
  const branchListContainer = document.getElementById('drawerBranchList');
  if (!branchListContainer) return;
  branchListContainer.innerHTML = '';

  const user = state.currentUser;
  const isSuperadmin = (user && user.role === 'superadmin');
  const isBranchAdmin = (user && user.role === 'branch_admin');
  const myBranch = user ? (user.branch_id || 'main') : null;

  // 1. 상단 액션 버튼 제어 (신규 추가, 삭제는 본사 최고관리자 admin 전용)
  const btnNew = document.getElementById('drawerBtnNewBranch');
  const btnDel = document.getElementById('drawerBtnDeleteBranch');
  const divDel = document.getElementById('drawerDividerDelete');
  const hqContainer = document.getElementById('drawerHqCenterContainer');

  if (btnNew) {
    btnNew.style.display = isSuperadmin ? 'inline-block' : 'none';
  }
  if (btnDel) {
    btnDel.style.display = isSuperadmin ? 'inline-block' : 'none';
  }
  if (divDel) {
    divDel.style.display = isSuperadmin ? 'inline-block' : 'none';
  }

  // 2. HQ 본사 관리 센터 배너 권한 분기
  if (hqContainer) {
    if (isSuperadmin) {
      hqContainer.innerHTML = `
        <a href="./branches.html" class="w-full text-left p-2.5 rounded-xl bg-gradient-to-r from-purple-950/80 to-indigo-950/80 hover:from-purple-900/90 hover:to-indigo-900/90 text-purple-200 border border-purple-500/60 font-semibold flex items-center justify-between cursor-pointer transition shadow-md no-underline block">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">🏛️</span>
            <div>
              <div class="text-xs font-bold text-white flex items-center gap-1.5">
                <span>본사 관리 센터 (가입 승인 & 지점)</span>
                <span class="text-[9px] bg-purple-500/40 text-purple-200 border border-purple-400/60 px-1.5 py-0.2 rounded font-bold">HQ 전용</span>
              </div>
              <div class="text-[10px] text-purple-300/90">점주 가입 승인 / 반려 · 신규 건물 등록 · SaaS 수납</div>
            </div>
          </div>
          <span class="text-purple-400 text-xs font-bold">↗</span>
        </a>
      `;
    } else {
      hqContainer.innerHTML = `
        <div id="btnHqRestricted" class="w-full text-left p-2.5 rounded-xl bg-surface-850/60 border border-slate-700/60 text-slate-400 font-semibold flex items-center justify-between cursor-pointer opacity-75 hover:opacity-100 transition shadow-xs">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">🔒</span>
            <div>
              <div class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <span>본사 관리 센터</span>
                <span class="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded font-mono">admin 전용</span>
              </div>
              <div class="text-[10px] text-slate-500">지점 점주는 담당 매장만 관제 가능합니다</div>
            </div>
          </div>
          <span class="text-slate-500 text-xs font-bold">🔒</span>
        </div>
      `;
      document.getElementById('btnHqRestricted')?.addEventListener('click', () => {
        alert('본사 지점 & 수납 관리 센터는 본사 총괄 최고관리자(admin) 전용 보안 메뉴입니다.');
      });
    }
  }

  // 3. 등록된 부동산 목록 렌더링 (동일 건물 중복 제거: main과 chicvill01은 같은 1호점이므로 하나로 합침)
  if (!state.branches || state.branches.length === 0) {
    branchListContainer.innerHTML = `
      <div class="w-full text-left p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/60 text-cyan-300 font-bold text-xs flex items-center justify-between">
        <span>🏢 시크빌 1호점 (본점, 29개실)</span>
        <span class="text-xs">✓ 선택됨</span>
      </div>
    `;
    return;
  }

  // canonical ID 기준 그룹화 및 중복 제거
  const canonicalMap = new Map();
  state.branches.forEach(b => {
    const rawId = (b.branch_id || '').toLowerCase();
    const cId = (rawId === 'chicvill01' || rawId === 'chicvill' || rawId === 'chicvill1' || rawId === 'main') ? 'main' :
                (rawId === 'chicvill02' || rawId === 'chicvill2' || rawId === 'branch_9027') ? 'branch_9027' : b.branch_id;
    
    if (!canonicalMap.has(cId)) {
      canonicalMap.set(cId, { ...b, branch_id: cId, name: b.name || `건물 (${cId})` });
    } else {
      const existing = canonicalMap.get(cId);
      if (existing.name && existing.name.startsWith('지점 (') && b.name && !b.name.startsWith('지점 (')) {
        canonicalMap.set(cId, { ...b, branch_id: cId });
      }
    }
  });

  const displayBranches = Array.from(canonicalMap.values());

  displayBranches.forEach(b => {
    const isSelected = isSameBranchId(b.branch_id, state.currentBranch);
    const isMain = (b.branch_id === 'main');
    const isMyBranch = isSameBranchId(b.branch_id, myBranch);
    const canAccessThisBranch = isSuperadmin || isMyBranch || !user;

    const itemEl = document.createElement('div');

    if (isSelected) {
      itemEl.className = 'w-full text-left p-2.5 rounded-xl bg-cyan-950/70 border border-cyan-500/80 text-cyan-300 font-bold text-xs flex items-center justify-between shadow-sm';
      
      const leftCol = document.createElement('div');
      leftCol.className = 'flex-1 min-w-0 pr-2';
      leftCol.innerHTML = `
        <div class="flex items-center gap-1.5 truncate">
          <span>🏢</span>
          <span class="truncate">${b.name}</span>
          ${isSuperadmin ? '<span class="text-[9px] px-1 bg-purple-500/30 text-purple-300 rounded border border-purple-500/40">전권</span>' : (isMyBranch ? '<span class="text-[9px] px-1 bg-cyan-500/30 text-cyan-200 rounded">내 매장</span>' : '')}
        </div>
        <div class="text-[10px] text-cyan-400/80 mt-0.5 truncate">${b.address || '주소 등록됨'}</div>
      `;

      const rightCol = document.createElement('div');
      rightCol.className = 'flex items-center gap-1.5 shrink-0';

      // ✏️ 건물 정보 수정 버튼 (본사 최고관리자 또는 해당 지점 점주만)
      if (isSuperadmin || isMyBranch) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'px-1.5 py-0.5 rounded text-[11px] text-amber-300 hover:text-amber-100 hover:bg-amber-900/60 border border-amber-500/40 transition cursor-pointer';
        editBtn.title = '건물 정보 수정';
        editBtn.textContent = '✏️ 수정';
        editBtn.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          openEditBranchModal(b.branch_id);
        };
        rightCol.appendChild(editBtn);
      }

      // 🗑️ 건물 삭제 버튼 (오직 본사 최고관리자 admin만!)
      if (isSuperadmin && !isMain) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'px-1.5 py-0.5 rounded text-[11px] text-rose-300 hover:text-rose-100 hover:bg-rose-900/60 border border-rose-500/40 transition cursor-pointer';
        delBtn.title = '현재 건물 삭제';
        delBtn.textContent = '🗑️ 삭제';
        delBtn.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          handleDeleteBranch(b.branch_id, b.name);
        };
        rightCol.appendChild(delBtn);
      }

      const statusBadge = document.createElement('span');
      statusBadge.className = 'text-xs font-black text-cyan-300';
      statusBadge.textContent = '✓ 선택중';
      rightCol.appendChild(statusBadge);

      itemEl.appendChild(leftCol);
      itemEl.appendChild(rightCol);
    } else {
      itemEl.className = 'w-full text-left p-2.5 rounded-xl bg-surface-800/80 hover:bg-surface-700/80 text-slate-300 border border-slate-700/60 text-xs flex items-center justify-between transition';
      
      const leftCol = document.createElement('div');
      leftCol.className = 'flex-1 min-w-0 pr-2 ' + (canAccessThisBranch ? 'cursor-pointer' : 'cursor-not-allowed opacity-60');
      leftCol.innerHTML = `
        <div class="flex items-center gap-1.5 truncate">
          <span class="text-slate-400">${canAccessThisBranch ? '🏢' : '🔒'}</span>
          <span class="font-semibold text-slate-200 truncate">${b.name}</span>
          ${!canAccessThisBranch ? '<span class="text-[9px] px-1 bg-slate-800 text-slate-400 rounded">타 매장</span>' : ''}
        </div>
        <div class="text-[10px] text-slate-400 mt-0.5 truncate">${b.address || '주소 등록됨'}</div>
      `;
      leftCol.onclick = () => {
        if (!canAccessThisBranch) {
          alert(`'${b.name}'은 타 매장입니다. 점주는 배정된 담당 매장만 관제할 수 있습니다.\n전체 매장 관제 권한은 본사 admin 계정이 필요합니다.`);
          return;
        }
        switchBranch(b.branch_id);
      };

      const rightCol = document.createElement('div');
      rightCol.className = 'flex items-center gap-1.5 shrink-0';

      if (isSuperadmin) {
        // ✏️ 건물 정보 수정 버튼
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-amber-950/50 transition cursor-pointer';
        editBtn.title = '건물 정보 수정';
        editBtn.textContent = '✏️';
        editBtn.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          openEditBranchModal(b.branch_id);
        };
        rightCol.appendChild(editBtn);

        if (!isMain) {
          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 transition cursor-pointer';
          delBtn.title = '이 건물 삭제';
          delBtn.textContent = '🗑️';
          delBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            handleDeleteBranch(b.branch_id, b.name);
          };
          rightCol.appendChild(delBtn);
        }
      }

      if (canAccessThisBranch) {
        const selectBtn = document.createElement('button');
        selectBtn.type = 'button';
        selectBtn.className = 'text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer';
        selectBtn.textContent = '선택 ↗';
        selectBtn.onclick = (e) => {
          e.stopPropagation();
          switchBranch(b.branch_id);
        };
        rightCol.appendChild(selectBtn);
      } else {
        const lockBadge = document.createElement('span');
        lockBadge.className = 'text-[10px] text-slate-500 font-mono px-1.5 py-0.5 rounded bg-slate-800/80 cursor-not-allowed';
        lockBadge.title = '점주 권한 제한 (타 매장)';
        lockBadge.textContent = '🔒 잠김';
        rightCol.appendChild(lockBadge);
      }

      itemEl.appendChild(leftCol);
      itemEl.appendChild(rightCol);
    }

    branchListContainer.appendChild(itemEl);
  });
}

// ── RBAC 바인딩 핸들러 ──
window.handleNewBranchClick = () => {
  const user = state.currentUser;
  if (!user || user.role !== 'superadmin') {
    alert('신규 매장(가맹점) 등록은 본사 총괄 최고관리자(admin) 전용 권한입니다.');
    return;
  }
  openNewBranchModal();
  closeMenuDrawer();
};

window.handleDeleteSelectedBranchClick = () => {
  const user = state.currentUser;
  if (!user || user.role !== 'superadmin') {
    alert('매장 영구 삭제는 본사 총괄 최고관리자(admin) 전용 권한입니다.');
    return;
  }
  handleDeleteSelectedBranch();
};

// ── 현재 선택된 부동산 삭제 (신규 추가 옆 '삭제' 링크) ──
export async function handleDeleteSelectedBranch() {
  const user = state.currentUser;
  if (!user || user.role !== 'superadmin') {
    alert('매장 영구 삭제는 본사 총괄 최고관리자(admin) 전용 권한입니다.');
    return;
  }
  const currentBranchId = state.currentBranch;
  if (!currentBranchId || currentBranchId === 'main') {
    alert("기본 본사 부동산('시크빌')은 삭제할 수 없습니다.\n별관 등 삭제하려는 건물을 먼저 목록에서 선택해주세요.");
    return;
  }
  const curBranchObj = (state.branches || []).find(b => b.branch_id === currentBranchId);
  const branchName = curBranchObj ? curBranchObj.name : currentBranchId;
  await handleDeleteBranch(currentBranchId, branchName);
}

// ── 특정 부동산 삭제 처리 (전용 확인 모달 연동) ──
let pendingDeleteBranchId = null;
let pendingDeleteBranchName = null;

export function handleDeleteBranch(branchId, branchName = '') {
  const user = state.currentUser;
  if (!user || user.role !== 'superadmin') {
    alert('매장 영구 삭제는 본사 총괄 최고관리자(admin) 전용 권한입니다.');
    return;
  }
  if (!branchId || branchId === 'main') {
    alert("기본 본사 부동산('시크빌')은 시스템 필수 데이터이므로 삭제할 수 없습니다.");
    return;
  }

  pendingDeleteBranchId = branchId;
  pendingDeleteBranchName = branchName || branchId;

  const nameEl = document.getElementById('deleteBranchTargetName');
  if (nameEl) nameEl.textContent = pendingDeleteBranchName;

  const modal = document.getElementById('branchDeleteModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  } else {
    if (confirm(`'${pendingDeleteBranchName}' 건물을 정말로 영구 삭제하시겠습니까?`)) {
      executeBranchDeleteConfirmed();
    }
  }
}

export async function executeBranchDeleteConfirmed() {
  if (!pendingDeleteBranchId) return;

  const branchId = pendingDeleteBranchId;
  const displayName = pendingDeleteBranchName || branchId;

  const btn = document.getElementById('btnConfirmDeleteBranch');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '삭제 중... ⏳';
  }

  try {
    // 1. API 삭제 호출
    try {
      await apiDeleteBranch(branchId);
    } catch (apiErr) {
      console.warn('[Delete Branch API Warning]', apiErr);
    }

    // 2. 로컬 스토리지 캐시 및 브랜치 상태 즉시 정리
    try {
      const sk = typeof STORAGE_KEY !== 'undefined' ? STORAGE_KEY : 'ONEROOM_DATA_STORE_29_V5';
      localStorage.removeItem(`${sk}_${branchId}`);
      localStorage.removeItem(`rent_state_v2_${branchId}`);
      localStorage.removeItem(`rent_backup_snapshot_${branchId}`);
      localStorage.removeItem(`rent_vat_rooms_${branchId}`);
    } catch (_) {}

    // state.branches에서 해당 지점 즉시 제거
    state.branches = (state.branches || []).filter(b => b.branch_id !== branchId);

    // 3. 만약 현재 보고 있던 건물이 삭제된 건물이면 기본 'main' (시크빌)로 자동 전환
    if (state.currentBranch === branchId) {
      state.currentBranch = 'main';
      const url = new URL(window.location.href);
      url.searchParams.set('branch', 'main');
      window.history.pushState({}, '', url.toString());
      saveLocalFallback();
      try {
        await loadInitialData();
      } catch (_) {}
    } else {
      saveLocalFallback();
    }

    // 4. 모달 닫기
    const modal = document.getElementById('branchDeleteModal');
    if (modal) {
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    // 5. 화면 전체 동기화 재렌더링
    renderAll();
    renderLeftMenuDrawer();

    alert(`✅ '${displayName}' 건물이 성공적으로 삭제되었습니다.`);
  } catch (err) {
    console.error('[Delete Branch Error]', err);
    state.branches = (state.branches || []).filter(b => b.branch_id !== branchId);
    if (state.currentBranch === branchId) {
      state.currentBranch = 'main';
    }
    saveLocalFallback();
    renderAll();
    renderLeftMenuDrawer();
    alert(`건물 삭제 처리 완료: ${err.message || '완료'}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🗑️ 네, 삭제합니다';
    }
    pendingDeleteBranchId = null;
    pendingDeleteBranchName = null;
  }
}

// ── 부동산 정보 수정 모달 열기 ──
export function openEditSelectedBranchModal() {
  const currentBranchId = state.currentBranch || 'main';
  openEditBranchModal(currentBranchId);
}

export function openEditBranchModal(branchId) {
  const targetId = branchId || state.currentBranch || 'main';
  const b = (state.branches || []).find(item => item.branch_id === targetId) || {
    branch_id: targetId,
    name: targetId === 'main' ? '시크빌 (29개실)' : targetId,
    address: '',
    contact_phone: ''
  };

  const idInput = document.getElementById('editBranchIdInput');
  const nameInput = document.getElementById('editBranchNameInput');
  const addrInput = document.getElementById('editBranchAddressInput');
  const phoneInput = document.getElementById('editBranchPhoneInput');

  if (idInput) idInput.value = b.branch_id || targetId;
  if (nameInput) nameInput.value = b.name || '';
  if (addrInput) addrInput.value = b.address || '';
  if (phoneInput) phoneInput.value = b.contact_phone || '';

  try {
    closeMenuDrawer();
  } catch (_) {}

  const modal = document.getElementById('editBranchModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

// ── 부동산 정보 수정 폼 제출 ──
export async function handleEditBranchSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const idInput = document.getElementById('editBranchIdInput');
  const nameInput = document.getElementById('editBranchNameInput');
  const addrInput = document.getElementById('editBranchAddressInput');
  const phoneInput = document.getElementById('editBranchPhoneInput');
  const btn = document.getElementById('btnSaveBranchEdit');

  const branchId = idInput ? idInput.value.trim() : '';
  const newName = nameInput ? nameInput.value.trim() : '';
  const newAddr = addrInput ? addrInput.value.trim() : '';
  const newPhone = phoneInput ? phoneInput.value.trim() : '';

  if (!branchId || !newName) {
    alert('건물 명칭은 필수 입력 사항입니다.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = '저장 중... ⏳';
  }

  const payload = {
    name: newName,
    address: newAddr,
    contact_phone: newPhone
  };

  try {
    if (state.isOnline) {
      await apiUpdateBranch(branchId, payload);
    }

    // 로컬 상태 즉시 반영
    let found = false;
    state.branches = (state.branches || []).map(b => {
      if (b.branch_id === branchId) {
        found = true;
        return { ...b, ...payload };
      }
      return b;
    });
    if (!found) {
      state.branches.push({ branch_id: branchId, ...payload, is_active: true, billing_status: 'PAID' });
    }

    saveLocalFallback();

    // 모달 닫기
    const modal = document.getElementById('editBranchModal');
    if (modal) {
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    // 화면 갱신
    renderAll();
    renderLeftMenuDrawer();

    alert(`🎉 [${newName}] 부동산 정보가 성공적으로 수정되었습니다!`);
  } catch (err) {
    console.error('[Edit Branch Error]', err);
    alert('부동산 정보 수정 실패: ' + (err.message || '서버 응답 오류'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '💾 정보 수정 저장';
    }
  }
}

// 전역 윈도우 즉시 노출
if (typeof window !== 'undefined') {
  window.handleDeleteBranch = handleDeleteBranch;
  window.handleDeleteSelectedBranch = handleDeleteSelectedBranch;
  window.executeBranchDeleteConfirmed = executeBranchDeleteConfirmed;
  window.openEditSelectedBranchModal = openEditSelectedBranchModal;
  window.openEditBranchModal = openEditBranchModal;
  window.handleEditBranchSubmit = handleEditBranchSubmit;
  window.handleSetPastVacancy = handleSetPastVacancy;
  window.handleSetPastUnpaid = handleSetPastUnpaid;
}

// ── 수납 처리 비동기 액션 ──
export async function handleProcessPayment(roomNum, month, year = currentYear) {
  try {
    const room = state.rooms[roomNum];
    const tenantName = (room && room.name) ? room.name : "공실";
    const curRent = (room && room.lease_type === "전세") ? 0 : (room ? room.rent : 0);
    const curMaint = (room ? room.maintenance : 0);
    const curTot = (Number(curRent) || 0) + (Number(curMaint) || 0);

    // 0. 수납 실행 전 사용자 명시적 확인 (취소 시 조기 종료: 결제 및 영수 메시지 발행 일체 중단)
    const proceed = confirm(`[${roomNum}호 ${tenantName}님]\n${year}년 ${month}월분 (${Number(curTot).toLocaleString()}원)을 수납 처리하시겠습니까?`);
    if (!proceed) {
      return;
    }

    const pKey = `${year}-${month}`;
    const defaultPayDate = `${year}-${String(month).padStart(2, '0')}-10`;

    // 1. 낙관적 UI 즉각 반영
    if (room && room.payments) {
      const existing = room.payments[pKey] || (year === currentYear ? room.payments[month] : null) || {};
      const payObj = {
        ...existing,
        month,
        year,
        paid: true,
        paid_date: defaultPayDate,
        note: existing.note || "정상 입금",
        tenant_name: tenantName,
        is_previous_tenant: false,
        rent_amount: room.lease_type === "전세" ? 0 : (existing.rent_amount !== undefined ? existing.rent_amount : room.rent),
        maintenance_amount: existing.maintenance_amount !== undefined ? existing.maintenance_amount : room.maintenance
      };
      room.payments[pKey] = payObj;
      if (year === currentYear) {
        room.payments[month] = payObj;
      }
    }
    saveLocalFallback();
    renderAll();

    // 2. 서버 동기화
    if (state.isOnline) {
      const res = await apiProcessPayment(roomNum, month, state.currentBranch, defaultPayDate, "정상 입금", tenantName, year);
      if (res) {
        state.rooms[roomNum] = res;
        saveLocalFallback();
        renderAll();
      }
    }

    // 3. 수납 후 영수 문자 발송 연동 (사용자 확인 후 발송)
    const curBranchObj = state.branches.find(b => b.branch_id === state.currentBranch);
    const branchName = state.currentBranch === 'main' ? '시크빌' : (curBranchObj ? curBranchObj.name : '시크빌');
    const receiptText = `[${branchName} 임차료 수납 영수증]\n${roomNum}호 ${tenantName} 님\n- 귀속: ${year}년 ${month}월분\n- 수납액: ${Number(curTot).toLocaleString()}원\n- 수납일자: ${defaultPayDate}\n정상 수납(완납) 처리되었습니다. 감사합니다.`;
    state.pendingReceiptText = receiptText;
    state.pendingReceiptRoom = roomNum;

    if (room && room.phone) {
      const sendReceipt = confirm(`✅ [${roomNum}호 ${tenantName}님] ${year}년 ${month}월분 수납이 정상 완료되었습니다.\n\n세입자에게 영수증 문자를 발송하시겠습니까?`);
      if (sendReceipt && typeof window.handleSendSmsReceipt === 'function') {
        window.handleSendSmsReceipt(room.phone);
      }
    }
  } catch (err) {
    console.error("수납 처리 실패:", err);
    alert("수납 처리 실패: " + err.message);
  }
}

export async function handleCancelPayment(roomNum, month, year = currentYear) {
  try {
    const pKey = `${year}-${month}`;

    // 1. 낙관적 UI 즉각 반영 (화면에서 즉시 미납으로 전환)
    const r = state.rooms[roomNum];
    if (r && r.payments) {
      const existing = r.payments[pKey] || (year === currentYear ? r.payments[month] : null) || {};
      const updatedPay = {
        ...existing,
        month,
        year,
        paid: false,
        paid_date: "",
        note: "납부 취소"
      };
      r.payments[pKey] = updatedPay;
      if (year === currentYear) {
        r.payments[month] = updatedPay;
      }
    }
    saveLocalFallback();
    renderAll();

    // 2. 서버 영구 반영
    if (state.isOnline) {
      const res = await apiCancelPayment(roomNum, month, state.currentBranch, year);
      if (res) {
        // 서버 응답 데이터에서도 해당 월 paid=false 보장
        if (res.payments) {
          if (res.payments[pKey]) {
            res.payments[pKey].paid = false;
            res.payments[pKey].paid_date = "";
          }
          if (year === currentYear && res.payments[month]) {
            res.payments[month].paid = false;
            res.payments[month].paid_date = "";
          }
        }
        state.rooms[roomNum] = res;
        saveLocalFallback();
        renderAll();
      }
    }
  } catch (err) {
    console.error("납부 취소 실패:", err);
    alert("납부 취소 실패: " + err.message);
  }
}

// ── 공실 전환 액션 (수동으로 공실 지정) ──
export async function handleSetPastVacancy(roomNum, month, year = currentYear) {
  try {
    const pKey = `${year}-${month}`;
    const r = state.rooms[roomNum];

    // 1. 낙관적 UI 즉각 반영 (공실로 전환)
    if (r && r.payments) {
      const existing = r.payments[pKey] || (year === currentYear ? r.payments[month] : null) || {};
      const vacancyPay = {
        ...existing,
        month,
        year,
        paid: false,
        paid_date: "",
        rent_amount: 0,
        maintenance_amount: 0,
        note: "공실",
        tenant_name: "공실",
        is_previous_tenant: false
      };
      r.payments[pKey] = vacancyPay;
      if (year === currentYear) {
        r.payments[month] = vacancyPay;
      }
    }
    saveLocalFallback();
    renderAll();

    // 2. 서버 영구 동기화
    if (state.isOnline) {
      const res = await apiCancelPayment(roomNum, month, state.currentBranch, year, "공실");
      if (res) {
        state.rooms[roomNum] = res;
        saveLocalFallback();
        renderAll();
      }
    }
  } catch (err) {
    console.error("공실 전환 실패:", err);
    alert("공실 전환 실패: " + err.message);
  }
}

// ── 미납 전환 액션 (공실 해제 및 미납 청구 복원) ──
export async function handleSetPastUnpaid(roomNum, month, year = currentYear) {
  try {
    const pKey = `${year}-${month}`;
    const r = state.rooms[roomNum];
    const defRent = (r && r.lease_type === "전세") ? 0 : (r ? r.rent : 0);
    const defMaint = (r ? r.maintenance : 0);
    const tName = (r && r.name) ? r.name : "";

    // 1. 낙관적 UI 즉각 반영 (미납 청구 복원)
    if (r && r.payments) {
      const existing = r.payments[pKey] || (year === currentYear ? r.payments[month] : null) || {};
      const unpaidPay = {
        ...existing,
        month,
        year,
        paid: false,
        paid_date: "",
        rent_amount: defRent,
        maintenance_amount: defMaint,
        note: "미납",
        tenant_name: tName,
        is_previous_tenant: false
      };
      r.payments[pKey] = unpaidPay;
      if (year === currentYear) {
        r.payments[month] = unpaidPay;
      }
    }
    saveLocalFallback();
    renderAll();

    // 2. 서버 영구 동기화
    if (state.isOnline) {
      const res = await apiCancelPayment(roomNum, month, state.currentBranch, year, "미납");
      if (res) {
        state.rooms[roomNum] = res;
        saveLocalFallback();
        renderAll();
      }
    }
  } catch (err) {
    console.error("미납 전환 실패:", err);
    alert("미납 전환 실패: " + err.message);
  }
}

// ── 은행 거래내역 대조용 실입금일자 수정 액션 ──
export async function handleChangePaymentDate(roomNum, month, year, newDate) {
  try {
    const room = state.rooms[roomNum];
    const tenantName = (room && room.name) ? room.name : "공실";
    const pKey = `${year}-${month}`;

    if (state.isOnline) {
      const res = await apiProcessPayment(roomNum, month, state.currentBranch, newDate, "은행 확인 입금", tenantName, year);
      if (res) state.rooms[roomNum] = res;
    }

    // 로컬 상태 즉시 동기화
    if (room && room.payments) {
      const existing = room.payments[pKey] || (year === currentYear ? room.payments[month] : {}) || {};
      const payObj = {
        ...existing,
        month,
        year,
        paid: true,
        paid_date: newDate,
        note: existing.note || "정상 입금",
        tenant_name: existing.tenant_name || tenantName
      };
      room.payments[pKey] = payObj;
      if (year === currentYear) room.payments[month] = payObj;
    }
    saveLocalFallback();
    renderAll();
  } catch (err) {
    alert("납부일자 수정 실패: " + err.message);
  }
}

// ── 과거 납부/청구 금액 직접 수정 액션 ──
export async function handleChangePaymentAmount(roomNum, month, year, newTotal, oldRent = 0, oldMaint = 0) {
  try {
    const room = state.rooms[roomNum];
    const tenantName = (room && room.name) ? room.name : "공실";
    const pKey = `${year}-${month}`;

    if (newTotal === 0) {
      // 0원으로 수정 시 납부 취소 (미납 환원)
      if (state.isOnline) {
        const res = await apiCancelPayment(roomNum, month, state.currentBranch, year);
        if (res) state.rooms[roomNum] = res;
      }
      if (room && room.payments) {
        const existing = room.payments[pKey] || (year === currentYear ? room.payments[month] : {}) || {};
        const payObj = {
          ...existing,
          month,
          year,
          paid: false,
          paid_date: '',
          rent_amount: 0,
          maintenance_amount: 0,
          note: '미납 (0원 처리)',
          tenant_name: existing.tenant_name || tenantName
        };
        room.payments[pKey] = payObj;
        if (year === currentYear) room.payments[month] = payObj;
      }
      saveLocalFallback();
      renderAll();
      return;
    }

    const isJeonse = (room && room.lease_type === "전세");
    let newRent = 0;
    let newMaint = newTotal;

    if (!isJeonse) {
      const baseMaint = oldMaint || (room ? room.maintenance : 0) || 50000;
      if (newTotal >= baseMaint) {
        newMaint = baseMaint;
        newRent = newTotal - baseMaint;
      } else {
        newMaint = newTotal;
        newRent = 0;
      }
    }

    const existing = (room && room.payments && (room.payments[pKey] || (year === currentYear ? room.payments[month] : {}))) || {};
    const paidDate = existing.paid_date || `${year}-${String(month).padStart(2, '0')}-10`;
    const note = existing.note || "금액 직접 수정";

    if (state.isOnline) {
      const res = await apiProcessPayment(
        roomNum,
        month,
        state.currentBranch,
        paidDate,
        note,
        tenantName,
        year,
        newRent,
        newMaint
      );
      if (res) state.rooms[roomNum] = res;
    }

    // 로컬 상태 즉시 동기화
    if (room && room.payments) {
      const payObj = {
        ...existing,
        month,
        year,
        paid: true,
        paid_date: paidDate,
        rent_amount: newRent,
        maintenance_amount: newMaint,
        note,
        tenant_name: existing.tenant_name || tenantName
      };
      room.payments[pKey] = payObj;
      if (year === currentYear) room.payments[month] = payObj;
    }
    saveLocalFallback();
    renderAll();
  } catch (err) {
    alert("금액 수정 실패: " + err.message);
  }
}

// ── 전입일부터 현재까지 납부내역 자동 채우기 핸들러 ──
export async function handleFillTenantPayments(roomNum = null) {
  const targetRoom = roomNum || state.selectedRoom;
  const room = state.rooms[targetRoom];
  if (!room || !room.name) {
    alert(`${targetRoom}호는 공실이거나 세입자가 등록되어 있지 않습니다.`);
    return;
  }

  try {
    if (state.isOnline) {
      const res = await apiFillTenantPayments(targetRoom, state.currentBranch);
      if (res && res.success) {
        const freshRooms = await apiGetRooms(state.currentBranch);
        if (freshRooms) {
          state.rooms = freshRooms;
        } else {
          fillTenantPaymentsState(targetRoom);
        }
      } else {
        fillTenantPaymentsState(targetRoom);
      }
    } else {
      fillTenantPaymentsState(targetRoom);
    }
    saveLocalFallback();
    renderAll();
    alert(`[${targetRoom}호 ${room.name}] 전입일(${room.move_in || '기준일'})부터 현재(${currentMonth}월)까지 납부내역이 완납으로 채워졌습니다!`);
  } catch (err) {
    console.warn("API 동기화 중 오류, 로컬 상태로 채우기 적용:", err);
    fillTenantPaymentsState(targetRoom);
    saveLocalFallback();
    renderAll();
    alert(`[${targetRoom}호 ${room.name}] 전입일 기준 납부내역이 로컬에 채워졌습니다!`);
  }
}

// ── 맥락별 컬러 안내 배너 (AGENTS.md 표준 Alert UX) ──
let alertTimeout = null;
export function updateAppAlert(type, message, duration = 4000) {
  let box = document.getElementById('appGlobalAlert');
  if (!box) {
    box = document.createElement('div');
    box.id = 'appGlobalAlert';
    box.className = 'fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] transition-all duration-300';
    document.body.appendChild(box);
  }

  if (alertTimeout) {
    clearTimeout(alertTimeout);
    alertTimeout = null;
  }

  if (!message) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }

  let bgClass = 'bg-slate-900 border-slate-700 text-slate-100';
  let icon = 'ℹ️';

  if (type === 'success') {
    bgClass = 'bg-emerald-950/95 border-emerald-600/70 text-emerald-200 shadow-emerald-950/50';
    icon = '✅';
  } else if (type === 'error') {
    bgClass = 'bg-rose-950/95 border-rose-600/70 text-rose-200 shadow-rose-950/50';
    icon = '❌';
  } else if (type === 'warning') {
    bgClass = 'bg-amber-950/95 border-amber-600/70 text-amber-200 shadow-amber-950/50';
    icon = '⚠️';
  } else if (type === 'diff' || type === 'mismatch') {
    bgClass = 'bg-orange-950/95 border-orange-600/70 text-orange-200 shadow-orange-950/50';
    icon = '⚖️';
  }

  box.className = `fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] transition-all duration-300 transform scale-100`;
  box.innerHTML = `
    <div class="p-3 rounded-2xl border ${bgClass} shadow-xl flex items-center justify-between gap-3 text-xs font-semibold backdrop-blur-md">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-base shrink-0">${icon}</span>
        <span class="leading-relaxed break-words">${message}</span>
      </div>
      <button type="button" onclick="this.closest('#appGlobalAlert').classList.add('hidden')" class="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shrink-0 cursor-pointer font-bold">✕</button>
    </div>
  `;
  box.classList.remove('hidden');

  if (duration > 0) {
    alertTimeout = setTimeout(() => {
      box.classList.add('hidden');
    }, duration);
  }
}

// ── 백엔드 서버 즉시 재연결 핸들러 (버튼 디바운스 & 즉각 피드백) ──
export async function handleReconnectBackend(btnEl = null) {
  const btn = btnEl || document.querySelector('#serverStatusBanner button');
  const originalText = btn ? btn.innerHTML : '🔄 재연결';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span> 연결 중...`;
    btn.classList.add('opacity-75', 'cursor-not-allowed');
  }

  try {
    await loadInitialData();
    renderAll();

    if (state.isOnline) {
      const banner = document.getElementById('serverStatusBanner');
      if (banner) banner.classList.add('hidden');
      updateAppAlert('success', '✅ 백엔드 DB 서버와 정상 연결되었습니다! 실시간 데이터가 연동되었습니다.');
    } else {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const helpMsg = isLocal
        ? '⚠️ 백엔드 서버(포트 8000)가 아직 미실행 상태입니다. START_RENT.bat을 실행하신 후 다시 눌러주세요.'
        : '⚠️ 백엔드 API 게이트웨이 응답 대기 중입니다. 잠시 후 다시 눌러주세요.';
      updateAppAlert('warning', helpMsg);
    }
  } catch (err) {
    console.error("재연결 실패:", err);
    updateAppAlert('error', `❌ 재연결 오류: ${err.message || '네트워크 응답 없음'}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
      btn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
  }
}

// ── 글로벌 바인딩 (HTML onclick 직결) ──
if (typeof window !== 'undefined') {
  window.loadInitialData = loadInitialData;
  window.renderAll = renderAll;
  window.handleReconnectBackend = handleReconnectBackend;
  window.updateAppAlert = updateAppAlert;
}

