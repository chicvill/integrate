// apps/selfstudy/frontend/js/modals.js
// 자기주도학습 모달 및 토스트 알림 제어

export function showToast(message, type = 'info', duration = 3000) {
  let toast = document.getElementById('ssToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ssToast';
    toast.className = 'ss-toast';
    document.body.appendChild(toast);
  }

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '💡';
  toast.innerHTML = `<span class="ss-toast-icon">${icon}</span><span>${message}</span>`;
  toast.className = `ss-toast show ${type}`;

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = 'ss-toast';
  }, duration);
}

// 1. 신규 학습 과제 추가 모달
export function openNewTaskModal(onAdd) {
  const modal = document.getElementById('taskModal');
  if (!modal) return;

  const subjInput = document.getElementById('taskModalSubject');
  const bookInput = document.getElementById('taskModalBook');
  const startInput = document.getElementById('taskModalStartPage');
  const goalInput = document.getElementById('taskModalGoalPage');
  const timeInput = document.getElementById('taskModalMinutes');
  const submitBtn = document.getElementById('taskModalSubmit');

  if (subjInput) subjInput.value = '';
  if (bookInput) bookInput.value = '';
  if (startInput) startInput.value = '1';
  if (goalInput) goalInput.value = '10';
  if (timeInput) timeInput.value = '48';

  modal.classList.add('open');

  const handleAdd = () => {
    const subject = (subjInput?.value || '').trim() || '일반';
    const bookName = (bookInput?.value || '').trim() || `${subject} 교재`;
    const startPage = parseInt(startInput?.value, 10) || 1;
    const goalPage = Math.max(startPage, parseInt(goalInput?.value, 10) || (startPage + 5));
    const minutes = parseInt(timeInput?.value, 10) || 48;

    onAdd({ subject, bookName, startPage, goalPage, minutes });
    closeModal('taskModal');
    showToast(`📚 [${subject}] 과목/교재가 플래너에 추가되었습니다!`, 'success');
    submitBtn.removeEventListener('click', handleAdd);
  };

  submitBtn.onclick = handleAdd;
}

// 2. AI 스마트 플랜 생성 모달
export function openAiPlanModal(onGenerate) {
  const modal = document.getElementById('aiPlanModal');
  if (!modal) return;

  const subjSelect = document.getElementById('aiPlanSubject');
  const targetInput = document.getElementById('aiPlanTarget');
  const timeInput = document.getElementById('aiPlanDailyMin');
  const submitBtn = document.getElementById('aiPlanSubmit');

  modal.classList.add('open');

  const handleGen = async () => {
    const subject = subjSelect.value;
    const target = targetInput.value.trim();
    const dailyMinutes = parseInt(timeInput.value, 10) || 60;

    if (!target) {
      showToast('목표(예: 수능 1등급 / 기출 3회독)를 입력해 주세요.', 'warning');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Gemini AI 플랜 분석 중...';

    try {
      await onGenerate({ subject, target, dailyMinutes });
      closeModal('aiPlanModal');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '맞춤형 AI 플랜 생성';
      submitBtn.removeEventListener('click', handleGen);
    }
  };

  submitBtn.onclick = handleGen;
}

export function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('open');
}

// 모달 바깥 배경(backdrop) 클릭 시 닫기
document.addEventListener('click', (e) => {
  if (e.target && (e.target.classList.contains('ss-modal-backdrop') || e.target.classList.contains('ss-modal-overlay'))) {
    e.target.classList.remove('open');
  }
});

