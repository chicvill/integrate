// apps/studycafe/frontend/js/ui.js
// 스터디카페 DOM 렌더링 및 UI 유틸리티

export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 1. 좌석 통계 바 갱신
export function renderStatsBar(container, { total, occupied, available, congestion }) {
  if (!container) return;
  const occPct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  
  const statusClass = occPct > 80 ? 'busy' : occPct > 40 ? 'moderate' : 'free';
  const statusText = occPct > 80 ? '혼잡' : occPct > 40 ? '보통' : '쾌적';

  container.innerHTML = `
    <div class="sc-stat-card">
      <div class="stat-label">전체 좌석</div>
      <div class="stat-value">${total}<span class="stat-unit">석</span></div>
    </div>
    <div class="sc-stat-card">
      <div class="stat-label">이용 중</div>
      <div class="stat-value text-accent">${occupied}<span class="stat-unit">석</span></div>
    </div>
    <div class="sc-stat-card">
      <div class="stat-label">잔여 좌석</div>
      <div class="stat-value text-success">${available}<span class="stat-unit">석</span></div>
    </div>
    <div class="sc-stat-card">
      <div class="stat-label">실시간 점유율 / AI 혼잡도</div>
      <div class="stat-value">
        <span class="stat-pct">${occPct}%</span>
        <span class="sc-congestion-badge ${statusClass}">AI: ${congestion.status || statusText}</span>
      </div>
    </div>
  `;
}

// 2. 20개 좌석 그리드 렌더링
export function renderSeatGrid(container, seats, selectedZone, mySeat, onSeatClick) {
  if (!container) return;
  container.innerHTML = '';

  const filtered = selectedZone === 'ALL' 
    ? seats 
    : seats.filter(s => s.zone_type === selectedZone);

  filtered.forEach(seat => {
    const isStepOut = seat.status === 'STEP_OUT' || seat.is_step_out;
    const isOccupied = seat.is_occupied || seat.status === 'OCCUPIED' || isStepOut;
    const isMySeat = mySeat && mySeat.seat_number === seat.seat_number;
    
    const card = document.createElement('div');
    const stateClass = isStepOut ? 'step-out' : isOccupied ? 'occupied' : 'available';
    card.className = `sc-seat-card ${stateClass} ${isMySeat ? 'is-my-seat' : ''}`;
    card.dataset.seatNumber = seat.seat_number;

    let zoneNameKr = seat.zone_type === 'FOCUS' ? '포커스 집중존' 
                   : seat.zone_type === 'LAPTOP' ? '노트북존' 
                   : '일반 개방존';

    let statusBadgeHtml = '';
    if (isMySeat) {
      statusBadgeHtml = isStepOut 
        ? '<span class="status-badge step-out">내 좌석 (외출 중 🚶‍♂️)</span>' 
        : '<span class="status-badge my">내 좌석 (학습 중 🟢)</span>';
    } else if (isStepOut) {
      statusBadgeHtml = `<span class="status-badge step-out">외출 중 (${escHtml(seat.user_name || '회원')})</span>`;
    } else if (isOccupied) {
      statusBadgeHtml = `<span class="status-badge occ">이용 중 (${escHtml(seat.user_name || '회원')})</span>`;
    } else {
      statusBadgeHtml = '<span class="status-badge avail">이용 가능</span>';
    }

    card.innerHTML = `
      <div class="seat-header">
        <span class="seat-num">${escHtml(seat.seat_number)}</span>
        <span class="seat-zone-pill zone-${seat.zone_type.toLowerCase()}">${escHtml(seat.zone_type)}</span>
      </div>
      <div class="seat-body">
        <div class="seat-icon">${isStepOut ? '🚶‍♂️' : isOccupied ? '👤' : '🪑'}</div>
        <div class="seat-status-text">
          ${statusBadgeHtml}
        </div>
        <div class="seat-zone-desc">${zoneNameKr}</div>
      </div>
      <div class="seat-footer">
        ${isMySeat 
          ? (isStepOut 
              ? `<button class="btn-seat-action assign" style="background:#10b981;" type="button">복귀 / 퇴실 🔓</button>` 
              : `<button class="btn-seat-action leave" type="button">외출 / 퇴실 ⚙️</button>`)
          : isOccupied 
            ? `<button class="btn-seat-action info" type="button">상세 보기</button>`
            : `<button class="btn-seat-action assign" type="button">좌석 잡기 ⚡</button>`
        }
      </div>
    `;

    card.addEventListener('click', () => {
      onSeatClick(seat);
    });

    container.appendChild(card);
  });
}

