// apps/studycafe/frontend/app.js
// 스터디카페 프론트엔드 메인 오케스트레이터 (SaaS 템플릿 표준 준수)

import { MQnetAuth } from '/shared/ui/auth.js?v=2.0';
import {
  state,
  isSameDayTicket,
  isActiveNonSameDayTicket,
  isFixedSeatManagedTicket,
  isLmsAllowed
} from './js/state.js?v=2.2';
import {
  fetchSeats, fetchMySeat, assignSeat, leaveSeat,
  fetchTicketPlans, purchaseTicket, fetchMyActiveTicket, triggerDoor, fetchAiCongestion,
  stepOutSeat, stepInSeat, submitDailyCheckoutResult, cleanupExpiredSeats, fetchDoorStatus,
  autoAssignFixedSeat
} from './js/api.js?v=2.2';
import {
  renderStatsBar, renderSeatGrid, renderTicketPlans,
  renderDoorPass, renderSelfstudyTab
} from './js/ui.js?v=2.0';
import {
  showToast, openAssignModal, openLeaveModal, openPurchaseModal, openParentShareModal,
  openLmsRestrictedModal, closeModal
} from './js/modals.js?v=2.2';

// ── DOM 캐싱 ─────────────────────────────────────────────
const statsBarEl        = document.getElementById('statsBarContainer');
const seatGridEl        = document.getElementById('seatGridContainer');
const ticketPlansEl     = document.getElementById('ticketPlansContainer');
const doorPassEl        = document.getElementById('doorPassContainer');
const selfstudyEl       = document.getElementById('selfstudyContainer');
const mySeatBadgeEl     = document.getElementById('mySeatBadge');
const mySeatBadgeText   = document.getElementById('mySeatBadgeText');
const myTicketBadgeEl   = document.getElementById('myTicketBadge');
const myTicketBadgeText = document.getElementById('myTicketBadgeText');

// ── 1. 전체 데이터 갱신 ───────────────────────────────────
async function refreshSeats() {
  try {
    const data = await fetchSeats();
    state.seats = data.seats || [];
    state.totalSeats = data.total || 20;
    state.occupiedCount = data.occupied || 0;
    state.availableCount = data.available || (state.totalSeats - state.occupiedCount);

    // 내 좌석 조회 & 내 이용권(잔여시간) 조회
    await checkMySeat();
    await checkMyTicket();

    // ⚡ 통계 바 & 좌석 그리드 즉시 렌더링 (UI 대기 시간 0초)
    renderStatsBar(statsBarEl, {
      total: state.totalSeats,
      occupied: state.occupiedCount,
      available: state.availableCount,
      congestion: state.congestion
    });

    renderSeatGrid(seatGridEl, state.seats, state.selectedZone, state.mySeat, handleSeatClick);

    // 🤖 AI 혼잡도 예측은 백그라운드 비동기로 요청하여 완료 시 반영 (UI 블로킹 방지)
    fetchAiCongestion().then(aiData => {
      if (aiData && aiData.ai_prediction) {
        state.congestion = {
          status: aiData.ai_prediction.congestion_status || '쾌적',
          recommendation: aiData.ai_prediction.recommendation || ''
        };
        renderStatsBar(statsBarEl, {
          total: state.totalSeats,
          occupied: state.occupiedCount,
          available: state.availableCount,
          congestion: state.congestion
        });
      }
    }).catch(e => console.warn('AI 혼잡도 백그라운드 갱신:', e));
  } catch (err) {
    console.error('좌석 로드 에러:', err);
    showToast(err.message, 'error');
  }
}

// 내 좌석 정보 동기화
async function checkMySeat() {
  const user = state.currentUser;
  if (!user) {
    state.mySeat = null;
    updateMySeatBadge();
    return;
  }

  try {
    const res = await fetchMySeat(user.id, user.phone, user.full_name);
    if (res && res.has_seat && res.seat) {
      state.mySeat = res.seat;
    } else {
      state.mySeat = null;
    }
  } catch (e) {
    state.mySeat = null;
  }
  updateMySeatBadge();
}

// 🎟️ 내 보유 이용권(잔여 시간 및 유효 기간) 실시간 동기화
async function checkMyTicket() {
  const user = state.currentUser;
  if (!user) {
    if (!state.activeTicket) {
      updateMyTicketBadge();
    }
    return;
  }

  try {
    const res = await fetchMyActiveTicket(user.id, user.phone);
    if (res && res.has_active_ticket && res.active_ticket) {
      state.activeTicket = res.active_ticket;
    } else if (!state.activeTicket) {
      state.activeTicket = null;
    }
  } catch (e) {
    // 기존 활성 티켓 상태 유지
  }
  updateMyTicketBadge();
}

