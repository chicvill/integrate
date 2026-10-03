// apps/files/frontend/js/ui.js
// MQnet Files Hub - DOM 렌더링 및 UI 유틸리티

import { state } from './state.js?v=1.0';
import { getRawUrl } from './api.js?v=1.0';

// 파일 카테고리별 아이콘 매핑
const CATEGORY_ICONS = {
  folder:   '📁',
  image:    '🖼️',
  video:    '🎬',
  audio:    '🎵',
  document: '📄',
  code:     '💻',
  archive:  '🗜️',
  general:  '📎',
};

const CATEGORY_LABELS = {
  folder:   '폴더',
  image:    '이미지',
  video:    '영상',
  audio:    '음악',
  document: '문서',
  code:     '코드',
  archive:  '압축',
  general:  '파일',
};

export function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || '📎';
}

// ── 로딩 상태 표시 ─────────────────────────────────────────
export function showLoading(container, message = '불러오는 중...') {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon" style="animation: spin 1s linear infinite; display:inline-block;">⚙️</div>
      <p class="empty-text">${message}</p>
    </div>`;
}

// ── 빈 상태 / 에러 표시 ────────────────────────────────────
export function showEmpty(container, icon, title, sub = '') {
  container.innerHTML = `
    <div class="empty-state fade-in">
      <div class="empty-icon">${icon}</div>
      <p class="empty-text">${title}</p>
      ${sub ? `<p class="empty-sub">${sub}</p>` : ''}
    </div>`;
}

// ── 브레드크럼 렌더링 ─────────────────────────────────────
export function renderBreadcrumbs(container, breadcrumbs, onNavigate) {
  container.innerHTML = breadcrumbs.map((crumb, i) => {
    const isLast = i === breadcrumbs.length - 1;
    if (isLast) {
      return `<span class="breadcrumb-item active">📂 ${escHtml(crumb.name)}</span>`;
    }
    return `
      <span class="breadcrumb-item" data-path="${escHtml(crumb.path)}">🏠</span>
      <span class="breadcrumb-sep">›</span>`;
  }).join('');

  // 클릭 이벤트
  container.querySelectorAll('.breadcrumb-item:not(.active)').forEach(el => {
    el.addEventListener('click', () => onNavigate(el.dataset.path));
  });
}

// ── 폴더 그리드 렌더링 ────────────────────────────────────
export function renderFolderGrid(container, folders, onNavigate, onContextMenu) {
  if (!folders.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = folders.map(f => `
    <div class="folder-card fade-in" data-path="${escHtml(f.path)}" role="button" tabindex="0">
      <span class="folder-icon">📁</span>
      <div class="folder-info">
        <div class="folder-name truncate" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
        <div class="folder-sub">${escHtml(f.modified_formatted)}</div>
      </div>
    </div>`).join('');

  container.querySelectorAll('.folder-card').forEach(el => {
    el.addEventListener('click', () => onNavigate(el.dataset.path));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onNavigate(el.dataset.path);
    });
    if (onContextMenu) {
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        onContextMenu(e, { path: el.dataset.path, is_dir: true });
      });
    }
  });
}

// ── 파일 그리드 렌더링 ────────────────────────────────────
export function renderFileGrid(container, files, onFileClick, onContextMenu) {
  if (!files.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = files.map(f => {
    const isSelected = state.selectedPaths.has(f.path);
    const icon = getCategoryIcon(f.category);
    const isImage = f.category === 'image';
    const thumbUrl = isImage ? getRawUrl(f.path) : null;

    return `
      <div class="file-card fade-in ${isSelected ? 'selected' : ''}" data-path="${escHtml(f.path)}" data-category="${f.category}">
        <div class="file-thumbnail-wrap">
          ${isImage
            ? `<img class="file-thumbnail-img" src="${thumbUrl}" alt="${escHtml(f.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''}
          <div class="file-icon-placeholder" ${isImage ? 'style="display:none"' : ''}>${icon}</div>
        </div>
        <div class="file-card-body">
          <div class="file-card-title truncate" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
          <div class="file-card-meta">
            <span class="file-badge-cat">${CATEGORY_LABELS[f.category] || '파일'}</span>
            <span>${escHtml(f.size_formatted)}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.file-card').forEach(el => {
    const path = el.dataset.path;
    const file = files.find(f => f.path === path);
    el.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        state.toggleSelect(path);
        el.classList.toggle('selected', state.selectedPaths.has(path));
        updateSelectionBadge();
      } else {
        onFileClick(file);
      }
    });
    if (onContextMenu) {
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        onContextMenu(e, file);
      });
    }
  });
}

// ── 파일 리스트 뷰 렌더링 ─────────────────────────────────
export function renderFileList(container, files, onFileClick, onContextMenu) {
  if (!files.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `
    <div class="file-table-container fade-in">
      <table class="file-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>유형</th>
            <th>크기</th>
            <th>수정일</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${files.map(f => {
            const isSelected = state.selectedPaths.has(f.path);
            const icon = getCategoryIcon(f.category);
            return `
              <tr class="file-table-row ${isSelected ? 'selected' : ''}" data-path="${escHtml(f.path)}">
                <td>
                  <div class="file-name-cell">
                    <span class="file-table-icon">${icon}</span>
                    <span class="truncate" title="${escHtml(f.name)}">${escHtml(f.name)}</span>
                  </div>
                </td>
                <td><span class="file-badge-cat">${CATEGORY_LABELS[f.category] || '파일'}</span></td>
                <td style="color:var(--text-muted)">${escHtml(f.size_formatted)}</td>
                <td style="color:var(--text-dim);font-size:0.82rem">${escHtml(f.modified_formatted)}</td>
                <td>
                  <div class="card-actions">
                    <button class="action-btn-mini btn-preview" title="미리보기" data-path="${escHtml(f.path)}">👁</button>
                    <a class="action-btn-mini" href="${getRawUrl(f.path).replace('/raw?', '/download?')}" download title="다운로드">⬇</a>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  container.querySelectorAll('.file-table-row').forEach(el => {
    const path = el.dataset.path;
    const file = files.find(f => f.path === path);
    el.addEventListener('click', (e) => {
      if (e.target.closest('.card-actions')) return;
      if (e.ctrlKey || e.metaKey) {
        state.toggleSelect(path);
        el.classList.toggle('selected', state.selectedPaths.has(path));
        updateSelectionBadge();
      } else {
        onFileClick(file);
      }
    });
    if (onContextMenu) {
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        onContextMenu(e, file);
      });
    }
  });

  // 미리보기 버튼
  container.querySelectorAll('.btn-preview').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const file = files.find(f => f.path === btn.dataset.path);
      if (file) onFileClick(file);
    });
  });
}

// ── 상태바 / 선택 뱃지 ────────────────────────────────────
export function updateSelectionBadge() {
  const count = state.selectedPaths.size;
  const el = document.getElementById('selectionBadge');
  if (!el) return;
  if (count > 0) {
    el.textContent = `${count}개 선택됨`;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }

  const delBtn = document.getElementById('deleteSelectedBtn');
  if (delBtn) {
    delBtn.classList.toggle('hidden', count === 0);
  }
}

export function updateStatusBar(data) {
  const el = document.getElementById('statusBarText');
  if (!el) return;
  const parts = [];
  if (data.totalCount != null) parts.push(`총 ${data.totalCount}개 항목`);
  if (data.freeSpaceText) parts.push(data.freeSpaceText);
  el.textContent = parts.join(' · ');
}

// ── 토스트 알림 ───────────────────────────────────────────
let _toastTimers = [];

export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${escHtml(message)}</span>`;
  container.appendChild(toast);

  const t = setTimeout(() => {
    toast.style.animation = 'slideOut 0.25s ease forwards';
    setTimeout(() => toast.remove(), 250);
  }, duration);
  _toastTimers.push(t);
}

// ── 업로드 진행률 UI ──────────────────────────────────────
export function showUploadProgress(container, percent) {
  const existing = container.querySelector('.upload-progress-bar-wrap');
  if (existing) {
    existing.querySelector('.upload-bar-fill').style.width = `${percent}%`;
    existing.querySelector('.upload-bar-label').textContent = `${percent}%`;
    return;
  }
  const div = document.createElement('div');
  div.className = 'upload-progress-bar-wrap';
  div.style.cssText = 'width:100%;background:rgba(255,255,255,0.06);border-radius:8px;overflow:hidden;margin:0.75rem 0';
  div.innerHTML = `
    <div class="upload-bar-fill" style="height:8px;background:linear-gradient(135deg,#6366f1,#38bdf8);width:${percent}%;transition:width 0.2s;border-radius:8px"></div>
    <div class="upload-bar-label" style="text-align:center;font-size:0.8rem;color:#94a3b8;margin-top:0.25rem">${percent}%</div>`;
  container.appendChild(div);
}

export function hideUploadProgress(container) {
  container.querySelector('.upload-progress-bar-wrap')?.remove();
}

// ── 유틸리티 ──────────────────────────────────────────────
export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 드래그 앤 드롭 오버레이
export function setupDragDropOverlay(overlay, onDrop) {
  let enterCount = 0;
  document.addEventListener('dragenter', (e) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      enterCount++;
      overlay.classList.add('active');
    }
  });
  document.addEventListener('dragleave', () => {
    enterCount--;
    if (enterCount <= 0) {
      enterCount = 0;
      overlay.classList.remove('active');
    }
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  overlay.addEventListener('drop', (e) => {
    e.preventDefault();
    overlay.classList.remove('active');
    enterCount = 0;
    if (e.dataTransfer?.files?.length) {
      onDrop(e.dataTransfer.files);
    }
  });
}
