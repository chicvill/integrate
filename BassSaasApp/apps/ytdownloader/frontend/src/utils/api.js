/**
 * apps/YTDownloader/frontend/src/utils/api.js
 * MQnet SaaS Standard dynamic API Base URL resolver.
 * Supports Gateway subpath (/ytdownloader/), Subdomain (youtube.chicvill.store), and Standalone (:8008).
 */

export function getApiBase() {
  const p = window.location.pathname.toLowerCase();
  if (p.startsWith('/ytdownloader')) {
    return '/api/ytdownloader';
  }
  return '/api';
}

export function getMediaApiBase() {
  const p = window.location.pathname.toLowerCase();
  if (p.startsWith('/ytdownloader')) {
    return '/api/ytdownloader/media';
  }
  return '/api/media';
}

export const getSessionId = () => {
  let sid = sessionStorage.getItem('mqnet_session_id');
  if (!sid) {
    sid = 'sess_' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
    sessionStorage.setItem('mqnet_session_id', sid);
  }
  return sid;
};

export const getSessionHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
    'X-Session-ID': getSessionId(),
    'X-App-ID': 'ytdownloader'
  };
  const token = localStorage.getItem('mqnet_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};
