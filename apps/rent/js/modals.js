/**
 * apps/rent/frontend/js/modals.js
 * 원룸 임차료 관리 시스템 모달 팝업 및 계약/지출 폼 제어 모듈.
 */

import { state, formattedToday, saveLocalFallback, setAuthUser, clearAuthUser, getAuthSessionInfo, touchAuthSession, fillTenantPaymentsState, evaluatePaymentRule, parseDateComponents, ROOM_NUMBERS, currentYear, currentMonth, getExpiringRoomsList } from './state.js?v=2.0';
import { apiUpdateContract, apiCreateExpense, apiDeleteExpense, apiRequestUpgrade, apiGetVatReport, apiGetVatSettings, apiSaveVatSettings, apiCreateBranch, apiGetTenantHistories, apiDeleteTenantHistory, apiBatchImportRooms, apiBatchImportPaymentMatrix, apiOcrImportImage, apiAdminLogin, apiRegisterUser, apiFillTenantPayments, apiProcessPayment, apiGetExpiringRooms, apiRestoreBackup } from './api.js?v=2.0';
import { renderAll, switchBranch } from './ui.js?v=2.0';

export function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('hidden');
    m.classList.add('flex');
  }
}

export function closeModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('flex');
    m.classList.add('hidden');
  }
}

export function showTopToast(msg, type = 'info') {
  const existing = document.getElementById('globalAppTopToast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'globalAppTopToast';
  const borderCol = type === 'success' ? 'border-emerald-500 bg-emerald-950/90 text-emerald-200' :
                    type === 'error' ? 'border-rose-500 bg-rose-950/90 text-rose-200' :
                    type === 'warning' ? 'border-amber-500 bg-amber-950/90 text-amber-200' :
                    'border-cyan-500 bg-slate-900/95 text-slate-100';

  toast.className = `fixed top-4 left-1/2 transform -translate-x-1/2 z-[99999] max-w-md w-[90%] border ${borderCol} p-3.5 rounded-2xl shadow-2xl text-xs font-semibold flex items-center justify-between gap-2 backdrop-blur-md transition-all duration-200`;
  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <span>${msg}</span>
    </div>
    <button type="button" onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white text-base leading-none px-1 cursor-pointer">&times;</button>
  `;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 5000);
}

// ── 계약 수정 및 전입/전출 통합 모달 ──
export function openMoveInOutQuick(targetRoomNum) {
  openContractEditModal(targetRoomNum);
}

export function openContractEditModal(targetRoomNum) {
  const rNum = targetRoomNum || state.selectedRoom || 101;
  state.selectedRoom = rNum;

  populateModalRoomSelector(rNum);
  loadRoomIntoContractModal(rNum);
  openModal('contractModal');
}

export function switchModalRoom(newRoomNum) {
  newRoomNum = Number(newRoomNum);
  if (!newRoomNum || !state.rooms[newRoomNum]) return;
  state.selectedRoom = newRoomNum;
  loadRoomIntoContractModal(newRoomNum);
}

function populateModalRoomSelector(currentRNum) {
  const selector = document.getElementById('modalRoomSelector');
  if (!selector) return;
  selector.innerHTML = '';
  ROOM_NUMBERS.forEach(rn => {
    const rm = state.rooms[rn];
    const opt = document.createElement('option');
    opt.value = rn;
    const isOccupied = !!(rm && rm.name && rm.name.trim());
    opt.textContent = isOccupied ? `${rn}호 (${rm.name})` : `${rn}호 (공실)`;
    if (rn === currentRNum) opt.selected = true;
    selector.appendChild(opt);
  });
}

function loadRoomIntoContractModal(rNum) {
  const room = state.rooms[rNum];
  if (!room) return;

  const selector = document.getElementById('modalRoomSelector');
  if (selector && Number(selector.value) !== rNum) selector.value = rNum;

  const titleEl = document.getElementById('modalRoomTitle');
  if (titleEl) titleEl.textContent = `${rNum}호`;

  document.getElementById('formLeaseType').value = room.lease_type || '월세';
  document.getElementById('formPayTiming').value = room.pay_timing || '후불';
  document.getElementById('formName').value = room.name || '';
  document.getElementById('formIdNumber').value = room.id_number || '';
  document.getElementById('formPhone').value = room.phone || '';
  document.getElementById('formDeposit').value = room.deposit || 0;
  document.getElementById('formRent').value = room.rent || 0;
  document.getElementById('formMaintenance').value = room.maintenance || 0;
  document.getElementById('formCleanFee').value = room.clean_fee || 0;
  document.getElementById('formMoveIn').value = room.move_in || '';
  document.getElementById('formExpiry').value = room.expiry || '';
  document.getElementById('formMoveOut').value = room.move_out || '';

  const alertEl = document.getElementById('contractFormAlert');
  if (alertEl) {
    alertEl.className = 'hidden text-xs py-2 px-3 rounded-xl font-medium border text-center transition-all';
    alertEl.textContent = '';
  }

  // 상태 배지 및 정보 갱신
  const statusBadge = document.getElementById('modalRoomStatusBadge');
  const periodInfo = document.getElementById('modalRoomPeriodInfo');
  const btnMoveOut = document.getElementById('btnQuickMoveOut');
  const btnMoveIn = document.getElementById('btnQuickMoveIn');

  const isOccupied = !!(room.name && room.name.trim());
  if (statusBadge) {
    if (isOccupied) {
      if (room.auto_renewed) {
        statusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80';
        statusBadge.innerHTML = `🟢 입주 중 (${room.name}) <span class="text-[9px] bg-amber-500/30 text-amber-200 px-1 py-0.2 rounded font-normal ml-1">1년 묵시적 자동연장됨</span>`;
      } else {
        statusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80';
        statusBadge.innerHTML = `🟢 입주 중 (${room.name})`;
      }
    } else {
      statusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800/80 text-slate-400 border border-slate-700/80';
      statusBadge.innerHTML = `⚪ 현재 공실`;
    }
  }

  if (periodInfo) {
    if (isOccupied && (room.move_in || room.expiry)) {
      periodInfo.textContent = `${room.move_in || '미정'} ~ ${room.expiry || '미정'}`;
    } else {
      periodInfo.textContent = '계약 기간 없음';
    }
  }

  if (btnMoveOut) {
    btnMoveOut.disabled = !isOccupied;
    if (!isOccupied) {
      btnMoveOut.classList.add('opacity-40', 'cursor-not-allowed');
    } else {
      btnMoveOut.classList.remove('opacity-40', 'cursor-not-allowed');
    }
  }

  handleLeaseTypeChangeInForm();
}

export function handleLeaseTypeChangeInForm() {
  const leaseType = document.getElementById('formLeaseType').value;
  const rentInput = document.getElementById('formRent');
  if (leaseType === '전세') {
    rentInput.value = 0;
    rentInput.disabled = true;
    rentInput.classList.add('opacity-50');
  } else {
    rentInput.disabled = false;
    rentInput.classList.remove('opacity-50');
  }
}

// 📦 원터치 전출(퇴실) 처리
export async function handleQuickMoveOut() {
  const rNum = state.selectedRoom;
  const room = state.rooms[rNum];
  if (!room || !room.name || !room.name.trim()) {
    alert("현재 호실은 이미 공실 상태입니다.");
    return;
  }

  const currentTenantName = room.name;
  const outDatePrompt = prompt(
    `[${rNum}호] ${currentTenantName} 임차인을 퇴실(전출) 처리하시겠습니까?\n\n퇴실일자를 확인하세요 (YYYY-MM-DD):`,
    formattedToday
  );
  if (outDatePrompt === null) return; // 취소
  const outDate = outDatePrompt.trim() || formattedToday;

  const payload = {
    lease_type: room.lease_type || '월세',
    pay_timing: room.pay_timing || '후불',
    name: '', // 공실화
    id_number: '',
    phone: '',
    deposit: 0,
    rent: room.rent || 0,
    maintenance: room.maintenance || 0,
    clean_fee: room.clean_fee || 0,
    move_in: '',
    expiry: '',
    move_out: outDate
  };

  try {
    if (state.isOnline) {
      const res = await apiUpdateContract(rNum, payload, state.currentBranch);
      state.rooms[rNum] = res;
      // 전출자 이력 갱신
      try {
        const histRes = await apiGetTenantHistories(state.currentBranch);
        if (histRes && histRes.histories) {
          state.tenantHistories = histRes.histories;
        }
      } catch (eH) {
        console.warn("전출자 이력 갱신 오류:", eH);
      }
    } else {
      Object.assign(room, payload);
    }

    saveLocalFallback();
    populateModalRoomSelector(rNum);
    loadRoomIntoContractModal(rNum);
    renderAll();

    alert(`✅ [${rNum}호] ${currentTenantName}님의 전출(퇴실) 처리가 완료되었습니다.\n\n📦 1년 법정 보존 이력에 안전하게 아카이빙되었으며, 해당 호실은 공실로 전환되었습니다.`);
  } catch (err) {
    alert("전출 처리 실패: " + err.message);
  }
}

// 🚪 신규 전입(입주) 세팅
export function handleQuickMoveIn() {
  const rNum = state.selectedRoom;
  const room = state.rooms[rNum];

  // 기존 세입자가 이미 있는 경우 확인
  if (room && room.name && room.name.trim()) {
    const ok = confirm(`현재 [${rNum}호]에 기존 입주자(${room.name})가 등록되어 있습니다.\n신규 전입 세입자 정보로 덮어쓰시겠습니까?\n\n(기존 입주자의 퇴실 이력을 보존하려면 먼저 [전출(퇴실) 원터치]를 진행하세요)`);
    if (!ok) return;
  }

  // 폼 초기화 및 오늘 날짜 기준 1년 계약 자동 계산
  document.getElementById('formName').value = '';
  document.getElementById('formIdNumber').value = '';
  document.getElementById('formPhone').value = '';
  document.getElementById('formMoveOut').value = '';

  const todayStr = formattedToday;
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const nextYear = ty + 1;
  const nextMonthStr = String(tm).padStart(2, '0');
  const nextDayStr = String(td).padStart(2, '0');
  const defaultExpiryStr = `${nextYear}-${nextMonthStr}-${nextDayStr}`;

  document.getElementById('formMoveIn').value = todayStr;
  document.getElementById('formExpiry').value = defaultExpiryStr;

  // 기본 보증금/월세가 0이면 표준값 세팅
  if (!Number(document.getElementById('formDeposit').value)) {
    document.getElementById('formDeposit').value = 5000000;
  }
  if (!Number(document.getElementById('formRent').value)) {
    document.getElementById('formRent').value = 450000;
  }
  if (!Number(document.getElementById('formMaintenance').value)) {
    document.getElementById('formMaintenance').value = 50000;
  }

  // 성명 입력칸에 포커스
  const nameInput = document.getElementById('formName');
  if (nameInput) {
    nameInput.focus();
    nameInput.placeholder = '신규 입주자 성명 입력';
  }

  alert(`🚪 [${rNum}호] 신규 전입 모드로 세팅되었습니다.\n\n• 전입일: ${todayStr} (오늘)\n• 만기일: ${defaultExpiryStr} (1년 자동 계산)\n\n입주자 성명, 연락처, 보증금/월세를 확인하신 후 하단의 [저장 완료]를 눌러주세요.`);
}

export async function handleContractFormSubmit(e) {
  e.preventDefault();
  const rNum = state.selectedRoom;
  const room = state.rooms[rNum];
  if (!room) return;

  const btnSubmit = document.getElementById('btnContractSubmit') || (e.target ? e.target.querySelector('button[type="submit"]') : null);
  const alertEl = document.getElementById('contractFormAlert');

  const setAlert = (msg, type = 'error') => {
    if (alertEl) {
      alertEl.classList.remove('hidden', 'bg-rose-950/60', 'border-rose-700/60', 'text-rose-200', 'bg-emerald-950/60', 'border-emerald-700/60', 'text-emerald-200', 'bg-amber-950/60', 'border-amber-700/60', 'text-amber-200');
      if (type === 'error') {
        alertEl.classList.add('bg-rose-950/60', 'border-rose-700/60', 'text-rose-200');
        alertEl.innerHTML = `❌ ${msg}`;
      } else if (type === 'success') {
        alertEl.classList.add('bg-emerald-950/60', 'border-emerald-700/60', 'text-emerald-200');
        alertEl.innerHTML = `✅ ${msg}`;
      } else {
        alertEl.classList.add('bg-amber-950/60', 'border-amber-700/60', 'text-amber-200');
        alertEl.innerHTML = `⚠️ ${msg}`;
      }
      alertEl.classList.remove('hidden');
    }
  };

  const parseSafeNum = (val) => {
    if (!val) return 0;
    const cleaned = String(val).replace(/,/g, '').trim();
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const leaseType = document.getElementById('formLeaseType').value;
  const payload = {
    lease_type: leaseType,
    pay_timing: document.getElementById('formPayTiming').value,
    name: document.getElementById('formName').value.trim(),
    id_number: document.getElementById('formIdNumber').value.trim(),
    phone: document.getElementById('formPhone').value.trim(),
    deposit: parseSafeNum(document.getElementById('formDeposit').value),
    rent: leaseType === '전세' ? 0 : parseSafeNum(document.getElementById('formRent').value),
    maintenance: parseSafeNum(document.getElementById('formMaintenance').value),
    clean_fee: parseSafeNum(document.getElementById('formCleanFee').value),
    move_in: document.getElementById('formMoveIn').value,
    expiry: document.getElementById('formExpiry').value,
    move_out: document.getElementById('formMoveOut').value
  };

  // 버튼 비활성화 및 처리 중 UI 전환 (이중 클릭 방지)
  let origBtnText = '저장 완료';
  if (btnSubmit) {
    origBtnText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span> 저장 처리 중...`;
  }
  if (alertEl) alertEl.classList.add('hidden');

  try {
    if (state.isOnline) {
      const res = await apiUpdateContract(rNum, payload, state.currentBranch);
      state.rooms[rNum] = res;
    } else {
      // 오프라인 로컬 반영
      Object.assign(room, payload);
    }

    // 계약 정보 변경 시 과거 납부 내역 전체를 새 계약 정보 및 새 세입자명으로 즉시 동기화
    fillTenantPaymentsState(rNum);
    saveLocalFallback();
    populateModalRoomSelector(rNum);
    loadRoomIntoContractModal(rNum);
    closeModal('contractModal');
    renderAll();

    // 상단 플로팅 토스트로 산뜻하게 완료 안내 (브라우저 alert 퇴출)
    showTopToast(`✅ [${rNum}호] 계약 정보가 정상 저장되었습니다. (입주자: ${payload.name || '공실'})`, 'success');
  } catch (err) {
    console.error("계약 정보 저장 실패:", err);
    let userMsg = err.message || "서버 통신 오류가 발생했습니다.";
    if (userMsg.includes("502")) {
      userMsg = "서버 게이트웨이가 일시 재시작/통신 대기 중입니다. 잠시 후 다시 [저장 완료]를 눌러주세요.";
    }
    setAlert(`계약 저장 실패: ${userMsg}`, 'error');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = origBtnText;
    }
  }
}

// ── 지출 모달 & 엑셀 장부 제어 ──
let currentReceiptPhotoBase64 = '';

export function openExpenseModal() {
  currentReceiptPhotoBase64 = '';
  const dateInput = document.getElementById('newExpDate');
  const itemInput = document.getElementById('newExpItem');
  const amountInput = document.getElementById('newExpAmount');
  const receiptTypeInput = document.getElementById('newExpReceiptType');
  const receiptNoteInput = document.getElementById('newExpReceiptNote');
  const receiptFileInput = document.getElementById('newExpReceiptFileInput');

  if (dateInput) dateInput.value = formattedToday;
  if (itemInput) itemInput.value = '';
  if (amountInput) amountInput.value = '';
  if (receiptTypeInput) receiptTypeInput.value = '카드';
  if (receiptNoteInput) receiptNoteInput.value = '';
  if (receiptFileInput) receiptFileInput.value = '';
  removeCurrentReceiptImage();

  renderModalExpenseTable();
  openModal('expenseModal');
}

export function renderModalExpenseTable() {
  const tbody = document.getElementById('modalExpenseTableBody');
  const tfoot = document.getElementById('modalExpenseTableFoot');
  const branchBadge = document.getElementById('modalExpenseBranchBadge');
  const totalSumBadge = document.getElementById('modalExpenseTotalSumBadge');
  if (!tbody) return;
  tbody.innerHTML = '';

  const branchObj = state.branches.find(b => b.branch_id === state.currentBranch);
  const branchName = branchObj ? branchObj.name : '시크빌';
  if (branchBadge) branchBadge.textContent = branchName;

  const expenses = (state.expenses || []).filter(e => !e.branch_id || e.branch_id === state.currentBranch);

  // 시간순 정렬로 누적 합계 계산
  const sorted = [...expenses].sort((a, b) => {
    const diff = (a.date || '').localeCompare(b.date || '');
    if (diff !== 0) return diff;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  let running = 0;
  const withRunning = sorted.map((exp, idx) => {
    running += Number(exp.amount || 0);
    return { ...exp, runningTotal: running, rowIdx: idx + 1 };
  });

  window._modalExpenseBaseSum = running;

  if (withRunning.length === 0) {
    const emptyTr = document.createElement('tr');
    emptyTr.innerHTML = `
      <td colspan="6" class="py-5 text-center text-slate-500 text-xs font-sans">
        등록된 지출 내역이 없습니다. 아래 빈칸에서 일자, 적요, 금액, 영수증을 입력 후 <b>[➕ 추가]</b>를 누르세요.
      </td>
    `;
    tbody.appendChild(emptyTr);
  } else {
    // 최신 항목이 상단에 오도록 역순 표시하되, 행 누적합계는 발생시점 기준 완벽 유지
    const displayList = [...withRunning].reverse();
    displayList.forEach(exp => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-800/60 hover:bg-surface-850/60 transition text-xs';

      const noteText = exp.note ? ` <span class="text-[10px] text-slate-400 font-sans">(${exp.note})</span>` : '';
      const rType = exp.receipt_type || '영수증';
      const isPhoto = exp.receipt_info && (exp.receipt_info.startsWith('data:image/') || exp.receipt_info.startsWith('http'));

      const photoBtn = isPhoto
        ? `<button type="button" onclick="viewReceiptImage('${exp.id}')" class="ml-1 px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/60 text-[10px] text-cyan-300 font-bold hover:bg-cyan-900 cursor-pointer shadow-xs active:scale-95" title="영수증 사진 확대">📷 보기</button>`
        : '';

      tr.innerHTML = `
        <td class="py-2.5 px-3 text-center text-slate-300 font-mono whitespace-nowrap border-r border-slate-800">${exp.date || '-'}</td>
        <td class="py-2.5 px-3 text-left font-sans text-slate-200 border-r border-slate-800">${exp.item || '-'}${noteText}</td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-amber-400 whitespace-nowrap border-r border-slate-800">${Number(exp.amount || 0).toLocaleString()}원</td>
        <td class="py-2.5 px-3 text-center border-r border-slate-800 whitespace-nowrap">
          <span class="inline-flex items-center gap-1">
            <span class="px-1.5 py-0.5 rounded bg-surface-800 border border-slate-700 text-[10px] text-slate-300 font-sans">${rType}</span>
            ${photoBtn}
          </span>
        </td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-cyan-400 whitespace-nowrap border-r border-slate-800">${Number(exp.runningTotal || 0).toLocaleString()}원</td>
        <td class="py-2 px-1 text-center whitespace-nowrap">
          <button type="button" onclick="deleteExpenseRow('${exp.id}')" class="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer" title="삭제">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 테이블 푸터 요약 행
  if (tfoot) {
    tfoot.innerHTML = `
      <tr>
        <td class="py-2.5 px-3 text-center border-r border-slate-700 text-slate-300 font-bold">합계</td>
        <td class="py-2.5 px-3 text-left border-r border-slate-700 text-slate-400 font-sans">총 ${withRunning.length}건 지출 누계</td>
        <td class="py-2.5 px-3 text-right border-r border-slate-700 text-amber-400 font-mono font-bold">${running.toLocaleString()}원</td>
        <td class="py-2.5 px-3 text-center border-r border-slate-700 text-slate-400 text-[10px]">-</td>
        <td class="py-2.5 px-3 text-right border-r border-slate-700 text-cyan-400 font-mono font-bold">${running.toLocaleString()}원</td>
        <td class="py-2.5 px-1 text-center"></td>
      </tr>
    `;
  }

  if (totalSumBadge) {
    totalSumBadge.textContent = `${running.toLocaleString()}원`;
  }

  handleModalAmountInput();
}

export function handleModalAmountInput() {
  const base = window._modalExpenseBaseSum || 0;
  const inputAmt = Number(document.getElementById('newExpAmount')?.value || 0);
  const total = base + inputAmt;

  const display = document.getElementById('newExpRunningTotalDisplay');
  if (display) {
    display.textContent = `${total.toLocaleString()}원`;
  }

  const topBadge = document.getElementById('modalExpenseTotalSumBadge');
  if (topBadge) {
    topBadge.textContent = `${total.toLocaleString()}원`;
  }
}

export function handleModalReceiptImageUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('이미지 파일(JPG, PNG 등)만 첨부할 수 있습니다.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('영수증 사진은 5MB 이하 파일만 첨부 가능합니다.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    currentReceiptPhotoBase64 = evt.target.result;
    const thumbBox = document.getElementById('newExpReceiptThumbBox');
    const thumbImg = document.getElementById('newExpReceiptThumbImg');
    if (thumbBox && thumbImg) {
      thumbImg.src = currentReceiptPhotoBase64;
      thumbBox.classList.remove('hidden');
      thumbBox.classList.add('flex');
    }
  };
  reader.readAsDataURL(file);
}

export function previewCurrentReceiptImage() {
  if (!currentReceiptPhotoBase64) return;
  const modalImg = document.getElementById('receiptViewerImg');
  const modalTitle = document.getElementById('receiptViewerTitle');
  if (modalImg) modalImg.src = currentReceiptPhotoBase64;
  if (modalTitle) modalTitle.textContent = '📷 첨부된 영수증 미리보기';
  openModal('receiptViewerModal');
}

export function removeCurrentReceiptImage() {
  currentReceiptPhotoBase64 = '';
  const fileInput = document.getElementById('newExpReceiptFileInput');
  if (fileInput) fileInput.value = '';
  const thumbBox = document.getElementById('newExpReceiptThumbBox');
  if (thumbBox) {
    thumbBox.classList.remove('flex');
    thumbBox.classList.add('hidden');
  }
}

export function viewReceiptImage(expenseId) {
  const exp = (state.expenses || []).find(e => String(e.id) === String(expenseId));
  if (!exp || !exp.receipt_info) {
    alert('등록된 영수증 이미지가 없습니다.');
    return;
  }
  const modalImg = document.getElementById('receiptViewerImg');
  const modalTitle = document.getElementById('receiptViewerTitle');
  if (modalImg) modalImg.src = exp.receipt_info;
  if (modalTitle) modalTitle.textContent = `📷 ${exp.item} (${exp.date}) 영수증`;
  openModal('receiptViewerModal');
}

export async function handleAddNewExpenseRow() {
  const dateInput = document.getElementById('newExpDate');
  const itemInput = document.getElementById('newExpItem');
  const amountInput = document.getElementById('newExpAmount');
  const receiptTypeInput = document.getElementById('newExpReceiptType');
  const receiptNoteInput = document.getElementById('newExpReceiptNote');

  const dateVal = (dateInput?.value || formattedToday).trim();
  const itemVal = (itemInput?.value || '').trim();
  const amountVal = Number(amountInput?.value || 0);
  const receiptTypeVal = (receiptTypeInput?.value || '카드').trim();
  const receiptNoteVal = (receiptNoteInput?.value || '').trim();

  if (!itemVal) {
    alert('지출 적요(항목명 또는 사용처)를 입력해주세요.');
    itemInput?.focus();
    return false;
  }
  if (!amountVal || amountVal <= 0) {
    alert('지출 금액을 0원보다 크게 입력해주세요.');
    amountInput?.focus();
    return false;
  }

  const payload = {
    date: dateVal,
    item: itemVal,
    amount: amountVal,
    note: receiptNoteVal,
    receipt_type: receiptTypeVal,
    receipt_info: currentReceiptPhotoBase64 || receiptNoteVal
  };

  try {
    let created;
    if (state.isOnline) {
      created = await apiCreateExpense(payload, state.currentBranch);
    } else {
      created = {
        ...payload,
        id: 'exp_' + Date.now(),
        branch_id: state.currentBranch
      };
    }
    state.expenses.unshift(created);
    saveLocalFallback();

    // 입력 필드 초기화 (다음 행 연속 입력 대기)
    if (itemInput) itemInput.value = '';
    if (amountInput) amountInput.value = '';
    if (receiptNoteInput) receiptNoteInput.value = '';
    removeCurrentReceiptImage();

    renderModalExpenseTable();
    renderAll();

    itemInput?.focus();
    return true;
  } catch (err) {
    alert('지출 등록 실패: ' + err.message);
    return false;
  }
}

export async function closeExpenseModalWithSave() {
  const itemInput = document.getElementById('newExpItem');
  const amountInput = document.getElementById('newExpAmount');
  const itemVal = (itemInput?.value || '').trim();
  const amountVal = Number(amountInput?.value || 0);

  // 빈칸에 입력 중인 내용이 있으면 자동 저장 후 닫기
  if (itemVal && amountVal > 0) {
    await handleAddNewExpenseRow();
  }

  closeModal('expenseModal');
  renderAll();
}

export async function deleteExpenseRow(expenseId) {
  if (!confirm('해당 지출 내역을 삭제하시겠습니까?')) return;
  try {
    if (state.isOnline) {
      await apiDeleteExpense(expenseId, state.currentBranch);
    }
    state.expenses = (state.expenses || []).filter(e => String(e.id) !== String(expenseId));
    saveLocalFallback();
    renderModalExpenseTable();
    renderAll();
  } catch (err) {
    alert('지출 내역 삭제 실패: ' + err.message);
  }
}

export function exportExpenseLedgerExcel() {
  const branchObj = state.branches.find(b => b.branch_id === state.currentBranch);
  const branchName = branchObj ? branchObj.name : '시크빌';
  const expenses = (state.expenses || []).filter(e => !e.branch_id || e.branch_id === state.currentBranch);

  if (expenses.length === 0) {
    alert("내보낼 지출 장부 내역이 없습니다.");
    return;
  }

  const sorted = [...expenses].sort((a, b) => {
    const diff = (a.date || '').localeCompare(b.date || '');
    if (diff !== 0) return diff;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  let running = 0;
  let csv = "\uFEFF"; // UTF-8 BOM for Excel
  csv += `건물명,${branchName}\n`;
  csv += `보고서명,지출 장부 내역\n`;
  csv += `출력일자,${formattedToday}\n`;
  csv += `총 지출건수,${sorted.length}건\n\n`;

  csv += "순번,일자,적요 (항목/사용처),금액,영수증구분,영수증정보/메모,누적합계\n";
  sorted.forEach((exp, idx) => {
    running += Number(exp.amount || 0);
    const itemSafe = `"${(exp.item || '').replace(/"/g, '""')}"`;
    const receiptTypeSafe = `"${(exp.receipt_type || '영수증').replace(/"/g, '""')}"`;
    const receiptInfoSafe = `"${(exp.note || (exp.receipt_info && exp.receipt_info.startsWith('data:') ? '사진첨부' : exp.receipt_info) || '').replace(/"/g, '""')}"`;
    csv += `${idx + 1},${exp.date || ''},${itemSafe},${Number(exp.amount || 0)},${receiptTypeSafe},${receiptInfoSafe},${running}\n`;
  });

  csv += `\n합계,,총 ${sorted.length}건,${running},,,${running}\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${branchName.replace(/\s+/g, '_')}_지출장부내역_${formattedToday}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── CSV 엑셀 내보내기 ──
export function exportCurrentRoomCSV() {
  const rNum = state.selectedRoom;
  const r = state.rooms[rNum];
  if (!r) return;

  let csv = "\uFEFF"; // UTF-8 BOM
  csv += `호실,${rNum}호\n`;
  csv += `임차인,${r.name || '공실'}\n`;
  csv += `주민등록번호,${r.id_number || ''}\n`;
  csv += `임차유형,${r.lease_type || '월세'}\n`;
  csv += `납부방식,${r.pay_timing || '후불'}\n`;
  csv += `전화번호,${r.phone || ''}\n`;
  csv += `보증금,${r.deposit || 0}\n`;
  csv += `월세,${r.rent || 0}\n`;
  csv += `관리비,${r.maintenance || 0}\n`;
  csv += `계약기간,${r.move_in || ''} ~ ${r.expiry || ''}\n\n`;

  csv += "월,납부여부,납부일자,임차료,관리비,합계\n";
  for (let m = 1; m <= 12; m++) {
    const p = (r.payments && r.payments[m]) || {};
    const isPaid = p.paid ? "완납" : "미납";
    const date = p.paid_date || "";
    const rent = p.rent_amount !== undefined ? p.rent_amount : r.rent;
    const maint = p.maintenance_amount !== undefined ? p.maintenance_amount : r.maintenance;
    const sum = rent + maint;
    csv += `${m}월,${isPaid},${date},${rent},${maint},${sum}\n`;
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `원룸_${rNum}호_납부내역_${formattedToday}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ── 등업 신청 모달 ──
export function openUpgradeModal() {
  document.getElementById('upgradeName').value = '';
  document.getElementById('upgradePhone').value = '';
  document.getElementById('upgradeReason').value = '';
  openModal('upgradeModal');
}

export async function handleUpgradeSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('upgradeName').value.trim();
  const phone = document.getElementById('upgradePhone').value.trim();
  const reason = document.getElementById('upgradeReason').value.trim();

  try {
    await apiRequestUpgrade({
      user_name: name,
      contact: phone,
      target_branch_id: state.currentBranch,
      reason: reason
    });
    closeModal('upgradeModal');
    alert("✅ 관리자 등업 신청이 완료되었습니다.\n본사 승인 후 권한이 부여됩니다.");
  } catch (err) {
    alert("등업 신청 실패: " + err.message);
  }
}

