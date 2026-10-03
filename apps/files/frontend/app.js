// apps/files/frontend/app.js
// MQnet Files Hub - 프론트엔드 메인 진입점
import { state } from './js/state.js?v=1.0';
import {
  fetchList, searchFiles, uploadFiles, deleteItems,
  getDownloadUrl, fetchSystemStatus
} from './js/api.js?v=1.0';
import {
  renderBreadcrumbs, renderFolderGrid, renderFileGrid, renderFileList,
  showLoading, showEmpty, showToast, updateSelectionBadge, updateStatusBar,
  setupDragDropOverlay, showUploadProgress, hideUploadProgress, escHtml
} from './js/ui.js?v=1.0';
import {
  openPreviewModal, closePreviewModal,
  openMkdirModal, submitMkdirModal,
  openRenameModal, submitRenameModal,
  openDeleteModal, confirmDelete,
  openUploadModal, closeUploadModal,
  showContextMenu
} from './js/modals.js?v=1.0';

// ── DOM 요소 참조 ─────────────────────────────────────────
const breadcrumbEl      = document.getElementById('breadcrumbsNav');
const folderContainer   = document.getElementById('folderGridContainer');
const fileContainer     = document.getElementById('fileGridContainer');
const folderSection     = document.getElementById('folderSection');
const fileSection       = document.getElementById('fileSection');
const searchInput       = document.getElementById('globalSearchInput');
const storageBadgeEl    = document.getElementById('storageInfoBadge');
const viewGridBtn       = document.getElementById('viewGridBtn');
const viewListBtn       = document.getElementById('viewListBtn');
const dropzoneOverlay   = document.getElementById('dropzoneOverlay');
const uploadFileInput   = document.getElementById('uploadFileInput');
const uploadFolderInput = document.getElementById('uploadFolderInput');
const statusBarText     = document.getElementById('statusBarText');
const selectionBadge    = document.getElementById('selectionBadge');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

