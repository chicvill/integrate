/**
 * apps/studycafe/frontend/js/branches.js
 * MQnet StudyCafe Headquarters Branch & SaaS Subscription Billing Controller.
 * Supports Multi-Branch management, Role Upgrade Approval & Dynamic Admin Login routing.
 */

const API_BASE = '/api/studycafe';

let branchesList = [];
let upgradeRequests = [];
let searchKeyword = '';
let billingFilter = '';
let activeFilter = '';

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const t = document.createElement('div');
  t.style.cssText = `
    padding: 0.75rem 1.2rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    color: #fff;
    background: ${type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#3b82f6')};
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: all 0.3s ease;
  `;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(-6px)';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// ── 🏢 매장 & 수납 관리 ──
async function loadBranches() {
  try {
    const res = await fetch(`${API_BASE}/branches/?_t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
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
  if (!tbody) return;

  const filtered = getFilteredBranches();
  tbody.innerHTML = '';

  for (const b of filtered) {
    const tr = document.createElement('tr');
    const billingStatus = b.billing_status || 'PAID';
    const badgeClass = billingStatus === 'PAID' ? 'badge-paid' : (billingStatus === 'PENDING' ? 'badge-pending' : 'badge-overdue');
    const statusText = billingStatus === 'PAID' ? '완납 ✅' : (billingStatus === 'PENDING' ? '결제 대기 ⏳' : '연체/미납 🚨');
    const activeText = b.is_active ? '🟢 가동중' : '🔴 정지/점검';
    const feeStr = '₩ ' + (b.monthly_fee || 150000).toLocaleString();
    const seatUsageStr = `${b.occupied_seats || 0} / ${b.total_seats}석 (잔여 ${b.available_seats || 0}석)`;

    tr.innerHTML = `
      <td><strong><code>${escapeHtml(b.branch_id)}</code></strong></td>
      <td>
        <strong style="font-size:0.95rem; color:#fff;">${escapeHtml(b.name)}</strong>
      </td>
      <td><span style="color:#38bdf8; font-weight:700;">${seatUsageStr}</span></td>
      <td>
        <div>${escapeHtml(b.contact_phone || '-')}</div>
        <small style="color: #94a3b8;">${escapeHtml(b.address || '-')}</small>
      </td>
      <td>${escapeHtml(b.fee_plan || '프리미엄 관리형')}</td>
      <td><strong>${feeStr}</strong></td>
      <td>
        <span class="${badgeClass}">${statusText}</span>
      </td>
      <td>
        <div>매월 ${b.billing_due_day || 25}일</div>
        <small style="color: #94a3b8;">${escapeHtml(b.last_paid_at || '-')}</small>
      </td>
      <td><code>${escapeHtml(b.relay_host || '127.0.0.1')}:${b.relay_port || 8080}</code></td>
      <td><span style="font-size:0.8rem; font-weight:700;">${activeText}</span></td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-secondary btn-xs toggle-pay-btn" title="수납 상태 전환">
            ${billingStatus === 'PAID' ? '미납처리' : '완납확인'}
          </button>
          <a href="./admin.html?branch=${encodeURIComponent(b.branch_id)}" class="btn btn-primary btn-xs" style="text-decoration:none;">
            현장관제
          </a>
          <button class="btn btn-secondary btn-xs edit-btn">수정</button>
          <button class="btn btn-danger btn-xs delete-btn">삭제</button>
        </div>
      </td>
    `;

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
    const res = await fetch(`${API_BASE}/branches/${encodeURIComponent(branch.branch_id)}/billing`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billing_status: next })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast(`매장 '${branch.name}'의 수납 상태가 [${label}] 처리되었습니다.`, 'success');
    await loadBranches();
  } catch (err) {
    showToast('수납 상태 변경 실패: ' + err.message, 'error');
  }
}

async function handleDeleteBranch(branch) {
  if (!confirm(`정말로 매장 '${branch.name}' (${branch.branch_id})을(를) 영구 삭제하시겠습니까?\n가맹 계약 해지 처리됩니다.`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/branches/${encodeURIComponent(branch.branch_id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast(`매장 '${branch.name}'이(가) 삭제되었습니다.`, 'info');
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
  const seatsInput = document.getElementById('totalSeats');
  const phoneInput = document.getElementById('branchPhone');
  const addressInput = document.getElementById('branchAddress');
  const feePlanSelect = document.getElementById('feePlan');
  const monthlyFeeInput = document.getElementById('monthlyFee');
  const dueDayInput = document.getElementById('billingDueDay');
  const billingStatusSelect = document.getElementById('billingStatusSelect');
  const relayHostInput = document.getElementById('relayHost');
  const relayPortInput = document.getElementById('relayPort');

  if (branch) {
    titleElem.textContent = '매장 정보 및 설정 수정';
    editIdInput.value = branch.branch_id;
    codeInput.value = branch.branch_id;
    codeInput.disabled = true;
    nameInput.value = branch.name || '';
    seatsInput.value = branch.total_seats || 20;
    phoneInput.value = branch.contact_phone || '';
    addressInput.value = branch.address || '';
    feePlanSelect.value = branch.fee_plan || '프리미엄 관리형';
    monthlyFeeInput.value = branch.monthly_fee || 150000;
    dueDayInput.value = branch.billing_due_day || 25;
    billingStatusSelect.value = branch.billing_status || 'PAID';
    relayHostInput.value = branch.relay_host || '192.168.1.100';
    relayPortInput.value = branch.relay_port || 8080;
  } else {
    titleElem.textContent = '신규 매장(가맹점) 등록';
    editIdInput.value = '';
    codeInput.value = '';
    codeInput.disabled = false;
    nameInput.value = '';
    seatsInput.value = 20;
    phoneInput.value = '';
    addressInput.value = '';
    feePlanSelect.value = '프리미엄 관리형';
    monthlyFeeInput.value = 150000;
    dueDayInput.value = 25;
    billingStatusSelect.value = 'PAID';
    relayHostInput.value = '192.168.1.100';
    relayPortInput.value = 8080;
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
  const total_seats = parseInt(document.getElementById('totalSeats').value, 10) || 20;
  const contact_phone = document.getElementById('branchPhone').value.trim();
  const address = document.getElementById('branchAddress').value.trim();
  const fee_plan = document.getElementById('feePlan').value;
  const monthly_fee = parseInt(document.getElementById('monthlyFee').value, 10) || 150000;
  const billing_due_day = parseInt(document.getElementById('billingDueDay').value, 10) || 25;
  const billing_status = document.getElementById('billingStatusSelect').value;
  const relay_host = document.getElementById('relayHost').value.trim() || '127.0.0.1';
  const relay_port = parseInt(document.getElementById('relayPort').value, 10) || 8080;

  if (!branch_id || !name) {
    showToast('매장 코드와 매장명을 입력해주세요.', 'error');
    return;
  }

  const payload = {
    branch_id,
    name,
    total_seats,
    contact_phone,
    address,
    fee_plan,
    monthly_fee,
    billing_due_day,
    billing_status,
    relay_host,
    relay_port
  };

  try {
    if (editId) {
      const res = await fetch(`${API_BASE}/branches/${encodeURIComponent(editId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`매장 '${name}' 정보가 수정되었습니다.`, 'success');
    } else {
      const res = await fetch(`${API_BASE}/branches/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`신규 매장 '${name}'이(가) 등록되었습니다.`, 'success');
    }
    closeBranchModal();
    await loadBranches();
  } catch (err) {
    showToast('저장 실패: ' + err.message, 'error');
  }
}

// ── 👥 점주/실장 등업 신청 관리 ──
async function loadUpgradeRequests() {
  try {
    const res = await fetch(`${API_BASE}/auth/upgrade/requests?_t=${Date.now()}`);
    if (!res.ok) return;
    const data = await res.json();
    upgradeRequests = data.requests || [];
    renderUpgrades();
  } catch (err) {
    console.warn('등업 목록 로드 안내:', err);
  }
}

function renderUpgrades() {
  const tbody = document.getElementById('upgradeTableBody');
  const badge = document.getElementById('badgePendingUpgrades');
  if (!tbody) return;

  tbody.innerHTML = '';
  const pendingCount = upgradeRequests.filter(r => r.upgrade_status === 'PENDING').length;

  if (badge) {
    badge.textContent = pendingCount;
    badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }

  if (upgradeRequests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">대기 중인 등업 신청이 없습니다.</td></tr>`;
    return;
  }

  for (const r of upgradeRequests) {
    const tr = document.createElement('tr');
    const isPending = r.upgrade_status === 'PENDING';
    const statusBadge = isPending 
      ? '<span class="badge-pending">검토 대기 ⏳</span>'
      : (r.upgrade_status === 'APPROVED' ? '<span class="badge-paid">승인 완료 ✅</span>' : '<span class="badge-overdue">반려됨 ❌</span>');

    tr.innerHTML = `
      <td><strong>${escapeHtml(r.name)}</strong></td>
      <td>${escapeHtml(r.phone)}</td>
      <td><code>${escapeHtml(r.role)}</code></td>
      <td><span style="color:#38bdf8; font-weight:700;">${escapeHtml(r.target_branch_id || 'studycafe-main')}</span></td>
      <td><small>${escapeHtml(r.reason || '-')}</small></td>
      <td><small style="color: var(--text-muted);">${escapeHtml(r.created_at || '-')}</small></td>
      <td>${statusBadge}</td>
      <td>
        <div class="actions-cell">
          ${isPending ? `
            <button class="btn btn-primary btn-xs approve-btn">승인</button>
            <button class="btn btn-danger btn-xs reject-btn">반려</button>
          ` : `<span style="font-size:0.75rem; color:var(--text-muted);">${r.assigned_branch_id || '-'}</span>`}
        </div>
      </td>
    `;

    tr.querySelector('.approve-btn')?.addEventListener('click', () => handleApproveUpgrade(r));
    tr.querySelector('.reject-btn')?.addEventListener('click', () => handleRejectUpgrade(r));

    tbody.appendChild(tr);
  }
}

async function handleApproveUpgrade(req) {
  if (!confirm(`'${req.name}'님을 '${req.target_branch_id}' 지점 점주(branch_admin)로 승인하시겠습니까?`)) return;

  try {
    const res = await fetch(`${API_BASE}/auth/upgrade/requests/${req.user_id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_branch_id: req.target_branch_id })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast(`'${req.name}'님이 '${req.target_branch_id}' 점주로 승격되었습니다.`, 'success');
    await loadUpgradeRequests();
  } catch (err) {
    showToast('승인 실패: ' + err.message, 'error');
  }
}

async function handleRejectUpgrade(req) {
  if (!confirm(`'${req.name}'님의 등업 신청을 반려하시겠습니까?`)) return;

  try {
    const res = await fetch(`${API_BASE}/auth/upgrade/requests/${req.user_id}/reject`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast(`등업 신청이 반려되었습니다.`, 'info');
    await loadUpgradeRequests();
  } catch (err) {
    showToast('반려 실패: ' + err.message, 'error');
  }
}

// ── 🔑 관리자 로그인 & 지점 자동 분기 테스트 ──
async function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!username || !password) {
    showToast('아이디와 비밀번호를 입력해주세요.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    showToast(`${data.user.name}님 로그인 성공! 전용 페이지로 이동합니다.`, 'success');

    // 사용자 정보 로컬스토리지 저장
    localStorage.setItem('studycafe_user', JSON.stringify(data.user));
    localStorage.setItem('studycafe_assigned_branch', data.user.assigned_branch_id || '');

    // 🎯 역할 및 지점에 따른 전용 페이지 자동 이동!
    setTimeout(() => {
      window.location.href = data.redirect_url;
    }, 600);
  } catch (err) {
    showToast('로그인 실패: ' + err.message, 'error');
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
  document.getElementById('closeBranchModalBtn')?.addEventListener('click', closeBranchModal);
  document.getElementById('cancelBranchModalBtn')?.addEventListener('click', closeBranchModal);
  document.getElementById('branchForm')?.addEventListener('submit', handleSaveBranch);

  // 로그인 모달
  const loginModal = document.getElementById('loginModal');
  document.getElementById('btnOpenLoginModal')?.addEventListener('click', () => {
    if (loginModal) loginModal.style.display = 'flex';
  });
  document.getElementById('closeLoginModalBtn')?.addEventListener('click', () => {
    if (loginModal) loginModal.style.display = 'none';
  });
  document.getElementById('cancelLoginModalBtn')?.addEventListener('click', () => {
    if (loginModal) loginModal.style.display = 'none';
  });
  document.getElementById('adminLoginForm')?.addEventListener('submit', handleAdminLogin);

  // 탭 전환
  const tabBranchesBtn = document.getElementById('tabBranchesBtn');
  const tabUpgradesBtn = document.getElementById('tabUpgradesBtn');
  const sectionBranches = document.getElementById('sectionBranches');
  const sectionUpgrades = document.getElementById('sectionUpgrades');

  tabBranchesBtn?.addEventListener('click', () => {
    tabBranchesBtn.className = 'btn btn-primary btn-sm';
    tabUpgradesBtn.className = 'btn btn-secondary btn-sm';
    sectionBranches.style.display = 'block';
    sectionUpgrades.style.display = 'none';
  });

  tabUpgradesBtn?.addEventListener('click', () => {
    tabUpgradesBtn.className = 'btn btn-primary btn-sm';
    tabBranchesBtn.className = 'btn btn-secondary btn-sm';
    sectionBranches.style.display = 'none';
    sectionUpgrades.style.display = 'block';
    loadUpgradeRequests();
  });

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

  loadBranches();
  loadUpgradeRequests();
});
