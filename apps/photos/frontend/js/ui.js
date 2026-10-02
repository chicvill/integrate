import { $, DOC_ICONS, state, formatBytes, saveFavorites } from './state.js';

export const lazyObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      const dataSrc = img.dataset.src;
      if (dataSrc) {
        img.src = dataSrc;
        img.removeAttribute('data-src');
      }
      obs.unobserve(img);
    }
  });
}, { rootMargin: '200px' });

export function cleanupDragState() {
  state.isDraggingItems = false;
  state.draggedPaths = [];
  document.body.classList.remove('is-dragging-card');
  document.querySelectorAll('.card.is-dragging').forEach(c => c.classList.remove('is-dragging'));
  document.querySelectorAll('.card.folder.drag-target-hover').forEach(c => c.classList.remove('drag-target-hover'));
  document.querySelectorAll('.crumb.crumb-drag-hover').forEach(c => c.classList.remove('crumb-drag-hover'));
  const dropzone = document.getElementById('dropzoneOverlay');
  if (dropzone) dropzone.classList.add('hidden');
}

export function renderBreadcrumb(folder, onNavigate, handlers) {
  const breadcrumb = $('breadcrumb');
  if (!breadcrumb) return;
  breadcrumb.innerHTML = '';

  const makeBtn = (label, path, icon = false) => {
    const btn = document.createElement('button');
    btn.className = 'crumb';
    btn.dataset.path = path;
    btn.innerHTML = `${icon ? `<svg class="crumb-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8.354 1.146a.5.5 0 00-.708 0l-6 6A.5.5 0 002 7.5v7a.5.5 0 00.5.5h4a.5.5 0 00.5-.5v-4h2v4a.5.5 0 00.5.5h4a.5.5 0 00.5-.5v-7a.5.5 0 00-.146-.354L13 5.793V2.5a.5.5 0 00-.5-.5h-1a.5.5 0 00-.5.5v1.293L8.354 1.146z"/></svg>` : ''} ${label}`;
    btn.addEventListener('click', () => onNavigate(path));

    // Drag & Drop to Move onto Breadcrumb
    btn.addEventListener('dragover', (e) => {
      if (state.isDraggingItems && state.draggedPaths && state.draggedPaths.length > 0) {
        if (path !== state.currentFolder) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          btn.classList.add('crumb-drag-hover');
        }
      }
    });

    btn.addEventListener('dragleave', () => {
      btn.classList.remove('crumb-drag-hover');
    });

    btn.addEventListener('drop', async (e) => {
      btn.classList.remove('crumb-drag-hover');
      if (state.isDraggingItems && state.draggedPaths && state.draggedPaths.length > 0) {
        if (path !== state.currentFolder) {
          e.preventDefault();
          e.stopPropagation();
          const targets = [...state.draggedPaths];
          cleanupDragState();
          if (handlers && handlers.onMoveItems) {
            await handlers.onMoveItems(targets, path);
          }
        }
      }
    });

    return btn;
  };

  const homeBtn = makeBtn('L:\\', '', true);
  if (!folder) homeBtn.classList.add('active');
  breadcrumb.appendChild(homeBtn);

  if (folder) {
    const parts = folder.split('/');
    parts.forEach((part, i) => {
      const partPath = parts.slice(0, i + 1).join('/');
      const btn = makeBtn(part, partPath, false);
      if (i === parts.length - 1) btn.classList.add('active');
      breadcrumb.appendChild(btn);
    });
  }
}

export function renderSidebarStats(counts, storageData) {
  const statFolders = $('statFolders');
  const statPhotos  = $('statPhotos');
  const statVideos  = $('statVideos');
  const statDocs    = $('statDocs');
  const storageMeter = $('storageMeter');
  const storageText = $('storageText');
  const storageBarFill = $('storageBarFill');

  if (statFolders) statFolders.textContent = counts.folders ?? 0;
  if (statPhotos)  statPhotos.textContent  = counts.images ?? 0;
  if (statVideos)  statVideos.textContent  = counts.videos ?? 0;
  if (statDocs)    statDocs.textContent    = counts.documents ?? 0;

  if (storageData && storageMeter) {
    storageMeter.classList.remove('hidden');
    if (storageText) storageText.textContent = `${formatBytes(storageData.used)} / ${formatBytes(storageData.total)} (${storageData.percent}%)`;
    if (storageBarFill) storageBarFill.style.width = `${storageData.percent}%`;
  }
}

