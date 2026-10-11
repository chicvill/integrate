// apps/files/frontend/js/ui.js
// MQnet Files Hub - UI 렌더링 및 인터랙션 모듈
import { state } from './state.js?v=1.1';
import { getRawUrl, getDownloadUrl } from './api.js?v=1.1';

// 카테고리별 아이콘 매핑
export const CATEGORY_ICONS = {
  folder: '📁',
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  document: '📄',
  code: '💻',
  archive: '🗜️',
  general: '📄'
};

export const CATEGORY_LABELS = {
  all: '전체',
  folder: '폴더',
  image: '이미지',
  video: '동영상',
  audio: '오디오',
  document: '문서',
  code: '코드',
  archive: '압축',
  general: '파일'
};

export function getCategoryIcon(cat) {
  return CATEGORY_ICONS[cat] || '📄';
}

// ── 로딩 스피너 ──────────────────────────────────────────
export function showLoading(container, text = '로딩 중...') {
  container.innerHTML = `
    <div class="empty-state">
      <div class="loading-spinner"></div>
      ${text ? `<p style="margin-top:0.75rem;color:var(--text-muted);font-size:0.875rem">${escHtml(text)}</p>` : ''}
    </div>`;
}

// ── 빈 상태 ──────────────────────────────────────────────
export function showEmpty(container, icon = '📂', title = '항목이 없습니다.', subtitle = '') {
  container.innerHTML = `
    <div class="empty-state fade-in">
      <div class="empty-icon">${icon}</div>
      <div class="empty-title">${escHtml(title)}</div>
      ${subtitle ? `<div class="empty-sub">${escHtml(subtitle)}</div>` : ''}
    </div>`;
}

// ── 브레드크럼 네비게이션 렌더링 ─────────────────────────
export function renderBreadcrumbs(container, breadcrumbs, onNavigate) {
  const scopeLabels = {
    files: '📁 /media/files (루트)',
    all: '🗄️ /media (통합 볼륨)',
    photos: '🖼️ /media/photos (갤러리)',
    downloads: '📥 /media/downloads (다운로드)'
  };
  const rootLabel = scopeLabels[state.scope] || '📁 /media/files';

  if (!breadcrumbs || !breadcrumbs.length) {
    container.innerHTML = `<span class="breadcrumb-item active">${rootLabel}</span>`;
    return;
  }

  const items = breadcrumbs.map((crumb, idx) => {
    const isLast = idx === breadcrumbs.length - 1;
    const isFirst = idx === 0;
    const label = isFirst ? rootLabel : escHtml(crumb.name);

    if (isLast) {
      return `<span class="breadcrumb-item active" title="${escHtml(crumb.path)}">${label}</span>`;
    }
    return `
      <span class="breadcrumb-item" data-path="${escHtml(crumb.path)}" title="${escHtml(crumb.path)}">${label}</span>
      <span class="breadcrumb-sep">›</span>`;
  }).join('');

  container.innerHTML = items;

  // 클릭 이벤트
  container.querySelectorAll('.breadcrumb-item:not(.active)').forEach(el => {
    el.addEventListener('click', () => onNavigate(el.dataset.path));
  });
}

// ── 폴더 그리드 렌더링 ────────────────────────────────────
// ── 선택 UI 동기화 (클립보드 Cut 상태 및 체크박스 반영) ──────────
export function syncSelectionUI() {
  const cutPaths = new Set(state.clipboard.action === 'cut' ? state.clipboard.paths : []);

  document.querySelectorAll('.folder-card, .file-icon-card, .file-table-row').forEach(el => {
    const path = el.dataset.path;
    if (!path) return;
    const isSelected = state.selectedPaths.has(path);
    const isCut = cutPaths.has(path);

    el.classList.toggle('selected', isSelected);
    el.classList.toggle('item-cut', isCut);

    const chk = el.querySelector('.item-checkbox');
    if (chk) {
      chk.classList.toggle('checked', isSelected);
      chk.textContent = isSelected ? '✓' : '';
    }
  });

  updateSelectionToolbar();
}

// ── Windows 탐색기 방식 클릭 핸들러 ─────────────────────────
export function handleItemSelection(e, path, callback) {
  if (e.shiftKey) {
    // Shift + 클릭: 범위 선택
    state.selectRange(path);
  } else if (e.ctrlKey || e.metaKey) {
    // Ctrl + 클릭: 토글 추가
    state.toggleSelect(path);
  } else {
    // 일반 클릭: 단일 선택
    state.setSingleSelect(path);
  }
  syncSelectionUI();
  if (callback) callback(path);
}