// 3. D-day 맞춤 진도계획표 수립 모달 (Onboarding Wizard)
export function openCurriculumModal(onSave, currentCurriculum = null) {
  const modal = document.getElementById('curriculumModal');
  if (!modal) return;

  const startDateInput = document.getElementById('currStartDate');
  const endDateInput = document.getElementById('currEndDate');
  const totalDaysText = document.getElementById('currTotalDaysText');
  const weeklyTotalText = document.getElementById('currWeeklyTotalText');
  const booksTableBody = document.getElementById('currBooksTableBody');
  const previewGrid = document.getElementById('currDailyPreviewGrid');
  const submitBtn = document.getElementById('currSubmitBtn');
  const btnAddBook = document.getElementById('btnCurrAddBook');
  const step3TitleEl = document.getElementById('currStep3Title');
  const modalTitleEl = modal.querySelector('.ss-modal-title');

  // 모달 타이틀 및 제출 버튼 명칭 동적 조정
  if (modalTitleEl) {
    modalTitleEl.textContent = currentCurriculum ? '📋 진도계획표 수정' : '📋 진도계획표 생성';
  }
  if (submitBtn) {
    submitBtn.textContent = currentCurriculum ? '🚀 진도계획표 수정 저장하기' : '🚀 진도계획표 생성 및 1일차 오더 시작하기';
  }

  // 날짜 기본값: 오늘 ~ 30일 후
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const defaultEnd = new Date(today);
  defaultEnd.setDate(today.getDate() + 30);
  const endStr = defaultEnd.toISOString().split('T')[0];

  startDateInput.value = currentCurriculum?.startDate || todayStr;
  endDateInput.value = currentCurriculum?.endDate || endStr;

  // 요일별 시간
  const defaultHours = currentCurriculum?.weeklySchedule || {
    mon: 4, tue: 4, wed: 4, thu: 4, fri: 4, sat: 8, sun: 4
  };
  document.getElementById('currHourMon').value = defaultHours.mon ?? 4;
  document.getElementById('currHourTue').value = defaultHours.tue ?? 4;
  document.getElementById('currHourWed').value = defaultHours.wed ?? 4;
  document.getElementById('currHourThu').value = defaultHours.thu ?? 4;
  document.getElementById('currHourFri').value = defaultHours.fri ?? 4;
  document.getElementById('currHourSat').value = defaultHours.sat ?? 8;
  document.getElementById('currHourSun').value = defaultHours.sun ?? 4;

  // 과목 교재 목록 초기화 (기존 데이터 보존 또는 기본 5과목)
  const defaultBooks = (currentCurriculum?.books && currentCurriculum.books.length > 0)
    ? currentCurriculum.books
    : [
        { subject: '수학', bookName: '쎈수학(상)', startPage: 1, targetPage: 180 },
        { subject: '영어', bookName: 'EBS 수능특강영어', startPage: 1, targetPage: 120 },
        { subject: '국어', bookName: '마더텅 수능기출', startPage: 1, targetPage: 150 },
        { subject: '탐구', bookName: '완자 과학탐구', startPage: 1, targetPage: 160 },
        { subject: '한국사', bookName: '한능검 기출총정리', startPage: 1, targetPage: 100 }
      ];

  // 교재 행 생성 헬퍼 (과목/교재 인풋 및 행 삭제 버튼)
  function createBookRow(b = { subject: '', bookName: '', startPage: 1, targetPage: 100 }) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="text" class="book-input book-subject" value="${b.subject || ''}" placeholder="과목명 (예: 국어)" required>
      </td>
      <td>
        <input type="text" class="book-input book-name" value="${b.bookName || ''}" placeholder="교재명 (예: 수능특강)">
      </td>
      <td>
        <input type="number" class="book-input book-start" value="${b.startPage ?? 1}" min="1" style="text-align:center">
      </td>
      <td>
        <input type="number" class="book-input book-target" value="${b.targetPage ?? 100}" min="2" style="text-align:center">
      </td>
      <td style="text-align:center">
        <button type="button" class="btn-curr-del-row" title="해당 과목/교재 삭제">✕</button>
      </td>
    `;

    tr.querySelectorAll('input').forEach(inp => {
      inp.oninput = updateCalculations;
    });

    tr.querySelector('.btn-curr-del-row').onclick = () => {
      const allRows = booksTableBody.querySelectorAll('tr');
      if (allRows.length <= 1) {
        showToast('최소 1개 이상의 과목 및 교재가 유지되어야 합니다.', 'warning');
        return;
      }
      tr.remove();
      updateCalculations();
      showToast('과목/교재가 삭제되었습니다.', 'info', 1500);
    };

    return tr;
  }

  // 기존 교재들 렌더링
  booksTableBody.innerHTML = '';
  defaultBooks.forEach(b => {
    booksTableBody.appendChild(createBookRow(b));
  });

  // 프리셋 과목/교재 데이터셋 (자격증, 전문시험, 수능/내신)
  const PRESET_BOOKS = {
    csat: [
      { subject: '국어', bookName: '마더텅 수능기출', startPage: 1, targetPage: 150 },
      { subject: '수학', bookName: '쎈수학(상)', startPage: 1, targetPage: 180 },
      { subject: '영어', bookName: 'EBS 수능특강영어', startPage: 1, targetPage: 120 },
      { subject: '탐구', bookName: '완자 과학탐구', startPage: 1, targetPage: 160 },
      { subject: '한국사', bookName: '한능검 기출총정리', startPage: 1, targetPage: 100 }
    ],
    it: [
      { subject: '소프트웨어설계', bookName: '정보처리기사 1과목 기본서', startPage: 1, targetPage: 120 },
      { subject: '소프트웨어개발', bookName: '정보처리기사 2과목 기본서', startPage: 1, targetPage: 140 },
      { subject: '데이터베이스구축', bookName: '정보처리기사 3과목 기본서', startPage: 1, targetPage: 130 },
      { subject: '프로그래밍언어', bookName: '정보처리기사 4과목 핵심예제', startPage: 1, targetPage: 160 },
      { subject: '정보시스템구축', bookName: '정보처리기사 5과목 기출문제', startPage: 1, targetPage: 110 }
    ],
    realtor: [
      { subject: '부동산학개론', bookName: '공인중개사 1차 기본서', startPage: 1, targetPage: 200 },
      { subject: '민법및민사특별법', bookName: '공인중개사 1차 민법', startPage: 1, targetPage: 220 },
      { subject: '공인중개사법령', bookName: '공인중개사 2차 실무', startPage: 1, targetPage: 160 },
      { subject: '부동산공법', bookName: '공인중개사 2차 공법', startPage: 1, targetPage: 210 },
      { subject: '부동산공시세법', bookName: '공인중개사 2차 세법', startPage: 1, targetPage: 180 }
    ],
    cert: [
      { subject: '토익(LC)', bookName: '해커스 토익 LC 1000제', startPage: 1, targetPage: 150 },
      { subject: '토익(RC)', bookName: '해커스 토익 RC 1000제', startPage: 1, targetPage: 180 },
      { subject: '컴퓨터활용능력', bookName: '컴활 1급 필기/실기', startPage: 1, targetPage: 160 },
      { subject: '한국사능력검정', bookName: '한능검 심화 핵심서', startPage: 1, targetPage: 140 },
      { subject: '어학/오픽', bookName: 'OPIc IH/AL 공략', startPage: 1, targetPage: 100 }
    ]
  };

  // 프리셋 칩 클릭 바인딩
  document.querySelectorAll('.preset-chip-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.preset-chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const presetKey = btn.dataset.preset;
      const books = PRESET_BOOKS[presetKey];
      if (books && books.length > 0) {
        booksTableBody.innerHTML = '';
        books.forEach(b => booksTableBody.appendChild(createBookRow(b)));
        updateCalculations();
        showToast(`✨ [${btn.textContent.trim()}] 맞춤 진도 과목이 세팅되었습니다!`, 'success', 2000);
      }
    };
  });

  // + 과목/교재 추가 버튼 이벤트
  if (btnAddBook) {
    btnAddBook.onclick = () => {
      const count = booksTableBody.querySelectorAll('tr').length;
      const newRow = createBookRow({
        subject: `선택과목 ${count + 1}`,
        bookName: '',
        startPage: 1,
        targetPage: 100
      });
      booksTableBody.appendChild(newRow);
      updateCalculations();
      const subjInp = newRow.querySelector('.book-subject');
      subjInp?.focus();
      subjInp?.select();
      showToast('새 과목/교재 행이 추가되었습니다.', 'success', 1500);
    };
  }

  // 실시간 계산 함수
  function updateCalculations() {
    const sDate = new Date(startDateInput.value || todayStr);
    const eDate = new Date(endDateInput.value || endStr);
    const diffTime = eDate.getTime() - sDate.getTime();
    let totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (isNaN(totalDays) || totalDays < 1) totalDays = 1;

    totalDaysText.textContent = `${totalDays}일 (D-${totalDays - 1})`;

    // 주간 가용 시간
    const hMon = parseFloat(document.getElementById('currHourMon').value) || 0;
    const hTue = parseFloat(document.getElementById('currHourTue').value) || 0;
    const hWed = parseFloat(document.getElementById('currHourWed').value) || 0;
    const hThu = parseFloat(document.getElementById('currHourThu').value) || 0;
    const hFri = parseFloat(document.getElementById('currHourFri').value) || 0;
    const hSat = parseFloat(document.getElementById('currHourSat').value) || 0;
    const hSun = parseFloat(document.getElementById('currHourSun').value) || 0;
    const weeklyHours = hMon + hTue + hWed + hThu + hFri + hSat + hSun;
    weeklyTotalText.innerHTML = `⏱️ 주당 총 가용 시간: <strong>${weeklyHours}시간</strong> (${Math.round(weeklyHours * 60)}분)`;

    // 오늘 요일에 따른 일일 가용 분 (등록된 과목 수로 균등 분배)
    const dayOfWeek = today.getDay(); // 0(일)~6(토)
    const todayHours = dayOfWeek === 0 ? hSun : dayOfWeek === 6 ? hSat : hMon;
    const todayTotalMinutes = Math.round(todayHours * 60);

    const rows = booksTableBody.querySelectorAll('tr');
    const rowCount = Math.max(1, rows.length);
    const minutesPerSubject = Math.round(todayTotalMinutes / rowCount);

    if (step3TitleEl) {
      step3TitleEl.textContent = `과목별 교재명 및 완독 목표 페이지 (총 ${rowCount}과목)`;
    }

    const previews = [];

    rows.forEach(tr => {
      const subj = tr.querySelector('.book-subject')?.value.trim() || '과목';
      const bookName = tr.querySelector('.book-name')?.value.trim() || `${subj} 기본서`;
      const startP = parseInt(tr.querySelector('.book-start').value, 10) || 1;
      const targetP = parseInt(tr.querySelector('.book-target').value, 10) || 100;
      const totalPages = Math.max(1, targetP - startP + 1);
      const dailyPages = Math.max(1, Math.ceil(totalPages / totalDays));
      const todayGoalPage = Math.min(targetP, startP + dailyPages - 1);

      previews.push({
        subject: subj,
        bookName: bookName,
        startPage: startP,
        todayGoalPage: todayGoalPage,
        dailyPages: dailyPages,
        minutes: minutesPerSubject
      });
    });

    previewGrid.innerHTML = previews.map(p => `
      <div class="preview-pill">
        <span class="preview-pill-subj">${p.subject}</span>
        <span class="preview-pill-target">${p.startPage}➔${p.todayGoalPage}p (+${p.dailyPages}p)</span>
        <span class="preview-pill-time">⏱️ ${p.minutes}분 배정</span>
      </div>
    `).join('');

    return { totalDays, weeklyHours, previews };
  }

  // 실시간 이벤트 바인딩
  startDateInput.onchange = updateCalculations;
  endDateInput.onchange = updateCalculations;
  ['currHourMon','currHourTue','currHourWed','currHourThu','currHourFri','currHourSat','currHourSun'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.oninput = updateCalculations;
  });

  updateCalculations();
  modal.classList.add('open');

  // 저장 버튼 핸들러
  const handleSave = () => {
    const calc = updateCalculations();
    const rows = booksTableBody.querySelectorAll('tr');
    if (rows.length === 0) {
      showToast('최소 1개 이상의 과목 및 교재를 등록해야 합니다.', 'warning');
      return;
    }

    const books = [];
    rows.forEach(tr => {
      const subject = tr.querySelector('.book-subject')?.value.trim() || '과목';
      const bookName = tr.querySelector('.book-name').value.trim() || `${subject} 교재`;
      const startPage = parseInt(tr.querySelector('.book-start').value, 10) || 1;
      const targetPage = parseInt(tr.querySelector('.book-target').value, 10) || 100;
      books.push({ subject, bookName, startPage, targetPage });
    });

    const curriculumData = {
      startDate: startDateInput.value,
      endDate: endDateInput.value,
      totalDays: calc.totalDays,
      weeklySchedule: {
        mon: parseFloat(document.getElementById('currHourMon').value) || 0,
        tue: parseFloat(document.getElementById('currHourTue').value) || 0,
        wed: parseFloat(document.getElementById('currHourWed').value) || 0,
        thu: parseFloat(document.getElementById('currHourThu').value) || 0,
        fri: parseFloat(document.getElementById('currHourFri').value) || 0,
        sat: parseFloat(document.getElementById('currHourSat').value) || 0,
        sun: parseFloat(document.getElementById('currHourSun').value) || 0
      },
      books,
      todayOrders: calc.previews
    };

    onSave(curriculumData);
    closeModal('curriculumModal');
    showToast(`🎉 맞춤 진도계획표가 저장되었습니다! (총 ${books.length}개 과목)`, 'success');
    submitBtn.removeEventListener('click', handleSave);
  };

  submitBtn.onclick = handleSave;
}

// 4. 퇴실 및 내일 진도표 생성 모달 제어
export function openCheckoutModal(tasks, curriculum, onConfirmCheckout) {
  const modal = document.getElementById('checkoutModal');
  if (!modal) return;

  const tbody = document.getElementById('checkoutTableBody');
  const finishedCountEl = document.getElementById('coFinishedCount');
  const totalTimeEl = document.getElementById('coTotalTime');
  const totalPagesEl = document.getElementById('coTotalPages');
  const avgPphEl = document.getElementById('coAvgPph');
  const submitBtn = document.getElementById('btnConfirmCheckout');

  // 통계 계산
  let finishedCount = 0;
  let totalMinutes = 0;
  let totalSolvedPages = 0;
  let pphSum = 0;
  let pphCount = 0;

  tasks.forEach(t => {
    const isDone = !!t.endTime;
    if (isDone) finishedCount++;
    const mins = t.actualMinutes || t.minutes || 48;
    totalMinutes += mins;
    const completed = t.completedPage != null ? t.completedPage : t.goalPage;
    const solved = Math.max(1, completed - t.startPage + 1);
    totalSolvedPages += solved;
    if (t.pph) {
      pphSum += parseFloat(t.pph);
      pphCount++;
    }
  });

  const avgPph = pphCount > 0 
    ? (pphSum / pphCount).toFixed(1) 
    : (totalMinutes > 0 ? ((totalSolvedPages / (totalMinutes / 60))).toFixed(1) : '7.5');

  if (finishedCountEl) finishedCountEl.textContent = `${finishedCount} / ${tasks.length}`;
  if (totalTimeEl) totalTimeEl.textContent = totalMinutes >= 60 ? `${Math.floor(totalMinutes/60)}시간 ${totalMinutes%60}분` : `${totalMinutes}분`;
  if (totalPagesEl) totalPagesEl.textContent = `${totalSolvedPages} p`;
  if (avgPphEl) avgPphEl.textContent = `${avgPph} PPH`;

  // 테이블 행 구성
  tbody.innerHTML = tasks.map(t => {
    const defaultPage = t.completedPage != null ? t.completedPage : t.goalPage;
    return `
      <tr data-task-id="${t.id}">
        <td><span class="task-subj-badge subj-${t.subject}">${t.subject}</span></td>
        <td style="text-align:left"><strong style="color:#fff">${t.bookName || t.title}</strong></td>
        <td><span style="color:#cbd5e1;font-weight:700">${t.startPage}p</span></td>
        <td><span style="color:#38bdf8;font-weight:800">${t.goalPage}p</span></td>
        <td>
          <input type="number" class="co-page-input" min="${t.startPage}" value="${defaultPage}" style="width:68px;padding:0.35rem;text-align:center;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.25);border-radius:6px;color:#fff;font-weight:800;font-size:0.95rem">
        </td>
      </tr>
    `;
  }).join('');

  modal.classList.add('open');

  const handleConfirm = () => {
    const results = [];
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(tr => {
      const taskId = parseInt(tr.getAttribute('data-task-id'), 10);
      const input = tr.querySelector('.co-page-input');
      const val = parseInt(input.value, 10);
      results.push({ taskId, completedPage: isNaN(val) ? 1 : val });
    });

    closeModal('checkoutModal');
    if (onConfirmCheckout) {
      onConfirmCheckout(results);
    }
    submitBtn.removeEventListener('click', handleConfirm);
  };

  submitBtn.onclick = handleConfirm;
}