// ── 5. 부가가치세(VAT) 및 기간별 호실 수납 집계 ──
export let currentVatRawData = null; // 원본 전체 데이터
export let currentVatData = null;    // 필터링 적용된 현재 표시 데이터
export let selectedVatRooms = new Set(); // 선택된 호실 번호 목록 (DB 연동 유지)

export let currentVatParams = {
  year: 2026,
  startMonth: 1,
  endMonth: 6,
  label: '1기 (1~6월)'
};

let vatAutoSaveTimer = null;

export async function openVatModal() {
  openModal('vatModal');
  await initVatRoomsSelection();
  // 기본 1기 (1~6월, 2026년) 자동 조회
  await setVatPeriod(1, 6, '1기 (1~6월)');
}

/**
 * 부가세 산출 대상 호실 초기화 (DB 우선 조회 -> 캐시 -> 기본 전체)
 */
export async function initVatRoomsSelection() {
  const currentBranch = state.currentBranchId || state.currentBranch || 'main';
  try {
    const res = await apiGetVatSettings(currentBranch);
    if (res && Array.isArray(res.vat_target_rooms) && res.vat_target_rooms.length > 0) {
      selectedVatRooms = new Set(res.vat_target_rooms.map(Number));
      return;
    }
  } catch (err) {
    console.warn('[VAT] DB 조회 폴백:', err);
  }

  // localStorage 캐시 fallback
  try {
    const cached = localStorage.getItem(`rent_vat_rooms_${currentBranch}`);
    if (cached) {
      const arr = JSON.parse(cached);
      if (Array.isArray(arr) && arr.length > 0) {
        selectedVatRooms = new Set(arr.map(Number));
        return;
      }
    }
  } catch (_) {}

  // 최초 기본값: 전체 호실
  const allRoomKeys = Object.keys(state.rooms || {}).map(Number).sort((a, b) => a - b);
  selectedVatRooms = new Set(allRoomKeys);
}

/**
 * 현재 선택된 부가세 대상 호실 목록을 DB에 영구 저장
 */
export async function saveVatTargetRoomsSetting(showMessage = true) {
  const currentBranch = state.currentBranchId || state.currentBranch || 'main';
  const targetRooms = Array.from(selectedVatRooms).sort((a, b) => a - b);
  const btn = document.getElementById('btnSaveVatRoomsSetting');
  const badge = document.getElementById('vatSaveStatusBadge');
  const txt = document.getElementById('btnSaveVatRoomsText');

  if (btn) btn.disabled = true;
  if (txt) txt.textContent = '저장 중...';

  try {
    await apiSaveVatSettings(currentBranch, targetRooms);
    if (badge) {
      badge.textContent = `💾 ${targetRooms.length}실 DB 저장됨`;
      badge.classList.remove('hidden');
      setTimeout(() => {
        badge.classList.add('hidden');
      }, 3000);
    }
  } catch (err) {
    console.error('[VAT] 부가세 호실 설정 저장 실패:', err);
    if (badge) {
      badge.textContent = '❌ 저장 실패';
      badge.classList.remove('hidden');
      setTimeout(() => badge.classList.add('hidden'), 3000);
    }
  } finally {
    if (btn) btn.disabled = false;
    if (txt) txt.textContent = '호실설정 저장';
  }
}
window.saveVatTargetRoomsSetting = saveVatTargetRoomsSetting;

/**
 * 체크박스 조작 시 1.2초 뒤 자동 DB 저장 (Debounce)
 */
function triggerVatAutoSave() {
  if (vatAutoSaveTimer) clearTimeout(vatAutoSaveTimer);
  vatAutoSaveTimer = setTimeout(() => {
    saveVatTargetRoomsSetting(false);
  }, 1200);
}

/**
 * 테이블 행 체크박스 개별 토글
 */
export function onToggleVatRoomRow(rNum, isChecked) {
  const num = Number(rNum);
  if (isChecked) {
    selectedVatRooms.add(num);
  } else {
    selectedVatRooms.delete(num);
  }
  applyVatRoomFilter();
  triggerVatAutoSave();
}

/**
 * 테이블 헤더 마스터 체크박스 전체 토글
 */
export function toggleAllVatRooms(isChecked) {
  const allRoomKeys = (currentVatRawData && currentVatRawData.rows && currentVatRawData.rows.length > 0)
    ? currentVatRawData.rows.map(r => Number(r.room_number))
    : Object.keys(state.rooms || {}).map(Number);

  if (isChecked) {
    selectedVatRooms = new Set(allRoomKeys);
  } else {
    selectedVatRooms.clear();
  }
  applyVatRoomFilter();
  triggerVatAutoSave();
}

/**
 * 선택된 호실들로 부가세 데이터 필터링 및 화면 즉각 재계산/렌더링
 */
export function applyVatRoomFilter() {
  if (!currentVatRawData || !currentVatRawData.rows) return;

  const raw = currentVatRawData;
  const filteredRows = raw.rows.filter(r => selectedVatRooms.has(Number(r.room_number)));

  let total_collected = 0;
  let total_supply = 0;
  let total_vat = 0;

  filteredRows.forEach(r => {
    total_collected += Number(r.period_total || 0);
    total_supply += Number(r.supply_value || 0);
    total_vat += Number(r.vat_value || 0);
  });

  currentVatData = {
    ...raw,
    total_collected,
    total_supply,
    total_vat
  };

  renderVatReportUI(currentVatData);
}

export async function setVatPeriod(startMonth, endMonth, label) {
  currentVatParams.startMonth = Number(startMonth);
  currentVatParams.endMonth = Number(endMonth);
  currentVatParams.label = label;
  currentVatParams.year = Number(document.getElementById('vatYearSelect')?.value || 2026);

  // 셀렉트 박스 동기화
  const sSelect = document.getElementById('vatStartMonthSelect');
  const eSelect = document.getElementById('vatEndMonthSelect');
  if (sSelect) sSelect.value = startMonth;
  if (eSelect) eSelect.value = endMonth;

  // 프리셋 버튼 active 상태 스타일 토글
  document.querySelectorAll('.vat-preset-btn').forEach(btn => {
    if (btn.textContent.trim() === label || (label.startsWith(btn.textContent.trim()))) {
      btn.className = 'vat-preset-btn px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/80 font-bold transition';
    } else {
      btn.className = 'vat-preset-btn px-2.5 py-1 rounded-lg bg-surface-800 hover:bg-surface-700 text-slate-300 border border-slate-700 font-medium transition';
    }
  });

  await fetchAndRenderVat(currentVatParams.startMonth, currentVatParams.endMonth, currentVatParams.year, label);
}

export async function handleVatCustomQuery() {
  const year = Number(document.getElementById('vatYearSelect')?.value || 2026);
  const startMonth = Number(document.getElementById('vatStartMonthSelect')?.value || 1);
  const endMonth = Number(document.getElementById('vatEndMonthSelect')?.value || 12);

  if (startMonth > endMonth) {
    alert("시작월은 종료월보다 작거나 같아야 합니다.");
    return;
  }

  // 프리셋 버튼 active 해제
  document.querySelectorAll('.vat-preset-btn').forEach(btn => {
    btn.className = 'vat-preset-btn px-2.5 py-1 rounded-lg bg-surface-800 hover:bg-surface-700 text-slate-300 border border-slate-700 font-medium transition';
  });

  const label = `${startMonth}~${endMonth}월`;
  currentVatParams = { year, startMonth, endMonth, label };
  await fetchAndRenderVat(startMonth, endMonth, year, label);
}

export async function fetchAndRenderVat(startMonth, endMonth, year, label) {
  const labelEl = document.getElementById('vatCurrentPeriodLabel');
  if (labelEl) {
    labelEl.textContent = `${year}년 ${label}`;
  }

  const thead = document.getElementById('vatTableHead');
  const tbody = document.getElementById('vatTableBody');
  const tfoot = document.getElementById('vatTableFoot');

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="15" class="py-8 text-center text-slate-400">데이터를 집계하고 있습니다...</td></tr>`;
  }

  let data = null;
  try {
    if (state.isOnline) {
      data = await apiGetVatReport(startMonth, endMonth, year, state.currentBranch);
    }
  } catch (err) {
    console.warn("온라인 부가세 API 호출 실패, 로컬 데이터로 대체 계산합니다:", err);
  }

  // 오프라인 fallback 또는 API 에러 시 프론트엔드 자체 계산
  if (!data || !data.rows) {
    data = calculateLocalVatReport(startMonth, endMonth, year);
  }

  currentVatRawData = data;
  if (data && Array.isArray(data.saved_vat_target_rooms) && data.saved_vat_target_rooms.length > 0) {
    if (selectedVatRooms.size === 0 || selectedVatRooms.size === Object.keys(state.rooms || {}).length) {
      selectedVatRooms = new Set(data.saved_vat_target_rooms.map(Number));
    }
  }
  applyVatRoomFilter();
}

function calculateLocalVatReport(startMonth, endMonth, year) {
  const months = [];
  for (let m = startMonth; m <= endMonth; m++) months.push(m);

  let total_collected = 0;
  let total_supply = 0;
  let total_vat = 0;
  const rows = [];

  const sortedRoomKeys = Object.keys(state.rooms || {}).sort((a, b) => Number(a) - Number(b));

  for (const rNum of sortedRoomKeys) {
    const r = state.rooms[rNum] || {};
    const monthly_amounts = {};
    let room_period_total = 0;
    const tenant_names_seen = new Set();

    for (const m of months) {
      const isJeonse = (r.lease_type === '전세');
      let amt = 0;
      if (isJeonse) {
        amt = 0;
      } else if (p.paid) {
        amt = (p.rent_amount !== undefined ? p.rent_amount : (r.rent || 0));
        if (p.tenant_name) tenant_names_seen.add(p.tenant_name);
      } else {
        amt = (r.rent || 0);
      }
      monthly_amounts[m] = amt;
      room_period_total += amt;
    }

    const supply_val = Math.round(room_period_total / 1.1);
    const vat_val = room_period_total - supply_val;

    total_collected += room_period_total;
    total_supply += supply_val;
    total_vat += vat_val;

    let display_name = r.name || '공실';
    if (tenant_names_seen.size > 1) {
      const others = Array.from(tenant_names_seen).filter(n => n !== display_name);
      display_name = `${display_name} (전: ${others.join(', ')})`;
    } else if (tenant_names_seen.size === 1) {
      const only = Array.from(tenant_names_seen)[0];
      if (only !== display_name && display_name !== '공실') {
        display_name = `${display_name} (전: ${only})`;
      } else if (only !== display_name && display_name === '공실') {
        display_name = `${only} (전출)`;
      }
    }

    const isAllPaid = months.every(m => r.payments && r.payments[m] && r.payments[m].paid);
    rows.push({
      room_number: Number(rNum),
      tenant_name: display_name,
      lease_type: r.lease_type || '월세',
      deposit: r.deposit || 0,
      monthly_amounts: monthly_amounts,
      period_total: room_period_total,
      supply_value: supply_val,
      vat_value: vat_val,
      status: isAllPaid ? '완납' : (room_period_total === 0 ? '미납' : '부분완납')
    });
  }

  return {
    success: true,
    year: year,
    start_month: startMonth,
    end_month: endMonth,
    months: months,
    total_collected: total_collected,
    total_supply: total_supply,
    total_vat: total_vat,
    rows: rows
  };
}

function renderVatReportUI(data) {
  // 1. Compact Excel Summary Bar (단위 생략)
  const kpiTotal = document.getElementById('vatKpiTotalAmount');
  const kpiSupply = document.getElementById('vatKpiSupplyValue');
  const kpiVat = document.getElementById('vatKpiVatAmount');
  const kpiCount = document.getElementById('vatKpiCountSummary');

  if (kpiTotal) kpiTotal.textContent = Number(data.total_collected || 0).toLocaleString();
  if (kpiSupply) kpiSupply.textContent = Number(data.total_supply || 0).toLocaleString();
  if (kpiVat) kpiVat.textContent = Number(data.total_vat || 0).toLocaleString();

  const totalRoomsCount = (data.rows || []).length;
  if (kpiCount) kpiCount.textContent = `${selectedVatRooms.size}/${totalRoomsCount}`;

  const isAllSelected = selectedVatRooms.size === totalRoomsCount && totalRoomsCount > 0;

  // 2. Table Header
  const thead = document.getElementById('vatTableHead');
  if (thead) {
    let thHtml = `
      <tr>
        <th class="py-2 px-1.5 border border-slate-700 bg-surface-850 text-center w-8 min-w-[32px] whitespace-nowrap">
          <input type="checkbox" id="vatMasterCheck" ${isAllSelected ? 'checked' : ''} onchange="toggleAllVatRooms(this.checked)" class="accent-cyan-500 rounded cursor-pointer w-3.5 h-3.5" title="전체 선택/해제">
        </th>
        <th class="py-2 px-2 border border-slate-700 bg-surface-850 text-cyan-300 font-bold text-center w-12 min-w-[48px] whitespace-nowrap">호실</th>
        <th class="py-2 px-3 border border-slate-700 bg-surface-850 text-slate-200 text-left min-w-[125px] whitespace-nowrap">임차인</th>
        <th class="py-2 px-2 border border-slate-700 bg-surface-850 text-slate-300 text-center min-w-[56px] whitespace-nowrap">유형</th>
        <th class="py-2 px-2.5 border border-slate-700 bg-surface-850 text-slate-300 text-right min-w-[85px] whitespace-nowrap">보증금</th>
    `;
    data.months.forEach(m => {
      thHtml += `<th class="py-2 px-2 border border-slate-700 bg-surface-850 text-cyan-200 text-right min-w-[70px] whitespace-nowrap">${m}월</th>`;
    });
    thHtml += `
        <th class="py-2 px-2.5 border border-slate-700 bg-surface-850 text-amber-300 font-bold text-right min-w-[95px] whitespace-nowrap">합계(VAT)</th>
        <th class="py-2 px-2.5 border border-slate-700 bg-surface-850 text-cyan-300 font-bold text-right min-w-[90px] whitespace-nowrap">공급가액</th>
        <th class="py-2 px-2.5 border border-slate-700 bg-surface-850 text-emerald-300 font-bold text-right min-w-[85px] whitespace-nowrap">부가가치세</th>
        <th class="py-2 px-2 border border-slate-700 bg-surface-850 text-slate-300 text-center min-w-[52px] whitespace-nowrap">상태</th>
      </tr>
    `;
    thead.innerHTML = thHtml;
  }

  // 3. Table Body
  const tbody = document.getElementById('vatTableBody');
  const monthSums = {};
  data.months.forEach(m => { monthSums[m] = 0; });
  let totalDeposit = 0;

  if (tbody) {
    if (!data.rows || data.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${8 + data.months.length}" class="py-6 text-center text-slate-500 whitespace-nowrap">조회된 호실 데이터가 없습니다.</td></tr>`;
    } else {
      let trHtml = '';
      data.rows.forEach(row => {
        const isSelected = selectedVatRooms.has(Number(row.room_number));
        if (isSelected) {
          totalDeposit += Number(row.deposit || 0);
        }

        let statusBadge = '<span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">완납</span>';
        if (row.status === '미납') {
          statusBadge = '<span class="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30 whitespace-nowrap">미납</span>';
        } else if (row.status === '부분완납') {
          statusBadge = '<span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">부분</span>';
        }

        const rowClass = isSelected 
          ? 'hover:bg-surface-800/60 transition' 
          : 'opacity-40 bg-slate-950/60 line-through text-slate-500 transition';

        trHtml += `
          <tr class="${rowClass}">
            <td class="py-1.5 px-1.5 border border-slate-800 text-center bg-surface-900/60 whitespace-nowrap">
              <input type="checkbox" ${isSelected ? 'checked' : ''} 
                onchange="onToggleVatRoomRow(${row.room_number}, this.checked)" 
                class="accent-cyan-500 rounded cursor-pointer w-3.5 h-3.5">
            </td>
            <td class="py-1.5 px-2 border border-slate-800 text-cyan-300 font-bold text-center bg-surface-900/40 font-mono whitespace-nowrap">${row.room_number}</td>
            <td class="py-1.5 px-3 border border-slate-800 font-sans text-slate-200 font-medium whitespace-nowrap">
              <div>${row.tenant_name}</div>
              ${(row.id_number || (state.rooms[row.room_number] && state.rooms[row.room_number].id_number)) ? `<div class="text-[10px] text-slate-400 font-mono">주민: ${row.id_number || state.rooms[row.room_number].id_number}</div>` : ''}
            </td>
            <td class="py-1.5 px-2 border border-slate-800 font-sans text-center text-slate-300 text-xs whitespace-nowrap">${row.lease_type}</td>
            <td class="py-1.5 px-2.5 border border-slate-800 text-right text-slate-300 font-mono whitespace-nowrap">${Number(row.deposit || 0).toLocaleString()}</td>
        `;

        data.months.forEach(m => {
          const amt = (row.monthly_amounts && row.monthly_amounts[m]) || 0;
          if (isSelected) {
            monthSums[m] += amt;
          }
          const amtText = amt > 0 ? Number(amt).toLocaleString() : `<span class="text-slate-600">-</span>`;
          const amtColor = amt > 0 ? `text-slate-100` : ``;
          trHtml += `<td class="py-1.5 px-2 border border-slate-800 text-right font-mono whitespace-nowrap ${amtColor}">${amtText}</td>`;
        });

        trHtml += `
            <td class="py-1.5 px-2.5 border border-slate-800 text-right font-bold text-amber-300 font-mono whitespace-nowrap">${Number(row.period_total || 0).toLocaleString()}</td>
            <td class="py-1.5 px-2.5 border border-slate-800 text-right font-semibold text-cyan-300 font-mono whitespace-nowrap">${Number(row.supply_value || 0).toLocaleString()}</td>
            <td class="py-1.5 px-2.5 border border-slate-800 text-right font-semibold text-emerald-300 font-mono whitespace-nowrap">${Number(row.vat_value || 0).toLocaleString()}</td>
            <td class="py-1.5 px-2 border border-slate-800 text-center font-sans whitespace-nowrap">${statusBadge}</td>
          </tr>
        `;
      });
      tbody.innerHTML = trHtml;
    }
  }

  // 4. Table Footer (Total Sum Row)
  const tfoot = document.getElementById('vatTableFoot');
  if (tfoot) {
    let tfHtml = `
      <tr class="bg-surface-850 font-bold border-t-2 border-cyan-500/80">
        <td class="py-2 px-1.5 border border-slate-700 text-center text-slate-500 font-sans whitespace-nowrap">-</td>
        <td class="py-2 px-2 border border-slate-700 text-center text-cyan-300 font-sans whitespace-nowrap" colspan="3">합계 (${selectedVatRooms.size}실)</td>
        <td class="py-2 px-2.5 border border-slate-700 text-right text-slate-300 font-mono whitespace-nowrap">${totalDeposit.toLocaleString()}</td>
    `;
    data.months.forEach(m => {
      tfHtml += `<td class="py-2 px-2 border border-slate-700 text-right text-cyan-200 font-mono whitespace-nowrap">${monthSums[m].toLocaleString()}</td>`;
    });
    tfHtml += `
        <td class="py-2 px-2.5 border border-slate-700 text-right text-amber-300 text-sm font-black font-mono whitespace-nowrap">${Number(data.total_collected || 0).toLocaleString()}</td>
        <td class="py-2 px-2.5 border border-slate-700 text-right text-cyan-300 text-sm font-black font-mono whitespace-nowrap">${Number(data.total_supply || 0).toLocaleString()}</td>
        <td class="py-2 px-2.5 border border-slate-700 text-right text-emerald-300 text-sm font-black font-mono whitespace-nowrap">${Number(data.total_vat || 0).toLocaleString()}</td>
        <td class="py-2 px-2 border border-slate-700 text-center text-slate-400 font-sans whitespace-nowrap">-</td>
      </tr>
    `;
    tfoot.innerHTML = tfHtml;
  }

  // 5. Sync Master Checkbox indeterminate state
  const master = document.getElementById('vatMasterCheck');
  if (master) {
    master.checked = isAllSelected;
    master.indeterminate = selectedVatRooms.size > 0 && selectedVatRooms.size < totalRoomsCount;
  }
}

// ── 6. 부가가치세 보고서 다운로드 (통합 모듈) ──
function triggerVatReportDownload(formatType = 'excel') {
  if (!currentVatData || !currentVatData.rows || currentVatData.rows.length === 0) {
    alert("내보낼 수납 집계 데이터가 없습니다.");
    return;
  }

  const d = currentVatData;
  let filteredRows = d.rows.filter(r => selectedVatRooms.has(Number(r.room_number)));
  if (filteredRows.length === 0) {
    filteredRows = d.rows;
  }

  const branch = state.currentBranch || 'main';
  const roomParam = filteredRows.map(r => r.room_number).join(',');
  const ext = formatType === 'csv' ? 'csv' : 'xls';
  const fileName = `부동산_부가세_수납현황_${d.year}년_${d.start_month}월_${d.end_month}월.${ext}`;
  const downloadUrl = `/api/rent/vat-report/download?format_type=${formatType}&branch_id=${encodeURIComponent(branch)}&year=${d.year}&start_month=${d.start_month}&end_month=${d.end_month}&room_numbers=${encodeURIComponent(roomParam)}`;

  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a);
  }, 1000);
}

export function exportVatCSV() {
  triggerVatReportDownload('csv');
}

export function exportVatExcel() {
  triggerVatReportDownload('excel');
}