// ── 폴더 그리드 렌더링 ────────────────────────────────────
export function renderFolderGrid(container, folders, onNavigate, onToggleSelect, onContextMenu) {
  if (!folders.length) {
    container.innerHTML = '';
    return;
  }

  const cutPaths = new Set(state.clipboard.action === 'cut' ? state.clipboard.paths : []);

  container.innerHTML = folders.map(f => {
    const isSelected = state.selectedPaths.has(f.path);
    const isCut = cutPaths.has(f.path);
    return `
      <div class="folder-card fade-in ${isSelected ? 'selected' : ''} ${isCut ? 'item-cut' : ''}" data-path="${escHtml(f.path)}" role="button" tabindex="0">
        <button class="item-checkbox ${isSelected ? 'checked' : ''}" data-path="${escHtml(f.path)}" title="선택">
          ${isSelected ? '✓' : ''}
        </button>
        <span class="folder-icon">📁</span>
        <div class="folder-info">
          <div class="folder-name truncate" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
          <div class="folder-sub">${escHtml(f.modified_formatted)}</div>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.folder-card').forEach(el => {
    const path = el.dataset.path;
    const chk = el.querySelector('.item-checkbox');

    // 체크박스 클릭 (Shift 누르면 범위 선택, 아니면 토글)
    chk.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.shiftKey) {
        state.selectRange(path);
      } else {
        state.toggleSelect(path);
      }
      syncSelectionUI();
    });


    // 한 번 클릭: Windows 파일 탐색기 방식 (일반/Ctrl/Shift)
    el.addEventListener('click', (e) => {
      if (e.target.closest('.item-checkbox')) return;
      handleItemSelection(e, path);
    });

    // 더블클릭/엔터: 폴더 진입
    el.addEventListener('dblclick', () => onNavigate(path));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onNavigate(path);
    });

    if (onContextMenu) {
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!state.selectedPaths.has(path)) {
          state.setSingleSelect(path);
          syncSelectionUI();
        }
        onContextMenu(e, { path, name: el.querySelector('.folder-name')?.textContent, is_dir: true });
      });
    }
  });
}

// ── 작은 아이콘 그리드 렌더링 (★ 사진을 작은 아이콘 형태로) ──
export function renderFileGrid(container, files, onFileClick, onToggleSelect, onContextMenu) {
  if (!files.length) {
    container.innerHTML = '';
    return;
  }

  const cutPaths = new Set(state.clipboard.action === 'cut' ? state.clipboard.paths : []);

  container.innerHTML = `
    <div class="file-icon-grid fade-in">
      ${files.map(f => {
        const isSelected = state.selectedPaths.has(f.path);
        const isCut = cutPaths.has(f.path);
        const isImage = f.category === 'image';
        const icon = getCategoryIcon(f.category);
        const thumbUrl = isImage ? getRawUrl(f.path, state.scope) : null;

        return `
          <div class="file-icon-card ${isSelected ? 'selected' : ''} ${isCut ? 'item-cut' : ''}" data-path="${escHtml(f.path)}" data-category="${f.category}" tabindex="0">
            <button class="item-checkbox ${isSelected ? 'checked' : ''}" data-path="${escHtml(f.path)}" title="선택">
              ${isSelected ? '✓' : ''}
            </button>
            <div class="file-icon-box">
              ${isImage
                ? `<img class="file-icon-thumb" src="${thumbUrl}" alt="${escHtml(f.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : ''}
              <div class="file-icon-fallback" ${isImage ? 'style="display:none"' : ''}>${icon}</div>
            </div>
            <div class="file-icon-name" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
            <div class="file-icon-size">${escHtml(f.size_formatted)}</div>
          </div>`;
      }).join('')}
    </div>`;

  container.querySelectorAll('.file-icon-card').forEach(el => {
    const path = el.dataset.path;
    const file = files.find(f => f.path === path);
    const chk = el.querySelector('.item-checkbox');

    // 체크박스 클릭 (Shift 누르면 범위 선택, 아니면 토글)
    chk.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.shiftKey) {
        state.selectRange(path);
      } else {
        state.toggleSelect(path);
      }
      syncSelectionUI();
    });


    // 한 번 클릭: Windows 파일 탐색기 방식 선택
    el.addEventListener('click', (e) => {
      if (e.target.closest('.item-checkbox')) return;
      handleItemSelection(e, path);
    });

    // 더블 클릭: 미리보기 또는 열기
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (onFileClick) onFileClick(file);
    });

    // 엔터 키: 열기
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (onFileClick) onFileClick(file);
      }
    });

    if (onContextMenu) {
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!state.selectedPaths.has(path)) {
          state.setSingleSelect(path);
          syncSelectionUI();
        }
        onContextMenu(e, file);
      });
    }
  });
}

