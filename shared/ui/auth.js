// shared/ui/auth.js
// MQnet 통합 SaaS 플랫폼 - 공통 인증, 소셜 로그인(OAuth) & RBAC 권한 모듈 (Vanilla JS / 번들리스)
// 모든 앱(store, files, photos, studycafe 등)에서 1줄로 임포트하여 사용할 수 있습니다.

const TOKEN_KEY = 'mqnet_auth_token';
const USER_KEY  = 'mqnet_auth_user';

// 역할별 친화적인 한글 명칭 및 컬러 매핑
export const ROLE_LABELS = {
  superadmin: { name: '최고관리자', color: '#f43f5e' },
  owner:      { name: '점주(대표)', color: '#a855f7' },
  manager:    { name: '점장(매니저)', color: '#3b82f6' },
  staff:      { name: '점원(스태프)', color: '#10b981' },
  customer:   { name: '고객(회원)', color: '#64748b' },
  user:       { name: '일반회원', color: '#06b6d4' },
  guest:      { name: '임시게스트', color: '#94a3b8' },
  admin:      { name: '관리자', color: '#f59e0b' }
};

// ─── OOP 세션/로그인 객체 모델 (상속 기반) ──────────────────────
export class BaseAuthSessionUser {
  constructor(data = {}) {
    this.sessionId = data.sessionId || sessionStorage.getItem('mqnet_session_id') || this._genSessionId();
    this.userId = data.id || data.userId || null;
    this.email = data.email || null;
    this.fullName = data.full_name || data.fullName || (this.userId ? '회원' : '게스트 이용자');
    this.role = data.role || (this.userId ? 'user' : 'guest');
    this.appId = data.app_id || data.appId || 'platform';
    this.isAuthenticated = !!this.userId;
    this.isGuest = !this.userId;
    this.allowedApps = data.allowed_apps || ['*'];
    this.appRoles = data.app_roles || {};
  }

  _genSessionId() {
    const id = 'sess_' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
    sessionStorage.setItem('mqnet_session_id', id);
    return id;
  }

  hasRole(requiredRoles) {
    if (this.role === 'superadmin') return true;
    const effectiveRole = (this.appRoles && this.appRoles[this.appId]) || this.role;
    const arr = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return arr.includes(effectiveRole);
  }

  getAuthHeaders() {
    const headers = {
      'X-App-ID': this.appId,
      'X-Session-ID': this.sessionId
    };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }
}

// 매장 관리 전용 확장 세션 객체
export class StoreSessionUser extends BaseAuthSessionUser {
  constructor(data = {}) {
    super({ ...data, appId: 'store' });
    this.storeCode = data.tenant_id || data.storeCode || 'STORE-MAIN';
    this.posTerminalId = data.posTerminalId || null;
  }
  get isOwner() { return this.hasRole('owner'); }
  get isManager() { return this.hasRole(['owner', 'manager']); }
  get isStaff() { return this.hasRole(['owner', 'manager', 'staff']); }
}

// YTDownloader 전용 확장 세션 객체 (임시 세션 격리 & 자동 정리)
export class YTDownloadSessionUser extends BaseAuthSessionUser {
  constructor(data = {}) {
    super({ ...data, appId: 'ytdownload' });
    this.sessionDownloadDir = `/media/downloads/sessions/${this.sessionId}`;
  }

  // 접속 종료 또는 초기화 시 해당 세션의 임시 자료만 선별 삭제
  async cleanup() {
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/ytdownload/session/cleanup', JSON.stringify({ session_id: this.sessionId }));
      } else {
        await fetch('/api/ytdownload/session/cleanup', {
          method: 'POST',
          headers: this.getAuthHeaders()
        });
      }
    } catch (e) {
      console.warn('Session cleanup error:', e);
    }
  }
}

