// apps/files/frontend/js/modals.js
// MQnet Files Hub - 모달 및 다이얼로그 제어
import { escHtml } from './ui.js?v=1.1';
import { getRawUrl, getDownloadUrl, fetchTextPreview, saveTextFile, createFolder, renameItem, deleteItems } from './api.js?v=1.1';
import { state } from './state.js?v=1.1';

// ── 모달 열기/닫기 헬퍼 ─────────────────────────────────
export function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}

export function closeModal(id) {
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
  downloadBtn.href = getDownloadUrl(file.path, state.scope);
  downloadBtn.download = file.name;
  body.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted)">⚙️ 로딩 중...</div>`;
  openModal('previewModal');

  const rawUrl = getRawUrl(file.path, state.scope);
  const cat = file.category;

  if (cat === 'image') {
    body.innerHTML = `
      <div class="preview-media-container" style="display:flex;align-items:center;justify-content:center;min-height:300px">
        <img src="${rawUrl}" alt="${escHtml(file.name)}" style="max-width:100%;max-height:75vh;object-fit:contain;border-radius:8px">
      </div>`;
  } else if (cat === 'video') {
    body.innerHTML = `
      <div class="preview-media-container" style="display:flex;justify-content:center">
        <video controls autoplay style="max-width:100%;max-height:75vh;border-radius:8px">
          <source src="${rawUrl}" type="${file.mime_type}">
          <p>이 브라우저에서 동영상 재생을 지원하지 않습니다.</p>
        </video>
      </div>`;
  } else if (cat === 'audio') {
    body.innerHTML = `
      <div class="preview-media-container" style="padding:2rem 1rem">
        <div style="text-align:center;margin-bottom:1.5rem;font-size:4rem">🎵</div>
        <audio controls autoplay style="width:100%">
          <source src="${rawUrl}" type="${file.mime_type}">
          <p>이 브라우저에서 오디오 재생을 지원하지 않습니다.</p>
        </audio>
      </div>`;
  } else if (file.mime_type === 'application/pdf') {
    body.innerHTML = `
      <iframe src="${rawUrl}" style="width:100%;height:75vh;border-radius:8px;border:none;background:#fff"></iframe>`;
  } else if (file.can_preview && (cat === 'code' || cat === 'document')) {
    // 텍스트/코드 미리보기
    try {
      const data = await fetchTextPreview(file.path, state.scope);
      body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;color:var(--text-muted);font-size:0.85rem">
          <span>💻 ${escHtml(file.name)} &nbsp;·&nbsp; ${escHtml(file.size_formatted)}</span>
          <button class="btn btn-secondary btn-sm" id="previewEditBtn" style="font-size:0.8rem;padding:0.3rem 0.6rem">📝 이 파일 편집하기</button>
        </div>
        <pre class="code-preview-area" style="max-height:65vh;overflow:auto;background:rgba(0,0,0,0.4);padding:1rem;border-radius:8px;font-family:monospace;font-size:0.85rem;line-height:1.6"><code>${escHtml(data.content)}</code></pre>`;
      
      document.getElementById('previewEditBtn')?.addEventListener('click', () => {
        closePreviewModal();
        openTextEditModal(file);
      });
    } catch (err) {
      body.innerHTML = `<div class="empty-state"><p class="empty-text">미리보기를 불러오지 못했습니다.</p><p class="empty-sub">${escHtml(err.message)}</p></div>`;
    }
  } else {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📎</div>
        <p class="empty-text" style="font-weight:700;font-size:1.1rem;margin-top:0.5rem">${escHtml(file.name)}</p>
        <p class="empty-sub" style="color:var(--text-muted);margin-top:0.5rem">이 파일 형식은 브라우저 인라인 미리보기를 지원하지 않습니다.</p>
        <a href="${getDownloadUrl(file.path, state.scope)}" class="btn btn-primary" style="margin-top:1.5rem" download="${escHtml(file.name)}">
          ⬇ 파일 다운로드 (${escHtml(file.size_formatted)})
        </a>
      </div>`;
  }
}

export function closePreviewModal() {
  closeModal('previewModal');
  const video = document.querySelector('#previewModal video');
  const audio = document.querySelector('#previewModal audio');
  if (video) video.pause();
  if (audio) audio.pause();
}

// ── 텍스트 파일 편집 모달 (★ 텍스트/코드 직접 편집) ─────────
let _editTargetFile = null;

export async function openTextEditModal(file) {
  _editTargetFile = file;
  const modal = document.getElementById('textEditModal');
  const title = document.getElementById('textEditTitle');
  const textarea = document.getElementById('textEditArea');
  const pathLabel = document.getElementById('textEditPath');

  if (!modal || !textarea) return;

  title.textContent = `📝 파일 편집: ${file.name}`;
  if (pathLabel) pathLabel.textContent = file.path;
  textarea.value = '파일 내용을 불러오는 중...';
  textarea.disabled = true;
  openModal('textEditModal');

  try {
    const data = await fetchTextPreview(file.path, state.scope);
    textarea.value = data.content || '';
    textarea.disabled = false;
    textarea.focus();
  } catch (err) {
    textarea.value = `파일을 불러올 수 없습니다: ${err.message}`;
    textarea.disabled = true;
  }
}

export async function submitTextEditModal(onSuccess, showToast) {
  if (!_editTargetFile) return;
  const textarea = document.getElementById('textEditArea');
  const saveBtn = document.getElementById('textEditSaveBtn');
  if (!textarea || textarea.disabled) return;

  const content = textarea.value;
  if (saveBtn) saveBtn.disabled = true;

  try {
    await saveTextFile(_editTargetFile.path, content, state.scope);
    closeModal('textEditModal');
    showToast(`'${_editTargetFile.name}' 파일이 저장되었습니다.`, 'success');
    _editTargetFile = null;
    if (onSuccess) onSuccess();
  } catch (err) {
    showToast(`저장 실패: ${err.message}`, 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
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
    await createFolder(currentPath, folderName, state.scope);
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
    await renameItem(_renameTarget.path, newName, state.scope);
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
      const name = _deleteTargets[0].name || _deleteTargets[0].path || _deleteTargets[0];
      desc.innerHTML = `<strong>${escHtml(name)}</strong> 항목을 삭제하시겠습니까?<br><small style="color:var(--danger)">삭제된 파일은 복구할 수 없습니다.</small>`;
    } else {
      desc.innerHTML = `선택한 <strong>${_deleteTargets.length}개</strong> 항목을 삭제하시겠습니까?<br><small style="color:var(--danger)">삭제된 파일은 복구할 수 없습니다.</small>`;
    }
  }
  openModal('deleteModal');
}

export async function confirmDelete(onSuccess, showToast) {
  if (!_deleteTargets.length) return;
  const paths = _deleteTargets.map(t => typeof t === 'string' ? t : t.path);

  try {
    await deleteItems(paths, state.scope);
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
