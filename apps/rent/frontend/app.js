/**
 * apps/rent/frontend/app.js
 * MQnet Canonical SaaS 번들리스 프론트엔드 메인 진입점.
 * 모바일 최적화 및 좌/우 슬라이드 드로어, 다중 부동산 선택, 전출자 1년 보존 지원.
 */

import { state, loadInitialData, touchAuthSession } from './js/state.js?v=2.0';
import {
  selectRoom,
  navigatePrevRoom,
  navigateNextRoom,
  switchBranch,
  openMenuDrawer,
  closeMenuDrawer,
  toggleMenuDrawer,
  openRoomDrawer,
  closeRoomDrawer,
  toggleRoomDrawer,
  togglePastAccordion,
  switchRoomSlideView,
  toggleRoomSlideView,
  initRoomSwipe,
  handleFillTenantPayments,
  handleChangePaymentDate,
  handleChangePaymentAmount,
  renderBuildingSummary,
  renderAll,
  handleDeleteSelectedBranch,
  handleDeleteBranch,
  executeBranchDeleteConfirmed,
  openEditSelectedBranchModal,
  openEditBranchModal,
  handleEditBranchSubmit,
  handleProcessPayment,
  handleCancelPayment,
  handleSetPastVacancy,
  handleSetPastUnpaid
} from './js/ui.js?v=2.0';
import {
  openModal,
  closeModal,
  showTopToast,
  openMoveInOutQuick,
  openContractEditModal,
  switchModalRoom,
  handleQuickMoveOut,
  handleQuickMoveIn,
  handleContractFormSubmit,
  handleLeaseTypeChangeInForm,
  openExpiryNoticeModal,
  closeExpiryNoticeModal,
  setExpiryNoticeFilter,
  toggleAllExpiryCheckboxes,
  updateExpirySelectedCount,
  startSequentialSmsSend,
  startSingleSmsSend,
  handleSequentialSmsSendAction,
  handleSequentialSmsCopy,
  handleSequentialNext,
  handleSequentialSkip,
  handleSequentialPrev,
  closeSequentialSmsModal,
  checkDaily0700ExpiryNotice,
  updateExpiryNoticeBadge,
  openExpenseModal,
  renderModalExpenseTable,
  handleModalAmountInput,
  handleModalReceiptImageUpload,
  previewCurrentReceiptImage,
  removeCurrentReceiptImage,
  viewReceiptImage,
  handleAddNewExpenseRow,
  closeExpenseModalWithSave,
  deleteExpenseRow,
  exportExpenseLedgerExcel,
  exportCurrentRoomCSV,
  openVatModal,
  setVatPeriod,
  handleVatCustomQuery,
  exportVatCSV,
  exportVatExcel,
  onToggleVatRoomRow,
  toggleAllVatRooms,
  saveVatTargetRoomsSetting,
  openTenantHistoryModal,
  restoreTenantFromHistory,
  deleteTenantHistory,
  saveTestSnapshot,
  restoreTestSnapshot,
  openNewBranchModal,
  handleNewBranchSubmit,
  openExcelImportModal,
  handleExcelFileSelect,
  triggerFileInputClick,
  handleClipboardPasteClick,
  handleExcelDragOver,
  handleExcelDragLeave,
  handleExcelDrop,
  onMappingFieldChange,
  executeBatchImport,
  downloadSampleExcelTemplate,
  handleGlobalPasteForOcr,
  openLoginSecurityModal,
  closeLoginSecurityModal,
  openAdminModal,
  openRegisterModal,
  handleRegisterSubmit,
  fillQuickLogin,
  handleSecurityLoginSubmit,
  handleLogout,
  handleOneTouchLogout,
  updateAdminProfileUI,
  selectTemplatePreset,
  downloadTemplatePreset,
  loadTemplatePresetDemo,
  exportAllRoomsCSV,
  exportFullSystemBackupJSON,
  triggerFullSystemRestoreFile,
  handleFullSystemRestoreFile,
  openSmsDepositModal,
  closeSmsDepositModal,
  fillSampleSmsText,
  pasteFromClipboardToSmsInput,
  handleLiveSmsParse,
  onSmsDetectedRoomChange,
  handleSmsDepositProcess,
  handleCopySmsReceipt,
  handleSendSmsReceipt,
  handlePhoneMessageClick,
  calculateDepositTargetPeriods,
  updateSmsAlert,
  openCurrentMonthPaymentEditModal,
  openEditPaymentModal,
  selectEditPayStatus,
  handleEditPayStatusChange,
  handleEditPayTotalInput,
  handleEditPayDetailInput,
  restoreEditPayContractDefault,
  setEditPayTotalZero,
  setEditPayDatePreset,
  setEditPayNoteTag,
  handleSaveEditPayment,
  openBatchPaymentModal,
  closeBatchPaymentModal,
  switchBatchModalTab,
  handleBatchImageFileSelect,
  resetBatchOcrPreview,
  parseBatchDirectPasteInput,
  handleExecuteEasyBatchPayment
} from './js/modals.js?v=2.0';
import {
  startVoiceRecognition,
  stopVoiceRecognition,
  openVoiceModal,
  closeVoiceModal,
  confirmVoicePayment,
  cancelVoicePayment,
  requestMicrophonePermissionAndStart,
  speakText
} from './js/voice.js?v=1.0';

