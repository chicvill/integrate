import { $, state, formatBytes, saveFavorites } from './js/state.js';
import { fetchFolderData, uploadSingleFile, deleteItemApi, fetchStorageInfo, createFolderApi } from './js/api.js';
import { renderBreadcrumb, renderSidebarStats, renderGallery, copyLinkToClipboard, shareItem } from './js/ui.js';
import {
  openLightbox, closeLightbox, renderLightboxItem, rotateLightboxImage, toggleSlideshow,
  openMkdirModal, closeMkdirModal, handleCreateFolder,
  openUploadOptModal, closeUploadOptModal,
  enableSelectMode, toggleSelectMode, toggleItemSelection, handleBatchShare, handleBatchDelete
} from './js/modals.js';

// Handlers object passed to card rendering
const cardHandlers = {
  onNavigate: (path) => navigateTo(path),
  onOpenLightbox: (mediaIdx) => openLightbox(mediaIdx),
  onToggleSelection: (path, isShift, idx) => toggleItemSelection(path, cardHandlers, isShift, idx),
  onEnableSelectMode: () => enableSelectMode(cardHandlers)
};

// ── Navigation & Data Fetching ────────────────────────────────
async function navigateTo(folder) {
  state.currentFolder = folder;
  if (state.isSelectMode) toggleSelectMode(false, cardHandlers);

  const loadingSpinner = $('loadingSpinner');
  const galleryGrid    = $('galleryGrid');
  const emptyState     = $('emptyState');

  if (loadingSpinner) loadingSpinner.classList.remove('hidden');
  if (galleryGrid) galleryGrid.innerHTML = '';
  if (emptyState) emptyState.classList.add('hidden');

  renderBreadcrumb(folder, (p) => navigateTo(p));

  try {
    const [data, storageData] = await Promise.all([
      fetchFolderData(folder),
      fetchStorageInfo()
    ]);
    state.items = data.items || [];
    state.filteredItems = [...state.items];
    renderSidebarStats(data.counts || {}, storageData);
    renderGallery(state.filteredItems, cardHandlers);
  } catch (err) {
    if (galleryGrid) {
      galleryGrid.innerHTML = `<div class="empty-state"><p class="empty-title">⚠️ 오류 발생</p><p class="empty-sub">${err.message}</p></div>`;
    }
  } finally {
    if (loadingSpinner) loadingSpinner.classList.add('hidden');
  }
}

// ── Search & Filter ───────────────────────────────────────────
function filterItems(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    state.filteredItems = [...state.items];
  } else {
    state.filteredItems = state.items.filter(item => item.name.toLowerCase().includes(q));
  }
  renderGallery(state.filteredItems, cardHandlers);
}

let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (err) {
    console.log('WakeLock unavailable:', err);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {}).finally(() => { wakeLock = null; });
  }
}

// Recursively extract all files and directory structure from Drag & Drop DataTransfer
async function extractDroppedFiles(dataTransfer) {
  const fileEntries = [];
  const emptyDirs = [];

  if (dataTransfer.items && dataTransfer.items.length > 0) {
    const queue = [];
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) queue.push(entry);
      } else if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) fileEntries.push({ file: f, relativePath: f.name });
      }
    }

    while (queue.length > 0) {
      const entry = queue.shift();
      if (entry.isFile) {
        try {
          const file = await new Promise((res, rej) => entry.file(res, rej));
          const relPath = entry.fullPath ? entry.fullPath.replace(/^\//, '') : file.name;
          fileEntries.push({ file, relativePath: relPath });
        } catch (err) {
          console.warn('Error reading dropped file entry:', entry, err);
        }
      } else if (entry.isDirectory) {
        try {
          const dirReader = entry.createReader();
          let allChildren = [];
          const readBatch = () => new Promise((res, rej) => dirReader.readEntries(res, rej));
          let batch = await readBatch();
          while (batch && batch.length > 0) {
            allChildren.push(...batch);
            batch = await readBatch();
          }

          if (allChildren.length === 0) {
            const dirRelPath = entry.fullPath ? entry.fullPath.replace(/^\//, '') : entry.name;
            emptyDirs.push(dirRelPath);
          } else {
            queue.push(...allChildren);
          }
        } catch (err) {
          console.warn('Error reading dropped directory:', entry, err);
        }
      }
    }
  }

  // Fallback to dataTransfer.files
  if (fileEntries.length === 0 && emptyDirs.length === 0 && dataTransfer.files) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const f = dataTransfer.files[i];
      fileEntries.push({ file: f, relativePath: f.webkitRelativePath || f.name });
    }
  }

  return { files: fileEntries, emptyDirs };
}

