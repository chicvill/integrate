/**
 * templates/saas-template/frontend/js/branches.js
 * Controller for Branch CRUD, Subscription Billing, Role Upgrade Approval & Dynamic Admin Login routing.
 */

import { MQnetAuth } from '/shared/ui/auth.js?v=2.0';
import { getApiBase, fetchWithAuth, fetchBranches, createBranch, updateBranch, updateBranchBilling, deleteBranch } from './api.js?v=2.0';
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer') || document.body;
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,0.3);color:#fff;' + (type === 'error' ? 'background:#ef4444;' : 'background:#10b981;');
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

const API_BASE = getApiBase('rent');

let branchesList = [];
let upgradeRequests = [];
let searchKeyword = '';
let billingFilter = '';
let activeFilter = '';

async function loadBranches() {
  try {
    const data = await fetchBranches();
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
          <button class="btn btn-secondary btn-xs export-btn" title="이 건물의 모든 계약/장부/지출 데이터를 JSON으로 추출하여 새 서버로 전송">
            💾 추출
          </button>
          <button class="btn btn-secondary btn-xs edit-btn">수정</button>
          <button class="btn btn-danger btn-xs delete-btn">삭제</button>
        </div>
      </td>
    `;

    tr.querySelector('.toggle-pay-btn')?.addEventListener('click', () => handleTogglePayment(b));
    tr.querySelector('.export-btn')?.addEventListener('click', () => handleExportBuilding(b));
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

/**
 * 특정 건물 데이터 패키지 JSON 다운로드 추출 (Export)
 */
async function handleExportBuilding(branch) {
  try {
    showToast(`'${branch.name}' 건물 전체 데이터 패키지 추출 중...`, 'info');
    const res = await fetch(`${API_BASE}/buildings/${encodeURIComponent(branch.branch_id)}/export`);
    if (!res.ok) throw new Error(`추출 실패 (HTTP ${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (branch.name || branch.branch_id).replace(/[^a-zA-Z0-9가-힣]/g, '_');
    a.download = `building_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`🎉 '${branch.name}' 데이터 추출 완료! (JSON 파일 다운로드됨)`, 'success');
  } catch (err) {
    showToast('데이터 추출 오류: ' + err.message, 'error');
  }
}

/**
 * 외부에서 추출한 건물 JSON 데이터를 현재 서버에 복원 (Import)
 */
function handleImportBuildingModal() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      showToast('건물 데이터 파일 분석 중...', 'info');
      const text = await file.text();
      const jsonData = JSON.parse(text);

      const targetBranchId = prompt('가져온 데이터를 적용할 건물 ID를 입력하세요 (새 서버 기본값은 main):', 'main');
      if (!targetBranchId) return;

      if (!confirm(`주의: '${targetBranchId}' 건물의 기존 호실 및 장부 데이터가 파일 내용으로 완전 대체됩니다. 진행하시겠습니까?`)) {
        return;
      }

      showToast('서버로 데이터 전송 및 복원 중...', 'info');
      const res = await fetch(`${API_BASE}/buildings/${encodeURIComponent(targetBranchId)}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonData)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }

      const resData = await res.json();
      showToast(resData.message || '건물 데이터가 성공적으로 복원되었습니다!', 'success');
      await loadBranches();
    } catch (err) {
      showToast('데이터 복원 실패: ' + err.message, 'error');
    }
  };
  input.click();
}

/**
 * 100% 공실 상태의 신규 건물로 완전 클린 초기화 (Clean Reset)
 */
async function handleResetCleanBuilding() {
  const newName = prompt('신규 설치할 건물의 이름을 입력하세요:', '시크빌 신규 빌딩');
  if (!newName) return;

  const targetBranchId = prompt('초기화할 건물 ID를 입력하세요 (새 서버는 main 권장):', 'main');
  if (!targetBranchId) return;

  if (!confirm(`경고: '${targetBranchId}' (${newName}) 건물의 모든 계약 및 장부를 완전히 비우고 100% 공실 상태로 초기화합니다. 계속하시겠습니까?`)) {
    return;
  }

  try {
    showToast(`'${newName}' 건물 100% 공실 클린 초기화 중...`, 'info');
    const res = await fetch(`${API_BASE}/buildings/${encodeURIComponent(targetBranchId)}/reset?new_name=${encodeURIComponent(newName)}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`초기화 실패 (HTTP ${res.status})`);
    const resData = await res.json();
    showToast(resData.message || '신규 건물 클린 초기화 완료!', 'success');
    await loadBranches();
  } catch (err) {
    showToast('초기화 오류: ' + err.message, 'error');
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
    codeInput.disabled = true;
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

// ── 👥 점주/실장 등업 신청 관리 ──
async function loadUpgradeRequests() {
  try {
    const data = await fetchWithAuth(`${API_BASE}/auth/upgrade/requests`);
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
  const pendingCount = upgradeRequests.filter(r => r.status === 'PENDING').length;

  if (badge) {
    badge.textContent = pendingCount;
    badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }

  if (upgradeRequests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">대기 중인 등업 신청이 없습니다.</td></tr>`;
    return;
  }

  for (const r of upgradeRequests) {
    const tr = document.createElement('tr');
    const isPending = r.status === 'PENDING';
    const statusBadge = isPending 
      ? '<span class="badge-pending">검토 대기 ⏳</span>' 
      : (r.status === 'APPROVED' ? '<span class="badge-paid">승인 완료 ✅</span>' : '<span class="badge-overdue">반려됨 ❌</span>');

    tr.innerHTML = `
      <td><strong>${escapeHtml(r.user_name)}</strong></td>
      <td>${escapeHtml(r.contact)}</td>
      <td><span style="color:#38bdf8; font-weight:700;">${escapeHtml(r.target_branch_id)}</span></td>
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
  if (!confirm(`'${req.user_name}'님을 '${req.target_branch_id}' 지점 점주(branch_admin)로 승인하시겠습니까?`)) return;

  try {
    await fetchWithAuth(`${API_BASE}/auth/upgrade/requests/${req.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ assigned_branch_id: req.target_branch_id })
    });
    showToast(`'${req.user_name}'님이 '${req.target_branch_id}' 점주로 승격되었습니다.`, 'success');
    await loadUpgradeRequests();
  } catch (err) {
    showToast('승인 실패: ' + err.message, 'error');
  }
}

