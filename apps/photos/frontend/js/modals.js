import { $, state, saveFavorites } from './state.js';
import { createFolderApi, deleteItemApi, batchDeleteApi, batchMoveApi, moveItemApi, fetchFoldersApi } from './api.js';
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
