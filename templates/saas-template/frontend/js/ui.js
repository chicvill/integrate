/**
 * templates/saas-template/frontend/js/ui.js
 * DOM rendering and UI presentation logic.
 * Supports Multi-Branch (다중 매장) selector and badges.
 */

export function renderBranchOptions(branches, currentBranchId = '') {
  const branchSelector = document.getElementById('branchSelector');
  const itemBranchSelect = document.getElementById('itemBranch');

  if (branchSelector) {
    let optionsHtml = '<option value="">🏢 전체 매장 (통합 관제)</option>';
    for (const b of branches) {
      const selected = b.branch_id === currentBranchId ? 'selected' : '';
      optionsHtml += `<option value="${escapeHtml(b.branch_id)}" ${selected}>🏢 ${escapeHtml(b.name)}</option>`;
    }
    branchSelector.innerHTML = optionsHtml;
  }

  if (itemBranchSelect) {
    let itemOptionsHtml = '';
    for (const b of branches) {
      itemOptionsHtml += `<option value="${escapeHtml(b.branch_id)}">🏢 ${escapeHtml(b.name)}</option>`;
    }
    if (branches.length === 0) {
      itemOptionsHtml = '<option value="main">🏢 MQnet 본점</option>';
    }
    itemBranchSelect.innerHTML = itemOptionsHtml;
  }
}

export function renderItems(items, onEdit, onDelete, branches = []) {
  const container = document.getElementById('itemsGrid');
  const emptyState = document.getElementById('emptyState');
  if (!container) return;

  container.innerHTML = '';

  if (!items || items.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  // Branch map for quick name lookup
  const branchMap = {};
  for (const b of branches) {
    branchMap[b.branch_id] = b.name;
  }

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'item-card';

    const statusBadgeClass = 
      item.status === 'active' ? 'badge-active' :
      item.status === 'pending' ? 'badge-pending' : 'badge-completed';

    const formattedDate = item.created_at ? new Date(item.created_at).toLocaleDateString() : '';
    const branchName = branchMap[item.branch_id] || item.branch_id || '전체/기본';

    card.innerHTML = `
      <div class="item-header">
        <h4 class="item-title">${escapeHtml(item.title)}</h4>
        <div style="display: flex; gap: 0.35rem; align-items: center;">
          <span class="brand-badge" style="font-size: 0.65rem;">🏢 ${escapeHtml(branchName)}</span>
          <span class="item-badge ${statusBadgeClass}">${escapeHtml(item.status)}</span>
        </div>
      </div>
      <p class="item-detail">${escapeHtml(item.detail || '상세 설명이 없습니다.')}</p>
      <div class="item-meta">
        <span>${escapeHtml(item.category || '일반')} · ${formattedDate}</span>
        <div class="item-actions">
          <button class="btn btn-secondary btn-sm edit-btn">수정</button>
          <button class="btn btn-danger btn-sm delete-btn">삭제</button>
        </div>
      </div>
    `;

    card.querySelector('.edit-btn').addEventListener('click', () => onEdit(item));
    card.querySelector('.delete-btn').addEventListener('click', () => onDelete(item.id));

    container.appendChild(card);
  }
}

export function updateKpis(items, currentBranchName = '전체 매장') {
  const totalElem = document.getElementById('kpiTotalItems');
  const activeElem = document.getElementById('kpiActiveItems');
  const branchElem = document.getElementById('kpiCurrentBranch');
  if (!items) return;

  const total = items.length;
  const active = items.filter(i => i.status === 'active').length;

  if (totalElem) totalElem.textContent = total;
  if (activeElem) activeElem.textContent = active;
  if (branchElem) branchElem.textContent = currentBranchName;
}

/**
 * 상태별 토스트 팝업 (success, error, warning, info 지원)
 */
export function showToast(message, type = 'info', duration = 3200) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-text">${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
