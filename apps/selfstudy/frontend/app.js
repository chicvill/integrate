// apps/selfstudy/frontend/app.js
// 자기주도학습 프론트엔드 메인 오케스트레이터 (SaaS 템플릿 표준 준수)

import { MQnetAuth } from '/shared/ui/auth.js?v=2.1';
import { state } from './js/state.js?v=2.0';
import {
  fetchStudyPlans, recordStudyProgress, fetchProgressLogs,
  askAiMentor, generateAiPlan, fetchStudyCafeSeat
} from './js/api.js?v=2.0';
import {
  renderStudyCafeSeatBadge, renderTimerDisplay, renderTasksList,
  renderAiChat, renderWeeklyReport
} from './js/ui.js?v=2.0';
import {
  showToast, openNewTaskModal, openAiPlanModal, openCurriculumModal, closeModal, openCheckoutModal
} from './js/modals.js?v=2.0';
import { WhiteNoise } from './js/whitenoise.js?v=2.0';

// ── DOM 캐싱 ─────────────────────────────────────────────
const scSeatBadgeEl   = document.getElementById('scSeatConnectionBadge');
const tasksListEl     = document.getElementById('tasksListContainer');
const aiChatEl        = document.getElementById('aiChatMessages');
const reportEl        = document.getElementById('reportContainer');
const aiInputEl       = document.getElementById('aiChatInput');
const btnAiSend       = document.getElementById('btnAiSend');
const timerCircleEl   = document.getElementById('timerCircle');

// ── 1. 스터디카페 연동 좌석 현황 갱신 ─────────────────────
async function checkStudyCafeSeat() {
  const user = state.currentUser;
  if (!user) {
    state.studycafeSeat.hasSeat = false;
    renderStudyCafeSeatBadge(scSeatBadgeEl, state.studycafeSeat);
    return;
  }

  try {
    const res = await fetchStudyCafeSeat(user.id, user.phone, user.full_name);
    if (res && res.has_seat && res.seat) {
      state.studycafeSeat = {
        hasSeat: true,
        seatNumber: res.seat.seat_number,
        zoneType: res.seat.zone_type,
        userType: res.seat.user_type,
        checkInAt: res.seat.check_in_at
      };
    } else {
      state.studycafeSeat.hasSeat = false;
    }
  } catch (e) {
    state.studycafeSeat.hasSeat = false;
  }
  renderStudyCafeSeatBadge(scSeatBadgeEl, state.studycafeSeat);
}

