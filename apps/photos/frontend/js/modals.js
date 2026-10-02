import { $, state, formatBytes, saveFavorites } from './state.js';
import { createFolderApi, deleteItemApi, batchDeleteApi, batchMoveApi, moveItemApi, fetchFoldersApi, fetchDuplicatesApi } from './api.js';
import { copyLinkToClipboard, renderGallery, shareItem } from './ui.js';

// ── Lightbox Controller ────────────────────────────────────────
export function openLightbox(index) {
  const lightbox = $('lightbox');
  if (!lightbox || index < 0 || index >= state.mediaItems.length) return;
  state.lightboxIdx = index;
  state.currentRotation = 0;
  renderLightboxItem(index);
  lightbox.classList.add('open');
}

export function closeLightbox() {
  const lightbox = $('lightbox');
  const lbVideo  = $('lbVideo');
  if (lbVideo) { lbVideo.pause(); lbVideo.src = ''; }
  if (lightbox) lightbox.classList.remove('open');
  state.lightboxIdx = -1;
  state.currentRotation = 0;
  stopSlideshow();
}

export function rotateLightboxImage() {
  const lbImg = $('lbImg');
  if (!lbImg) return;
  state.currentRotation = (state.currentRotation + 90) % 360;
  lbImg.style.transform = `rotate(${state.currentRotation}deg)`;
}

export function toggleSlideshow(handlers) {
  const slideshowBtn = $('lbSlideshowBtn');
  if (state.slideshowTimer) {
    stopSlideshow();
    if (slideshowBtn) slideshowBtn.textContent = '▶️';
  } else {
    if (slideshowBtn) slideshowBtn.textContent = '⏸️';
    state.slideshowTimer = setInterval(() => {
      if (state.lightboxIdx < state.mediaItems.length - 1) {
        state.lightboxIdx++;
      } else {
        state.lightboxIdx = 0;
      }
      state.currentRotation = 0;
      renderLightboxItem(state.lightboxIdx);
    }, 3000);
  }
}

export function stopSlideshow() {
  const slideshowBtn = $('lbSlideshowBtn');
  if (state.slideshowTimer) {
    clearInterval(state.slideshowTimer);
    state.slideshowTimer = null;
  }
  if (slideshowBtn) slideshowBtn.textContent = '▶️';
}

export function renderLightboxItem(index) {
  const item = state.mediaItems[index];
  if (!item) return;

  const lbFilename      = $('lbFilename');
  const lbDownload      = $('lbDownload');
  const lbImg           = $('lbImg');
  const lbVideo         = $('lbVideo');
  const lbPdf           = $('lbPdf');
  const lbText          = $('lbText');
  const lbDocFallback   = $('lbDocFallback');
  const lbDocDownloadBtn= $('lbDocDownloadBtn');
  const lbDocTitle      = $('lbDocTitle');
  const lbCounter       = $('lbCounter');
  const lbPrev          = $('lbPrev');
  const lbNext          = $('lbNext');
  const lbFavBtn        = $('lbFavBtn');

  if (lbFilename) lbFilename.textContent = item.name;
  if (lbDownload) {
    lbDownload.href = item.url;
    lbDownload.download = item.name;
  }
  if (lbCounter) lbCounter.textContent = `${index + 1} / ${state.mediaItems.length}`;
  if (lbPrev) lbPrev.disabled = index === 0;
  if (lbNext) lbNext.disabled = index === state.mediaItems.length - 1;

  if (lbFavBtn) {
    const isFav = state.favorites.has(item.path);
    lbFavBtn.classList.toggle('active', isFav);
  }

  if (lbImg) {
    lbImg.style.display = 'none';
    lbImg.style.transform = `rotate(${state.currentRotation}deg)`;
  }
  if (lbVideo) { lbVideo.style.display = 'none'; lbVideo.pause(); }
  if (lbPdf) lbPdf.style.display = 'none';
  if (lbText) lbText.style.display = 'none';
  if (lbDocFallback) lbDocFallback.classList.add('hidden');

  if (item.type === 'image') {
    if (lbImg) {
      lbImg.src = item.url;
      lbImg.alt = item.name;
      lbImg.style.display = 'block';
    }
  } else if (item.type === 'video') {
    if (lbVideo) {
      lbVideo.src = item.url;
      lbVideo.style.display = 'block';
    }
  } else if (item.type === 'document') {
    const ext = item.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      if (lbPdf) {
        lbPdf.src = item.url;
        lbPdf.style.display = 'block';
      }
    } else if (['txt', 'md', 'json', 'py', 'js', 'html', 'css', 'csv', 'log', 'sh', 'bat', 'yml', 'yaml'].includes(ext)) {
      if (lbText) {
        lbText.style.display = 'block';
        lbText.textContent = '문서 내용 로딩 중…';
        fetch(item.url)
          .then(r => r.arrayBuffer())
          .then(buf => {
            let txt = new TextDecoder('utf-8').decode(buf);
            if (txt.includes('')) {
              try {
                txt = new TextDecoder('euc-kr').decode(buf);
              } catch (e) {}
            }
            lbText.textContent = txt;
          })
          .catch(err => { lbText.textContent = '문서를 읽을 수 없습니다: ' + err.message; });
      }
    } else {
      if (lbDocFallback) {
        lbDocFallback.classList.remove('hidden');
        if (lbDocTitle) lbDocTitle.textContent = item.name;
        if (lbDocDownloadBtn) {
          lbDocDownloadBtn.href = item.url;
          lbDocDownloadBtn.download = item.name;
        }
      }
    }
  }
}

