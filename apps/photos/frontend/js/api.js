import { state } from './state.js';

export async function fetchFolderData(folderPath) {
  const url = `/api/list?folder=${encodeURIComponent(folderPath)}&t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: 폴더 데이터를 불러올 수 없습니다.`);
  }
  return await res.json();
}

export function uploadSingleFile(file, mode, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('folder', state.currentFolder);
    formData.append('mode', mode || state.currentUploadMode || 'copy');

    const relPath = file.webkitRelativePath || file.name;
    formData.append('relative_path', relPath);
    formData.append('files', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

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
          msg = res.detail || msg;
        } catch (e) {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('네트워크 오류 (HTTP 전송 중 단절)'));
    xhr.ontimeout = () => reject(new Error('요청 시간 초과'));

    xhr.send(formData);
  });
}

export async function createFolderApi(folder, name) {
  const formData = new FormData();
  formData.append('folder', folder);
  formData.append('name', name);
  const res = await fetch('/api/mkdir', { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || '폴더 생성 실패');
  }
  return await res.json();
}

export async function deleteItemApi(path) {
  const formData = new FormData();
  formData.append('path', path);
  const res = await fetch('/api/delete', { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || '삭제 실패');
  }
  return await res.json();
}

export async function batchDeleteApi(paths) {
  const formData = new FormData();
  paths.forEach(p => formData.append('paths', p));
  const res = await fetch('/api/batch_delete', { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || '다중 삭제 실패');
  }
  return await res.json();
}

export async function fetchStorageInfo() {
  try {
    const res = await fetch('/api/storage');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

