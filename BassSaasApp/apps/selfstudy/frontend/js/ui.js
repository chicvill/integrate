// apps/selfstudy/frontend/js/ui.js
// 자기주도학습 DOM 렌더링 및 UI 유틸리티

export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`;
}

export function formatHoursMins(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

// 1. 상단 스터디카페 연동 좌석 배지 갱신
export function renderStudyCafeSeatBadge(container, seatState) {
  if (!container) return;

  if (seatState.hasSeat && seatState.seatNumber) {
    container.className = 'sc-seat-connection-badge connected';
    container.innerHTML = `
      <span class="pulse-dot"></span>
      <span>🪑 스터디카페: <strong>${escHtml(seatState.seatNumber)}</strong> (${escHtml(seatState.zoneType)}존 이용 중)</span>
      <a href="/studycafe/" class="btn-goto-studycafe" title="스터디카페 좌석 화면으로 이동">좌석 관리 ➔</a>
    `;
  } else {
    container.className = 'sc-seat-connection-badge disconnected';
    container.innerHTML = `
      <span>🪑 스터디카페 좌석 미배정</span>
      <a href="/studycafe/" class="btn-goto-studycafe" title="좌석 잡으러 가기">좌석 잡기 ➔</a>
    `;
  }
}

// 2. 순공 타이머 UI 갱신
export function renderTimerDisplay(timerState) {
  const timeEl = document.getElementById('timerDigits');
  const modeBadgeEl = document.getElementById('timerModeBadge');
  const subjectPillEl = document.getElementById('timerSubjectPill');
  const todayFocusEl = document.getElementById('todayFocusTime');
  const todayGoalEl = document.getElementById('todayGoalProgress');
  const progressFillEl = document.getElementById('timerProgressFill');
  const startBtn = document.getElementById('btnTimerStart');
  const btnPomo = document.getElementById('btnModePomodoro');

  if (timeEl) {
    const displaySec = timerState.mode === 'pomodoro' 
      ? timerState.remainingSeconds 
      : timerState.elapsedSeconds;
    timeEl.textContent = formatTime(displaySec);
  }

  const mins = Math.max(1, Math.round((timerState.pomodoroInitialSeconds || 1500) / 60));
  if (btnPomo) {
    btnPomo.textContent = timerState.activeTask 
      ? `🎯 과목 몰입 (${mins}분)` 
      : `🍅 뽀모도로 (${mins}분)`;
  }

  if (modeBadgeEl) {
    if (timerState.mode === 'pomodoro') {
      modeBadgeEl.textContent = timerState.activeTask 
        ? `🎯 [${timerState.activeSubject}] ${mins}분 집중 카운트다운`
        : `🍅 뽀모도로 (${mins}분 집중)`;
    } else {
      modeBadgeEl.textContent = '⏱️ 연속 순공 스톱워치';
    }
  }

  if (subjectPillEl) {
    if (timerState.activeTask) {
      const t = timerState.activeTask;
      subjectPillEl.innerHTML = `📚 집중 과목: <strong>${timerState.activeSubject || '전과목'}</strong> <span style="opacity:0.85;font-size:0.75rem">(${t.bookName || ''} ${t.startPage}p ➔ ${t.goalPage}p)</span>`;
    } else {
      subjectPillEl.textContent = `집중 과목: ${timerState.activeSubject || '전과목'}`;
    }
  }

  const totalSec = timerState.todayFocusSeconds;
  const goalSec = timerState.todayGoalSeconds || (5 * 3600);
  const pct = Math.min(100, Math.round((totalSec / goalSec) * 100));

  if (todayFocusEl) todayFocusEl.textContent = formatHoursMins(totalSec);
  if (todayGoalEl) todayGoalEl.textContent = `목표 ${formatHoursMins(goalSec)} 중 ${pct}% 달성`;
  if (progressFillEl) progressFillEl.style.width = `${pct}%`;

  if (startBtn) {
    if (timerState.isRunning) {
      startBtn.innerHTML = '<span>⏸ 일시정지</span>';
      startBtn.classList.add('pause');
    } else {
      startBtn.innerHTML = '<span>▶ 집중 시작</span>';
      startBtn.classList.remove('pause');
    }
  }

  // 상단 네비게이션 탭에 실시간 타이머 작동 배지 표시
  const timerNavBtn = document.querySelector('.nav-tab-btn[data-tab="timer"]');
  if (timerNavBtn) {
    if (timerState.isRunning) {
      const activeName = timerState.activeSubject ? `[${timerState.activeSubject}] ` : '';
      timerNavBtn.innerHTML = `<span>⏱️</span> 순공 타이머 <span style="display:inline-block;padding:0.1rem 0.35rem;border-radius:4px;background:#10b981;color:#fff;font-size:0.68rem;font-weight:700;margin-left:4px;vertical-align:middle;animation:pulse 1.5s infinite">${activeName}진행중</span>`;
    } else {
      timerNavBtn.innerHTML = `<span>⏱️</span> 순공 타이머`;
    }
  }
}

export function formatMinutesToHhMm(mins) {
  const m = parseInt(mins, 10) || 0;
  const h = Math.floor(m / 60);
  const remainderM = m % 60;
  return `${String(h).padStart(2, '0')}:${String(remainderM).padStart(2, '0')}`;
}

// 3. 플래너 과목별 학습 테이블 렌더링 (시작P 수정, 과목/교재명 즉시 수정, 배정시간 분단위, 시작/종료 개별 수정 지원)
export function renderTasksList(container, tasks, onStartTask, onFinishTask, onEditEndTask, onEditStartTask, onUpdateStartPage, onDeleteTask, onUpdateSubject, onUpdateBookName) {
  if (!container) return;
  container.innerHTML = '';

  if (!tasks || tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-tasks-placeholder">
        <span style="font-size:2.5rem">📝</span>
        <p>오늘 등록된 학습 과목이 없습니다. 상단의 [📋 진도계획표 생성]을 먼저 진행해 주세요.</p>
        <button class="btn-add-first-task" type="button" onclick="document.getElementById('btnOpenCurriculumModal').click()">📋 진도계획표 생성하기</button>
      </div>
    `;
    return;
  }

  // 테이블 래퍼 생성
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'study-table-card';

  tableWrapper.innerHTML = `
    <div class="table-responsive-box">
      <table class="study-planner-table">
        <thead>
          <tr>
            <th>과목</th>
            <th style="text-align:left">교재</th>
            <th>시작</th>
            <th>시작T</th>
            <th>시작P</th>
            <th>목표P</th>
            <th>배정시간</th>
            <th>종료예정T</th>
            <th>달성P</th>
            <th>종료</th>
            <th>종료T</th>
            <th>학습속도</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody id="plannerTableBody"></tbody>
      </table>
    </div>
  `;

  const tbody = tableWrapper.querySelector('#plannerTableBody');

  tasks.forEach(task => {
    // 기본값 보정
    if (task.startPage == null || task.goalPage == null) {
      const m = (task.title || '').match(/(\d+)p\s*(?:➔|->)\s*(\d+)p/);
      if (m) {
        task.startPage = parseInt(m[1], 10);
        task.goalPage = parseInt(m[2], 10);
      } else {
        task.startPage = task.startPage || 1;
        task.goalPage = task.goalPage || 6;
      }
    }
    task.minutes = task.minutes || 48;
    task.bookName = task.bookName || task.title || `${task.subject} 교재`;

    const isStarted = !!task.startTime;
    const isFinished = !!task.endTime;
    const rowClass = isFinished ? 'row-finished' : isStarted ? 'row-studying' : '';

    const tr = document.createElement('tr');
    tr.className = `study-task-row ${rowClass}`;

    tr.innerHTML = `
      <!-- 1. 과목 (자격증/시험 등 자유 수정 가능) -->
      <td>
        <div class="table-subj-cell" title="더블클릭 또는 ✏️ 클릭 시 과목명 변경">
          <span class="task-subj-badge subj-${task.subject}">${escHtml(task.subject)}</span>
          <button type="button" class="btn-edit-subj-mini" title="과목명 수정 (자격증/어학 등)">✏️</button>
        </div>
      </td>

      <!-- 2. 교재 (자유 수정 가능) -->
      <td class="text-left font-bold" title="더블클릭 또는 ✏️ 클릭 시 교재명 변경">
        <div class="table-book-cell">
          <span class="table-book-title">${escHtml(task.bookName)}</span>
          <button type="button" class="btn-edit-book-mini" title="교재명 수정">✏️</button>
        </div>
      </td>

      <!-- 3. 시작 버튼 / 상태 (완료 후에는 '수정' 버튼 제공) -->
      <td>
        ${!isStarted ? `
          <button class="btn-tb-start" type="button" title="교재를 펴며 시작 시간을 기록합니다">시작 ▶</button>
        ` : !isFinished ? `
          <button class="btn-tb-studying" type="button" title="현재 진행 중인 타이머 화면으로 이동합니다 (시간 리셋 없음)">⏱️ 진행중 (타이머 ➔)</button>
        ` : `
          <button class="btn-tb-edit-start" type="button" title="시작 시각을 수정합니다">수정 ✏️</button>
        `}
      </td>

      <!-- 4. 시작T -->
      <td>
        ${task.startTime ? `<strong class="time-start">${task.startTime}</strong>` : `<span class="time-dash">-</span>`}
      </td>

      <!-- 5. 시작P (건너뜀/누락 직접 수정 가능) -->
      <td>
        <input type="number" class="input-table-page input-start-page" min="1" value="${task.startPage}" title="누락되거나 건너뛴 경우 시작 페이지를 직접 수정할 수 있습니다">
      </td>

      <!-- 6. 목표P -->
      <td>
        <span class="page-num font-bold text-accent">${task.goalPage}</span>
      </td>

      <!-- 7. 배정시간 (분 단위로 깔끔하게 표시) -->
      <td>
        <strong class="time-allocated-mins">${task.minutes}분</strong>
      </td>

      <!-- 8. 종료예정T (빨간색) -->
      <td>
        ${task.expectedEndTime ? `
          <strong class="time-expected">${task.expectedEndTime}</strong>
        ` : `<span class="time-dash">-</span>`}
      </td>

      <!-- 9. 달성P -->
      <td>
        ${!isFinished ? `
          <input type="number" class="input-table-achieved" min="${task.startPage}" placeholder="${task.goalPage}" value="${task.completedPage ?? ''}">
        ` : `
          <strong class="page-achieved-val ${task.completedPage >= task.goalPage ? 'text-success' : 'text-warning'}">${task.completedPage}</strong>
        `}
      </td>

      <!-- 10. 종료 버튼 / 수정 -->
      <td>
        ${!isFinished ? `
          <button class="btn-tb-end ${isStarted ? 'active' : ''}" type="button" ${isStarted ? '' : 'disabled'} title="학습을 마치고 실제 종료 시간을 기록합니다">종료 ⏹</button>
        ` : `
          <button class="btn-tb-edit-end" type="button" title="달성 페이지 및 종료 기록을 수정합니다">수정 ✏️</button>
        `}
      </td>

      <!-- 11. 종료T (파란색) -->
      <td>
        ${task.endTime ? `
          <strong class="time-finished">${task.endTime}</strong>
        ` : `<span class="time-dash">-</span>`}
      </td>

      <!-- 12. 학습속도 (PPH) -->
      <td>
        ${task.pph ? `
          <span class="badge-speed" title="실제 ${task.actualMinutes}분 동안 ${Math.max(1, task.completedPage - task.startPage + 1)}페이지 완료">
            ${task.pph} PPH
          </span>
        ` : `<span class="time-dash">-</span>`}
      </td>

      <!-- 13. 관리 (삭제) -->
      <td>
        <button class="btn-tb-del" title="과목 삭제" type="button">✕</button>
      </td>
    `;

    // 이벤트 리스너 바인딩
    // 시작 버튼
    const startBtn = tr.querySelector('.btn-tb-start');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        onStartTask(task.id);
      });
    }

    // 진행중 버튼 (클릭 시 시간 초기화 없이 타이머로 즉시 이동)
    const studyingBtn = tr.querySelector('.btn-tb-studying');
    if (studyingBtn) {
      studyingBtn.addEventListener('click', () => {
        onStartTask(task.id);
      });
    }

    // 시작 시간 수정 버튼 (완료됨 -> 수정)
    const editStartBtn = tr.querySelector('.btn-tb-edit-start');
    if (editStartBtn) {
      editStartBtn.addEventListener('click', () => {
        onEditStartTask(task.id);
      });
    }

    // 시작P 변경 이벤트
    const startPageInput = tr.querySelector('.input-start-page');
    if (startPageInput) {
      startPageInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 1) {
          onUpdateStartPage(task.id, val);
        }
      });
    }

    // 달성P 인풋 변경
    const pageInput = tr.querySelector('.input-table-achieved');
    if (pageInput) {
      pageInput.addEventListener('input', (e) => {
        task.completedPage = e.target.value ? parseInt(e.target.value, 10) : null;
      });
      pageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const endBtn = tr.querySelector('.btn-tb-end');
          if (endBtn && !endBtn.disabled) endBtn.click();
        }
      });
    }

    // 종료 버튼
    const endBtn = tr.querySelector('.btn-tb-end');
    if (endBtn) {
      endBtn.addEventListener('click', () => {
        let val = pageInput ? parseInt(pageInput.value, 10) : task.completedPage;
        if (isNaN(val) || val < task.startPage) {
          val = task.goalPage;
          if (pageInput) pageInput.value = val;
        }
        onFinishTask(task.id, val);
      });
    }

    // 종료 실적 수정 버튼 (시작시간은 보존한 채로 종료/달성페이지만 수정 가능)
    const editEndBtn = tr.querySelector('.btn-tb-edit-end');
    if (editEndBtn) {
      editEndBtn.addEventListener('click', () => {
        onEditEndTask(task.id);
      });
    }

    // 과목명 수정 이벤트
    const editSubjBtn = tr.querySelector('.btn-edit-subj-mini');
    const subjBadge = tr.querySelector('.task-subj-badge');
    const triggerSubjEdit = () => {
      const nextSubj = prompt(`[${task.subject}] 변경할 과목명을 입력하세요 (예: 정보처리기사, 공인중개사, 토익, 국어 등):`, task.subject);
      if (nextSubj && nextSubj.trim() && nextSubj.trim() !== task.subject) {
        if (onUpdateSubject) onUpdateSubject(task.id, nextSubj.trim());
      }
    };
    if (editSubjBtn) editSubjBtn.onclick = triggerSubjEdit;
    if (subjBadge) subjBadge.ondblclick = triggerSubjEdit;

    // 교재명 수정 이벤트
    const editBookBtn = tr.querySelector('.btn-edit-book-mini');
    const bookTitleSpan = tr.querySelector('.table-book-title');
    const triggerBookEdit = () => {
      const nextBook = prompt(`[${task.subject}] 새로운 교재명을 입력하세요:`, task.bookName);
      if (nextBook && nextBook.trim() && nextBook.trim() !== task.bookName) {
        if (onUpdateBookName) onUpdateBookName(task.id, nextBook.trim());
      }
    };
    if (editBookBtn) editBookBtn.onclick = triggerBookEdit;
    if (bookTitleSpan) bookTitleSpan.ondblclick = triggerBookEdit;

    // 삭제 버튼
    const delBtn = tr.querySelector('.btn-tb-del');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onDeleteTask(task.id);
      });
    }

    tbody.appendChild(tr);
  });

  container.appendChild(tableWrapper);

  // 상단 완료 카운트 갱신
  const doneCount = tasks.filter(t => !!t.endTime).length;
  const totalCount = tasks.length;
  const taskPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  
  const summaryEl = document.getElementById('taskSummaryText');
  if (summaryEl) {
    summaryEl.textContent = `${totalCount}개 과목 중 ${doneCount}개 완료 (${taskPct}%)`;
  }
}

