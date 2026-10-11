import { state } from './js/state.js?v=1.4';
import { MQnetAuth } from '/shared/ui/auth.js?v=2.0';
import {
  fetchList, searchFiles, uploadFiles, deleteItems, copyItems, moveItems,
  getDownloadUrl, fetchSystemStatus, fetchQuota, upgradePlan
} from './js/api.js?v=1.4';
import {
  renderBreadcrumbs, renderFolderGrid, renderFileGrid, renderFileList,
  showLoading, showEmpty, showToast, updateStatusBar, updateSelectionToolbar,
  renderStorageQuotaWidget, setupDragDropOverlay, escHtml,
  syncSelectionUI, setupMarqueeSelection
} from './js/ui.js?v=1.4';
import {
  openPreviewModal, closePreviewModal,
  openTextEditModal, submitTextEditModal,
  openMkdirModal, submitMkdirModal,
  openRenameModal, submitRenameModal,
  openDeleteModal, confirmDelete,
  openUploadModal, closeUploadModal,
  openUpgradeModal, closeModal,
  showContextMenu
} from './js/modals.js?v=1.4';


// ── DOM 요소 참조 ─────────────────────────────────────────
const breadcrumbEl      = document.getElementById('breadcrumbsNav');
const folderContainer   = document.getElementById('folderGridContainer');
const fileContainer     = document.getElementById('fileGridContainer');
const folderSection     = document.getElementById('folderSection');
const fileSection       = document.getElementById('fileSection');
const mainViewport      = document.getElementById('mainViewport');
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
const selCopyBtn        = document.getElementById('selCopyBtn');
const selCutBtn         = document.getElementById('selCutBtn');
const selPasteBtn       = document.getElementById('selPasteBtn');
const selectAllBtn      = document.getElementById('selectAllBtn');
const toolbarPasteBtn   = document.getElementById('toolbarPasteBtn');


// 유료 전환 모달 버튼들
const confirmUpgradeBtn = document.getElementById('confirmUpgradeBtn');
const resetFreeBtn      = document.getElementById('resetFreeBtn');

// ── 스토리지 쿼터 및 실시간 사용량 갱신 ───────────────────
async function refreshQuota() {
  try {
    const quota = await fetchQuota(state.scope, state.currentUser);
    state.quota = quota;
    renderStorageQuotaWidget(storageBadgeEl, quota, () => openUpgradeModal(quota));
  } catch (err) {
    console.warn('쿼터 정보 조회 실패:', err);
  }
}

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

    // 실시간 스토리지 쿼터 게이지 위젯 갱신
    await refreshQuota();

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

// ── 복사 / 잘라내기 / 붙여넣기 핸들러 ──────────────────────
function handleCopy() {
  if (!state.selectedPaths.size) return;
  const paths = Array.from(state.selectedPaths);
  state.setClipboard('copy', paths, state.scope);
  showToast(`${paths.length}개 항목이 복사되었습니다. (붙여넣기: Ctrl+V)`, 'info');
  syncSelectionUI();
}

function handleCut() {
  if (!state.selectedPaths.size) return;
  const paths = Array.from(state.selectedPaths);
  state.setClipboard('cut', paths, state.scope);
  showToast(`${paths.length}개 항목이 잘라내기되었습니다. 이동할 대상 위치에서 붙여넣기(Ctrl+V)하세요.`, 'info');
  syncSelectionUI();
}

async function handlePaste() {
  if (!state.clipboard?.paths?.length) {
    showToast('클립보드에 붙여넣을 항목이 없습니다.', 'info');
    return;
  }

  const { action, paths, scope } = state.clipboard;
  const destFolder = state.currentPath;

  showToast(`${paths.length}개 항목 ${action === 'cut' ? '이동' : '복사'} 처리 중...`, 'info');

  try {
    if (action === 'cut') {
      await moveItems(paths, destFolder, scope);
      state.clearClipboard();
      showToast(`${paths.length}개 항목이 성공적으로 이동되었습니다.`, 'success');
    } else {
      await copyItems(paths, destFolder, scope);
      showToast(`${paths.length}개 항목이 성공적으로 복사되었습니다.`, 'success');
    }
    await navigate(state.currentPath);
    await refreshQuota();
  } catch (err) {
    if (err.message && err.message.includes('QUOTA_EXCEEDED')) {
      openUpgradeModal(state.quota, '저장 용량 쿼터 한도를 초과하여 복사할 수 없습니다.');
    } else {
      showToast(err.message, 'error');
    }
  } finally {
    syncSelectionUI();
  }
}