// ── 파일 리스트 뷰 렌더링 ─────────────────────────────────
export function renderFileList(container, files, onFileClick, onToggleSelect, onContextMenu) {
  if (!files.length) {
    container.innerHTML = '';
    return;
  }

  const cutPaths = new Set(state.clipboard.action === 'cut' ? state.clipboard.paths : []);

  container.innerHTML = `
    <div class="file-table-container fade-in">
      <table class="file-table">
        <thead>
          <tr>
            <th style="width:40px;text-align:center">
              <button class="item-checkbox" id="selectAllTableBtn" title="전체 선택"></button>
            </th>
            <th>이름</th>
            <th>유형</th>
            <th>크기</th>
            <th>수정일</th>
            <th style="width:100px;text-align:right">작업</th>
          </tr>
        </thead>
        <tbody>
          ${files.map(f => {
            const isSelected = state.selectedPaths.has(f.path);
            const isCut = cutPaths.has(f.path);
            const icon = getCategoryIcon(f.category);
            return `
              <tr class="file-table-row ${isSelected ? 'selected' : ''} ${isCut ? 'item-cut' : ''}" data-path="${escHtml(f.path)}">
                <td style="text-align:center">
                  <button class="item-checkbox ${isSelected ? 'checked' : ''}" data-path="${escHtml(f.path)}">
                    ${isSelected ? '✓' : ''}
                  </button>
                </td>
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
                  <div class="card-actions" style="justify-content:flex-end">
                    <button class="action-btn-mini btn-preview" title="열기/미리보기" data-path="${escHtml(f.path)}">👁</button>
                    <a class="action-btn-mini" href="${getDownloadUrl(f.path, state.scope)}" download title="다운로드">⬇</a>
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
    const chk = el.querySelector('.item-checkbox');

    chk.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.shiftKey) {
        state.selectRange(path);
      } else {
        state.toggleSelect(path);
      }
      syncSelectionUI();
    });


    el.addEventListener('click', (e) => {
      if (e.target.closest('.card-actions') || e.target.closest('.item-checkbox')) return;
      handleItemSelection(e, path);
    });

    el.addEventListener('dblclick', (e) => {
      if (e.target.closest('.card-actions')) return;
      if (onFileClick) onFileClick(file);
    });

    if (onContextMenu) {
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!state.selectedPaths.has(path)) {
          state.setSingleSelect(path);
          syncSelectionUI();
        }
        onContextMenu(e, file);
      });
    }
  });

  // 미리보기 버튼
  container.querySelectorAll('.btn-preview').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const file = files.find(f => f.path === btn.dataset.path);
      if (file && onFileClick) onFileClick(file);
    });
  });

  // 테이블 전체 선택 버튼
  const tableSelectAll = container.querySelector('#selectAllTableBtn');
  if (tableSelectAll) {
    const all = files.map(f => f.path);
    const allSelected = all.length > 0 && all.every(p => state.selectedPaths.has(p));
    tableSelectAll.classList.toggle('checked', allSelected);
    tableSelectAll.textContent = allSelected ? '✓' : '';
    tableSelectAll.addEventListener('click', (e) => {
      e.stopPropagation();
      if (allSelected) {
        all.forEach(p => state.selectedPaths.delete(p));
      } else {
        all.forEach(p => state.selectedPaths.add(p));
      }
      syncSelectionUI();
    });
  }
}