// ── 탐색 ─────────────────────────────────────────────────
async function navigate(path) {
  state.isLoading = true;
  state.isSearchMode = false;
  state.searchQuery = '';
  searchInput.value = '';
  state.reset();

  showLoading(folderContainer, '');
  showLoading(fileContainer, '폴더를 불러오는 중...');

  try {
    const data = await fetchList(path);
    state.setFolderData(data);
    renderView();
    updateStatusBar({ totalCount: state.totalCount, freeSpaceText: state.freeSpaceText });

    // 스토리지 뱃지
    if (storageBadgeEl && state.freeSpaceText) {
      storageBadgeEl.innerHTML = `💾 <strong>${escHtml(state.freeSpaceText.split('/')[0]?.trim())}</strong> 여유`;
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
    renderFolderGrid(folderContainer, state.folders, navigate, (e, item) => {
      showContextMenu(e, item, buildContextMenuActions(item));
    });
  } else {
    folderSection.classList.add('hidden');
    folderContainer.innerHTML = '';
  }

  // 파일 섹션
  const files = state.filteredFiles;
  if (files.length) {
    fileSection.classList.remove('hidden');
    if (state.viewMode === 'grid') {
      renderFileGrid(fileContainer, files, onFileClick, (e, item) => {
        showContextMenu(e, item, buildContextMenuActions(item));
      });
    } else {
      renderFileList(fileContainer, files, onFileClick, (e, item) => {
        showContextMenu(e, item, buildContextMenuActions(item));
      });
    }
  } else if (!state.folders.length) {
    fileSection.classList.add('hidden');
    showEmpty(fileContainer, '📂', '이 폴더는 비어 있습니다.', '파일을 업로드하거나 새 폴더를 만들어 보세요.');
  } else {
    fileSection.classList.add('hidden');
  }

  updateSelectionBadge();
}

// ── 파일 클릭 핸들러 ──────────────────────────────────────
async function onFileClick(file) {
  if (!file.can_preview && file.category !== 'document') {
    // 미리보기 불가 파일은 다운로드
    const a = document.createElement('a');
    a.href = getDownloadUrl(file.path);
    a.download = file.name;
    a.click();
    return;
  }
  await openPreviewModal(file);
}

// ── 컨텍스트 메뉴 액션 정의 ──────────────────────────────
function buildContextMenuActions(item) {
  const actions = [];
  if (!item.is_dir) {
    actions.push({ icon: '👁', label: '미리보기', action: onFileClick });
    actions.push({ icon: '⬇', label: '다운로드', action: (f) => {
      const a = document.createElement('a');
      a.href = getDownloadUrl(f.path);
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

// ── 뷰 전환 ──────────────────────────────────────────────
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

// ── 검색 ──────────────────────────────────────────────────
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
      const res = await searchFiles(q, state.currentPath);
      state.files = res.results;
      state.filteredFiles = res.results;
      fileSection.classList.remove('hidden');
      folderSection.classList.add('hidden');
      if (state.viewMode === 'grid') {
        renderFileGrid(fileContainer, res.results, onFileClick);
      } else {
        renderFileList(fileContainer, res.results, onFileClick);
      }
      updateStatusBar({ totalCount: res.count });
    } catch (err) {
      showEmpty(fileContainer, '🔍', '검색 실패', err.message);
    }
  }, 350);
});

// ── 업로드 ────────────────────────────────────────────────
async function handleFileUpload(files) {
  if (!files?.length) return;
  const progressWrap = document.getElementById('uploadProgressWrap');
  const uploadBtn = document.getElementById('uploadSubmitBtn');
  if (uploadBtn) uploadBtn.disabled = true;

  try {
    await uploadFiles(state.currentPath, files, (pct) => {
      if (progressWrap) {
        progressWrap.innerHTML = `
          <div style="background:rgba(255,255,255,0.06);border-radius:8px;overflow:hidden;margin:0.5rem 0">
            <div style="height:8px;background:linear-gradient(135deg,#6366f1,#38bdf8);width:${pct}%;transition:width 0.2s;border-radius:8px"></div>
          </div>
          <div style="text-align:center;font-size:0.82rem;color:#94a3b8">${pct}% 업로드 중...</div>`;
      }
    });
    closeUploadModal();
    showToast(`${files.length}개 파일 업로드가 완료되었습니다.`, 'success');
    await navigate(state.currentPath);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (uploadBtn) uploadBtn.disabled = false;
  }
}

// 드래그 앤 드롭
setupDragDropOverlay(dropzoneOverlay, (fileList) => handleFileUpload(fileList));

// 파일 선택 업로드 버튼
document.getElementById('toolbarUploadBtn')?.addEventListener('click', () => {
  uploadFileInput?.click();
});
document.getElementById('fabUploadBtn')?.addEventListener('click', () => {
  uploadFileInput?.click();
});
uploadFileInput?.addEventListener('change', () => {
  if (uploadFileInput.files.length) {
    handleFileUpload(uploadFileInput.files);
  }
});
// 폴더 업로드
document.getElementById('toolbarUploadFolderBtn')?.addEventListener('click', () => {
  uploadFolderInput?.click();
});
uploadFolderInput?.addEventListener('change', () => {
  if (uploadFolderInput.files.length) {
    handleFileUpload(uploadFolderInput.files);
  }
});

// ── 새 폴더 버튼 ─────────────────────────────────────────
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

// ── 선택 삭제 ─────────────────────────────────────────────
deleteSelectedBtn?.addEventListener('click', () => {
  const selected = [...state.selectedPaths].map(p => ({ path: p, name: p.split('/').pop() }));
  openDeleteModal(selected);
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
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
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
  // URL 파라미터에서 초기 폴더 경로 읽기
  const params = new URLSearchParams(window.location.search);
  const initPath = params.get('folder') || '';
  await navigate(initPath);
}

init();