function updateMyTicketBadge() {
  if (!myTicketBadgeEl || !myTicketBadgeText) return;
  if (!state.currentUser) {
    myTicketBadgeEl.className = 'my-seat-pill none';
    return;
  }

  if (state.activeTicket) {
    const isManaged = isFixedSeatManagedTicket(state.activeTicket);
    const remDesc = state.activeTicket.remaining_minutes 
      ? `${Math.round(state.activeTicket.remaining_minutes / 60)}h` 
      : '기간권';
    myTicketBadgeEl.className = 'my-seat-pill';
    myTicketBadgeEl.style.background = isManaged ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.15)';
    myTicketBadgeEl.style.borderColor = isManaged ? 'rgba(99,102,241,0.5)' : 'rgba(16,185,129,0.4)';
    myTicketBadgeEl.style.color = isManaged ? '#a5b4fc' : '#34d399';
    myTicketBadgeText.textContent = `${isManaged ? '★고정석 ' : ''}${state.activeTicket.ticket_type} (${remDesc})`;
    myTicketBadgeEl.onclick = () => switchTab('tickets');
  } else {
    myTicketBadgeEl.className = 'my-seat-pill';
    myTicketBadgeEl.style.background = 'rgba(245,158,11,0.15)';
    myTicketBadgeEl.style.borderColor = 'rgba(245,158,11,0.4)';
    myTicketBadgeEl.style.color = '#fbbf24';
    myTicketBadgeText.textContent = '이용권 미보유 (선택 필요)';
    myTicketBadgeEl.onclick = () => switchTab('tickets');
  }
  updateSeatFlowNotice();
  updateNavTabsAccess();
}

function updateMySeatBadge() {
  if (!mySeatBadgeEl || !mySeatBadgeText) return;
  if (state.mySeat) {
    const isStepOut = state.mySeat.status === 'STEP_OUT' || state.mySeat.is_step_out;
    if (isStepOut) {
      const remMin = state.mySeat.remaining_step_out_minutes ?? 60;
      mySeatBadgeEl.className = 'my-seat-pill';
      mySeatBadgeEl.style.background = 'rgba(245,158,11,0.2)';
      mySeatBadgeEl.style.borderColor = 'rgba(245,158,11,0.5)';
      mySeatBadgeEl.style.color = '#f59e0b';
      mySeatBadgeText.textContent = `외출 중: ${state.mySeat.seat_number} (잔여 ${remMin}분)`;
    } else {
      mySeatBadgeEl.className = 'my-seat-pill';
      mySeatBadgeEl.style.background = '';
      mySeatBadgeEl.style.borderColor = '';
      mySeatBadgeEl.style.color = '';
      mySeatBadgeText.textContent = `배정석: ${state.mySeat.seat_number} (${state.mySeat.zone_type}존)`;
    }
  } else {
    mySeatBadgeEl.className = 'my-seat-pill none';
    mySeatBadgeEl.style.background = '';
    mySeatBadgeEl.style.borderColor = '';
    mySeatBadgeEl.style.color = '';
    mySeatBadgeText.textContent = '좌석 미배정';
  }
  updateSeatFlowNotice();
}