// 3. 이용권 요금제 카드 렌더링
export function renderTicketPlans(container, plans, onPurchaseClick) {
  if (!container) return;
  container.innerHTML = '';

  plans.forEach(plan => {
    const isPopular = plan.plan_id === 'time_4h' || plan.plan_id === 'time_100h';
    const card = document.createElement('div');
    card.className = `sc-ticket-card ${isPopular ? 'popular' : ''}`;
    
    card.innerHTML = `
      ${isPopular ? '<div class="popular-ribbon">BEST ⭐</div>' : ''}
      <div class="ticket-header">
        <h4 class="ticket-name">${escHtml(plan.name)}</h4>
        <div class="ticket-type-pill">${plan.type === 'hourly' ? '당일 시간권' : plan.type === 'term' ? '기간 자유권' : '정기 시간권'}</div>
      </div>
      <div class="ticket-price">
        <span class="currency">₩</span>
        <span class="amount">${plan.price.toLocaleString()}</span>
      </div>
      <ul class="ticket-features">
        <li>✓ ${Math.round(plan.duration_minutes / 60)}시간 자유 이용</li>
        <li>✓ IoT 스마트 도어락 QR 패스 자동 발급</li>
        <li>✓ 고속 Wi-Fi 및 개인 콘센트 제공</li>
        <li>✓ 자기주도학습 LMS 연동 기능 포함</li>
      </ul>
      <button class="btn-ticket-purchase" type="button">이용권 구매하기</button>
    `;

    card.querySelector('.btn-ticket-purchase').addEventListener('click', (e) => {
      e.stopPropagation();
      onPurchaseClick(plan);
    });

    container.appendChild(card);
  });
}