// ── 컨텍스트 메뉴 액션 정의 ──────────────────────────────
function buildContextMenuActions(item) {
  const actions = [];
  const selectedCount = state.selectedPaths.size;

  if (item && !item.is_dir) {
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

  // 복사 / 이동 액션 (선택 항목 기준)
  if (selectedCount > 0) {
    actions.push({ icon: '📋', label: selectedCount > 1 ? `복사 (${selectedCount}개)` : '복사', action: handleCopy });
    actions.push({ icon: '✂️', label: selectedCount > 1 ? `이동 (${selectedCount}개)` : '이동', action: handleCut });
  }

  // 클립보드에 붙여넣을 항목이 있을 때
  if (state.clipboard?.paths?.length) {
    const actLabel = state.clipboard.action === 'cut' ? '이동' : '복사';
    actions.push({ icon: '📥', label: `붙여넣기 (${state.clipboard.paths.length}개 ${actLabel})`, action: handlePaste });
  }

  actions.push({ divider: true });

  if (item && selectedCount <= 1) {
    actions.push({ icon: '✏️', label: '이름 변경', action: (f) => openRenameModal(f) });
  }

  if (selectedCount > 0) {
    actions.push({ icon: '🗑', label: selectedCount > 1 ? `삭제 (${selectedCount}개)` : '삭제', danger: true, action: (f) => {
      const selected = Array.from(state.selectedPaths).map(p => {
        const it = state.folders.find(fd => fd.path === p) || state.files.find(fl => fl.path === p);
        return it || { path: p, name: p.split('/').pop() };
      });
      openDeleteModal(selected.length ? selected : [f]);
    }});
  }

  return actions;
}

// ── 스코프 (저장소 위치) 전환 ─────────────────────────────
scopeSelect?.addEventListener('change', (e) => {
  state.scope = e.target.value;
  state.currentPath = '';
  navigate('');
});

// ── 선택 툴바 액션 바인딩 ────────────────────────────────
selCopyBtn?.addEventListener('click', handleCopy);
selCutBtn?.addEventListener('click', handleCut);
selPasteBtn?.addEventListener('click', handlePaste);
toolbarPasteBtn?.addEventListener('click', handlePaste);

selRenameBtn?.addEventListener('click', () => {
  if (state.selectedPaths.size !== 1) return;
  const path = Array.from(state.selectedPaths)[0];
  const item = state.folders.find(f => f.path === path) || state.files.find(f => f.path === path);
  if (item) openRenameModal(item);
});

selEditBtn?.addEventListener('click', () => {
  if (state.selectedPaths.size !== 1) return;
  const path = Array.from(state.selectedPaths)[0];
  const file = state.files.find(f => f.path === path);
  if (file) openTextEditModal(file);
});

selPreviewBtn?.addEventListener('click', () => {
  if (state.selectedPaths.size !== 1) return;
  const path = Array.from(state.selectedPaths)[0];
  const file = state.files.find(f => f.path === path);
  if (file) onFileClick(file);
});

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

selDeleteBtn?.addEventListener('click', () => {
  const selected = Array.from(state.selectedPaths).map(p => {
    const item = state.folders.find(f => f.path === p) || state.files.find(f => f.path === p);
    return item || { path: p, name: p.split('/').pop() };
  });
  if (selected.length) openDeleteModal(selected);
});

selClearBtn?.addEventListener('click', () => {
  state.clearSelection();
  syncSelectionUI();
});

selectAllBtn?.addEventListener('click', () => {
  state.selectAll();
  syncSelectionUI();
});


// ── 텍스트 에디터 모달 저장 버튼 ──────────────────────────
document.getElementById('textEditSaveBtn')?.addEventListener('click', () => {
  submitTextEditModal(() => {
    navigate(state.currentPath);
    refreshQuota();
  }, showToast);
});

// ── 유료 전환 및 플랜 변경 이벤트 (★ 테스트 연동) ─────────
confirmUpgradeBtn?.addEventListener('click', async () => {
  confirmUpgradeBtn.disabled = true;
  try {
    const res = await upgradePlan('pro', state.currentUser);
    closeModal('upgradeModal');
    showToast('🎉 축하합니다! MQnet Pro 플랜(10GB)으로 업그레이드되었습니다.', 'success');
    await refreshQuota();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    confirmUpgradeBtn.disabled = false;
  }
});

resetFreeBtn?.addEventListener('click', async () => {
  resetFreeBtn.disabled = true;
  try {
    const res = await upgradePlan('free', state.currentUser);
    closeModal('upgradeModal');
    showToast('무료 플랜(500KB 한도)으로 재설정되었습니다.', 'info');
    await refreshQuota();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    resetFreeBtn.disabled = false;
  }
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

// ── 업로드 처리 (★ 500KB 쿼터 초과 시 유료 전환 모달 자동 팝업) ──
async function handleFileUpload(files) {
  if (!files?.length) return;
  showToast(`${files.length}개 파일 업로드를 검증 및 시작합니다...`, 'info');

  try {
    await uploadFiles(state.currentPath, files, null, state.scope, state.currentUser);
    closeUploadModal();
    showToast(`${files.length}개 파일 업로드가 완료되었습니다.`, 'success');
    await navigate(state.currentPath);
    await refreshQuota();
  } catch (err) {
    // ★ 500KB 쿼터 초과(403 QUOTA_EXCEEDED) 시 즉시 유료 전환 안내 모달 팝업
    if (err.detail?.error === 'QUOTA_EXCEEDED' || err.status === 403) {
      const quotaInfo = err.detail?.quota_info || state.quota;
      openUpgradeModal(quotaInfo, err.detail?.message);
    } else {
      showToast(err.message, 'error');
    }
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
  submitRenameModal(() => {
    navigate(state.currentPath);
    refreshQuota();
  }, showToast);
});
document.getElementById('renameInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitRenameModal(() => {
    navigate(state.currentPath);
    refreshQuota();
  }, showToast);
});
document.getElementById('deleteConfirmBtn')?.addEventListener('click', () => {
  confirmDelete(() => {
    navigate(state.currentPath);
    refreshQuota();
  }, showToast);
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

// ── Windows 파일 탐색기 단축키 및 전역 단축키 ─────────────
document.addEventListener('keydown', (e) => {
  const isInputActive = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  const isModalOpen = document.querySelector('.modal-backdrop.open');

  // 입력창 포커스 중이거나 모달이 열려있으면 탐색기 단축키 비활성화
  if (isInputActive || isModalOpen) {
    if (e.key === 'Escape' && state.searchQuery && !isModalOpen) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
    }
    return;
  }

  // Ctrl / Cmd 조합 키
  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase();
    if (key === 'a') {
      // Ctrl + A: 전체 선택
      e.preventDefault();
      state.selectAll();
      syncSelectionUI();
    } else if (key === 'c') {
      // Ctrl + C: 복사
      e.preventDefault();
      handleCopy();
    } else if (key === 'x') {
      // Ctrl + X: 잘라내기 / 이동
      e.preventDefault();
      handleCut();
    } else if (key === 'v') {
      // Ctrl + V: 붙여넣기
      e.preventDefault();
      handlePaste();
    }
    return;
  }

  // Delete 키: 선택 항목 일괄 삭제
  if (e.key === 'Delete') {
    if (state.selectedPaths.size > 0) {
      e.preventDefault();
      selDeleteBtn?.click();
    }
    return;
  }

  // Escape 키: 선택 해제
  if (e.key === 'Escape') {
    if (state.selectedPaths.size > 0) {
      e.preventDefault();
      state.clearSelection();
      syncSelectionUI();
    }
    return;
  }

  // 검색창 포커스 단축키 (/)
  if (e.key === '/') {
    e.preventDefault();
    searchInput?.focus();
  }
});

