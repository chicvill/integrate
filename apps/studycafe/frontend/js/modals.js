// apps/studycafe/frontend/js/modals.js
// 스터디카페 대화상자 및 팝업 제어

export function showToast(message, type = 'info', duration = 3500) {
  let toast = document.getElementById('scToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'scToast';
    toast.className = 'sc-toast';
    document.body.appendChild(toast);
  }
  
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<span class="sc-toast-icon">${icon}</span><span>${message}</span>`;
  toast.className = `sc-toast show ${type}`;
  
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = 'sc-toast';
  }, duration);
}

// 1. 좌석 배정(입실) 모달 (결제 완료자 전용: 원스톱 1-클릭 입실)
export function openAssignModal(seat, currentUser, activeTicket, onConfirm) {
  let modal = document.getElementById('assignModal');
  if (!modal) return;

  const titleEl = document.getElementById('assignModalSeatTitle');
  const zoneEl = document.getElementById('assignModalZoneBadge');
  const nameInput = document.getElementById('assignModalName');
  const phoneInput = document.getElementById('assignModalPhone');
  const confirmBtn = document.getElementById('assignModalSubmit');

  if (titleEl) titleEl.textContent = `좌석 ${seat.seat_number} 배정`;
  if (zoneEl) {
    zoneEl.textContent = seat.zone_type;
    zoneEl.className = `sc-badge zone-${seat.zone_type.toLowerCase()}`;
  }

  // 로그인 유저 정보 프리필 (테스트 원활화를 위해 미입력 시 테스트 회원 기본값 제공)
  if (nameInput) nameInput.value = (currentUser && (currentUser.full_name || currentUser.name)) || '테스트 회원';
  if (phoneInput) phoneInput.value = (currentUser && (currentUser.phone || currentUser.id)) || '010-5555-4444';

  // 이용권 상태 동적 박스 제어
  let ticketStatusEl = document.getElementById('assignModalTicketStatus');
  if (!ticketStatusEl) {
    ticketStatusEl = document.createElement('div');
    ticketStatusEl.id = 'assignModalTicketStatus';
    const formBody = modal.querySelector('.sc-modal-body');
    if (formBody) {
      formBody.insertBefore(ticketStatusEl, confirmBtn);
    }
  }

  const remDesc = activeTicket && activeTicket.remaining_minutes 
    ? `${Math.round(activeTicket.remaining_minutes / 60)}시간 (${activeTicket.remaining_minutes}분)` 
    : '기간 내 무제한';
  const ticketName = activeTicket ? activeTicket.ticket_type : '유효 이용권';

  ticketStatusEl.innerHTML = `
    <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);border-radius:10px;padding:0.75rem 1rem;display:flex;align-items:center;gap:0.6rem;margin-top:0.4rem;">
      <span style="font-size:1.4rem;">🎟️</span>
      <div style="font-size:0.82rem;color:#6ee7b7;line-height:1.4;">
        <strong>결제된 이용권 적용:</strong> ${ticketName} (잔여: ${remDesc})<br/>
        <span style="color:#a7f3d0;font-size:0.75rem;">⚡ 배정 완료 즉시 스마트 도어락이 5초간 자동 개방됩니다.</span>
      </div>
    </div>
  `;
  confirmBtn.textContent = '🚀 입실 및 좌석 배정 완료 (출입문 5초 개방 🔓)';
  confirmBtn.style.background = 'linear-gradient(135deg, #10b981, #06b6d4)';

  modal.classList.add('open');

  const handleConfirm = async () => {
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const privacyCheck = document.getElementById('assignModalPrivacyConsent');

    if (privacyCheck && !privacyCheck.checked) {
      showToast('개인정보 수집 및 이용(출입문/야간안전)에 동의해 주세요.', 'warning');
      return;
    }

    if (!name || !phone) {
      showToast('이름과 연락처를 모두 입력해 주세요.', 'warning');
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = '배정 처리 중...';
    try {
      await onConfirm({
        seatNumber: seat.seat_number,
        name,
        phone,
        userId: currentUser ? currentUser.id : null
      });
      closeModal('assignModal');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = '🚀 입실 및 좌석 배정 완료 (출입문 5초 개방 🔓)';
      confirmBtn.removeEventListener('click', handleConfirm);
    }
  };

  confirmBtn.onclick = handleConfirm;
}

// 2. 좌석 이용 관리 모달 (외출 vs 퇴실 선택)
export function openLeaveModal(seat, currentUser, { onStepOut, onLeave, onStepIn, onManagedCheckout }) {
  const isStepOut = seat.status === 'STEP_OUT' || seat.is_step_out;
  const isManaged = seat.current_user_type === 'MANAGED' || seat.user_type === 'MANAGED';

  let existing = document.getElementById('seatActionModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'seatActionModal';
  modal.className = 'sc-modal-backdrop open';

  if (isStepOut) {
    // 외출 중일 때: 복귀(재입실) or 퇴실
    modal.innerHTML = `
      <div class="sc-modal" style="max-width:400px;">
        <div class="sc-modal-header">
          <h3 class="sc-modal-title">☕ 외출 중 좌석 관리 (${seat.seat_number})</h3>
          <button class="sc-modal-close" onclick="document.getElementById('seatActionModal').remove()">✕</button>
        </div>
        <div class="sc-modal-body" style="display:flex;flex-direction:column;gap:1rem;">
          <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);padding:1rem;border-radius:12px;text-align:center;">
            <div style="font-size:1.6rem;margin-bottom:0.3rem">🚶‍♂️</div>
            <div style="font-weight:700;color:#f59e0b">현재 외출(자리비움) 중입니다</div>
            <div style="font-size:0.85rem;color:var(--text-muted);margin-top:0.3rem">복귀 시 스마트 출입문이 5초간 자동으로 열립니다.</div>
          </div>
          <button id="btnStepInModal" class="sc-modal-submit-btn" style="background:#10b981;font-weight:700;" type="button">
            🔓 복귀 및 스마트 출입문 열기
          </button>
          <button id="btnFinalLeaveModal" class="btn-seat-action leave" style="width:100%;padding:0.75rem;border-radius:10px;border:none;cursor:pointer;" type="button">
            🚪 외출 취소하고 완전 퇴실하기
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btnStepInModal').onclick = async () => {
      modal.remove();
      if (onStepIn) await onStepIn(seat.seat_number);
    };
    document.getElementById('btnFinalLeaveModal').onclick = async () => {
      modal.remove();
      if (isManaged && onManagedCheckout) {
        openDailyProgressModal(seat, onManagedCheckout);
      } else {
        await onLeave(seat.seat_number);
      }
    };
    return;
  }

  // 일반 이용 중일 때: 잠시 외출(60분) vs 퇴실
  modal.innerHTML = `
    <div class="sc-modal" style="max-width:420px;">
      <div class="sc-modal-header">
        <h3 class="sc-modal-title">🪑 좌석 이용 상태 선택 (${seat.seat_number})</h3>
        <button class="sc-modal-close" onclick="document.getElementById('seatActionModal').remove()">✕</button>
      </div>
      <div class="sc-modal-body" style="display:flex;flex-direction:column;gap:1.2rem;">
        <div style="background:rgba(255,255,255,0.04);padding:0.85rem 1rem;border-radius:12px;border:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:0.85rem;color:var(--text-muted)">이용자 / 구역</div>
            <div style="font-weight:700;color:#fff">${seat.user_name || seat.current_user_name || '회원'} 님 (${seat.zone_type}존)</div>
          </div>
          <span class="sc-badge ${isManaged ? 'zone-focus' : 'zone-normal'}">${isManaged ? '관리형' : '일반'}</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
          <!-- 1) 잠시 외출 버튼 -->
          <button id="btnStepOutModal" type="button" style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);color:#f59e0b;padding:1.1rem 0.5rem;border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:0.4rem;transition:all 0.2s;">
            <span style="font-size:1.8rem">☕</span>
            <span style="font-weight:700;font-size:0.95rem">잠시 외출</span>
            <span style="font-size:0.75rem;color:var(--text-muted)">최대 60분 좌석 유지</span>
          </button>

          <!-- 2) 오늘 퇴실 버튼 -->
          <button id="btnLeaveModal" type="button" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#ef4444;padding:1.1rem 0.5rem;border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:0.4rem;transition:all 0.2s;">
            <span style="font-size:1.8rem">🚪</span>
            <span style="font-weight:700;font-size:0.95rem">이용 종료 (퇴실)</span>
            <span style="font-size:0.75rem;color:var(--text-muted)">좌석 반납 & 시간 정산</span>
          </button>
        </div>

        <p style="font-size:0.75rem;color:var(--text-dim);text-align:center;margin:0;">
          * 외출 시 식사 및 휴식을 위해 60분간 좌석이 보존되며 순공 타이머가 일시정지됩니다.
        </p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btnStepOutModal').onclick = async () => {
    modal.remove();
    if (onStepOut) await onStepOut(seat.seat_number);
  };

  document.getElementById('btnLeaveModal').onclick = async () => {
    modal.remove();
    if (isManaged && onManagedCheckout) {
      openDailyProgressModal(seat, onManagedCheckout);
    } else {
      await onLeave(seat.seat_number);
    }
  };
}

// 3. 관리형 회원 퇴실 시 [10초 컷 오늘 마친 페이지 입력] 모달
export function openDailyProgressModal(seat, onConfirm) {
  let existing = document.getElementById('dailyProgressModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'dailyProgressModal';
  modal.className = 'sc-modal-backdrop open';

  modal.innerHTML = `
    <div class="sc-modal" style="max-width:440px;">
      <div class="sc-modal-header">
        <h3 class="sc-modal-title">📝 오늘 마친 페이지 입력 (10초 컷)</h3>
        <button class="sc-modal-close" onclick="document.getElementById('dailyProgressModal').remove()">✕</button>
      </div>
      <div class="sc-modal-body" style="display:flex;flex-direction:column;gap:1rem;">
        <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);padding:0.75rem;border-radius:10px;font-size:0.82rem;color:#93c5fd;">
          💡 오늘 실제로 마친 <strong>끝 페이지</strong>만 숫자로 입력해 주세요. (PPH 자동 연산 및 내일 진도 리밸런싱)
        </div>

        <div style="display:flex;flex-direction:column;gap:0.75rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.03);padding:0.6rem 0.8rem;border-radius:8px;">
            <span style="font-weight:700;color:#fff">📐 수학 (시작 25p)</span>
            <input id="pageMath" type="number" class="sc-form-input" style="width:90px;text-align:center;padding:0.4rem;" value="38" placeholder="끝 쪽">
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.03);padding:0.6rem 0.8rem;border-radius:8px;">
            <span style="font-weight:700;color:#fff">🔤 영어 (시작 18p)</span>
            <input id="pageEng" type="number" class="sc-form-input" style="width:90px;text-align:center;padding:0.4rem;" value="28" placeholder="끝 쪽">
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.03);padding:0.6rem 0.8rem;border-radius:8px;">
            <span style="font-weight:700;color:#fff">📖 국어 (시작 30p)</span>
            <input id="pageKor" type="number" class="sc-form-input" style="width:90px;text-align:center;padding:0.4rem;" value="44" placeholder="끝 쪽">
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.03);padding:0.6rem 0.8rem;border-radius:8px;">
            <span style="font-weight:700;color:#fff">🔬 탐구 (시작 40p)</span>
            <input id="pageSci" type="number" class="sc-form-input" style="width:90px;text-align:center;padding:0.4rem;" value="55" placeholder="끝 쪽">
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.03);padding:0.6rem 0.8rem;border-radius:8px;">
            <span style="font-weight:700;color:#fff">📜 한국사 (시작 50p)</span>
            <input id="pageHist" type="number" class="sc-form-input" style="width:90px;text-align:center;padding:0.4rem;" value="68" placeholder="끝 쪽">
          </div>
        </div>

        <button id="btnSubmitDailyProgress" class="sc-modal-submit-btn" type="button">
          🚀 실적 제출 & 스마트 퇴실 완료
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btnSubmitDailyProgress').onclick = async () => {
    const pages = {
      math: parseInt(document.getElementById('pageMath').value) || 0,
      english: parseInt(document.getElementById('pageEng').value) || 0,
      korean: parseInt(document.getElementById('pageKor').value) || 0,
      science: parseInt(document.getElementById('pageSci').value) || 0,
      history: parseInt(document.getElementById('pageHist').value) || 0
    };
    modal.remove();
    await onConfirm(seat.seat_number, pages);
  };
}

