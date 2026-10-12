/**
 * templates/saas-template/frontend/js/modals.js
 * Modal open/close and form management logic.
 * Supports Item modal, AI modal, and Branch create modal.
 */

export function openItemModal(item = null) {
  const modal = document.getElementById('itemModal');
  const titleElem = document.getElementById('modalTitle');
  const idInput = document.getElementById('editItemId');
  const branchSelect = document.getElementById('itemBranch');
  const titleInput = document.getElementById('itemTitle');
  const categoryInput = document.getElementById('itemCategory');
  const statusInput = document.getElementById('itemStatus');
  const detailInput = document.getElementById('itemDetail');

  if (item) {
    titleElem.textContent = '항목 수정';
    idInput.value = item.id;
    if (branchSelect) branchSelect.value = item.branch_id || 'main';
    titleInput.value = item.title || '';
    categoryInput.value = item.category || '일반';
    statusInput.value = item.status || 'active';
    detailInput.value = item.detail || '';
  } else {
    titleElem.textContent = '신규 항목 등록';
    idInput.value = '';
    titleInput.value = '';
    categoryInput.value = '일반';
    statusInput.value = 'active';
    detailInput.value = '';
  }

  modal.style.display = 'flex';
}

export function closeItemModal() {
  const modal = document.getElementById('itemModal');
  if (modal) modal.style.display = 'none';
}

export function openBranchModal() {
  const modal = document.getElementById('branchModal');
  const form = document.getElementById('branchForm');
  if (form) form.reset();
  if (modal) modal.style.display = 'flex';
}

export function closeBranchModal() {
  const modal = document.getElementById('branchModal');
  if (modal) modal.style.display = 'none';
}

export function openAiModal() {
  const modal = document.getElementById('aiModal');
  const promptInput = document.getElementById('aiPrompt');
  const resultBox = document.getElementById('aiResultBox');
  if (promptInput) promptInput.value = '';
  if (resultBox) resultBox.style.display = 'none';
  if (modal) modal.style.display = 'flex';
}

export function closeAiModal() {
  const modal = document.getElementById('aiModal');
  if (modal) modal.style.display = 'none';
}

// ── 표준 SaaS 보안 인증 게이트 & 14일 슬라이딩 세션 제어 ──
import { state, setAuthUser, clearAuthUser, getAuthSessionInfo, touchAuthSession } from './state.js';

export function updateAdminProfileUI() {
  const nameEl = document.getElementById('drawerAdminName');
  const roleEl = document.getElementById('drawerAdminRole');
  const sessionEl = document.getElementById('drawerAdminSessionText');
  const cancelBtn = document.getElementById('securityModalCancelBtn');

  if (state.currentUser) {
    touchAuthSession();
    if (nameEl) nameEl.textContent = state.currentUser.name || state.currentUser.username || '관리자';
    if (roleEl) {
      const roleMap = {
        'superadmin': '본사 총괄 최고관리자',
        'branch_admin': '지점 관리실장',
        'user': '일반 회원'
      };
      roleEl.textContent = roleMap[state.currentUser.role] || state.currentUser.role || '인증 완료';
    }
    if (sessionEl) {
      const info = getAuthSessionInfo();
      sessionEl.innerHTML = info ? `🟢 <strong class="text-emerald-300">14일 자동유지</strong> (${info.days}일 남음)` : '🟢 14일간 로그인 유지 중';
    }
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
  } else {
    if (nameEl) nameEl.textContent = '로그인이 필요합니다';
    if (roleEl) roleEl.textContent = '미인증 상태 (잠금)';
    if (sessionEl) sessionEl.textContent = '🔒 미접속';
    if (cancelBtn) cancelBtn.style.display = 'none';
  }
}