// ── File Upload Process ───────────────────────────────────────
async function uploadFiles(fileList) {
  if (!fileList || fileList.length === 0) return;
  const files = Array.from(fileList);
  const totalCount = files.length;
  let successCount = 0;
  let failCount = 0;

  const uploadModal        = $('uploadModal');
  const uploadStatusTitle  = $('uploadStatusTitle');
  const uploadProgressFill = $('uploadProgressFill');
  const uploadStatusDetail = $('uploadStatusDetail');

  const destPath = state.currentFolder ? state.currentFolder : '루트 폴더';

  if (uploadModal) {
    if (uploadStatusTitle) uploadStatusTitle.textContent = `📤 파일 업로드 준비 중… (0 / ${totalCount})`;
    if (uploadProgressFill) uploadProgressFill.style.width = '0%';
    if (uploadStatusDetail) uploadStatusDetail.textContent = `저장 위치: ${destPath}`;
    uploadModal.classList.remove('hidden');
  }

  // Request WakeLock so smartphone screen stays ON during upload
  await requestWakeLock();

  try {
    for (let i = 0; i < totalCount; i++) {
      const item = files[i];
      const file = item.file || item;
      const fileName = (item && item.relativePath) ? item.relativePath : (file.name || `file_${i}`);

      if (file.size && file.size > 200 * 1024 * 1024) {
        failCount++;
        alert(`⚠️ '${fileName}' 파일이 너무 큽니다. (200MB 제한 초과: ${formatBytes(file.size)})`);
        continue;
      }

      if (uploadStatusTitle) {
        uploadStatusTitle.textContent = `📤 업로드 중… (${i + 1} / ${totalCount})`;
      }

      let fileUploaded = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await uploadSingleFile(item, state.currentUploadMode, (percent, loaded, total) => {
            const overallPercent = Math.round(((i + percent / 100) / totalCount) * 100);
            if (uploadProgressFill) uploadProgressFill.style.width = `${overallPercent}%`;
            if (uploadStatusDetail) {
              uploadStatusDetail.textContent = `${fileName} (${percent}% - ${formatBytes(loaded)} / ${formatBytes(total)})`;
            }
          });
          fileUploaded = true;
          break;
        } catch (err) {
          console.warn(`Upload attempt ${attempt} failed for ${fileName}:`, err);
          if (attempt < 3) {
            if (uploadStatusDetail) uploadStatusDetail.textContent = `네트워크 재연동 시도 중… (${attempt}/3회)`;
            await new Promise(r => setTimeout(r, 1000));
          } else {
            failCount++;
            alert(`'${fileName}' 업로드 실패: ${err.message}`);
          }
        }
      }
      if (fileUploaded) successCount++;
    }
  } finally {
    releaseWakeLock();
  }

  if (uploadStatusTitle) {
    if (failCount === 0) {
      uploadStatusTitle.textContent = '✅ 전체 업로드 완료!';
      if (state.currentUploadMode === 'overwrite') {
        uploadStatusDetail.textContent = `🚚 ${successCount}개 파일이 서버에 안전하게 저장되었습니다.`;
      } else {
        uploadStatusDetail.textContent = `📋 ${successCount}개 파일이 안전하게 사본 저장되었습니다.`;
      }
    } else {
      uploadStatusTitle.textContent = `⚠️ 업로드 완료 (${successCount} 성공, ${failCount} 실패)`;
      uploadStatusDetail.textContent = '일부 파일 업로드에 실패했습니다.';
    }
  }
  if (uploadProgressFill) uploadProgressFill.style.width = '100%';

  const delayTime = (state.currentUploadMode === 'overwrite') ? 2500 : 1500;
  setTimeout(() => {
    if (uploadModal) uploadModal.classList.add('hidden');
    navigateTo(state.currentFolder);
  }, delayTime);
}