// ── 2. 타이머 로직 ───────────────────────────────────────
function setupTimer() {
  const btnStart = document.getElementById('btnTimerStart');
  const btnReset = document.getElementById('btnTimerReset');
  const btnFinish = document.getElementById('btnTimerFinish');
  const btnPomo = document.getElementById('btnModePomodoro');
  const btnStopwatch = document.getElementById('btnModeStopwatch');
  const btnToggleNoise = document.getElementById('btnToggleWhiteNoise');
  const btnCompleteTask = document.getElementById('btnTimerCompleteTask');
  const btnBackPlanner = document.getElementById('btnBackToPlanner');

  const updateNoiseBtnUi = () => {
    if (!btnToggleNoise) return;
    const isPlaying = WhiteNoise.isPlaying();
    const iconEl = document.getElementById('whiteNoiseIcon');
    const textEl = document.getElementById('whiteNoiseText');
    if (isPlaying) {
      btnToggleNoise.classList.add('active');
      if (iconEl) iconEl.textContent = '🌧️';
      if (textEl) textEl.textContent = '백색소음 ON';
    } else {
      btnToggleNoise.classList.remove('active');
      if (iconEl) iconEl.textContent = '🎧';
      if (textEl) textEl.textContent = '백색소음 OFF';
    }
  };

  btnToggleNoise?.addEventListener('click', () => {
    if (WhiteNoise.isPlaying()) {
      WhiteNoise.stop();
      state.timer.whiteNoiseEnabled = false;
      showToast('🎧 백색소음이 중지되었습니다.', 'info', 1500);
    } else {
      WhiteNoise.start('rain');
      state.timer.whiteNoiseEnabled = true;
      showToast('🌧️ 빗소리 백색소음이 시작되었습니다.', 'info', 1500);
    }
    updateNoiseBtnUi();
  });

  btnCompleteTask?.addEventListener('click', () => {
    if (state.timer.activeTaskId) {
      finishTaskFlow(state.timer.activeTaskId);
    } else {
      showToast('진행 중인 과목이 없습니다. 플래너로 이동합니다.', 'info', 1500);
      switchTab('planner');
    }
  });

  btnBackPlanner?.addEventListener('click', () => {
    switchTab('planner');
  });

  btnPomo?.addEventListener('click', () => {
    if (state.timer.isRunning) return;
    state.timer.mode = 'pomodoro';
    btnPomo.classList.add('active');
    btnStopwatch.classList.remove('active');
    // 진행 중이던 과목이 있고 남은 시간이 있다면 임의로 리셋하지 않고 보존
    if (!state.timer.activeTask || state.timer.remainingSeconds == null) {
      state.timer.remainingSeconds = state.timer.pomodoroInitialSeconds;
    }
    renderTimerDisplay(state.timer);
  });

  btnStopwatch?.addEventListener('click', () => {
    if (state.timer.isRunning) return;
    state.timer.mode = 'stopwatch';
    btnStopwatch.classList.add('active');
    btnPomo.classList.remove('active');
    state.timer.elapsedSeconds = 0;
    renderTimerDisplay(state.timer);
  });

  btnStart?.addEventListener('click', () => {
    if (state.timer.isRunning) {
      // 일시정지
      clearInterval(state.timer.intervalId);
      state.timer.isRunning = false;
      timerCircleEl?.classList.remove('running');
      if (WhiteNoise.isPlaying()) {
        WhiteNoise.stop();
      }
      renderTimerDisplay(state.timer);
      updateNoiseBtnUi();
    } else {
      // 시작
      state.timer.isRunning = true;
      timerCircleEl?.classList.add('running');
      state.timer.intervalId = setInterval(onTimerTick, 1000);
      if (state.timer.whiteNoiseEnabled) {
        WhiteNoise.start('rain');
      }

      // 만약 과목이 지정되어 있고, 카운트다운이 처음 배정시간인 상태라면 시작시간/종료예정시간을 시작 시점으로 재동기화
      const currentTaskId = state.timer.activeTaskId;
      const task = state.timer.activeTask || (currentTaskId ? state.tasks.find(t => t.id === currentTaskId) : null);
      if (task && state.timer.mode === 'pomodoro' && state.timer.remainingSeconds === state.timer.pomodoroInitialSeconds) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        task.startTime = `${hh}:${mm}`;
        task.startTimestamp = now.getTime();
        const allocMins = task.minutes || 48;
        const expDate = new Date(now.getTime() + allocMins * 60 * 1000);
        const expH = String(expDate.getHours()).padStart(2, '0');
        const expM = String(expDate.getMinutes()).padStart(2, '0');
        task.expectedEndTime = `${expH}:${expM}`;
        task.status = 'studying';
        localStorage.setItem('mqnet_selfstudy_tasks', JSON.stringify(state.tasks));
        refreshTasksList();
      }

      renderTimerDisplay(state.timer);
      updateNoiseBtnUi();
      showToast('🔥 집중 학습이 시작되었습니다. 파이팅!', 'info', 2000);
    }
  });

  btnReset?.addEventListener('click', () => {
    clearInterval(state.timer.intervalId);
    state.timer.isRunning = false;
    timerCircleEl?.classList.remove('running');
    WhiteNoise.stop();
    updateNoiseBtnUi();

    const currentTaskId = state.timer.activeTaskId;
    const task = state.timer.activeTask || (currentTaskId ? state.tasks.find(t => t.id === currentTaskId) : null);

    if (task) {
      // 1. 과목 배정시간(분)으로 타이머 정확히 복원
      const allocMins = task.minutes || 48;
      state.timer.mode = 'pomodoro';
      state.timer.pomodoroInitialSeconds = allocMins * 60;
      state.timer.remainingSeconds = allocMins * 60;

      // 2. 시작 시간 및 종료 예정시간도 리셋 시점 현재 시간으로 동기화 갱신
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      task.startTime = `${hh}:${mm}`;
      task.startTimestamp = now.getTime();

      const expDate = new Date(now.getTime() + allocMins * 60 * 1000);
      const expH = String(expDate.getHours()).padStart(2, '0');
      const expM = String(expDate.getMinutes()).padStart(2, '0');
      task.expectedEndTime = `${expH}:${expM}`;
      task.status = 'studying';

      localStorage.setItem('mqnet_selfstudy_tasks', JSON.stringify(state.tasks));
      refreshTasksList();

      showToast(`🔄 [${task.subject}] 배정시간(${allocMins}분)으로 리셋 완료! (시작시간: ${task.startTime} ➔ 종료예정: ${task.expectedEndTime})`, 'info', 3000);
    } else {
      // 진행 중인 과목이 없는 일반 타이머인 경우 25분 초기화
      if (state.timer.mode === 'pomodoro') {
        state.timer.pomodoroInitialSeconds = 25 * 60;
        state.timer.remainingSeconds = state.timer.pomodoroInitialSeconds;
      } else {
        state.timer.elapsedSeconds = 0;
      }
      showToast('🔄 타이머가 초기화되었습니다.', 'info', 1500);
    }

    renderTimerDisplay(state.timer);
  });

  btnFinish?.addEventListener('click', async () => {
    const elapsed = state.timer.mode === 'pomodoro' 
      ? (state.timer.pomodoroInitialSeconds - state.timer.remainingSeconds)
      : state.timer.elapsedSeconds;

    const studiedMinutes = Math.max(1, Math.round(elapsed / 60));
    try {
      await recordStudyProgress(studiedMinutes, ['집중 세션 완료']);
      state.timer.todayFocusSeconds += elapsed;
      showToast(`🎉 ${studiedMinutes}분 순공 시간이 저장되었습니다!`, 'success');
      btnReset.click();
    } catch (e) {
      showToast(e.message, 'error');
    }
  });
}

