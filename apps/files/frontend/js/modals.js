// apps/files/frontend/js/modals.js
// MQnet Files Hub - 모달 및 다이얼로그 제어

import { escHtml } from './ui.js?v=1.0';
import { getRawUrl, getDownloadUrl, fetchTextPreview, createFolder, renameItem } from './api.js?v=1.0';

// ── 모달 열기/닫기 헬퍼 ─────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}

// ESC로 전체 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
  }
});

// 백드롭 클릭으로 닫기
document.querySelectorAll('.modal-backdrop').forEach(m => {
  m.addEventListener('click', (e) => {
    if (e.target === m) m.classList.remove('open');
  });
});

// ── 파일 미리보기 모달 ────────────────────────────────────
export async function openPreviewModal(file) {
  const modal = document.getElementById('previewModal');
  const title = document.getElementById('previewModalTitle');
  const body = document.getElementById('previewModalBody');
  const downloadBtn = document.getElementById('previewDownloadBtn');

  if (!modal || !body) return;

  title.textContent = file.name;
  downloadBtn.href = getDownloadUrl(file.path);
  downloadBtn.download = file.name;
  body.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted)">⚙️ 로딩 중...</div>`;
  openModal('previewModal');

  const rawUrl = getRawUrl(file.path);
  const cat = file.category;

  if (cat === 'image') {
    body.innerHTML = `
      <div class="preview-media-container">
        <img src="${rawUrl}" alt="${escHtml(file.name)}" style="max-width:100%;max-height:70vh;object-fit:contain;border-radius:8px">
      </div>`;
  } else if (cat === 'video') {
    body.innerHTML = `
      <div class="preview-media-container">
        <video controls autoplay style="max-width:100%;max-height:70vh;border-radius:8px">
          <source src="${rawUrl}" type="${file.mime_type}">
          <p>이 브라우저에서 동영상 재생을 지원하지 않습니다.</p>
        </video>
      </div>`;
  } else if (cat === 'audio') {
    body.innerHTML = `
      <div class="preview-media-container">
        <audio controls autoplay style="width:100%">
          <source src="${rawUrl}" type="${file.mime_type}">
          <p>이 브라우저에서 오디오 재생을 지원하지 않습니다.</p>
        </audio>
      </div>
      <div style="text-align:center;margin-top:1rem;font-size:3rem">🎵</div>`;
  } else if (file.mime_type === 'application/pdf') {
    body.innerHTML = `
      <iframe src="${rawUrl}" style="width:100%;height:70vh;border-radius:8px;border:none;background:#fff"></iframe>`;
  } else if (file.can_preview && cat === 'code') {
    // 텍스트/코드 미리보기
    try {
      const data = await fetchTextPreview(file.path);
      const ext = file.extension?.replace('.', '') || 'txt';
      body.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;color:var(--text-muted);font-size:0.85rem">
          💻 ${escHtml(file.name)} &nbsp;·&nbsp; ${escHtml(file.size_formatted)}
        </div>
        <pre class="code-preview-area"><code>${escHtml(data.content)}</code></pre>`;
    } catch (err) {
      body.innerHTML = `<div class="empty-state"><p class="empty-text">미리보기를 불러오지 못했습니다.</p><p class="empty-sub">${escHtml(err.message)}</p></div>`;
    }
  } else {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📎</div>
        <p class="empty-text">${escHtml(file.name)}</p>
        <p class="empty-sub">이 파일 형식은 브라우저에서 직접 미리보기를 지원하지 않습니다.</p>
        <a href="${getDownloadUrl(file.path)}" class="btn btn-primary" style="margin-top:1rem" download="${escHtml(file.name)}">
          ⬇ 다운로드
        </a>
      </div>`;
  }
}

export function closePreviewModal() {
  closeModal('previewModal');
  // 비디오/오디오 자동 정지
  const video = document.querySelector('#previewModal video');
  const audio = document.querySelector('#previewModal audio');
  if (video) video.pause();
  if (audio) audio.pause();
}

// ── 새 폴더 생성 모달 ────────────────────────────────────
export function openMkdirModal() {
  document.getElementById('mkdirInput').value = '';
  openModal('mkdirModal');
  setTimeout(() => document.getElementById('mkdirInput')?.focus(), 100);
}

