// apps/files/frontend/js/api.js
// MQnet Files Hub - API 통신 모듈
// 가이드 준수: getApiBase()로 동적 URL 결정 (하드코딩 금지)

/**
 * 현재 접속 컨텍스트에 따라 API 기본 경로를 동적으로 결정
 * - 게이트웨이 /files/ 또는 /filebrowser/ 경로: /api/files or /api/filebrowser
 * - 독립 도메인 또는 로컬: /api
 */
export function getApiBase() {
  const p = window.location.pathname;
  if (p.startsWith('/filebrowser')) return '/api/filebrowser';
  if (p.startsWith('/files')) return '/api/files';
  return '/api';
}

const BASE = () => getApiBase();

async function request(path, opts = {}) {
  const url = `${BASE()}${path}`;
  const res = await fetch(url, { cache: 'no-store', ...opts });
  if (!res.ok) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    let detail = errText;
    try { detail = JSON.parse(errText).detail || errText; } catch {}
    throw new Error(detail);
  }
  return res;
}

// ── 폴더/파일 목록 조회 ───────────────────────────────────
export async function fetchList(folder = '') {
  const res = await request(`/list?folder=${encodeURIComponent(folder)}&t=${Date.now()}`);
  return res.json();
}

// ── 파일 검색 ─────────────────────────────────────────────
export async function searchFiles(q, folder = '') {
  const res = await request(`/search?q=${encodeURIComponent(q)}&folder=${encodeURIComponent(folder)}&t=${Date.now()}`);
  return res.json();
}

// ── 텍스트 파일 미리보기 ──────────────────────────────────
export async function fetchTextPreview(path) {
  const res = await request(`/text-preview?path=${encodeURIComponent(path)}`);
  return res.json();
}

// ── 파일 업로드 (다중 파일) ───────────────────────────────
export async function uploadFiles(folder, fileList, onProgress) {
  const formData = new FormData();
  formData.append('folder', folder);
  for (const f of fileList) {
    formData.append('files', f, f.name);
  }

  // XMLHttpRequest로 업로드 진행률 지원
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE()}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        let msg = `업로드 실패 (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText).detail || msg; } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('네트워크 오류로 업로드에 실패했습니다.'));
    xhr.send(formData);
  });
}

// ── 새 폴더 생성 ──────────────────────────────────────────
export async function createFolder(path, folderName) {
  const res = await request('/mkdir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, folder_name: folderName })
  });
  return res.json();
}

// ── 이름 변경 ─────────────────────────────────────────────
export async function renameItem(path, newName) {
  const res = await request('/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, new_name: newName })
  });
  return res.json();
}

// ── 삭제 ──────────────────────────────────────────────────
export async function deleteItems(paths) {
  const res = await request('/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths })
  });
  return res.json();
}

// ── 파일 다운로드 URL 생성 ────────────────────────────────
export function getDownloadUrl(path) {
  return `${BASE()}/download?path=${encodeURIComponent(path)}`;
}

// ── 파일 인라인 미리보기 URL 생성 ────────────────────────
export function getRawUrl(path) {
  return `${BASE()}/raw?path=${encodeURIComponent(path)}`;
}

// ── 시스템 상태 ───────────────────────────────────────────
export async function fetchSystemStatus() {
  const res = await request('/system-status');
  return res.json();
}