// ── 전출자 1년 보존 이력 조회 모달 ──
export async function openTenantHistoryModal() {
  const container = document.getElementById('tenantHistoryListContainer');
  if (!container) return;
  container.innerHTML = '<div class="py-6 text-center text-slate-400 text-xs">전출자 이력을 조회하고 있습니다...</div>';
  openModal('tenantHistoryModal');

  try {
    if (state.isOnline) {
      const res = await apiGetTenantHistories(state.currentBranch);
      state.tenantHistories = res.histories || [];
    }
  } catch (e) {
    console.warn("전출자 이력 API 조회 실패, 로컬 캐시 사용:", e);
  }

  if (!state.tenantHistories || state.tenantHistories.length === 0) {
    container.innerHTML = '<div class="py-8 text-center text-slate-500 text-xs">최근 1년 이내 전출된 세입자 이력이 없습니다.</div>';
    return;
  }

  let html = '';
  state.tenantHistories.forEach(h => {
    html += `
      <div class="p-3.5 rounded-xl bg-surface-850 border border-slate-800 text-xs space-y-2">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="font-mono font-bold text-cyan-300 text-sm px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800">${h.room_number}호</span>
            <span class="font-bold text-slate-100 text-sm">${h.name}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">전출 세입자</span>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[11px] text-slate-400 font-mono">1년 보존: <strong class="text-emerald-400 font-bold">${h.retention_until || '-'}</strong></span>
            <button type="button" onclick="restoreTenantFromHistory('${h.id}')" class="px-2.5 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/80 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-xs">
              <span>↩️</span>
              <span>호실로 복원 (퇴실 취소)</span>
            </button>
            <button type="button" onclick="deleteTenantHistory('${h.id}', '${h.room_number}', '${h.name}')" class="px-2 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-700/60 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-xs" title="테스트 이력 또는 불필요 이력 영구 삭제">
              <span>🗑️</span>
              <span>삭제</span>
            </button>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] text-slate-300 pt-2 border-t border-slate-800">
          <div><span class="text-slate-500 block">주민번호</span> <span class="font-mono text-cyan-300">${h.id_number || '-'}</span></div>
          <div><span class="text-slate-500 block">연락처</span> ${h.phone || '-'}</div>
          <div><span class="text-slate-500 block">임대조건</span> ${h.lease_type || '월세'} / ${Number(h.rent || 0).toLocaleString()}원</div>
          <div><span class="text-slate-500 block">보증금</span> ${Number(h.deposit || 0).toLocaleString()}원</div>
          <div><span class="text-slate-500 block">거주기간</span> ${h.move_in || '-'} ~ ${h.move_out || '-'}</div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// ── 전출 세입자 호실로 원터치 복원 (퇴실 취소) ──
export async function restoreTenantFromHistory(histId) {
  const h = (state.tenantHistories || []).find(item => String(item.id) === String(histId));
  if (!h) {
    alert("복원할 세입자 이력 정보를 찾을 수 없습니다.");
    return;
  }
  const rNum = Number(h.room_number);
  const currentRoom = state.rooms[rNum];

  if (currentRoom && currentRoom.name && currentRoom.name.trim()) {
    const ok = confirm(`현재 [${rNum}호]에는 이미 입주자(${currentRoom.name})가 등록되어 있습니다.\n\n전출 이력의 '${h.name}' 임차인으로 덮어써서 호실을 복원하시겠습니까?`);
    if (!ok) return;
  } else {
    const ok = confirm(`[${rNum}호]의 퇴실을 취소하고, 전출 이력에 보존된 '${h.name}' 임차인을 원래 호실로 복원하시겠습니까?`);
    if (!ok) return;
  }

  const payload = {
    lease_type: h.lease_type || '월세',
    pay_timing: h.pay_timing || '후불',
    name: h.name,
    id_number: h.id_number || '',
    phone: h.phone || '',
    deposit: Number(h.deposit) || 0,
    rent: Number(h.rent) || 0,
    maintenance: Number(h.maintenance) || 0,
    clean_fee: Number(h.clean_fee) || 0,
    move_in: h.move_in || '',
    expiry: h.expiry || '',
    move_out: '' // 퇴실 취소이므로 퇴실일 공란화
  };

  try {
    if (state.isOnline) {
      const res = await apiUpdateContract(rNum, payload, state.currentBranch);
      state.rooms[rNum] = res;
      // 퇴실 취소되어 복원되었으므로 전출자 이력 목록에서도 자동 제거
      try {
        await apiDeleteTenantHistory(histId, state.currentBranch);
      } catch (eDel) {
        console.warn("전출 이력 서버 삭제 경고:", eDel);
      }
    } else {
      Object.assign(state.rooms[rNum], payload);
    }

    state.tenantHistories = (state.tenantHistories || []).filter(item => String(item.id) !== String(histId));

    saveLocalFallback();
    populateModalRoomSelector(rNum);
    loadRoomIntoContractModal(rNum);
    renderAll();
    closeModal('tenantHistoryModal');

    alert(`🎉 [${rNum}호] ${h.name}님의 계약 정보가 원래 상태로 완벽히 복원되었습니다!\n(전출 보존 이력에서도 정상 정리되었습니다)`);
  } catch (err) {
    alert("호실 복원 실패: " + err.message);
  }
}

// ── 전출 보존 이력 수동 영구 삭제 (테스트 데이터 정리용) ──
export async function deleteTenantHistory(histId, roomNumber, name) {
  const ok = confirm(`[${roomNumber}호] ${name}님의 전출 보존 이력을 완전히 삭제하시겠습니까?\n\n(테스트용으로 생성되었거나 불필요한 이력인 경우 확인을 누르세요)`);
  if (!ok) return;

  try {
    if (state.isOnline) {
      await apiDeleteTenantHistory(histId, state.currentBranch);
    }
    state.tenantHistories = (state.tenantHistories || []).filter(item => String(item.id) !== String(histId));
    saveLocalFallback();
    openTenantHistoryModal();
    alert(`✅ [${roomNumber}호] ${name}님의 전출 이력이 성공적으로 삭제되었습니다.`);
  } catch (err) {
    alert("전출 이력 삭제 실패: " + err.message);
  }
}

// 📸 테스트 직전 현재 29개실 전체 상태 스냅샷 저장
export function saveTestSnapshot() {
  try {
    const snapshotData = JSON.stringify(state.rooms);
    const now = new Date();
    const timeStr = `${now.getMonth() + 1}월 ${now.getDate()}일 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    localStorage.setItem(`RENT_TEST_SNAPSHOT_${state.currentBranch}`, snapshotData);
    localStorage.setItem(`RENT_TEST_SNAPSHOT_TIME_${state.currentBranch}`, timeStr);
    alert(`📸 현재 29개실 전체 상태가 안전하게 임시 스냅샷으로 저장되었습니다!\n\n(저장 일시: ${timeStr})\n\n이제 전출(퇴실)이나 신규 전입을 마음껏 테스트해 보세요.\n테스트 후 언제든지 [↩️ 1초 롤백] 버튼을 누르면 지금 이 순간의 상태로 1초 만에 되돌릴 수 있습니다.`);
  } catch (e) {
    alert("스냅샷 저장 실패: " + e.message);
  }
}

// ↩️ 스냅샷으로 1초 만에 원상 복구 (롤백)
export async function restoreTestSnapshot() {
  const key = `RENT_TEST_SNAPSHOT_${state.currentBranch}`;
  const saved = localStorage.getItem(key);
  const timeStr = localStorage.getItem(`RENT_TEST_SNAPSHOT_TIME_${state.currentBranch}`) || '';
  if (!saved) {
    alert("저장된 테스트 스냅샷이 없습니다.\n\n먼저 [📸 스냅샷 백업] 버튼을 눌러 현재 상태를 저장해 주세요.");
    return;
  }

  const ok = confirm(`[${timeStr}]에 저장한 스냅샷으로 29개실 전체를 1초 만에 롤백하시겠습니까?\n\n테스트 중에 수정한 모든 전출/전입 내용이 스냅샷 저장 당시 모습으로 100% 원상복구됩니다.`);
  if (!ok) return;

  try {
    const parsedRooms = JSON.parse(saved);

    // 온라인이면 서버 호실 데이터도 스냅샷 기준으로 복원
    if (state.isOnline) {
      for (const [rNumStr, rData] of Object.entries(parsedRooms)) {
        const rNum = Number(rNumStr);
        await apiUpdateContract(rNum, {
          lease_type: rData.lease_type || '월세',
          pay_timing: rData.pay_timing || '후불',
          name: rData.name || '',
          id_number: rData.id_number || '',
          phone: rData.phone || '',
          deposit: rData.deposit || 0,
          rent: rData.rent || 0,
          maintenance: rData.maintenance || 0,
          clean_fee: rData.clean_fee || 0,
          move_in: rData.move_in || '',
          expiry: rData.expiry || '',
          move_out: rData.move_out || ''
        }, state.currentBranch);
      }
    }

    state.rooms = parsedRooms;
    saveLocalFallback();
    if (state.selectedRoom) {
      populateModalRoomSelector(state.selectedRoom);
      loadRoomIntoContractModal(state.selectedRoom);
    }
    renderAll();
    alert(`🎉 [${timeStr}] 스냅샷 시점으로 29개실 전체 데이터가 깨끗하게 100% 원상복구되었습니다!`);
  } catch (err) {
    alert("스냅샷 복원 중 오류: " + err.message);
  }
}

// ── 신규 부동산(건물) 추가 모달 ──
export function openNewBranchModal() {
  document.getElementById('newBranchId').value = `branch_${Date.now().toString().slice(-4)}`;
  document.getElementById('newBranchName').value = '';
  document.getElementById('newBranchAddress').value = '';
  openModal('newBranchModal');
}

export async function handleNewBranchSubmit(e) {
  e.preventDefault();
  const bId = document.getElementById('newBranchId').value.trim();
  const bName = document.getElementById('newBranchName').value.trim();
  const bAddr = document.getElementById('newBranchAddress').value.trim();

  if (!bId || !bName) {
    alert("건물 식별 ID와 이름을 입력해주세요.");
    return;
  }

  const payload = {
    branch_id: bId,
    name: bName,
    address: bAddr,
    fee_plan: "원룸 프리미엄 29실형",
    monthly_fee: 150000
  };

  try {
    if (state.isOnline) {
      await apiCreateBranch(payload);
    }
    const exists = (state.branches || []).some(b => b.branch_id === bId);
    if (!exists) {
      state.branches.push({
        branch_id: bId,
        name: bName,
        address: bAddr,
        billing_status: 'PAID',
        is_active: true
      });
    }
    saveLocalFallback();
    closeModal('newBranchModal');
    await switchBranch(bId);
    alert(`신규 부동산 [${bName}]이(가) 등록되고 선택되었습니다.`);
  } catch (err) {
    alert("부동산 등록 실패: " + err.message);
  }
}

// ── 8. 엑셀 데이터 일괄 입력 및 AI 스마트 컬럼 매핑 ──

export const SYSTEM_FIELDS = [
  { id: 'room_number', label: '호실 (필수)', required: true, keywords: ['호실', '방', '호수', '호', 'room', 'room no', 'no', '실', '방번호', '객실', '호/실', '동호수'] },
  { id: 'name', label: '세입자명', required: false, keywords: ['세입자', '임차인', '입주자', '이름', '성명', '고객명', '계약자', '계약자명', 'tenant', 'name', '사용자', '상호및대표자', '입주청년이름', '세입자명'] },
  { id: 'id_number', label: '주민번호', required: false, keywords: ['주민번호', '주민등록번호', '주민', '식별번호', '생년월일', 'id', 'id_number', 'ssn', '등록번호', '주민번호/사업자번호', '주민(사업자)번호', '생년'] },
  { id: 'phone', label: '연락처', required: false, keywords: ['연락처', '전화번호', '휴대폰', '핸드폰', 'hp', 'phone', 'tel', '전화', '임차인전화', '사업자연락처', '휴대폰번호'] },
  { id: 'lease_type', label: '임대유형', required: false, keywords: ['임대유형', '임대구분', '유형', '구분', '전월세', '월세/전세', 'type', '거래구분', '계약형태', '전월세구분', '전/월'] },
  { id: 'deposit', label: '보증금', required: false, keywords: ['보증금', '보증금액', '보증', '전세금', 'deposit', '보증금액(만원)', '전세보증금', '임차보증금'] },
  { id: 'rent', label: '월세(차임)', required: false, keywords: ['월세', '월차임', '임대료', '월임대료', '차임', 'rent', '차임(만원)'] },
  { id: 'maintenance', label: '관리비', required: false, keywords: ['관리비', '유지비', '공동관리비', '공용관리비', 'maintenance', '공용관리비(만원)'] },
  { id: 'pay_timing', label: '납부구분', required: false, keywords: ['납부구분', '선불/후불', '선후불', '선불', '후불', '납부방식', '지불시기', '납부조건', '수납구분'] },
  { id: 'move_in', label: '계약시작일', required: false, keywords: ['계약시작일', '계약시작', '입주일', '시작일', 'start', '전입일', '계약체결일', '입점일', '거주개시일'] },
  { id: 'expiry', label: '계약만료일', required: false, keywords: ['계약종료일', '계약만료일', '만기일', '종료일', 'end', '퇴실예정', '종료예정일', '퇴거예정일'] }
];

export const TEMPLATE_PRESETS = [
  {
    id: 'standard',
    title: '표준 임대차 계약 대장 (주민번호 포함)',
    badge: '원룸/오피스텔',
    desc: '호실, 세입자, 주민번호, 연락처, 보증금, 월세, 관리비 등 표준 규격',
    filename: '표준_원룸오피스텔_임대차대장.csv',
    csv: "\uFEFF호실,세입자,주민번호,연락처,임대유형,보증금,월세,관리비,납부방식,계약시작일,계약종료일,비고\n" +
         "101,홍길동,910512-1******,010-1234-5678,월세,5000000,480000,50000,후불,2026-01-01,2027-01-01,관리실 협의\n" +
         "201,장지아,960319-2******,010-9876-5432,월세,5000000,480000,50000,후불,2026-03-01,2027-03-01,남향 채광 양호\n" +
         "202,이민준,930512-1******,010-3333-4444,전세,65000000,0,50000,선불,2025-06-01,2027-06-01,전세 보증보험 가입\n" +
         "203,박수현,940512-2******,010-5555-6666,월세,5000000,500000,50000,후불,2026-02-15,2027-02-15,반려동물 협의\n" +
         "301,김도윤,970512-1******,010-7777-8888,월세,10000000,450000,50000,후불,2026-04-01,2027-04-01,직장인",
    sampleRows: [
      { "호실": "101", "세입자": "홍길동", "주민번호": "910512-1******", "연락처": "010-1234-5678", "임대유형": "월세", "보증금": "5000000", "월세": "480000", "관리비": "50000", "납부방식": "후불", "계약시작일": "2026-01-01", "계약종료일": "2027-01-01", "비고": "관리실 협의" },
      { "호실": "201", "세입자": "장지아", "주민번호": "960319-2******", "연락처": "010-9876-5432", "임대유형": "월세", "보증금": "5000000", "월세": "480000", "관리비": "50000", "납부방식": "후불", "계약시작일": "2026-03-01", "계약종료일": "2027-03-01", "비고": "남향 채광 양호" },
      { "호실": "202", "세입자": "이민준", "주민번호": "930512-1******", "연락처": "010-3333-4444", "임대유형": "전세", "보증금": "65000000", "월세": "0", "관리비": "50000", "납부방식": "선불", "계약시작일": "2025-06-01", "계약종료일": "2027-06-01", "비고": "전세 보증보험 가입" },
      { "호실": "203", "세입자": "박수현", "주민번호": "940512-2******", "연락처": "010-5555-6666", "임대유형": "월세", "보증금": "5000000", "월세": "500000", "관리비": "50000", "납부방식": "후불", "계약시작일": "2026-02-15", "계약종료일": "2027-02-15", "비고": "반려동물 협의" },
      { "호실": "301", "세입자": "김도윤", "주민번호": "970512-1******", "연락처": "010-7777-8888", "임대유형": "월세", "보증금": "10000000", "월세": "450000", "관리비": "50000", "납부방식": "후불", "계약시작일": "2026-04-01", "계약종료일": "2027-04-01", "비고": "직장인" }
    ]
  },
  {
    id: 'realtor',
    title: '부동산 중개망 거래 장부',
    badge: '공인중개망 연계',
    desc: '동호수, 계약자명, 차임(만원), 공용관리비 등 공인중개사 ERP 서식',
    filename: '부동산중개망_계약대장_서식.csv',
    csv: "\uFEFF동호수,계약자명,임차인전화,거래구분,보증금액(만원),차임(만원),공용관리비(만원),지불시기,계약체결일,종료예정일,특약사항\n" +
         "102호,최서연,010-2222-3333,월세,500,48,5,후불,2026-02-01,2027-02-01,현 임차인 거주중\n" +
         "204호,정우진,010-4444-5555,월세,1000,43,5,후불,2026-03-10,2027-03-10,보증금 상향형\n" +
         "205호,강지민,010-6666-7777,전세,7000,0,5,선불,2025-08-01,2027-08-01,전세대출 질권설정\n" +
         "302호,윤서아,010-8888-9999,월세,500,49,5,후불,2026-01-15,2027-01-15,주차 1대 포함",
    sampleRows: [
      { "동호수": "102호", "계약자명": "최서연", "임차인전화": "010-2222-3333", "거래구분": "월세", "보증금액(만원)": "500", "차임(만원)": "48", "공용관리비(만원)": "5", "지불시기": "후불", "계약체결일": "2026-02-01", "종료예정일": "2027-02-01", "특약사항": "현 임차인 거주중" },
      { "동호수": "204호", "계약자명": "정우진", "임차인전화": "010-4444-5555", "거래구분": "월세", "보증금액(만원)": "1000", "차임(만원)": "43", "공용관리비(만원)": "5", "지불시기": "후불", "계약체결일": "2026-03-10", "종료예정일": "2027-03-10", "특약사항": "보증금 상향형" },
      { "동호수": "205호", "계약자명": "강지민", "임차인전화": "010-6666-7777", "거래구분": "전세", "보증금액(만원)": "7000", "차임(만원)": "0", "공용관리비(만원)": "5", "지불시기": "선불", "계약체결일": "2025-08-01", "종료예정일": "2027-08-01", "특약사항": "전세대출 질권설정" },
      { "동호수": "302호", "계약자명": "윤서아", "임차인전화": "010-8888-9999", "거래구분": "월세", "보증금액(만원)": "500", "차임(만원)": "49", "공용관리비(만원)": "5", "지불시기": "후불", "계약체결일": "2026-01-15", "종료예정일": "2027-01-15", "특약사항": "주차 1대 포함" }
    ]
  },
  {
    id: 'commercial',
    title: '상가·사무실 부가세 대장',
    badge: '사업자/세무신고',
    desc: '호수, 상호(대표자), 사업자연락처, 보증금, 월차임, 관리비, 과세구분',
    filename: '상가사무실_부가세포함_임대대장.csv',
    csv: "\uFEFF호수,상호및대표자,사업자연락처,계약형태,보증금,월차임,관리비,납부조건,입점일,계약만료일,과세구분\n" +
         "B101,(주)스타트업원,010-1111-2222,월세,20000000,1200000,150000,후불,2025-10-01,2027-09-30,일반과세(세금계산서)\n" +
         "103호,디자인스튜디오,010-3333-5555,월세,15000000,900000,100000,후불,2026-01-01,2027-12-31,일반과세(세금계산서)\n" +
         "206호,커피공방,010-7777-9999,월세,10000000,750000,80000,후불,2026-03-01,2028-02-28,간이과세",
    sampleRows: [
      { "호수": "B101", "상호및대표자": "(주)스타트업원", "사업자연락처": "010-1111-2222", "계약형태": "월세", "보증금": "20000000", "월차임": "1200000", "관리비": "150000", "납부조건": "후불", "입점일": "2025-10-01", "계약만료일": "2027-09-30", "과세구분": "일반과세" },
      { "호수": "103호", "상호및대표자": "디자인스튜디오", "사업자연락처": "010-3333-5555", "계약형태": "월세", "보증금": "15000000", "월차임": "900000", "관리비": "100000", "납부조건": "후불", "입점일": "2026-01-01", "계약만료일": "2027-12-31", "과세구분": "일반과세" },
      { "호수": "206호", "상호및대표자": "커피공방", "사업자연락처": "010-7777-9999", "계약형태": "월세", "보증금": "10000000", "월차임": "750000", "관리비": "80000", "납부조건": "후불", "입점일": "2026-03-01", "계약만료일": "2028-02-28", "과세구분": "간이과세" }
    ]
  },
  {
    id: 'lh_youth',
    title: 'LH·청년전세 특약 서식',
    badge: '정부지원/보증보험',
    desc: '호실번호, 청년이름, 휴대폰번호, 전월세구분, 전세금, 월임대료, 관리비, 비고',
    filename: 'LH청년전세_특약서식.csv',
    csv: "\uFEFF호실번호,입주청년이름,휴대폰번호,전월세구분,전세보증금,월임대료,관리비,수납구분,거주개시일,퇴거예정일,보증보험가입여부\n" +
         "303호,오하늘,010-1357-2468,전세,68000000,0,50000,선불,2025-05-01,2027-04-30,HUG 전세보증 100%\n" +
         "304호,신태양,010-2468-1357,월세,5000000,460000,50000,후불,2026-02-01,2027-01-31,청년월세지원 대상\n" +
         "305호,한바다,010-9876-1234,전세,72000000,0,50000,선불,2025-09-01,2027-08-31,HF 청년버팀목",
    sampleRows: [
      { "호실번호": "303호", "입주청년이름": "오하늘", "휴대폰번호": "010-1357-2468", "전월세구분": "전세", "전세보증금": "68000000", "월임대료": "0", "관리비": "50000", "수납구분": "선불", "거주개시일": "2025-05-01", "퇴거예정일": "2027-04-30", "보증보험가입여부": "HUG 전세보증 100%" },
      { "호실번호": "304호", "입주청년이름": "신태양", "휴대폰번호": "010-2468-1357", "전월세구분": "월세", "전세보증금": "5000000", "월임대료": "460000", "관리비": "50000", "수납구분": "후불", "거주개시일": "2026-02-01", "퇴거예정일": "2027-01-31", "보증보험가입여부": "청년월세지원 대상" },
      { "호실번호": "305호", "입주청년이름": "한바다", "휴대폰번호": "010-9876-1234", "전월세구분": "전세", "전세보증금": "72000000", "월임대료": "0", "관리비": "50000", "수납구분": "선불", "거주개시일": "2025-09-01", "퇴거예정일": "2027-08-31", "보증보험가입여부": "HF 청년버팀목" }
    ]
  },
  {
    id: 'monthly_matrix_2026',
    title: '2026년도 월별 수납장부 매트릭스',
    badge: '실수납 대장',
    desc: '29개실 호실, 성명, 선/후, 2025.12~2026.10월 월일/금액 매트릭스 수납 대장',
    filename: '2026년도_월별_수납내역_매트릭스대장.tsv',
    rawText: "호실\t성명\t선/후\t2025.12\t\t1월\t\t2월\t\t3월\t\t4월\t\t5월\t\t6월\t\t7월\t\t8월\t\t9월\t\t10월\t\n\t\t\t월일\t금액\t월일\t금액\t월일\t금액\t월일\t금액\t월일\t금액\t월일\t금액\t월일\t금액\t월일\t금액\t월일\t금액\t월일\t금액\t월일\t금액\n101\t배종봉\t후불\t12. 3\t250,000\t1. 3\t250,000\t2. 3\t250,000\t3. 3\t250,000\t4. 3\t250,000\t5. 3\t250,000\t6. 3\t250,000\t7. 2\t250,000\t8. 3\t250,000\t9. 2\t250,000\t10. 3\t250,000\n201\t정민준\t후불\t12. 21\t44,000\t1. 22\t440,000\t2. 23\t440,000\t3. 13\t440,000\t4. 19\t440,000\t5. 15\t440,000\t6. 15\t440,000\t7. 20\t440,000\t8. 20\t440,000\t9. 21\t440,000\t\t\n202\t안동기\t선불\t2026-1-29\t1,760,000\t2. 24\t440,000\t2. 24\t440,000\t8. 13\t440,000\t8. 13\t440,000\t8. 13\t440,000\t8. 13\t440,000\t8. 13\t440,000\t10. 8\t440000\t10. 8\t440,000\t10. 8\t440000\n203\t이광훈\t후불\t11:35\t440,000\t1. 25\t440,000\t2. 23\t440,000\t3. 25\t440,000\t4. 25\t440,000\t5. 25\t440,000\t6. 24\t440,000\t7. 24\t440,000\t8. 23\t440,000\t9. 24\t440,000\t\t\n204\t주예란\t후불\t12. 3\t440,000\t1. 2\t440,000\t2. 3\t440,000\t3. 3\t440,000\t4. 3\t440,000\t5. 4\t440,000\t6. 4\t440,000\t7. 3\t440,000\t8. 3\t440,000\t9. 4\t440,000\t10. 3\t440,000\n205\t서재민\t후불\t12. 22\t400,000\t1. 23\t400,000\t2. 21\t400,000\t3. 22\t400,000\t4. 21\t400,000\t5. 20\t400,000\t6. 21\t400,000\t7. 21\t400,000\t8. 21\t400,000\t9. 22\t400,000\t\t\n301\t성민병원\t후불\t12. 28\t440,000\t1. 28\t440,000\t2. 27\t440,000\t3. 28\t440,000\t4. 28\t440,000\t5. 30\t440,000\t6. 30\t440,000\t7. 28\t440,000\t8. 28\t440,000\t9. 28\t440,000\t\t\n302\t김지영\t후불\t12. 21\t150,000\t1. 18\t150,000\t2. 19\t150,000\t3. 18\t150,000\t4. 19\t150,000\t5. 19\t150,000\t6. 18\t150,000\t7. 19\t150,000\t8. 19\t150,000\t9. 17\t150,000\t\t\n303\t김진수\t후불\t12. 13\t440,000\t1. 12\t440,000\t2. 13\t440,000\t3. 13\t440,000\t4. 16\t440,000\t5. 16\t440,000\t6. 12\t440,000\t7. 13\t440,000\t8. 13\t440,000\t9. 14\t440,000\t\t\n304\t노송병원\t후불\t1. 8\t390,000\t1. 8\t390,000\t2. 20\t390,000\t3. 4\t390,000\t4. 2\t390,000\t5. 4\t390,000\t6. 2\t390,000\t7. 6\t390,000\t8. 3\t390,000\t9. 2\t390,000\t10. 1\t390,000\n305\t정우메탈\t후불\t12. 15\t440,000\t1. 15\t440,000\t2. 13\t440,000\t3:16\t440,000\t4. 15\t440,000\t5. 15\t440,000\t6. 15\t440,000\t7. 15\t440,000\t8. 14\t440,000\t9. 15\t440,000\t\t\n401\t이정도\t후불\t12. 15\t440,000\t1. 15\t440,000\t2. 13\t440,000\t3. 13\t440,000\t4. 16\t440,000\t5. 15\t440,000\t6. 15\t440,000\t7. 15\t440,000\t8. 14\t440,000\t9. 15\t440,000\t\t\n402\t한윤철\t선불\t12. 28\t440,000\t1. 28\t440,000\t2. 28\t440,000\t3. 28\t440,000\t4. 28\t440,000\t5. 28\t440,000\t6. 28\t440,000\t7. 28\t440,000\t8. 28\t440,000\t9. 28\t440,000\t\t\n403\t김정두\t후불\t전입 12/19\t\t1. 20\t440,000\t2. 19\t440,000\t3. 20\t440,000\t4. 19\t440,000\t5. 19\t440,000\t6. 19\t440,000\t7. 19\t440,000\t8. 19\t440,000\t9. 19\t440,000\t\t\n404\t이종진\t후불\t12. 23\t440,000\t1. 24\t440,000\t2. 24\t440,000\t3. 23\t440,000\t4. 23\t440,000\t5. 24\t440,000\t전출6/4\t\t7. 7\t440,000\t8. 6\t440,000\t9. 7\t440,000\t10. 6\t440,000\n405\t김병현\t후불\t12. 25\t450,000\t1. 25\t450,000\t2. 25\t450,000\t전출3/2\t\t4. 9\t440,000\t5. 8\t440000\t6. 8\t440,000\t7. 5\t440,000\t8. 4\t440000\t9. 4\t440,000\t10-5\t440,000\n501\t김민규\t후불\t12. 31\t500,000\t2. 1\t440,000\t3. 1\t440,000\t3. 31\t440,000\t5. 2\t440,000\t5. 31\t440,000\t6. 30\t440,000\t8. 2\t440,000\t8. 28\t440,000\t9. 30\t440,000\t\t\n502\t강홍식\t반선불\t12. 15\t440,000\t115\t440,000\t2. 15\t440,000\t3. 15\t440,000\t4. 15\t440,000\t5. 15\t440,000\t6. 15\t440,000\t7. 15\t440,000\t8. 15\t440,000\t9. 15\t440,000\t\t\n503\t강백찬\t후불\t12. 24\t440,000\t1. 24\t440,000\t2. 19\t440,000\t3. 23\t440,000\t4. 18\t440,000\t5. 19\t440,000\t6. 18\t440,000\t7. 20\t440,000\t8. 22\t440,000\t9-23\t440,000\t\t\n504\t이수현\t후불\t12. 1\t440,000\t1. 1\t440,000\t2. 1\t440,000\t3. 1\t440,000\t4. 1\t440000\t5. 1\t440,000\t6. 1\t440,000\t7. 1\t440,000\t8. 19\t440,000\t9. 1\t440,000\t10. 1\t440,000\n505\t김정현\t선불\t12. 26\t400,000\t1. 26\t400,000\t2. 26\t400,000\t3. 26\t400,000\t4. 26\t400000\t5. 26\t400,000\t전출6/26\t440,000\t7. 29\t440,000\t8. 17\t440,000\t9. 27\t440,000\t\t\n601\t노우영\t후불\t12. 23\t440,000\t1. 23\t440,000\t2. 24\t440,000\t3. 23\t440,000\t4. 23\t440,000\t5. 23\t440,000\t6. 23\t440,000\t7. 23\t440,000\t8. 23\t440,000\t9. 23\t440,000\t\t\n602\t박정자\t후불\t12. 1\t440,000\t1. 2\t440,000\t2. 2\t440000\t3. 3\t440,000\t4. 1\t440,000\t5. 4\t440,000\t6. 2\t440,000\t7. 1\t440,000\t8. 3\t440,000\t9. 1\t440,000\t10. 1\t440,000\n603\t김수현\t후불\t12. 28\t440,000\t1. 27\t440,000\t2. 27\t440,000\t3. 28\t440,000\t4. 27\t440,000\t5. 27\t440,000\t6. 27\t440,000\t7. 27\t440,000\t8. 27\t440,000\t9. 27\t440,000\t\t\n604\t김동주\t후불\t12. 15\t440,000\t1. 14\t440,000\t2. 13\t440,000\t3. 13\t440,000\t4. 15\t440,000\t5. 13\t440,000\t6. 15\t440,000\t7. 16\t440,000\t8. 16\t440,000\t9. 15\t440,000\t\t\n605\t배은미\t후불\t12. 26\t390,000\t1. 26\t390,000\t2. 25\t390,000\t3. 25\t390,000\t4. 26\t390,000\t5. 25\t390,000\t6. 25\t390,000\t7. 26\t390,000\t8. 26\t390,000\t9. 26\t390,000\t\t\n701\t주인세대\t후불\t\t주인\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\n702\t이범주\t후불\t12. 5\t540,000\t1. 5\t540,000\t2. 5\t540,000\t3. 6\t540,000\t4. 5\t540,000\t5. 6\t540,000\t6. 6\t540,000\t7. 6\t540,000\t8. 6\t540,000\t9. 6\t540,000\t105\t540,000\n703\t김상호\t후불\t12. 6\t400,000\t1/23전입\t\t2. 24\t440,000\t3. 23\t440,000\t4. 23\t440,000\t5. 26\t440,000\t6. 23\t440000\t7. 23\t440,000\t8. 25\t440,000\t9. 23\t440,000\t\t"
  }
];

let selectedPresetId = 'standard';
let importedRawRows = [];
let detectedHeaders = [];
let activeColumnMapping = {};
let activePaymentMatrixRooms = null;
let aiConfidenceScore = 0;
let aiCleaningStats = { roomCleaned: 0, moneyCleaned: 0, phoneCleaned: 0, dateCleaned: 0 };

export function isPaymentMatrixText(text) {
  if (!text) return false;
  return (/호실/i.test(text) && /성명|세입자|선\/후/i.test(text) && /\d{1,2}월/i.test(text) && /월일|금액/i.test(text));
}

export function parsePaymentMatrixText(text) {
  if (!isPaymentMatrixText(text)) return null;
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
  if (lines.length < 3) return null;

  const monthsSpec = [
    { year: 2025, month: 12, label: "25.12" },
    { year: 2026, month: 1, label: "1월" },
    { year: 2026, month: 2, label: "2월" },
    { year: 2026, month: 3, label: "3월" },
    { year: 2026, month: 4, label: "4월" },
    { year: 2026, month: 5, label: "5월" },
    { year: 2026, month: 6, label: "6월" },
    { year: 2026, month: 7, label: "7월" },
    { year: 2026, month: 8, label: "8월" },
    { year: 2026, month: 9, label: "9월" },
    { year: 2026, month: 10, label: "10월" },
  ];

  const parseMoney = (val) => {
    if (!val) return 0;
    const s = String(val).replace(/[^0-9]/g, '');
    return s ? parseInt(s, 10) : 0;
  };

  const parseDate = (dStr, y, m) => {
    if (!dStr) return '';
    const s = String(dStr).trim();
    if (!s || s === '-' || s.includes('전출') || s.includes('전입') || s.includes('주인')) return '';
    
    const m1 = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
    if (m1) return `${m1[1]}-${String(m1[2]).padStart(2, '0')}-${String(m1[3]).padStart(2, '0')}`;

    const m2 = s.match(/^(\d{1,2})[.\s/-]+(\d{1,2})$/);
    if (m2) return `${y}-${String(m2[1]).padStart(2, '0')}-${String(m2[2]).padStart(2, '0')}`;

    const m3 = s.match(/^(\d{1,2})(\d{2})$/);
    if (m3) return `${y}-${String(m3[1]).padStart(2, '0')}-${String(m3[2]).padStart(2, '0')}`;

    return `${y}-${String(m).padStart(2, '0')}-10`;
  };

  const rooms = [];

  for (let i = 2; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    if (parts.length < 3) continue;
    const rNum = parseInt(parts[0].replace(/[^0-9]/g, ''), 10);
    if (!rNum || isNaN(rNum) || rNum < 100 || rNum > 999) continue;

    const name = parts[1].trim();
    const timing = parts[2].trim() || '후불';

    let colIdx = 3;
    const payments = [];
    let totalRoomPaid = 0;

    monthsSpec.forEach(spec => {
      const rawDate = colIdx < parts.length ? parts[colIdx].trim() : '';
      const rawAmt = (colIdx + 1) < parts.length ? parts[colIdx + 1].trim() : '';
      colIdx += 2;

      const amt = parseMoney(rawAmt);
      let note = '';
      if (rawDate.includes('전입') || rawAmt.includes('전입')) note = rawDate || rawAmt;
      else if (rawDate.includes('전출') || rawAmt.includes('전출')) note = rawDate || rawAmt;
      else if (rawDate.includes('주인') || rawAmt.includes('주인')) note = '주인세대 거주';

      const isPaid = amt > 0;
      const pDate = isPaid ? parseDate(rawDate, spec.year, spec.month) : '';
      if (isPaid) totalRoomPaid += amt;

      payments.push({
        year: spec.year,
        month: spec.month,
        label: spec.label,
        paid: isPaid,
        paid_date: pDate,
        amount: amt,
        note: note
      });
    });

    rooms.push({
      room_number: rNum,
      name: name,
      pay_timing: timing,
      total_paid: totalRoomPaid,
      payments: payments
    });
  }

  return rooms;
}

export function toggleDirectPasteBox(forceState) {
  const box = document.getElementById('directPasteBox');
  if (!box) return;
  const isCurrentlyHidden = box.classList.contains('hidden');
  const shouldShow = (forceState !== undefined) ? forceState : isCurrentlyHidden;
  if (shouldShow) {
    box.classList.remove('hidden');
    const ta = document.getElementById('directPasteTextarea');
    if (ta) ta.focus();
  } else {
    box.classList.add('hidden');
  }
}
window.toggleDirectPasteBox = toggleDirectPasteBox;

export function processDirectPastedText() {
  const ta = document.getElementById('directPasteTextarea');
  if (!ta || !ta.value.trim()) {
    alert("붙여넣은 텍스트가 없습니다. 입력창에 엑셀 데이터를 붙여넣어주세요.");
    return;
  }
  const text = ta.value.trim();
  if (isPaymentMatrixText(text)) {
    const matrixRooms = parsePaymentMatrixText(text);
    if (matrixRooms && matrixRooms.length > 0) {
      processParsedPaymentMatrix(matrixRooms, "직접 붙여넣은 2026 월별 수납장부");
      toggleDirectPasteBox(false);
      return;
    }
  }

  const rows = parseClipboardSpreadsheetText(text);
  if (rows && rows.length > 0) {
    processParsedExcelRows(rows, "직접 붙여넣은 엑셀 표");
    toggleDirectPasteBox(false);
  } else {
    alert("유효한 표 데이터를 추출할 수 없습니다. 엑셀에서 셀 범위를 복사하여 붙여넣었는지 확인해주세요.");
  }
}
window.processDirectPastedText = processDirectPastedText;

export function processParsedPaymentMatrix(matrixRooms, sourceName = "월별 수납장부 매트릭스") {
  if (!matrixRooms || matrixRooms.length === 0) {
    alert("유효한 수납 데이터가 없습니다.");
    return;
  }

  activePaymentMatrixRooms = matrixRooms;
  importedRawRows = [];
  detectedHeaders = [];
  activeColumnMapping = {};

  const statusText = document.getElementById('excelFileStatusText');
  if (statusText) {
    statusText.innerHTML = `✓ <strong>[${sourceName}]</strong> 총 <span class="text-emerald-400 font-bold">${matrixRooms.length}개실</span> (2025.12~2026.10월 실입금일/금액) 매트릭스가 완벽히 분석되었습니다!`;
  }

  const aiBox = document.getElementById('aiMappingContainer');
  if (aiBox) aiBox.classList.add('hidden');

  renderExcelPreviewTable();

  const prevBox = document.getElementById('excelPreviewContainer');
  if (prevBox) prevBox.classList.remove('hidden');

  const execBtn = document.getElementById('btnExecuteBatchImport');
  if (execBtn) {
    execBtn.disabled = false;
    execBtn.textContent = `🚀 ${matrixRooms.length}개실 월별 수납장부 일괄 반영 실행`;
  }
}
window.processParsedPaymentMatrix = processParsedPaymentMatrix;

export function openExcelImportModal() {
  const targetLabel = document.getElementById('importTargetBranchName');
  if (targetLabel) {
    const curB = (state.branches || []).find(b => b.branch_id === state.currentBranch);
    targetLabel.textContent = curB ? curB.name : state.currentBranch;
  }

  // 초기화
  importedRawRows = [];
  detectedHeaders = [];
  activeColumnMapping = {};
  activePaymentMatrixRooms = null;
  aiConfidenceScore = 0;
  aiCleaningStats = { roomCleaned: 0, moneyCleaned: 0, phoneCleaned: 0, dateCleaned: 0 };

  renderTemplatePresetsUI();

  const fileInput = document.getElementById('excelFileInput');
  if (fileInput) fileInput.value = '';

  const aiBox = document.getElementById('aiMappingContainer');
  if (aiBox) aiBox.classList.add('hidden');

  const prevBox = document.getElementById('excelPreviewContainer');
  if (prevBox) prevBox.classList.add('hidden');

  const ocrLoading = document.getElementById('imageOcrLoadingContainer');
  if (ocrLoading) ocrLoading.classList.add('hidden');

  const statusText = document.getElementById('excelFileStatusText');
  if (statusText) statusText.innerHTML = '💡 <strong>화면 캡처(Win+Shift+S) 후 이 창에서 바로 [Ctrl + V]</strong>를 누르면 AI가 즉시 표를 분석합니다!';

  const chkClear = document.getElementById('chkClearExistingRooms');
  if (chkClear) chkClear.checked = true;

  const execBtn = document.getElementById('btnExecuteBatchImport');
  if (execBtn) execBtn.disabled = true;

  // 클립보드 붙여넣기 리스너 등록
  window.removeEventListener('paste', handleGlobalPasteForOcr);
  window.addEventListener('paste', handleGlobalPasteForOcr);

  openModal('excelImportModal');
}

/**
 * 템플릿 프리셋 탭 UI 렌더링
 */
export function renderTemplatePresetsUI() {
  const container = document.getElementById('templatePresetsContainer');
  if (!container) return;

  container.innerHTML = TEMPLATE_PRESETS.map(preset => {
    const isSelected = preset.id === selectedPresetId;
    return `
      <div onclick="selectTemplatePreset('${preset.id}')" class="cursor-pointer p-2.5 rounded-xl border text-left transition relative flex flex-col justify-between ${
        isSelected
          ? 'bg-cyan-950/40 border-cyan-500 shadow-sm ring-1 ring-cyan-500/50'
          : 'bg-surface-850 border-slate-800 hover:border-slate-700'
      }">
        <div>
          <div class="flex items-center justify-between gap-1 mb-1">
            <span class="font-bold text-xs text-white truncate">${preset.title}</span>
            <span class="text-[9px] px-1.5 py-0.2 rounded font-mono ${
              isSelected ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-surface-800 text-slate-400'
            }">${preset.badge}</span>
          </div>
          <p class="text-[10px] text-slate-400 line-clamp-1">${preset.desc}</p>
        </div>
        <div class="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-slate-800/80">
          <button type="button" onclick="downloadTemplatePreset('${preset.id}', event)" class="px-2 py-0.8 rounded-lg bg-surface-800 hover:bg-surface-700 text-cyan-300 text-[10px] font-semibold border border-slate-700 flex items-center gap-1">
            <span>📥 서식 다운</span>
          </button>
          <button type="button" onclick="loadTemplatePresetDemo('${preset.id}', event)" class="px-2 py-0.8 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 text-[10px] font-semibold border border-emerald-800/60 flex items-center gap-1">
            <span>✨ 예시 로드</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

export function selectTemplatePreset(presetId) {
  selectedPresetId = presetId;
  renderTemplatePresetsUI();
}

/**
 * 선택된 템플릿 서식 CSV 다운로드
 */
export function downloadTemplatePreset(presetId, e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  const preset = TEMPLATE_PRESETS.find(p => p.id === presetId) || TEMPLATE_PRESETS[0];
  const fileContent = preset.csv || preset.rawText || '';
  const isTsv = (preset.filename || '').endsWith('.tsv');
  const blob = new Blob([fileContent], { type: isTsv ? 'text/tab-separated-values;charset=utf-8;' : 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", preset.filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 선택된 템플릿의 예시 데이터 즉시 로드 & AI 자동 매핑 시연
 */
export function loadTemplatePresetDemo(presetId, e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  selectedPresetId = presetId;
  renderTemplatePresetsUI();

  const preset = TEMPLATE_PRESETS.find(p => p.id === presetId) || TEMPLATE_PRESETS[0];
  if (preset.id === 'monthly_matrix_2026' && preset.rawText) {
    const matrix = parsePaymentMatrixText(preset.rawText);
    processParsedPaymentMatrix(matrix, preset.title);
    return;
  }
  processParsedExcelRows(preset.sampleRows, `${preset.title} 예시 데이터`);
}

/**
 * 파일 탐색기 열기
 */
export function triggerFileInputClick() {
  const input = document.getElementById('excelFileInput');
  if (input) {
    input.value = '';
    input.click();
  }
}
window.triggerFileInputClick = triggerFileInputClick;

/**
 * 드롭존 드래그앤드롭 이벤트 핸들러
 */
export function handleExcelDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  const zone = document.getElementById('excelDropZone');
  if (zone) zone.classList.add('border-cyan-400', 'bg-cyan-950/20');
}
window.handleExcelDragOver = handleExcelDragOver;

export function handleExcelDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  const zone = document.getElementById('excelDropZone');
  if (zone) zone.classList.remove('border-cyan-400', 'bg-cyan-950/20');
}
window.handleExcelDragLeave = handleExcelDragLeave;

export function handleExcelDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const zone = document.getElementById('excelDropZone');
  if (zone) zone.classList.remove('border-cyan-400', 'bg-cyan-950/20');

  const files = e.dataTransfer && e.dataTransfer.files;
  if (files && files.length > 0) {
    handleExcelFileSelect({ target: { files: [files[0]] } });
  }
}
window.handleExcelDrop = handleExcelDrop;

/**
 * HTML <table> 구조를 JSON 행 배열로 파싱 (엑셀 셀 범위 복사 시 text/html 지원)
 */
export function parseHTMLTable(htmlText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return null;

    const trs = Array.from(table.querySelectorAll('tr'));
    if (trs.length < 2) return null;

    const headerCells = Array.from(trs[0].querySelectorAll('th, td')).map(c => c.textContent.trim());
    if (headerCells.length === 0 || headerCells.every(h => !h)) return null;

    const rows = [];
    for (let i = 1; i < trs.length; i++) {
      const cells = Array.from(trs[i].querySelectorAll('td, th')).map(c => c.textContent.trim());
      if (cells.length === 0 || cells.every(c => !c)) continue;
      const obj = {};
      headerCells.forEach((h, idx) => {
        const key = h || `열_${idx + 1}`;
        obj[key] = cells[idx] !== undefined ? cells[idx] : '';
      });
      rows.push(obj);
    }
    return rows;
  } catch (err) {
    console.warn('[VAT] HTML table parse error:', err);
    return null;
  }
}

/**
 * 클립보드 텍스트(TSV/CSV/공백 구분)를 JSON 행 배열로 파싱
 */
export function parseClipboardSpreadsheetText(text) {
  if (!text || !text.trim()) return [];

  const lines = text.split(/\r\n|\n|\r/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];

  let delim = '\t';
  if (!lines[0].includes('\t')) {
    if (lines[0].includes(',')) delim = ',';
    else if (lines[0].includes(';')) delim = ';';
    else if (lines[0].includes('|')) delim = '|';
    else delim = /\s{2,}/;
  }

  const splitLine = (line) => {
    if (delim instanceof RegExp) {
      return line.split(delim).map(s => s.trim());
    }
    const res = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === delim && !inQuotes) {
        res.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += c;
      }
    }
    res.push(cur.trim().replace(/^"|"$/g, ''));
    return res;
  };

  const firstCells = splitLine(lines[0]);
  if (firstCells.length === 0) return [];

  const isHeader = isNaN(Number(firstCells[0])) || firstCells.some(c => /호실|방|이름|세입자|임차인|보증금|월세|차임|관리비|연락처|유형/i.test(c));

  let headers = [];
  let startIdx = 1;

  if (isHeader && lines.length > 1) {
    headers = firstCells.map((h, i) => h.trim() || `열_${i + 1}`);
    startIdx = 1;
  } else {
    const defaultHeaders = ["호실", "세입자", "보증금", "월세", "관리비", "연락처", "임대유형"];
    headers = firstCells.map((_, i) => defaultHeaders[i] || `열_${i + 1}`);
    startIdx = 0;
  }

  const rows = [];
  for (let i = startIdx; i < lines.length; i++) {
    const vals = splitLine(lines[i]);
    if (vals.length === 0 || vals.every(v => !v)) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] !== undefined ? vals[idx] : '';
    });
    rows.push(obj);
  }

  return rows;
}

/**
 * 붙여넣기 버튼 클릭 핸들러: navigator.clipboard API를 통해 엑셀 범위 또는 캡처 이미지 즉시 획득
 */
export async function handleClipboardPasteClick() {
  const statusText = document.getElementById('excelFileStatusText');
  if (statusText) statusText.textContent = "클립보드 데이터 확인 중...";

  if (navigator.clipboard && navigator.clipboard.read) {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          const reader = new FileReader();
          reader.onload = (e) => {
            processImageOcr(e.target.result, "클립보드 화면 캡처 이미지");
          };
          reader.readAsDataURL(blob);
          return;
        }

        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          const html = await blob.text();
          if (html.includes('<table') || html.includes('<tr')) {
            const parsed = parseHTMLTable(html);
            if (parsed && parsed.length > 0) {
              processParsedExcelRows(parsed, "클립보드 엑셀 표");
              return;
            }
          }
        }

        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain');
          const text = await blob.text();
          if (text && text.trim()) {
            if (isPaymentMatrixText(text)) {
              const matrix = parsePaymentMatrixText(text);
              if (matrix && matrix.length > 0) {
                processParsedPaymentMatrix(matrix, "클립보드 월별 수납장부 (Ctrl+V)");
                return;
              }
            }
            const parsed = parseClipboardSpreadsheetText(text);
            if (parsed && parsed.length > 0) {
              processParsedExcelRows(parsed, "클립보드 엑셀 복사 데이터");
              return;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[VAT] navigator.clipboard.read 거부/실패:', err);
    }
  }

  if (navigator.clipboard && navigator.clipboard.readText) {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const parsed = parseClipboardSpreadsheetText(text);
        if (parsed && parsed.length > 0) {
          processParsedExcelRows(parsed, "클립보드 엑셀 복사 데이터");
          return;
        }
      }
    } catch (err) {
      console.warn('[VAT] navigator.clipboard.readText 거부/실패:', err);
    }
  }

  if (statusText) {
    statusText.innerHTML = '💡 <strong>이 창에서 키보드로 [Ctrl + V]</strong>를 누르시면 복사된 엑셀 표나 캡처가 즉시 매핑됩니다!';
  }
}
window.handleClipboardPasteClick = handleClipboardPasteClick;

/**
 * 전역 클립보드 붙여넣기(Ctrl+V) 이벤트 리스너 (화면 캡처 이미지 및 엑셀 셀 범위 텍스트 모두 지원)
 */
export function handleGlobalPasteForOcr(e) {
  const modal = document.getElementById('excelImportModal');
  if (!modal || modal.classList.contains('hidden')) return;

  // 1. 캡처 이미지 아이템 확인
  const items = e.clipboardData && e.clipboardData.items;
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          processImageOcr(loadEvent.target.result, "클립보드 캡처 이미지 (Ctrl+V)");
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
  }

  // 2. 엑셀 HTML 표 확인
  const html = e.clipboardData && e.clipboardData.getData('text/html');
  if (html && (html.includes('<table') || html.includes('<tr'))) {
    const parsed = parseHTMLTable(html);
    if (parsed && parsed.length > 0) {
      e.preventDefault();
      processParsedExcelRows(parsed, "클립보드 엑셀 표 (Ctrl+V)");
      return;
    }
  }

  // 3. 엑셀 텍스트(TSV/CSV) 확인
  const text = e.clipboardData && e.clipboardData.getData('text/plain');
  if (text && text.trim().length > 0) {
    if (isPaymentMatrixText(text)) {
      const matrix = parsePaymentMatrixText(text);
      if (matrix && matrix.length > 0) {
        e.preventDefault();
        processParsedPaymentMatrix(matrix, "클립보드 월별 수납장부 (Ctrl+V)");
        return;
      }
    }
    const parsed = parseClipboardSpreadsheetText(text);
    if (parsed && parsed.length > 0) {
      e.preventDefault();
      processParsedExcelRows(parsed, "클립보드 엑셀 복사 데이터 (Ctrl+V)");
      return;
    }
  }
}

/**
 * 엑셀/CSV/이미지 파일 선택 및 파싱
 */
export function handleExcelFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const statusText = document.getElementById('excelFileStatusText');
  if (statusText) statusText.textContent = `파일 읽는 중: ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`;

  const fileName = file.name.toLowerCase();

  // 1. 이미지 캡처 파일 처리 (PNG, JPG, WEBP 등)
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(fileName)) {
    const reader = new FileReader();
    reader.onload = (e) => {
      processImageOcr(e.target.result, file.name);
    };
    reader.readAsDataURL(file);
    return;
  }

  // 2. CSV 파일 처리 (자체 내장 파서)
  if (fileName.endsWith('.csv')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        processParsedExcelRows(parseCSVText(text), file.name);
      } catch (err) {
        alert("CSV 파일 파싱 실패: " + err.message);
      }
    };
    reader.readAsText(file, 'utf-8');
    return;
  }

  // 3. XLSX / XLS 파일 처리 (SheetJS 라이브러리 사용)
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      if (typeof XLSX === 'undefined') {
        throw new Error("SheetJS 라이브러리를 로드할 수 없습니다. CSV 파일로 저장 후 업로드하시거나 네트워크를 확인해주세요.");
      }
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      processParsedExcelRows(rows, file.name);
    } catch (err) {
      alert("엑셀 파일 파싱 오류: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

/**
 * 캡처 이미지로부터 AI Vision 표 데이터 추출
 */
export async function processImageOcr(imageBase64, sourceName = "화면 캡처 이미지") {
  const ocrLoading = document.getElementById('imageOcrLoadingContainer');
  const statusText = document.getElementById('excelFileStatusText');
  if (ocrLoading) ocrLoading.classList.remove('hidden');
  if (statusText) statusText.textContent = `🤖 [${sourceName}] AI Vision이 이미지 표 구조를 분석하는 중입니다...`;

  try {
    let result = null;
    if (state.isOnline) {
      result = await apiOcrImportImage(imageBase64, state.currentBranch);
    }

    if (result && result.has_api_key === false) {
      if (ocrLoading) ocrLoading.classList.add('hidden');
      if (statusText) {
        statusText.innerHTML = `⚠️ <strong class="text-amber-400">이미지 AI 스캔 안내:</strong> 서버에 Gemini API 키가 설정되지 않아 이미지 분석이 제한됩니다.<br>👉 <strong>[.csv 파일 업로드]</strong> 또는 <strong>[📝 텍스트 직접 붙여넣기]</strong>를 이용하시면 모든 호실이 즉시 100% 완벽하게 인식됩니다!`;
      }
      alert("⚠️ 이미지 AI 인식을 위해서는 서버에 GEMINI_API_KEY 설정이 필요합니다.\n\n💡 바로 등록하시려면:\n1) 상단의 [.csv 파일 찾기]를 선택하시거나\n2) [📝 텍스트 직접 붙여넣기]를 이용해 주세요!");
      return;
    }

    // 결과 행 추출
    let rows = (result && result.rows) || [];
    if (!rows || rows.length === 0) {
      if (ocrLoading) ocrLoading.classList.add('hidden');
      if (statusText) statusText.innerHTML = `❌ 이미지에서 표나 호실 텍스트를 감지하지 못했습니다. 선명한 사진을 사용하시거나 <strong>[📝 텍스트 직접 붙여넣기]</strong>를 이용해 주세요.`;
      return;
    }

    if (ocrLoading) ocrLoading.classList.add('hidden');
    processParsedExcelRows(rows, sourceName);
  } catch (err) {
    if (ocrLoading) ocrLoading.classList.add('hidden');
    console.warn("OCR API 실패:", err);
    if (statusText) {
      statusText.innerHTML = `⚠️ 서버 연결 실패: <strong>[.csv 파일 업로드]</strong> 또는 <strong>[📝 텍스트 직접 붙여넣기]</strong>를 이용해 주세요.`;
    }
  }
}

/**
 * CSV 텍스트 파서 (BOM 제거 및 쉼표/따옴표 처리)
 */
function parseCSVText(csvText) {
  // UTF-8 BOM 제거
  if (csvText.charCodeAt(0) === 0xFEFF) {
    csvText = csvText.slice(1);
  }
  const lines = csvText.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  // 간단한 CSV 행 분리
  const splitRow = (rowStr) => {
    const res = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < rowStr.length; i++) {
      const c = rowStr[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        res.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += c;
      }
    }
    res.push(cur.trim().replace(/^"|"$/g, ''));
    return res;
  };

  const headers = splitRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitRow(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * 파싱된 행 데이터 처리 및 AI 컬럼 매핑 실행
 */
function processParsedExcelRows(rows, fileName) {
  if (!rows || rows.length === 0) {
    alert("엑셀 파일에 유효한 데이터 행이 없습니다.");
    return;
  }

  importedRawRows = rows;
  detectedHeaders = Object.keys(rows[0] || {});

  const statusText = document.getElementById('excelFileStatusText');
  if (statusText) {
    statusText.textContent = `✓ [${fileName}] 총 ${rows.length}개 행이 성공적으로 로드되었습니다.`;
  }

  // 1. AI 컬럼 자동 매핑 실행 (헤더 + 셀 데이터 패턴 종합 추론)
  activeColumnMapping = autoMapColumns(detectedHeaders, importedRawRows);

  // 2. UI 표시
  renderAiMappingFieldsGrid();
  renderExcelPreviewTable();

  const aiBox = document.getElementById('aiMappingContainer');
  if (aiBox) aiBox.classList.remove('hidden');

  const prevBox = document.getElementById('excelPreviewContainer');
  if (prevBox) prevBox.classList.remove('hidden');

  const execBtn = document.getElementById('btnExecuteBatchImport');
  if (execBtn) execBtn.disabled = !activeColumnMapping.room_number;
}

/**
 * AI 스마트 컬럼 매퍼: 엑셀 헤더 및 셀 값 데이터 패턴(휴리스틱)을 종합 추론하여 시스템 필드와 지능적 매칭
 */
export function autoMapColumns(headers, rows = []) {
  const mapping = {};
  const usedHeaders = new Set();
  const sample = (rows && rows.length > 0) ? rows.slice(0, 8) : [];
  let totalScoreSum = 0;
  let fieldScoredCount = 0;

  // 1. 컬럼별 셀 데이터 통계 분석기 (Value Heuristics)
  const headerStats = {};
  headers.forEach(h => {
    const vals = sample.map(r => r[h]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
    headerStats[h] = {
      isRoomLike: vals.length > 0 && vals.every(v => cleanRoomNumber(v) > 0 && cleanRoomNumber(v) < 2000),
      isPhoneLike: vals.length > 0 && vals.some(v => /(?:01[0-9]|02|031|070)[-.\s]?\d{3,4}[-.\s]?\d{4}/.test(String(v))),
      isIdNumberLike: vals.length > 0 && vals.some(v => /^\d{6}[-\s]?[1-4\*\d]\d{6}$|^\d{6}[-\s]?[1-4]\*{6}$|^\d{6}[-\s]?\*{7}$|^\d{6}-\d{7}$|^\d{6}$/.test(String(v).trim())),
      isDateLike: vals.length > 0 && vals.every(v => cleanDateValue(v) && /^\d{4}-\d{2}-\d{2}$/.test(cleanDateValue(v))),
      isMoneyLike: vals.length > 0 && vals.every(v => cleanMoneyValue(v) > 0),
      isLeaseTypeLike: vals.some(v => /월세|전세|반전세|단기|연세|전\/월/i.test(String(v))),
      isPayTimingLike: vals.some(v => /선불|후불|당월|익월/i.test(String(v))),
      isNameLike: vals.some(v => /^[가-힣]{2,4}$/.test(String(v).trim())),
      maxMoney: Math.max(...vals.map(v => cleanMoneyValue(v)), 0)
    };
  });

  SYSTEM_FIELDS.forEach(field => {
    let bestMatchHeader = null;
    let highestScore = 0;

    headers.forEach(h => {
      if (usedHeaders.has(h)) return;
      const normH = String(h).replace(/[\s_\-\(\)\[\]\/]/g, '').toLowerCase();
      const stats = headerStats[h] || {};
      let score = 0;

      // 1) 헤더 텍스트 키워드 유사도 (0~100)
      field.keywords.forEach(keyword => {
        const normK = keyword.replace(/[\s_\-\(\)\[\]\/]/g, '').toLowerCase();
        if (normH === normK) {
          score = Math.max(score, 100);
        } else if (normH.startsWith(normK) || normK.startsWith(normH)) {
          score = Math.max(score, 85);
        } else if (normH.includes(normK)) {
          score = Math.max(score, 70);
        }
      });

      // 2) 값 패턴 가산점 (Heuristic Data Inference)
      if (field.id === 'room_number' && stats.isRoomLike) score += 60;
      if (field.id === 'id_number' && stats.isIdNumberLike) score += 80;
      if (field.id === 'phone' && stats.isPhoneLike) score += 75;
      if (field.id === 'name' && stats.isNameLike) score += 50;
      if (field.id === 'lease_type' && stats.isLeaseTypeLike) score += 70;
      if (field.id === 'pay_timing' && stats.isPayTimingLike) score += 70;
      if ((field.id === 'move_in' || field.id === 'expiry') && stats.isDateLike) score += 50;

      if (field.id === 'deposit' && stats.isMoneyLike) {
        if (stats.maxMoney >= 1000000 || String(h).includes('보증') || String(h).includes('전세')) score += 40;
      }
      if (field.id === 'rent' && stats.isMoneyLike) {
        if ((stats.maxMoney >= 100000 && stats.maxMoney <= 5000000) || String(h).includes('월세') || String(h).includes('차임')) score += 40;
      }
      if (field.id === 'maintenance' && stats.isMoneyLike) {
        if ((stats.maxMoney >= 10000 && stats.maxMoney <= 500000) || String(h).includes('관리비')) score += 40;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatchHeader = h;
      }
    });

    if (bestMatchHeader && highestScore >= 50) {
      mapping[field.id] = bestMatchHeader;
      usedHeaders.add(bestMatchHeader);
      totalScoreSum += Math.min(100, highestScore);
      fieldScoredCount++;
    } else {
      mapping[field.id] = '';
    }
  });

  aiConfidenceScore = fieldScoredCount > 0 ? Math.min(100, Math.round((totalScoreSum / (SYSTEM_FIELDS.length * 80)) * 100)) : 0;
  return mapping;
}

/**
 * AI 매핑 필드 드롭다운 그리드 렌더링
 */
export function renderAiMappingFieldsGrid() {
  const grid = document.getElementById('aiMappingFieldsGrid');
  const badge = document.getElementById('aiMatchRateBadge');
  if (!grid) return;

  let matchedCount = 0;
  SYSTEM_FIELDS.forEach(f => {
    if (activeColumnMapping[f.id]) matchedCount++;
  });

  if (badge) {
    badge.innerHTML = `🤖 AI 매핑 신뢰도: <strong class="text-emerald-300 font-mono font-bold">${aiConfidenceScore}%</strong> (${matchedCount}/${SYSTEM_FIELDS.length}개 필드 자동 매칭)`;
  }

  const html = SYSTEM_FIELDS.map(f => {
    const currentVal = activeColumnMapping[f.id] || '';
    const isMatched = Boolean(currentVal);

    const options = [
      `<option value="" ${!currentVal ? 'selected' : ''}>-- 건너뛰기 --</option>`,
      ...detectedHeaders.map(h => {
        return `<option value="${h}" ${h === currentVal ? 'selected' : ''}>${h}</option>`;
      })
    ].join('');

    return `
      <div class="p-2 rounded-lg border text-xs flex flex-col justify-between gap-1 transition ${
        isMatched 
          ? 'border-emerald-600/70 bg-emerald-950/30' 
          : (f.required ? 'border-rose-700/80 bg-rose-950/20' : 'border-slate-800 bg-surface-900/60')
      }">
        <div class="flex items-center justify-between">
          <span class="font-bold text-slate-200">${f.label}</span>
          ${isMatched ? '<span class="text-[9px] text-emerald-400 font-bold">✓ 일치</span>' : (f.required ? '<span class="text-[9px] text-rose-400 font-bold">필수</span>' : '')}
        </div>
        <select onchange="onMappingFieldChange('${f.id}', this.value)" class="w-full bg-surface-950 border border-slate-700 text-slate-200 rounded px-1.5 py-1 text-xs truncate">
          ${options}
        </select>
      </div>
    `;
  }).join('');

  grid.innerHTML = html;
}

/**
 * 사용자가 컬럼 매핑 드롭다운을 수동 변경할 때 호출
 */
export function onMappingFieldChange(systemField, selectedHeader) {
  activeColumnMapping[systemField] = selectedHeader;
  renderAiMappingFieldsGrid();
  renderExcelPreviewTable();

  const execBtn = document.getElementById('btnExecuteBatchImport');
  if (execBtn) {
    execBtn.disabled = !activeColumnMapping.room_number;
  }
}

/**
 * 실시간 정규화 데이터 미리보기 테이블 렌더링
 */
export function renderExcelPreviewTable() {
  const thead = document.getElementById('excelPreviewThead');
  const tbody = document.getElementById('excelPreviewTbody');
  const countBadge = document.getElementById('excelParsedCountBadge');
  if (!thead || !tbody) return;

  // 1. 월별 수납장부 매트릭스 모드인 경우
  if (activePaymentMatrixRooms && activePaymentMatrixRooms.length > 0) {
    const totalCount = activePaymentMatrixRooms.length;
    if (countBadge) countBadge.textContent = `총 ${totalCount}개 호실 (2025.12 ~ 2026.10월 수납 매트릭스)`;

    thead.innerHTML = `
      <tr class="bg-surface-850 border-b border-slate-700 text-[11px] sticky top-0 z-10">
        <th class="py-1.5 px-2 border-r border-slate-700 text-slate-400 text-center w-8">No</th>
        <th class="py-1.5 px-2 border-r border-slate-700 text-cyan-300 text-center w-12">호실</th>
        <th class="py-1.5 px-2 border-r border-slate-700 text-slate-200 min-w-[70px]">세입자</th>
        <th class="py-1.5 px-1.5 border-r border-slate-700 text-center w-10">선/후</th>
        <th class="py-1.5 px-1.5 border-r border-slate-700 text-center text-slate-300 text-[10px]">25.12</th>
        <th class="py-1.5 px-1.5 border-r border-slate-700 text-center text-slate-300 text-[10px]">1월</th>
        <th class="py-1.5 px-1.5 border-r border-slate-700 text-center text-slate-300 text-[10px]">2월</th>
        <th class="py-1.5 px-1.5 border-r border-slate-700 text-center text-slate-300 text-[10px]">3월</th>
        <th class="py-1.5 px-1.5 border-r border-slate-700 text-center text-slate-300 text-[10px]">4월</th>
        <th class="py-1.5 px-1.5 border-r border-slate-700 text-center text-slate-300 text-[10px]">5월</th>
        <th class="py-1.5 px-1.5 border-r border-slate-700 text-center text-slate-300 text-[10px]">6월</th>
        <th class="py-1.5 px-1.5 border-r border-slate-700 text-center text-slate-300 text-[10px]">7월</th>
        <th class="py-1.5 px-1.5 border-r border-slate-700 text-center text-slate-300 text-[10px]">8월</th>
        <th class="py-1.5 px-1.5 border-r border-slate-700 text-center text-slate-300 text-[10px]">9월</th>
        <th class="py-1.5 px-1.5 border-r border-slate-700 text-center text-slate-300 text-[10px]">10월</th>
        <th class="py-1.5 px-2 text-right text-emerald-400 font-bold min-w-[85px]">완납합계</th>
      </tr>
    `;

    tbody.innerHTML = activePaymentMatrixRooms.map((r, idx) => {
      const monthCols = r.payments.map(p => {
        if (p.paid) {
          const dShort = p.paid_date ? p.paid_date.slice(5) : '';
          return `
            <td class="py-1 px-1 border-r border-slate-800 text-center text-[10px] font-mono">
              <span class="text-emerald-300 font-semibold block">${(p.amount / 10000).toFixed(0)}만</span>
              <span class="text-slate-500 text-[9px] block">${dShort}</span>
            </td>
          `;
        } else {
          const noteText = p.note ? `<span class="text-amber-400 text-[9px] block truncate max-w-[42px]">${p.note}</span>` : '<span class="text-slate-600 block">-</span>';
          return `
            <td class="py-1 px-1 border-r border-slate-800 text-center text-[10px] bg-slate-900/40">
              ${noteText}
            </td>
          `;
        }
      }).join('');

      return `
        <tr class="hover:bg-surface-800/60 border-b border-slate-800/50">
          <td class="py-1.5 px-1.5 border-r border-slate-800 text-center text-slate-500 text-[10px]">${idx + 1}</td>
          <td class="py-1.5 px-1.5 border-r border-slate-800 font-bold text-cyan-300 text-center font-mono text-xs">${r.room_number}호</td>
          <td class="py-1.5 px-2 border-r border-slate-800 text-slate-100 font-medium text-xs whitespace-nowrap">${r.name || '공실'}</td>
          <td class="py-1.5 px-1 border-r border-slate-800 text-center text-[10px] text-slate-400">${r.pay_timing}</td>
          ${monthCols}
          <td class="py-1.5 px-2 text-right font-mono font-bold text-emerald-300 text-xs">${Number(r.total_paid || 0).toLocaleString()}원</td>
        </tr>
      `;
    }).join('');
    return;
  }

  // 2. 표준 계약대장 모드
  const previewRows = importedRawRows;
  const totalCount = importedRawRows.length;
  if (countBadge) countBadge.textContent = `총 ${totalCount}개 호실 매핑 (전체 ${totalCount}행 표시)`;

  // 테이블 헤더
  thead.innerHTML = `
    <tr class="bg-surface-850 border-b border-slate-700 text-[11px] sticky top-0 z-10">
      <th class="py-1.5 px-2 border-r border-slate-700 text-slate-400 text-center w-8">No</th>
      <th class="py-1.5 px-2 border-r border-slate-700 text-cyan-300 text-center w-14">호실</th>
      <th class="py-1.5 px-2 border-r border-slate-700 text-slate-200">세입자</th>
      <th class="py-1.5 px-2 border-r border-slate-700 text-slate-300 text-center">주민번호</th>
      <th class="py-1.5 px-2 border-r border-slate-700 text-slate-300 text-center">연락처</th>
      <th class="py-1.5 px-1.5 border-r border-slate-700 text-slate-300 text-center">유형</th>
      <th class="py-1.5 px-2 border-r border-slate-700 text-right">보증금</th>
      <th class="py-1.5 px-2 border-r border-slate-700 text-right text-amber-300">월세</th>
      <th class="py-1.5 px-2 border-r border-slate-700 text-right">관리비</th>
      <th class="py-1.5 px-2 border-r border-slate-700 text-center">계약시작(전입일)</th>
      <th class="py-1.5 px-2 text-center">계약종료</th>
    </tr>
  `;

  // 테이블 본문
  tbody.innerHTML = previewRows.map((row, idx) => {
    const rNum = cleanRoomNumber(row[activeColumnMapping.room_number]);
    const name = (row[activeColumnMapping.name] !== undefined ? String(row[activeColumnMapping.name]).trim() : '') || '공실';
    const idNum = (row[activeColumnMapping.id_number] !== undefined ? String(row[activeColumnMapping.id_number]).trim() : '') || '-';
    const phone = row[activeColumnMapping.phone] || '-';
    const leaseType = row[activeColumnMapping.lease_type] || '월세';
    const deposit = cleanMoneyValue(row[activeColumnMapping.deposit], activeColumnMapping.deposit);
    const rent = cleanMoneyValue(row[activeColumnMapping.rent], activeColumnMapping.rent);
    const maint = cleanMoneyValue(row[activeColumnMapping.maintenance], activeColumnMapping.maintenance);
    const moveIn = cleanDateValue(row[activeColumnMapping.move_in]);
    const expiry = cleanDateValue(row[activeColumnMapping.expiry]);

    return `
      <tr class="hover:bg-surface-800/60 border-b border-slate-800/50">
        <td class="py-1.5 px-2 border-r border-slate-800 text-center text-slate-500 text-[10px]">${idx + 1}</td>
        <td class="py-1.5 px-2 border-r border-slate-800 font-bold text-cyan-300 text-center font-mono">${rNum ? `${rNum}호` : '<span class="text-rose-400 font-normal">누락</span>'}</td>
        <td class="py-1.5 px-2 border-r border-slate-800 font-sans ${name === '공실' ? 'text-slate-500' : 'text-slate-100 font-medium'}">${name}</td>
        <td class="py-1.5 px-2 border-r border-slate-800 text-center text-slate-400 font-mono text-[11px]">${idNum}</td>
        <td class="py-1.5 px-2 border-r border-slate-800 text-center text-slate-400 text-[11px]">${phone}</td>
        <td class="py-1.5 px-1.5 border-r border-slate-800 text-center text-slate-300 text-[11px]">${leaseType}</td>
        <td class="py-1.5 px-2 border-r border-slate-800 text-right font-mono text-slate-300">${deposit.toLocaleString()}</td>
        <td class="py-1.5 px-2 border-r border-slate-800 text-right font-mono font-bold text-amber-300">${rent.toLocaleString()}</td>
        <td class="py-1.5 px-2 border-r border-slate-800 text-right font-mono text-slate-300">${maint.toLocaleString()}</td>
        <td class="py-1.5 px-2 border-r border-slate-800 text-center text-slate-300 text-[11px]">${moveIn || '-'}</td>
        <td class="py-1.5 px-2 text-center text-slate-400 text-[11px]">${expiry || '-'}</td>
      </tr>
    `;
  }).join('');
}

/**
 * 호실 번호 지능형 추출 ('201호' -> 201)
 */
function cleanRoomNumber(val) {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val).trim();
  const match = str.match(/\d+/);
  return match ? Number(match[0]) : '';
}

/**
 * 금액 지능형 자동 정제 (만원 단위 감지 및 환산)
 */
function cleanMoneyValue(val, headerName = '') {
  if (val === undefined || val === null || val === '') return 0;
  let numStr = String(val).replace(/[^0-9.-]/g, '');
  let num = parseFloat(numStr);
  if (isNaN(num)) return 0;

  // 컬럼명에 '만원'이 들어있거나, 단위가 1000 미만의 정수인 경우 (예: 보증금 500, 월세 45) -> 만원 단위로 판단하여 10,000 곱함
  const isManWonHeader = headerName && String(headerName).includes('만원');
  if (isManWonHeader || (num > 0 && num < 1000 && Number.isInteger(num))) {
    num = num * 10000;
  }
  return Math.round(num);
}

/**
 * 날짜 지능형 정제 (엑셀 시리얼 번호 및 다양한 날짜 포맷 -> YYYY-MM-DD)
 */
function cleanDateValue(val) {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // 엑셀 시리얼 넘버인 경우 (예: 46083)
  const num = Number(str);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    try {
      const utc_days = Math.floor(num - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      return date_info.toISOString().split('T')[0];
    } catch (e) {
      return str;
    }
  }

  // 지능형 정제 (2026. 6. 8, 2026/06/08, 2026.06.08, 2026년 6월 8일 등)
  const comp = parseDateComponents(str);
  if (comp) {
    return comp.formatted;
  }

  return str;
}

/**
 * 엑셀 데이터 일괄 등록 실행
 */
export async function executeBatchImport() {
  if (activePaymentMatrixRooms && activePaymentMatrixRooms.length > 0) {
    const confirmMsg = `총 ${activePaymentMatrixRooms.length}개 호실의 2025.12 ~ 2026.10월 월별 수납 내역을 현재 건물에 일괄 반영하시겠습니까?`;
    if (!confirm(confirmMsg)) return;

    let serverSynced = false;
    let serverWarning = '';

    try {
      if (state.isOnline) {
        try {
          await apiBatchImportPaymentMatrix(activePaymentMatrixRooms, state.currentBranch);
          serverSynced = true;
        } catch (errApi) {
          console.warn("서버 수납장부 매트릭스 전송 지연:", errApi);
          serverWarning = errApi.message || '서버 응답 지연';
        }
      }

      // 로컬 state.rooms 동기화
      activePaymentMatrixRooms.forEach(pm => {
        const room = state.rooms[pm.room_number];
        if (room) {
          if (pm.name && !room.name) room.name = pm.name;
          if (pm.pay_timing) room.pay_timing = pm.pay_timing;
          if (!room.payments) room.payments = {};
          pm.payments.forEach(p => {
            const payObj = {
              month: p.month,
              year: p.year,
              paid: p.paid,
              paid_date: p.paid_date,
              rent_amount: room.lease_type === '전세' ? 0 : (p.paid ? (p.amount - Math.min(room.maintenance, p.amount)) : room.rent),
              maintenance_amount: p.paid ? Math.min(room.maintenance, p.amount) : room.maintenance,
              note: p.note,
              tenant_name: pm.name || room.name,
              is_previous_tenant: false
            };
            room.payments[p.month] = payObj;
            room.payments[`${p.year}-${p.month}`] = payObj;
          });
        }
      });

      saveLocalFallback();
      closeModal('excelImportModal');
      renderAll();

      if (serverSynced) {
        alert(`🎉 총 ${activePaymentMatrixRooms.length}개 호실의 2025.12~2026.10월 월별 수납장부가 실서버 DB에 성공적으로 일괄 반영되었습니다!`);
      } else {
        alert(`⚡ 총 ${activePaymentMatrixRooms.length}개 호실의 수납장부가 화면 및 브라우저에 안전하게 저장되었습니다.\n(서버 일시 지연: ${serverWarning})`);
      }
      activePaymentMatrixRooms = null;
    } catch (err) {
      alert("수납장부 일괄 등록 오류: " + err.message);
    }
    return;
  }

  if (!activeColumnMapping.room_number) {
    alert("호실 번호에 해당하는 엑셀 컬럼을 선택해주세요.");
    return;
  }

  const targetRooms = [];
  importedRawRows.forEach(row => {
    const rNum = cleanRoomNumber(row[activeColumnMapping.room_number]);
    if (!rNum) return;

    const incomingId = (row[activeColumnMapping.id_number] !== undefined ? String(row[activeColumnMapping.id_number]).trim() : '');
    const existingRoom = state.rooms[rNum];
    // 기존 호실에 등록된 주민번호가 있고 엑셀에 주민번호가 없거나 비어있는 경우 기존 주민번호 보존!
    const finalId = incomingId || (existingRoom && existingRoom.id_number ? existingRoom.id_number : '');

    targetRooms.push({
      room_number: rNum,
      name: (row[activeColumnMapping.name] !== undefined ? String(row[activeColumnMapping.name]).trim() : '') || (existingRoom ? existingRoom.name : '공실'),
      id_number: finalId,
      phone: (row[activeColumnMapping.phone] !== undefined ? String(row[activeColumnMapping.phone]).trim() : '') || (existingRoom ? existingRoom.phone : ''),
      lease_type: (row[activeColumnMapping.lease_type] && String(row[activeColumnMapping.lease_type]).includes('전세')) ? '전세' : (row[activeColumnMapping.lease_type] ? '월세' : (existingRoom ? existingRoom.lease_type : '월세')),
      deposit: cleanMoneyValue(row[activeColumnMapping.deposit], activeColumnMapping.deposit) || (existingRoom ? existingRoom.deposit : 0),
      rent: cleanMoneyValue(row[activeColumnMapping.rent], activeColumnMapping.rent) || (existingRoom ? existingRoom.rent : 0),
      maintenance: cleanMoneyValue(row[activeColumnMapping.maintenance], activeColumnMapping.maintenance) || (existingRoom ? existingRoom.maintenance : 0),
      pay_timing: (row[activeColumnMapping.pay_timing] && String(row[activeColumnMapping.pay_timing]).includes('선불')) ? '선불' : '후불',
      move_in: cleanDateValue(row[activeColumnMapping.move_in]) || (existingRoom ? existingRoom.move_in : ''),
      expiry: cleanDateValue(row[activeColumnMapping.expiry]) || (existingRoom ? existingRoom.expiry : ''),
      memo: row[activeColumnMapping.memo] || ''
    });
  });

  if (targetRooms.length === 0) {
    alert("인식된 호실 데이터가 없습니다.");
    return;
  }

  const chkClear = document.getElementById('chkClearExistingRooms');
  const shouldClear = chkClear ? chkClear.checked : true;

  const confirmMsg = shouldClear
    ? `총 ${targetRooms.length}개 호실의 임대차 계약 정보를 현재 건물에 등록하시겠습니까?\n\n⚠️ [초기화 후 등록]\n기존 잔여 호실(시크빌 등)을 모두 비우고, 엑셀/CSV에 있는 ${targetRooms.length}개 호실만 정확하게 새로 등록됩니다.`
    : `총 ${targetRooms.length}개 호실의 임대차 계약 정보를 현재 건물에 일괄 적용하시겠습니까?\n기존 호실 정보는 엑셀 데이터로 갱신됩니다.`;
  if (!confirm(confirmMsg)) return;

  let serverSynced = false;
  let serverWarning = '';

  try {
    if (state.isOnline) {
      try {
        await apiBatchImportRooms(targetRooms, state.currentBranch, shouldClear);
        serverSynced = true;
      } catch (errApi) {
        console.warn("서버 일괄 등록 전송 일시 지연/오류:", errApi);
        serverWarning = errApi.message || '서버 응답 지연 (502)';
      }
    }

    // 초기화 옵션 활성화 시 로컬 state.rooms를 완전히 비우고 등록 대상 호실로만 교체
    if (shouldClear) {
      state.rooms = {};
      state.selectedRoom = targetRooms[0] ? targetRooms[0].room_number : 101;
    }

    // 로컬 상태 동기화 업데이트 및 과거 납부 내역 자동 동기화 (항상 안전하게 보존)
    targetRooms.forEach(tr => {
      const existing = state.rooms[tr.room_number] || { payments: {} };
      state.rooms[tr.room_number] = {
        ...existing,
        ...tr,
        id_number: tr.id_number || (existing && existing.id_number ? existing.id_number : ''),
        room_number: tr.room_number,
        branch_id: state.currentBranch
      };
      // 새로 등록된 세입자명, 금액, 전입일로 과거 납부 내역 즉시 동기화
      fillTenantPaymentsState(tr.room_number);
    });

    if (serverSynced) {
      try {
        await apiFillTenantPayments(null, state.currentBranch);
      } catch (errFill) {
        console.warn("서버 납부내역 일괄 동기화 실패:", errFill);
      }
    }

    saveLocalFallback();
    closeModal('excelImportModal');
    renderAll();

    if (serverSynced) {
      alert(`🎉 총 ${targetRooms.length}개 호실의 임대차 계약 정보가 성공적으로 일괄 등록되었습니다!`);
    } else {
      alert(`⚡ 총 ${targetRooms.length}개 호실의 계약 정보가 화면 및 브라우저에 안전하게 저장되었습니다.\n(서버 일시 지연: ${serverWarning}\n자동 재동기화가 진행됩니다.)`);
    }
  } catch (err) {
    console.error("일괄 등록 오류:", err);
    alert("일괄 등록 처리 중 오류 발생: " + err.message);
  }
}

/**
 * 표준 엑셀 샘플 서식 CSV 파일 다운로드
 */
export function downloadSampleExcelTemplate(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  let csv = "\uFEFF"; // UTF-8 BOM
  csv += "호실,세입자,주민번호,연락처,임대유형,보증금,월세,관리비,납부방식,계약시작일,계약종료일,비고\n";
  csv += "101,홍길동,910512-1******,010-1234-5678,월세,5000000,480000,50000,후불,2026-01-01,2027-01-01,관리실 협의\n";
  csv += "201,장지아,960319-2******,010-9876-5432,월세,5000000,480000,50000,후불,2026-03-01,2027-03-01,\n";
  csv += "202,이민준,930512-1******,010-3333-4444,전세,65000000,0,50000,선불,2025-06-01,2027-06-01,전세 계약\n";
  csv += "203,박수현,940512-2******,010-5555-6666,월세,5000000,500000,50000,후불,2026-02-15,2027-02-15,\n";

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `원룸_임대차계약_표준샘플서식.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 현재 건물의 전체 호실 계약 대장 및 수납 현황 통합 CSV 백업 내보내기
 */
export function exportAllRoomsCSV(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  const branchName = ((state.branches || []).find(b => b.branch_id === state.currentBranch)?.name) || state.currentBranch;
  let csv = "\uFEFF"; // UTF-8 BOM
  csv += `호실,세입자,주민번호,연락처,임대유형,보증금,월세,관리비,납부방식,전입일,만기일,당월(${currentMonth}월)수납상태,수납일시,비고\n`;

  const roomNums = Object.keys(state.rooms).map(Number).sort((a, b) => a - b);
  roomNums.forEach(rNum => {
    const r = state.rooms[rNum];
    const pCur = (r.payments && r.payments[currentMonth]) || {};
    const statusText = pCur.paid ? '완납' : '미납';
    const paidAt = pCur.paid_date || '-';

    csv += `"${rNum}","${r.name || '공실'}","${r.id_number || '-'}","${r.phone || '-'}","${r.lease_type || '월세'}",${r.deposit || 0},${r.rent || 0},${r.maintenance || 0},"${r.pay_timing || '후불'}","${r.move_in || '-'}","${r.expiry || '-'}","${statusText}","${paidAt}","${r.memo || ''}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const todayStr = new Date().toISOString().split('T')[0];
  link.setAttribute("href", url);
  link.setAttribute("download", `임대계약대장_${branchName}_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 💾 전체 데이터 통합 백업 (스마트폰/PC 파일로 영구 다운로드 저장)
export async function exportFullSystemBackupJSON(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  const branchName = ((state.branches || []).find(b => b.branch_id === state.currentBranch)?.name) || '시크빌';
  const now = new Date();
  const timeTag = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
  const cleanBranch = (branchName || '시크빌').replace(/[^\w가-힣0-9_-]/g, '_');
  const filename = `${cleanBranch}_전체백업_${timeTag}.json`;
  const deviceName = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? '스마트폰 [다운로드] 폴더' : 'PC [다운로드] 폴더';

  // 온라인 환경: Chrome/Edge 브라우저 난수 UUID 버그를 원천 차단하는 서버 직접 스트리밍 다운로드
  if (state.isOnline) {
    const downloadUrl = `/api/rent/backup/download?branch_id=${encodeURIComponent(state.currentBranch || 'main')}&_t=${Date.now()}`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (a.parentNode) document.body.removeChild(a);
      } catch (_) {}
    }, 1500);

    alert(`💾 전체 데이터 통합 백업 다운로드가 시작되었습니다!\n\n📁 파일명: ${filename}\n📌 저장 위치: 지금 사용 중이신 ${deviceName}\n\n📦 백업된 전체 데이터 내역:\n- 29개실 전체 계약대장\n- 1월~12월 수납 내역 (전체 장부)\n- 지출 관리 장부 내역\n- 전출자 1년 보존 이력`);
    return;
  }

  // 오프라인 로컬 저장소 폴백
  const backupPayload = {
    version: "3.0",
    system: "MQnet Rent SaaS Edition",
    backup_type: "FULL_SYSTEM_BACKUP",
    exported_at: now.toISOString(),
    exported_at_formatted: now.toLocaleString('ko-KR'),
    branch_id: state.currentBranch,
    branch_name: branchName,
    rooms_count: Object.keys(state.rooms || {}).length,
    expenses_count: (state.expenses || []).length,
    tenant_histories_count: (state.tenantHistories || []).length,
    data: {
      rooms: state.rooms,
      expenses: state.expenses,
      tenantHistories: state.tenantHistories
    }
  };

  const jsonStr = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });

  if (window.navigator && window.navigator.msSaveOrOpenBlob) {
    window.navigator.msSaveOrOpenBlob(blob, filename);
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 10000);
  }

  alert(`💾 전체 데이터 통합 백업 파일이 저장되었습니다!\n\n📁 파일명: ${filename}\n📌 저장 위치: 지금 사용 중이신 ${deviceName}\n\n📦 백업된 전체 데이터 내역:\n- 29개실 전체 계약대장\n- 1월~12월 수납 내역 (전체 장부)\n- 지출 관리 장부 내역\n- 전출자 1년 보존 이력`);
}

