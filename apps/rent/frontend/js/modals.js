/**
 * apps/rent/frontend/js/modals.js
 * 원룸 임차료 관리 시스템 모달 팝업 및 계약/지출 폼 제어 모듈.
 */

import { state, formattedToday, saveLocalFallback } from './state.js?v=2.0';
import { apiUpdateContract, apiCreateExpense, apiRequestUpgrade } from './api.js?v=2.0';
import { renderAll } from './ui.js?v=2.0';

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