function onTimerTick() {
  if (state.timer.mode === 'pomodoro') {
    if (state.timer.remainingSeconds > 0) {
      state.timer.remainingSeconds -= 1;
      state.timer.todayFocusSeconds += 1;
    } else {
      // 뽀모도로 / 과목 배정시간 완료
      clearInterval(state.timer.intervalId);
      state.timer.isRunning = false;
      timerCircleEl?.classList.remove('running');
      WhiteNoise.stop();
      WhiteNoise.playChime();

      const currentTaskId = state.timer.activeTaskId;
      const currentTask = state.timer.activeTask || state.tasks.find(t => t.id === currentTaskId);

      if (currentTask) {
        showToast(`🔔 [${currentTask.subject}] 배정시간 집중 완료! 플래너로 이동합니다.`, 'success', 5000);
        setTimeout(() => {
          finishTaskFlow(currentTask.id);
        }, 800);
      } else {
        showToast('🔔 뽀모도로 집중 완료! 5분간 뇌를 쉬어주세요.', 'success', 5000);
      }
    }
  } else {
    state.timer.elapsedSeconds += 1;
    state.timer.todayFocusSeconds += 1;
  }
  renderTimerDisplay(state.timer);
}

function refreshTasksList() {
  renderTasksList(tasksListEl, state.tasks, handleStartTask, handleFinishTask, handleEditEndTask, handleEditStartTask, handleUpdateStartPage, handleDeleteTask, handleUpdateSubject, handleUpdateBookName);
}

// 과목명 직접 수정 (자격증, 전문시험, 어학 등 자유 명칭 변경)
function handleUpdateSubject(taskId, newSubject) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !newSubject) return;
  const oldSubject = task.subject;
  task.subject = newSubject;
  task.title = `${newSubject} [${task.startPage}p ➔ ${task.goalPage}p]`;

  if (state.curriculum && state.curriculum.books) {
    const book = state.curriculum.books.find(b => b.subject === oldSubject);
    if (book) {
      book.subject = newSubject;
      localStorage.setItem('mqnet_selfstudy_curriculum', JSON.stringify(state.curriculum));
      renderCurriculumSummary();
    }
  }

  localStorage.setItem('mqnet_selfstudy_tasks', JSON.stringify(state.tasks));
  refreshTasksList();
  showToast(`과목명이 '${newSubject}'(으)로 변경되었습니다.`, 'success', 2000);
}

// 교재명 직접 수정
function handleUpdateBookName(taskId, newBookName) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !newBookName) return;
  const oldBookName = task.bookName;
  task.bookName = newBookName;

  if (state.curriculum && state.curriculum.books) {
    const book = state.curriculum.books.find(b => b.bookName === oldBookName && b.subject === task.subject);
    if (book) {
      book.bookName = newBookName;
      localStorage.setItem('mqnet_selfstudy_curriculum', JSON.stringify(state.curriculum));
    }
  }

  localStorage.setItem('mqnet_selfstudy_tasks', JSON.stringify(state.tasks));
  refreshTasksList();
  showToast(`교재명이 '${newBookName}'(으)로 변경되었습니다.`, 'success', 2000);
}

function renderCurriculumSummary() {
  const summaryBar = document.getElementById('curriculumSummaryBar');
  if (!summaryBar) return;
  if (state.curriculum) {
    summaryBar.style.display = 'flex';

    // 오늘 요일에 따른 오늘 가용 학습 시간 및 과목별 배당 시간 계산
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const todayDay = days[new Date().getDay()];
    const sched = state.curriculum.weeklySchedule || {};
    const todayH = parseFloat(sched[todayDay] != null ? sched[todayDay] : 4) || 4;
    const todayTotalMinutes = Math.round(todayH * 60);
    const subjectCount = (state.tasks && state.tasks.length > 0) ? state.tasks.length : 5;
    const minutesPerSubject = Math.round(todayTotalMinutes / subjectCount);

    summaryBar.innerHTML = `
      <div class="curr-summary-left">
        <span class="curr-summary-badge">D-${state.curriculum.totalDays || 30} 진행 중</span>
        <span class="curr-meta-item">목표 완주 D-day: <strong>${state.curriculum.endDate}</strong></span>
        <span class="curr-divider">•</span>
        <span class="curr-meta-item">오늘 총 학습 가능 시간: <strong class="text-accent">${todayH}시간</strong> (${todayTotalMinutes}분)</span>
      </div>
      <div class="curr-summary-right">
        <button id="btnEditCurrMini" class="btn-timer-secondary" style="padding:0.35rem 0.75rem;font-size:0.8rem;border-radius:8px" type="button">진도계획표 수정 ⚙️</button>
      </div>
    `;
    document.getElementById('btnEditCurrMini')?.addEventListener('click', () => {
      openCurriculumModal(handleSaveCurriculum, state.curriculum);
    });
  } else {
    summaryBar.style.display = 'none';
  }
}