// 📂 내 폰/PC 백업 파일 선택 열기
export function triggerFullSystemRestoreFile() {
  const input = document.getElementById('fullBackupRestoreInput');
  if (input) input.click();
}

// 📂 내 폰/PC 백업 파일로부터 전체 데이터 복원
export async function handleFullSystemRestoreFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target.result;
      const backup = JSON.parse(content);

      if (!backup.data || !backup.data.rooms) {
        throw new Error("올바른 전체 백업 JSON 파일 형식이 아닙니다.");
      }

      const backupBranchName = backup.branch_name || backup.branch_id || '시크빌';
      const currentBranchObj = (state.branches || []).find(b => b.branch_id === state.currentBranch);
      const currentBranchName = currentBranchObj ? currentBranchObj.name : (state.currentBranch || '현재 건물');

      let confirmMsg = `[${backup.exported_at_formatted || backup.exported_at || '알 수 없음'}]에 생성된 백업 파일입니다.\n\n`;
      if (backup.branch_id && state.currentBranch && backup.branch_id !== state.currentBranch) {
        confirmMsg += `🏢 백업 파일 원본 건물: [${backupBranchName}]\n🎯 복원 대상 선택 건물: [${currentBranchName}]\n\n👉 [${currentBranchName}] 건물에 이 백업 데이터를 복원/적용하시겠습니까?\n(다른 건물 자료도 현재 건물로 안전하게 복구할 수 있습니다!)\n\n`;
      } else {
        confirmMsg += `건물명: ${currentBranchName}\n\n`;
      }
      confirmMsg += `- 29개실 호실 및 12개월 수납 내역\n`;
      confirmMsg += `- 지출 내역: ${backup.expenses_count || (backup.data.expenses || []).length}건\n`;
      confirmMsg += `- 전출 이력: ${backup.tenant_histories_count || (backup.data.tenantHistories || []).length}건\n\n`;
      confirmMsg += `이 백업 파일로 시스템 전체 데이터를 복원하시겠습니까?`;

      const ok = confirm(confirmMsg);
      if (!ok) {
        event.target.value = '';
        return;
      }

      // 서버 DB 동기화 (원자적 단 1회 호출)
      if (state.isOnline) {
        const res = await apiRestoreBackup(backup, state.currentBranch);
        if (res) {
          if (res.rooms) state.rooms = res.rooms;
          if (res.expenses) state.expenses = res.expenses;
          if (res.tenantHistories) state.tenantHistories = res.tenantHistories;
        }
      } else {
        // 오프라인 로컬 저장소 폴백
        state.rooms = backup.data.rooms;
        if (backup.data.expenses) state.expenses = backup.data.expenses;
        if (backup.data.tenantHistories) state.tenantHistories = backup.data.tenantHistories;
      }

      saveLocalFallback();
      if (state.selectedRoom) {
        populateModalRoomSelector(state.selectedRoom);
        loadRoomIntoContractModal(state.selectedRoom);
      }
      renderAll();

      alert(`🎉 [${currentBranchName}] 건물에 전체 데이터가 성공적으로 복원되었습니다!\n\n(백업 시점: ${backup.exported_at_formatted || backup.exported_at})\n- 29개실 호실 및 12개월 장부 복원 완료\n- 지출 및 전출자 이력 동기화 완료`);
    } catch (err) {
      alert("백업 파일 복원 실패: " + err.message);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file, "UTF-8");
}