// ── Mkdir Modal Controller ────────────────────────────────────
export function openMkdirModal() {
  const mkdirModal       = $('mkdirModal');
  const mkdirInput       = $('mkdirInput');
  const mkdirLocationSub = $('mkdirLocationSub');
  if (!mkdirModal) return;

  const currentPath = state.currentFolder ? `L:\\${state.currentFolder.replace(/\//g, '\\')}` : 'L:\\ (루트)';
  if (mkdirLocationSub) mkdirLocationSub.textContent = `새 폴더 위치: ${currentPath}`;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const defaultName = `upload_${yyyy}${mm}${dd}`;

  if (mkdirInput) mkdirInput.value = defaultName;
  mkdirModal.classList.remove('hidden');
  if (mkdirInput) {
    setTimeout(() => {
      mkdirInput.focus();
      mkdirInput.select();
    }, 100);
  }
}

export function closeMkdirModal() {
  const mkdirModal = $('mkdirModal');
  if (mkdirModal) mkdirModal.classList.add('hidden');
}

export async function handleCreateFolder(onNavigate) {
  const mkdirInput = $('mkdirInput');
  const folderName = mkdirInput ? mkdirInput.value.trim() : '';
  if (!folderName) {
    alert('폴더 이름을 입력해 주세요.');
    return;
  }

  try {
    const data = await createFolderApi(state.currentFolder, folderName);
    closeMkdirModal();
    if (onNavigate) onNavigate(data.folder || state.currentFolder);
  } catch (err) {
    alert(`폴더 생성 실패: ${err.message}`);
  }
}

// ── Upload Mode Modal Controller ──────────────────────────────
export function openUploadOptModal() {
  const uploadOptModal    = $('uploadOptModal');
  const uploadOptLocation = $('uploadOptLocation');
  if (!uploadOptModal) return;
  const currentPath = state.currentFolder ? `L:\\${state.currentFolder.replace(/\//g, '\\')}` : 'L:\\ (루트)';
  if (uploadOptLocation) uploadOptLocation.textContent = `저장 위치: ${currentPath}`;
  uploadOptModal.classList.remove('hidden');
}

export function closeUploadOptModal() {
  const uploadOptModal = $('uploadOptModal');
  if (uploadOptModal) uploadOptModal.classList.add('hidden');
}

// ── Multi-Selection Controller ────────────────────────────────
export function enableSelectMode(handlers) {
  if (!state.isSelectMode) {
    state.isSelectMode = true;
    const selectModeBtn = $('selectModeBtn');
    const selectionBar  = $('selectionBar');
    if (selectModeBtn) selectModeBtn.classList.add('active');
    if (selectionBar) selectionBar.classList.remove('hidden');
    updateSelectionUI();
    renderGallery(state.filteredItems, handlers);
  }
}

export function toggleSelectMode(enable, handlers) {
  state.isSelectMode = typeof enable === 'boolean' ? enable : !state.isSelectMode;
  if (!state.isSelectMode) {
    state.selectedPaths.clear();
    state.lastSelectedIndex = -1;
  }

  const selectModeBtn = $('selectModeBtn');
  const selectionBar  = $('selectionBar');

  if (selectModeBtn) selectModeBtn.classList.toggle('active', state.isSelectMode);
  if (selectionBar) {
    if (state.isSelectMode) selectionBar.classList.remove('hidden');
    else selectionBar.classList.add('hidden');
  }
  updateSelectionUI();
  renderGallery(state.filteredItems, handlers);
}