// ── 전역 윈도우 핸들러 바인딩 (인라인 HTML 호출 호환) ──
window.startVoiceRecognition = startVoiceRecognition;
window.stopVoiceRecognition = stopVoiceRecognition;
window.openVoiceModal = openVoiceModal;
window.closeVoiceModal = closeVoiceModal;
window.confirmVoicePayment = confirmVoicePayment;
window.cancelVoicePayment = cancelVoicePayment;
window.requestMicrophonePermissionAndStart = requestMicrophonePermissionAndStart;
window.speakText = speakText;
window.calculateDepositTargetPeriods = calculateDepositTargetPeriods;
window.updateSmsAlert = updateSmsAlert;
window.openSmsDepositModal = openSmsDepositModal;
window.closeSmsDepositModal = closeSmsDepositModal;
window.fillSampleSmsText = fillSampleSmsText;
window.pasteFromClipboardToSmsInput = pasteFromClipboardToSmsInput;
window.handleLiveSmsParse = handleLiveSmsParse;
window.onSmsDetectedRoomChange = onSmsDetectedRoomChange;
window.handleSmsDepositProcess = handleSmsDepositProcess;
window.handleCopySmsReceipt = handleCopySmsReceipt;
window.handleSendSmsReceipt = handleSendSmsReceipt;
window.handlePhoneMessageClick = handlePhoneMessageClick;
window.state = state;
window.selectRoom = selectRoom;
window.navigatePrevRoom = navigatePrevRoom;
window.navigateNextRoom = navigateNextRoom;
window.switchBranch = switchBranch;

window.openMenuDrawer = openMenuDrawer;
window.closeMenuDrawer = closeMenuDrawer;
window.toggleMenuDrawer = toggleMenuDrawer;
window.handleDeleteSelectedBranch = handleDeleteSelectedBranch;
window.handleDeleteBranch = handleDeleteBranch;
window.executeBranchDeleteConfirmed = executeBranchDeleteConfirmed;
window.openEditSelectedBranchModal = openEditSelectedBranchModal;
window.openEditBranchModal = openEditBranchModal;
window.handleEditBranchSubmit = handleEditBranchSubmit;

window.openRoomDrawer = openRoomDrawer;
window.closeRoomDrawer = closeRoomDrawer;
window.toggleRoomDrawer = toggleRoomDrawer;

window.renderAll = renderAll;
window.renderBuildingSummary = renderBuildingSummary;
window.togglePastAccordion = togglePastAccordion;
window.switchRoomSlideView = switchRoomSlideView;
window.toggleRoomSlideView = toggleRoomSlideView;
window.handleFillTenantPayments = handleFillTenantPayments;
window.handleChangePaymentDate = handleChangePaymentDate;
window.handleChangePaymentAmount = handleChangePaymentAmount;
window.handleProcessPayment = handleProcessPayment;
window.handleCancelPayment = handleCancelPayment;
window.handleSetPastVacancy = handleSetPastVacancy;
window.handleSetPastUnpaid = handleSetPastUnpaid;

window.openVatModal = openVatModal;
window.setVatPeriod = setVatPeriod;
window.handleVatCustomQuery = handleVatCustomQuery;
window.exportVatCSV = exportVatCSV;
window.exportVatExcel = exportVatExcel;
window.onToggleVatRoomRow = onToggleVatRoomRow;
window.toggleAllVatRooms = toggleAllVatRooms;
window.saveVatTargetRoomsSetting = saveVatTargetRoomsSetting;

window.openExcelImportModal = openExcelImportModal;
window.handleExcelFileSelect = handleExcelFileSelect;
window.triggerFileInputClick = triggerFileInputClick;
window.handleClipboardPasteClick = handleClipboardPasteClick;
window.handleExcelDragOver = handleExcelDragOver;
window.handleExcelDragLeave = handleExcelDragLeave;
window.handleExcelDrop = handleExcelDrop;
window.onMappingFieldChange = onMappingFieldChange;
window.executeBatchImport = executeBatchImport;
window.downloadSampleExcelTemplate = downloadSampleExcelTemplate;
window.handleGlobalPasteForOcr = handleGlobalPasteForOcr;
window.selectTemplatePreset = selectTemplatePreset;
window.downloadTemplatePreset = downloadTemplatePreset;
window.loadTemplatePresetDemo = loadTemplatePresetDemo;
window.exportAllRoomsCSV = exportAllRoomsCSV;
window.exportFullSystemBackupJSON = exportFullSystemBackupJSON;
window.triggerFullSystemRestoreFile = triggerFullSystemRestoreFile;
window.handleFullSystemRestoreFile = handleFullSystemRestoreFile;