export function openLoginSecurityModal(canClose = false) {
  const modal = document.getElementById('loginSecurityModal');
  if (!modal) return;
  const errMsg = document.getElementById('loginErrMsg') || document.getElementById('secLoginError');
  if (errMsg) {
    errMsg.style.display = 'none';
    errMsg.textContent = '';
  }

  const cancelBtn = document.getElementById('securityModalCancelBtn');
  if (cancelBtn) {
    cancelBtn.style.display = (canClose || state.currentUser) ? 'inline-block' : 'none';
  }

  modal.style.display = 'flex';
  const uInput = document.getElementById('loginUsername') || document.getElementById('secUsername');
  if (uInput) uInput.focus();
}

export function closeLoginSecurityModal() {
  const modal = document.getElementById('loginSecurityModal');
  if (modal) modal.style.display = 'none';
}

export function fillQuickLogin(username, password) {
  const uEl = document.getElementById('loginUsername') || document.getElementById('secUsername');
  const pEl = document.getElementById('loginPassword') || document.getElementById('secPassword');
  if (uEl) uEl.value = username;
  if (pEl) pEl.value = password;
  const submitBtn = document.getElementById('loginSubmitBtn') || document.getElementById('btnSecLoginSubmit');
  if (submitBtn) submitBtn.focus();
}

export async function handleSecurityLoginSubmit(e) {
  if (e) e.preventDefault();

  const uEl = document.getElementById('loginUsername') || document.getElementById('secUsername');
  const pEl = document.getElementById('loginPassword') || document.getElementById('secPassword');
  const errMsg = document.getElementById('loginErrMsg') || document.getElementById('secLoginError');
  const submitBtn = document.getElementById('loginSubmitBtn') || document.getElementById('btnSecLoginSubmit');

  const username = (uEl ? uEl.value : '').trim();
  const password = (pEl ? pEl.value : '').trim();

  if (!username || !password) {
    if (errMsg) {
      errMsg.textContent = '아이디와 비밀번호를 입력해주세요.';
      errMsg.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '인증 중...';
  }

  try {
    let authUser = null;
    // AGENTS.md 표준 계정 매트릭스
    if (username === 'admin' && password === '1212') {
      authUser = { username: 'admin', name: '본사 총괄 최고관리자', role: 'superadmin', branch_id: null };
    } else if (username === 'admin01' && password === '1212') {
      authUser = { username: 'admin01', name: '1호점 실장', role: 'branch_admin', branch_id: 'branch-01' };
    } else if (username === 'admin02' && password === '1212') {
      authUser = { username: 'admin02', name: '2호점 실장', role: 'branch_admin', branch_id: 'branch-02' };
    } else if ((username === 'user' || username === 'student') && (password === '1212' || password === 'password')) {
      authUser = { username, name: '일반 회원', role: 'user', branch_id: null };
    } else {
      throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    setAuthUser(authUser);
    updateAdminProfileUI();
    closeLoginSecurityModal();

    // 토스트 안내
    const banner = document.createElement('div');
    banner.className = 'fixed top-5 right-5 z-[9999] bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl font-medium text-xs flex items-center gap-2';
    banner.innerHTML = `<span>🛡️ <strong>${authUser.name}</strong> 님 14일 자동 로그인 세션이 시작되었습니다.</span>`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 3000);
  } catch (err) {
    if (errMsg) {
      errMsg.textContent = err.message;
      errMsg.style.display = 'block';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '🔒 보안 로그인 (14일 유지)';
    }
  }
}

export function handleOneTouchLogout(forceWithoutConfirm = true) {
  if (forceWithoutConfirm || confirm('로그아웃하시겠습니까?')) {
    clearAuthUser();
    updateAdminProfileUI();
    openLoginSecurityModal(false);

    const banner = document.createElement('div');
    banner.className = 'fixed top-5 right-5 z-[9999] bg-slate-800 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl shadow-xl font-medium text-xs flex items-center gap-2';
    banner.innerHTML = `<span>🔒 <strong>원터치 로그아웃</strong> 완료 (화면이 잠겼습니다)</span>`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 2500);
  }
}

export function handleLogout() {
  handleOneTouchLogout(true);
}
