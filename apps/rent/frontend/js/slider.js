/**
 * apps/rent/frontend/js/slider.js
 * 호실 상세 듀얼 슬라이더 (당월 계약·수납 ↔ 과거 납부 내역) 인터랙션 전용 모듈.
 * 모바일 터치 스와이프 제스처, PC 마우스 드래그, 키보드 좌우 탐색, 하단 네비게이터 제어.
 */

import { state } from './state.js?v=2.0';
import { renderPastHistorySection } from './ui.js?v=2.0';

let isSwipeInitialized = false;

/**
 * 슬라이더 뷰 전환
 * @param {'main' | 'past'} view - 전환할 대상 뷰
 * @param {boolean} animate - 부드러운 애니메이션 적용 여부
 */
export function switchRoomSlideView(view, animate = true) {
  state.currentSlideView = view;
  const track = document.getElementById('roomSwipeTrack');
  const navCurrent = document.getElementById('navCurrentScreenText');
  const navDotMain = document.getElementById('navDotMain');
  const navDotPast = document.getElementById('navDotPast');
  const navHintAction = document.getElementById('navHintActionText');
  const navHintArrow = document.getElementById('navHintArrow');
  const navContent = document.getElementById('roomSlideNavContent');

  if (!track) return;

  if (!animate) {
    track.style.transition = 'none';
  } else {
    track.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
  }

  if (view === 'past') {
    track.style.transform = 'translateX(-50%)';
    if (navContent) {
      navContent.className = 'py-1 px-2.5 rounded-xl bg-surface-900 border border-purple-500/50 hover:border-purple-400 text-xs shadow-md flex items-center justify-between gap-1.5 transition-colors';
    }
    if (navCurrent) {
      const lastY = currentYear - 1;
      const hasPast = Object.values(state.rooms || {}).some(r => r && r.payments && Object.keys(r.payments).some(k => {
        const p = r.payments[k];
        const y = (p && p.year) ? p.year : (k.includes('-') ? parseInt(k.split('-')[0], 10) : null);
        return y !== null && y <= lastY && (p.paid || (p.rent_amount && p.rent_amount > 0) || p.tenant_name || p.note);
      }));
      navCurrent.textContent = hasPast ? `수납내역 (${lastY}.01 ~ 현재)` : `수납내역 (${currentYear}.01 ~ 현재)`;
      navCurrent.className = 'font-bold text-purple-300 text-[11px] truncate';
    }
    if (navDotMain) navDotMain.className = 'w-1.5 h-1.5 rounded-full bg-slate-600';
    if (navDotPast) navDotPast.className = 'w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse';
    if (navHintAction) navHintAction.textContent = '우로 드래그 (처음으로)';
    if (navHintArrow) {
      navHintArrow.textContent = '⬅';
      navHintArrow.className = 'text-purple-400 font-black text-xs';
    }

    // 수납내역 데이터 렌더링 동기화
    const room = state.rooms[state.selectedRoom];
    if (room && typeof renderPastHistorySection === 'function') {
      renderPastHistorySection(room);
    }
  } else {
    track.style.transform = 'translateX(0%)';
    if (navContent) {
      navContent.className = 'py-1 px-2.5 rounded-xl bg-surface-900 border border-cyan-500/40 hover:border-cyan-400 text-xs shadow-md flex items-center justify-between gap-1.5 transition-colors';
    }
    if (navCurrent) {
      navCurrent.textContent = '처음으로';
      navCurrent.className = 'font-bold text-cyan-300 text-[11px] truncate';
    }
    if (navDotMain) navDotMain.className = 'w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse';
    if (navDotPast) navDotPast.className = 'w-1.5 h-1.5 rounded-full bg-slate-600';
    if (navHintAction) navHintAction.textContent = '수납내역(화면 우로 밀기)';
    if (navHintArrow) {
      navHintArrow.textContent = '➔';
      navHintArrow.className = 'text-cyan-400 font-black text-xs';
    }
  }

  if (!animate) {
    setTimeout(() => {
      if (track) track.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
    }, 40);
  }
}

/**
 * 메인 ↔ 과거내역 토글
 */
export function toggleRoomSlideView() {
  if (state.currentSlideView === 'past') {
    switchRoomSlideView('main');
  } else {
    switchRoomSlideView('past');
  }
}

/**
 * 터치 스와이프, 마우스 드래그 및 키보드 좌우 탐색 이벤트 초기화
 */
export function initRoomSwipe() {
  if (isSwipeInitialized) return;
  const container = document.getElementById('roomSwipeContainer');
  if (!container) return;

  let startX = 0;
  let startY = 0;
  let isDragging = false;

  // 1. 모바일 터치 제스처 (Passive 지원으로 부드러운 스크롤 성능 유지)
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = true;
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    if (!isDragging || e.changedTouches.length !== 1) return;
    isDragging = false;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - startX;
    const diffY = endY - startY;

    // 수평 드래그 거리가 수직 스크롤보다 크고 30px 이상 이동했을 때만 전환
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
      if (diffX < 0) {
        switchRoomSlideView('past');
      } else {
        switchRoomSlideView('main');
      }
    }
  }, { passive: true });

  // 2. PC 마우스 드래그 제스처
  container.addEventListener('mousedown', (e) => {
    if (e.target.closest('button, input, select, textarea, a, .cursor-pointer')) return;
    startX = e.clientX;
    startY = e.clientY;
    isDragging = true;
  });

  window.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const diffX = e.clientX - startX;
    const diffY = e.clientY - startY;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
      if (diffX < 0) {
        switchRoomSlideView('past');
      } else {
        switchRoomSlideView('main');
      }
    }
  });

  // 3. 키보드 좌우 화살표 지원 (인터랙티브 폼 입력 중이 아닐 때)
  window.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
    if (e.key === 'ArrowLeft') {
      switchRoomSlideView('past');
    } else if (e.key === 'ArrowRight') {
      switchRoomSlideView('main');
    }
  });

  isSwipeInitialized = true;
}
