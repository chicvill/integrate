// shared/ui/auth.js
// MQnet 통합 SaaS 플랫폼 - 공통 인증 & 세션 관리 모듈 (Vanilla JS / 번들리스)
// 모든 앱(files, photos, studycafe 등)에서 1줄로 임포트하여 사용할 수 있습니다.

const TOKEN_KEY = 'mqnet_auth_token';
const USER_KEY  = 'mqnet_auth_user';

export const MQnetAuth = {
  appId: 'platform',
  listeners: [],

  // ── 초기화 ───────────────────────────────────────────────
  init({ appId = 'platform', onAuthChange = null } = {}) {
    this.appId = appId;
    if (onAuthChange) this.listeners.push(onAuthChange);
    this._injectStyles();
    return this.getUser();
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
      el.innerHTML = `
        <div class="mqnet-user-badge">
          <div class="mqnet-user-avatar" title="${escHtml(user.email)}">
            ${user.full_name ? escHtml(user.full_name.charAt(0).toUpperCase()) : '👤'}
          </div>
          <div class="mqnet-user-info">
            <span class="mqnet-user-name">${escHtml(user.full_name || user.email.split('@')[0])}</span>
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
          <span>로그인</span>
        </button>`;
      el.querySelector('.mqnet-btn-login')?.addEventListener('click', () => {
        this.openModal();
      });
    }
  },

  // ── 로그인 / 회원가입 통합 모달 열기 ──────────────────────
  openModal({ onSuccess = null, title = 'MQnet 통합 계정 로그인' } = {}) {
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
            <h3 class="mqnet-auth-title">${escHtml(title)}</h3>
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

          <!-- 공통 이메일 -->
          <div class="mqnet-form-group">
            <label class="mqnet-label">이메일 주소</label>
            <input id="mqnetEmail" type="email" class="mqnet-input" placeholder="user@example.com" autocomplete="email">
          </div>

          <!-- 회원가입 전용: 이름 -->
          <div class="mqnet-form-group hidden" id="mqnetNameGroup">
            <label class="mqnet-label">이름</label>
            <input id="mqnetName" type="text" class="mqnet-input" placeholder="홍길동" autocomplete="name">
          </div>

          <!-- 비밀번호 -->
          <div class="mqnet-form-group">
            <label class="mqnet-label">비밀번호</label>
            <input id="mqnetPassword" type="password" class="mqnet-input" placeholder="6자리 이상 비밀번호" autocomplete="current-password">
          </div>

          <!-- 원클릭 데모 계정 안내 -->
          <div class="mqnet-demo-hint" id="mqnetDemoHint">
            <span>💡 빠른 테스트:</span>
            <button class="mqnet-demo-btn" id="mqnetDemoBtn" type="button">데모 계정 (demo@mqnet.io)</button>
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
    const demoBtn = document.getElementById('mqnetDemoBtn');
    const demoHint = document.getElementById('mqnetDemoHint');

    let mode = 'login'; // 'login' | 'register'

    const setMode = (m) => {
      mode = m;
      errorBox.classList.add('hidden');
      if (mode === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        nameGroup.classList.add('hidden');
        demoHint.classList.remove('hidden');
        submitBtn.textContent = '로그인';
      } else {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        nameGroup.classList.remove('hidden');
        demoHint.classList.add('hidden');
        submitBtn.textContent = '회원가입 완료';
      }
    };

    tabLogin.addEventListener('click', () => setMode('login'));
    tabRegister.addEventListener('click', () => setMode('register'));

    // 데모 버튼 클릭
    demoBtn?.addEventListener('click', () => {
      emailInput.value = 'demo@mqnet.io';
      passInput.value = 'demo1234!';
      handleSubmit();
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
        showError('이름을 입력해주세요.');
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
        border-radius: 16px; width: 100%; max-width: 420px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
        overflow: hidden; color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, "Pretendard", Roboto, sans-serif;
      }
      .mqnet-auth-header {
        padding: 1.25rem 1.5rem; display: flex; align-items: center; justify-content: space-between;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.02);
      }
      .mqnet-auth-title { font-size: 1.15rem; font-weight: 700; margin: 0; color: #fff; }
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
      .mqnet-auth-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
      .mqnet-auth-alert {
        padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.85rem;
        background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5;
      }
      .mqnet-auth-alert.hidden { display: none; }
      .mqnet-form-group { display: flex; flex-direction: column; gap: 0.35rem; }
      .mqnet-form-group.hidden { display: none; }
      .mqnet-label { font-size: 0.8rem; font-weight: 600; color: #cbd5e1; }
      .mqnet-input {
        padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.05); color: #fff; font-size: 0.95rem; outline: none; transition: border-color 0.2s;
      }
      .mqnet-input:focus { border-color: #38bdf8; box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2); }
      .mqnet-demo-hint {
        display: flex; align-items: center; justify-content: space-between;
        font-size: 0.78rem; color: #94a3b8; background: rgba(255, 255, 255, 0.03);
        padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px dashed rgba(255, 255, 255, 0.1);
      }
      .mqnet-demo-btn {
        background: transparent; border: none; color: #38bdf8; font-weight: 600;
        cursor: pointer; text-decoration: underline; font-size: 0.78rem;
      }
      .mqnet-demo-btn:hover { color: #7dd3fc; }
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
        background: rgba(255, 255, 255, 0.05); padding: 0.25rem 0.6rem 0.25rem 0.35rem;
        border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.12);
      }
      .mqnet-user-avatar {
        width: 26px; height: 26px; border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #38bdf8);
        color: #fff; font-weight: 700; font-size: 0.75rem;
        display: flex; align-items: center; justify-content: center;
      }
      .mqnet-user-info { display: flex; flex-direction: column; line-height: 1.1; }
      .mqnet-user-name { font-size: 0.8rem; font-weight: 600; color: #f3f4f6; }
      .mqnet-user-plan { font-size: 0.62rem; color: #38bdf8; font-weight: 700; }
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