// 4. 출입문 상태 및 모바일 패스 렌더링
export function renderDoorPass(container, currentUser, mySeat, doorStatus, onUnlockClick) {
  if (!container) return;

  const hasSeat = !!mySeat;
  const userName = currentUser ? (currentUser.full_name || currentUser.id) : '게스트 회원';
  const userPhone = currentUser ? (currentUser.phone || '010-****-****') : '미등록';

  container.innerHTML = `
    <div class="sc-door-layout">
      <!-- 스마트 도어락 제어 카드 -->
      <div class="sc-door-control-card ${doorStatus.isOpen ? 'door-open' : ''}">
        <div class="door-visual">
          <div class="door-frame">
            <div class="door-panel ${doorStatus.isOpen ? 'open' : ''}">
              <div class="door-handle"></div>
            </div>
          </div>
          <div class="door-status-badge ${doorStatus.isOpen ? 'open' : 'locked'}">
            ${doorStatus.isOpen ? `🔓 출입문 열림 (${doorStatus.remainingSeconds}s)` : '🔒 출입문 잠김 (IoT 대기 중)'}
          </div>
        </div>

        <h3 class="door-title">NFC / 스마트 도어락 원격 제어</h3>
        <p class="door-subtitle">출입문 릴레이 제어기를 통해 5초간 문을 개방합니다.</p>

        <button id="btnDoorUnlock" class="btn-door-unlock ${doorStatus.isOpen ? 'disabled' : ''}" type="button" ${doorStatus.isOpen ? 'disabled' : ''}>
          <span>${doorStatus.isOpen ? '문이 열려 있습니다...' : '🚪 출입문 열기 (NFC/IoT)'}</span>
        </button>
      </div>

      <!-- 모바일 전자 출입증 (QR Pass) -->
      <div class="sc-mobile-pass-card">
        <div class="pass-header">
          <div class="pass-brand">MQnet StudyCafe Pass</div>
          <span class="pass-chip ${hasSeat ? 'active' : 'inactive'}">
            ${hasSeat ? '입실 인증됨' : '좌석 미배정'}
          </span>
        </div>

        <div class="pass-user-info">
          <div class="user-avatar-circle">👤</div>
          <div>
            <div class="pass-user-name">${escHtml(userName)} 님</div>
            <div class="pass-user-sub">${escHtml(userPhone)}</div>
          </div>
        </div>

        <div class="pass-seat-slot">
          <span class="slot-label">현재 배정 좌석:</span>
          <span class="slot-value ${hasSeat ? 'text-accent' : ''}">
            ${hasSeat ? `${escHtml(mySeat.seat_number)} (${escHtml(mySeat.zone_type)}존)` : '배정된 좌석 없음'}
          </span>
        </div>

        <div class="pass-qr-box">
          <div class="qr-mock-code">
            <div class="qr-pattern"></div>
          </div>
          <div class="qr-tip">출입 단말기에 QR 코드를 스캔하거나 위 '출입문 열기' 버튼을 누르세요.</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btnDoorUnlock')?.addEventListener('click', onUnlockClick);
}

// 5. 스터디카페 내부 자기주도학습 연동 탭 렌더링 (SelfStudy PPH OS)
export function renderSelfstudyTab(container, mySeat, currentUser, onActionClick) {
  if (!container) return;

  const hasSeat = !!mySeat;
  const isStepOut = hasSeat && (mySeat.status === 'STEP_OUT' || mySeat.is_step_out);
  const seatText = hasSeat ? `${mySeat.seat_number} (${mySeat.zone_type}존)` : '미배정';
  const userName = (currentUser && (currentUser.full_name || currentUser.username)) || (mySeat && mySeat.user_name) || '학습 회원';

  container.innerHTML = `
    <div class="sc-selfstudy-wrapper">
      <div class="selfstudy-banner">
        <div class="banner-badge">MQnet StudyCafe × SelfStudy 통합 LMS (Zero-Message)</div>
        <h2 class="banner-title">📖 ${escHtml(userName)} 님의 관리형 학습 데스크</h2>
        <p class="banner-desc">
          데스크 QR 인식 기반으로 입실 즉시 오늘의 5과목 학습 오더가 실시간 배분되며, 퇴실 시 10초 컷 입력으로 PPH가 자동 갱신됩니다.
        </p>
      </div>

      <!-- 상단 현황 배지 -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:1rem;margin-bottom:1.5rem;">
        <div class="ss-card" style="margin:0;">
          <div style="font-size:0.8rem;color:var(--text-muted)">현재 배정 좌석</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--accent);margin:0.2rem 0;">${seatText}</div>
          <div style="font-size:0.75rem;color:${hasSeat ? (isStepOut ? '#f59e0b' : '#10b981') : 'var(--text-dim)'}">
            ${hasSeat ? (isStepOut ? '외출 중 (식사/휴식)' : '🟢 집중 학습 진행 중') : '⚪ 좌석 미배정'}
          </div>
        </div>

        <div class="ss-card" style="margin:0;">
          <div style="font-size:0.8rem;color:var(--text-muted)">목표 D-day (2026 수능/목표일)</div>
          <div style="font-size:1.3rem;font-weight:800;color:#38bdf8;margin:0.2rem 0;">D-42 일</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">오늘 권장 순공: 4시간 10분</div>
        </div>

        <div class="ss-card" style="margin:0;">
          <div style="font-size:0.8rem;color:var(--text-muted)">PPH 리밸런싱 속도</div>
          <div style="font-size:1.3rem;font-weight:800;color:#10b981;margin:0.2rem 0;">18.4 p/h</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">+2일차 롤링 가중 이동평균 적용</div>
        </div>
      </div>

      <!-- 오늘의 5과목 학습 오더 카드 (Daily Order) -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:14px;padding:1.25rem;margin-bottom:1.5rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem;">
          <div>
            <h3 style="font-size:1.15rem;font-weight:800;color:#fff;margin:0;">📋 오늘의 맞춤형 진도 오더 (SelfStudy Daily Order)</h3>
            <p style="font-size:0.8rem;color:var(--text-muted);margin:0.2rem 0 0;">과목별 실측 PPH 부하율($W_i$)에 따라 0.1초 만에 자동 계산된 배정 시간입니다.</p>
          </div>
          ${hasSeat ? `
            <div style="display:flex;gap:0.5rem;">
              <button id="btnSsStepOut" class="btn-seat-action" style="background:rgba(245,158,11,0.2);color:#f59e0b;border:1px solid rgba(245,158,11,0.4);padding:0.45rem 0.9rem;border-radius:8px;font-size:0.85rem;cursor:pointer;" type="button">
                ☕ 외출 (최대 60분)
              </button>
              <button id="btnSsLeave" class="btn-seat-action leave" style="padding:0.45rem 0.9rem;border-radius:8px;font-size:0.85rem;" type="button">
                📝 마친 쪽 입력 & 퇴실
              </button>
            </div>
          ` : ''}
        </div>

        <div style="display:flex;flex-direction:column;gap:0.75rem;">
          <!-- 1. 수학 -->
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.85rem 1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
            <div>
              <span style="font-weight:700;color:#fff;font-size:0.95rem;">📐 수학 (쎈수학 상)</span>
              <span style="background:rgba(239,68,68,0.15);color:#f87171;font-size:0.75rem;padding:0.15rem 0.45rem;border-radius:4px;margin-left:0.5rem;">고난도 킬러 K=1.5</span>
            </div>
            <div style="display:flex;align-items:center;gap:1.2rem;">
              <div style="font-size:0.85rem;color:var(--text-muted)">시작 <strong style="color:#fff">25p</strong> ➔ 오늘 목표 <strong style="color:var(--accent)">38p</strong> (13p)</div>
              <span style="background:rgba(59,130,246,0.2);color:#60a5fa;font-weight:700;font-size:0.8rem;padding:0.25rem 0.6rem;border-radius:6px;">배정 85분</span>
            </div>
          </div>

          <!-- 2. 영어 -->
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.85rem 1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
            <div>
              <span style="font-weight:700;color:#fff;font-size:0.95rem;">🔤 영어 (수능특강 영어)</span>
              <span style="background:rgba(59,130,246,0.15);color:#93c5fd;font-size:0.75rem;padding:0.15rem 0.45rem;border-radius:4px;margin-left:0.5rem;">기출 분석 K=1.0</span>
            </div>
            <div style="display:flex;align-items:center;gap:1.2rem;">
              <div style="font-size:0.85rem;color:var(--text-muted)">시작 <strong style="color:#fff">18p</strong> ➔ 오늘 목표 <strong style="color:var(--accent)">30p</strong> (12p)</div>
              <span style="background:rgba(59,130,246,0.2);color:#60a5fa;font-weight:700;font-size:0.8rem;padding:0.25rem 0.6rem;border-radius:6px;">배정 55분</span>
            </div>
          </div>

          <!-- 3. 국어 -->
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.85rem 1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
            <div>
              <span style="font-weight:700;color:#fff;font-size:0.95rem;">📖 국어 (마더텅 독서)</span>
              <span style="background:rgba(16,185,129,0.15);color:#6ee7b7;font-size:0.75rem;padding:0.15rem 0.45rem;border-radius:4px;margin-left:0.5rem;">지문 독해 K=1.0</span>
            </div>
            <div style="display:flex;align-items:center;gap:1.2rem;">
              <div style="font-size:0.85rem;color:var(--text-muted)">시작 <strong style="color:#fff">30p</strong> ➔ 오늘 목표 <strong style="color:var(--accent)">44p</strong> (14p)</div>
              <span style="background:rgba(59,130,246,0.2);color:#60a5fa;font-weight:700;font-size:0.8rem;padding:0.25rem 0.6rem;border-radius:6px;">배정 45분</span>
            </div>
          </div>

          <!-- 4. 탐구 -->
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.85rem 1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
            <div>
              <span style="font-weight:700;color:#fff;font-size:0.95rem;">🔬 탐구 (완자 물리학I)</span>
              <span style="background:rgba(245,158,11,0.15);color:#fcd34d;font-size:0.75rem;padding:0.15rem 0.45rem;border-radius:4px;margin-left:0.5rem;">개념 완성 K=0.8</span>
            </div>
            <div style="display:flex;align-items:center;gap:1.2rem;">
              <div style="font-size:0.85rem;color:var(--text-muted)">시작 <strong style="color:#fff">40p</strong> ➔ 오늘 목표 <strong style="color:var(--accent)">55p</strong> (15p)</div>
              <span style="background:rgba(59,130,246,0.2);color:#60a5fa;font-weight:700;font-size:0.8rem;padding:0.25rem 0.6rem;border-radius:6px;">배정 35분</span>
            </div>
          </div>

          <!-- 5. 한국사 -->
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.85rem 1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
            <div>
              <span style="font-weight:700;color:#fff;font-size:0.95rem;">📜 한국사 (한능검 기출)</span>
              <span style="background:rgba(16,185,129,0.15);color:#6ee7b7;font-size:0.75rem;padding:0.15rem 0.45rem;border-radius:4px;margin-left:0.5rem;">요약 정리 K=0.8</span>
            </div>
            <div style="display:flex;align-items:center;gap:1.2rem;">
              <div style="font-size:0.85rem;color:var(--text-muted)">시작 <strong style="color:#fff">50p</strong> ➔ 오늘 목표 <strong style="color:var(--accent)">68p</strong> (18p)</div>
              <span style="background:rgba(59,130,246,0.2);color:#60a5fa;font-weight:700;font-size:0.8rem;padding:0.25rem 0.6rem;border-radius:6px;">배정 30분</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 전용 LMS 론처 버튼 및 학부모 안심 링크 -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:1rem;">
        <a href="/selfstudy/" class="btn-launch-selfstudy" style="margin:0;text-align:center;text-decoration:none;" target="_blank">
          <span>🚀 SelfStudy 전용 풀스크린 LMS 열기</span>
          <span class="arrow">➔</span>
        </a>
        <a href="./parent.html" class="btn-launch-selfstudy" style="margin:0;background:rgba(16,185,129,0.15);border-color:rgba(16,185,129,0.4);color:#6ee7b7;text-align:center;text-decoration:none;" target="_blank">
          <span>👨‍👩‍👧 학부모 안심 웹 포털 열기 (비용 0원)</span>
          <span class="arrow">➔</span>
        </a>
      </div>
    </div>
  `;

  if (hasSeat && onActionClick) {
    document.getElementById('btnSsStepOut')?.addEventListener('click', () => onActionClick('step-out'));
    document.getElementById('btnSsLeave')?.addEventListener('click', () => onActionClick('leave'));
  }
}
