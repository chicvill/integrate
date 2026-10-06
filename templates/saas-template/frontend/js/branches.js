/**
 * templates/saas-template/frontend/js/branches.js
 * Controller for Branch CRUD and SaaS Subscription Billing Management.
 */

import { MQnetAuth } from '/shared/ui/auth.js?v=2.0';
import { getApiBase, fetchWithAuth, fetchBranches, createBranch, updateBranch, updateBranchBilling, deleteBranch } from './api.js?v=2.0';
import { showToast } from './ui.js?v=2.0';

const API_BASE = getApiBase('{{APP_ID}}');

let branchesList = [];
let searchKeyword = '';
let billingFilter = '';
let activeFilter = '';

async function loadBranches() {
  try {
    const data = await fetchBranches(API_BASE);
    branchesList = data.branches || [];
    render();
  } catch (err) {
    showToast('매장 목록 로드 실패: ' + err.message, 'error');
  }
}

function getFilteredBranches() {
  return branchesList.filter(b => {
    const matchSearch = !searchKeyword || 
      b.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      b.branch_id.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      (b.address && b.address.toLowerCase().includes(searchKeyword.toLowerCase()));
    
    const matchBilling = !billingFilter || (b.billing_status || 'PAID') === billingFilter;
    const matchActive = !activeFilter || String(b.is_active) === activeFilter;

    return matchSearch && matchBilling && matchActive;
  });
}

function updateKpis() {
  const total = branchesList.length;
  const active = branchesList.filter(b => b.is_active).length;
  const overdue = branchesList.filter(b => (b.billing_status || 'PAID') === 'OVERDUE').length;

  let collected = 0;
  for (const b of branchesList) {
    if ((b.billing_status || 'PAID') === 'PAID') {
      collected += (b.monthly_fee || 150000);
    }
  }

  const kpiTotal = document.getElementById('kpiTotalBranches');
  const kpiActive = document.getElementById('kpiActiveBranches');
  const kpiCollected = document.getElementById('kpiCollectedAmount');
  const kpiOverdue = document.getElementById('kpiOverdueBranches');

  if (kpiTotal) kpiTotal.textContent = total;
  if (kpiActive) kpiActive.textContent = active;
  if (kpiCollected) kpiCollected.textContent = '₩ ' + collected.toLocaleString();
  if (kpiOverdue) kpiOverdue.textContent = overdue;
}

function render() {
  const tbody = document.getElementById('branchTableBody');
  const emptyState = document.getElementById('emptyBranchState');
  if (!tbody) return;

  const filtered = getFilteredBranches();
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
  } else {
    if (emptyState) emptyState.style.display = 'none';
  }

  for (const b of filtered) {
    const tr = document.createElement('tr');
    const billingStatus = b.billing_status || 'PAID';
    const badgeClass = billingStatus === 'PAID' ? 'badge-paid' : (billingStatus === 'PENDING' ? 'badge-pending' : 'badge-overdue');
    const statusText = billingStatus === 'PAID' ? '완납 ✅' : (billingStatus === 'PENDING' ? '결제 대기 ⏳' : '연체/미납 🚨');
    const activeText = b.is_active ? '🟢 운영중' : '🔴 정지/점검';
    const feeStr = '₩ ' + (b.monthly_fee || 150000).toLocaleString();

    tr.innerHTML = `
      <td><strong><code>${escapeHtml(b.branch_id)}</code></strong></td>
      <td>
        <strong>${escapeHtml(b.name)}</strong>
      </td>
      <td>
        <div>${escapeHtml(b.contact_phone || '-')}</div>
        <small style="color: var(--text-muted);">${escapeHtml(b.address || '-')}</small>
      </td>
      <td>${escapeHtml(b.fee_plan || '프리미엄 관리형')}</td>
      <td><strong>${feeStr}</strong></td>
      <td>
        <span class="${badgeClass}">${statusText}</span>
      </td>
      <td>
        <div>매월 ${b.billing_due_day || 25}일</div>
        <small style="color: var(--text-muted);">${escapeHtml(b.last_paid_at || '-')}</small>
      </td>
      <td>
        <span style="font-size: 0.8rem; font-weight: 600;">${activeText}</span>
      </td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-secondary btn-xs toggle-pay-btn" title="수납 상태 완납/미납 전환">
            ${billingStatus === 'PAID' ? '미납처리' : '완납확인'}
          </button>
          <a href="./index.html?branch=${encodeURIComponent(b.branch_id)}" class="btn btn-primary btn-xs" style="text-decoration: none;">
            관제
          </a>
          <button class="btn btn-secondary btn-xs edit-btn">수정</button>
          <button class="btn btn-danger btn-xs delete-btn">삭제</button>
        </div>
      </td>
    `;

    // 이벤트 리스너 바인딩
    tr.querySelector('.toggle-pay-btn')?.addEventListener('click', () => handleTogglePayment(b));
    tr.querySelector('.edit-btn')?.addEventListener('click', () => openBranchModal(b));
    tr.querySelector('.delete-btn')?.addEventListener('click', () => handleDeleteBranch(b));

    tbody.appendChild(tr);
  }

  updateKpis();
}

