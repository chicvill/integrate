/**
 * templates/saas-template/frontend/js/state.js
 * Reactive State Store for standard SaaS operations.
 * Supports Multi-Branch (다중 매장/지점) switching and isolated filtering.
 */

class AppState {
  constructor() {
    this.items = [];
    this.branches = [];
    this.currentBranchId = ''; // 빈 문자열: 전체 매장 관제
    this.statusFilter = '';
    this.searchKeyword = '';
    this.systemStatus = null;
    this.currentUser = null;
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this);
      } catch (err) {
        console.error('State listener error:', err);
      }
    }
  }

  setItems(items) {
    this.items = Array.isArray(items) ? items : [];
    this.notify();
  }

  setBranches(branches) {
    this.branches = Array.isArray(branches) ? branches : [];
    this.notify();
  }

  setCurrentBranch(branchId) {
    this.currentBranchId = branchId || '';
    this.notify();
  }

  setFilters(statusFilter, searchKeyword) {
    this.statusFilter = statusFilter;
    this.searchKeyword = searchKeyword;
    this.notify();
  }

  setSystemStatus(status) {
    this.systemStatus = status;
    this.notify();
  }

  setCurrentUser(user) {
    this.currentUser = user;
    this.notify();
  }

  getFilteredItems() {
    return this.items.filter(item => {
      const matchBranch = !this.currentBranchId || item.branch_id === this.currentBranchId;
      const matchStatus = !this.statusFilter || item.status === this.statusFilter;
      const matchSearch = !this.searchKeyword || 
        (item.title && item.title.toLowerCase().includes(this.searchKeyword.toLowerCase())) ||
        (item.detail && item.detail.toLowerCase().includes(this.searchKeyword.toLowerCase()));
      return matchBranch && matchStatus && matchSearch;
    });
  }
}

export const state = new AppState();

// ── 표준 SaaS 14일 슬라이딩 세션 자동 유지 모듈 ──
export const AUTH_STORAGE_KEY = "MQNET_SAAS_ADMIN_AUTH_V1";
export const SESSION_DURATION_DAYS = 14;
export const SESSION_TTL_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;

// 저장된 세션 복원 및 슬라이딩 자동 연장
try {
  const savedUser = localStorage.getItem(AUTH_STORAGE_KEY);
  if (savedUser) {
    const parsed = JSON.parse(savedUser);
    const now = Date.now();
    const baseTime = parsed.expiresAt ? new Date(parsed.expiresAt).getTime() : (parsed.loginAt ? new Date(parsed.loginAt).getTime() + SESSION_TTL_MS : now + SESSION_TTL_MS);
    if (now > baseTime) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      state.setCurrentUser(null);
    } else {
      parsed.lastActiveAt = new Date(now).toISOString();
      parsed.expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
      state.setCurrentUser(parsed);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
    }
  }
} catch (e) {
  state.setCurrentUser(null);
}

export function touchAuthSession() {
  if (!state.currentUser) return false;
  const now = Date.now();
  const expires = state.currentUser.expiresAt ? new Date(state.currentUser.expiresAt).getTime() : now;
  if (now > expires) {
    clearAuthUser();
    return false;
  }
  state.currentUser.lastActiveAt = new Date(now).toISOString();
  state.currentUser.expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state.currentUser));
  return true;
}

export function getAuthSessionInfo() {
  if (!state.currentUser || !state.currentUser.expiresAt) return null;
  const diff = new Date(state.currentUser.expiresAt).getTime() - Date.now();
  if (diff <= 0) return { expired: true, text: '세션 만료' };
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return {
    expired: false,
    days: days,
    hours: hours,
    text: days > 0 ? `${days}일 남음 (접속시 자동연장)` : `${hours}시간 남음 (접속시 자동연장)`,
    expiresDate: new Date(state.currentUser.expiresAt).toISOString().split('T')[0]
  };
}

export function setAuthUser(user) {
  if (user) {
    const now = Date.now();
    user.lastActiveAt = new Date(now).toISOString();
    user.expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
    state.setCurrentUser(user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    state.setCurrentUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export function clearAuthUser() {
  state.setCurrentUser(null);
  localStorage.removeItem(AUTH_STORAGE_KEY);
}
