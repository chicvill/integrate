// apps/files/frontend/app.js
// MQnet Files Hub - 프론트엔드 메인 진입점
import { state } from './js/state.js?v=1.1';
import {
  fetchList, searchFiles, uploadFiles, deleteItems,
  getDownloadUrl, fetchSystemStatus
} from './js/api.js?v=1.1';
import {
  renderBreadcrumbs, renderFolderGrid, renderFileGrid, renderFileList,
  showLoading, showEmpty, showToast, updateStatusBar, updateSelectionToolbar,
  setupDragDropOverlay, escHtml
} from './js/ui.js?v=1.1';
import {
  openPreviewModal, closePreviewModal,
  openTextEditModal, submitTextEditModal,
  openMkdirModal, submitMkdirModal,
  openRenameModal, submitRenameModal,
  openDeleteModal, confirmDelete,
  openUploadModal, closeUploadModal,
  showContextMenu
} from './js/modals.js?v=1.1';

// ── DOM 요소 참조 ─────────────────────────────────────────
const breadcrumbEl      = document.getElementById('breadcrumbsNav');
const folderContainer   = document.getElementById('folderGridContainer');
const fileContainer     = document.getElementById('fileGridContainer');
const folderSection     = document.getElementById('folderSection');
const fileSection       = document.getElementById('fileSection');
const searchInput       = document.getElementById('globalSearchInput');
const storageBadgeEl    = document.getElementById('storageInfoBadge');
const scopeSelect       = document.getElementById('scopeSelect');
const viewGridBtn       = document.getElementById('viewGridBtn');
const viewListBtn       = document.getElementById('viewListBtn');
const dropzoneOverlay   = document.getElementById('dropzoneOverlay');
const uploadFileInput   = document.getElementById('uploadFileInput');
const uploadFolderInput = document.getElementById('uploadFolderInput');

// 선택 툴바 버튼들
const selEditBtn        = document.getElementById('selEditBtn');
const selRenameBtn      = document.getElementById('selRenameBtn');
const selDeleteBtn      = document.getElementById('selDeleteBtn');
const selDownloadBtn    = document.getElementById('selDownloadBtn');
const selPreviewBtn     = document.getElementById('selPreviewBtn');
const selClearBtn       = document.getElementById('selClearBtn');
const selectAllBtn      = document.getElementById('selectAllBtn');

// ── 탐색 (Navigate) ───────────────────────────────────────
async function navigate(path) {
  state.isLoading = true;
  state.isSearchMode = false;
  state.searchQuery = '';
  if (searchInput) searchInput.value = '';
  state.reset();

  showLoading(folderContainer, '');
  showLoading(fileContainer, '폴더를 불러오는 중...');

  try {
    const data = await fetchList(path, state.scope);
    state.setFolderData(data);
    renderView();
    updateStatusBar({ totalCount: state.totalCount, freeSpaceText: state.freeSpaceText });

    // 스토리지 뱃지
    if (storageBadgeEl) {
      const freeStr = state.freeSpaceText ? state.freeSpaceText.split('/')[0]?.trim() : '';
      storageBadgeEl.innerHTML = `💾 <strong>${escHtml(freeStr || '정상')}</strong> 여유 · <span style="opacity:0.75">${escHtml(state.storageRoot)}</span>`;
    }

    // 브레드크럼
    renderBreadcrumbs(breadcrumbEl, state.breadcrumbs, navigate);
  } catch (err) {
    showEmpty(fileContainer, '❌', '폴더를 불러오지 못했습니다.', err.message);
    folderContainer.innerHTML = '';
    showToast(err.message, 'error');
  } finally {
    state.isLoading = false;
  }
}

// ── 렌더링 ────────────────────────────────────────────────
function renderView() {
  // 폴더 섹션
  if (state.folders.length) {
    folderSection.classList.remove('hidden');
    renderFolderGrid(
      folderContainer,
      state.folders,
      navigate,
      onToggleSelect,
      (e, item) => showContextMenu(e, item, buildContextMenuActions(item))
    );
  } else {
    folderSection.classList.add('hidden');
    folderContainer.innerHTML = '';
  }

  // 파일 섹션
  const files = state.filteredFiles;
  if (files.length) {
    fileSection.classList.remove('hidden');
    if (state.viewMode === 'grid') {
      renderFileGrid(
        fileContainer,
        files,
        onFileClick,
        onToggleSelect,
        (e, item) => showContextMenu(e, item, buildContextMenuActions(item))
      );
    } else {
      renderFileList(
        fileContainer,
        files,
        onFileClick,
        onToggleSelect,
        (e, item) => showContextMenu(e, item, buildContextMenuActions(item))
      );
    }
  } else if (!state.folders.length) {
    fileSection.classList.add('hidden');
    showEmpty(fileContainer, '📂', '이 폴더는 비어 있습니다.', '파일을 업로드하거나 새 폴더를 만들어 보세요.');
  } else {
    fileSection.classList.add('hidden');
  }

  updateSelectionToolbar();
}