// ── 보안 관리자 로그인 & 14일 슬라이딩 세션 제어 ──
export function updateAdminProfileUI() {
  const nameEl = document.getElementById('drawerAdminName');
  const roleEl = document.getElementById('drawerAdminRole');
  const sessionEl = document.getElementById('drawerAdminSessionText');
  const cancelBtn = document.getElementById('securityModalCancelBtn');
  const headerRoleBadge = document.getElementById('headerRoleBadge');

  if (state.currentUser) {
    touchAuthSession(); // UI 갱신 시 활동 감지 및 14일 슬라이딩 연장
    const isSuper = (state.currentUser.role === 'superadmin');
    if (nameEl) nameEl.textContent = state.currentUser.name || state.currentUser.username || '관리자';
    if (roleEl) {
      const roleMap = {
        'superadmin': '👑 본사 총괄 최고관리자 (전권)',
        'branch_admin': '🏢 지점/원룸 점주실장',
        'tenant': '입주자'
      };
      roleEl.textContent = roleMap[state.currentUser.role] || state.currentUser.role || '인증 완료';
    }
    if (sessionEl) {
      const info = getAuthSessionInfo();
      sessionEl.innerHTML = info ? `🟢 <strong class="text-emerald-300">14일 자동유지</strong> (${info.days}일 남음 · 접속시 자동연장)` : '🟢 14일간 로그인 유지 중';
    }
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    if (headerRoleBadge) {
      if (isSuper) {
        headerRoleBadge.innerHTML = `
          <span class="px-2 py-1 rounded-xl bg-purple-950/90 border border-purple-500/80 text-purple-200 text-[10px] sm:text-xs font-black flex items-center gap-1 shadow-sm hover:border-purple-400 transition">
            <span>🏛️</span>
            <span>HQ admin</span>
            <span class="text-[9px] bg-purple-500/40 text-purple-200 px-1 rounded font-normal">전권</span>
          </span>
        `;
      } else {
        headerRoleBadge.innerHTML = `
          <span class="px-2 py-1 rounded-xl bg-cyan-950/90 border border-cyan-500/70 text-cyan-200 text-[10px] sm:text-xs font-bold flex items-center gap-1 shadow-sm hover:border-cyan-400 transition">
            <span>🏢</span>
            <span>${state.currentUser.username || '점주'}</span>
          </span>
        `;
      }
    }
  } else {
    if (nameEl) nameEl.textContent = '로그인이 필요합니다';
    if (roleEl) roleEl.textContent = '미인증 상태 (보안 잠금)';
    if (sessionEl) sessionEl.textContent = '🔒 미접속 상태';
    if (cancelBtn) cancelBtn.style.display = 'none';

    if (headerRoleBadge) {
      headerRoleBadge.innerHTML = `
        <span class="px-2 py-1 rounded-xl bg-surface-800/80 hover:bg-surface-700/80 border border-slate-700 text-slate-300 text-[10px] sm:text-xs font-semibold flex items-center gap-1 transition">
          <span>🔒</span>
          <span>로그인</span>
        </span>
      `;
    }
  }
}