// ── 마우스 드래그 선택 (Windows Explorer Marquee Selection) ──
export function setupMarqueeSelection(viewportEl, onSelectionChange) {
  let isMouseDown = false;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let marqueeEl = null;
  let baseSelection = new Set();
  let isCtrl = false;

  viewportEl.addEventListener('mousedown', (e) => {
    // 마우스 왼쪽 버튼(0)만 처리
    if (e.button !== 0) return;

    // 아이템 카드나 버튼/입력/대화형 요소 클릭 시에는 드래그 상자 시작하지 않음
    if (e.target.closest('.folder-card, .file-icon-card, .file-table-row, button, input, select, textarea, a, .breadcrumbs, .section-header')) {
      return;
    }

    isMouseDown = true;
    isDragging = false;
    startX = e.clientX;
    startY = e.clientY;
    isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl) {
      baseSelection = new Set(state.selectedPaths);
    } else {
      baseSelection = new Set();
      state.clearSelection();
      syncSelectionUI();
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;

    const currentX = e.clientX;
    const currentY = e.clientY;
    const deltaX = Math.abs(currentX - startX);
    const deltaY = Math.abs(currentY - startY);

    if (!isDragging && (deltaX > 4 || deltaY > 4)) {
      isDragging = true;
      document.body.classList.add('no-user-select');
      if (!marqueeEl) {
        marqueeEl = document.createElement('div');
        marqueeEl.className = 'drag-selection-box';
        document.body.appendChild(marqueeEl);
      }
    }

    if (!isDragging || !marqueeEl) return;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    marqueeEl.style.left = `${left}px`;
    marqueeEl.style.top = `${top}px`;
    marqueeEl.style.width = `${width}px`;
    marqueeEl.style.height = `${height}px`;

    const marqueeRect = { left, top, right: left + width, bottom: top + height };

    const cards = viewportEl.querySelectorAll('.folder-card, .file-icon-card, .file-table-row');
    const newlySelected = new Set(baseSelection);

    cards.forEach(card => {
      const p = card.dataset.path;
      if (!p) return;
      const rect = card.getBoundingClientRect();
      const intersects = !(
        rect.right < marqueeRect.left ||
        rect.left > marqueeRect.right ||
        rect.bottom < marqueeRect.top ||
        rect.top > marqueeRect.bottom
      );

      if (intersects) {
        newlySelected.add(p);
      } else if (!isCtrl && newlySelected.has(p)) {
        newlySelected.delete(p);
      }
    });

    state.selectedPaths = newlySelected;
    syncSelectionUI();
  });

  const finishDrag = () => {
    if (isMouseDown) {
      isMouseDown = false;
      if (isDragging) {
        isDragging = false;
        document.body.classList.remove('no-user-select');
        if (marqueeEl) {
          marqueeEl.remove();
          marqueeEl = null;
        }
        // 드래그로 선택된 파일이 있을 경우 화면 순서상 마지막 항목을 lastSelectedPath로 지정
        if (state.selectedPaths.size > 0) {
          const allPaths = state.getAllVisiblePaths();
          const selectedInOrder = allPaths.filter(p => state.selectedPaths.has(p));
          if (selectedInOrder.length > 0) {
            state.lastSelectedPath = selectedInOrder[selectedInOrder.length - 1];
          }
        }
        if (onSelectionChange) onSelectionChange();
      }
    }
  };


  document.addEventListener('mouseup', finishDrag);
}

// ── 선택 툴바 UI 업데이트 (★ 복사, 이동, 붙여넣기, 삭제 포함) ─────
export function updateSelectionToolbar(handlers = {}) {
  const count = state.selectedPaths.size;
  const toolbar = document.getElementById('selectionToolbar');
  const badge = document.getElementById('selectionBadge');
  const editBtn = document.getElementById('selEditBtn');
  const renameBtn = document.getElementById('selRenameBtn');
  const deleteBtn = document.getElementById('selDeleteBtn');
  const selCopyBtn = document.getElementById('selCopyBtn');
  const selCutBtn = document.getElementById('selCutBtn');
  const selPasteBtn = document.getElementById('selPasteBtn');
  const toolbarPasteBtn = document.getElementById('toolbarPasteBtn');
  const previewBtn = document.getElementById('selPreviewBtn');

  // 클립보드에 붙여넣을 항목이 있는지 확인
  const hasClipboard = state.clipboard && state.clipboard.paths && state.clipboard.paths.length > 0;
  const clipActionText = state.clipboard.action === 'cut' ? '이동' : '복사';
  const pasteBtnLabel = hasClipboard ? `📥 붙여넣기 (${state.clipboard.paths.length}개 ${clipActionText})` : '📥 붙여넣기';

  if (toolbarPasteBtn) {
    if (hasClipboard) {
      toolbarPasteBtn.classList.remove('hidden');
      toolbarPasteBtn.textContent = pasteBtnLabel;
    } else {
      toolbarPasteBtn.classList.add('hidden');
    }
  }

  if (selPasteBtn) {
    if (hasClipboard) {
      selPasteBtn.classList.remove('hidden');
      selPasteBtn.textContent = pasteBtnLabel;
    } else {
      selPasteBtn.classList.add('hidden');
    }
  }

  if (!toolbar) return;

  if (count > 0) {
    toolbar.classList.remove('hidden');
    if (badge) badge.textContent = `${count}개 선택됨`;

    // 1개 선택 시에만 이름 변경 및 미리보기 활성화
    if (renameBtn) renameBtn.disabled = count !== 1;
    if (previewBtn) previewBtn.disabled = count !== 1;

    // 텍스트/코드 파일 1개 선택 시 내용 편집 활성화
    if (editBtn) {
      if (count === 1) {
        const selPath = Array.from(state.selectedPaths)[0];
        const file = state.files.find(f => f.path === selPath);
        const canEdit = file && (file.category === 'code' || file.category === 'document' || file.extension in { '.txt': 1, '.md': 1, '.json': 1, '.js': 1, '.html': 1, '.css': 1, '.py': 1, '.yml': 1, '.yaml': 1 });
        editBtn.style.display = canEdit ? 'inline-flex' : 'none';
      } else {
        editBtn.style.display = 'none';
      }
    }

    if (deleteBtn) {
      deleteBtn.textContent = `🗑 삭제 (${count})`;
    }
    if (selCopyBtn) {
      selCopyBtn.textContent = `📋 복사 (${count})`;
    }
    if (selCutBtn) {
      selCutBtn.textContent = `✂️ 이동 (${count})`;
    }
  } else {
    toolbar.classList.add('hidden');
  }
}