export function toggleItemSelection(path, handlers, isShiftKey = false, currentIndex = -1) {
  const displayList = state.displayItems || state.filteredItems || [];

  if (isShiftKey && state.lastSelectedIndex >= 0 && currentIndex >= 0) {
    const start = Math.min(state.lastSelectedIndex, currentIndex);
    const end = Math.max(state.lastSelectedIndex, currentIndex);

    for (let i = start; i <= end; i++) {
      if (displayList[i]) {
        state.selectedPaths.add(displayList[i].path);
      }
    }
  } else {
    if (state.selectedPaths.has(path)) {
      state.selectedPaths.delete(path);
    } else {
      state.selectedPaths.add(path);
    }
  }

  if (currentIndex >= 0) {
    state.lastSelectedIndex = currentIndex;
  }

  updateSelectionUI();
  renderGallery(state.items, handlers);
}

export function updateSelectionUI() {
  const selectionCount = $('selectionCount');
  const count = state.selectedPaths.size;
  if (selectionCount) selectionCount.textContent = `${count}개 선택됨`;
}

export async function handleBatchShare() {
  if (state.selectedPaths.size === 0) {
    alert('공유할 항목을 선택해 주세요.');
    return;
  }

  const selectedItems = state.filteredItems.filter(i => state.selectedPaths.has(i.path));
  if (selectedItems.length === 1) {
    await shareItem(selectedItems[0]);
  } else {
    const urls = selectedItems.map(i => window.location.origin + i.url);
    copyLinkToClipboard(urls.join('\n\n'));
  }
}

export async function handleBatchDelete(onNavigate, handlers) {
  const count = state.selectedPaths.size;
  if (count === 0) {
    alert('삭제할 항목을 선택해 주세요.');
    return;
  }

  if (!confirm(`⚠️ 선택한 ${count}개 항목을 서버에서 영구 삭제하시겠습니까?`)) {
    return;
  }

  try {
    const pathsArray = Array.from(state.selectedPaths);
    await batchDeleteApi(pathsArray);
    pathsArray.forEach(p => state.favorites.delete(p));
    saveFavorites();
    toggleSelectMode(false, handlers);
    if (onNavigate) await onNavigate(state.currentFolder);
  } catch (err) {
    alert(`삭제 중 오류가 발생했습니다: ${err.message}`);
  }
}

