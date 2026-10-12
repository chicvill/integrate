/**
 * apps/rent/frontend/js/ui.js
 * 원룸 임차료 관리 시스템 모바일 최적화 DOM 렌더링 및 UI 슬라이드 드로어 제어.
 */

import { state, FLOOR_STRUCTURE, currentMonth, currentYear, formattedToday, saveLocalFallback, loadInitialData, fillTenantPaymentsState, evaluatePaymentRule, parseDateComponents } from './state.js?v=2.0';
import { apiProcessPayment, apiCancelPayment, apiFillTenantPayments, apiGetRooms } from './api.js?v=2.0';

export function selectRoom(roomNum) {
  state.selectedRoom = parseInt(roomNum, 10);
  saveLocalFallback();
  closeRoomDrawer();
  renderAll();
}

export async function switchBranch(branchId) {
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

export function togglePastAccordion() {
  state.isPastOpen = !state.isPastOpen;
  const room = state.rooms[state.selectedRoom];
  if (room) renderPastHistorySection(room);
}

// ── 종합 렌더링 ──
export function renderAll() {
  const roomNum = state.selectedRoom;
  const room = state.rooms[roomNum];
  if (!room) return;

  renderHeaderSummary(room);
  renderMainRoomCard(room);
  renderCurrentMonthSection(room);
  renderPastHistorySection(room);
  renderExpenseLedgerSection();
  renderRightRoomDrawer();
  renderLeftMenuDrawer();
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
  if (cardTenantName) cardTenantName.textContent = isVacant ? '공실 (미계약)' : `${room.name} 고객`;

  const cardPhone = document.getElementById('cardPhone');
  if (cardPhone) {
    if (isVacant || !room.phone) {
      cardPhone.innerHTML = `<span class="text-slate-500">연락처 없음</span>`;
    } else {
      cardPhone.innerHTML = `<a href="tel:${room.phone}" class="text-cyan-400 underline font-mono flex items-center gap-1 hover:text-cyan-300">📞 ${room.phone}</a>`;
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
  if (cPeriod) cPeriod.textContent = (room.move_in && room.expiry) ? `${room.move_in} ~ ${room.expiry}` : '-';

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
  if (curMonthTitle) curMonthTitle.textContent = `${currentMonth}월분`;

  const curTotalAmount = document.getElementById('curTotalAmount');
  if (curTotalAmount) curTotalAmount.textContent = `${Number(curTotal).toLocaleString()}원`;

  const curRentDetail = document.getElementById('curRentDetail');
  if (curRentDetail) curRentDetail.textContent = `월세 ${Number(curRent).toLocaleString()} + 관리비 ${Number(curMaint).toLocaleString()}`;

  const statusBadge = document.getElementById('curMonthStatusBadge');
  const actionArea = document.getElementById('curMonthActionArea');

  if (isVacant) {
    if (statusBadge) {
      statusBadge.className = 'px-3 py-1 rounded-full font-black text-sm bg-slate-800 text-slate-400 border border-slate-700';
      statusBadge.textContent = '공실 (미부과)';
    }
    if (actionArea) actionArea.innerHTML = `<span class="text-xs text-slate-500 py-2 block text-center">계약 등록 후 납부 가능</span>`;
  } else if (curPay.paid) {
    if (statusBadge) {
      statusBadge.className = 'px-3 py-1 rounded-full font-black text-sm bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 flex items-center gap-1.5';
      statusBadge.innerHTML = `<span>✓</span> 완납 (${curPay.paid_date || formattedToday})`;
    }
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="flex items-center gap-2 w-full">
          <button type="button" disabled class="flex-1 py-3 px-4 rounded-xl text-sm font-bold bg-surface-800 text-slate-400 border border-slate-700/80 cursor-not-allowed flex items-center justify-center gap-2 opacity-80">
            <span class="text-emerald-400 font-black">✓</span> 이번 달 납부 완료됨
          </button>
          <button type="button" id="btnCancelPay" class="py-3 px-3.5 rounded-xl text-xs font-semibold bg-surface-800 hover:bg-surface-700 text-slate-300 hover:text-rose-300 border border-slate-700 transition cursor-pointer">
            납부 취소
          </button>
        </div>
      `;
      document.getElementById('btnCancelPay').onclick = () => handleCancelPayment(rNum, currentMonth);
    }
  } else {
    if (statusBadge) {
      statusBadge.className = 'px-3 py-1 rounded-full font-black text-sm bg-rose-500/25 text-rose-300 border border-rose-500/50 animate-pulse';
      statusBadge.textContent = '● 미납 (입금대기)';
    }
    if (actionArea) {
      actionArea.innerHTML = `
        <button type="button" id="btnProcessPay" class="w-full py-3.5 px-4 rounded-xl text-base font-black bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 transition shadow-lg shadow-cyan-950/60 flex items-center justify-center gap-2 cursor-pointer active:scale-98">
          💳 ${currentMonth}월분 즉시 완납 처리 (${Number(curTotal).toLocaleString()}원)
        </button>
      `;
      document.getElementById('btnProcessPay').onclick = () => handleProcessPayment(rNum, currentMonth);
    }
  }
}

export function renderPastHistorySection(room) {
  const rNum = room.room_number;
  const tbody = document.getElementById('pastPaymentTableBody');
  const accordionBody = document.getElementById('pastAccordionBody');
  const pastToggleBtnText = document.getElementById('pastToggleBtnText');
  if (!tbody) return;

  if (accordionBody && pastToggleBtnText) {
    if (state.isPastOpen) {
      accordionBody.classList.remove('hidden');
      pastToggleBtnText.textContent = '과거 내역 접기 ▴';
    } else {
      accordionBody.classList.add('hidden');
      pastToggleBtnText.textContent = '과거 내역 펼치기 (최근 1년) ▾';
      tbody.innerHTML = '';
      return;
    }
  }

  tbody.innerHTML = '';
  const isJeonse = (room.lease_type === '전세');

  // ── 방안 A: 롤링 12개월 (현재 2026.10 기준 직전 12개월: 2026.10 ~ 2025.11) ──
  const rollingMonths = [];
  for (let i = 0; i < 12; i++) {
    let m = currentMonth - i;
    let y = currentYear;
    if (m <= 0) {
      m += 12;
      y -= 1;
    }
    rollingMonths.push({ year: y, month: m });
  }

  rollingMonths.forEach(item => {
    const y = item.year;
    const m = item.month;
    const pKey = `${y}-${m}`;

    // 결제 데이터 조회 (연도-월 키 우선, 당해연도 월 키, 없으면 기본 객체)
    const existingP = (room.payments && (room.payments[pKey] || (y === currentYear ? room.payments[m] : null)));

    let inYear = currentYear;
    let inMonth = 1;
    if (room.name && room.move_in) {
      const dtComp = parseDateComponents(room.move_in);
      if (dtComp) {
        inYear = dtComp.year;
        inMonth = dtComp.month;
      }
    }

    const rule = evaluatePaymentRule({
      year: y,
      month: m,
      inYear,
      inMonth,
      leaseType: room.lease_type || '월세',
      payTiming: room.pay_timing || '후불',
      curYear: currentYear,
      curMonth: currentMonth,
      hasPrevHist: Boolean(existingP?.is_previous_tenant)
    });

    let p = existingP ? { ...existingP } : {
      month: m,
      year: y,
      paid: rule.paid,
      paid_date: rule.paid ? `${y}-${String(m).padStart(2, '0')}-10` : '',
      rent_amount: isJeonse ? 0 : room.rent,
      maintenance_amount: room.maintenance,
      note: rule.note,
      tenant_name: room.name,
      is_previous_tenant: false
    };

    // 전입 이전 기간(이전 세입자 이력 없음) 또는 입주월 후불인데 구버전 캐시 등으로 완납되어 있던 경우 자동 보정
    if (existingP && !existingP.is_previous_tenant) {
      if (rule.isBeforeMoveIn) {
        p.paid = false;
        p.paid_date = '';
        p.note = rule.note;
      } else if (rule.isMoveInMonth && !rule.paid && (p.note === '정상 입금' || !p.note)) {
        p.paid = false;
        p.paid_date = '';
        p.note = rule.note;
      }
    }

    // 현 세입자가 과거(예: 2022년 전입)부터 계속 살고 있는 경우 세입자명 및 금액 스마트 보정
    let displayName = p.tenant_name;
    let isPrev = !!p.is_previous_tenant;
    let rAmt = isJeonse ? 0 : (p.rent_amount !== undefined ? p.rent_amount : room.rent);
    let mAmt = p.maintenance_amount !== undefined ? p.maintenance_amount : room.maintenance;

    if (room.name && room.move_in) {
      const dtComp = parseDateComponents(room.move_in);
      if (dtComp) {
        if (y > dtComp.year || (y === dtComp.year && m >= dtComp.month)) {
          displayName = room.name;
          isPrev = false;
          rAmt = isJeonse ? 0 : room.rent;
          mAmt = room.maintenance;
        }
      }
    }

    const tot = rAmt + mAmt;

    const tr = document.createElement('tr');
    tr.className = `hover:bg-surface-850/60 transition ${isPrev ? 'bg-amber-950/25' : ''}`;

    // 세입자 표시 라벨 (전출자 1년 보존 표시)
    let tenantLabel = '';
    if (isPrev) {
      tenantLabel = `
        <div class="font-bold text-amber-300 flex items-center gap-1 whitespace-nowrap">
          <span>${displayName || '전출 세입자'}</span>
          <span class="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-normal whitespace-nowrap">전출(1년)</span>
        </div>
      `;
    } else {
      tenantLabel = `
        <div class="font-medium text-slate-200 whitespace-nowrap">
          ${displayName || room.name || '공실'}
        </div>
      `;
    }

    // 납부일자 표시 (은행 거래내역 확인용: 완납 시 날짜 표시 및 클릭하여 실입금일 수정 지원)
    let payDateHtml = '';
    if (p.paid) {
      const displayDate = p.paid_date || `${y}-${String(m).padStart(2, '0')}-10`;
      payDateHtml = `
        <button type="button" class="btn-change-paydate inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-900/90 hover:bg-cyan-950/80 text-cyan-300 hover:text-cyan-200 border border-slate-700/80 hover:border-cyan-500/60 font-mono text-[11px] font-semibold transition cursor-pointer shadow-xs whitespace-nowrap" title="클릭하여 은행 실입금일자로 수정" data-year="${y}" data-month="${m}" data-date="${displayDate}">
          <span class="text-[10px] opacity-70">📅</span><span>${displayDate}</span>
        </button>
      `;
    } else {
      payDateHtml = `<span class="text-slate-600 font-mono text-[11px]">-</span>`;
    }

    tr.innerHTML = `
      <td class="py-2 px-2 text-center border-r border-slate-800 font-bold font-mono text-xs whitespace-nowrap">
        <span class="text-[10px] text-slate-400">${y}.</span><span class="text-xs text-white">${String(m).padStart(2, '0')}월</span>
      </td>
      <td class="py-2 px-2.5 border-r border-slate-800 text-xs whitespace-nowrap">
        ${tenantLabel}
      </td>
      <td class="py-2 px-2 border-r border-slate-800 text-right font-bold text-slate-100 font-mono text-xs whitespace-nowrap">
        ${Number(tot).toLocaleString()}원
      </td>
      <td class="py-2 px-2 border-r border-slate-800 text-center whitespace-nowrap">
        ${payDateHtml}
      </td>
      <td class="py-2 px-1.5 border-r border-slate-800 text-center whitespace-nowrap">
        <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${p.paid ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}">
          ${p.paid ? '완납' : '미납'}
        </span>
      </td>
      <td class="py-2 px-2 text-center whitespace-nowrap">
        ${p.paid ? `
          <button type="button" class="btn-cancel-past inline-block px-1.5 py-0.5 rounded text-[10px] font-normal bg-slate-800/80 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-slate-700/60 hover:border-rose-500/40 transition whitespace-nowrap cursor-pointer shadow-xs" data-year="${y}" data-month="${m}">
            취소
          </button>
        ` : `
          <button type="button" class="btn-pay-past inline-block px-2 py-0.5 rounded text-[11px] bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition shadow-xs whitespace-nowrap cursor-pointer" data-year="${y}" data-month="${m}">
            수납
          </button>
        `}
      </td>
    `;
    tbody.appendChild(tr);
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
        <td colspan="4" class="py-6 text-center text-slate-500 text-xs font-sans">
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
    tr.innerHTML = `
      <td class="py-2.5 px-3 text-center text-slate-300 font-mono whitespace-nowrap">${exp.date || '-'}</td>
      <td class="py-2.5 px-3 text-left font-sans text-slate-200">${exp.item || '-'}${noteText}</td>
      <td class="py-2.5 px-3 text-right font-mono font-bold text-amber-400 whitespace-nowrap">${Number(exp.amount || 0).toLocaleString()}원</td>
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
        <td class="py-2.5 px-3 text-right text-cyan-400 font-mono font-bold">${running.toLocaleString()}원</td>
      </tr>
    `;
  }

  if (totalSumBadge) {
    totalSumBadge.textContent = `${running.toLocaleString()}원`;
  }
}

// ── 우측 슬라이드 바: 29개실 호실 선택 그리드 ──
export function renderRightRoomDrawer() {
  const container = document.getElementById('drawerFloorMap');
  if (!container) return;
  container.innerHTML = '';

  FLOOR_STRUCTURE.forEach(floor => {
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

// ── 좌측 슬라이드 바: 부동산 선택 및 메뉴 ──
export function renderLeftMenuDrawer() {
  const branchListContainer = document.getElementById('drawerBranchList');
  if (!branchListContainer) return;
  branchListContainer.innerHTML = '';

  // 1. 등록된 부동산 목록 렌더링
  if (state.branches.length === 0) {
    branchListContainer.innerHTML = `
      <button type="button" class="w-full text-left p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/60 text-cyan-300 font-bold text-xs flex items-center justify-between">
        <span>🏢 시크빌 (29개실)</span>
        <span class="text-xs">✓ 선택됨</span>
      </button>
    `;
  } else {
    state.branches.forEach(b => {
      const isSelected = (b.branch_id === state.currentBranch);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.onclick = () => switchBranch(b.branch_id);

      if (isSelected) {
        btn.className = 'w-full text-left p-2.5 rounded-xl bg-cyan-950/70 border border-cyan-500/80 text-cyan-300 font-bold text-xs flex items-center justify-between shadow-sm cursor-pointer';
        btn.innerHTML = `
          <div>
            <div class="flex items-center gap-1.5">
              <span>🏢</span>
              <span>${b.name}</span>
            </div>
            <div class="text-[10px] text-cyan-400/80 mt-0.5">${b.address || '주소 등록됨'}</div>
          </div>
          <span class="text-xs font-black text-cyan-300">✓ 선택중</span>
        `;
      } else {
        btn.className = 'w-full text-left p-2.5 rounded-xl bg-surface-800/80 hover:bg-surface-700/80 text-slate-300 border border-slate-700/60 text-xs flex items-center justify-between cursor-pointer transition';
        btn.innerHTML = `
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-slate-400">🏢</span>
              <span class="font-semibold text-slate-200">${b.name}</span>
            </div>
            <div class="text-[10px] text-slate-400 mt-0.5">${b.address || '주소 등록됨'}</div>
          </div>
          <span class="text-[11px] text-slate-500">선택 ↗</span>
        `;
      }
      branchListContainer.appendChild(btn);
    });
  }
}

// ── 수납 처리 비동기 액션 ──
export async function handleProcessPayment(roomNum, month, year = currentYear) {
  try {
    const room = state.rooms[roomNum];
    const tenantName = (room && room.name) ? room.name : "공실";
    const pKey = `${year}-${month}`;
    const defaultPayDate = `${year}-${String(month).padStart(2, '0')}-10`;

    if (state.isOnline) {
      const res = await apiProcessPayment(roomNum, month, state.currentBranch, defaultPayDate, "정상 입금", tenantName, year);
      state.rooms[roomNum] = res;
    } else {
      // 오프라인 폴백
      if (room && room.payments) {
        const payObj = {
          month,
          year,
          paid: true,
          paid_date: defaultPayDate,
          note: "정상 입금",
          tenant_name: tenantName,
          is_previous_tenant: false,
          rent_amount: room.lease_type === "전세" ? 0 : room.rent,
          maintenance_amount: room.maintenance
        };
        room.payments[month] = payObj;
        room.payments[pKey] = payObj;
      }
    }
    saveLocalFallback();
    renderAll();
  } catch (err) {
    alert("수납 처리 실패: " + err.message);
  }
}

export async function handleCancelPayment(roomNum, month, year = currentYear) {
  try {
    const pKey = `${year}-${month}`;
    if (state.isOnline) {
      const res = await apiCancelPayment(roomNum, month, state.currentBranch, year);
      state.rooms[roomNum] = res;
    } else {
      // 오프라인 폴백
      const r = state.rooms[roomNum];
      if (r && r.payments) {
        if (r.payments[month]) {
          r.payments[month].paid = false;
          r.payments[month].paid_date = "";
          r.payments[month].note = "납부 취소";
        }
        if (r.payments[pKey]) {
          r.payments[pKey].paid = false;
          r.payments[pKey].paid_date = "";
          r.payments[pKey].note = "납부 취소";
        }
      }
    }
    saveLocalFallback();
    renderAll();
  } catch (err) {
    alert("납부 취소 실패: " + err.message);
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