// ── 뷰포트 빈 영역 우클릭 컨텍스트 메뉴 ───────────────────
mainViewport?.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.folder-card, .file-icon-card, .file-table-row, button, input, select, textarea, a, .breadcrumbs')) {
    return;
  }
  e.preventDefault();
  const bgActions = [
    { icon: '📁', label: '새 폴더 만들기', action: openMkdirModal },
    { icon: '⬆', label: '파일 업로드', action: () => uploadFileInput?.click() },
    { icon: '📂', label: '폴더 업로드', action: () => uploadFolderInput?.click() }
  ];
  if (state.clipboard?.paths?.length) {
    const actLabel = state.clipboard.action === 'cut' ? '이동' : '복사';
    bgActions.unshift({
      icon: '📥',
      label: `붙여넣기 (${state.clipboard.paths.length}개 ${actLabel})`,
      action: handlePaste
    });
  }
  bgActions.push({ divider: true });
  bgActions.push({ icon: '✓', label: '전체 선택 (Ctrl+A)', action: () => { state.selectAll(); syncSelectionUI(); } });
  showContextMenu(e, null, bgActions);
});

// ── 마우스 드래그 선택 (Marquee) 초기화 ───────────────────
if (mainViewport) {
  setupMarqueeSelection(mainViewport, () => {
    updateSelectionToolbar();
  });
}


// ── 앱 초기화 ─────────────────────────────────────────────
async function init() {
  const params = new URLSearchParams(window.location.search);
  const initScope = params.get('scope') || 'files';
  const initPath = params.get('folder') || '';

  state.scope = initScope;
  if (scopeSelect) scopeSelect.value = initScope;

  // 🔑 MQnet 통합 인증 초기화 및 배지 부착
  MQnetAuth.init({
    appId: 'files',
    autoPrompt: true,
    onAuthChange: (user) => {
      state.currentUser = user ? user.id : 'demo_user';
      navigate('');
    }
  });
  MQnetAuth.renderBadge('userAuthBadge');

  const u = MQnetAuth.getUser();
  if (u) {
    state.currentUser = u.id;
  }

  await navigate(initPath);
  await refreshQuota();
}

init();
