/**
 * templates/saas-template/frontend/app.js
 * Main Frontend Controller & Lifecycle Manager.
 */

import { getApiBase, fetchWithAuth } from './js/api.js?v=1.0';
import { state } from './js/state.js?v=1.0';
import { renderItems, updateKpis, showToast } from './js/ui.js?v=1.0';
import { openItemModal, closeItemModal, openAiModal, closeAiModal } from './js/modals.js?v=1.0';

// API Base URL
const API_BASE = getApiBase('{{APP_ID}}');

async function loadData() {
  try {
    const data = await fetchWithAuth(`${API_BASE}/items`);
    state.setItems(data.items || []);
  } catch (err) {
    showToast('데이터 로드 실패: ' + err.message);
  }
}

async function checkSystemStatus() {
  const beacon = document.getElementById('systemStatusBeacon');
  const textElem = document.getElementById('systemStatusText');
  try {
    const status = await fetchWithAuth(`${API_BASE}/status`);
    state.setSystemStatus(status);
    if (textElem) textElem.textContent = 'ONLINE 🟢';
    if (beacon) beacon.querySelector('.status-dot').className = 'status-dot online';
  } catch (err) {
    if (textElem) textElem.textContent = 'OFFLINE 🔴';
    if (beacon) beacon.querySelector('.status-dot').className = 'status-dot';
  }
}

async function handleSaveItem(e) {
  e.preventDefault();
  const id = document.getElementById('editItemId').value;
  const title = document.getElementById('itemTitle').value.trim();
  const category = document.getElementById('itemCategory').value.trim() || '일반';
  const status = document.getElementById('itemStatus').value;
  const detail = document.getElementById('itemDetail').value.trim();

  if (!title) {
    showToast('명칭을 입력해주세요.');
    return;
  }

  const payload = { title, category, status, detail };

  try {
    if (id) {
      // Update
      await fetchWithAuth(`${API_BASE}/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('항목이 성공적으로 수정되었습니다.');
    } else {
      // Create
      await fetchWithAuth(`${API_BASE}/items`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('새 항목이 등록되었습니다.');
    }
    closeItemModal();
    loadData();
  } catch (err) {
    showToast('저장 중 오류: ' + err.message);
  }
}

async function handleDeleteItem(itemId) {
  if (!confirm('이 항목을 정말 삭제하시겠습니까?')) return;
  try {
    await fetchWithAuth(`${API_BASE}/items/${itemId}`, {
      method: 'DELETE'
    });
    showToast('항목이 삭제되었습니다.');
    loadData();
  } catch (err) {
    showToast('삭제 실패: ' + err.message);
  }
}

async function handleRunAiAnalysis() {
  const promptInput = document.getElementById('aiPrompt');
  const resultBox = document.getElementById('aiResultBox');
  const resultContent = document.getElementById('aiResultContent');
  const prompt = promptInput.value.trim();

  if (!prompt) {
    showToast('질문 프롬프트를 입력해주세요.');
    return;
  }

  resultBox.style.display = 'block';
  resultContent.innerHTML = '<em>분석 중입니다... 잠시만 기다려주세요.</em>';

  try {
    const res = await fetchWithAuth(`${API_BASE}/ai/analyze`, {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });
    const insights = res.data?.insights || '분석 결과가 없습니다.';
    resultContent.textContent = insights;
  } catch (err) {
    resultContent.textContent = '분석 실패: ' + err.message;
  }
}

// Setup Event Listeners
function setupEventListeners() {
  document.getElementById('openCreateModalBtn')?.addEventListener('click', () => openItemModal());
  document.getElementById('closeItemModalBtn')?.addEventListener('click', closeItemModal);
  document.getElementById('cancelItemModalBtn')?.addEventListener('click', closeItemModal);
  document.getElementById('itemForm')?.addEventListener('submit', handleSaveItem);

  document.getElementById('openAiModalBtn')?.addEventListener('click', openAiModal);
  document.getElementById('closeAiModalBtn')?.addEventListener('click', closeAiModal);
  document.getElementById('submitAiBtn')?.addEventListener('click', handleRunAiAnalysis);

  document.getElementById('statusFilter')?.addEventListener('change', (e) => {
    state.setFilters(e.target.value, state.searchKeyword);
  });

  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const triggerSearch = () => {
    state.setFilters(state.statusFilter, searchInput.value.trim());
  };
  searchBtn?.addEventListener('click', triggerSearch);
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') triggerSearch();
  });
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();

  // State Subscription: update UI on change
  state.subscribe((s) => {
    const filtered = s.getFilteredItems();
    renderItems(filtered, openItemModal, handleDeleteItem);
    updateKpis(s.items);
  });

  checkSystemStatus();
  loadData();

  // Setup periodic refresh
  setInterval(checkSystemStatus, 30000);
});