export async function submitMkdirModal(currentPath, onSuccess, showToast) {
  const input = document.getElementById('mkdirInput');
  const folderName = input?.value?.trim();
  if (!folderName) return;

  try {
    await createFolder(currentPath, folderName);
    closeModal('mkdirModal');
    showToast(`'${folderName}' 폴더가 생성되었습니다.`, 'success');
    if (onSuccess) onSuccess();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── 이름 변경 모달 ─────────────────────────────────────────
let _renameTarget = null;

export function openRenameModal(item) {
  _renameTarget = item;
  const input = document.getElementById('renameInput');
  if (input) {
    input.value = item.name;
    // 확장자 제외 영역만 선택
    const dotIdx = item.name.lastIndexOf('.');
    if (dotIdx > 0 && !item.is_dir) {
      setTimeout(() => { input.setSelectionRange(0, dotIdx); }, 100);
    }
  }
  openModal('renameModal');
  setTimeout(() => document.getElementById('renameInput')?.focus(), 100);
}

export async function submitRenameModal(onSuccess, showToast) {
  const input = document.getElementById('renameInput');
  const newName = input?.value?.trim();
  if (!newName || !_renameTarget) return;

  try {
    await renameItem(_renameTarget.path, newName);
    closeModal('renameModal');
    showToast(`'${_renameTarget.name}' → '${newName}'으로 이름이 변경되었습니다.`, 'success');
    _renameTarget = null;
    if (onSuccess) onSuccess();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── 삭제 확인 모달 ────────────────────────────────────────
let _deleteTargets = [];

export function openDeleteModal(items) {
  _deleteTargets = Array.isArray(items) ? items : [items];
  const desc = document.getElementById('deleteModalDesc');
  if (desc) {
    if (_deleteTargets.length === 1) {
      desc.innerHTML = `<strong>${escHtml(_deleteTargets[0].name || _deleteTargets[0])}</strong> 항목을 삭제하시겠습니까?<br><small style="color:var(--danger)">삭제된 파일은 복구할 수 없습니다.</small>`;
    } else {
      desc.innerHTML = `선택한 <strong>${_deleteTargets.length}개</strong> 항목을 삭제하시겠습니까?<br><small style="color:var(--danger)">삭제된 파일은 복구할 수 없습니다.</small>`;
    }
  }
  openModal('deleteModal');
}

export async function confirmDelete(onSuccess, showToast) {
  if (!_deleteTargets.length) return;
  const paths = _deleteTargets.map(t => typeof t === 'string' ? t : t.path);

  const { deleteItems } = await import('./api.js?v=1.0');
  try {
    await deleteItems(paths);
    closeModal('deleteModal');
    showToast(`${paths.length}개 항목이 삭제되었습니다.`, 'success');
    _deleteTargets = [];
    if (onSuccess) onSuccess();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── 업로드 모달 ───────────────────────────────────────────
export function openUploadModal() {
  document.getElementById('uploadFileInput').value = '';
  const progressWrap = document.getElementById('uploadProgressWrap');
  if (progressWrap) progressWrap.innerHTML = '';
  openModal('uploadModal');
}

export function closeUploadModal() {
  closeModal('uploadModal');
}

// ── 컨텍스트 메뉴 ─────────────────────────────────────────
let _contextMenu = null;

export function showContextMenu(e, item, actions) {
  hideContextMenu();

  const menu = document.createElement('div');
  menu.id = 'ctxMenu';
  menu.style.cssText = `
    position: fixed;
    z-index: 200;
    top: ${e.clientY}px;
    left: ${e.clientX}px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-hover);
    border-radius: var(--radius-md);
    min-width: 180px;
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    animation: fadeIn 0.15s ease;
  `;

  actions.forEach(act => {
    if (act.divider) {
      const div = document.createElement('div');
      div.style.cssText = 'height:1px;background:var(--border-subtle);margin:0.25rem 0';
      menu.appendChild(div);
      return;
    }
    const btn = document.createElement('button');
    btn.style.cssText = `
      display:flex;align-items:center;gap:0.6rem;width:100%;padding:0.65rem 1rem;
      background:transparent;border:none;color:var(--text-main);cursor:pointer;
      font-size:0.9rem;font-family:inherit;text-align:left;transition:background 0.15s;
    `;
    if (act.danger) btn.style.color = '#f87171';
    btn.innerHTML = `<span>${act.icon}</span><span>${escHtml(act.label)}</span>`;
    btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,255,255,0.06)');
    btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
    btn.addEventListener('click', () => {
      hideContextMenu();
      act.action(item);
    });
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  _contextMenu = menu;

  // 화면 범위 보정
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 8}px`;
  if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 8}px`;

  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true });
  }, 10);
}

export function hideContextMenu() {
  _contextMenu?.remove();
  _contextMenu = null;
}
