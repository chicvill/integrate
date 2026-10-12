/**
 * apps/rent/frontend/app.js
 * MQnet Canonical SaaS 번들리스 프론트엔드 메인 진입점.
 */

import { state, loadInitialData } from './js/state.js?v=2.0';
import { selectRoom, renderAll } from './js/ui.js?v=2.0';
import {
  openModal,
  closeModal,
  openContractEditModal,
  handleContractFormSubmit,
  handleLeaseTypeChangeInForm,
  openExpenseModal,
  handleExpenseFormSubmit,
  openLedgerModal,
  exportCurrentRoomCSV,
  openUpgradeModal,
  handleUpgradeSubmit
} from './js/modals.js?v=2.0';

// ── 전역 윈도우 핸들러 바인딩 (인라인 HTML 호출 호환) ──
window.selectRoom = selectRoom;

window.handleRoomChange = function() {
  const sel = document.getElementById('roomSelect');
  if (sel) selectRoom(sel.value);
};

window.handleBranchChange = function() {
  const sel = document.getElementById('branchSelector');
  if (sel) {
    window.location.href = `./?branch=${encodeURIComponent(sel.value)}`;
  }
};

window.openContractEditModal = openContractEditModal;
window.handleContractFormSubmit = handleContractFormSubmit;
window.handleLeaseTypeChangeInForm = handleLeaseTypeChangeInForm;

window.openExpenseModal = openExpenseModal;
window.handleExpenseFormSubmit = handleExpenseFormSubmit;
window.openLedgerModal = openLedgerModal;
window.exportCurrentRoomCSV = exportCurrentRoomCSV;

window.openUpgradeModal = openUpgradeModal;
window.handleUpgradeSubmit = handleUpgradeSubmit;

window.openModal = openModal;
window.closeModal = closeModal;

// 아코디언 토글
window.toggleContractAccordion = function() {
  state.isContractOpen = !state.isContractOpen;
  const body = document.getElementById('contractAccordionBody');
  const text = document.getElementById('contractToggleText');
  const arrow = document.getElementById('contractToggleArrow');

  if (state.isContractOpen) {
    body.classList.remove('collapse-hidden');
    body.classList.add('collapse-open');
    text.textContent = '계약내용 접기';
    arrow.classList.add('rotate-180');
  } else {
    body.classList.remove('collapse-open');
    body.classList.add('collapse-hidden');
    text.textContent = '계약내용 펼치기';
    arrow.classList.remove('rotate-180');
  }
};

window.togglePastAccordion = function() {
  state.isPastOpen = !state.isPastOpen;
  const body = document.getElementById('pastAccordionBody');
  const text = document.getElementById('pastToggleText');
  const arrow = document.getElementById('pastToggleArrow');

  if (state.isPastOpen) {
    body.classList.remove('collapse-hidden');
    body.classList.add('collapse-open');
    text.textContent = '과거 내역 접기';
    arrow.classList.add('rotate-180');
  } else {
    body.classList.remove('collapse-open');
    body.classList.add('collapse-hidden');
    text.textContent = '과거 내역 펼치기';
    arrow.classList.remove('rotate-180');
  }
};

// ── 앱 부트스트랩 ──
window.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 MQnet Rent SaaS v2.0 초기화 중...");
  await loadInitialData();

  // Populate 29 Rooms dropdown
  const select = document.getElementById('roomSelect');
  if (select) {
    select.innerHTML = '';
    const roomKeys = Object.keys(state.rooms).map(Number).sort((a, b) => a - b);
    roomKeys.forEach(room => {
      const opt = document.createElement('option');
      opt.value = room;
      opt.textContent = `${room}호`;
      select.appendChild(opt);
    });
  }

  renderAll();
});