// ── Toast Notification ────────────────────────────────────────
let toastTimer = null;
export function showToast(message, icon = '🚚', duration = 3000) {
  const toast = $('appToast');
  const toastMsg = $('toastMessage');
  const toastIcon = $('toastIcon');
  if (!toast) return;
  if (toastMsg) toastMsg.textContent = message;
  if (toastIcon) toastIcon.textContent = icon;
  toast.classList.remove('hidden');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

// ── Move Destination Modal Controller ─────────────────────────
let activeMovePaths = [];
let selectedDestFolder = '';

export async function openMoveModal(pathsToMove, onNavigate, handlers) {
  let targets = pathsToMove;
  if (!targets || targets.length === 0) {
    if (state.selectedPaths && state.selectedPaths.size > 0) {
      targets = Array.from(state.selectedPaths);
    }
  }

  if (!targets || targets.length === 0) {
    if (!state.isSelectMode && handlers) {
      toggleSelectMode(true, handlers);
      showToast('이동할 항목을 먼저 선택해 주세요.', 'ℹ️');
    } else {
      showToast('이동할 항목을 먼저 선택해 주세요.', 'ℹ️');
    }
    return;
  }

  activeMovePaths = targets;
  selectedDestFolder = '';

  const moveModal = $('moveModal');
  const moveModalSub = $('moveModalSub');
  const moveDestPath = $('moveDestPath');
  const container = $('moveFolderContainer');

  const names = activeMovePaths.map(p => p.split('/').pop());
  const previewText = names.slice(0, 3).join(', ') + (names.length > 3 ? ` 외 ${names.length - 3}개` : '');

  if (moveModalSub) {
    moveModalSub.textContent = `이동할 항목: ${activeMovePaths.length}개 (${previewText})`;
  }
  if (moveDestPath) {
    moveDestPath.textContent = 'L:\\ (최상위 루트)';
  }

  if (moveModal) moveModal.classList.remove('hidden');

  await renderMoveFolderList(container, onNavigate);
}

export async function renderMoveFolderList(container, onNavigate) {
  if (!container) return;
  container.innerHTML = '<div class="move-tree-loading">📂 폴더 목록 로딩 중…</div>';

  try {
    const data = await fetchFoldersApi();
    const folders = data.folders || [];
    container.innerHTML = '';

    folders.forEach(f => {
      const itemEl = document.createElement('div');
      itemEl.className = 'move-folder-item';
      if (f.path === selectedDestFolder) itemEl.classList.add('selected');

      let isDisabled = false;
      let badgeText = '';

      for (const p of activeMovePaths) {
        if (p === f.path) {
          isDisabled = true;
          badgeText = '자신';
          break;
        }
        if (f.path.startsWith(p + '/')) {
          isDisabled = true;
          badgeText = '하위 폴더';
          break;
        }
      }

      if (f.path === state.currentFolder) {
        badgeText = badgeText || '현재 폴더';
      }

      if (isDisabled) {
        itemEl.classList.add('disabled');
      }

      const indent = (f.depth || 0) * 16;
      itemEl.style.paddingLeft = `${indent + 12}px`;

      itemEl.innerHTML = `
        <span class="folder-tree-icon">${f.path === '' ? '🏠' : '📁'}</span>
        <span class="folder-tree-name">${f.name}</span>
        ${badgeText ? `<span class="folder-badge">${badgeText}</span>` : ''}
      `;

      if (!isDisabled) {
        itemEl.addEventListener('click', () => {
          selectedDestFolder = f.path;
          container.querySelectorAll('.move-folder-item').forEach(el => el.classList.remove('selected'));
          itemEl.classList.add('selected');
          const moveDestPath = $('moveDestPath');
          if (moveDestPath) {
            moveDestPath.textContent = f.path ? `L:\\${f.path.replace(/\//g, '\\')}` : 'L:\\ (최상위 루트)';
          }
        });
      }

      container.appendChild(itemEl);
    });

  } catch (err) {
    container.innerHTML = `<div class="move-tree-loading" style="color:var(--danger)">⚠️ 폴더 목록 로드 실패: ${err.message}</div>`;
  }
}

export function closeMoveModal() {
  const moveModal = $('moveModal');
  if (moveModal) moveModal.classList.add('hidden');
  activeMovePaths = [];
}

export async function handleConfirmMove(onNavigate, handlers) {
  if (!activeMovePaths || activeMovePaths.length === 0) {
    closeMoveModal();
    return;
  }

  const confirmBtn = $('moveModalConfirmBtn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '이동 중…';
  }

  try {
    const destName = selectedDestFolder ? selectedDestFolder.split('/').pop() : 'L:\\ (루트)';
    await batchMoveApi(activeMovePaths, selectedDestFolder);
    const count = activeMovePaths.length;
    closeMoveModal();

    if (state.isSelectMode && handlers) {
      toggleSelectMode(false, handlers);
    } else {
      state.selectedPaths.clear();
      updateSelectionUI();
    }

    showToast(`${count}개 항목을 '${destName}'(으)로 이동했습니다.`, '🚚');
    if (onNavigate) await onNavigate(state.currentFolder);
  } catch (err) {
    alert(`이동 중 오류 발생: ${err.message}`);
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = '이곳으로 이동';
    }
  }
}

export async function handleMoveModalNewFolder(onNavigate) {
  const name = prompt('새로 생성할 폴더 이름을 입력하세요:');
  if (!name || !name.trim()) return;
  try {
    await createFolderApi(selectedDestFolder, name.trim());
    showToast(`'${name.trim()}' 폴더가 생성되었습니다.`, '📁');
    selectedDestFolder = selectedDestFolder ? `${selectedDestFolder}/${name.trim()}` : name.trim();
    const moveDestPath = $('moveDestPath');
    if (moveDestPath) {
      moveDestPath.textContent = `L:\\${selectedDestFolder.replace(/\//g, '\\')}`;
    }
    const cont = $('moveFolderContainer');
    if (cont) await renderMoveFolderList(cont, onNavigate);
  } catch (err) {
    alert(`폴더 생성 실패: ${err.message}`);
  }
}

// ── Duplicate Photos Detection Controller (Immich Feature) ──────
let activeDuplicatesData = null;
let selectedDupPaths = new Set();