export const MQnetAuth = {
  appId: 'platform',
  listeners: [],

  // ── 초기화 ───────────────────────────────────────────────
  init({ appId = 'platform', onAuthChange = null } = {}) {
    this.appId = appId;
    if (onAuthChange) this.listeners.push(onAuthChange);
    this._injectStyles();
    return this.getSessionUser();
  },

  // ── 객체 지향 세션 인스턴스 획득 ──────────────────────────
  getSessionUser() {
    const rawUser = this.getUser();
    if (this.appId === 'ytdownload') return new YTDownloadSessionUser(rawUser || {});
    if (this.appId === 'store') return new StoreSessionUser(rawUser || {});
    return new BaseAuthSessionUser(rawUser || {});
  },

  // ── 토큰 & 사용자 정보 접근 ──────────────────────────────
  getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  },

  getUser() {
    try {
      const u = localStorage.getItem(USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  isLoggedIn() {
    return !!this.getToken() && !!this.getUser();
  },

  // 현재 앱 내에서의 유효 역할 (RBAC)
  getCurrentRole() {
    const u = this.getUser();
    if (!u) return null;
    if (u.app_roles && u.app_roles[this.appId]) return u.app_roles[this.appId];
    return u.role || 'user';
  },

  // 특정 역할 보유 여부 확인 (예: hasRole(['owner', 'manager']))
  hasRole(requiredRoles) {
    const role = this.getCurrentRole();
    if (!role) return false;
    const user = this.getUser();
    if (user && user.role === 'superadmin') return true;
    const roleArr = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return roleArr.includes(role);
  },

  // 현재 사용자가 특정 앱에 접근 가능한지 여부
  isAppAllowed(appId = this.appId) {
    const u = this.getUser();
    if (!u) return false;
    const allowed = u.allowed_apps || ['*'];
    return allowed.includes('*') || allowed.includes(appId);
  },

  getAuthHeader() {
    const token = this.getToken();
    const headers = { 'X-App-ID': this.appId };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  },

  // ── 로그아웃 ─────────────────────────────────────────────
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._notify(null);
  },

  // ── 이벤트 리스너 ────────────────────────────────────────
  onAuthChange(fn) {
    if (typeof fn === 'function') this.listeners.push(fn);
  },

  _notify(user) {
    this.listeners.forEach(fn => {
      try { fn(user); } catch (e) { console.error('Auth listener error:', e); }
    });
    // 등록된 배지들 자동 갱신
    document.querySelectorAll('[data-mqnet-auth-badge]').forEach(el => {
      this.renderBadge(el);
    });
  },

  // ── 사용자 배지 렌더링 헬퍼 ──────────────────────────────
  renderBadge(container) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    el.setAttribute('data-mqnet-auth-badge', 'true');

    const user = this.getUser();
    if (user) {
      const currentRole = this.getCurrentRole();
      const roleMeta = ROLE_LABELS[currentRole] || { name: currentRole.toUpperCase(), color: '#38bdf8' };

      el.innerHTML = `
        <div class="mqnet-user-badge">
          <div class="mqnet-user-avatar" title="${escHtml(user.email)}" style="background:${roleMeta.color}">
            ${user.full_name ? escHtml(user.full_name.charAt(0).toUpperCase()) : '👤'}
          </div>
          <div class="mqnet-user-info">
            <div style="display:flex;align-items:center;gap:0.35rem">
              <span class="mqnet-user-name">${escHtml(user.full_name || user.email.split('@')[0])}</span>
              <span class="mqnet-user-role-badge" style="background:${roleMeta.color}22;color:${roleMeta.color};border:1px solid ${roleMeta.color}55">
                ${escHtml(roleMeta.name)}
              </span>
            </div>
            <span class="mqnet-user-plan">${escHtml(user.plan_id || 'free').toUpperCase()}</span>
          </div>
          <button class="mqnet-btn-logout" title="로그아웃" aria-label="로그아웃">🚪</button>
        </div>`;
      el.querySelector('.mqnet-btn-logout')?.addEventListener('click', () => {
        if (confirm('로그아웃 하시겠습니까?')) {
          this.logout();
        }
      });
    } else {
      el.innerHTML = `
        <button class="mqnet-btn-login">
          <span>🔑</span>
          <span>로그인 / 회원가입</span>
        </button>`;
      el.querySelector('.mqnet-btn-login')?.addEventListener('click', () => {
        this.openModal();
      });
    }
  },

  // ── 로그인 / 회원가입 통합 모달 열기 ──────────────────────
  openModal({ onSuccess = null, title = 'MQnet 통합 계정' } = {}) {
    let backdrop = document.getElementById('mqnetAuthBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'mqnetAuthBackdrop';
      backdrop.className = 'mqnet-auth-backdrop';
      document.body.appendChild(backdrop);
    }

    backdrop.innerHTML = `
      <div class="mqnet-auth-modal fade-in" role="dialog" aria-modal="true">
        <div class="mqnet-auth-header">
          <div style="display:flex;align-items:center;gap:0.6rem">
            <span style="font-size:1.5rem">🔐</span>
            <div>
              <h3 class="mqnet-auth-title">${escHtml(title)}</h3>
              <p class="mqnet-auth-subtitle">단 하나의 계정으로 모든 MQnet 서비스를 이용하세요</p>
            </div>
          </div>
          <button class="mqnet-modal-close" id="mqnetAuthCloseBtn">✕</button>
        </div>

        <!-- 탭 전환: 로그인 / 회원가입 -->
        <div class="mqnet-auth-tabs">
          <button class="mqnet-auth-tab active" id="mqnetTabLogin">로그인</button>
          <button class="mqnet-auth-tab" id="mqnetTabRegister">회원가입</button>
        </div>

        <div class="mqnet-auth-body">
          <div id="mqnetAuthError" class="mqnet-auth-alert hidden"></div>

          <!-- 소셜 로그인 원클릭 버튼 구역 -->
          <div class="mqnet-social-section">
            <button class="mqnet-social-btn btn-google" id="mqnetBtnGoogle" type="button">
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/><path fill="#FBBC05" d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7 0-1.1.2-1.9.4-2.7L1.6 6.4C.6 8.3 0 10.1 0 12s.6 3.7 1.6 5.6l3.7-2.9z"/><path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16C3.5 19.8 7.4 23 12 23z"/></svg>
              <span>Google로 계속하기</span>
            </button>
            <button class="mqnet-social-btn btn-naver" id="mqnetBtnNaver" type="button">
              <span class="naver-icon">N</span>
              <span>네이버로 계속하기</span>
            </button>
          </div>

          <div class="mqnet-divider">
            <span>또는 이메일로 계속하기</span>
          </div>

          <!-- 공통 이메일 -->
          <div class="mqnet-form-group">
            <label class="mqnet-label">이메일 주소</label>
            <input id="mqnetEmail" type="email" class="mqnet-input" placeholder="user@example.com" autocomplete="email">
          </div>

          <!-- 회원가입 전용: 이름 -->
          <div class="mqnet-form-group hidden" id="mqnetNameGroup">
            <label class="mqnet-label">이름 / 상호</label>
            <input id="mqnetName" type="text" class="mqnet-input" placeholder="홍길동" autocomplete="name">
          </div>

          <!-- 비밀번호 -->
          <div class="mqnet-form-group">
            <label class="mqnet-label">비밀번호</label>
            <input id="mqnetPassword" type="password" class="mqnet-input" placeholder="6자리 이상 비밀번호" autocomplete="current-password">
          </div>

          <!-- 역할별 원클릭 데모 계정 선택기 -->
          <div class="mqnet-demo-section" id="mqnetDemoSection">
            <div class="mqnet-demo-title">⚡ 빠른 테스트용 역할별 데모 계정:</div>
            <div class="mqnet-demo-chips">
              <button class="mqnet-chip" data-email="owner@store.io" data-role="owner" type="button">👑 매장 점주 (대표)</button>
              <button class="mqnet-chip" data-email="manager@store.io" data-role="manager" type="button">💼 매장 점장 (매니저)</button>
              <button class="mqnet-chip" data-email="clerk@store.io" data-role="staff" type="button">🤝 매장 점원 (스태프)</button>
              <button class="mqnet-chip" data-email="customer@store.io" data-role="customer" type="button">🛍️ 고객 (단골)</button>
              <button class="mqnet-chip" data-email="demo@mqnet.io" data-role="user" type="button">🌐 통합 회원 (홍길동)</button>
            </div>
          </div>

          <button class="mqnet-auth-submit-btn" id="mqnetAuthSubmit">로그인</button>
        </div>
      </div>`;

    backdrop.classList.add('open');

    // DOM 요소
    const closeBtn = document.getElementById('mqnetAuthCloseBtn');
    const tabLogin = document.getElementById('mqnetTabLogin');
    const tabRegister = document.getElementById('mqnetTabRegister');
    const nameGroup = document.getElementById('mqnetNameGroup');
    const submitBtn = document.getElementById('mqnetAuthSubmit');
    const emailInput = document.getElementById('mqnetEmail');
    const passInput = document.getElementById('mqnetPassword');
    const nameInput = document.getElementById('mqnetName');
    const errorBox = document.getElementById('mqnetAuthError');
    const btnGoogle = document.getElementById('mqnetBtnGoogle');
    const btnNaver = document.getElementById('mqnetBtnNaver');
    const demoSection = document.getElementById('mqnetDemoSection');

    let mode = 'login'; // 'login' | 'register'

    const setMode = (m) => {
      mode = m;
      errorBox.classList.add('hidden');
      if (mode === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        nameGroup.classList.add('hidden');
        demoSection.classList.remove('hidden');
        submitBtn.textContent = '로그인';
      } else {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        nameGroup.classList.remove('hidden');
        demoSection.classList.add('hidden');
        submitBtn.textContent = '회원가입 완료';
      }
    };

    tabLogin.addEventListener('click', () => setMode('login'));
    tabRegister.addEventListener('click', () => setMode('register'));

    // 소셜 로그인 처리 핸들러
    const handleOAuth = async (provider) => {
      try {
        submitBtn.disabled = true;
        errorBox.classList.add('hidden');

        // 데모 환경에서는 빠른 소셜 인증 시뮬레이션 지원
        const mockSocialUser = provider === 'google' 
          ? { email: 'google_user@gmail.com', full_name: '구글 사용자', provider: 'google', auth_code_or_token: 'google_oauth_token' }
          : { email: 'naver_user@naver.com', full_name: '네이버 사용자', provider: 'naver', auth_code_or_token: 'naver_oauth_token' };

        const res = await fetch('/auth/oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-App-ID': this.appId },
          body: JSON.stringify({ ...mockSocialUser, app_id: this.appId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `${provider} 로그인 실패`);

        localStorage.setItem(TOKEN_KEY, data.access_token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));

        closeModal();
        this._notify(data.user);
        if (typeof onSuccess === 'function') onSuccess(data.user);
      } catch (err) {
        showError(err.message);
      } finally {
        submitBtn.disabled = false;
      }
    };

    btnGoogle.addEventListener('click', () => handleOAuth('google'));
    btnNaver.addEventListener('click', () => handleOAuth('naver'));

    // 역할별 데모 칩 클릭
    demoSection.querySelectorAll('.mqnet-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        emailInput.value = chip.dataset.email;
        passInput.value = 'demo1234!';
        handleSubmit();
      });
    });

    const closeModal = () => {
      backdrop.classList.remove('open');
    };

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    // 폼 제출
    const handleSubmit = async () => {
      const email = emailInput.value.trim();
      const password = passInput.value.trim();
      const fullName = nameInput.value.trim();

      if (!email || !password) {
        showError('이메일과 비밀번호를 입력해주세요.');
        return;
      }
      if (mode === 'register' && !fullName) {
        showError('이름 또는 상호를 입력해주세요.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = '처리 중...';
      errorBox.classList.add('hidden');

      try {
        let user;
        if (mode === 'login') {
          const res = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-App-ID': this.appId },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || '로그인 실패');

          localStorage.setItem(TOKEN_KEY, data.access_token);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          user = data.user;
        } else {
          // 회원가입 후 자동 로그인
          const regRes = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-App-ID': this.appId },
            body: JSON.stringify({ email, password, full_name: fullName })
          });
          const regData = await regRes.json();
          if (!regRes.ok) throw new Error(regData.detail || '회원가입 실패');

          // 바로 로그인
          const loginRes = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-App-ID': this.appId },
            body: JSON.stringify({ email, password })
          });
          const loginData = await loginRes.json();
          if (!loginRes.ok) throw new Error('회원가입 완료 후 로그인 실패');

          localStorage.setItem(TOKEN_KEY, loginData.access_token);
          localStorage.setItem(USER_KEY, JSON.stringify(loginData.user));
          user = loginData.user;
        }

        closeModal();
        this._notify(user);
        if (typeof onSuccess === 'function') onSuccess(user);
      } catch (err) {
        showError(err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'login' ? '로그인' : '회원가입 완료';
      }
    };

    const showError = (msg) => {
      errorBox.textContent = msg;
      errorBox.classList.remove('hidden');
    };

    submitBtn.addEventListener('click', handleSubmit);
    [emailInput, passInput, nameInput].forEach(inp => {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSubmit();
      });
    });

    setTimeout(() => emailInput.focus(), 150);
  },

  // ── CSS 스타일 자동 주입 (별도 CSS 로드 없이도 동작 보장) ────
  _injectStyles() {
    if (document.getElementById('mqnetAuthStyles')) return;
    const style = document.createElement('style');
    style.id = 'mqnetAuthStyles';
    style.textContent = `
      .mqnet-auth-backdrop {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(8px);
        display: none; align-items: center; justify-content: center;
        padding: 1rem;
      }
      .mqnet-auth-backdrop.open { display: flex; animation: mqnetFadeIn 0.2s ease; }
      .mqnet-auth-modal {
        background: #111827; border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 18px; width: 100%; max-width: 440px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
        overflow: hidden; color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, "Pretendard", Roboto, sans-serif;
      }
      .mqnet-auth-header {
        padding: 1.25rem 1.5rem; display: flex; align-items: center; justify-content: space-between;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.02);
      }
      .mqnet-auth-title { font-size: 1.15rem; font-weight: 700; margin: 0; color: #fff; }
      .mqnet-auth-subtitle { font-size: 0.75rem; color: #94a3b8; margin: 0.2rem 0 0; }
      .mqnet-modal-close {
        background: transparent; border: none; color: #9ca3af; font-size: 1.25rem;
        cursor: pointer; padding: 0.25rem; line-height: 1; border-radius: 6px;
      }
      .mqnet-modal-close:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }
      .mqnet-auth-tabs {
        display: flex; border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(0, 0, 0, 0.2);
      }
      .mqnet-auth-tab {
        flex: 1; padding: 0.85rem; border: none; background: transparent;
        color: #9ca3af; font-weight: 600; font-size: 0.9rem; cursor: pointer;
        border-bottom: 2px solid transparent; transition: all 0.2s;
      }
      .mqnet-auth-tab.active { color: #38bdf8; border-bottom-color: #38bdf8; background: rgba(56, 189, 248, 0.05); }
      .mqnet-auth-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 0.9rem; }
      .mqnet-auth-alert {
        padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.85rem;
        background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5;
      }
      .mqnet-auth-alert.hidden { display: none; }

      /* 소셜 로그인 섹션 */
      .mqnet-social-section { display: flex; flex-direction: column; gap: 0.6rem; }
      .mqnet-social-btn {
        display: flex; align-items: center; justify-content: center; gap: 0.6rem;
        width: 100%; padding: 0.7rem; border-radius: 10px; font-size: 0.88rem; font-weight: 600;
        cursor: pointer; transition: all 0.2s; border: none;
      }
      .mqnet-social-btn.btn-google {
        background: #ffffff; color: #1f2937; border: 1px solid #d1d5db;
      }
      .mqnet-social-btn.btn-google:hover { background: #f3f4f6; }
      .mqnet-social-btn.btn-naver {
        background: #03C75A; color: #ffffff;
      }
      .mqnet-social-btn.btn-naver:hover { background: #02b350; }
      .naver-icon {
        display: inline-flex; align-items: center; justify-content: center;
        width: 18px; height: 18px; font-weight: 900; font-size: 13px; line-height: 1;
      }

      .mqnet-divider {
        display: flex; align-items: center; text-align: center; color: #64748b; font-size: 0.75rem; margin: 0.3rem 0;
      }
      .mqnet-divider::before, .mqnet-divider::after {
        content: ''; flex: 1; border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .mqnet-divider span { padding: 0 0.6rem; }

      .mqnet-form-group { display: flex; flex-direction: column; gap: 0.35rem; }
      .mqnet-form-group.hidden { display: none; }
      .mqnet-label { font-size: 0.8rem; font-weight: 600; color: #cbd5e1; }
      .mqnet-input {
        padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.05); color: #fff; font-size: 0.95rem; outline: none; transition: border-color 0.2s;
      }
      .mqnet-input:focus { border-color: #38bdf8; box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2); }

      /* 데모 섹션 */
      .mqnet-demo-section {
        background: rgba(255, 255, 255, 0.03); border: 1px dashed rgba(255, 255, 255, 0.12);
        padding: 0.75rem; border-radius: 10px;
      }
      .mqnet-demo-title { font-size: 0.76rem; color: #94a3b8; font-weight: 600; margin-bottom: 0.45rem; }
      .mqnet-demo-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
      .mqnet-chip {
        padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.72rem; font-weight: 600;
        background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);
        color: #e2e8f0; cursor: pointer; transition: all 0.2s;
      }
      .mqnet-chip:hover { background: rgba(56, 189, 248, 0.2); border-color: #38bdf8; color: #38bdf8; }

      .mqnet-auth-submit-btn {
        padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 700;
        color: #fff; background: linear-gradient(135deg, #6366f1, #38bdf8);
        cursor: pointer; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35); transition: opacity 0.2s, transform 0.1s;
      }
      .mqnet-auth-submit-btn:hover { opacity: 0.95; transform: translateY(-1px); }
      .mqnet-auth-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      /* 배지 스타일 */
      .mqnet-user-badge {
        display: inline-flex; align-items: center; gap: 0.5rem;
        background: rgba(255, 255, 255, 0.05); padding: 0.25rem 0.65rem 0.25rem 0.35rem;
        border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.12);
      }
      .mqnet-user-avatar {
        width: 28px; height: 28px; border-radius: 50%;
        color: #fff; font-weight: 700; font-size: 0.78rem;
        display: flex; align-items: center; justify-content: center;
      }
      .mqnet-user-info { display: flex; flex-direction: column; line-height: 1.1; }
      .mqnet-user-name { font-size: 0.8rem; font-weight: 600; color: #f3f4f6; }
      .mqnet-user-role-badge {
        font-size: 0.62rem; font-weight: 700; padding: 0.1rem 0.35rem; border-radius: 4px; line-height: 1;
      }
      .mqnet-user-plan { font-size: 0.62rem; color: #94a3b8; font-weight: 600; }
      .mqnet-btn-logout {
        background: transparent; border: none; cursor: pointer;
        padding: 0.2rem; font-size: 0.85rem; opacity: 0.7; transition: opacity 0.2s;
      }
      .mqnet-btn-logout:hover { opacity: 1; transform: scale(1.1); }
      .mqnet-btn-login {
        display: inline-flex; align-items: center; gap: 0.4rem;
        padding: 0.4rem 0.85rem; border-radius: 9999px;
        background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(56,189,248,0.2));
        border: 1px solid rgba(56,189,248,0.3); color: #38bdf8;
        font-weight: 700; font-size: 0.82rem; cursor: pointer; transition: all 0.2s;
      }
      .mqnet-btn-login:hover {
        background: linear-gradient(135deg, rgba(99,102,241,0.35), rgba(56,189,248,0.35));
        border-color: #38bdf8; transform: translateY(-1px);
      }
      @keyframes mqnetFadeIn { from { opacity: 0; } to { opacity: 1; } }
    `;
    document.head.appendChild(style);
  }
};

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
