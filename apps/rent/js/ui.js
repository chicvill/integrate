/**
 * apps/rent/frontend/js/ui.js
 * 원룸 임차료 관리 시스템 DOM 렌더링 및 UI 유틸리티.
 */

import { state, FLOOR_STRUCTURE, currentMonth, formattedToday, saveLocalFallback } from './state.js?v=2.0';
import { apiProcessPayment, apiCancelPayment } from './api.js?v=2.0';

export function selectRoom(roomNum) {
  state.selectedRoom = parseInt(roomNum, 10);
  saveLocalFallback();
  renderAll();
}

export function renderAll() {
  const roomNum = state.selectedRoom;
  const room = state.rooms[roomNum];
  if (!room) return;

  renderFloorMap();
  renderBranchSelector();
  renderContractSummary(room);
  renderCurrentMonthSection(room);
  renderPastHistorySection(room);
}

export function renderBranchSelector() {
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

export function renderFloorMap() {
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

export function renderContractSummary(room) {
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

export function renderCurrentMonthSection(room) {
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

export function renderPastHistorySection(room) {
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
export async function handleProcessPayment(roomNum, month) {
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

export async function handleCancelPayment(roomNum, month) {
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