export function openDuplicatesModal(onNavigate, handlers) {
  const modal = $('duplicatesModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const scopeSelect = $('dupScopeSelect');
  if (scopeSelect && scopeSelect.options.length > 0) {
    const curFolderText = state.currentFolder ? `현재 폴더 (L:\\${state.currentFolder.replace(/\//g, '\\')})` : '현재 폴더 (L:\\ 루트)';
    scopeSelect.options[0].textContent = curFolderText;
  }
}

export function closeDuplicatesModal() {
  const modal = $('duplicatesModal');
  if (modal) modal.classList.add('hidden');
}

export async function handleScanDuplicates(onNavigate, handlers) {
  const container = $('dupResultsContainer');
  const summaryBar = $('dupSummaryBar');
  const scope = $('dupScopeSelect') ? $('dupScopeSelect').value : 'all';
  const mode = $('dupModeSelect') ? $('dupModeSelect').value : 'exact';
  const folder = (scope === 'current') ? state.currentFolder : '';

  if (summaryBar) summaryBar.classList.add('hidden');
  selectedDupPaths.clear();
  updateDupSelectedCount();

  if (container) {
    container.innerHTML = `
      <div class="dup-loading">
        <div class="dup-spinner"></div>
        <p class="dup-loading-title">L: 드라이브 중복 사진 및 사본 분석 중…</p>
        <p class="dup-loading-sub">파일 크기 대조 및 정밀 해시(SHA-256) 검사를 수행하고 있습니다. 잠시만 기다려 주세요.</p>
      </div>
    `;
  }

  try {
    const data = await fetchDuplicatesApi(folder, true, mode, 150);
    activeDuplicatesData = data;
    renderDuplicatesResults(data, onNavigate, handlers);
  } catch (err) {
    if (container) {
      container.innerHTML = `
        <div class="dup-empty-prompt">
          <div class="dup-empty-icon">⚠️</div>
          <p class="dup-empty-title">중복 검사 실패</p>
          <p class="dup-empty-desc">${err.message}</p>
        </div>
      `;
    }
  }
}

export function renderDuplicatesResults(data, onNavigate, handlers) {
  const container = $('dupResultsContainer');
  const summaryBar = $('dupSummaryBar');
  const summaryStats = $('dupSummaryStats');
  if (!container) return;

  const groups = data.groups || [];
  if (groups.length === 0) {
    if (summaryBar) summaryBar.classList.add('hidden');
    container.innerHTML = `
      <div class="dup-empty-prompt">
        <div class="dup-empty-icon">🎉</div>
        <p class="dup-empty-title">중복된 사진이 없습니다!</p>
        <p class="dup-empty-desc">총 <strong>${data.total_files_scanned || 0}개</strong>의 파일을 정밀 스캔하였으며, 디스크 공간이 완벽하게 정리되어 있습니다.</p>
      </div>
    `;
    return;
  }

  if (summaryBar) summaryBar.classList.remove('hidden');
  if (summaryStats) {
    summaryStats.innerHTML = `
      <span>🎯 <strong>${data.total_groups}개</strong> 중복 그룹 (총 <strong>${data.total_duplicate_files}개</strong> 사본)</span>
      <span class="dup-stat-divider">·</span>
      <span class="dup-waste-highlight">절약 가능 용량: <strong>${data.formatted_wasted_bytes}</strong></span>
    `;
  }

  container.innerHTML = '';

  groups.forEach((grp, grpIdx) => {
    const groupCard = document.createElement('div');
    groupCard.className = 'dup-group-card';

    const groupHeader = document.createElement('div');
    groupHeader.className = 'dup-group-header';
    groupHeader.innerHTML = `
      <div class="dup-group-meta">
        <span class="dup-group-num">#${grpIdx + 1}</span>
        <span class="dup-badge-type">${grp.type_label || (grp.type === 'exact' ? '동일 파일' : '유사 사진')}</span>
        <span class="dup-group-size">파일당: ${grp.formatted_size}</span>
      </div>
      <div class="dup-group-waste">
        낭비되는 용량: <strong>${grp.formatted_wasted_size}</strong>
      </div>
    `;
    groupCard.appendChild(groupHeader);

    const itemsGrid = document.createElement('div');
    itemsGrid.className = 'dup-items-grid';

    grp.items.forEach((item) => {
      const isOriginal = item.is_suggested_original;
      const itemEl = document.createElement('div');
      itemEl.className = `dup-item-card ${isOriginal ? 'is-original' : 'is-duplicate'}`;
      itemEl.dataset.path = item.path;

      itemEl.innerHTML = `
        <div class="dup-thumb-wrap">
          <img src="${item.thumb}" alt="${item.name}" loading="lazy" onerror="this.src='/photos/assets/images/folder_placeholder.svg'">
          <div class="dup-thumb-badge ${isOriginal ? 'orig' : 'copy'}">
            ${isOriginal ? '👑 원본 (보관 추천)' : '📋 사본 (삭제 대상)'}
          </div>
        </div>
        <div class="dup-item-info">
          <div class="dup-item-name" title="${item.name}">${item.name}</div>
          <div class="dup-item-folder" title="${item.folder_display || item.path}">
            📁 ${item.folder_display || item.path}
          </div>
          <div class="dup-item-sub">
            <span>📅 ${item.mtime_str || ''}</span>
            <span>💾 ${item.formatted_size}</span>
          </div>
        </div>
        <div class="dup-item-actions">
          <label class="dup-checkbox-label">
            <input type="checkbox" class="dup-item-check" data-path="${item.path}" ${!isOriginal ? 'checked' : ''}>
            <span>삭제 선택</span>
          </label>
        </div>
      `;

      // Checkbox click
      const check = itemEl.querySelector('.dup-item-check');
      if (check) {
        if (!isOriginal) {
          selectedDupPaths.add(item.path);
          itemEl.classList.add('selected-for-delete');
        }
        check.addEventListener('change', (e) => {
          if (e.target.checked) {
            selectedDupPaths.add(item.path);
            itemEl.classList.add('selected-for-delete');
          } else {
            selectedDupPaths.delete(item.path);
            itemEl.classList.remove('selected-for-delete');
          }
          updateDupSelectedCount();
        });
      }

      itemsGrid.appendChild(itemEl);
    });

    groupCard.appendChild(itemsGrid);
    container.appendChild(groupCard);
  });

  updateDupSelectedCount();
}

export function autoSelectDuplicateCopies() {
  selectedDupPaths.clear();
  const checkboxes = document.querySelectorAll('.dup-item-check');
  checkboxes.forEach(cb => {
    const itemCard = cb.closest('.dup-item-card');
    const isOriginal = itemCard && itemCard.classList.contains('is-original');
    if (!isOriginal) {
      cb.checked = true;
      selectedDupPaths.add(cb.dataset.path);
      if (itemCard) itemCard.classList.add('selected-for-delete');
    } else {
      cb.checked = false;
      if (itemCard) itemCard.classList.remove('selected-for-delete');
    }
  });
  updateDupSelectedCount();
}

export function deselectAllDuplicates() {
  selectedDupPaths.clear();
  const checkboxes = document.querySelectorAll('.dup-item-check');
  checkboxes.forEach(cb => {
    cb.checked = false;
    const itemCard = cb.closest('.dup-item-card');
    if (itemCard) itemCard.classList.remove('selected-for-delete');
  });
  updateDupSelectedCount();
}

function updateDupSelectedCount() {
  const countEl = $('dupSelectedCount');
  const deleteBtn = $('dupDeleteSelectedBtn');
  const count = selectedDupPaths.size;
  if (countEl) countEl.textContent = String(count);
  if (deleteBtn) {
    deleteBtn.disabled = count === 0;
  }
}

export async function handleDeleteSelectedDuplicates(onNavigate, handlers) {
  const count = selectedDupPaths.size;
  if (count === 0) {
    alert('삭제할 중복 사진을 선택해 주세요.');
    return;
  }

  if (!confirm(`⚠️ 선택한 ${count}개의 중복 사진(사본)을 삭제하시겠습니까?\n이 작업은 즉시 디스크 공간을 확보합니다.`)) {
    return;
  }

  const paths = Array.from(selectedDupPaths);
  const deleteBtn = $('dupDeleteSelectedBtn');
  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = '삭제 중…';
  }

  try {
    const res = await batchDeleteApi(paths);
    showToast(`${res.deleted ? res.deleted.length : count}개의 중복 사진을 삭제했습니다.`, '🧹', 4000);
    selectedDupPaths.clear();
    updateDupSelectedCount();

    if (onNavigate) await onNavigate(state.currentFolder);
    await handleScanDuplicates(onNavigate, handlers);
  } catch (err) {
    alert(`중복 사진 삭제 실패: ${err.message}`);
  } finally {
    if (deleteBtn) {
      deleteBtn.textContent = `🗑️ 선택한 사본 삭제 (${selectedDupPaths.size}개)`;
      deleteBtn.disabled = selectedDupPaths.size === 0;
    }
  }
}