// ── 선택 토글 핸들러 ──────────────────────────────────────
function onToggleSelect(path) {
  state.toggleSelect(path);
  // UI 요소의 선택 클래스 즉시 동기화
  document.querySelectorAll(`[data-path="${CSS.escape(path)}"]`).forEach(el => {
    const isSelected = state.selectedPaths.has(path);
    el.classList.toggle('selected', isSelected);
    const chk = el.querySelector('.item-checkbox');
    if (chk) {
      chk.classList.toggle('checked', isSelected);
      chk.textContent = isSelected ? '✓' : '';
    }
  });
  updateSelectionToolbar();
}

// ── 파일 클릭 / 더블클릭 핸들러 ───────────────────────────
async function onFileClick(file) {
  if (!file) return;

  // 텍스트/코드/문서 파일인 경우
  if (file.category === 'code' || file.extension in { '.txt': 1, '.md': 1, '.json': 1, '.js': 1, '.html': 1, '.css': 1, '.py': 1, '.yml': 1, '.yaml': 1 }) {
    await openPreviewModal(file);
    return;
  }

  // 이미지, 비디오, 오디오, PDF 미리보기
  if (file.can_preview || file.category === 'image' || file.category === 'video' || file.category === 'audio' || file.mime_type === 'application/pdf') {
    await openPreviewModal(file);
    return;
  }

  // 기타 파일은 바로 다운로드
  const a = document.createElement('a');
  a.href = getDownloadUrl(file.path, state.scope);
  a.download = file.name;
  a.click();
}

// ── 컨텍스트 메뉴 액션 정의 ──────────────────────────────
function buildContextMenuActions(item) {
  const actions = [];
  if (!item.is_dir) {
    actions.push({ icon: '👁', label: '미리보기', action: onFileClick });
    
    // 텍스트/코드 파일인 경우 직접 편집 액션 제공
    const isText = item.category === 'code' || item.extension in { '.txt': 1, '.md': 1, '.json': 1, '.js': 1, '.html': 1, '.css': 1, '.py': 1, '.yml': 1, '.yaml': 1 };
    if (isText) {
      actions.push({ icon: '📝', label: '내용 편집', action: (f) => openTextEditModal(f) });
    }

    actions.push({ icon: '⬇', label: '다운로드', action: (f) => {
      const a = document.createElement('a');
      a.href = getDownloadUrl(f.path, state.scope);
      a.download = f.name;
      a.click();
    }});
    actions.push({ divider: true });
  }

  actions.push({ icon: '✏️', label: '이름 변경', action: (f) => {
    openRenameModal(f);
  }});
  actions.push({ icon: '🗑', label: '삭제', danger: true, action: (f) => {
    openDeleteModal([f]);
  }});
  return actions;
}

// ── 스코프 (저장소 위치) 전환 ─────────────────────────────
scopeSelect?.addEventListener('change', (e) => {
  state.scope = e.target.value;
  state.currentPath = '';
  navigate('');
});

// ── 선택 툴바 액션 바인딩 ────────────────────────────────
// 1. 이름 변경
selRenameBtn?.addEventListener('click', () => {
  if (state.selectedPaths.size !== 1) return;
  const path = Array.from(state.selectedPaths)[0];
  const item = state.folders.find(f => f.path === path) || state.files.find(f => f.path === path);
  if (item) openRenameModal(item);
});

// 2. 내용 편집 (텍스트 파일)
selEditBtn?.addEventListener('click', () => {
  if (state.selectedPaths.size !== 1) return;
  const path = Array.from(state.selectedPaths)[0];
  const file = state.files.find(f => f.path === path);
  if (file) openTextEditModal(file);
});

// 3. 미리보기
selPreviewBtn?.addEventListener('click', () => {
  if (state.selectedPaths.size !== 1) return;
  const path = Array.from(state.selectedPaths)[0];
  const file = state.files.find(f => f.path === path);
  if (file) onFileClick(file);
});

// 4. 선택 다운로드
selDownloadBtn?.addEventListener('click', () => {
  state.selectedPaths.forEach(path => {
    const file = state.files.find(f => f.path === path);
    if (file) {
      const a = document.createElement('a');
      a.href = getDownloadUrl(file.path, state.scope);
      a.download = file.name;
      a.click();
    }
  });
});

// 5. 선택 삭제
selDeleteBtn?.addEventListener('click', () => {
  const selected = Array.from(state.selectedPaths).map(p => {
    const item = state.folders.find(f => f.path === p) || state.files.find(f => f.path === p);
    return item || { path: p, name: p.split('/').pop() };
  });
  if (selected.length) openDeleteModal(selected);
});

// 6. 선택 해제
selClearBtn?.addEventListener('click', () => {
  state.clearSelection();
  renderView();
});

// 7. 전체 선택
selectAllBtn?.addEventListener('click', () => {
  state.selectAll();
  renderView();
});

// ── 텍스트 에디터 모달 저장 버튼 바인딩 ─────────────────────
document.getElementById('textEditSaveBtn')?.addEventListener('click', () => {
  submitTextEditModal(() => navigate(state.currentPath), showToast);
});

