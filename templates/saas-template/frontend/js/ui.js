/**
 * templates/saas-template/frontend/js/ui.js
 * DOM rendering and UI presentation logic.
 */

export function renderItems(items, onEdit, onDelete) {
  const container = document.getElementById('itemsGrid');
  const emptyState = document.getElementById('emptyState');
  if (!container) return;

  container.innerHTML = '';

  if (!items || items.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'item-card';

    const statusBadgeClass = 
      item.status === 'active' ? 'badge-active' :
      item.status === 'pending' ? 'badge-pending' : 'badge-completed';

    const formattedDate = item.created_at ? new Date(item.created_at).toLocaleDateString() : '';

    card.innerHTML = `
      <div class="item-header">
        <h4 class="item-title">${escapeHtml(item.title)}</h4>
        <span class="item-badge ${statusBadgeClass}">${escapeHtml(item.status)}</span>
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

export function updateKpis(items) {
  const totalElem = document.getElementById('kpiTotalItems');
  const activeElem = document.getElementById('kpiActiveItems');
  if (!items) return;

  const total = items.length;
  const active = items.filter(i => i.status === 'active').length;

  if (totalElem) totalElem.textContent = total;
  if (activeElem) activeElem.textContent = active;
}

export function showToast(message, duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
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