function handleSaveCurriculum(currData) {
  state.curriculum = currData;
  localStorage.setItem('mqnet_selfstudy_curriculum', JSON.stringify(currData));

  // 오늘 1일차 오더로 과목 플래너 목록 자동 교체
  if (currData.todayOrders && currData.todayOrders.length > 0) {
    state.tasks = currData.todayOrders.map((o, idx) => ({
      id: Date.now() + idx,
      subject: o.subject,
      bookName: o.bookName || `${o.subject} 기본서`,
      startPage: o.startPage,
      goalPage: o.todayGoalPage,
      dailyPages: o.dailyPages,
      minutes: o.minutes || 48,
      startTime: null,
      startTimestamp: null,
      expectedEndTime: null,
      completedPage: null,
      endTime: null,
      endTimestamp: null,
      actualMinutes: null,
      pph: null,
      title: `${o.subject} [${o.startPage}p ➔ ${o.todayGoalPage}p]`,
      status: 'ready',
      done: false
    }));
    localStorage.setItem('mqnet_selfstudy_tasks', JSON.stringify(state.tasks));
  }

  renderCurriculumSummary();
  refreshTasksList();
}

function setupPlanner() {
  const btnOpenTaskModal = document.getElementById('btnOpenTaskModal');
  const btnOpenAiPlanModal = document.getElementById('btnOpenAiPlanModal');
  const btnOpenCurriculumModal = document.getElementById('btnOpenCurriculumModal');

  btnOpenCurriculumModal?.addEventListener('click', () => {
    openCurriculumModal(handleSaveCurriculum, state.curriculum);
  });

  btnOpenTaskModal?.addEventListener('click', () => {
    openNewTaskModal((newTask) => {
      state.tasks.push({
        id: Date.now(),
        subject: newTask.subject,
        bookName: newTask.bookName,
        title: `${newTask.subject} [${newTask.startPage}p ➔ ${newTask.goalPage}p]`,
        startPage: newTask.startPage,
        goalPage: newTask.goalPage,
        dailyPages: Math.max(1, newTask.goalPage - newTask.startPage + 1),
        minutes: newTask.minutes || 48,
        startTime: null,
        startTimestamp: null,
        expectedEndTime: null,
        completedPage: null,
        endTime: null,
        endTimestamp: null,
        actualMinutes: null,
        pph: null,
        status: 'ready',
        done: false
      });

      // 커리큘럼이 있는 경우 교재 목록에도 함께 동기화 추가
      if (state.curriculum && state.curriculum.books) {
        const exists = state.curriculum.books.some(b => b.subject === newTask.subject && b.bookName === newTask.bookName);
        if (!exists) {
          state.curriculum.books.push({
            subject: newTask.subject,
            bookName: newTask.bookName,
            startPage: newTask.startPage,
            targetPage: newTask.goalPage + 50
          });
          localStorage.setItem('mqnet_selfstudy_curriculum', JSON.stringify(state.curriculum));
          renderCurriculumSummary();
        }
      }

      localStorage.setItem('mqnet_selfstudy_tasks', JSON.stringify(state.tasks));
      refreshTasksList();
    });
  });

  btnOpenAiPlanModal?.addEventListener('click', () => {
    openAiPlanModal(async ({ subject, target, dailyMinutes }) => {
      const res = await generateAiPlan(subject, target, dailyMinutes);
      showToast('✨ Gemini AI 맞춤 플랜이 생성되었습니다!', 'success');
      
      // AI 플랜을 과제 목록에 자동 추가
      if (res && res.ai_plan) {
        state.tasks.push({
          id: Date.now(),
          subject: subject,
          bookName: target,
          title: `[AI 추천] ${target}`,
          startPage: 1,
          goalPage: 6,
          minutes: dailyMinutes || 48,
          startTime: null,
          startTimestamp: null,
          expectedEndTime: null,
          completedPage: null,
          endTime: null,
          endTimestamp: null,
          actualMinutes: null,
          pph: null,
          status: 'ready',
          done: false
        });
        localStorage.setItem('mqnet_selfstudy_tasks', JSON.stringify(state.tasks));
        refreshTasksList();
      }
    });
  });

  // 퇴실 및 내일 진도표 생성 버튼 바인딩
  const handleOpenCheckout = () => {
    openCheckoutModal(state.tasks, state.curriculum, handleProcessCheckoutAndNextPlan);
  };
  document.getElementById('btnCheckOutAndNextPlan')?.addEventListener('click', handleOpenCheckout);
  document.getElementById('btnBottomCheckOut')?.addEventListener('click', handleOpenCheckout);

  renderCurriculumSummary();
  refreshTasksList();
}