// ── 필터 ─────────────────────────────────────────────────
document.querySelectorAll('.filter-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    state.activeFilter = pill.dataset.filter || 'all';
    state.applyFilterAndSort();
    renderView();
  });
});

// ── 뷰 전환 (그리드 ↔ 리스트) ─────────────────────────────
viewGridBtn?.addEventListener('click', () => {
  state.viewMode = 'grid';
  viewGridBtn.classList.add('active');
  viewListBtn.classList.remove('active');
  renderView();
});

viewListBtn?.addEventListener('click', () => {
  state.viewMode = 'list';
  viewListBtn.classList.add('active');
  viewGridBtn.classList.remove('active');
  renderView();
});

// ── 실시간 디바운스 검색 ──────────────────────────────────
let _searchDebounce = null;
searchInput?.addEventListener('input', () => {
  clearTimeout(_searchDebounce);
  const q = searchInput.value.trim();
  _searchDebounce = setTimeout(async () => {
    if (!q) {
      state.searchQuery = '';
      state.isSearchMode = false;
      state.applyFilterAndSort();
      renderView();
      return;
    }
    state.searchQuery = q;
    state.isSearchMode = true;
    showLoading(fileContainer, `"${q}" 검색 중...`);
    try {
      const res = await searchFiles(q, state.currentPath, state.scope);
      state.files = res.results;
      state.filteredFiles = res.results;
      fileSection.classList.remove('hidden');
      folderSection.classList.add('hidden');
      if (state.viewMode === 'grid') {
        renderFileGrid(fileContainer, res.results, onFileClick, onToggleSelect);
      } else {
        renderFileList(fileContainer, res.results, onFileClick, onToggleSelect);
      }
      updateStatusBar({ totalCount: res.count });
    } catch (err) {
      showEmpty(fileContainer, '🔍', '검색 실패', err.message);
    }
  }, 350);
});

// ── 업로드 처리 ───────────────────────────────────────────
async function handleFileUpload(files) {
  if (!files?.length) return;
  showToast(`${files.length}개 파일 업로드를 시작합니다...`, 'info');

  try {
    await uploadFiles(state.currentPath, files, null, state.scope);
    closeUploadModal();
    showToast(`${files.length}개 파일 업로드가 완료되었습니다.`, 'success');
    await navigate(state.currentPath);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// 드래그 앤 드롭
if (dropzoneOverlay) {
  setupDragDropOverlay(dropzoneOverlay, (fileList) => handleFileUpload(fileList));
}

// 툴바 업로드 버튼
document.getElementById('toolbarUploadBtn')?.addEventListener('click', () => {
  uploadFileInput?.click();
});
uploadFileInput?.addEventListener('change', () => {
  if (uploadFileInput.files.length) {
    handleFileUpload(uploadFileInput.files);
  }
});

// 폴더 업로드 버튼
document.getElementById('toolbarUploadFolderBtn')?.addEventListener('click', () => {
  uploadFolderInput?.click();
});
uploadFolderInput?.addEventListener('change', () => {
  if (uploadFolderInput.files.length) {
    handleFileUpload(uploadFolderInput.files);
  }
});

// ── 새 폴더 만들기 ────────────────────────────────────────
document.getElementById('mkdirBtn')?.addEventListener('click', openMkdirModal);
document.getElementById('mkdirSubmitBtn')?.addEventListener('click', () => {
  submitMkdirModal(state.currentPath, () => navigate(state.currentPath), showToast);
});
document.getElementById('mkdirInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitMkdirModal(state.currentPath, () => navigate(state.currentPath), showToast);
});

// ── 이름 변경 / 삭제 모달 연결 ───────────────────────────
document.getElementById('renameSubmitBtn')?.addEventListener('click', () => {
  submitRenameModal(() => navigate(state.currentPath), showToast);
});
document.getElementById('renameInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitRenameModal(() => navigate(state.currentPath), showToast);
});
document.getElementById('deleteConfirmBtn')?.addEventListener('click', () => {
  confirmDelete(() => navigate(state.currentPath), showToast);
});

// ── 미리보기 모달 닫기 ────────────────────────────────────
document.getElementById('previewModalCloseBtn')?.addEventListener('click', closePreviewModal);

// ── 모달 닫기 버튼들 ─────────────────────────────────────
document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.closeModal;
    document.getElementById(target)?.classList.remove('open');
  });
});

// ── 검색 단축키 (/) ──────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    searchInput?.focus();
  }
  if (e.key === 'Escape') {
    if (state.searchQuery) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
    }
  }
});

// ── 앱 초기화 ─────────────────────────────────────────────
async function init() {
  const params = new URLSearchParams(window.location.search);
  const initScope = params.get('scope') || 'files';
  const initPath = params.get('folder') || '';

  state.scope = initScope;
  if (scopeSelect) scopeSelect.value = initScope;

  await navigate(initPath);
}

init();
