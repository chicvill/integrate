/**
 * apps/rent/frontend/js/modals.js
 * 원룸 임차료 관리 시스템 모달 팝업 및 계약/지출 폼 제어 모듈.
 */

import { state, formattedToday, saveLocalFallback } from './state.js?v=2.0';
import { apiUpdateContract, apiCreateExpense, apiRequestUpgrade, apiGetVatReport, apiCreateBranch, apiGetTenantHistories } from './api.js?v=2.0';
import { renderAll, switchBranch } from './ui.js?v=2.0';

export function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('hidden');
    m.classList.add('flex');
  }
}

export function closeModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('flex');
    m.classList.add('hidden');
  }
}

// ── 계약 수정 모달 ──
export function openContractEditModal() {
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

export function handleLeaseTypeChangeInForm() {
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

export async function handleContractFormSubmit(e) {
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
export function openExpenseModal() {
  document.getElementById('expItem').value = '';
  document.getElementById('expAmount').value = '';
  document.getElementById('expNote').value = '';
  openModal('expenseModal');
}

export async function handleExpenseFormSubmit(e) {
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

export function openLedgerModal() {
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
export function exportCurrentRoomCSV() {
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
export function openUpgradeModal() {
  document.getElementById('upgradeName').value = '';
  document.getElementById('upgradePhone').value = '';
  document.getElementById('upgradeReason').value = '';
  openModal('upgradeModal');
}

export async function handleUpgradeSubmit(e) {
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
export let currentVatRawData = null; // 원본 전체 데이터
export let currentVatData = null;    // 필터링 적용된 현재 표시 데이터
export let selectedVatRooms = new Set(); // 선택된 호실 번호 목록 (디폴트: 전체)
let isVatRoomContainerCollapsed = false;

export let currentVatParams = {
  year: 2026,
  startMonth: 1,
  endMonth: 6,
  label: '1기 (1~6월)'
};

export async function openVatModal() {
  initVatRoomsSelection();
  openModal('vatModal');
  // 기본 1기 (1~6월, 2026년) 자동 조회
  await setVatPeriod(1, 6, '1기 (1~6월)');
}

/**
 * 부가세 산출 대상 호실 초기화 (디폴트: 모든 호실 선택)
 */
export function initVatRoomsSelection() {
  const allRoomKeys = Object.keys(state.rooms || {}).map(Number).sort((a, b) => a - b);
  selectedVatRooms = new Set(allRoomKeys);
  renderVatRoomCheckboxes();
}

/**
 * 호실 선택 체크박스 칩 렌더링
 */
export function renderVatRoomCheckboxes() {
  const container = document.getElementById('vatRoomCheckboxesContainer');
  const badge = document.getElementById('vatSelectedRoomsBadge');
  const allRoomKeys = Object.keys(state.rooms || {}).map(Number).sort((a, b) => a - b);
  const totalCount = allRoomKeys.length;
  const selCount = selectedVatRooms.size;

  if (badge) {
    if (selCount === totalCount) {
      badge.textContent = `전체 선택됨 (${totalCount}개실)`;
      badge.className = "text-[11px] font-semibold text-cyan-400 bg-cyan-950/70 border border-cyan-800/60 px-2 py-0.5 rounded-full";
    } else if (selCount === 0) {
      badge.textContent = `선택 없음 (0개실)`;
      badge.className = "text-[11px] font-semibold text-rose-400 bg-rose-950/70 border border-rose-800/60 px-2 py-0.5 rounded-full";
    } else {
      badge.textContent = `${selCount}개실 선택됨 / 총 ${totalCount}개실`;
      badge.className = "text-[11px] font-semibold text-amber-300 bg-amber-950/70 border border-amber-800/60 px-2 py-0.5 rounded-full";
    }
  }

  if (!container) return;

  container.innerHTML = allRoomKeys.map(rNum => {
    const isChecked = selectedVatRooms.has(rNum);
    return `
      <label class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs cursor-pointer select-none transition ${
        isChecked 
          ? 'border-cyan-600/70 bg-cyan-950/40 text-cyan-200' 
          : 'border-slate-800 bg-surface-900/80 text-slate-400 hover:border-slate-700'
      }">
        <input type="checkbox" value="${rNum}" ${isChecked ? 'checked' : ''} 
          onchange="onToggleVatRoom(${rNum}, this.checked)" 
          class="accent-cyan-500 rounded cursor-pointer w-3.5 h-3.5">
        <span class="font-bold">${rNum}호</span>
      </label>
    `;
  }).join('');
}

/**
 * 개별 호실 체크 토글
 */
export function onToggleVatRoom(rNum, isChecked) {
  const num = Number(rNum);
  if (isChecked) {
    selectedVatRooms.add(num);
  } else {
    selectedVatRooms.delete(num);
  }
  renderVatRoomCheckboxes();
  applyVatRoomFilter();
}

/**
 * 전체 선택 / 전체 해제 (디폴트는 전체 선택)
 */
export function selectAllVatRooms(selectAll = true) {
  const allRoomKeys = Object.keys(state.rooms || {}).map(Number);
  if (selectAll) {
    selectedVatRooms = new Set(allRoomKeys);
  } else {
    selectedVatRooms = new Set();
  }
  renderVatRoomCheckboxes();
  applyVatRoomFilter();
}

/**
 * 호실 선택 컨테이너 접기 / 펼치기
 */
export function toggleVatRoomContainer() {
  const container = document.getElementById('vatRoomCheckboxesContainer');
  const btn = document.getElementById('vatRoomToggleBtn');
  isVatRoomContainerCollapsed = !isVatRoomContainerCollapsed;

  if (container) {
    if (isVatRoomContainerCollapsed) {
      container.classList.add('hidden');
    } else {
      container.classList.remove('hidden');
    }
  }
  if (btn) {
    btn.textContent = isVatRoomContainerCollapsed ? '호실 펼치기 ▾' : '호실 접기 ▴';
  }
}

/**
 * 선택된 호실들로 부가세 데이터 필터링 및 화면 즉각 재계산/렌더링
 */
export function applyVatRoomFilter() {
  if (!currentVatRawData || !currentVatRawData.rows) return;

  const raw = currentVatRawData;
  const filteredRows = raw.rows.filter(r => selectedVatRooms.has(Number(r.room_number)));

  let total_collected = 0;
  let total_supply = 0;
  let total_vat = 0;

  filteredRows.forEach(r => {
    total_collected += Number(r.period_total || 0);
    total_supply += Number(r.supply_value || 0);
    total_vat += Number(r.vat_value || 0);
  });

  currentVatData = {
    ...raw,
    rows: filteredRows,
    total_collected,
    total_supply,
    total_vat
  };

  renderVatReportUI(currentVatData);
}

export async function setVatPeriod(startMonth, endMonth, label) {
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

export async function handleVatCustomQuery() {
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

export async function fetchAndRenderVat(startMonth, endMonth, year, label) {
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

  currentVatRawData = data;
  applyVatRoomFilter();
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
    const tenant_names_seen = new Set();

    for (const m of months) {
      const p = (r.payments && r.payments[m]) || {};
      let amt = 0;
      if (p.paid) {
        amt = (p.rent_amount !== undefined ? p.rent_amount : (r.rent || 0)) + 
              (p.maintenance_amount !== undefined ? p.maintenance_amount : (r.maintenance || 0));
        if (p.tenant_name) tenant_names_seen.add(p.tenant_name);
      }
      monthly_amounts[m] = amt;
      room_period_total += amt;
    }

    const supply_val = Math.round(room_period_total / 1.1);
    const vat_val = room_period_total - supply_val;

    total_collected += room_period_total;
    total_supply += supply_val;
    total_vat += vat_val;

    let display_name = r.name || '공실';
    if (tenant_names_seen.size > 1) {
      const others = Array.from(tenant_names_seen).filter(n => n !== display_name);
      display_name = `${display_name} (전: ${others.join(', ')})`;
    } else if (tenant_names_seen.size === 1) {
      const only = Array.from(tenant_names_seen)[0];
      if (only !== display_name && display_name !== '공실') {
        display_name = `${display_name} (전: ${only})`;
      } else if (only !== display_name && display_name === '공실') {
        display_name = `${only} (전출)`;
      }
    }

    const isAllPaid = months.every(m => r.payments && r.payments[m] && r.payments[m].paid);
    rows.push({
      room_number: Number(rNum),
      tenant_name: display_name,
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
export function exportVatCSV() {
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

// ── 전출자 1년 보존 이력 조회 모달 ──
export async function openTenantHistoryModal() {
  const container = document.getElementById('tenantHistoryListContainer');
  if (!container) return;
  container.innerHTML = '<div class="py-6 text-center text-slate-400 text-xs">전출자 이력을 조회하고 있습니다...</div>';
  openModal('tenantHistoryModal');

  try {
    if (state.isOnline) {
      const res = await apiGetTenantHistories(state.currentBranch);
      state.tenantHistories = res.histories || [];
    }
  } catch (e) {
    console.warn("전출자 이력 API 조회 실패, 로컬 캐시 사용:", e);
  }

  if (!state.tenantHistories || state.tenantHistories.length === 0) {
    container.innerHTML = '<div class="py-8 text-center text-slate-500 text-xs">최근 1년 이내 전출된 세입자 이력이 없습니다.</div>';
    return;
  }

  let html = '';
  state.tenantHistories.forEach(h => {
    html += `
      <div class="p-3.5 rounded-xl bg-surface-850 border border-slate-800 text-xs space-y-2">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="font-mono font-bold text-cyan-300 text-sm px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800">${h.room_number}호</span>
            <span class="font-bold text-slate-100 text-sm">${h.name}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">전출 세입자</span>
          </div>
          <span class="text-[11px] text-slate-400 font-mono">1년 보존기한: <strong class="text-emerald-400 font-bold">${h.retention_until || '-'}</strong></span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300 pt-2 border-t border-slate-800">
          <div><span class="text-slate-500 block">연락처</span> ${h.phone || '-'}</div>
          <div><span class="text-slate-500 block">임대조건</span> ${h.lease_type || '월세'} / ${Number(h.rent || 0).toLocaleString()}원</div>
          <div><span class="text-slate-500 block">보증금</span> ${Number(h.deposit || 0).toLocaleString()}원</div>
          <div><span class="text-slate-500 block">거주기간</span> ${h.move_in || '-'} ~ ${h.move_out || '-'}</div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// ── 신규 부동산(건물) 추가 모달 ──
export function openNewBranchModal() {
  document.getElementById('newBranchId').value = `branch_${Date.now().toString().slice(-4)}`;
  document.getElementById('newBranchName').value = '';
  document.getElementById('newBranchAddress').value = '';
  openModal('newBranchModal');
}

export async function handleNewBranchSubmit(e) {
  e.preventDefault();
  const bId = document.getElementById('newBranchId').value.trim();
  const bName = document.getElementById('newBranchName').value.trim();
  const bAddr = document.getElementById('newBranchAddress').value.trim();

  if (!bId || !bName) {
    alert("건물 식별 ID와 이름을 입력해주세요.");
    return;
  }

  const payload = {
    branch_id: bId,
    name: bName,
    address: bAddr,
    fee_plan: "원룸 프리미엄 29실형",
    monthly_fee: 150000
  };

  try {
    if (state.isOnline) {
      await apiCreateBranch(payload);
    } else {
      state.branches.push({
        branch_id: bId,
        name: bName,
        address: bAddr,
        billing_status: 'PAID'
      });
    }
    saveLocalFallback();
    closeModal('newBranchModal');
    await switchBranch(bId);
    alert(`신규 부동산 [${bName}]이(가) 등록되고 선택되었습니다.`);
  } catch (err) {
    alert("부동산 등록 실패: " + err.message);
  }
}