export function makeCard(item, mediaItems, handlers) {
  const card = document.createElement('div');
  const isSelected = state.selectedPaths ? state.selectedPaths.has(item.path) : false;
  const isFav = state.favorites.has(item.path);

  card.className = `card ${item.type} ${isSelected ? 'selected' : ''} ${isFav ? 'is-fav' : ''}`;

const FOLDER_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366f1' width='48' height='48'><path d='M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'/></svg>";

  let contentHtml = '';
  if (item.type === 'folder') {
    contentHtml = `
      <div class="card-thumb">
        <img data-src="${item.cover_url}" src="${FOLDER_PLACEHOLDER}" alt="${item.name}" loading="lazy">
        <div class="folder-icon-overlay">📁 ${item.name}</div>
      </div>
      <div class="card-label">
        <span class="card-name">${item.name}</span>
        <span class="card-meta">폴더</span>
      </div>`;

  } else if (item.type === 'document') {
    const icon = DOC_ICONS[item.doc_category] || '📄';
    contentHtml = `
      <div class="card-thumb doc-thumb">
        <div class="doc-card-icon">${icon}</div>
      </div>
      <div class="card-label">
        <span class="card-name">${item.name}</span>
        <span class="card-meta">${item.doc_category.toUpperCase()} 문서</span>
      </div>`;
  } else {
    const isVideo = item.type === 'video';
    contentHtml = `
      <div class="card-thumb">
        <img data-src="${item.thumb_url}" src="" alt="${item.name}" loading="lazy">
        ${isVideo ? `
        <div class="play-badge">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/></svg>
        </div>` : ''}
      </div>
      <div class="card-label">
        <span class="card-name">${item.name}</span>
        <span class="card-meta">${isVideo ? '🎬 동영상' : '🖼️ 사진'}</span>
      </div>`;
  }

  const checkboxHtml = `<div class="card-checkbox ${isSelected ? 'checked' : ''}">${isSelected ? '✓' : ''}</div>`;
  const favBtnHtml = `<button class="card-fav-btn ${isFav ? 'active' : ''}" title="즐겨찾기">⭐</button>`;

  card.innerHTML = checkboxHtml + favBtnHtml + contentHtml;

  // Checkbox click (activates select mode and toggles item selection with Shift support)
  const checkbox = card.querySelector('.card-checkbox');
  if (checkbox) {
    checkbox.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!state.isSelectMode && handlers.onEnableSelectMode) {
        handlers.onEnableSelectMode();
      }
      const itemIdx = state.displayItems ? state.displayItems.indexOf(item) : -1;
      if (handlers.onToggleSelection) {
        handlers.onToggleSelection(item.path, e.shiftKey, itemIdx);
      }
    });
  }

  // Fav button click
  const favBtn = card.querySelector('.card-fav-btn');
  if (favBtn) {
    favBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (state.favorites.has(item.path)) {
        state.favorites.delete(item.path);
        favBtn.classList.remove('active');
        card.classList.remove('is-fav');
      } else {
        state.favorites.add(item.path);
        favBtn.classList.add('active');
        card.classList.add('is-fav');
      }
      saveFavorites();
    });
  }

  card.addEventListener('click', (e) => {
    if (state.isSelectMode) {
      e.preventDefault();
      e.stopPropagation();
      const itemIdx = state.displayItems ? state.displayItems.indexOf(item) : -1;
      if (handlers.onToggleSelection) handlers.onToggleSelection(item.path, e.shiftKey, itemIdx);
    } else {
      if (item.type === 'folder') {
        if (handlers.onNavigate) handlers.onNavigate(item.path);
      } else {
        const mediaIdx = mediaItems.indexOf(item);
        if (handlers.onOpenLightbox) handlers.onOpenLightbox(mediaIdx);
      }
    }
  });

  const img = card.querySelector('img[data-src]');
  if (img) {
    lazyObserver.observe(img);
    img.addEventListener('error', () => { img.src = FOLDER_PLACEHOLDER; });
  }

  // ── Drag & Drop Implementation ──────────────────────────
  card.setAttribute('draggable', 'true');

  card.addEventListener('dragstart', (e) => {
    if (e.target.closest('.card-checkbox') || e.target.closest('.card-fav-btn')) {
      e.preventDefault();
      return;
    }

    const isSelected = state.selectedPaths && state.selectedPaths.has(item.path);
    let targets = [];
    if (isSelected && state.selectedPaths.size > 1) {
      targets = Array.from(state.selectedPaths);
    } else {
      targets = [item.path];
    }

    state.isDraggingItems = true;
    state.draggedPaths = targets;
    document.body.classList.add('is-dragging-card');

    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'mqnet-media-move',
      paths: targets,
      fromFolder: state.currentFolder
    }));
    e.dataTransfer.effectAllowed = 'move';

    setTimeout(() => {
      card.classList.add('is-dragging');
      if (targets.length > 1) {
        document.querySelectorAll('.card.selected').forEach(c => c.classList.add('is-dragging'));
      }
    }, 0);
  });

  card.addEventListener('dragend', () => {
    cleanupDragState();
  });

  // If this card is a folder, handle dragover & drop to move items into it
  if (item.type === 'folder') {
    card.addEventListener('dragover', (e) => {
      if (state.isDraggingItems && state.draggedPaths && state.draggedPaths.length > 0) {
        if (state.draggedPaths.includes(item.path)) return;
        if (state.draggedPaths.some(p => item.path.startsWith(p + '/'))) return;

        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-target-hover');
      } else if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files') && !state.isDraggingItems) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        card.classList.add('drag-target-hover');
      }
    });

    card.addEventListener('dragleave', (e) => {
      if (!card.contains(e.relatedTarget)) {
        card.classList.remove('drag-target-hover');
      }
    });

    card.addEventListener('drop', async (e) => {
      card.classList.remove('drag-target-hover');

      if (state.isDraggingItems && state.draggedPaths && state.draggedPaths.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        const targets = [...state.draggedPaths];
        cleanupDragState();
        if (handlers && handlers.onMoveItems) {
          await handlers.onMoveItems(targets, item.path);
        }
      } else if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        if (handlers && handlers.onUploadToFolder) {
          e.preventDefault();
          e.stopPropagation();
          handlers.onUploadToFolder(e.dataTransfer, item.path);
        }
      }
    });
  }

  return card;
}