// 4. AI 멘토 채팅 대화 렌더링
export function renderAiChat(container, chatHistory) {
  if (!container) return;
  container.innerHTML = '';

  chatHistory.forEach(msg => {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble-row ${msg.sender}`;
    
    bubble.innerHTML = `
      <div class="avatar-box">${msg.sender === 'ai' ? '🤖' : '👤'}</div>
      <div class="bubble-content">
        <div class="sender-name">${msg.sender === 'ai' ? 'Gemini AI 멘토' : '나'}</div>
        <div class="bubble-text">${escHtml(msg.text).replace(/\n/g, '<br>')}</div>
        <div class="msg-time">${msg.time}</div>
      </div>
    `;

    container.appendChild(bubble);
  });

  // 스크롤 최하단 유지
  container.scrollTop = container.scrollHeight;
}

// 5. 학습 리포트 주간 차트 렌더링
export function renderWeeklyReport(container, logs = []) {
  if (!container) return;

  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const mockTimes = [180, 240, 210, 310, 260, 380, 290]; // 분 단위

  container.innerHTML = `
    <div class="report-overview-cards">
      <div class="rep-card">
        <span class="rep-label">이번 주 총 순공</span>
        <span class="rep-val">31시간 10분</span>
      </div>
      <div class="rep-card">
        <span class="rep-label">일평균 순공 시간</span>
        <span class="rep-val text-accent">4시간 27분</span>
      </div>
      <div class="rep-card">
        <span class="rep-label">최대 몰입 과목</span>
        <span class="rep-val text-success">수학 (42%)</span>
      </div>
      <div class="rep-card">
        <span class="rep-label">스터디카페 출결률</span>
        <span class="rep-val">94% (출석)</span>
      </div>
    </div>

    <!-- 주간 순공 그래프 -->
    <div class="weekly-bar-chart-card">
      <h3 class="chart-title">📊 주간 일별 순공 시간 (분)</h3>
      <div class="bar-chart-wrapper">
        ${days.map((day, idx) => {
          const m = mockTimes[idx];
          const heightPct = Math.min(100, Math.round((m / 420) * 100));
          return `
            <div class="bar-col">
              <div class="bar-val">${m}분</div>
              <div class="bar-track">
                <div class="bar-fill" style="height: ${heightPct}%"></div>
              </div>
              <div class="bar-day">${day}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