async function handleRejectUpgrade(req) {
  if (!confirm(`'${req.user_name}'님의 등업 신청을 반려하시겠습니까?`)) return;

  try {
    await fetchWithAuth(`${API_BASE}/auth/upgrade/requests/${req.id}/reject`, {
      method: 'POST'
    });
    showToast(`등업 신청이 반려되었습니다.`, 'info');
    await loadUpgradeRequests();
  } catch (err) {
    showToast('반려 실패: ' + err.message, 'error');
  }
}

// ── 🛡️ 본사 최고관리자(superadmin) 보안 게이트웨이 & 세션 검증 ──
function getStoredUser() {
  try {
    const u = JSON.parse(localStorage.getItem('RENT_ADMIN_AUTH_V1') || 'null');
    if (u && u.username) return u;
  } catch (_) {}
  try {
    const s = JSON.parse(localStorage.getItem('saas_user') || 'null');
    if (s && s.username) return s;
  } catch (_) {}
  return null;
}

function verifySuperadminGate() {
  const gate = document.getElementById('hqSecurityGate');
  const loginForm = document.getElementById('hqLoginForm');
  const branchAdminCard = document.getElementById('hqBranchAdminCard');
  const branchAdminMsg = document.getElementById('hqBranchAdminMsg');
  const badgeContainer = document.getElementById('hqAdminBadgeContainer');

  const user = getStoredUser();

  if (user && user.role === 'superadmin') {
    // 👑 본사 최고관리자(admin): 게이트 통과 & 전권 활성화
    if (gate) gate.style.display = 'none';
    if (badgeContainer) {
      badgeContainer.innerHTML = `
        <div class="flex items-center gap-2 bg-gradient-to-r from-purple-950/80 to-indigo-950/80 border border-purple-500/60 px-3 py-1.5 rounded-xl text-xs shadow-sm">
          <span class="text-sm">👑</span>
          <span class="font-bold text-purple-200">본사 총괄: <strong>${user.name || user.username}</strong> <span class="text-[10px] text-purple-400 font-mono">(전권 관제)</span></span>
          <button type="button" id="btnHqLogout" class="ml-1 text-[11px] text-rose-300 hover:text-rose-100 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/50 px-2 py-0.5 rounded-lg transition cursor-pointer">
            로그아웃
          </button>
        </div>
      `;
      document.getElementById('btnHqLogout')?.addEventListener('click', () => {
        localStorage.removeItem('RENT_ADMIN_AUTH_V1');
        localStorage.removeItem('saas_user');
        localStorage.removeItem('mqnet_auth_token');
        showToast('로그아웃되었습니다.', 'info');
        setTimeout(() => window.location.reload(), 400);
      });
    }
    loadBranches();
    loadUpgradeRequests();
    return true;
  }

  // Not superadmin: 본사 센터 잠금 및 접근 차단
  if (gate) gate.style.display = 'flex';
  if (badgeContainer) badgeContainer.innerHTML = '';

  if (user && user.role === 'branch_admin') {
    // 지점 점주 계정으로 접근 시: 권한 부족 알림
    if (loginForm) loginForm.style.display = 'none';
    if (branchAdminCard) {
      branchAdminCard.classList.remove('hidden');
      branchAdminCard.style.display = 'block';
    }
    if (branchAdminMsg) {
      branchAdminMsg.innerHTML = `
        현재 <strong>${user.name}</strong> (${user.username}) 님은 <strong>지점 점주(실장)</strong> 계정입니다.<br>
        가맹점 등록/삭제, SaaS 월이용료 수납 및 점주 가입 승인은 <strong>본사 총괄 최고관리자(admin)</strong>만 권한을 가집니다.
      `;
    }
    const targetBranch = user.branch_id || 'main';
    document.getElementById('btnGoToMyBranch')?.addEventListener('click', () => {
      window.location.href = `./index.html?branch=${encodeURIComponent(targetBranch)}`;
    });
    document.getElementById('btnReloginAsAdmin')?.addEventListener('click', () => {
      localStorage.removeItem('RENT_ADMIN_AUTH_V1');
      localStorage.removeItem('saas_user');
      if (branchAdminCard) branchAdminCard.style.display = 'none';
      if (loginForm) loginForm.style.display = 'block';
    });
  } else {
    // 미인증: 최고관리자 로그인 폼 활성화
    if (branchAdminCard) branchAdminCard.style.display = 'none';
    if (loginForm) loginForm.style.display = 'block';
  }

  return false;
}