// 4. 이용권 구매 모달 (테스트 모의 결제 즉시 승인)
export function openPurchaseModal(plan, currentUser, onConfirm) {
  let modal = document.getElementById('purchaseModal');
  if (!modal) return;

  const planName = document.getElementById('purchPlanName');
  const planPrice = document.getElementById('purchPlanPrice');
  const planDesc = document.getElementById('purchPlanDesc');
  const confirmBtn = document.getElementById('purchConfirmBtn');

  const isManaged = plan.type === 'managed' || (plan.name && plan.name.includes('관리형')) || (plan.plan_id && plan.plan_id.includes('managed'));

  if (planName) planName.textContent = plan.name;
  if (planPrice) planPrice.textContent = `${plan.price.toLocaleString()}원`;
  if (planDesc) {
    planDesc.innerHTML = `
      <div style="font-size:0.83rem;color:#cbd5e1;line-height:1.45;margin-bottom:0.5rem;">
        ${plan.desc || `유효 시간: ${Math.round(plan.duration_minutes / 60)}시간 | 즉시 이용 가능`}
      </div>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
        <span style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.25rem 0.55rem;border-radius:6px;font-size:0.75rem;font-weight:700;background:${isManaged ? 'rgba(16,185,129,0.18)' : 'rgba(56,189,248,0.15)'};color:${isManaged ? '#34d399' : '#38bdf8'};border:1px solid ${isManaged ? 'rgba(16,185,129,0.35)' : 'rgba(56,189,248,0.3)'};">
          ${isManaged ? '🔒 FOCUS 전용 고정석 (자동 입실)' : '🪑 일반 자유석 (직접 선택)'}
        </span>
        <span style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.25rem 0.55rem;border-radius:6px;font-size:0.75rem;font-weight:700;background:${isManaged ? 'rgba(99,102,241,0.2)' : 'rgba(239,68,68,0.15)'};color:${isManaged ? '#a5b4fc' : '#f87171'};border:1px solid ${isManaged ? 'rgba(99,102,241,0.4)' : 'rgba(239,68,68,0.3)'};">
          ${isManaged ? '🟢 자주학습 LMS 풀패키지' : '⛔ 자주학습 LMS 연동 제한 (자율 독서)'}
        </span>
      </div>
    `;
  }

  confirmBtn.disabled = false;
  confirmBtn.textContent = '💳 결제하기 (테스트 즉시 승인)';
  modal.classList.add('open');

  const handlePurch = async () => {
    const consentCheck = document.getElementById('purchPrivacyConsent');
    if (consentCheck && !consentCheck.checked) {
      showToast('개인정보 수집 및 이용 동의가 필요합니다.', 'warning');
      return;
    }

    // 🎯 테스트 편의를 위해 모달을 즉시 닫고 결제 완료로 간주하여 다음 단계로 직행!
    closeModal('purchaseModal');
    confirmBtn.disabled = false;
    confirmBtn.textContent = '💳 결제하기 (테스트 즉시 승인)';
    confirmBtn.onclick = null;

    try {
      if (onConfirm) {
        await onConfirm(plan);
      }
    } catch (e) {
      console.warn('Purchase callback notice:', e);
    }
  };

  confirmBtn.onclick = handlePurch;
}