// 1. 과목 학습 완료 후 플래너 복귀 및 페이지 입력 플로우
function finishTaskFlow(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) {
    switchTab('planner');
    return;
  }

  // 타이머 & 백색소음 정지 및 차임벨 재생
  if (state.timer.intervalId) clearInterval(state.timer.intervalId);
  state.timer.isRunning = false;
  timerCircleEl?.classList.remove('running');
  WhiteNoise.stop();
  WhiteNoise.playChime();

  // 과목 플래너 화면으로 복귀
  switchTab('planner');

  // 완료 페이지 입력 유도
  setTimeout(() => {
    const input = prompt(
      `🎯 [${task.subject}] 학습 세션 완료!\n교재: ${task.bookName || '기본교재'}\n목표: ${task.startPage}p ➔ ${task.goalPage}p\n\n최종 달성한 페이지 번호를 입력해주세요:`,
      task.goalPage
    );
    if (input !== null && input.trim() !== '') {
      handleFinishTask(task.id, input.trim());
    } else {
      showToast(`⚠️ [${task.subject}] 달성 페이지는 플래너 테이블의 [종료] 버튼을 눌러 언제든 입력하실 수 있습니다.`, 'info', 4500);
    }
  }, 350);

  // 활성 과목 상태 초기화
  state.timer.activeTaskId = null;
  state.timer.activeSubject = null;
  state.timer.activeTask = null;
  state.timer.pomodoroInitialSeconds = 25 * 60;
  state.timer.remainingSeconds = 25 * 60;
  renderTimerDisplay(state.timer);
}

// 2. 시작 버튼 클릭: 시작시간 기록 + 배정시간 더해 빨간색 종료예정시간 표시 + 순공 타이머 & 백색소음 자동 연동
function handleStartTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  // 1. 이미 동일한 과목의 타이머가 실행 중인 경우 -> 카운트다운 리셋 없이 타이머 화면으로 복귀만 수행!
  if (state.timer.activeTaskId === taskId && state.timer.isRunning) {
    switchTab('timer');
    showToast(`⏱️ [${task.subject}] 이미 진행 중인 타이머로 이동했습니다.`, 'info', 2000);
    return;
  }

  // 2. 이미 시작된 과목(일시정지 중)인데 아직 시간이 남아있는 경우 -> 남은 시간 유지한 채 타이머로 이동
  if (state.timer.activeTaskId === taskId && !state.timer.isRunning && state.timer.remainingSeconds > 0 && state.timer.remainingSeconds < state.timer.pomodoroInitialSeconds) {
    switchTab('timer');
    showToast(`⏱️ [${task.subject}] 진행 중이던 타이머로 이동했습니다. [집중 시작]을 눌러 계속 진행하세요.`, 'info', 2500);
    return;
  }

  // 3. 다른 과목이 이미 활성화되어 있는 상태에서 새 과목을 시작하려는 경우 사용자 확인
  if (state.timer.isRunning && state.timer.activeTaskId && state.timer.activeTaskId !== taskId) {
    const confirmSwitch = confirm(`현재 [${state.timer.activeSubject}] 과목 타이머가 작동 중입니다.\n[${task.subject}] 과목으로 새로 시작하시겠습니까?`);
    if (!confirmSwitch) return;
  }

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  task.startTime = `${hh}:${mm}`;
  task.startTimestamp = now.getTime();

  // 종료 예정시간 = 시작시간 + 배정시간(분)
  const allocatedMinutes = task.minutes || 48;
  const expDate = new Date(now.getTime() + allocatedMinutes * 60 * 1000);
  const expH = String(expDate.getHours()).padStart(2, '0');
  const expM = String(expDate.getMinutes()).padStart(2, '0');
  task.expectedEndTime = `${expH}:${expM}`;
  task.status = 'studying';

  localStorage.setItem('mqnet_selfstudy_tasks', JSON.stringify(state.tasks));
  refreshTasksList();

  // ── 순공 타이머 & 백색소음 자동 연동 ──
  state.timer.activeTaskId = task.id;
  state.timer.activeSubject = task.subject;
  state.timer.activeTask = task;
  state.timer.mode = 'pomodoro';
  state.timer.pomodoroInitialSeconds = allocatedMinutes * 60;
  state.timer.remainingSeconds = allocatedMinutes * 60;

  // 카운트다운 인터벌 시작
  if (state.timer.intervalId) clearInterval(state.timer.intervalId);
  state.timer.isRunning = true;
  timerCircleEl?.classList.add('running');
  state.timer.intervalId = setInterval(onTimerTick, 1000);

  // 백색소음 자동 재생
  if (state.timer.whiteNoiseEnabled) {
    WhiteNoise.start('rain');
  }

  // 화면을 타이머 탭으로 자동 전환
  switchTab('timer');
  showToast(`⏱️ [${task.subject}] ${allocatedMinutes}분 몰입 타이머 & 백색소음이 시작되었습니다!`, 'info', 3500);
}