// ── 🔑 최고관리자 전용 로그인 처리 ──
async function handleHqLogin(e) {
  e.preventDefault();
  const username = document.getElementById('hqUsername').value.trim();
  const password = document.getElementById('hqPassword').value.trim();
  const errEl = document.getElementById('hqLoginError');

  if (!username || !password) return;

  try {
    const res = await fetchWithAuth(`${API_BASE}/auth/admin-login`, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    if (res.role !== 'superadmin') {
      throw new Error(`'${res.name}'님은 최고관리자(admin)가 아닌 지점 관리자 계정입니다.\n본사 센터는 admin 계정으로만 접근하실 수 있습니다.`);
    }

    const authUser = {
      id: res.user_id,
      username: res.username,
      name: res.name,
      role: res.role,
      branch_id: res.assigned_branch_id,
      loginAt: new Date().toISOString()
    };

    localStorage.setItem('RENT_ADMIN_AUTH_V1', JSON.stringify(authUser));
    localStorage.setItem('saas_user', JSON.stringify(authUser));
    if (res.access_token) {
      localStorage.setItem('mqnet_auth_token', res.access_token);
    }

    showToast(`👑 ${res.name}님 최고관리자 인증 완료!`, 'success');
    verifySuperadminGate();
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message || '인증에 실패했습니다.';
      errEl.classList.remove('hidden');
    }
  }
}

// ── 🔑 관리자 계정 로그인 테스트 모달 (자동 분기) ──
async function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!username || !password) {
    showToast('아이디와 비밀번호를 입력해주세요.', 'warning');
    return;
  }

  try {
    const res = await fetchWithAuth(`${API_BASE}/auth/admin-login`, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    showToast(`${res.name}님 로그인 성공! 전용 화면으로 이동합니다.`, 'success');
    const authUser = {
      id: res.user_id,
      username: res.username,
      name: res.name,
      role: res.role,
      branch_id: res.assigned_branch_id,
      loginAt: new Date().toISOString()
    };
    localStorage.setItem('RENT_ADMIN_AUTH_V1', JSON.stringify(authUser));
    localStorage.setItem('saas_user', JSON.stringify(authUser));
    if (res.access_token) {
      localStorage.setItem('mqnet_auth_token', res.access_token);
    }

    setTimeout(() => {
      window.location.href = res.redirect_url;
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
  document.getElementById('emptyNewBranchBtn')?.addEventListener('click', () => openBranchModal(null));
  document.getElementById('btnImportBuilding')?.addEventListener('click', handleImportBuildingModal);
  document.getElementById('btnResetCleanBuilding')?.addEventListener('click', handleResetCleanBuilding);
  document.getElementById('closeBranchModalBtn')?.addEventListener('click', closeBranchModal);
  document.getElementById('cancelBranchModalBtn')?.addEventListener('click', closeBranchModal);
  document.getElementById('branchForm')?.addEventListener('submit', handleSaveBranch);

  // HQ 전용 보안 게이트 폼
  document.getElementById('hqLoginForm')?.addEventListener('submit', handleHqLogin);

  // 로그인 모달 (상단 테스트용)
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
    tabBranchesBtn.className = 'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-cyan-600 text-white shadow-md shadow-cyan-950/50 transition cursor-pointer';
    tabUpgradesBtn.className = 'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-surface-800 hover:bg-surface-750 text-slate-300 border border-slate-700/80 transition cursor-pointer';
    sectionBranches.style.display = 'block';
    sectionUpgrades.style.display = 'none';
  });

  tabUpgradesBtn?.addEventListener('click', () => {
    tabUpgradesBtn.className = 'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-purple-600 text-white shadow-md shadow-purple-950/50 transition cursor-pointer';
    tabBranchesBtn.className = 'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-surface-800 hover:bg-surface-750 text-slate-300 border border-slate-700/80 transition cursor-pointer';
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

  // 본사 최고관리자 게이트 검증 및 데이터 로드
  verifySuperadminGate();
});