// 5. 학부모 안심 웹 포털 1-클릭 공유 모달 (Zero-Message Onboarding)
export function openParentShareModal(studentName, phone) {
  const modal = document.getElementById('parentShareModal');
  if (!modal) return;

  const studentNameEl = document.getElementById('shareStudentName');
  const qrImageEl = document.getElementById('shareQrImage');
  const urlInput = document.getElementById('shareUrlInput');
  const copyBtn = document.getElementById('btnCopyShareUrl');
  const directBtn = document.getElementById('btnOpenParentDirect');

  const origin = window.location.origin;
  const parentUrl = `${origin}/studycafe/parent.html?phone=${encodeURIComponent(phone || '')}`;

  if (studentNameEl) studentNameEl.textContent = studentName || '회원';
  if (urlInput) urlInput.value = parentUrl;
  if (qrImageEl) {
    qrImageEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(parentUrl)}`;
  }

  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(parentUrl);
        showToast('📋 학부모 안심 포털 링크가 복사되었습니다! 카카오톡/문자로 공유하세요.', 'success');
        copyBtn.textContent = '✅ 복사됨!';
        setTimeout(() => { copyBtn.textContent = '📋 복사'; }, 2500);
      } catch (err) {
        urlInput.select();
        document.execCommand('copy');
        showToast('📋 링크가 복사되었습니다.', 'success');
      }
    };
  }

  if (directBtn) {
    directBtn.onclick = () => {
      window.open(parentUrl, '_blank');
    };
  }

  modal.classList.add('open');
}

// 모달 닫기
export function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('open');
}

// 🎯 당일권 / 일반 정기권 회원의 자기주도학습 LMS 연동 차단 안내 모달
export function openLmsRestrictedModal(ticketType = '당일권 / 일반 정기권', onUpgrade = null) {
  let existing = document.getElementById('lmsRestrictedModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'lmsRestrictedModal';
  modal.className = 'sc-modal-backdrop open';
  modal.style.zIndex = '99999';
  modal.innerHTML = `
    <div class="sc-modal" style="max-width:480px;text-align:center;">
      <div class="sc-modal-header" style="justify-content:center;position:relative;">
        <span style="font-size:2.6rem;">🔒</span>
        <button class="sc-modal-close" style="position:absolute;right:1rem;top:1rem;" onclick="document.getElementById('lmsRestrictedModal').remove()">✕</button>
      </div>
      <div style="display:inline-block;background:rgba(239,68,68,0.15);color:#f87171;font-size:0.8rem;font-weight:700;padding:0.25rem 0.75rem;border-radius:20px;margin-bottom:0.75rem;border:1px solid rgba(239,68,68,0.3)">
        관리형 회원 (SelfStudy OS) 전용 혜택
      </div>
      <h3 style="font-size:1.25rem;font-weight:800;color:#fff;margin-bottom:0.6rem;">자기주도학습 LMS 연동 차단</h3>
      <p style="font-size:0.88rem;color:var(--text-muted);line-height:1.55;margin-bottom:1.2rem;">
        현재 회원님은 <strong>${ticketType}</strong> 이용 중입니다.<br/>
        <span style="color:#f87171;font-weight:600;">당일권 및 일반 정기권 회원은 LMS 연동 기능 사용이 제한됩니다.</span><br/>
        AI 맞춤 진도 오더 배분 및 실시간 PPH 리밸런싱은 <strong>'4주 관리형 프리미엄 패스'</strong> 또는 <strong>'12주 D-day 올인원 패스'</strong>에서만 제공됩니다.
      </p>

      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:12px;padding:1rem;text-align:left;margin-bottom:1.3rem;">
        <div style="font-weight:700;color:#cbd5e1;font-size:0.85rem;margin-bottom:0.4rem">✨ 관리형 회원 전용 포함 혜택:</div>
        <ul style="margin:0;padding-left:1.2rem;font-size:0.8rem;color:var(--text-muted);line-height:1.65;">
          <li>전용 고정 좌석 배정 (자리 배정 없이 즉시 입실)</li>
          <li>SelfStudy AI 1:1 맞춤형 진도 오더 & PPH 리밸런싱</li>
          <li>학부모 실시간 안심 알림 웹 포털 연동</li>
        </ul>
      </div>

      <div style="display:flex;gap:0.75rem;">
        <button id="btnUpgradeModalAction" class="sc-modal-submit-btn" style="flex:1;background:linear-gradient(135deg, #6366f1, #38bdf8);font-weight:700;" type="button">
          ⭐ 관리형 패스로 업그레이드
        </button>
        <button class="btn-seat-action" style="padding:0.75rem 1rem;border-radius:10px;" type="button" onclick="document.getElementById('lmsRestrictedModal').remove()">
          닫기
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const upgradeBtn = document.getElementById('btnUpgradeModalAction');
  if (upgradeBtn) {
    upgradeBtn.onclick = () => {
      modal.remove();
      if (onUpgrade) onUpgrade();
    };
  }
}