// ── Bind Event Listeners ──────────────────────────────────────
function initEvents() {
  const sidebar        = $('sidebar');
  const sidebarToggle  = $('sidebarToggle');
  const sidebarCloseBtn= $('sidebarCloseBtn');
  const sidebarBackdrop= $('sidebarBackdrop');
  const searchInput    = $('searchInput');

  // Sidebar Controls
  const toggleSidebar = () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('mobile-open');
      sidebarBackdrop.classList.toggle('active');
    } else {
      sidebar.classList.toggle('collapsed');
    }
  };
  const closeMobileSidebar = () => {
    sidebar.classList.remove('mobile-open');
    sidebarBackdrop.classList.remove('active');
  };

  if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);

  // Search Input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => filterItems(e.target.value));
  }

  // ── Service URL Resolvers ──
  const getFileBrowserUrl = (folderPath = '') => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const base = isLocal ? `http://${window.location.hostname}:9007` : `https://files.chicvill.store`;
    const cleanPath = (folderPath || '').replace(/^[\\\/]+/, '').replace(/\\/g, '/');
    return cleanPath ? `${base}/files/${cleanPath}` : `${base}/files/`;
  };

  const getImmichUrl = () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? `http://${window.location.hostname}:8007` : `https://photos.chicvill.store`;
  };

  // ── App Switcher / Embedded View Management ──
  const navHome             = $('navHome');
  const navFileBrowser      = $('navFileBrowser');
  const navImmich           = $('navImmich');
  const openFbExtBtn        = $('openFbExtBtn');
  const openImmichExtBtn    = $('openImmichExtBtn');
  const openCurrentInFbBtn  = $('openCurrentInFbBtn');

  const galleryControlsBar  = $('galleryControlsBar');
  const galleryArea         = $('galleryArea');
  const embeddedViewWrap    = $('embeddedViewWrap');
  const embeddedIframe      = $('embeddedIframe');
  const embeddedServiceBadge= $('embeddedServiceBadge');
  const embeddedServiceTitle= $('embeddedServiceTitle');
  const embeddedServiceUrl  = $('embeddedServiceUrl');
  const embeddedRefreshBtn  = $('embeddedRefreshBtn');
  const embeddedExternalBtn = $('embeddedExternalBtn');
  const embeddedCloseBtn    = $('embeddedCloseBtn');

  const switchServiceView = (viewType, targetPath = '') => {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => b.classList.remove('active'));

    if (viewType === 'photos') {
      if (navHome) navHome.classList.add('active');
      if (embeddedViewWrap) embeddedViewWrap.classList.add('hidden');
      if (galleryControlsBar) galleryControlsBar.classList.remove('hidden');
      if (galleryArea) galleryArea.classList.remove('hidden');
      if (embeddedIframe) embeddedIframe.src = 'about:blank';
      if (window.innerWidth <= 768) closeMobileSidebar();
      return;
    }

    if (galleryControlsBar) galleryControlsBar.classList.add('hidden');
    if (galleryArea) galleryArea.classList.add('hidden');
    if (embeddedViewWrap) embeddedViewWrap.classList.remove('hidden');
    if (window.innerWidth <= 768) closeMobileSidebar();

    if (viewType === 'filebrowser') {
      if (navFileBrowser) navFileBrowser.classList.add('active');
      const targetUrl = getFileBrowserUrl(targetPath || state.currentFolder);
      if (embeddedServiceBadge) embeddedServiceBadge.textContent = 'FileBrowser';
      if (embeddedServiceTitle) embeddedServiceTitle.textContent = 'L: 드라이브 파일 탐색기 (문서/음악/전체 파일)';
      if (embeddedServiceUrl) embeddedServiceUrl.textContent = targetUrl;
      if (embeddedIframe) embeddedIframe.src = targetUrl;
    } else if (viewType === 'immich') {
      if (navImmich) navImmich.classList.add('active');
      const targetUrl = getImmichUrl();
      if (embeddedServiceBadge) embeddedServiceBadge.textContent = 'Immich / Photoview';
      if (embeddedServiceTitle) embeddedServiceTitle.textContent = 'AI 스마트 갤러리 (얼굴인식 / 타임라인 / 맵)';
      if (embeddedServiceUrl) embeddedServiceUrl.textContent = targetUrl;
      if (embeddedIframe) embeddedIframe.src = targetUrl;
    }
  };

  if (navHome) navHome.addEventListener('click', () => switchServiceView('photos'));
  if (navFileBrowser) navFileBrowser.addEventListener('click', () => switchServiceView('filebrowser'));
  if (navImmich) navImmich.addEventListener('click', () => switchServiceView('immich'));

  if (openCurrentInFbBtn) {
    openCurrentInFbBtn.addEventListener('click', () => switchServiceView('filebrowser', state.currentFolder));
  }

  if (openFbExtBtn) {
    openFbExtBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(getFileBrowserUrl(state.currentFolder), '_blank');
    });
  }

  if (openImmichExtBtn) {
    openImmichExtBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(getImmichUrl(), '_blank');
    });
  }

  if (embeddedRefreshBtn && embeddedIframe) {
    embeddedRefreshBtn.addEventListener('click', () => {
      if (embeddedIframe.src && embeddedIframe.src !== 'about:blank') {
        embeddedIframe.src = embeddedIframe.src;
      }
    });
  }

  if (embeddedExternalBtn && embeddedIframe) {
    embeddedExternalBtn.addEventListener('click', () => {
      if (embeddedIframe.src && embeddedIframe.src !== 'about:blank') {
        window.open(embeddedIframe.src, '_blank');
      }
    });
  }

  if (embeddedCloseBtn) {
    embeddedCloseBtn.addEventListener('click', () => switchServiceView('photos'));
  }

  // Filter Tabs & Sort Select
  const filterTabs = $('filterTabs');
  const sortSelect = $('sortSelect');

  if (filterTabs) {
    filterTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-tab');
      if (!btn) return;
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filterType = btn.dataset.filter || 'all';
      renderGallery(state.filteredItems, cardHandlers);
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderGallery(state.filteredItems, cardHandlers);
    });
  }

  // Refresh & Views
  const refreshBtn = $('refreshBtn');
  const viewGrid   = $('viewGrid');
  const viewList   = $('viewList');
  const galleryGrid= $('galleryGrid');

  if (refreshBtn) refreshBtn.addEventListener('click', () => navigateTo(state.currentFolder));
  if (viewGrid) {
    viewGrid.addEventListener('click', () => {
      state.viewMode = 'grid';
      viewGrid.classList.add('active');
      if (viewList) viewList.classList.remove('active');
      if (galleryGrid) galleryGrid.classList.remove('list-view');
    });
  }
  if (viewList) {
    viewList.addEventListener('click', () => {
      state.viewMode = 'list';
      viewList.classList.add('active');
      if (viewGrid) viewGrid.classList.remove('active');
      if (galleryGrid) galleryGrid.classList.add('list-view');
    });
  }

  // Upload Buttons
  const uploadBtn               = $('uploadBtn');
  const fabUploadBtn            = $('fabUploadBtn');
  const fileInput               = $('fileInput');
  const folderInput             = $('folderInput');
  const uploadOptCancelBtn      = $('uploadOptCancelBtn');
  const uploadOptBackdrop       = $('uploadOptBackdrop');
  const uploadOptSelectFilesBtn = $('uploadOptSelectFilesBtn');
  const uploadOptSelectFolderBtn= $('uploadOptSelectFolderBtn');
  const downloadFolderZipBtn    = $('downloadFolderZipBtn');
  const modeCopyLabel           = $('modeCopyLabel');
  const modeOverwriteLabel      = $('modeOverwriteLabel');

  if (uploadBtn) uploadBtn.addEventListener('click', openUploadOptModal);
  if (fabUploadBtn) fabUploadBtn.addEventListener('click', openUploadOptModal);
  if (uploadOptCancelBtn) uploadOptCancelBtn.addEventListener('click', closeUploadOptModal);
  if (uploadOptBackdrop) uploadOptBackdrop.addEventListener('click', closeUploadOptModal);

  if (modeCopyLabel && modeOverwriteLabel) {
    modeCopyLabel.addEventListener('click', () => {
      state.currentUploadMode = 'copy';
      modeCopyLabel.classList.add('active');
      modeOverwriteLabel.classList.remove('active');
    });
    modeOverwriteLabel.addEventListener('click', () => {
      state.currentUploadMode = 'overwrite';
      modeOverwriteLabel.classList.add('active');
      modeCopyLabel.classList.remove('active');
    });
  }

  if (uploadOptSelectFilesBtn && fileInput) {
    uploadOptSelectFilesBtn.addEventListener('click', () => {
      closeUploadOptModal();
      fileInput.click();
    });
  }

  if (uploadOptSelectFolderBtn && folderInput) {
    uploadOptSelectFolderBtn.addEventListener('click', () => {
      closeUploadOptModal();
      folderInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        uploadFiles(e.target.files);
        fileInput.value = '';
      }
    });
  }

  if (folderInput) {
    folderInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        uploadFiles(e.target.files);
        folderInput.value = '';
      }
    });
  }

  if (downloadFolderZipBtn) {
    downloadFolderZipBtn.addEventListener('click', () => {
      const apiBase = window.location.pathname.startsWith('/photos') ? '/api/photos' : '/api';
      const url = apiBase + '/download_folder?folder=' + encodeURIComponent(state.currentFolder);
      window.location.href = url;
    });
  }

  // Mkdir Modal
  const mkdirBtn        = $('mkdirBtn');
  const mkdirCancelBtn  = $('mkdirCancelBtn');
  const mkdirBackdrop   = $('mkdirBackdrop');
  const mkdirConfirmBtn = $('mkdirConfirmBtn');
  const mkdirInput      = $('mkdirInput');

  if (mkdirBtn) mkdirBtn.addEventListener('click', openMkdirModal);
  if (mkdirCancelBtn) mkdirCancelBtn.addEventListener('click', closeMkdirModal);
  if (mkdirBackdrop) mkdirBackdrop.addEventListener('click', closeMkdirModal);
  if (mkdirConfirmBtn) mkdirConfirmBtn.addEventListener('click', () => handleCreateFolder((p) => navigateTo(p)));
  if (mkdirInput) {
    mkdirInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleCreateFolder((p) => navigateTo(p));
      if (e.key === 'Escape') closeMkdirModal();
    });
  }

  // Multi-Selection Controls
  const selectModeBtn   = $('selectModeBtn');
  const selectCancelBtn = $('selectCancelBtn');
  const selectAllBtn    = $('selectAllBtn');
  const batchShareBtn   = $('batchShareBtn');
  const batchDeleteBtn  = $('batchDeleteBtn');

  if (selectModeBtn) selectModeBtn.addEventListener('click', () => toggleSelectMode(undefined, cardHandlers));
  if (selectCancelBtn) selectCancelBtn.addEventListener('click', () => toggleSelectMode(false, cardHandlers));

  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      if (state.selectedPaths.size === state.filteredItems.length) {
        state.selectedPaths.clear();
      } else {
        state.filteredItems.forEach(i => state.selectedPaths.add(i.path));
      }
      renderGallery(state.filteredItems, cardHandlers);
    });
  }

  if (batchShareBtn) batchShareBtn.addEventListener('click', handleBatchShare);
  if (batchDeleteBtn) batchDeleteBtn.addEventListener('click', () => handleBatchDelete((p) => navigateTo(p), cardHandlers));

  // Lightbox Controls
  const lbClose        = $('lbClose');
  const lbBackdrop     = $('lbBackdrop');
  const lbFavBtn       = $('lbFavBtn');
  const lbRotateBtn    = $('lbRotateBtn');
  const lbSlideshowBtn = $('lbSlideshowBtn');
  const lbShareBtn     = $('lbShareBtn');
  const lbDeleteBtn    = $('lbDeleteBtn');
  const lbPrev         = $('lbPrev');
  const lbNext         = $('lbNext');
  const lightbox       = $('lightbox');

  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lbBackdrop) lbBackdrop.addEventListener('click', closeLightbox);

  if (lbFavBtn) {
    lbFavBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.lightboxIdx < 0 || state.lightboxIdx >= state.mediaItems.length) return;
      const item = state.mediaItems[state.lightboxIdx];
      if (state.favorites.has(item.path)) {
        state.favorites.delete(item.path);
      } else {
        state.favorites.add(item.path);
      }
      saveFavorites();
      renderLightboxItem(state.lightboxIdx);
      renderGallery(state.filteredItems, cardHandlers);
    });
  }

  if (lbRotateBtn) lbRotateBtn.addEventListener('click', (e) => { e.stopPropagation(); rotateLightboxImage(); });
  if (lbSlideshowBtn) lbSlideshowBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSlideshow(cardHandlers); });

  if (lbShareBtn) {
    lbShareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.lightboxIdx < 0 || state.lightboxIdx >= state.mediaItems.length) return;
      shareItem(state.mediaItems[state.lightboxIdx]);
    });
  }

  if (lbDeleteBtn) {
    lbDeleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (state.lightboxIdx < 0 || state.lightboxIdx >= state.mediaItems.length) return;
      const item = state.mediaItems[state.lightboxIdx];
      if (!confirm(`⚠️ '${item.name}' 파일을 서버에서 영구 삭제하시겠습니까?`)) return;

      try {
        await deleteItemApi(item.path);
        if (state.favorites.has(item.path)) {
          state.favorites.delete(item.path);
          saveFavorites();
        }
        closeLightbox();
        await navigateTo(state.currentFolder);
      } catch (err) {
        alert(`삭제 중 오류가 발생했습니다: ${err.message}`);
      }
    });
  }

  if (lbPrev) {
    lbPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.lightboxIdx > 0) {
        state.lightboxIdx--;
        renderLightboxItem(state.lightboxIdx);
      }
    });
  }

  if (lbNext) {
    lbNext.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.lightboxIdx < state.mediaItems.length - 1) {
        state.lightboxIdx++;
        renderLightboxItem(state.lightboxIdx);
      }
    });
  }

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (!lightbox || !lightbox.classList.contains('open')) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (searchInput) searchInput.focus();
      }
      return;
    }
    switch (e.key) {
      case 'Escape': closeLightbox(); break;
      case 'ArrowLeft':
        if (state.lightboxIdx > 0) { state.lightboxIdx--; renderLightboxItem(state.lightboxIdx); }
        break;
      case 'ArrowRight':
        if (state.lightboxIdx < state.mediaItems.length - 1) { state.lightboxIdx++; renderLightboxItem(state.lightboxIdx); }
        break;
    }
  });

  // Touch Swipe for Lightbox
  let touchStartX = 0;
  if (lightbox) {
    lightbox.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
    lightbox.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) < 50) return;
      if (dx < 0 && state.lightboxIdx < state.mediaItems.length - 1) { state.lightboxIdx++; renderLightboxItem(state.lightboxIdx); }
      if (dx > 0 && state.lightboxIdx > 0) { state.lightboxIdx--; renderLightboxItem(state.lightboxIdx); }
    });
  }

  // Drag & Drop File Upload
  const dropzoneOverlay = $('dropzoneOverlay');
  let dragCounter = 0;

  document.body.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dropzoneOverlay) dropzoneOverlay.classList.remove('hidden');
  });

  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  document.body.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0 && dropzoneOverlay) {
      dragCounter = 0;
      dropzoneOverlay.classList.add('hidden');
    }
  });

  document.body.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (dropzoneOverlay) dropzoneOverlay.classList.add('hidden');
    if (e.dataTransfer) {
      const extracted = await extractDroppedFiles(e.dataTransfer);
      // Create any empty folders dropped
      for (const emptyDir of extracted.emptyDirs) {
        try {
          await createFolderApi(state.currentFolder, emptyDir);
        } catch (err) {
          console.warn('Failed to create empty folder:', emptyDir, err);
        }
      }
      // Upload all extracted files (with relative paths preserved)
      if (extracted.files && extracted.files.length > 0) {
        await uploadFiles(extracted.files);
      } else if (extracted.emptyDirs.length > 0) {
        navigateTo(state.currentFolder);
      }
    }
  });
}

// ── App Start ─────────────────────────────────────────────────
initEvents();
navigateTo('');