export function openLoginSecurityModal(canClose = false) {
  const modal = document.getElementById('loginSecurityModal');
  if (!modal) return;
  const errMsg = document.getElementById('loginErrMsg') || document.getElementById('secLoginError');
  if (errMsg) {
    errMsg.classList.add('hidden');
    errMsg.textContent = '';
  }

  const cancelBtn = document.getElementById('securityModalCancelBtn');
  if (cancelBtn) {
    cancelBtn.style.display = (canClose || state.currentUser) ? 'inline-block' : 'none';
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // 자동 포커스
  const userInput = document.getElementById('secUsername') || document.getElementById('loginUsername');
  if (userInput) userInput.focus();
}

export const openAdminModal = openLoginSecurityModal;

export function closeLoginSecurityModal() {
  const modal = document.getElementById('loginSecurityModal');
  if (modal) {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
  }
}

export function openRegisterModal() {
  const sel = document.getElementById('regTargetBranch');
  if (sel) {
    sel.innerHTML = '<option value="">(신규 건물 또는 미정 - 본사 지정)</option>';
    (state.branches || []).forEach(b => {
      sel.innerHTML += `<option value="${b.branch_id}">${b.name}</option>`;
    });
  }
  document.getElementById('registerForm')?.reset();
  const errMsg = document.getElementById('regError');
  if (errMsg) {
    errMsg.classList.add('hidden');
    errMsg.textContent = '';
  }
  closeLoginSecurityModal();
  openModal('registerModal');
}

export async function handleRegisterSubmit(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const username = document.getElementById('regUsername')?.value.trim();
  const password = document.getElementById('regPassword')?.value.trim();
  const name = document.getElementById('regName')?.value.trim();
  const phone = document.getElementById('regPhone')?.value.trim();
  const branchId = document.getElementById('regTargetBranch')?.value.trim() || null;
  const reason = document.getElementById('regReason')?.value.trim() || null;
  const errEl = document.getElementById('regError');
  const submitBtn = document.getElementById('btnRegSubmit');

  if (!username || !password || !name) {
    if (errEl) {
      errEl.textContent = '아이디, 비밀번호, 성명은 필수 입력 항목입니다.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '가입 신청 전송 중...';
  }
  if (errEl) errEl.classList.add('hidden');

  try {
    const res = await apiRegisterUser({
      username,
      password,
      name,
      phone,
      assigned_branch_id: branchId,
      reason
    });

    closeModal('registerModal');
    alert(res.message || '가입 신청이 정상 접수되었습니다. 본사 관리자(admin) 승인 후 로그인하실 수 있습니다.');
    openLoginSecurityModal(false);
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message || '가입 신청 중 오류가 발생했습니다.';
      errEl.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '📝 관리자 가입 신청 제출';
    }
  }
}

export function fillQuickLogin(username, password) {
  const uEl = document.getElementById('loginUsername') || document.getElementById('secUsername');
  const pEl = document.getElementById('loginPassword') || document.getElementById('secPassword');
  if (uEl) uEl.value = username;
  if (pEl) pEl.value = password;
  const submitBtn = document.getElementById('loginSubmitBtn') || document.getElementById('btnSecLoginSubmit');
  if (submitBtn) submitBtn.focus();
}

export async function handleSecurityLoginSubmit(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  const uEl = document.getElementById('loginUsername') || document.getElementById('secUsername');
  const pEl = document.getElementById('loginPassword') || document.getElementById('secPassword');
  const errMsg = document.getElementById('loginErrMsg') || document.getElementById('secLoginError');
  const submitBtn = document.getElementById('loginSubmitBtn') || document.getElementById('btnSecLoginSubmit');

  const username = (uEl ? uEl.value : '').trim();
  const password = (pEl ? pEl.value : '').trim();

  if (!username || !password) {
    if (errMsg) {
      errMsg.textContent = '아이디와 비밀번호를 모두 입력해주세요.';
      errMsg.classList.remove('hidden');
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '보안 인증 검증 중...';
  }
  if (errMsg) {
    errMsg.classList.add('hidden');
  }

  try {
    let authResult = null;
    try {
      authResult = await apiAdminLogin(username, password);
    } catch (apiErr) {
      const errMsgStr = apiErr.message || '';
      // 서버에서 전달된 승인/상태 에러는 바로 그대로 상위로 throw
      if (errMsgStr.includes('승인 대기') || errMsgStr.includes('거절') || errMsgStr.includes('비활성화') || errMsgStr.includes('비밀번호')) {
        throw apiErr;
      }
      console.warn('API 로그인 호출 실패, 로컬 비상 인증 규칙 점검:', apiErr);
      // 서버 오프라인 비상 접속: admin / 1212 만 허용
      if (username === 'admin' && password === '1212') {
        authResult = { success: true, role: 'superadmin', name: '본사 총괄 최고관리자', branch_id: null };
      } else {
        throw apiErr;
      }
    }

    if (authResult && authResult.success) {
      const targetBranchId = authResult.assigned_branch_id || authResult.branch_id || null;
      const user = {
        username: username,
        name: authResult.name || username,
        role: authResult.role || 'branch_admin',
        branch_id: targetBranchId,
        loginAt: new Date().toISOString()
      };

      setAuthUser(user);
      updateAdminProfileUI();
      closeLoginSecurityModal();

      if (user.role === 'superadmin' && authResult.redirect_url && !window.location.pathname.includes('branches.html')) {
        const banner = document.createElement('div');
        banner.className = 'fixed top-5 right-5 z-[9999] bg-purple-600 text-white px-4 py-3 rounded-xl shadow-xl font-medium text-xs sm:text-sm flex items-center gap-2';
        banner.innerHTML = `<span>🏛️ <strong>본사 관리 센터(/branches.html)</strong>로 자동 이동합니다...</span>`;
        document.body.appendChild(banner);
        setTimeout(() => {
          window.location.href = authResult.redirect_url;
        }, 500);
        return;
      }

      if (targetBranchId && targetBranchId !== state.currentBranchId) {
        await switchBranch(targetBranchId);
      } else {
        renderAll();
      }

      // 성공 안내 토스트/알림
      const banner = document.createElement('div');
      banner.className = 'fixed top-5 right-5 z-[9999] bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl font-medium text-xs sm:text-sm animate-bounce flex items-center gap-2';
      banner.innerHTML = `<span>🛡️ <strong>${user.name}</strong> 님 정상 인증되었습니다.</span>`;
      document.body.appendChild(banner);
      setTimeout(() => banner.remove(), 3200);
    } else {
      throw new Error(authResult?.message || '인증에 실패하였습니다.');
    }
  } catch (err) {
    if (errMsg) {
      errMsg.textContent = err.message || '인증 처리 중 오류가 발생했습니다.';
      errMsg.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '보안 인증 및 로그인';
    }
  }
}

/**
 * 원터치 즉시 로그아웃: 번거로운 다이얼로그 없이 1터치로 안전하게 세션을 종료하고 잠금
 */
export function handleOneTouchLogout(forceWithoutConfirm = true) {
  if (forceWithoutConfirm || confirm('보안 관리 세션을 종료하고 로그아웃하시겠습니까?')) {
    clearAuthUser();
    updateAdminProfileUI();
    
    // 메뉴 드로어가 열려있다면 닫기
    const drawer = document.getElementById('leftMenuDrawer');
    const backdrop = document.getElementById('menuDrawerBackdrop');
    if (drawer) drawer.classList.add('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');

    openLoginSecurityModal(false);

    // 알림 토스트
    const banner = document.createElement('div');
    banner.className = 'fixed top-5 right-5 z-[9999] bg-slate-850 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl shadow-xl font-medium text-xs sm:text-sm flex items-center gap-2';
    banner.innerHTML = `<span>🔒 <strong>원터치 로그아웃 완료</strong> (보안을 위해 화면이 잠겼습니다)</span>`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 2500);
  }
}

export function handleLogout() {
  handleOneTouchLogout(true);
}

// ══════════════════════════════════════════════════════════════════════
// 9. 은행 입금 알림 문자 자동 인식 & 수납 처리 및 영수증 전송 모듈
// ══════════════════════════════════════════════════════════════════════

export function updateSmsAlert(type, title, message) {
  const alertEl = document.getElementById('smsProcessResultAlert');
  if (!alertEl) return;

  if (!type || !title) {
    alertEl.innerHTML = '';
    alertEl.className = 'hidden';
    return;
  }

  let styleClasses = '';
  let icon = 'ℹ️';

  if (type === 'error') {
    styleClasses = 'bg-rose-950/70 border-rose-600/70 text-rose-200';
    icon = '❌';
  } else if (type === 'warning') {
    styleClasses = 'bg-amber-950/60 border-amber-500/60 text-amber-200';
    icon = '⚠️';
  } else if (type === 'diff') {
    styleClasses = 'bg-orange-950/50 border-orange-500/50 text-orange-200';
    icon = '⚖️';
  } else if (type === 'success') {
    styleClasses = 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200';
    icon = '✅';
  } else {
    styleClasses = 'bg-cyan-950/50 border-cyan-500/50 text-cyan-200';
    icon = 'ℹ️';
  }

  alertEl.className = `p-3 rounded-2xl border text-xs flex items-start gap-2.5 transition animate-in fade-in duration-200 ${styleClasses}`;
  alertEl.innerHTML = `
    <span class="text-base shrink-0 select-none">${icon}</span>
    <div class="leading-relaxed flex-1">
      <strong class="font-bold block mb-0.5 text-[12px]">${title}</strong>
      <div class="text-[11px] opacity-90">${message}</div>
    </div>
  `;
}

export function openSmsDepositModal() {
  openModal('smsDepositModal');
  updateSmsAlert(null);
  
  // 29개실 셀렉트박스 옵션 채우기 (첫 번째에 선택 필요 기본 안내 배치)
  const roomSelect = document.getElementById('smsDetectedRoom');
  if (roomSelect) {
    roomSelect.innerHTML = '<option value="">⚠️ [호실 선택 필요 - 직접 선택]</option>';
    ROOM_NUMBERS.forEach(rNum => {
      const opt = document.createElement('option');
      opt.value = rNum;
      const r = state.rooms[rNum];
      opt.textContent = `${rNum}호${r && r.name ? ' (' + r.name + ')' : ''}`;
      roomSelect.appendChild(opt);
    });
  }

  const rawInput = document.getElementById('smsRawInput');
  if (rawInput && rawInput.value.trim()) {
    handleLiveSmsParse();
  } else {
    // 기본 미선택 상태로 초기화
    if (roomSelect) {
      roomSelect.value = '';
      roomSelect.classList.remove('ring-2', 'ring-rose-500', 'border-rose-500');
    }
    const tenantSpan = document.getElementById('smsDetectedTenant');
    const dateSpan = document.getElementById('smsDetectedDate');
    const execBtn = document.getElementById('btnExecuteSmsDeposit');
    const execBtnText = document.getElementById('btnExecuteSmsDepositText');
    if (tenantSpan) tenantSpan.textContent = '-';
    if (dateSpan) dateSpan.textContent = '-';
    if (execBtn) {
      execBtn.disabled = true;
      execBtn.className = "flex-1 py-3 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs border border-slate-700/50 flex items-center justify-center gap-1.5 cursor-not-allowed transition opacity-70";
    }
    if (execBtnText) execBtnText.textContent = '입금 문자 입력 필요';
    updateSmsAlert(null);
  }
}

export function closeSmsDepositModal() {
  closeModal('smsDepositModal');
}

export function fillSampleSmsText() {
  fillBankPresetSms('nh');
}

export function fillBankPresetSms(presetType) {
  let sample = '';
  switch (presetType) {
    case 'nh':
      sample = `알림\n\n농협\n입금440,000원\n10/06 19:40\n351-****-9152\n-93 이종진404호`;
      break;
    case 'kb':
      sample = `[KB국민] 10/17 14:05 201호 정민준 440,000원 입금 잔액 23,450,000`;
      break;
    case 'shinhan':
      sample = `[신한은행] 10/17 09:30 입금:배종봉(101호) 250,000원 잔액 12,300,000`;
      break;
    case 'kakao':
      sample = `[카카오뱅크] 10/17 16:12 302호 150,000원 입금 (김지영) 잔액 8,920,000`;
      break;
    case 'diff':
      sample = `[KB국민] 10/17 15:30 101호 배종봉 200,000원 입금 잔액 12,500,000`;
      break;
    case 'unknown':
      sample = `[NH농협] 10/17 17:00 홍길동 440,000원 입금 잔액 3,400,000`;
      break;
    default:
      sample = `알림\n\n농협\n입금440,000원\n10/06 19:40\n351-****-9152\n-93 이종진404호`;
  }
  const rawInput = document.getElementById('smsRawInput');
  if (rawInput) {
    rawInput.value = sample;
    handleLiveSmsParse();
  }
}

export async function pasteFromClipboardToSmsInput() {
  const rawInput = document.getElementById('smsRawInput');

  // 1. 최신 Clipboard API 시도 (HTTPS 또는 로컬 환경)
  if (navigator.clipboard && navigator.clipboard.readText) {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        if (rawInput) {
          rawInput.value = text;
          handleLiveSmsParse();
          return;
        }
      }
    } catch (e) {
      console.warn("navigator.clipboard.readText() blocked or unsupported:", e);
    }
  }

  // 2. 모바일 브라우저/HTTP 환경에서는 보안 정책으로 인해 readText가 제한될 수 있음
  // 입력창으로 즉시 포커스 이동하여 1초만에 모바일 붙여넣기를 실행할 수 있도록 지원
  if (rawInput) {
    rawInput.focus();
    rawInput.select();

    const banner = document.createElement('div');
    banner.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-sm w-[90%] bg-slate-900 border border-cyan-500/80 text-white p-3 rounded-2xl shadow-2xl text-xs flex items-center gap-2 animate-in fade-in duration-150';
    banner.innerHTML = `
      <span class="text-base">📋</span>
      <div>
        <strong class="text-cyan-300">입력창이 활성화되었습니다.</strong><br>
        <span class="text-slate-300">입력창을 길게 눌러 <strong>[붙여넣기]</strong>를 터치해주세요.</span>
      </div>
    `;
    document.body.appendChild(banner);
    setTimeout(() => { banner.remove(); }, 2500);
  }
}

/**
 * 은행 입금 문자 파싱 엔진
 */