async function handleTogglePayment(branch) {
  const current = branch.billing_status || 'PAID';
  const next = current === 'PAID' ? 'OVERDUE' : 'PAID';
  const label = next === 'PAID' ? '완납' : '미납/연체';

  try {
    await updateBranchBilling(API_BASE, branch.branch_id, next);
    showToast(`매장 '${branch.name}'의 수납 상태가 [${label}] 처리되었습니다.`, 'success');
    await loadBranches();
  } catch (err) {
    showToast('수납 상태 변경 실패: ' + err.message, 'error');
  }
}

async function handleDeleteBranch(branch) {
  if (!confirm(`정말로 매장 '${branch.name}' (${branch.branch_id})을(를) 삭제하시겠습니까?\n이 매장의 데이터 및 계약이 해지 처리됩니다.`)) {
    return;
  }

  try {
    await deleteBranch(API_BASE, branch.branch_id);
    showToast(`매장 '${branch.name}'이(가) 성공적으로 삭제되었습니다.`, 'info');
    await loadBranches();
  } catch (err) {
    showToast('매장 삭제 실패: ' + err.message, 'error');
  }
}

function openBranchModal(branch = null) {
  const modal = document.getElementById('branchModal');
  const titleElem = document.getElementById('branchModalTitle');
  const editIdInput = document.getElementById('editBranchId');
  const codeInput = document.getElementById('branchCode');
  const nameInput = document.getElementById('branchName');
  const phoneInput = document.getElementById('branchPhone');
  const addressInput = document.getElementById('branchAddress');
  const feePlanSelect = document.getElementById('feePlan');
  const monthlyFeeInput = document.getElementById('monthlyFee');
  const dueDayInput = document.getElementById('billingDueDay');
  const billingStatusSelect = document.getElementById('billingStatusSelect');
  const isActiveSelect = document.getElementById('isActiveSelect');

  if (branch) {
    titleElem.textContent = '매장 정보 수정';
    editIdInput.value = branch.branch_id;
    codeInput.value = branch.branch_id;
    codeInput.disabled = true; // 코드는 수정 불가
    nameInput.value = branch.name || '';
    phoneInput.value = branch.contact_phone || '';
    addressInput.value = branch.address || '';
    feePlanSelect.value = branch.fee_plan || '프리미엄 관리형';
    monthlyFeeInput.value = branch.monthly_fee || 150000;
    dueDayInput.value = branch.billing_due_day || 25;
    billingStatusSelect.value = branch.billing_status || 'PAID';
    isActiveSelect.value = String(branch.is_active);
  } else {
    titleElem.textContent = '신규 매장(가맹점) 등록';
    editIdInput.value = '';
    codeInput.value = '';
    codeInput.disabled = false;
    nameInput.value = '';
    phoneInput.value = '';
    addressInput.value = '';
    feePlanSelect.value = '프리미엄 관리형';
    monthlyFeeInput.value = 150000;
    dueDayInput.value = 25;
    billingStatusSelect.value = 'PAID';
    isActiveSelect.value = 'true';
  }

  if (modal) modal.style.display = 'flex';
}