function updateSeatFlowNotice() {
  const noticeEl = document.getElementById('seatFlowNotice');
  const contentEl = document.getElementById('seatFlowNoticeContent');
  const actionBtn = document.getElementById('seatFlowNoticeActionBtn');
  if (!noticeEl || !contentEl || !actionBtn) return;

  if (!state.currentUser) {
    noticeEl.style.display = 'flex';
    noticeEl.style.background = 'rgba(59,130,246,0.1)';
    noticeEl.style.border = '1px solid rgba(59,130,246,0.3)';
    contentEl.innerHTML = `<span style="font-size:1.3rem">🔑</span><span style="color:#93c5fd;font-weight:600;">스터디카페 이용을 위해 먼저 로그인/회원가입해 주세요.</span>`;
    actionBtn.textContent = '로그인 / 가입';
    actionBtn.style.background = '#3b82f6';
    actionBtn.style.color = '#fff';
    actionBtn.onclick = () => MQnetAuth.openModal('login');
    return;
  }

  if (state.mySeat) {
    noticeEl.style.display = 'flex';
    noticeEl.style.background = 'rgba(99,102,241,0.12)';
    noticeEl.style.border = '1px solid rgba(99,102,241,0.35)';
    const statusText = state.mySeat.status === 'STEP_OUT' ? '외출(자리비움) 중' : '정상 이용 중';
    contentEl.innerHTML = `<span style="font-size:1.3rem">🪑</span><span style="color:#a5b4fc;font-weight:600;">현재 <strong>${state.mySeat.seat_number}</strong> 좌석 (${statusText})</span>`;
    actionBtn.textContent = '외출 / 퇴실 관리';
    actionBtn.style.background = '#6366f1';
    actionBtn.style.color = '#fff';
    actionBtn.onclick = () => handleSeatClick(state.mySeat);
    return;
  }

  if (!state.activeTicket) {
    // ⚠️ 이용권 미보유: 결제 우선 안내
    noticeEl.style.display = 'flex';
    noticeEl.style.background = 'rgba(245,158,11,0.12)';
    noticeEl.style.border = '1px solid rgba(245,158,11,0.35)';
    contentEl.innerHTML = `<span style="font-size:1.3rem">🎟️</span><span style="color:#fbbf24;font-weight:600;">보유 중인 이용권이 없습니다. 좌석 배정을 위해 먼저 <strong>이용권을 결제</strong>해 주세요.</span>`;
    actionBtn.textContent = '이용권 구매하러 가기 ➔';
    actionBtn.style.background = '#f59e0b';
    actionBtn.style.color = '#000';
    actionBtn.onclick = () => switchTab('tickets');
    return;
  }

  // ✨ 유효 이용권 보유: 좌석 안내
  const isManagedFixed = isFixedSeatManagedTicket(state.activeTicket);
  noticeEl.style.display = 'flex';
  if (isManagedFixed) {
    noticeEl.style.background = 'rgba(99,102,241,0.14)';
    noticeEl.style.border = '1px solid rgba(99,102,241,0.4)';
    contentEl.innerHTML = `<span style="font-size:1.3rem">⭐</span><span style="color:#a5b4fc;font-weight:600;"><strong>[${state.activeTicket.ticket_type}]</strong> 회원님은 전용 고정석이 배정됩니다. 아래 버튼으로 즉시 입실하세요.</span>`;
    actionBtn.textContent = '🚀 고정석 즉시 입실';
    actionBtn.style.background = 'linear-gradient(135deg, #6366f1, #38bdf8)';
    actionBtn.style.color = '#fff';
    actionBtn.onclick = async () => {
      try {
        const u = state.currentUser;
        const res = await autoAssignFixedSeat(u.id, u.phone, u.full_name || u.name);
        showToast(res.message || '고정석 입실이 완료되었습니다 (출입문 5초 개방 🔓)', 'success', 5000);
        await triggerDoor(1);
        await checkMySeat();
        await refreshSeats();
      } catch (e) {
        showToast(e.message, 'error');
      }
    };
  } else {
    noticeEl.style.background = 'rgba(16,185,129,0.12)';
    noticeEl.style.border = '1px solid rgba(16,185,129,0.35)';
    const remDesc = state.activeTicket.remaining_minutes ? `${Math.round(state.activeTicket.remaining_minutes / 60)}시간` : '기간 내 무제한';
    contentEl.innerHTML = `<span style="font-size:1.3rem">✨</span><span style="color:#34d399;font-weight:600;"><strong>[${state.activeTicket.ticket_type}]</strong> 잔여: ${remDesc} | 원하시는 빈 좌석을 터치하시면 즉시 배정됩니다.</span>`;
    actionBtn.textContent = '요금제 보기';
    actionBtn.style.background = 'rgba(255,255,255,0.1)';
    actionBtn.style.color = '#fff';
    actionBtn.onclick = () => switchTab('tickets');
  }

  // 학부모 안심 포털 링크 동적 동기화
  const userPhone = (state.currentUser && state.currentUser.phone) || '010-5555-4444';
  const parentUrl = `./parent.html?phone=${encodeURIComponent(userPhone)}`;
  const quickLink = document.getElementById('quickParentLink');
  const navLink = document.getElementById('navParentLink');
  if (quickLink) quickLink.href = parentUrl;
  if (navLink) navLink.href = parentUrl;
}