export function sortAndFilterItems(items) {
  let list = [...items];

  // 1. Filter
  if (state.filterType === 'image') {
    list = list.filter(i => i.type === 'image');
  } else if (state.filterType === 'video') {
    list = list.filter(i => i.type === 'video');
  } else if (state.filterType === 'document') {
    list = list.filter(i => i.type === 'document');
  } else if (state.filterType === 'favorite') {
    list = list.filter(i => state.favorites.has(i.path));
  }

  // 2. Sort
  list.sort((a, b) => {
    // Keep folders first if not strictly filtering
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;

    if (state.sortBy === 'date_desc') {
      return (b.mtime || 0) - (a.mtime || 0);
    } else if (state.sortBy === 'date_asc') {
      return (a.mtime || 0) - (b.mtime || 0);
    } else if (state.sortBy === 'name_asc') {
      return a.name.localeCompare(b.name, 'ko', { numeric: true });
    } else if (state.sortBy === 'size_desc') {
      return (b.size || 0) - (a.size || 0);
    }
    return 0;
  });

  return list;
}

export function renderGallery(items, handlers) {
  const galleryGrid  = $('galleryGrid');
  const emptyState   = $('emptyState');
  if (!galleryGrid) return;

  galleryGrid.innerHTML = '';
  if (emptyState) emptyState.classList.add('hidden');

  const processed = sortAndFilterItems(items);
  state.displayItems = processed;

  const mediaItems = processed.filter(i => i.type !== 'folder');
  state.mediaItems = mediaItems;

  if (processed.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  const folders   = processed.filter(i => i.type === 'folder');
  const photos    = processed.filter(i => i.type === 'image');
  const videos    = processed.filter(i => i.type === 'video');
  const docs      = processed.filter(i => i.type === 'document');

  if (state.viewMode !== 'list') {
    if (folders.length > 0) {
      const title = document.createElement('p');
      title.className = 'gallery-section-title';
      title.textContent = `📁 폴더 (${folders.length})`;
      galleryGrid.appendChild(title);
      folders.forEach(item => galleryGrid.appendChild(makeCard(item, mediaItems, handlers)));
    }
    if (photos.length > 0) {
      const title = document.createElement('p');
      title.className = 'gallery-section-title';
      title.textContent = `🖼️ 사진 (${photos.length})`;
      galleryGrid.appendChild(title);
      photos.forEach(item => galleryGrid.appendChild(makeCard(item, mediaItems, handlers)));
    }
    if (videos.length > 0) {
      const title = document.createElement('p');
      title.className = 'gallery-section-title';
      title.textContent = `🎬 동영상 (${videos.length})`;
      galleryGrid.appendChild(title);
      videos.forEach(item => galleryGrid.appendChild(makeCard(item, mediaItems, handlers)));
    }
    if (docs.length > 0) {
      const title = document.createElement('p');
      title.className = 'gallery-section-title';
      title.textContent = `📄 문서 (${docs.length})`;
      galleryGrid.appendChild(title);
      docs.forEach(item => galleryGrid.appendChild(makeCard(item, mediaItems, handlers)));
    }
  } else {
    processed.forEach(item => galleryGrid.appendChild(makeCard(item, mediaItems, handlers)));
  }
}

export async function shareItem(item) {
  const fullUrl = window.location.origin + item.url;

  // Try binary file sharing if supported on smartphone
  if (navigator.share && navigator.canShare) {
    try {
      const res = await fetch(item.url);
      const blob = await res.blob();
      const file = new File([blob], item.name, { type: blob.type || 'application/octet-stream' });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: item.name,
          text: `MQnet Photos: ${item.name}`
        });
        return;
      }
    } catch (e) {
      console.log('File share fallback:', e);
    }
  }

  // URL share fallback
  if (navigator.share) {
    try {
      await navigator.share({
        title: item.name,
        text: `MQnet Photos: ${item.name}`,
        url: fullUrl
      });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  copyLinkToClipboard(fullUrl);
}

export function copyLinkToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      alert('📋 공유 링크가 클립보드에 복사되었습니다!\n카카오톡, 문자메시지 등에 붙여넣어 공유하세요.');
    }).catch(() => {
      prompt('이 공유 링크를 복사하세요:', text);
    });
  } else {
    prompt('이 공유 링크를 복사하세요:', text);
  }
}