// 3. 종료 버튼 클릭: 완료 페이지 입력 검증 + 파란색 실제 종료시간 표시 + PPH 학습속도 산출
function handleFinishTask(taskId, completedPage) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const pVal = parseInt(completedPage, 10);
  if (isNaN(pVal) || pVal < task.startPage) {
    showToast(`시작 페이지(${task.startPage}p) 이상의 달성 페이지를 입력해 주세요.`, 'warning');
    return;
  }

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  task.endTime = `${hh}:${mm}`;
  task.endTimestamp = now.getTime();
  task.completedPage = pVal;

  // 실제 순공 시간(분) 계산
  let actualMins = task.minutes || 48;
  if (task.startTimestamp) {
    actualMins = Math.max(1, Math.round((task.endTimestamp - task.startTimestamp) / 60000));
  }
  task.actualMinutes = actualMins;

  // 실제 학습한 시간에 대한 학습속도(PPH: 시간당 페이지 수) 산출
  const solvedPages = Math.max(1, pVal - task.startPage + 1);
  task.pph = ((solvedPages / (actualMins / 60))).toFixed(1);
  task.status = 'finished';
  task.done = pVal >= task.goalPage;

  // 활성 타이머와 동일 과목이면 타이머 정리
  if (state.timer.activeTaskId === taskId) {
    if (state.timer.intervalId) clearInterval(state.timer.intervalId);
    state.timer.isRunning = false;
    timerCircleEl?.classList.remove('running');
    WhiteNoise.stop();
    state.timer.activeTaskId = null;
    state.timer.activeSubject = null;
    state.timer.activeTask = null;
    state.timer.pomodoroInitialSeconds = 25 * 60;
    state.timer.remainingSeconds = 25 * 60;
    renderTimerDisplay(state.timer);
  }

  localStorage.setItem('mqnet_selfstudy_tasks', JSON.stringify(state.tasks));
  refreshTasksList();

  if (pVal >= task.goalPage) {
    showToast(`🎉 [${task.subject}] 종료 완료! (실제 ${actualMins}분 소요, 속도: ${task.pph} PPH)`, 'success');
  } else {
    showToast(`⚠️ [${task.subject}] 종료 기록 완료! (실제 ${actualMins}분 소요, ${task.goalPage - pVal}p 미달은 익일 이월)`, 'warning');
  }
}

// 3. 시작 페이지(시작P) 건너뜀/누락 직접 수정
function handleUpdateStartPage(taskId, newStartPage) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.startPage = newStartPage;
  if (task.completedPage != null && task.actualMinutes > 0) {
    const solved = Math.max(1, task.completedPage - task.startPage + 1);
    task.pph = ((solved / (task.actualMinutes / 60))).toFixed(1);
  }

  localStorage.setItem('mqnet_selfstudy_tasks', JSON.stringify(state.tasks));
  refreshTasksList();
  showToast(`📝 [${task.subject}] 시작 페이지가 ${newStartPage}p로 수정되었습니다.`, 'info');
}

