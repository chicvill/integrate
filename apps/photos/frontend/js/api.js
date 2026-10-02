import { state } from './state.js';

/**
 * Determine API base path adaptively:
 * If accessed via Gateway (/photos/...), use /api/photos or /api
 * If accessed standalone, use /api
 */
export function getApiBase() {
  const p = window.location.pathname;
  if (p.startsWith('/photos') || p.startsWith('/gallery')) {
    return '/api/photos';
  }
  return '/api';
}

export async function fetchFolderData(folderPath) {
  const base = getApiBase();
  const url = `${base}/list?folder=${encodeURIComponent(folderPath)}&t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    // If /api/photos/list returned 404, fallback to /api/list
    if (base !== '/api') {
      const fbUrl = `/api/list?folder=${encodeURIComponent(folderPath)}&t=${Date.now()}`;
      const fbRes = await fetch(fbUrl, { cache: 'no-store' });
      if (fbRes.ok) return await fbRes.json();
    }
    throw new Error(`HTTP ${res.status}: 폴더 데이터를 불러올 수 없습니다.`);
  }
  return await res.json();
}

export function uploadSingleFile(fileItem, mode, onProgress) {
  return new Promise((resolve, reject) => {
    const file = (fileItem && fileItem.file) ? fileItem.file : fileItem;
    const relPath = (fileItem && fileItem.relativePath) ? fileItem.relativePath : (file.webkitRelativePath || file.name);

    // Guard: If a directory handle is passed as File (size 0, no type, no extension)
    if (!file || (file.size === 0 && !file.type && !file.name.includes('.'))) {
      const folderName = file ? file.name : (relPath || 'new_folder');
      createFolderApi(state.currentFolder, folderName)
        .then(() => resolve(JSON.stringify({ success: true, folder: folderName })))
        .catch(err => reject(err));
      return;
    }

    const fileName = (file && file.name) ? file.name : (relPath.split('/').pop() || 'photo.jpg');

    const formData = new FormData();
    formData.append('folder', state.currentFolder);
    formData.append('mode', mode || state.currentUploadMode || 'copy');
    formData.append('relative_path', relPath);
    formData.append('files', file, fileName);
    formData.append('file', file, fileName);

    const base = getApiBase();
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent, e.loaded, e.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        let msg = `HTTP ${xhr.status}`;
        try {
          const res = JSON.parse(xhr.responseText);
          if (typeof res.detail === 'string') {
            msg = res.detail;
          } else if (Array.isArray(res.detail)) {
            msg = res.detail.map(d => d.msg || JSON.stringify(d)).join(', ');
          } else if (res.detail) {
            msg = JSON.stringify(res.detail);
          } else if (res.message) {
            msg = res.message;
          }
        } catch (e) {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => {
      // Fallback: If ${base}/upload failed, try /api/upload
      if (base !== '/api') {
        const fallbackXhr = new XMLHttpRequest();
        fallbackXhr.open('POST', '/api/upload');
        if (xhr.upload.onprogress) fallbackXhr.upload.onprogress = xhr.upload.onprogress;
        fallbackXhr.onload = () => {
          if (fallbackXhr.status >= 200 && fallbackXhr.status < 300) {
            resolve(fallbackXhr.responseText);
          } else {
            let msg = `HTTP ${fallbackXhr.status}`;
            try {
              const res = JSON.parse(fallbackXhr.responseText);
              if (typeof res.detail === 'string') {
                msg = res.detail;
              } else if (Array.isArray(res.detail)) {
                msg = res.detail.map(d => d.msg || JSON.stringify(d)).join(', ');
              } else if (res.detail) {
                msg = JSON.stringify(res.detail);
              }
            } catch (e) {}
            reject(new Error(msg));
          }
        };
        fallbackXhr.onerror = () => reject(new Error('네트워크 오류 (HTTP 전송 중 단절)'));
        fallbackXhr.ontimeout = () => reject(new Error('요청 시간 초과'));
        fallbackXhr.send(formData);
        return;
      }
      reject(new Error('네트워크 오류 (HTTP 전송 중 단절)'));
    };

    xhr.ontimeout = () => reject(new Error('요청 시간 초과'));

    xhr.send(formData);
  });
}

export async function createFolderApi(folder, name) {
  const base = getApiBase();
  const formData = new FormData();
  formData.append('folder', folder);
  formData.append('name', name);
  let res = await fetch(`${base}/mkdir`, { method: 'POST', body: formData });
  if (!res.ok && base !== '/api') {
    res = await fetch('/api/mkdir', { method: 'POST', body: formData });
  }
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || '폴더 생성 실패');
  }
  return await res.json();
}

export async function deleteItemApi(path) {
  const base = getApiBase();
  const formData = new FormData();
  formData.append('path', path);
  let res = await fetch(`${base}/delete`, { method: 'POST', body: formData });
  if (!res.ok && base !== '/api') {
    res = await fetch('/api/delete', { method: 'POST', body: formData });
  }
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || '삭제 실패');
  }
  return await res.json();
}

export async function batchDeleteApi(paths) {
  const base = getApiBase();
  const formData = new FormData();
  paths.forEach(p => formData.append('paths', p));
  let res = await fetch(`${base}/batch_delete`, { method: 'POST', body: formData });
  if (!res.ok && base !== '/api') {
    res = await fetch('/api/batch_delete', { method: 'POST', body: formData });
  }
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || '다중 삭제 실패');
  }
  return await res.json();
}

export async function fetchStorageInfo() {
  const base = getApiBase();
  try {
    let res = await fetch(`${base}/storage`);
    if (!res.ok && base !== '/api') {
      res = await fetch('/api/storage');
    }
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function analyzePhotoApi(filePath) {
  const base = getApiBase();
  try {
    let res = await fetch(`${base}/ai/analyze?file_path=${encodeURIComponent(filePath)}`);
    if (!res.ok && base !== '/api') {
      res = await fetch(`/api/ai/analyze?file_path=${encodeURIComponent(filePath)}`);
    }
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'AI 분석 실패');
    }
    return await res.json();
  } catch (err) {
    throw err;
  }
}
