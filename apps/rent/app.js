/**
 * apps/rent/frontend/app.js
 * MQnet Canonical SaaS 번들리스 프론트엔드 메인 진입점.
 * 모바일 최적화 및 좌/우 슬라이드 드로어, 다중 부동산 선택, 전출자 1년 보존 지원.
 */

import { state, loadInitialData, touchAuthSession } from './js/state.js?v=2.0';
import {
  selectRoom,
  switchBranch,
  openMenuDrawer,
  closeMenuDrawer,
  toggleMenuDrawer,
  openRoomDrawer,
  closeRoomDrawer,
  toggleRoomDrawer,
  togglePastAccordion,
  renderAll
} from './js/ui.js?v=2.0';
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
  openVatModal,
  setVatPeriod,
  handleVatCustomQuery,
  exportVatCSV,
  onToggleVatRoomRow,
  toggleAllVatRooms,
  saveVatTargetRoomsSetting,
  openTenantHistoryModal,
  openNewBranchModal,
  handleNewBranchSubmit,
  openExcelImportModal,
  handleExcelFileSelect,
  onMappingFieldChange,
  executeBatchImport,
  downloadSampleExcelTemplate,
  handleGlobalPasteForOcr,
  openLoginSecurityModal,
  closeLoginSecurityModal,
  fillQuickLogin,
  handleSecurityLoginSubmit,
  handleLogout,
  handleOneTouchLogout,
  updateAdminProfileUI,
  selectTemplatePreset,
  downloadTemplatePreset,
  loadTemplatePresetDemo,
  exportAllRoomsCSV
} from './js/modals.js?v=2.0';

// ── 전역 윈도우 핸들러 바인딩 (인라인 HTML 호출 호환) ──
window.state = state;
window.selectRoom = selectRoom;
window.switchBranch = switchBranch;

window.openMenuDrawer = openMenuDrawer;
window.closeMenuDrawer = closeMenuDrawer;
window.toggleMenuDrawer = toggleMenuDrawer;

window.openRoomDrawer = openRoomDrawer;
window.closeRoomDrawer = closeRoomDrawer;
window.toggleRoomDrawer = toggleRoomDrawer;

window.togglePastAccordion = togglePastAccordion;

window.openVatModal = openVatModal;
window.setVatPeriod = setVatPeriod;
window.handleVatCustomQuery = handleVatCustomQuery;
window.exportVatCSV = exportVatCSV;
window.onToggleVatRoomRow = onToggleVatRoomRow;
window.toggleAllVatRooms = toggleAllVatRooms;
window.saveVatTargetRoomsSetting = saveVatTargetRoomsSetting;

window.openExcelImportModal = openExcelImportModal;
window.handleExcelFileSelect = handleExcelFileSelect;
window.onMappingFieldChange = onMappingFieldChange;
window.executeBatchImport = executeBatchImport;
window.downloadSampleExcelTemplate = downloadSampleExcelTemplate;
window.handleGlobalPasteForOcr = handleGlobalPasteForOcr;
window.selectTemplatePreset = selectTemplatePreset;
window.downloadTemplatePreset = downloadTemplatePreset;
window.loadTemplatePresetDemo = loadTemplatePresetDemo;
window.exportAllRoomsCSV = exportAllRoomsCSV;

window.openContractEditModal = openContractEditModal;
window.handleContractFormSubmit = handleContractFormSubmit;
window.handleLeaseTypeChangeInForm = handleLeaseTypeChangeInForm;

window.openExpenseModal = openExpenseModal;
window.handleExpenseFormSubmit = handleExpenseFormSubmit;
window.openLedgerModal = openLedgerModal;
window.exportCurrentRoomCSV = exportCurrentRoomCSV;

window.openTenantHistoryModal = openTenantHistoryModal;
window.openNewBranchModal = openNewBranchModal;
window.handleNewBranchSubmit = handleNewBranchSubmit;

// 보안 로그인 및 14일 슬라이딩 세션 관련
window.openLoginSecurityModal = openLoginSecurityModal;
window.closeLoginSecurityModal = closeLoginSecurityModal;
window.fillQuickLogin = fillQuickLogin;
window.handleSecurityLoginSubmit = handleSecurityLoginSubmit;
window.handleLogout = handleLogout;
window.handleOneTouchLogout = handleOneTouchLogout;

window.openModal = openModal;
window.closeModal = closeModal;

// ── 모바일 화면 복귀 시 14일 세션 자동 연장 ──
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (state.currentUser) {
      const isValid = touchAuthSession();
      if (!isValid) {
        updateAdminProfileUI();
        openLoginSecurityModal(false);
      } else {
        updateAdminProfileUI();
      }
    }
  }
});

// ── 앱 부트스트랩 ──
window.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 MQnet 부동산 임차관리 모바일 최적화 v3.0 초기화 중...");
  await loadInitialData();
  renderAll();
  updateAdminProfileUI();

  // 보안 인증 체크: 로그인 상태가 아니면 모달 강제 팝업
  if (!state.currentUser) {
    openLoginSecurityModal(false);
  }
});
