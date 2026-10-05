/**
 * templates/saas-template/frontend/js/api.js
 * MQnet SaaS Standard dynamic API Base URL resolver and authenticated HTTP client.
 */
import { MQnetAuth } from '/shared/ui/auth.js?v=2.0';

/**
 * 접속 경로에 따른 API Base URL 동적 결정
 * - 게이트웨이 서브패스 (예: /{{APP_ID}}/) -> /api/{{APP_ID}}
 * - 서브도메인 또는 로컬 단독 포트 실행 -> /api
 */
export function getApiBase(appName = '{{APP_ID}}') {
  const p = window.location.pathname.toLowerCase();
  if (p.startsWith(`/${appName.toLowerCase()}`)) {
    return `/api/${appName}`;
  }
  return '/api';
}

/**
 * MQnet 공통 인증 헤더 자동 생성
 * - X-App-ID 헤더 필수 주입
 * - mqnet_auth_token (localStorage / sessionStorage) Bearer 토큰 연동
 */
export function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'X-App-ID': '{{APP_ID}}'
  };

  const token = (typeof MQnetAuth !== 'undefined' && MQnetAuth.getToken)
    ? MQnetAuth.getToken()
    : (localStorage.getItem('mqnet_auth_token') || sessionStorage.getItem('mqnet_auth_token'));

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * 캐시 방어(_t) 및 인증 헤더가 포함된 표준 fetch 래퍼
 */
export async function fetchWithAuth(url, options = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {})
  };

  // Add cache-busting timestamp to prevent stale browser caches
  const separator = url.includes('?') ? '&' : '?';
  const urlWithCacheBust = `${url}${separator}_t=${Date.now()}`;

  const res = await fetch(urlWithCacheBust, {
    ...options,
    headers,
    cache: 'no-store'
  });

  if (!res.ok) {
    let errMsg = `HTTP Error ${res.status}`;
    try {
      const errData = await res.json();
      errMsg = errData.detail || errData.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  return await res.json();
}
