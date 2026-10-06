/**
 * templates/saas-template/frontend/app.js
 * Main Frontend Controller & Lifecycle Manager.
 * Supports Multi-Branch (다중 매장/지점) management and real-time switching.
 */

import { MQnetAuth } from '/shared/ui/auth.js?v=2.0';
import { getApiBase, fetchWithAuth, fetchBranches, createBranch } from './js/api.js?v=2.0';
import { state } from './js/state.js?v=2.0';
import { renderItems, renderBranchOptions, updateKpis, showToast } from './js/ui.js?v=2.0';
import { openItemModal, closeItemModal, openBranchModal, closeBranchModal, openAiModal, closeAiModal } from './js/modals.js?v=2.0';

// API Base URL
const API_BASE = getApiBase('{{APP_ID}}');

async function loadBranches() {
  try {
    const data = await fetchBranches(API_BASE);
    state.setBranches(data.branches || []);
    renderBranchOptions(state.branches, state.currentBranchId);
  } catch (err) {
    console.warn('지점 목록 로드 안내:', err.message);
  }
}

async function loadData() {
  try {
    const url = state.currentBranchId 
      ? `${API_BASE}/items?branch_id=${encodeURIComponent(state.currentBranchId)}`
      : `${API_BASE}/items`;
    const data = await fetchWithAuth(url);
    state.setItems(data.items || []);
  } catch (err) {
    showToast('데이터 로드 실패: ' + err.message, 'error');
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
  const branch_id = document.getElementById('itemBranch')?.value || state.currentBranchId || 'main';
  const title = document.getElementById('itemTitle').value.trim();
  const category = document.getElementById('itemCategory').value.trim() || '일반';
  const status = document.getElementById('itemStatus').value;
  const detail = document.getElementById('itemDetail').value.trim();

  if (!title) {
    showToast('명칭을 입력해주세요.', 'warning');
    return;
  }

  const payload = { branch_id, title, category, status, detail };

  try {
    if (id) {
      // Update
      await fetchWithAuth(`${API_BASE}/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('항목이 성공적으로 수정되었습니다.', 'success');
    } else {
      // Create
      await fetchWithAuth(`${API_BASE}/items`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('새 항목이 등록되었습니다.', 'success');
    }
    closeItemModal();
    await loadData();
  } catch (err) {
    showToast('저장 실패: ' + err.message, 'error');
  }
}

async function handleDeleteItem(itemId) {
  if (!confirm('정말로 이 항목을 삭제하시겠습니까?')) return;

  try {
    await fetchWithAuth(`${API_BASE}/items/${itemId}`, {
      method: 'DELETE'
    });
    showToast('항목이 삭제되었습니다.', 'info');
    await loadData();
  } catch (err) {
    showToast('삭제 실패: ' + err.message, 'error');
  }
}

async function handleSaveBranch(e) {
  e.preventDefault();
  const branch_id = document.getElementById('branchCode').value.trim();
  const name = document.getElementById('branchName').value.trim();
  const contact_phone = document.getElementById('branchPhone').value.trim();
  const address = document.getElementById('branchAddress').value.trim();

  if (!branch_id || !name) {
    showToast('매장 코드와 매장명을 입력해주세요.', 'warning');
    return;
  }

  try {
    await createBranch(API_BASE, { branch_id, name, contact_phone, address });
    showToast(`신규 매장 '${name}'이(가) 등록되었습니다.`, 'success');
    closeBranchModal();
    await loadBranches();
    state.setCurrentBranch(branch_id);
    await loadData();
  } catch (err) {
    showToast('매장 등록 실패: ' + err.message, 'error');
  }
}

async function handleRunAiAnalysis() {
  const promptInput = document.getElementById('aiPrompt');
  const resultBox = document.getElementById('aiResultBox');
  const resultContent = document.getElementById('aiResultContent');
  const prompt = promptInput.value.trim();

  if (!prompt) {
    showToast('AI 프롬프트를 입력해주세요.', 'warning');
    return;
  }

  showToast('Gemini AI 분석 진행 중...', 'info', 2000);
  resultBox.style.display = 'block';
  resultContent.textContent = 'AI 응답 생성 중... 잠시만 기다려주세요.';

  try {
    const res = await fetchWithAuth(`${API_BASE}/ai/analyze`, {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        branch_id: state.currentBranchId || null,
        context_data: { items_count: state.items.length }
      })
    });
    resultContent.textContent = res.data?.insights || res.analysis || '분석 결과를 받지 못했습니다.';
    showToast('AI 분석이 완료되었습니다.', 'success');
  } catch (err) {
    resultContent.textContent = 'AI 분석 오류: ' + err.message;
    showToast('AI 분석 실패: ' + err.message, 'error');
  }
}

function setupEventListeners() {
  // 아이템 모달
  document.getElementById('openCreateModalBtn')?.addEventListener('click', () => openItemModal(null));
  document.getElementById('emptyCreateBtn')?.addEventListener('click', () => openItemModal(null));
  document.getElementById('closeItemModalBtn')?.addEventListener('click', closeItemModal);
  document.getElementById('cancelItemModalBtn')?.addEventListener('click', closeItemModal);
  document.getElementById('itemForm')?.addEventListener('submit', handleSaveItem);

  // 매장(지점) 모달 및 셀렉터
  document.getElementById('openBranchModalBtn')?.addEventListener('click', openBranchModal);
  document.getElementById('closeBranchModalBtn')?.addEventListener('click', closeBranchModal);
  document.getElementById('cancelBranchModalBtn')?.addEventListener('click', closeBranchModal);
  document.getElementById('branchForm')?.addEventListener('submit', handleSaveBranch);
  
  document.getElementById('branchSelector')?.addEventListener('change', (e) => {
    state.setCurrentBranch(e.target.value);
    loadData();
  });

  // AI 분석 모달
  document.getElementById('openAiModalBtn')?.addEventListener('click', openAiModal);
  document.getElementById('closeAiModalBtn')?.addEventListener('click', closeAiModal);
  document.getElementById('submitAiBtn')?.addEventListener('click', handleRunAiAnalysis);

  // 검색 & 필터
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

  // ── MQnet 통합 인증 초기화 및 사용자 배지 바인딩 ──
  MQnetAuth.init({
    appId: '{{APP_ID}}',
    onAuthChange: (user) => {
      state.setCurrentUser(user);
      MQnetAuth.renderBadge('userAuthBadge');
    }
  });
  MQnetAuth.renderBadge('userAuthBadge');

  // State Subscription: update UI on change
  state.subscribe((s) => {
    const filtered = s.getFilteredItems();
    renderItems(filtered, openItemModal, handleDeleteItem, s.branches);
    
    // 현재 선택된 매장명 파악
    const currentBranchObj = s.branches.find(b => b.branch_id === s.currentBranchId);
    const branchName = currentBranchObj ? currentBranchObj.name : (s.currentBranchId ? s.currentBranchId : '전체 매장');
    updateKpis(s.items, branchName);
  });

  checkSystemStatus();
  loadBranches().then(() => {
    loadData();
  });

  // Setup periodic refresh
  setInterval(checkSystemStatus, 30000);
});