// ── 상태바 업데이트 ───────────────────────────────────────
export function updateStatusBar(data) {
  const el = document.getElementById('statusBarText');
  if (!el) return;
  const parts = [];
  if (data.totalCount != null) parts.push(`총 ${data.totalCount}개 항목`);
  if (data.freeSpaceText) parts.push(data.freeSpaceText);
  if (state.storageRoot) parts.push(`루트: ${state.storageRoot}`);
  el.textContent = parts.join(' · ');
}

// ── 헤더 스토리지 쿼터 게이지 위젯 렌더링 (★ 500KB 한도 & 실시간 분석) ──
export function renderStorageQuotaWidget(container, quota, onUpgradeClick) {
  if (!container || !quota) return;

  const pct = Math.min(100, quota.usage_percentage);
  const isFull = pct >= 100;
  const isWarn = pct >= 80 && !isFull;
  
  let barColor = 'linear-gradient(90deg, #38bdf8, #6366f1)';
  if (isFull) barColor = 'linear-gradient(90deg, #f59e0b, #ef4444)';
  else if (isWarn) barColor = 'linear-gradient(90deg, #38bdf8, #f59e0b)';

  const planClass = quota.plan_tier === 'pro' ? 'badge-pro' : 'badge-free';

  container.innerHTML = `
    <div class="quota-widget-wrapper" title="스토리지 상세 사용량을 확인하고 업그레이드합니다">
      <div class="quota-info-row">
        <span class="quota-plan-tag ${planClass}">${quota.plan_name}</span>
        <span class="quota-usage-text">${quota.total_used_formatted} / ${quota.max_quota_formatted} (${pct}%)</span>
        <button class="quota-upgrade-btn" id="headerUpgradeBtn" title="유료 플랜 업그레이드">⚡ Pro</button>
      </div>
      <div class="quota-mini-progress">
        <div class="quota-mini-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>

      <!-- 마우스 오버 툴팁 / 세부 분석 -->
      <div class="quota-breakdown-tooltip">
        <div class="tooltip-title">📊 카테고리별 저장 용량 분석</div>
        ${quota.breakdown && quota.breakdown.length ? quota.breakdown.filter(b => b.bytes > 0).map(b => `
          <div class="tooltip-row">
            <span>${b.label} (${b.count}개)</span>
            <strong>${b.formatted} (${b.percentage}%)</strong>
          </div>
        `).join('') : '<div style="color:var(--text-dim);font-size:0.75rem">사용 중인 파일이 없습니다.</div>'}
        <div class="tooltip-footer">
          클릭하여 Pro 플랜으로 업그레이드하세요!
        </div>
      </div>
    </div>
  `;

  // 업그레이드 버튼 및 위젯 클릭 이벤트
  container.querySelector('#headerUpgradeBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onUpgradeClick) onUpgradeClick();
  });

  container.querySelector('.quota-widget-wrapper')?.addEventListener('click', () => {
    if (onUpgradeClick) onUpgradeClick();
  });
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