function closeBranchModal() {
  const modal = document.getElementById('branchModal');
  if (modal) modal.style.display = 'none';
}

async function handleSaveBranch(e) {
  e.preventDefault();
  const editId = document.getElementById('editBranchId').value;
  const branch_id = document.getElementById('branchCode').value.trim();
  const name = document.getElementById('branchName').value.trim();
  const contact_phone = document.getElementById('branchPhone').value.trim();
  const address = document.getElementById('branchAddress').value.trim();
  const fee_plan = document.getElementById('feePlan').value;
  const monthly_fee = parseInt(document.getElementById('monthlyFee').value, 10) || 150000;
  const billing_due_day = parseInt(document.getElementById('billingDueDay').value, 10) || 25;
  const billing_status = document.getElementById('billingStatusSelect').value;
  const is_active = document.getElementById('isActiveSelect').value === 'true';

  if (!branch_id || !name) {
    showToast('매장 코드와 매장명을 입력해주세요.', 'warning');
    return;
  }

  const payload = {
    branch_id,
    name,
    contact_phone,
    address,
    fee_plan,
    monthly_fee,
    billing_due_day,
    billing_status,
    is_active
  };

  try {
    if (editId) {
      await updateBranch(API_BASE, editId, payload);
      showToast(`매장 '${name}'의 정보가 수정되었습니다.`, 'success');
    } else {
      await createBranch(API_BASE, payload);
      showToast(`신규 매장 '${name}'이(가) 등록되었습니다.`, 'success');
    }
    closeBranchModal();
    await loadBranches();
  } catch (err) {
    showToast('저장 실패: ' + err.message, 'error');
  }
}

async function checkSystemStatus() {
  const beacon = document.getElementById('systemStatusBeacon');
  const textElem = document.getElementById('systemStatusText');
  try {
    const status = await fetchWithAuth(`${API_BASE}/status`);
    if (textElem) textElem.textContent = 'ONLINE 🟢';
    if (beacon) beacon.querySelector('.status-dot').className = 'status-dot online';
  } catch (err) {
    if (textElem) textElem.textContent = 'OFFLINE 🔴';
    if (beacon) beacon.querySelector('.status-dot').className = 'status-dot';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
  // 모달 버튼들
  document.getElementById('openNewBranchBtn')?.addEventListener('click', () => openBranchModal(null));
  document.getElementById('emptyNewBranchBtn')?.addEventListener('click', () => openBranchModal(null));
  document.getElementById('closeBranchModalBtn')?.addEventListener('click', closeBranchModal);
  document.getElementById('cancelBranchModalBtn')?.addEventListener('click', closeBranchModal);
  document.getElementById('branchForm')?.addEventListener('submit', handleSaveBranch);

  // 검색 & 필터
  document.getElementById('branchSearchInput')?.addEventListener('input', (e) => {
    searchKeyword = e.target.value.trim();
    render();
  });
  document.getElementById('billingFilter')?.addEventListener('change', (e) => {
    billingFilter = e.target.value;
    render();
  });
  document.getElementById('activeFilter')?.addEventListener('change', (e) => {
    activeFilter = e.target.value;
    render();
  });

  // 통합 인증 배지
  MQnetAuth.init({
    appId: '{{APP_ID}}',
    onAuthChange: () => MQnetAuth.renderBadge('userAuthBadge')
  });
  MQnetAuth.renderBadge('userAuthBadge');

  checkSystemStatus();
  loadBranches();
});