window.openMoveInOutQuick = openMoveInOutQuick;
window.openContractEditModal = openContractEditModal;
window.showTopToast = showTopToast;
window.switchModalRoom = switchModalRoom;
window.handleQuickMoveOut = handleQuickMoveOut;
window.handleQuickMoveIn = handleQuickMoveIn;
window.handleContractFormSubmit = handleContractFormSubmit;
window.handleLeaseTypeChangeInForm = handleLeaseTypeChangeInForm;

window.openExpenseModal = openExpenseModal;
window.renderModalExpenseTable = renderModalExpenseTable;
window.handleModalAmountInput = handleModalAmountInput;
window.handleModalReceiptImageUpload = handleModalReceiptImageUpload;
window.previewCurrentReceiptImage = previewCurrentReceiptImage;
window.removeCurrentReceiptImage = removeCurrentReceiptImage;
window.viewReceiptImage = viewReceiptImage;
window.handleAddNewExpenseRow = handleAddNewExpenseRow;
window.closeExpenseModalWithSave = closeExpenseModalWithSave;
window.deleteExpenseRow = deleteExpenseRow;
window.exportExpenseLedgerExcel = exportExpenseLedgerExcel;
window.exportCurrentRoomCSV = exportCurrentRoomCSV;

window.openTenantHistoryModal = openTenantHistoryModal;
window.restoreTenantFromHistory = restoreTenantFromHistory;
window.deleteTenantHistory = deleteTenantHistory;
window.saveTestSnapshot = saveTestSnapshot;
window.restoreTestSnapshot = restoreTestSnapshot;
window.openNewBranchModal = openNewBranchModal;
window.handleNewBranchSubmit = handleNewBranchSubmit;

// 수납 금액 및 납부일자 정밀 수정 모달 관련
window.openCurrentMonthPaymentEditModal = openCurrentMonthPaymentEditModal;
window.openEditPaymentModal = openEditPaymentModal;
window.selectEditPayStatus = selectEditPayStatus;
window.handleEditPayStatusChange = handleEditPayStatusChange;
window.handleEditPayTotalInput = handleEditPayTotalInput;
window.handleEditPayDetailInput = handleEditPayDetailInput;
window.restoreEditPayContractDefault = restoreEditPayContractDefault;
window.setEditPayTotalZero = setEditPayTotalZero;
window.setEditPayDatePreset = setEditPayDatePreset;
window.setEditPayNoteTag = setEditPayNoteTag;
window.handleSaveEditPayment = handleSaveEditPayment;

// 초간편 스마트 일괄 수납 관련 (2-Way Easy Batch)
window.openBatchPaymentModal = openBatchPaymentModal;
window.closeBatchPaymentModal = closeBatchPaymentModal;
window.switchBatchModalTab = switchBatchModalTab;
window.handleBatchImageFileSelect = handleBatchImageFileSelect;
window.resetBatchOcrPreview = resetBatchOcrPreview;
window.parseBatchDirectPasteInput = parseBatchDirectPasteInput;
window.handleExecuteEasyBatchPayment = handleExecuteEasyBatchPayment;

// 만기 1·2개월 전 전출 확인 및 문자 순차 발송 관련
window.openExpiryNoticeModal = openExpiryNoticeModal;
window.closeExpiryNoticeModal = closeExpiryNoticeModal;
window.setExpiryNoticeFilter = setExpiryNoticeFilter;
window.toggleAllExpiryCheckboxes = toggleAllExpiryCheckboxes;
window.updateExpirySelectedCount = updateExpirySelectedCount;
window.startSequentialSmsSend = startSequentialSmsSend;
window.startSingleSmsSend = startSingleSmsSend;
window.handleSequentialSmsSendAction = handleSequentialSmsSendAction;
window.handleSequentialSmsCopy = handleSequentialSmsCopy;
window.handleSequentialNext = handleSequentialNext;
window.handleSequentialSkip = handleSequentialSkip;
window.handleSequentialPrev = handleSequentialPrev;
window.closeSequentialSmsModal = closeSequentialSmsModal;
window.checkDaily0700ExpiryNotice = checkDaily0700ExpiryNotice;
window.updateExpiryNoticeBadge = updateExpiryNoticeBadge;

// 보안 로그인 및 14일 슬라이딩 세션 관련
window.openLoginSecurityModal = openLoginSecurityModal;
window.closeLoginSecurityModal = closeLoginSecurityModal;
window.openAdminModal = openAdminModal;
window.openRegisterModal = openRegisterModal;
window.handleRegisterSubmit = handleRegisterSubmit;
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
  initRoomSwipe();
  updateAdminProfileUI();

  // 만기 1·2개월 전 도래 호실 확인 및 배지 갱신 (매일 07:00 자동 감지)
  checkDaily0700ExpiryNotice();

  // 보안 인증 체크: 로그인 상태가 아니면 모달 강제 팝업
  if (!state.currentUser) {
    openLoginSecurityModal(false);
  }
});
