/**
 * templates/saas-template/frontend/js/modals.js
 * Modal open/close and form management logic.
 * Supports Item modal, AI modal, and Branch create modal.
 */

export function openItemModal(item = null) {
  const modal = document.getElementById('itemModal');
  const titleElem = document.getElementById('modalTitle');
  const idInput = document.getElementById('editItemId');
  const branchSelect = document.getElementById('itemBranch');
  const titleInput = document.getElementById('itemTitle');
  const categoryInput = document.getElementById('itemCategory');
  const statusInput = document.getElementById('itemStatus');
  const detailInput = document.getElementById('itemDetail');

  if (item) {
    titleElem.textContent = '항목 수정';
    idInput.value = item.id;
    if (branchSelect) branchSelect.value = item.branch_id || 'main';
    titleInput.value = item.title || '';
    categoryInput.value = item.category || '일반';
    statusInput.value = item.status || 'active';
    detailInput.value = item.detail || '';
  } else {
    titleElem.textContent = '신규 항목 등록';
    idInput.value = '';
    titleInput.value = '';
    categoryInput.value = '일반';
    statusInput.value = 'active';
    detailInput.value = '';
  }

  modal.style.display = 'flex';
}

export function closeItemModal() {
  const modal = document.getElementById('itemModal');
  if (modal) modal.style.display = 'none';
}

export function openBranchModal() {
  const modal = document.getElementById('branchModal');
  const form = document.getElementById('branchForm');
  if (form) form.reset();
  if (modal) modal.style.display = 'flex';
}

export function closeBranchModal() {
  const modal = document.getElementById('branchModal');
  if (modal) modal.style.display = 'none';
}

export function openAiModal() {
  const modal = document.getElementById('aiModal');
  const promptInput = document.getElementById('aiPrompt');
  const resultBox = document.getElementById('aiResultBox');
  if (promptInput) promptInput.value = '';
  if (resultBox) resultBox.style.display = 'none';
  if (modal) modal.style.display = 'flex';
}

export function closeAiModal() {
  const modal = document.getElementById('aiModal');
  if (modal) modal.style.display = 'none';
}