// ── 2. 좌석 클릭 핸들러 ───────────────────────────────────
function handleSeatClick(seat) {
  const isStepOut = seat.status === 'STEP_OUT' || seat.is_step_out;
  const isOccupied = seat.is_occupied || seat.status === 'OCCUPIED' || isStepOut;
  const isMySeat = state.mySeat && state.mySeat.seat_number === seat.seat_number;

  // 1) 내 좌석인 경우 -> 외출/재입실/퇴실 모달
  if (isMySeat) {
    openLeaveModal(seat, state.currentUser, {
      onStepOut: async (seatNum) => {
        try {
          const res = await stepOutSeat(seatNum);
          showToast(`☕ [외출 완료] ${seatNum} 좌석이 외출 상태로 전환되었습니다 (최대 60분).`, 'info', 4000);
          await refreshSeats();
        } catch (e) {
          showToast(e.message, 'error');
        }
      },
      onStepIn: async (seatNum) => {
        try {
          const res = await stepInSeat(seatNum);
          showToast(`🔓 [복귀 완료] ${seatNum} 좌석으로 복귀하였습니다 (출입문 5초 개방).`, 'success', 4000);
          await refreshSeats();
        } catch (e) {
          showToast(e.message, 'error');
        }
      },
      onLeave: async (seatNum) => {
        try {
          const res = await leaveSeat(seatNum);
          showToast(`✅ [퇴실 완료] 좌석 ${seatNum} 반납 및 시간 정산이 완료되었습니다.`, 'success', 4000);
          state.mySeat = null;
          await refreshSeats();
        } catch (e) {
          showToast(e.message, 'error');
        }
      },
      onManagedCheckout: async (seatNum, pages) => {
        try {
          showToast('🚀 일일 학습 실적 제출 및 PPH 리밸런싱 중...', 'info', 2000);
          const res = await submitDailyCheckoutResult(seatNum, pages);
          showToast(`🎉 [퇴실 완료] ${res.selfstudy_message || '퇴실 및 진도 갱신이 완료되었습니다.'}`, 'success', 4500);
          state.mySeat = null;
          await refreshSeats();
        } catch (e) {
          showToast(e.message, 'error');
        }
      }
    });
    return;
  }

  // 2) 이미 다른 사람이 이용 중인 경우
  if (isOccupied) {
    const statusDesc = isStepOut ? '외출(자리비움) 중' : '이용 중';
    showToast(`좌석 [${seat.seat_number}]는 현재 ${statusDesc}입니다 (${seat.user_name || '회원'}).`, 'warning');
    return;
  }

  // 3) 빈 좌석인 경우 -> 결제 우선(Payment-First) 확인 후 배정
  // A. 로그인 여부 먼저 확인
  if (!state.currentUser) {
    showToast('🔑 스터디카페 이용을 위해 먼저 로그인/회원가입해 주세요.', 'info');
    MQnetAuth.openModal('login');
    return;
  }

  // B. 이용권 보유 여부 확인 (결제된 사람만 좌석 배정!)
  if (!state.activeTicket) {
    showToast('🎟️ 좌석을 배정받으려면 먼저 이용권이 필요합니다. 이용권 요금제를 선택해 주세요.', 'warning', 4500);
    switchTab('tickets');
    return;
  }

  // C. 유효 이용권 보유자: 원스톱 1-클릭 배정 모달 오픈!
  openAssignModal(
    seat,
    state.currentUser,
    state.activeTicket,
    async ({ seatNumber, name, phone, userId }) => {
      try {
        const res = await assignSeat(seatNumber, phone, name, null, userId);
        showToast(res.message || `좌석 [${seatNumber}] 배정이 완료되었습니다! (출입문 5초 개방 🔓)`, 'success', 4500);
        await refreshSeats();
        await triggerDoor(1); // 출입문 자동 개방
        openParentShareModal(name, phone); // 학부모 안심 웹 링크 QR & 복사 모달 제공
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  );
}

// ── 3. 이용권 탭 갱신 ─────────────────────────────────────
async function loadTickets() {
  try {
    const data = await fetchTicketPlans();
    state.tickets = data.plans || [];
    renderTicketPlans(ticketPlansEl, state.tickets, handlePurchaseClick);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function handlePurchaseClick(plan) {
  openPurchaseModal(plan, state.currentUser, async (selectedPlan) => {
    const targetPlan = selectedPlan || plan;

    // 🎯 [테스트 결제 완료 즉시 처리]
    // 1) 비로그인 상태일 경우 테스트 회원을 자동 생성/부여하여 좌석 배정 플로우 즉시 진행
    if (!state.currentUser) {
      state.currentUser = {
        id: 'test-user',
        name: '테스트 회원',
        full_name: '테스트 회원',
        phone: '010-5555-4444',
        user_type: (targetPlan.type === 'managed' || (targetPlan.name && targetPlan.name.includes('관리형'))) ? 'MANAGED' : 'GENERAL'
      };
      try {
        localStorage.setItem('mqnet_auth_user', JSON.stringify(state.currentUser));
      } catch (e) {}
    } else {
      if (targetPlan.type === 'managed' || (targetPlan.name && targetPlan.name.includes('관리형'))) {
        state.currentUser.user_type = 'MANAGED';
      }
    }

    // 2) state.activeTicket 즉시 충전 (UI 즉시 반영)
    const remMin = targetPlan.duration_minutes || 40320;
    state.activeTicket = {
      id: 'ticket-mock-' + Date.now(),
      ticket_type: targetPlan.name,
      duration_minutes: remMin,
      remaining_minutes: remMin,
      valid_until: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
      is_active: true,
      price: targetPlan.price
    };

    updateMyTicketBadge();
    updateSeatFlowNotice();

    // 3) 백엔드 DB에도 비동기 동기화 (백엔드 처리 시간과 상관없이 프론트는 즉시 진행)
    const userId = state.currentUser ? state.currentUser.id : 'test-user';
    const userPhone = state.currentUser ? state.currentUser.phone : '010-5555-4444';
    purchaseTicket(targetPlan.plan_id, userId, userPhone).then(res => {
      if (res && res.ticket) {
        state.activeTicket.id = res.ticket.id;
      }
    }).catch(err => {
      console.warn('Backend ticket purchase sync:', err);
    });

    // 4) 결제 완료 피드백 및 자동 분기 (고정석 회원은 자리 배정도 건너뜀!)
    const isFixed = targetPlan.type === 'managed' || (targetPlan.name && targetPlan.name.includes('관리형')) || targetPlan.plan_id === 'managed_4w' || targetPlan.plan_id === 'managed_12w';
    if (isFixed) {
      showToast(`🎉 [${targetPlan.name}] 결제 완료! 전용 고정석으로 자동 배정 및 입실 처리 중...`, 'success', 4000);
      try {
        const autoRes = await autoAssignFixedSeat(userId, userPhone, state.currentUser.full_name || state.currentUser.name);
        showToast(autoRes.message || `🎉 전용 고정 좌석 [${autoRes.seat_number}] 자동 배정 완료! (출입문 5초 개방 🔓)`, 'success', 6000);
        await triggerDoor(1);
        await checkMySeat();
        await refreshSeats();
      } catch (e) {
        console.warn('Auto assign error on purchase:', e);
      }
      switchTab('seats');
    } else {
      showToast(`🎉 [${targetPlan.name}] 이용권 결제 완료! 이제 이용하실 빈 좌석을 선택해 주세요.`, 'success', 5000);
      switchTab('seats');
      await refreshSeats();
    }
  });
}

// ── 4. 스마트 출입문 탭 갱신 ──────────────────────────────
function renderDoor() {
  renderDoorPass(doorPassEl, state.currentUser, state.mySeat, state.doorStatus, handleDoorUnlock);
}

async function handleDoorUnlock() {
  if (state.doorStatus.isOpen) return;

  try {
    showToast('🚪 스마트 도어락 개방 신호 전송 중...', 'info', 2000);
    const res = await triggerDoor(1);
    
    state.doorStatus.isOpen = true;
    state.doorStatus.remainingSeconds = 5;
    renderDoor();
    showToast(`🔓 ${res.message || '출입문이 5초간 개방되었습니다.'}`, 'success');

    const countdown = setInterval(() => {
      state.doorStatus.remainingSeconds -= 1;
      if (state.doorStatus.remainingSeconds <= 0) {
        clearInterval(countdown);
        state.doorStatus.isOpen = false;
        renderDoor();
        showToast('🔒 출입문이 정상 잠금되었습니다.', 'info', 2500);
      } else {
        renderDoor();
      }
    }, 1000);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── 5. 자기주도학습 탭 갱신 ───────────────────────────────
function renderSelfstudy() {
  renderSelfstudyTab(
    selfstudyEl,
    state.mySeat,
    state.currentUser,
    (action) => {
      if (!state.mySeat) return;
      if (action === 'step-out') {
        stepOutSeat(state.mySeat.seat_number).then(() => {
          showToast('☕ [외출 완료] 외출 상태로 전환되었습니다.', 'info');
          refreshSeats().then(renderSelfstudy);
        });
      } else if (action === 'leave') {
        handleSeatClick(state.mySeat);
      }
    },
    state.activeTicket,
    () => switchTab('tickets')
  );
}

// ── 5-1. 자기주도학습 탭 락 배지 동적 갱신 ────────────────
function updateNavTabsAccess() {
  const selfstudyBtn = document.getElementById('navTabSelfstudy');
  const selfstudyText = document.getElementById('navTabSelfstudyText');
  if (!selfstudyBtn || !selfstudyText) return;

  const allowed = isLmsAllowed(state.currentUser, state.activeTicket);
  if (allowed) {
    selfstudyText.innerHTML = `자기주도 학습실 <span style="background:rgba(16,185,129,0.25);color:#34d399;font-size:0.68rem;padding:2px 6px;border-radius:4px;margin-left:4px;border:1px solid rgba(16,185,129,0.4)">★ 관리형</span>`;
  } else {
    selfstudyText.innerHTML = `자기주도 학습실 <span style="background:rgba(239,68,68,0.2);color:#f87171;font-size:0.68rem;padding:2px 6px;border-radius:4px;margin-left:4px;border:1px solid rgba(239,68,68,0.35)">🔒 관리형 전용</span>`;
  }
}

// ── 6. 탭 전환 제어 ───────────────────────────────────────
function switchTab(tabId) {
  state.activeTab = tabId;

  // 🎯 당일권/정기권 회원이 LMS 탭 클릭 시 친절한 차단 모달 노출
  if (tabId === 'selfstudy' && !isLmsAllowed(state.currentUser, state.activeTicket)) {
    const tName = (state.activeTicket && state.activeTicket.ticket_type) ? state.activeTicket.ticket_type : '당일권 / 일반 정기권';
    openLmsRestrictedModal(tName, () => switchTab('tickets'));
  }

  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  const sections = {
    seats: document.getElementById('tabSeats'),
    tickets: document.getElementById('tabTickets'),
    door: document.getElementById('tabDoor'),
    selfstudy: document.getElementById('tabSelfstudy')
  };

  Object.keys(sections).forEach(key => {
    if (sections[key]) {
      sections[key].style.display = (key === tabId) ? 'block' : 'none';
    }
  });

  if (tabId === 'seats') refreshSeats();
  else if (tabId === 'tickets') loadTickets();
  else if (tabId === 'door') renderDoor();
  else if (tabId === 'selfstudy') renderSelfstudy();
}

// ── 7. 구역 필터링 이벤트 ─────────────────────────────────
function setupZoneFilters() {
  document.querySelectorAll('.zone-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.zone-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedZone = btn.dataset.zone;
      renderSeatGrid(seatGridEl, state.seats, state.selectedZone, state.mySeat, handleSeatClick);
    });
  });
}

// ── 8. 데스크 QR 스캔 딥링크 감지 (?seat=A-05) ─────────────
function checkDeskQrDeepLink() {
  const urlParams = new URLSearchParams(window.location.search);
  const targetSeatNum = urlParams.get('seat');
  if (!targetSeatNum) return;

  const found = state.seats.find(s => s.seat_number === targetSeatNum);
  if (found) {
    showToast(`📱 데스크 QR 인식 완료: 좌석 [${targetSeatNum}]`, 'info', 3000);
    setTimeout(() => {
      handleSeatClick(found);
    }, 400);
  }
}

// ── 8-1. 로그인 / 상태 변경 시 맞춤 자동 분기 처리 ────────
async function handleUserLoginOrStateChange(user) {
  if (!user) {
    state.activeTicket = null;
    state.mySeat = null;
    updateMyTicketBadge();
    updateMySeatBadge();
    updateNavTabsAccess();
    await refreshSeats();
    switchTab('tickets');
    return;
  }

  await checkMyTicket();
  await checkMySeat();
  await refreshSeats();
  updateNavTabsAccess();

  // 1️⃣ 당일권이 아닌 회원으로 유효 사용기간 중인 경우 판정
  const isNonSameDay = isActiveNonSameDayTicket(state.activeTicket);
  const isFixedManaged = isFixedSeatManagedTicket(state.activeTicket);

  if (isNonSameDay) {
    // 🎯 [요구사항 1] 당일권이 아닌 회원은 login 시 이용권 구매를 건너뜀!
    // 🎯 [요구사항 2] 4주 관리형 프리미엄 패스, 12주 D-day 올인원 패스는 자리 배정도 건너뜀!
    if (isFixedManaged) {
      if (!state.mySeat) {
        try {
          const autoRes = await autoAssignFixedSeat(user.id, user.phone, user.full_name || user.name);
          if (autoRes && autoRes.success) {
            showToast(autoRes.message || `🎉 [${state.activeTicket.ticket_type}] 전용 고정석 [${autoRes.seat_number}] 자동 배정 완료! (출입문 5초 개방 🔓)`, 'success', 6000);
            await triggerDoor(1);
            await checkMySeat();
            await refreshSeats();
          }
        } catch (e) {
          console.warn('Auto fixed seat error:', e);
          showToast(e.message, 'warning');
        }
      } else {
        showToast(`👋 [${state.activeTicket.ticket_type}] 전용 고정석 [${state.mySeat.seat_number}] 이용 중입니다.`, 'info', 3000);
      }
      // 좌석 화면으로 즉시 직행 (이용권 구매 및 자리 배정 모두 건너뜀!)
      switchTab('seats');
    } else {
      // 일반 정기권 / 충전권 / 기간권 (50시간권, 100시간권, 4주 일반 자유석):
      // 이용권 구매는 건너뛰고 바로 빈 좌석 선택 화면으로 이동!
      if (!state.mySeat) {
        showToast(`🎫 [${state.activeTicket.ticket_type}] 이용 중! 이용권 구매를 건너뛰고 원하시는 빈 좌석을 선택해 주세요.`, 'info', 4500);
      }
      switchTab('seats');
    }
  } else {
    // 당일권(2h, 4h)이거나 이용권 미보유자:
    if (!state.mySeat) {
      if (!state.activeTicket) {
        showToast(`👋 환영합니다, ${user.full_name || '회원'}님! 이용권을 먼저 선택해 주세요.`, 'info', 4000);
        switchTab('tickets');
      } else {
        // 이미 유효한 당일권 시간 남아있는 경우
        switchTab('seats');
      }
    } else {
      switchTab('seats');
    }
  }

  if (state.activeTab === 'door') renderDoor();
  if (state.activeTab === 'selfstudy') renderSelfstudy();
}

// ── 9. 초기화 ─────────────────────────────────────────────
async function init() {
  // 🔑 MQnet 통합 인증 초기화 및 배지 부착
  MQnetAuth.init({
    appId: 'studycafe',
    autoPrompt: true,
    onAuthChange: async (user) => {
      state.currentUser = user;
      await handleUserLoginOrStateChange(user);
    }
  });
  MQnetAuth.renderBadge('userAuthBadge');

  state.currentUser = MQnetAuth.getUser();
  if (state.currentUser) {
    await handleUserLoginOrStateChange(state.currentUser);
  } else {
    updateNavTabsAccess();
    switchTab('tickets');
  }

  // 탭 클릭 이벤트 바인딩
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  setupZoneFilters();

  // 데스크 QR 파라미터 확인
  checkDeskQrDeepLink();

  // 5분마다 60분 초과 외출 좌석 자동 청소 백그라운드 호출
  setInterval(() => {
    cleanupExpiredSeats().catch(() => {});
  }, 300000);

  // 화재 비상 상태 확인 및 10초 주기 폴링
  await checkKioskEmergencyStatus();
  setInterval(checkKioskEmergencyStatus, 10000);

  // 🎯 키오스크 45초 유휴 복귀 감시 & 청소년 22시 보호 감시 가동
  setupKioskWatchdog();
  setupMinorShutdownMonitor();
}

// ── 10. 키오스크 45초 유휴 복귀 (Idle Timeout Watchdog) ──────
function setupKioskWatchdog() {
  let lastActivity = Date.now();
  let warningActive = false;
  let countdownSec = 10;
  let countdownTimer = null;

  const resetActivity = () => {
    lastActivity = Date.now();
    if (warningActive) {
      dismissWarning();
    }
  };

  ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
    window.addEventListener(evt, resetActivity, { passive: true });
  });

  function showWarning() {
    warningActive = true;
    countdownSec = 10;

    let modal = document.getElementById('kioskIdleModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'kioskIdleModal';
      modal.className = 'sc-modal-backdrop open';
      modal.style.zIndex = '99999';
      modal.innerHTML = `
        <div class="sc-modal" style="max-width:380px;text-align:center;">
          <div style="font-size:2.8rem;margin-bottom:0.5rem">⏳</div>
          <h3 style="font-size:1.25rem;font-weight:800;color:#fff;margin-bottom:0.5rem">키오스크 이용 대기 중</h3>
          <p style="font-size:0.85rem;color:var(--text-muted);line-height:1.4;margin-bottom:1.2rem">
            장시간 입력이 없어 안전을 위해<br/>
            <strong id="kioskIdleCountdown" style="color:#f59e0b;font-size:1.1rem">10</strong>초 후 초기 화면으로 돌아갑니다.
          </p>
          <button id="btnContinueKiosk" class="sc-modal-submit-btn" style="background:#10b981;font-weight:700;" type="button">
            🖐️ 계속 이용하기
          </button>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('btnContinueKiosk').onclick = resetActivity;
    } else {
      modal.classList.add('open');
      const countEl = document.getElementById('kioskIdleCountdown');
      if (countEl) countEl.textContent = '10';
    }

    countdownTimer = setInterval(() => {
      countdownSec -= 1;
      const countEl = document.getElementById('kioskIdleCountdown');
      if (countEl) countEl.textContent = countdownSec;

      if (countdownSec <= 0) {
        clearInterval(countdownTimer);
        forceKioskReset();
      }
    }, 1000);
  }

  function dismissWarning() {
    warningActive = false;
    if (countdownTimer) clearInterval(countdownTimer);
    const modal = document.getElementById('kioskIdleModal');
    if (modal) modal.classList.remove('open');
  }

  function forceKioskReset() {
    dismissWarning();
    // 열려있는 모든 모달 닫기
    document.querySelectorAll('.sc-modal-backdrop.open').forEach(m => m.classList.remove('open'));
    // 로그인 세션 초기화
    if (state.currentUser) {
      MQnetAuth.logout();
    }
    // 탭 초기화: 다음 고객을 위해 초기 이용권 선택 창으로 복귀!
    switchTab('tickets');
    showToast('🔒 안전을 위해 키오스크가 초기 대기 화면(이용권 선택)으로 복귀했습니다.', 'info', 3000);
  }

  // 1초마다 유휴 시간 검사
  setInterval(() => {
    // 사용자가 로그인되어 있거나, 모달이 열려있거나, 기본 탭이 아닐 때만 유휴 감시 작동
    const hasOpenModal = document.querySelector('.sc-modal-backdrop.open');
    const isEngaged = state.currentUser || hasOpenModal || state.activeTab !== 'seats';

    if (isEngaged && !warningActive) {
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= 45000) { // 45초 유휴
        showWarning();
      }
    }
  }, 1000);
}

// ── 11. 청소년 22시 심야 셧다운 실시간 알림 ────────────────
function setupMinorShutdownMonitor() {
  setInterval(() => {
    // 🎯 점주 예외 승인(night_exempt) 회원은 22시 셧다운에서 면제
    if (!state.currentUser || !state.currentUser.is_minor || state.currentUser.night_exempt) return;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // 21:50 사전 안내
    if (hours === 21 && minutes === 50) {
      showToast('⚠️ [청소년 보호] 밤 22:00에 청소년 이용이 자동 종료됩니다. 귀가를 준비해 주세요.', 'warning', 8000);
    }
    // 22:00 정각 셧다운
    if (hours === 22 && minutes === 0 && state.mySeat) {
      leaveSeat(state.mySeat.seat_number).then(() => {
        showToast('🌙 [청소년 야간 셧다운] 22:00 심야 이용 제한으로 자동 퇴실 처리되었습니다. 안전하게 귀가하세요.', 'error', 10000);
        state.mySeat = null;
        refreshSeats();
      }).catch(() => {});
    }
  }, 30000);
}

// ── 12. 화재 비상 대피 모드 감시 (Fail-Safe) ─────────────────
async function checkKioskEmergencyStatus() {
  try {
    const door = await fetchDoorStatus();
    const banner = document.getElementById('kioskEmergencyBanner');
    const reasonEl = document.getElementById('kioskEmergencyReason');
    if (!banner) return;

    if (door && door.is_emergency) {
      banner.style.display = 'flex';
      if (reasonEl) {
        reasonEl.textContent = `사유: ${door.reason} (${door.fail_safe_guideline})`;
      }
    } else {
      banner.style.display = 'none';
    }
  } catch (err) {
    // 무시
  }
}

init();