export function parseBankSmsText(rawText) {
  if (!rawText) return null;
  const text = rawText.trim();

  // 1. 은행 감지
  const bankPatterns = [
    { name: '농협', regex: /(농협|NH|농협은행)/i },
    { name: '국민은행', regex: /(국민|KB|국민은행)/i },
    { name: '신한은행', regex: /(신한|신한은행)/i },
    { name: '우리은행', regex: /(우리|우리은행)/i },
    { name: '하나은행', regex: /(하나|하나은행|KEB)/i },
    { name: '기업은행', regex: /(기업|IBK|기업은행)/i },
    { name: '카카오뱅크', regex: /(카카오|카카오뱅크|카뱅)/i },
    { name: '토스뱅크', regex: /(토스|토스뱅크)/i },
    { name: '케이뱅크', regex: /(케이뱅크)/i },
    { name: '우체국', regex: /(우체국)/i },
    { name: '새마을금고', regex: /(새마을|새마을금고)/i },
    { name: 'SC제일은행', regex: /(SC|SC제일)/i }
  ];
  let bankName = '농협';
  for (const b of bankPatterns) {
    if (b.regex.test(text)) {
      bankName = b.name;
      break;
    }
  }

  // 2. 입금 금액 파싱
  let amount = 440000;
  const amtMatch = text.match(/입금\s*([0-9,]+)\s*원?/) || text.match(/([0-9,]+)\s*원?\s*입금/);
  if (amtMatch) {
    amount = parseInt(amtMatch[1].replace(/,/g, ''), 10);
  }

  // 3. 일시 파싱 (월, 일, 시간)
  let month = currentMonth;
  let day = 6;
  let timeStr = '';
  let fullDateStr = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const dateMatch = text.match(/(\d{1,2})[/.-](\d{1,2})(?:\s+(\d{1,2}:\d{2}))?/);
  if (dateMatch) {
    month = parseInt(dateMatch[1], 10);
    day = parseInt(dateMatch[2], 10);
    if (dateMatch[3]) timeStr = dateMatch[3];
    fullDateStr = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  } else {
    const krDateMatch = text.match(/(\d{1,2})월\s*(\d{1,2})일(?:\s+(\d{1,2}:\d{2}))?/);
    if (krDateMatch) {
      month = parseInt(krDateMatch[1], 10);
      day = parseInt(krDateMatch[2], 10);
      if (krDateMatch[3]) timeStr = krDateMatch[3];
      fullDateStr = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 4. 호실 및 세입자 매칭 (계좌번호, 금액, 일시로 인한 오감지 방지)
  let detectedRoom = null;
  let detectedTenant = '';

  // 계좌번호 패턴 사전 추출 (줄바꿈 및 다양한 하이픈 형태 포함)
  const accMatch = text.match(/\d{3}-[\d*]+(?:\s*-\s*[\d*]+){0,3}/);
  const accountStr = accMatch ? accMatch[0].replace(/\s+/g, '') : '';

  // 호실 및 송금자 탐색용 텍스트 (농협 계좌번호 앞 3자리 301, 302 등 오감지 방지)
  let textForRoomSearch = text;
  if (accMatch) {
    textForRoomSearch = textForRoomSearch.replace(accMatch[0], ' ');
  }
  textForRoomSearch = textForRoomSearch
    .replace(/입금\s*[0-9,]+원?/g, ' ')
    .replace(/잔액\s*[0-9,]+원?/g, ' ')
    .replace(/\d{1,2}[/.-]\d{1,2}/g, ' ')
    .replace(/\d{1,2}:\d{2}/g, ' ');

  // 4-1. '404호' 형태 검색
  const hoMatch = textForRoomSearch.match(/(\d{3})\s*호/);
  if (hoMatch) {
    const rCandidate = parseInt(hoMatch[1], 10);
    if (ROOM_NUMBERS.includes(rCandidate)) {
      detectedRoom = rCandidate;
    }
  }

  // 4-2. 등록된 세입자 이름 매칭 (예: '이종진')
  if (state.rooms) {
    for (const rNum of ROOM_NUMBERS) {
      const room = state.rooms[rNum];
      if (room && room.name && room.name !== '공실' && room.name.length >= 2) {
        if (textForRoomSearch.includes(room.name)) {
          if (!detectedRoom) detectedRoom = rNum;
          detectedTenant = room.name;
          break;
        }
      }
    }
  }

  // 4-3. 호실 미감지 시 독립 3자리 숫자 체크 (계좌번호/금액/일시 제외 영역에서만)
  if (!detectedRoom) {
    for (const rNum of ROOM_NUMBERS) {
      const re = new RegExp(`\\b${rNum}\\b`);
      if (re.test(textForRoomSearch)) {
        detectedRoom = rNum;
        break;
      }
    }
  }

  // 5. 송금자명(대납자명) 추출
  let senderName = '';
  if (accMatch) {
    const afterAcc = text.substring(text.indexOf(accMatch[0]) + accMatch[0].length);
    const senderMatch = afterAcc.match(/[-/\s\d*]+([가-힣a-zA-Z]{2,10}(?:\d{3}호)?)/);
    if (senderMatch) {
      senderName = senderMatch[1].trim();
    }
  }
  if (!senderName) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.includes('잔액') || line.includes('입금') || line.includes('알림') || line.includes('감사') || line.includes('확인')) continue;
      const wordMatch = line.match(/([가-힣a-zA-Z]{2,8}(?:\d{3}호)?)/);
      if (wordMatch) {
        senderName = wordMatch[1].trim();
        break;
      }
    }
  }

  // 호실 감지 여부 판정 (강제 404 fallback 완전 배제: 미확인 시 null 유지!)
  const isRoomDetected = (detectedRoom !== null);
  if (detectedRoom && state.rooms && state.rooms[detectedRoom]) {
    detectedTenant = state.rooms[detectedRoom].name || detectedTenant;
  }

  return {
    bankName,
    amount,
    month,
    day,
    timeStr,
    fullDateStr,
    roomNumber: detectedRoom, // 감지 안 됐을 때는 null
    detectedRoom,
    isRoomDetected,
    senderName,
    tenantName: detectedTenant,
    accountStr
  };
}

/**
 * 호실별 체납월(미납월) 탐색 및 입금액 기반 분할 수납 대상 월 계산:
 * 1. 시스템 활성 롤링 장부 범위(직전 12개월: 2025.11 ~ 2026.10) 내에서만 미납월 탐색 (과거 수년 전 비관리 연도의 가짜 체납 원천 차단)
 * 2. 전입일 이전이거나 입주월 후불(익월 청구)인 회차는 제외
 * 3. 실제 체납된 과거 회차가 있으면 오래된 순서대로 우선 충당
 * 4. 체납이 없고 당월(currentMonth)이 미납이면 당월분 정상 충당 (체납이 아닌 '당월분'으로 정확히 표기)
 * 5. 당월까지 완납된 경우 익월 미래 선납으로 정상 확장
 */
export function calculateDepositTargetPeriods(roomNum, depositAmount, parsedDateMonth = currentMonth) {
  const room = (state.rooms && state.rooms[roomNum]) ? state.rooms[roomNum] : null;
  if (!room) {
    return [];
  }

  // 1. 월 납부액 (월세 + 관리비, 전세는 관리비만)
  const isJeonse = (room.lease_type === '전세');
  const monthlyDue = (isJeonse ? 0 : Number(room.rent || 0)) + Number(room.maintenance || 0);

  // 입금액이 월납부액의 몇 개월치인지 계산 (최소 1개월)
  let monthsToCover = 1;
  if (monthlyDue > 0 && depositAmount >= monthlyDue) {
    monthsToCover = Math.max(1, Math.floor(depositAmount / monthlyDue));
  }

  // 2. 세입자의 전입일 파싱
  let inYear = currentYear;
  let inMonth = 1;
  if (room.move_in) {
    const dtComp = parseDateComponents(room.move_in);
    if (dtComp) {
      inYear = dtComp.year;
      inMonth = dtComp.month;
    }
  }

  const isPostpaid = (room.pay_timing === '후불' || !room.pay_timing);

  // 3. 활성 롤링 12개월 생성 (과거순: 예: 2025.11 ~ 2026.10)
  const rollingPeriods = [];
  for (let i = 11; i >= 0; i--) {
    let m = currentMonth - i;
    let y = currentYear;
    if (m <= 0) {
      m += 12;
      y -= 1;
    }
    rollingPeriods.push({ year: y, month: m });
  }

  // 4. 활성 장부 내 미납월 탐색
  const unpaidPeriods = [];
  for (const { year: y, month: m } of rollingPeriods) {
    // 4-1. 전입 이전 회차 제외
    if (y < inYear || (y === inYear && m < inMonth)) continue;

    // 4-2. 입주월 후불(익월 청구) 제외
    if (y === inYear && m === inMonth && isPostpaid) continue;

    const pKey = `${y}-${m}`;
    const p = (room.payments && (room.payments[pKey] || (y === currentYear ? room.payments[m] : null)));

    // 4-3. 이미 완납된 회차 제외
    if (p && p.paid === true) continue;

    // 4-4. 전입 이전 비고 표기된 비과세/과거 회차 제외
    if (p && p.note && p.note.includes('전입 이전')) continue;

    const isPast = (y < currentYear) || (y === currentYear && m < currentMonth);
    unpaidPeriods.push({ year: y, month: m, isOverdue: isPast });
  }

  // 5. 할당 대상 월 확정
  const targetPeriods = [];

  // 5-1. 체납/미납월이 있는 경우 오래된 순서대로 monthsToCover만큼 충당
  for (const item of unpaidPeriods) {
    if (targetPeriods.length >= monthsToCover) break;
    targetPeriods.push(item);
  }

  // 5-2. 다개월 입금 등으로 할당할 개월이 남았거나, 이미 당월까지 모두 완납되어 미래 선납인 경우
  if (targetPeriods.length < monthsToCover) {
    let baseYear = currentYear;
    let baseMonth = (targetPeriods.length > 0)
      ? targetPeriods[targetPeriods.length - 1].month
      : currentMonth;

    if (targetPeriods.length > 0) {
      baseYear = targetPeriods[targetPeriods.length - 1].year;
    }

    while (targetPeriods.length < monthsToCover) {
      baseMonth++;
      if (baseMonth > 12) {
        baseMonth = 1;
        baseYear++;
      }
      targetPeriods.push({ year: baseYear, month: baseMonth, isOverdue: false, isAdvance: true });
    }
  }

  return targetPeriods;
}


/**
 * 송금자 영수증 메시지 생성:
 * 은행, 일시, 계좌정보, 송금자, 호실, 납부 월(체납/분할 포함) 모두를 담아 영수증 생성
 */
export function generateReceiptMessage(rawText, targetRoomNum = null, customPeriods = null) {
  if (!rawText) return "";
  const parsed = parseBankSmsText(rawText);
  const detectedRoom = targetRoomNum || (parsed ? parsed.roomNumber : (state.selectedRoom || 404));
  const room = (state.rooms && state.rooms[detectedRoom]) ? state.rooms[detectedRoom] : null;
  const tenantName = (room && room.name) ? room.name : ((parsed && parsed.tenantName) ? parsed.tenantName : "");

  // 충당 대상 월 목록
  const targetPeriods = customPeriods || (parsed ? calculateDepositTargetPeriods(detectedRoom, parsed.amount, parsed.month) : null);
  let periodNote = '';
  const fmtPeriod = (p) => `${p.year !== currentYear ? p.year + '년 ' : ''}${p.month}월`;
  if (targetPeriods && targetPeriods.length > 1) {
    periodNote = ` (${targetPeriods.map(fmtPeriod).join(', ')}분 납부)`;
  } else if (targetPeriods && targetPeriods.length === 1 && targetPeriods[0].isOverdue) {
    periodNote = ` (${fmtPeriod(targetPeriods[0])} 체납분 납부)`;
  } else if (targetPeriods && targetPeriods.length === 1 && targetPeriods[0].isAdvance) {
    periodNote = ` (${fmtPeriod(targetPeriods[0])}분 선납)`;
  } else if (targetPeriods && targetPeriods.length === 1) {
    periodNote = ` (${fmtPeriod(targetPeriods[0])}분 납부)`;
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trim());
  const cleanedLines = [];
  let hasRoomInText = false;

  for (const line of lines) {
    if (!line) continue;
    // 최상단 단독 '알림' 헤더 제외
    if (line === '알림') continue;

    // 잔액 라인 무조건 제외
    if (line.includes('잔액')) continue;

    // 기존 감사 문구는 마지막에 일괄 정돈하므로 제외
    if (line.includes('입금 확인했습니다') || line.includes('입금확인했습니다') || line.includes('감사합니다')) continue;

    // 호실이 이미 해당 라인에 명시되어 있는지 확인 (예: 404호)
    if (new RegExp(`${detectedRoom}\\s*호`).test(line) || /(\d{3})\s*호/.test(line)) {
      hasRoomInText = true;
      cleanedLines.push(`${line}${periodNote}`);
      continue;
    }

    // 세입자명이 들어있는 송금자 라인인데 호실이 빠져있는 경우 -> 호실 자동 부착
    if (tenantName && line.includes(tenantName) && !hasRoomInText) {
      cleanedLines.push(`${line} ${detectedRoom}호${periodNote}`);
      hasRoomInText = true;
      continue;
    }

    cleanedLines.push(line);
  }

  // 만약 텍스트 전체에서 호실 번호가 어디에도 명시되지 않았던 경우:
  if (!hasRoomInText && detectedRoom) {
    if (tenantName) {
      cleanedLines.push(`${tenantName} ${detectedRoom}호${periodNote}`);
    } else {
      cleanedLines.push(`${detectedRoom}호${periodNote}`);
    }
  }

  // 입금 확인 및 감사 문구 추가
  cleanedLines.push('입금 확인했습니다.');
  cleanedLines.push('감사합니다.');

  return cleanedLines.join('\n');
}

/**
 * 실시간 입력 시 분석 결과 업데이트 (가장 오래된 체납월부터 채우고 다개월 분할 계산)
 */
export function handleLiveSmsParse() {
  const rawInput = document.getElementById('smsRawInput');
  if (!rawInput) return;
  const rawText = rawInput.value;
  if (!rawText.trim()) {
    updateSmsAlert(null);
    return;
  }

  const parsed = parseBankSmsText(rawText);
  if (!parsed) return;

  // 은행 뱃지
  const bankBadge = document.getElementById('smsBankBadge');
  if (bankBadge) bankBadge.textContent = `${parsed.bankName} 입금`;

  // 금액 표시
  const amtSpan = document.getElementById('smsDetectedAmount');
  if (amtSpan) amtSpan.textContent = `${Number(parsed.amount).toLocaleString()}원`;

  // 메모 표시
  const memoSpan = document.getElementById('smsDetectedMemo');
  if (memoSpan) {
    const memoContent = parsed.accountStr || (parsed.senderName ? `송금자: ${parsed.senderName}` : `${parsed.bankName} 계좌`);
    memoSpan.textContent = memoContent;
  }

  const roomSelect = document.getElementById('smsDetectedRoom');
  const tenantSpan = document.getElementById('smsDetectedTenant');
  const dateSpan = document.getElementById('smsDetectedDate');
  const execBtn = document.getElementById('btnExecuteSmsDeposit');
  const execBtnText = document.getElementById('btnExecuteSmsDepositText');

  // ★ 호실이 감지되지 않은 경우 (호실 표기 없고 다른 사람이 대납)
  if (!parsed.isRoomDetected || !parsed.roomNumber) {
    if (roomSelect) {
      roomSelect.value = "";
      roomSelect.classList.add('ring-2', 'ring-rose-500', 'border-rose-500');
    }
    if (tenantSpan) {
      tenantSpan.innerHTML = `<span class="text-rose-400 font-bold">호실 검색 불가 ${parsed.senderName ? '(' + parsed.senderName + ' 대납)' : ''}</span>`;
    }
    if (dateSpan) {
      dateSpan.innerHTML = `<span class="text-amber-400 font-bold">⚠️ 대상 호실을 직접 선택해주세요</span>`;
    }
    
    if (execBtn) {
      execBtn.disabled = true;
      execBtn.className = "flex-1 py-3 rounded-xl bg-slate-800 text-amber-300 font-bold text-xs border border-amber-500/40 flex items-center justify-center gap-1.5 cursor-not-allowed transition opacity-80";
    }
    if (execBtnText) {
      execBtnText.textContent = "⚠️ 대상 호실을 먼저 선택해주세요";
    }

    // 영수증 영역 비우기
    const receiptEl = document.getElementById('smsReceiptText');
    if (receiptEl) receiptEl.value = "";
    state.pendingReceiptText = "";
    state.pendingReceiptRoom = null;
    state.pendingTargetPeriods = [];

    // 안내 배너: 호실 검색 불가 오류 및 선택 가이드 출력
    updateSmsAlert(
      'error',
      '호실 검색 불가 (검색할 수 없음)',
      `입금 문자에서 <strong>호실 정보</strong>나 <strong>등록된 세입자 성명</strong>을 검색할 수 없습니다.<br>` +
      (parsed.senderName ? `(확인된 입금자명: <strong class="text-white">${parsed.senderName}</strong> - 타인 대납 추정)<br>` : '') +
      `수납 처리할 대상 호실을 좌측 <strong>[대상 호실]</strong> 드롭다운에서 직접 선택해주세요.`
    );
    return;
  }

  // 호실이 정상 감지된 경우:
  if (roomSelect) {
    roomSelect.value = parsed.roomNumber;
    roomSelect.classList.remove('ring-2', 'ring-rose-500', 'border-rose-500');
  }
  if (tenantSpan) tenantSpan.textContent = parsed.tenantName || '세입자';

  // 체납월 및 다개월 분할 수납 대상 계산
  const targetPeriods = calculateDepositTargetPeriods(parsed.roomNumber, parsed.amount, parsed.month);

  if (targetPeriods.length === 0) {
    if (dateSpan) {
      dateSpan.innerHTML = `<span class="text-amber-400 font-bold">체납 내역 없음 (이미 완납)</span>`;
    }
    if (execBtnText) {
      execBtnText.textContent = `⚠️ 자동 처리 불가 (체납 내역 없음)`;
    }
    if (execBtn) {
      execBtn.className = "flex-1 py-3 rounded-xl bg-slate-800 text-amber-300 font-bold text-xs border border-amber-500/40 flex items-center justify-center gap-1.5 cursor-pointer transition";
    }
    updateSmsAlert(
      'warning',
      '미납 내역 없음 (이미 전액 완납)',
      `<strong>${parsed.roomNumber}호 (${parsed.tenantName || '세입자'})</strong>는 현재 체납/미납 회차가 없는 완납 상태입니다.<br>이중입금 또는 과오납 여부를 확인하시거나, 과거/특수 납부는 <strong>[과거납부내역]</strong>에서 수동으로 확인해주세요.`
    );
  } else {
    const fmt = (p) => `${p.year !== currentYear ? p.year + '년 ' : ''}${p.month}월`;
    const dayStr = parsed.day ? `${parsed.day}일 ` : '';
    if (dateSpan) {
      if (targetPeriods.length > 1) {
        dateSpan.textContent = `${parsed.month}월 ${dayStr}(${targetPeriods.map(fmt).join(', ')}분 ${targetPeriods.length}개월 분할)`;
      } else if (targetPeriods[0].isOverdue) {
        dateSpan.textContent = `${parsed.month}월 ${dayStr}(${fmt(targetPeriods[0])} 체납분 충당)`;
      } else if (targetPeriods[0].isAdvance) {
        dateSpan.textContent = `${parsed.month}월 ${dayStr}(${fmt(targetPeriods[0])}분 선납)`;
      } else {
        dateSpan.textContent = `${parsed.month}월 ${dayStr}(${fmt(targetPeriods[0])}분)`;
      }
    }
    if (execBtnText) {
      if (targetPeriods.length > 1) {
        execBtnText.textContent = `입금처리 (${parsed.roomNumber}호 ${fmt(targetPeriods[0])}~${fmt(targetPeriods[targetPeriods.length - 1])} ${targetPeriods.length}개월분)`;
      } else if (targetPeriods[0].isOverdue) {
        execBtnText.textContent = `입금처리 (${parsed.roomNumber}호 ${fmt(targetPeriods[0])} 체납분)`;
      } else if (targetPeriods[0].isAdvance) {
        execBtnText.textContent = `입금처리 (${parsed.roomNumber}호 ${fmt(targetPeriods[0])}분 선납)`;
      } else {
        execBtnText.textContent = `입금처리 (${parsed.roomNumber}호 ${fmt(targetPeriods[0])}분)`;
      }
    }
    if (execBtn) {
      execBtn.className = "flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 transition";
    }

    // 금액 불일치 여부 실시간 안내
    const room = state.rooms ? state.rooms[parsed.roomNumber] : null;
    const isJeonse = (room && room.lease_type === '전세');
    const monthlyDue = room ? ((isJeonse ? 0 : Number(room.rent || 0)) + Number(room.maintenance || 0)) : 0;
    const expectedTotal = monthlyDue * targetPeriods.length;

    if (monthlyDue > 0 && Number(parsed.amount) !== expectedTotal) {
      const diff = Number(parsed.amount) - expectedTotal;
      const diffText = diff > 0 ? `${diff.toLocaleString()}원 초과 입금` : `${Math.abs(diff).toLocaleString()}원 부족 입금`;
      updateSmsAlert(
        'diff',
        `금액 불일치 안내 (${diffText})`,
        `입금액(<strong>${Number(parsed.amount).toLocaleString()}원</strong>)이 대상 회차(${targetPeriods.length}개월) 청구액(<strong>${expectedTotal.toLocaleString()}원</strong>)과 차이가 있습니다.<br>처리 후 <strong>[과거납부내역]</strong>에서 세부 금액을 수정할 수 있습니다.`
      );
    } else {
      updateSmsAlert(null);
    }
  }

  // 영수증 문자 자동 변환 생성
  const receipt = generateReceiptMessage(rawText, parsed.roomNumber, targetPeriods);
  const receiptEl = document.getElementById('smsReceiptText');
  if (receiptEl) receiptEl.value = receipt;

  // 전역 상태에 보관
  state.pendingReceiptText = receipt;
  state.pendingReceiptRoom = parsed.roomNumber;
  state.pendingTargetPeriods = targetPeriods;
  state.lastSmsDeposit = parsed;
}

export function onSmsDetectedRoomChange() {
  const roomSelect = document.getElementById('smsDetectedRoom');
  if (!roomSelect) return;
  const rawRoomVal = roomSelect.value;

  const tenantSpan = document.getElementById('smsDetectedTenant');
  const dateSpan = document.getElementById('smsDetectedDate');
  const execBtn = document.getElementById('btnExecuteSmsDeposit');
  const execBtnText = document.getElementById('btnExecuteSmsDepositText');

  // 호실이 미선택 상태인 경우
  if (!rawRoomVal) {
    if (roomSelect) roomSelect.classList.add('ring-2', 'ring-rose-500', 'border-rose-500');
    if (tenantSpan) tenantSpan.innerHTML = `<span class="text-rose-400 font-bold">호실 미선택</span>`;
    if (dateSpan) dateSpan.innerHTML = `<span class="text-amber-400 font-bold">⚠️ 대상 호실을 직접 선택해주세요</span>`;
    if (execBtn) {
      execBtn.disabled = true;
      execBtn.className = "flex-1 py-3 rounded-xl bg-slate-800 text-amber-300 font-bold text-xs border border-amber-500/40 flex items-center justify-center gap-1.5 cursor-not-allowed transition opacity-80";
    }
    if (execBtnText) {
      execBtnText.textContent = "⚠️ 대상 호실을 먼저 선택해주세요";
    }
    const rawInput = document.getElementById('smsRawInput');
    if (rawInput && rawInput.value.trim()) {
      updateSmsAlert(
        'error',
        '호실 검색 불가 (선택 필요)',
        `입금 문자에서 호실을 찾을 수 없습니다. 수납 처리할 대상 호실을 드롭다운에서 직접 선택해주세요.`
      );
    } else {
      updateSmsAlert(null);
    }
    return;
  }

  if (roomSelect) {
    roomSelect.classList.remove('ring-2', 'ring-rose-500', 'border-rose-500');
  }

  const rNum = parseInt(rawRoomVal, 10);
  const room = state.rooms ? state.rooms[rNum] : null;
  const tenantName = (room && room.name) ? room.name : '공실';
  if (tenantSpan) tenantSpan.textContent = tenantName;

  const rawInput = document.getElementById('smsRawInput');
  const rawText = rawInput ? rawInput.value : '';
  const parsed = parseBankSmsText(rawText);
  const depAmount = parsed ? parsed.amount : (room ? (room.lease_type === '전세' ? room.maintenance : room.rent + room.maintenance) : 440000);
  const depMonth = parsed ? parsed.month : currentMonth;

  if (parsed) {
    parsed.roomNumber = rNum;
    parsed.detectedRoom = rNum;
    parsed.tenantName = tenantName;
    parsed.isRoomDetected = true;
    state.lastSmsDeposit = parsed;
  }

  const targetPeriods = calculateDepositTargetPeriods(rNum, depAmount, depMonth);

  if (targetPeriods.length === 0) {
    if (dateSpan) {
      dateSpan.innerHTML = `<span class="text-amber-400 font-bold">체납 내역 없음 (이미 완납)</span>`;
    }
    if (execBtnText) {
      execBtnText.textContent = `⚠️ 자동 처리 불가 (체납 내역 없음)`;
    }
    if (execBtn) {
      execBtn.disabled = true;
      execBtn.className = "flex-1 py-3 rounded-xl bg-slate-800 text-amber-300 font-bold text-xs border border-amber-500/40 flex items-center justify-center gap-1.5 cursor-not-allowed transition opacity-80";
    }
    updateSmsAlert(
      'warning',
      '미납 내역 없음 (이미 전액 완납)',
      `<strong>${rNum}호 (${tenantName})</strong>는 현재 체납/미납 회차가 없는 완납 상태입니다.<br>이중입금 또는 과오납 여부를 확인하시거나, 과거/특수 납부는 <strong>[과거납부내역]</strong>에서 수동으로 확인해주세요.`
    );
  } else {
    const fmt = (p) => `${p.year !== currentYear ? p.year + '년 ' : ''}${p.month}월`;
    if (dateSpan) {
      if (targetPeriods.length > 1) {
        dateSpan.textContent = `${depMonth}월 (${targetPeriods.map(fmt).join(', ')}분 ${targetPeriods.length}개월 분할)`;
      } else if (targetPeriods[0].isOverdue) {
        dateSpan.textContent = `${depMonth}월 (${fmt(targetPeriods[0])} 체납분 충당)`;
      } else if (targetPeriods[0].isAdvance) {
        dateSpan.textContent = `${depMonth}월 (${fmt(targetPeriods[0])}분 선납)`;
      } else {
        dateSpan.textContent = `${depMonth}월 (${fmt(targetPeriods[0])}분)`;
      }
    }
    if (execBtnText) {
      if (targetPeriods.length > 1) {
        execBtnText.textContent = `입금처리 (${rNum}호 ${fmt(targetPeriods[0])}~${fmt(targetPeriods[targetPeriods.length - 1])} ${targetPeriods.length}개월분)`;
      } else if (targetPeriods[0].isOverdue) {
        execBtnText.textContent = `입금처리 (${rNum}호 ${fmt(targetPeriods[0])} 체납분)`;
      } else if (targetPeriods[0].isAdvance) {
        execBtnText.textContent = `입금처리 (${rNum}호 ${fmt(targetPeriods[0])}분 선납)`;
      } else {
        execBtnText.textContent = `입금처리 (${rNum}호 ${fmt(targetPeriods[0])}분)`;
      }
    }
    if (execBtn) {
      execBtn.disabled = false;
      execBtn.className = "flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 transition";
    }

    const isJeonse = (room && room.lease_type === '전세');
    const monthlyDue = room ? ((isJeonse ? 0 : Number(room.rent || 0)) + Number(room.maintenance || 0)) : 0;
    const expectedTotal = monthlyDue * targetPeriods.length;

    if (monthlyDue > 0 && depAmount !== expectedTotal) {
      const diff = depAmount - expectedTotal;
      const diffText = diff > 0 ? `${diff.toLocaleString()}원 초과 입금` : `${Math.abs(diff).toLocaleString()}원 부족 입금`;
      updateSmsAlert(
        'diff',
        `금액 불일치 안내 (${diffText})`,
        `입금액(<strong>${Number(depAmount).toLocaleString()}원</strong>)이 대상 회차(${targetPeriods.length}개월) 청구액(<strong>${expectedTotal.toLocaleString()}원</strong>)과 차이가 있습니다.<br>처리 후 <strong>[과거납부내역]</strong>에서 세부 금액을 수정할 수 있습니다.`
      );
    } else if (parsed && parsed.senderName && room && room.name && parsed.senderName !== room.name) {
      updateSmsAlert(
        'info',
        `타인 대납 연결 확인 (${parsed.senderName} ➡️ ${rNum}호 ${tenantName})`,
        `입금자 <strong>${parsed.senderName}</strong>님의 입금이 <strong>${rNum}호 (${tenantName})</strong>에 수납 처리되도록 연결되었습니다.`
      );
    } else {
      updateSmsAlert(null);
    }
  }

  if (rawInput && rawInput.value.trim()) {
    const receipt = generateReceiptMessage(rawInput.value, rNum, targetPeriods);
    const receiptEl = document.getElementById('smsReceiptText');
    if (receiptEl) receiptEl.value = receipt;
    state.pendingReceiptText = receipt;
    state.pendingReceiptRoom = rNum;
    state.pendingTargetPeriods = targetPeriods;
  }
}

/**
 * 메시지 분석 후 입금 처리:
 * 가장 오래된 체납월부터 우선 충당하고, 다개월 입금 시 분할하여 수납 처리
 * - 전입일 이전 것은 제외
 * - 체납된 것이 없거나 처리 불가 시 수동 처리 안내
 * - 임차료와 불일치 시 안내 팝업 후 다음 진행
 */