// 4. 시작 시간 수정 (시작 열의 '수정' 버튼 클릭 시)
function handleEditStartTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const current = task.startTime || '16:00';
  const input = prompt(`[${task.subject}] 시작 시간을 입력해 주세요 (HH:mm 형식, 예: 16:00):`, current);
  if (!input) return;

  const match = input.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    showToast('올바른 시각(예: 16:00) 형식으로 입력해 주세요.', 'warning');
    return;
  }

  const hh = match[1].padStart(2, '0');
  const mm = match[2];
  task.startTime = `${hh}:${mm}`;

  // 종료 예정 시각 자동 재계산 (시작시간 + 배정시간)
  const totalMins = parseInt(hh, 10) * 60 + parseInt(mm, 10) + (task.minutes || 48);
  task.expectedEndTime = `${String(Math.floor(totalMins / 60) % 24).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;

  // 이미 종료된 기록이 있다면 실제 소요시간 및 PPH 재계산
  if (task.endTime) {
    const [endH, endM] = task.endTime.split(':').map(Number);
    const actualElapsed = Math.max(1, (endH * 60 + endM) - (parseInt(hh, 10) * 60 + parseInt(mm, 10)));
    task.actualMinutes = actualElapsed;
    const solved = Math.max(1, (task.completedPage || task.goalPage) - task.startPage + 1);
    task.pph = ((solved / (actualElapsed / 60))).toFixed(1);
  }

  localStorage.setItem('mqnet_selfstudy_tasks', JSON.stringify(state.tasks));
  refreshTasksList();
  showToast(`⏱️ [${task.subject}] 시작 시간이 ${task.startTime}로 수정되었습니다 (종료예정: ${task.expectedEndTime})`, 'success');
}

// 5. 종료 실적 수정 (시작시간은 보존한 채로 종료시간과 달성페이지만 수정 모드로 복원)
function handleEditEndTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  // 시작 시간(startTime, startTimestamp, expectedEndTime)은 절대 삭제하지 않고 유지!
  task.endTime = null;
  task.endTimestamp = null;
  task.status = 'studying';

  localStorage.setItem('mqnet_selfstudy_tasks', JSON.stringify(state.tasks));
  refreshTasksList();
  showToast(`✏️ [${task.subject}] 종료 실적 수정 모드입니다. 달성 페이지 확인 후 [종료 ⏹]를 눌러주세요.`, 'info');
}

// 6. 퇴실 처리 및 내일 진도표 자동 생성
async function handleProcessCheckoutAndNextPlan(results) {
  // 오늘 실적 수집 및 태스크 완료 처리
  results.forEach(res => {
    const task = state.tasks.find(t => t.id === res.taskId);
    if (task) {
      task.completedPage = res.completedPage;
      task.done = res.completedPage >= task.goalPage;
      const actualMins = task.actualMinutes || task.minutes || 48;
      const solved = Math.max(1, res.completedPage - task.startPage + 1);
      task.pph = ((solved / (actualMins / 60))).toFixed(1);
    }
  });

  // 오늘 학습 실적 아카이브 (로컬스토리지 히스토리 저장)
  const todayStr = new Date().toISOString().split('T')[0];
  const totalActualMinutes = state.tasks.reduce((sum, t) => sum + (t.actualMinutes || t.minutes || 48), 0);
  const totalSolvedPages = state.tasks.reduce((sum, t) => sum + Math.max(1, (t.completedPage || t.goalPage) - t.startPage + 1), 0);

  const todayArchive = {
    date: todayStr,
    totalMinutes: totalActualMinutes,
    totalPages: totalSolvedPages,
    tasks: state.tasks.map(t => ({
      subject: t.subject,
      bookName: t.bookName,
      startPage: t.startPage,
      goalPage: t.goalPage,
      completedPage: t.completedPage || t.goalPage,
      actualMinutes: t.actualMinutes || t.minutes || 48,
      pph: t.pph || '7.5'
    }))
  };

  try {
    const history = JSON.parse(localStorage.getItem('mqnet_selfstudy_history') || '[]');
    history.push(todayArchive);
    localStorage.setItem('mqnet_selfstudy_history', JSON.stringify(history));
  } catch (_) {}

  // 백엔드에도 실적 전송
  try {
    await recordStudyProgress(totalActualMinutes, state.tasks.map(t => `${t.subject} ${t.completedPage}p 완료`));
  } catch (_) {}

  // 내일(익일) 진도표 자동 산출
  let nextTotalDays = 29;
  if (state.curriculum) {
    state.curriculum.currentDay = (state.curriculum.currentDay || 1) + 1;
    state.curriculum.totalDays = Math.max(1, (state.curriculum.totalDays || 30) - 1);
    nextTotalDays = state.curriculum.totalDays;

    // 내일 요일 학습 가용 시간 계산
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const tomorrowDay = days[(new Date().getDay() + 1) % 7];
    const sched = state.curriculum.weeklySchedule || {};
    const tomorrowHours = parseFloat(sched[tomorrowDay] != null ? sched[tomorrowDay] : 4) || 4;
    const tomorrowTotalMinutes = Math.round(tomorrowHours * 60);
    const perSubjectMinutes = Math.round(tomorrowTotalMinutes / state.tasks.length);

    // 5과목 내일 진도 목표 자동 생성
    state.tasks = state.tasks.map((t, idx) => {
      const todayFinishedPage = t.completedPage || t.goalPage;
      const nextStartPage = todayFinishedPage + 1; // 오늘 달성 페이지 + 1이 내일 시작 페이지!

      // 교재 전체 목표 페이지 찾기
      const bookConfig = (state.curriculum.books || []).find(b => b.subject === t.subject);
      const finalTargetPage = bookConfig ? bookConfig.targetPage : (nextStartPage + 100);

      // 남은 페이지 및 일일 권장 페이지 계산
      const remainingPages = Math.max(1, finalTargetPage - nextStartPage + 1);
      const nextDailyPages = Math.max(1, Math.ceil(remainingPages / nextTotalDays));
      const nextGoalPage = Math.min(finalTargetPage, nextStartPage + nextDailyPages - 1);

      return {
        id: Date.now() + idx,
        subject: t.subject,
        bookName: t.bookName,
        title: `${t.subject} [${nextStartPage}p ➔ ${nextGoalPage}p]`,
        startPage: nextStartPage,
        goalPage: nextGoalPage,
        dailyPages: nextDailyPages,
        minutes: perSubjectMinutes,
        startTime: null,
        startTimestamp: null,
        expectedEndTime: null,
        completedPage: null,
        endTime: null,
        endTimestamp: null,
        actualMinutes: null,
        pph: null,
        status: 'ready',
        done: false
      };
    });

    localStorage.setItem('mqnet_selfstudy_curriculum', JSON.stringify(state.curriculum));
  } else {
    // 진도계획표가 없던 경우에도 오늘 완료 페이지 + 1로 내일 태스크 자동 갱신
    state.tasks = state.tasks.map((t, idx) => {
      const nextStartPage = (t.completedPage || t.goalPage) + 1;
      const nextGoalPage = nextStartPage + 5;
      return {
        id: Date.now() + idx,
        subject: t.subject,
        bookName: t.bookName,
        title: `${t.subject} [${nextStartPage}p ➔ ${nextGoalPage}p]`,
        startPage: nextStartPage,
        goalPage: nextGoalPage,
        minutes: t.minutes || 48,
        startTime: null,
        startTimestamp: null,
        expectedEndTime: null,
        completedPage: null,
        endTime: null,
        endTimestamp: null,
        actualMinutes: null,
        pph: null,
        status: 'ready',
        done: false
      };
    });
  }

  // 스터디카페 좌석 퇴실 및 문열림 승인 처리
  state.studycafeSeat.hasSeat = false;
  state.studycafeSeat.seatNumber = null;
  renderStudyCafeSeatBadge(scSeatBadgeEl, state.studycafeSeat);

  // 로컬스토리지 저장 및 화면 갱신
  localStorage.setItem('mqnet_selfstudy_tasks', JSON.stringify(state.tasks));
  renderCurriculumSummary();
  refreshTasksList();

  showToast(`🎉 퇴실 처리 및 정산 완료! (내일 ${state.curriculum ? state.curriculum.currentDay : 2}일차 맞춤 진도표가 생성되었습니다)`, 'success', 5000);
}

function handleDeleteTask(taskId) {
  const taskToDelete = state.tasks.find(t => t.id === taskId);
  state.tasks = state.tasks.filter(t => t.id !== taskId);

  // 커리큘럼 교재 목록에서도 동기화 제거 (해당 과목의 다른 일일 과제가 없는 경우)
  if (state.curriculum && state.curriculum.books && taskToDelete) {
    const hasOtherSameSubject = state.tasks.some(t => t.subject === taskToDelete.subject);
    if (!hasOtherSameSubject) {
      state.curriculum.books = state.curriculum.books.filter(b => b.subject !== taskToDelete.subject);
      localStorage.setItem('mqnet_selfstudy_curriculum', JSON.stringify(state.curriculum));
      renderCurriculumSummary();
    }
  }

  localStorage.setItem('mqnet_selfstudy_tasks', JSON.stringify(state.tasks));
  refreshTasksList();
  showToast(`'${taskToDelete?.subject || '과목'}' 과제가 삭제되었습니다.`, 'info', 1500);
}

// ── 4. AI 멘토 채팅 로직 ──────────────────────────────────
function setupAiMentor() {
  renderAiChat(aiChatEl, state.aiChat);

  const sendMessage = async (text) => {
    if (!text) return;
    const nowStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

    // 유저 메시지 추가
    state.aiChat.push({
      id: Date.now(),
      sender: 'user',
      text,
      time: nowStr
    });
    renderAiChat(aiChatEl, state.aiChat);
    aiInputEl.value = '';

    // 임시 AI 답변 대기 표시
    const pendingId = Date.now() + 1;
    state.aiChat.push({
      id: pendingId,
      sender: 'ai',
      text: '생각 중입니다... ✍️',
      time: nowStr
    });
    renderAiChat(aiChatEl, state.aiChat);

    try {
      const res = await askAiMentor(text);
      const aiReply = (res && res.reply) || 
                      (res && res.message) || 
                      (res && res.answer) || 
                      (res && res.mentor_response && res.mentor_response.answer) || 
                      '좋은 질문입니다! 꾸준한 학습 루틴이 성과의 핵심입니다.';
      
      // 답변 갱신
      const pendingMsg = state.aiChat.find(m => m.id === pendingId);
      if (pendingMsg) {
        pendingMsg.text = aiReply;
      }
    } catch (e) {
      console.error('[AI Mentor Error]', e);
      const pendingMsg = state.aiChat.find(m => m.id === pendingId);
      if (pendingMsg) {
        pendingMsg.text = `[멘토 답변] '${text}'에 대한 학습 전략을 수립 중입니다. (서버 응답 오류: ${e.message || '네트워크 확인 필요'})`;
      }
    }
    renderAiChat(aiChatEl, state.aiChat);
  };

  btnAiSend?.addEventListener('click', () => {
    sendMessage(aiInputEl.value.trim());
  });

  aiInputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendMessage(aiInputEl.value.trim());
    }
  });

  // 퀵 칩 버튼들 바인딩
  document.querySelectorAll('.quick-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.dataset.q;
      if (q) sendMessage(q);
    });
  });
}

// ── 5. 리포트 렌더링 ──────────────────────────────────────
function renderReport() {
  renderWeeklyReport(reportEl);
}

// ── 6. 탭 전환 ───────────────────────────────────────────
function switchTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  const sections = {
    timer: document.getElementById('tabTimer'),
    planner: document.getElementById('tabPlanner'),
    ai: document.getElementById('tabAi'),
    report: document.getElementById('tabReport')
  };

  Object.keys(sections).forEach(key => {
    if (sections[key]) {
      sections[key].style.display = (key === tabId) ? 'block' : 'none';
    }
  });

  if (tabId === 'timer') renderTimerDisplay(state.timer);
  else if (tabId === 'planner') {
    renderCurriculumSummary();
    refreshTasksList();
  }
  else if (tabId === 'ai') renderAiChat(aiChatEl, state.aiChat);
  else if (tabId === 'report') renderReport();
}

// ── 7. 초기화 ─────────────────────────────────────────────
async function init() {
  // 🔑 MQnet 통합 인증 초기화 및 배지 부착
  MQnetAuth.init({
    appId: 'selfstudy',
    autoPrompt: true,
    onAuthChange: (user) => {
      state.currentUser = user;
      checkStudyCafeSeat();
    }
  });
  MQnetAuth.renderBadge('userAuthBadge');

  state.currentUser = MQnetAuth.getUser();

  // 탭 클릭 바인딩
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  setupTimer();
  setupPlanner();
  setupAiMentor();
  renderReport();

  await checkStudyCafeSeat();
  // selfstudy 창이 열릴 때 기본으로 '과목 플래너'가 열리도록 전환
  switchTab('planner');
}

init();
