/**
 * templates/saas-template/frontend/js/api.js
 * MQnet SaaS Standard dynamic API Base URL resolver and HTTP client.
 */

export function getApiBase(appName = '{{APP_ID}}') {
  const p = window.location.pathname.toLowerCase();
  // 1. Gateway subpath: /{{APP_ID}}/... -> /api/{{APP_ID}}
  if (p.startsWith(`/${appName}`)) {
    return `/api/${appName}`;
  }
  // 2. Subdomain or Standalone (:PORT) -> /api
  return '/api';
}

export function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'X-App-ID': '{{APP_ID}}'
  };
  const token = localStorage.getItem('mqnet_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

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