export async function handleSmsDepositProcess() {
  const roomSelect = document.getElementById('smsDetectedRoom');
  const roomVal = roomSelect ? roomSelect.value : '';

  if (!roomVal) {
    updateSmsAlert(
      'error',
      '호실 미선택 오류 (처리 불가)',
      '입금 처리할 대상 호실이 선택되지 않았습니다.<br><strong>[대상 호실]</strong> 선택창에서 실제 납부할 호실을 먼저 선택해주세요.'
    );
    return;
  }

  const roomNum = parseInt(roomVal, 10);
  const rawInput = document.getElementById('smsRawInput');
  const rawText = rawInput ? rawInput.value : '';
  const parsed = parseBankSmsText(rawText);

  if (!parsed || !roomNum) {
    updateSmsAlert('error', '입력 오류', '입금 문자를 먼저 붙여넣어주세요.');
    return;
  }

  const room = state.rooms[roomNum];
  const tenantName = (room && room.name) ? room.name : (parsed.tenantName || "세입자");
  const paidDate = parsed.fullDateStr || formattedToday;

  // 1. 가장 오래된 체납월부터 분할 수납 대상 월 목록 산출 (전입일 이전 제외)
  const targetPeriods = state.pendingTargetPeriods || calculateDepositTargetPeriods(roomNum, parsed.amount, parsed.month);

  // 체납된 것이 없는데 입금 되는 등 처리할 수 없는 경우 수동 처리 안내
  if (!targetPeriods || targetPeriods.length === 0) {
    updateSmsAlert(
      'warning',
      '처리 불가: 미납 내역 없음',
      `<strong>${roomNum}호 (${tenantName})</strong>는 현재 체납/미납 회차가 없는 완납 상태입니다.<br>이중입금 또는 과오납 여부를 확인하시거나, 과거/특수 납부는 <strong>[과거납부내역]</strong>에서 수동으로 확인해주세요.`
    );
    return;
  }

  // 2. 은행 메시지의 금액이 임차료와 일치하지 않을 때 확인 메시지 보여주고 확인 후 진행
  const isJeonse = (room.lease_type === '전세');
  const monthlyDue = (isJeonse ? 0 : Number(room.rent || 0)) + Number(room.maintenance || 0);
  const expectedTotal = monthlyDue * targetPeriods.length;

  if (monthlyDue > 0 && Number(parsed.amount) !== expectedTotal) {
    const diff = Number(parsed.amount) - expectedTotal;
    const diffText = diff > 0 ? `${diff.toLocaleString()}원 초과 입금` : `${Math.abs(diff).toLocaleString()}원 부족 입금`;
    updateSmsAlert(
      'diff',
      `금액 불일치 확인 (${diffText})`,
      `입금액(<strong>${Number(parsed.amount).toLocaleString()}원</strong>)과 청구액(<strong>${expectedTotal.toLocaleString()}원</strong>)이 다릅니다.<br>계속 진행하시면 완납 처리되며, 차액은 <strong>[과거납부내역]</strong>에서 수정할 수 있습니다.`
    );
  }

  const execBtn = document.getElementById('btnExecuteSmsDeposit');
  const execBtnText = document.getElementById('btnExecuteSmsDepositText');
  const origBtnText = execBtnText ? execBtnText.textContent : '입금처리';

  try {
    if (execBtn) {
      execBtn.disabled = true;
      execBtn.classList.add('opacity-70', 'pointer-events-none');
    }
    if (execBtnText) {
      execBtnText.textContent = '전산 완납 처리 중... ⏳';
    }

    // 3. 분할된 각 월에 대해 전산 완납 처리 실행
    for (const p of targetPeriods) {
      const pMonth = p.month;
      const pYear = p.year;
      const pNote = (targetPeriods.length > 1)
        ? `은행 입금 분할 (${targetPeriods.map(x => x.month + '월').join(', ')}분)`
        : (p.isOverdue ? `은행 입금 (${pMonth}월 체납분 충당)` : (p.isAdvance ? `은행 입금 (${pMonth}월분 선납)` : `은행 입금 확인 (${parsed.bankName})`));

      if (state.isOnline) {
        const res = await apiProcessPayment(roomNum, pMonth, state.currentBranch, paidDate, pNote, tenantName, pYear);
        state.rooms[roomNum] = res;
      } else {
        if (room && room.payments) {
          const pKey = `${pYear}-${pMonth}`;
          const payObj = {
            month: pMonth,
            year: pYear,
            paid: true,
            paid_date: paidDate,
            note: pNote,
            tenant_name: tenantName,
            is_previous_tenant: false,
            rent_amount: room.lease_type === "전세" ? 0 : room.rent,
            maintenance_amount: room.maintenance
          };
          room.payments[pMonth] = payObj;
          room.payments[pKey] = payObj;
        }
      }
    }
    saveLocalFallback();

    // 호실 선택 및 메인 테이블 갱신
    state.selectedRoom = roomNum;
    renderAll();

    // 4. 영수증 텍스트 생성 (충당된 월 표기 포함)
    const receiptText = generateReceiptMessage(rawText, roomNum, targetPeriods);
    state.pendingReceiptText = receiptText;
    state.pendingReceiptRoom = roomNum;

    // 5. 클립보드에 영수증 내용 복사
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(receiptText);
      }
    } catch (e) {
      console.warn("Clipboard write not permitted:", e);
    }

    // 성공 메시지 띄우고 모달 닫기
    updateSmsAlert('success', '입금 완납 처리 완료', `${roomNum}호 ${targetPeriods.map(p => p.month + '월').join(', ')}분 완납이 정상 기록되었습니다.`);

    setTimeout(() => {
      // 6. 입금 모달 닫기
      closeSmsDepositModal();

      // 7. 스마트폰 메시지 창으로 다이렉트 이동
      const phone = room ? room.phone : '';
      if (phone) {
        const cleanPhone = phone.replace(/[^\d+]/g, '');
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const smsUrl = `sms:${cleanPhone}${isIOS ? '&' : '?'}body=${encodeURIComponent(receiptText)}`;
        window.location.href = smsUrl;
      }
    }, 400);

  } catch (err) {
    console.error("입금 처리 실패:", err);
    if (execBtn) {
      execBtn.disabled = false;
      execBtn.classList.remove('opacity-70', 'pointer-events-none');
    }
    if (execBtnText) {
      execBtnText.textContent = origBtnText;
    }
    updateSmsAlert(
      'error',
      '입금 처리 중 오류가 발생했습니다',
      `${err.message || '서버 통신 실패 또는 데이터베이스 반영 오류'}<br>인터넷 연결 상태 및 게이트웨이(포트 9000) 동작을 확인해주세요.`
    );
  }
}

/**
 * Step 4: 영수증 내용 클립보드 복사
 */
export async function handleCopySmsReceipt() {
  const receiptEl = document.getElementById('smsReceiptText');
  const text = receiptEl ? receiptEl.value : state.pendingReceiptText;
  if (!text) {
    alert("복사할 영수증 내용이 없습니다.");
    return;
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    }
  } catch (e) {}

  state.pendingReceiptText = text;

  // Toast
  const banner = document.createElement('div');
  banner.className = 'fixed top-5 left-1/2 transform -translate-x-1/2 z-[9999] bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-2xl font-bold text-xs sm:text-sm flex items-center gap-2';
  banner.innerHTML = `<span>📋 <strong>영수증 문자가 복사되었습니다!</strong> (문자창에 붙여넣기하세요)</span>`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 2500);
}

/**
 * Step 5 & 6: 송금자(이종진)에게 문자 창 열고 전송
 */
export function handleSendSmsReceipt(targetPhone = null) {
  const rNum = state.pendingReceiptRoom || state.selectedRoom;
  const room = state.rooms[rNum];
  const phone = targetPhone || (room ? room.phone : '');
  const tName = (room && room.name) ? room.name : '세입자';

  if (!phone) {
    alert(`${rNum}호 세입자의 등록된 전화번호가 없습니다.`);
    return;
  }

  const receiptEl = document.getElementById('smsReceiptText');
  const text = receiptEl ? receiptEl.value : (state.pendingReceiptText || '');

  // 클립보드 복사 보장
  if (text && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  // 모바일 문자 앱 호출 (sms: URI)
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const smsUrl = `sms:${cleanPhone}${isIOS ? '&' : '?'}body=${encodeURIComponent(text)}`;

  // 친절한 안내 팝업 토스트
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] max-w-sm w-[92%] bg-slate-900 border border-cyan-500 text-white p-3.5 rounded-2xl shadow-2xl text-xs flex flex-col gap-2 animate-in fade-in slide-in-from-top-4 duration-200';
  toast.innerHTML = `
    <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
      <span class="font-bold text-cyan-300 flex items-center gap-1.5">
        <span>📱</span> <span>문자 전송 창 연결</span>
      </span>
      <button type="button" onclick="this.parentElement.parentElement.remove()" class="text-slate-400 hover:text-white font-bold text-xs">✕</button>
    </div>
    <div class="text-slate-300 leading-snug">
      <strong>${tName} (${phone})</strong>님에게 보낼 영수증이 <strong>클립보드에 복사</strong>되었습니다.<br>
      열린 문자창에 붙여넣고 [전송]을 누르시면 됩니다.
    </div>
    <div class="flex items-center gap-2 mt-1">
      <a href="${smsUrl}" class="flex-1 text-center py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow no-underline">
        💬 문자 앱 열기
      </a>
      <button type="button" onclick="handleCopySmsReceipt();" class="px-3 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-slate-300 font-bold text-xs border border-slate-700">
        📋 내용 복사
      </button>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 6000);

  // 모바일 환경에서만 즉시 SMS 앱 전환 (PC 브라우저에서는 프로토콜 연결 팝업 방지)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = smsUrl;
  }
}

/**
 * Step 5: 내가 404호 계약정보의 전화번호를 클릭했을 때 메시지 창이 열리고 붙여넣기 및 전송
 */
export function handlePhoneMessageClick(phone, name, roomNumber) {
  if (!phone) {
    alert("등록된 연락처가 없습니다.");
    return;
  }
  const rNum = roomNumber || state.selectedRoom;
  const room = state.rooms[rNum];
  const tName = name || (room ? room.name : "세입자");

  // 현재 호실에 맞는 영수증 텍스트 결정
  let receiptToSend = state.pendingReceiptText;
  if (!receiptToSend || (state.pendingReceiptRoom && state.pendingReceiptRoom !== rNum)) {
    const amountVal = room ? (room.rent + room.maintenance) : 0;
    const formattedAmount = `${Number(amountVal).toLocaleString()}원`;
    receiptToSend = `농협\n입금${formattedAmount}\n${tName}${rNum}호\n입금 확인했습니다.\n감사합니다.`;
  }

  // 1. 클립보드에 복사
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(receiptToSend).catch(() => {});
  }

  // 2. 문자 앱 URL 생성
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const smsUrl = `sms:${cleanPhone}${isIOS ? '&' : '?'}body=${encodeURIComponent(receiptToSend)}`;

  // 3. 안내 토스트 표시
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] max-w-sm w-[92%] bg-slate-900 border border-cyan-500 text-white p-3.5 rounded-2xl shadow-2xl text-xs flex flex-col gap-2 animate-in fade-in slide-in-from-top-4 duration-200';
  toast.innerHTML = `
    <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
      <span class="font-bold text-cyan-300 flex items-center gap-1.5">
        <span>📱</span> <span>${tName}님(${phone}) 문자 창 연결</span>
      </span>
      <button type="button" onclick="this.parentElement.parentElement.remove()" class="text-slate-400 hover:text-white font-bold text-xs">✕</button>
    </div>
    <div class="text-slate-300 leading-snug">
      영수증 내용이 <strong>클립보드에 복사</strong>되었습니다.<br>
      문자 앱 입력창을 길게 눌러 <strong>[붙여넣기]</strong> 후 전송하세요.
    </div>
    <div class="flex items-center gap-2 mt-1">
      <a href="${smsUrl}" class="flex-1 text-center py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow no-underline">
        💬 문자 앱 열기
      </a>
      <a href="tel:${phone}" class="px-3 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-slate-300 font-bold text-xs border border-slate-700 no-underline">
        📞 전화 걸기
      </a>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 6000);

  // 모바일 환경에서만 즉시 SMS 앱 전환 (PC 브라우저에서는 프로토콜 연결 팝업 방지)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = smsUrl;
  }
}

// ══════════════════════════════════════════════════════════════════════
// 10. 만기 1·2개월 전 전출 의사 확인 및 차례차례 문자 발송 툴 모듈
// ══════════════════════════════════════════════════════════════════════

let currentExpiryFilter = 'ALL'; // 'ALL', '3DAYS', '1MONTH', '3MONTH'
let sequentialQueue = []; // [{ room_number, name, phone, expiry, diff_days, period_category, sent: false }]
let sequentialIndex = 0;
let defaultExpiryMessageTemplate = "만기일이 {만기일}입니다. 전출계획 여부를 미리 알려주세요. {건물명} 관리실";

export function openExpiryNoticeModal() {
  renderExpiryNoticeList(currentExpiryFilter);
  openModal('expiryNoticeModal');
}

export function closeExpiryNoticeModal() {
  closeModal('expiryNoticeModal');
}

export function setExpiryNoticeFilter(filter) {
  currentExpiryFilter = filter;
  renderExpiryNoticeList(filter);
}

export function updateExpiryNoticeBadge() {
  const list = getExpiringRoomsList(95);
  const badgeEl = document.getElementById('headerExpiryNoticeBadge');
  const btnEl = document.getElementById('btnHeaderExpiryNotice');
  if (btnEl) {
    btnEl.classList.remove('hidden');
    const iconEl = btnEl.querySelector('span:first-child');
    if (list.length > 0) {
      btnEl.className = 'flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-300 font-bold text-xs transition cursor-pointer shadow-sm active:scale-95 whitespace-nowrap';
      if (iconEl) iconEl.className = 'text-xs animate-bounce';
      if (badgeEl) badgeEl.textContent = `만기 ${list.length}건`;
    } else {
      btnEl.className = 'flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-800/60 hover:bg-surface-700/80 border border-slate-700/70 text-slate-300 font-semibold text-xs transition cursor-pointer shadow-sm active:scale-95 whitespace-nowrap';
      if (iconEl) iconEl.className = 'text-xs';
      if (badgeEl) badgeEl.textContent = '만기안내';
    }
  }

  // 좌측 드로어 배지도 업데이트
  const drawerBadge = document.getElementById('drawerExpiryNoticeCount');
  if (drawerBadge) {
    drawerBadge.textContent = `${list.length}실`;
  }
}

export function checkDaily0700ExpiryNotice() {
  updateExpiryNoticeBadge();
  const list = getExpiringRoomsList(95);
  if (list.length === 0) return;

  const now = new Date();
  const todayStr = formattedToday;
  const currentHour = now.getHours();

  // 07:00 이후이고 오늘 아직 팝업하지 않았으면 자동 팝업
  const lastCheckKey = 'RENT_LAST_0700_EXPIRY_CHECK_DATE';
  const lastCheckedDate = localStorage.getItem(lastCheckKey);

  if (currentHour >= 7 && lastCheckedDate !== todayStr) {
    localStorage.setItem(lastCheckKey, todayStr);
    // 사용자 경험을 위해 데이터 로드 완료 직후(0.8초 후) 자연스럽게 오픈
    setTimeout(() => {
      openExpiryNoticeModal();
    }, 800);
  }
}

export function renderExpiryNoticeList(filter = 'ALL') {
  const container = document.getElementById('expiryNoticeListContainer');
  const summaryEl = document.getElementById('expiryNoticeSummaryText');
  if (!container) return;

  let allList = getExpiringRoomsList(95);
  const totalCount = allList.length;
  const count3D = allList.filter(x => x.period_category === '3일 전').length;
  const count1M = allList.filter(x => x.period_category === '1개월 전').length;
  const count3M = allList.filter(x => x.period_category === '3개월 전').length;

  if (summaryEl) {
    summaryEl.innerHTML = `총 <strong class="text-white">${totalCount}개실</strong> 도래 (3일 전: <span class="text-emerald-400 font-bold">${count3D}</span>실, 1개월 전: <span class="text-rose-400 font-bold">${count1M}</span>실, 3개월 전: <span class="text-amber-400 font-bold">${count3M}</span>실)`;
  }

  // 필터 버튼 스타일 갱신
  ['ALL', '3DAYS', '1MONTH', '3MONTH'].forEach(f => {
    const btn = document.getElementById(`filterBtnExpiry_${f}`);
    if (btn) {
      if (f === filter) {
        btn.className = 'px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-600 text-white shadow-xs';
      } else {
        btn.className = 'px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface-800 text-slate-400 hover:text-white border border-slate-700/60';
      }
    }
  });

  let displayList = allList;
  if (filter === '3DAYS') {
    displayList = allList.filter(x => x.period_category === '3일 전');
  } else if (filter === '1MONTH') {
    displayList = allList.filter(x => x.period_category === '1개월 전');
  } else if (filter === '3MONTH') {
    displayList = allList.filter(x => x.period_category === '3개월 전');
  }

  if (displayList.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="7" class="py-10 text-center text-slate-400 text-xs">
          <div class="text-2xl mb-1.5">🎉</div>
          <div>해당 조건에 해당하는 만기 도래 호실이 없습니다.</div>
        </td>
      </tr>
    `;
    const selCountEl = document.getElementById('expirySelectedCountBadge');
    if (selCountEl) selCountEl.textContent = '0실 선택';
    return;
  }

  let html = '';
  displayList.forEach(item => {
    let tagClass = 'bg-amber-950/70 text-amber-300 border-amber-800/80';
    if (item.period_category === '3일 전') {
      tagClass = 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80 font-extrabold';
    } else if (item.period_category === '1개월 전') {
      tagClass = 'bg-rose-950/70 text-rose-300 border-rose-800/80';
    }

    html += `
      <tr class="hover:bg-surface-800/50 transition border-b border-slate-800/60">
        <td class="p-2 text-center">
          <input type="checkbox" class="expiry-room-check cursor-pointer accent-cyan-500 rounded" value="${item.room_number}" checked onchange="updateExpirySelectedCount()">
        </td>
        <td class="p-2 text-center font-bold text-white whitespace-nowrap">
          ${item.room_number}호
        </td>
        <td class="p-2 font-medium text-slate-200 whitespace-nowrap">
          ${item.name}
        </td>
        <td class="p-2 font-mono text-[11px] text-slate-400 whitespace-nowrap">
          ${item.phone || '<span class="text-slate-600">연락처없음</span>'}
        </td>
        <td class="p-2 font-mono text-center text-[11px] text-slate-300 whitespace-nowrap">
          ${item.expiry}
        </td>
        <td class="p-2 text-center whitespace-nowrap">
          <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${tagClass}">
            ${item.period_category} (D-${item.diff_days})
          </span>
        </td>
        <td class="p-2 text-center whitespace-nowrap">
          <button type="button" onclick="startSingleSmsSend(${item.room_number})" class="px-2 py-1 rounded bg-surface-800 hover:bg-surface-700 text-cyan-300 border border-slate-700 text-[10px] font-semibold cursor-pointer">
            단독 발송
          </button>
        </td>
      </tr>
    `;
  });

  container.innerHTML = html;
  updateExpirySelectedCount();
}

export function toggleAllExpiryCheckboxes(checked) {
  const checkboxes = document.querySelectorAll('.expiry-room-check');
  checkboxes.forEach(cb => { cb.checked = checked; });
  updateExpirySelectedCount();
}

export function updateExpirySelectedCount() {
  const checkboxes = document.querySelectorAll('.expiry-room-check:checked');
  const countEl = document.getElementById('expirySelectedCountBadge');
  if (countEl) {
    countEl.textContent = `${checkboxes.length}실 선택`;
  }
}

export function startSequentialSmsSend() {
  const checkedBoxes = document.querySelectorAll('.expiry-room-check:checked');
  if (checkedBoxes.length === 0) {
    alert("메시지를 전송할 호실을 1개 이상 체크해주세요.");
    return;
  }

  const selectedRoomNums = Array.from(checkedBoxes).map(cb => Number(cb.value));
  const allList = getExpiringRoomsList(95);
  sequentialQueue = allList
    .filter(x => selectedRoomNums.includes(x.room_number))
    .map(x => ({ ...x, sent: false }));

  if (sequentialQueue.length === 0) {
    alert("전송 대상 호실 정보를 찾을 수 없습니다.");
    return;
  }

  sequentialIndex = 0;
  closeModal('expiryNoticeModal');
  renderCurrentSequentialSmsStep();
  openModal('sequentialSmsModal');
}

export function startSingleSmsSend(roomNum) {
  const allList = getExpiringRoomsList(95);
  const target = allList.find(x => x.room_number === roomNum);
  if (!target) return;

  sequentialQueue = [{ ...target, sent: false }];
  sequentialIndex = 0;
  closeModal('expiryNoticeModal');
  renderCurrentSequentialSmsStep();
  openModal('sequentialSmsModal');
}

export function renderCurrentSequentialSmsStep() {
  if (sequentialIndex < 0) sequentialIndex = 0;
  if (sequentialIndex >= sequentialQueue.length) {
    finishSequentialSmsSend();
    return;
  }

  const item = sequentialQueue[sequentialIndex];
  const branchObj = state.branches.find(b => b.branch_id === state.currentBranch);
  const branchName = branchObj ? branchObj.name.split(' ')[0] : '시크빌';

  // 상단 진행도
  const progressText = document.getElementById('seqSmsProgressText');
  const progressBar = document.getElementById('seqSmsProgressBar');
  const total = sequentialQueue.length;
  const currentNum = sequentialIndex + 1;
  const pct = Math.round((currentNum / total) * 100);

  if (progressText) progressText.textContent = `${currentNum} / ${total} 호실 (${pct}%)`;
  if (progressBar) progressBar.style.width = `${pct}%`;

  // 호실 및 세입자 정보
  const targetInfo = document.getElementById('seqSmsTargetInfo');
  if (targetInfo) {
    targetInfo.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-base font-extrabold text-cyan-300 font-mono">${item.room_number}호</span>
        <span class="text-sm font-bold text-white">${item.name}</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-slate-300 border border-slate-700">${item.period_category} (D-${item.diff_days})</span>
      </div>
      <div class="text-xs text-slate-400 font-mono mt-0.5">
        📞 ${item.phone || '연락처 미등록'} • 만기일: <strong class="text-slate-200">${item.expiry}</strong>
      </div>
    `;
  }

  // 메시지 템플릿 생성: '만기일이 xxxx.xx.xx입니다. 전출 계획이 있다면 미리 연락바랍니다. 시크빌 관리실'
  const formattedExpiry = item.expiry.replace(/-/g, '.');
  const customTemplate = document.getElementById('expiryNoticeTemplateInput');
  let template = (customTemplate && customTemplate.value.trim()) || defaultExpiryMessageTemplate;

  const finalMsg = template
    .replace('{만기일}', formattedExpiry)
    .replace('{호실}', `${item.room_number}호`)
    .replace('{임차인}', item.name)
    .replace('{건물명}', branchName);

  const previewEl = document.getElementById('seqSmsMessagePreview');
  if (previewEl) {
    previewEl.value = finalMsg;
  }

  // 상태 배지
  const sentBadge = document.getElementById('seqSmsStatusBadge');
  if (sentBadge) {
    if (item.sent) {
      sentBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80';
      sentBadge.textContent = '✅ 발송 완료됨';
    } else {
      sentBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80';
      sentBadge.textContent = '⏳ 발송 대기';
    }
  }

  // 이전 버튼 활성화/비활성화
  const btnPrev = document.getElementById('btnSeqPrev');
  if (btnPrev) {
    btnPrev.disabled = sequentialIndex === 0;
    if (sequentialIndex === 0) btnPrev.classList.add('opacity-40');
    else btnPrev.classList.remove('opacity-40');
  }
}

export function handleSequentialSmsSendAction() {
  const item = sequentialQueue[sequentialIndex];
  if (!item) return;

  const previewEl = document.getElementById('seqSmsMessagePreview');
  const msg = (previewEl && previewEl.value) || '';
  const phone = item.phone || '';
  const cleanPhone = phone.replace(/[^\d+]/g, '');

  if (!cleanPhone) {
    alert("세입자의 전화번호가 등록되어 있지 않습니다. 호실 정보에서 연락처를 확인하세요.");
    return;
  }

  // 클립보드 복사
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).catch(() => {});
  }

  // 모바일 문자 앱 호출
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const smsUrl = `sms:${cleanPhone}${isIOS ? '&' : '?'}body=${encodeURIComponent(msg)}`;

  item.sent = true;
  renderCurrentSequentialSmsStep();

  // 모바일 SMS 창 호출
  window.location.href = smsUrl;
}

export function handleSequentialSmsCopy() {
  const previewEl = document.getElementById('seqSmsMessagePreview');
  const msg = (previewEl && previewEl.value) || '';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg)
      .then(() => alert("메시지 내용이 클립보드에 복사되었습니다."))
      .catch(() => alert("복사 실패"));
  }
}

export function handleSequentialNext() {
  if (sequentialIndex < sequentialQueue.length - 1) {
    sequentialIndex += 1;
    renderCurrentSequentialSmsStep();
  } else {
    finishSequentialSmsSend();
  }
}

export function handleSequentialSkip() {
  handleSequentialNext();
}

export function handleSequentialPrev() {
  if (sequentialIndex > 0) {
    sequentialIndex -= 1;
    renderCurrentSequentialSmsStep();
  }
}

export function finishSequentialSmsSend() {
  closeModal('sequentialSmsModal');
  const sentCount = sequentialQueue.filter(x => x.sent).length;
  alert(`🎉 만기 전출 확인 메시지 발송 과정이 완료되었습니다!\n(총 ${sequentialQueue.length}건 중 ${sentCount}건 전송 완료)`);
}

export function closeSequentialSmsModal() {
  closeModal('sequentialSmsModal');
}

export async function resetCurrentBuildingRooms() {
  const curBranchObj = state.branches.find(b => b.branch_id === state.currentBranch);
  const bName = curBranchObj ? curBranchObj.name : '현재 건물';
  if (!confirm(`[${bName}]의 기존 모든 호실 및 세입자 데이터를 깨끗이 초기화하시겠습니까?\n\n⚠️ 초기화 후 엑셀/CSV 일괄 등록으로 원하는 호실 수(예: 신비주택 20개실)만큼 깔끔하게 등록하실 수 있습니다.`)) {
    return;
  }
  try {
    if (state.isOnline) {
      await roomsApi.reset(state.currentBranch);
    }
    state.rooms = {};
    state.selectedRoom = null;
    saveLocalFallback();
    renderAll();
    alert(`🎉 [${bName}]의 모든 호실 데이터가 깨끗하게 초기화되었습니다!\n이제 [엑셀 일괄 등록]으로 신비주택 20개실을 등록해 보세요.`);
  } catch (err) {
    alert("초기화 처리 오류: " + err.message);
  }
}

if (typeof window !== 'undefined') {
  window.fillBankPresetSms = fillBankPresetSms;
  window.fillSampleSmsText = fillSampleSmsText;
  window.resetCurrentBuildingRooms = resetCurrentBuildingRooms;
}



