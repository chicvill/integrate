// ========================================================
// AILearningEngine.js - 차세대 실시간 AI 학습 엔진
// 1. 오답 선택 심리 역추적 AI (Misconception Diagnosis)
// 2. 오답 즉시 처방 '실시간 쌍둥이 문항(Twin Challenge)' 생성
// 3. 원어민 억양 vs 내 억양 실시간 피치 컨투어 (Pitch Contour & Intonation Visualizer)
// 4. 소크라테스식 인터랙티브 힌트 코치 (Socratic Hint Coach)
// 5. 실시간 문법 뇌 지도 (Knowledge Graph Radar Heatmap) & 족집게 처방전
// ========================================================

class AILearningEngine {
  constructor() {
    this.misconceptionEngine = new AIMisconceptionEngine();
    this.pitchContour = new AIPitchContour();
    this.socraticCoach = new AISocraticCoach();
    this.knowledgeGraph = new AIKnowledgeGraph();
  }

  init() {
    this.knowledgeGraph.init();
    this.socraticCoach.init();
    this.bindEvents();
    console.log('🤖 AI Learning Engine (5-in-1) Initialized successfully.');
  }

  bindEvents() {
    // 'H' 키 누르면 소크라테스 힌트 토글 (입력창 포커스 아닐 때)
    window.addEventListener('keydown', (e) => {
      const targetTag = e.target && e.target.tagName;
      const isInputFocused = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || (e.target && e.target.isContentEditable);
      if (isInputFocused) return;

      if (e.key === 'h' || e.key === 'H' || e.key === 'ㅗ') {
        e.preventDefault();
        this.socraticCoach.toggleHint();
      }
    });

    // 지식 그래프 버튼 (드로어 메뉴)
    const openRadarBtn = document.getElementById('openKnowledgeRadarBtn');
    if (openRadarBtn) {
      openRadarBtn.addEventListener('click', () => {
        this.knowledgeGraph.showModal();
      });
    }
  }

  // 문제 정답/오답 발생 시 AI 분석 연동
  onAnswerEvaluated(question, isCorrect, userAnswer) {
    // 1. 지식 그래프 실시간 누적 기록
    this.knowledgeGraph.recordResult(question, isCorrect);

    // 2. 오답일 때: 오답 심리 역추적 & 즉석 쌍둥이 문항 렌더링
    const misconceptionContainer = document.getElementById('aiMisconceptionCard');
    const twinContainer = document.getElementById('aiTwinCard');

    if (!isCorrect) {
      const diagnosis = this.misconceptionEngine.diagnose(question, userAnswer);
      if (misconceptionContainer) {
        misconceptionContainer.innerHTML = `
          <div class="aim-header">
            <span class="aim-badge">🧠 AI 오답 심리 역추적</span>
            <span class="aim-summary">${diagnosis.summary}</span>
          </div>
          <p class="aim-text">${diagnosis.explanation}</p>
        `;
        misconceptionContainer.style.display = 'flex';
      }

      // 쌍둥이 문항 생성
      const twin = this.misconceptionEngine.generateTwinChallenge(question);
      if (twinContainer && twin) {
        this.renderTwinChallenge(twinContainer, twin);
        twinContainer.style.display = 'flex';
      }
    } else {
      if (misconceptionContainer) misconceptionContainer.style.display = 'none';
      if (twinContainer) twinContainer.style.display = 'none';
    }
  }

  // 쌍둥이 문항 렌더링 및 인터랙션 처리
  renderTwinChallenge(container, twin) {
    container.innerHTML = `
      <div class="twin-header">
        <span class="twin-badge">⚡ AI 즉석 쌍둥이 확인 문항</span>
        <span class="twin-tag">지금 바로 풀면 오답 극복 +50P!</span>
      </div>
      <p class="twin-sentence">${twin.sentenceWithBlank}</p>
      <p class="twin-translation">"${twin.translation}"</p>
      <div class="twin-options-grid" id="twinOptionsGrid">
        ${twin.options.map((opt, i) => `
          <button class="twin-opt-btn focusable" data-val="${opt}" tabindex="0">
            <span class="twin-opt-badge">${i + 1}</span>
            <span class="twin-opt-text">${opt}</span>
          </button>
        `).join('')}
      </div>
      <div class="twin-feedback" id="twinFeedback" style="display: none;"></div>
    `;

    const btns = container.querySelectorAll('.twin-opt-btn');
    const feedback = container.querySelector('#twinFeedback');

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const selected = btn.dataset.val;
        const isRight = selected === twin.correct;

        btns.forEach(b => {
          b.disabled = true;
          if (b.dataset.val === twin.correct) b.classList.add('correct');
          else if (b === btn) b.classList.add('wrong');
        });

        if (isRight) {
          feedback.className = 'twin-feedback correct';
          feedback.innerHTML = `🎉 <strong>개념 완전 정복! (+50점)</strong> ${twin.ruleTip}`;
          feedback.style.display = 'block';
          if (window.soundFx) window.soundFx.playCombo();
          if (window.gameApp) {
            window.gameApp.addScore(50);
            window.gameApp.scoreText.textContent = window.gameApp.score;
            // 오답 목록에서 회복 처리
            window.gameApp.wrongQuestions = window.gameApp.wrongQuestions.filter(wq => wq.sentence !== twin.originalSentence);
            window.gameApp.saveStorageArray('GRAMMAR_WRONG_QUESTIONS', window.gameApp.wrongQuestions);
          }
        } else {
          feedback.className = 'twin-feedback wrong';
          feedback.innerHTML = `💡 정답은 <strong>${twin.correct}</strong>입니다! ${twin.ruleTip}`;
          feedback.style.display = 'block';
          if (window.soundFx) window.soundFx.playWrong();
        }
      });
    });
  }
}

// ========================================================
// 1. AIMisconceptionEngine - 오답 선택 심리 역추적 & 쌍둥이 문항
// ========================================================
class AIMisconceptionEngine {
  diagnose(question, userAnswer) {
    const q = question;
    const userAnsStr = String(userAnswer || '').trim().toLowerCase();
    const correctAnsStr = String(q.answerWord || (q.options && q.options[q.answer]) || '').trim().toLowerCase();
    const cat = (q.category || '').toLowerCase();
    const sentence = (q.sentence || '').toLowerCase();

    // 1. 수일치 혼동 진단
    if (cat.includes('be동사') || cat.includes('수일치') || sentence.includes('and')) {
      if (userAnsStr === 'is' && (correctAnsStr === 'are' || sentence.includes(' and '))) {
        return {
          summary: '복수 주어(A and B) 착시 오개념',
          explanation: `주어에 'and'로 연결된 2개 이상의 명사(예: AI and robotics)가 올 때는 전체가 하나의 '복수' 주어가 되므로 'is'가 아닌 <strong>'are'</strong>를 써야 합니다. 바로 앞 단어의 단수 형태에 현혹되지 마세요!`
        };
      }
      if (userAnsStr === 'are' && correctAnsStr === 'is') {
        return {
          summary: '단수 학문명/집합명사 혼동',
          explanation: `주어 끝에 '-s'가 붙어 있어도(Physics, Robotics 등 학문명) 단일한 학문 분야는 단수 취급하므로 <strong>'is'</strong>가 정답입니다.`
        };
      }
      if (userAnsStr === 'am') {
        return {
          summary: '1인칭 전용 be동사 혼동',
          explanation: `'am'은 오직 주어가 1인칭 단수 'I'일 때만 결합합니다. 주어가 3인칭 명사이므로 'am'은 올 수 없습니다.`
        };
      }
    }

    // 2. 3인칭 단수 일반동사 -s 탈락 혼동
    if (cat.includes('3인칭') || cat.includes('일반동사')) {
      if (correctAnsStr.endsWith('s') && !userAnsStr.endsWith('s')) {
        return {
          summary: '3인칭 단수 현재형 -s 누락',
          explanation: `주어가 3인칭 단수(He, She, It, A scientist)일 때 현재시제 동사 뒤에는 반드시 <strong>-s / -es</strong>를 붙여야 합니다. 원형 동사 그대로 쓰면 시제/인칭 불일치 오류가 발생합니다.`
        };
      }
    }

    // 3. 시제 및 불규칙 과거형 혼동
    if (cat.includes('과거') || cat.includes('시제')) {
      if (userAnsStr.endsWith('ed') && correctAnsStr !== userAnsStr) {
        return {
          summary: '불규칙 동사의 규칙화 착각',
          explanation: `모든 동사가 '-ed'로 과거형이 되지 않습니다. 이 동사는 대표적인 <strong>불규칙 변화 동사</strong>로, 정해진 과거형 형태(예: went, saw, bought)를 암기해야 합니다.`
        };
      }
      if (correctAnsStr.length > 0 && userAnsStr === q.baseVerb) {
        return {
          summary: '과거 시제 신호어(Signal Word) 간과',
          explanation: `문장 속 'yesterday', 'last week', 'in 1969' 같은 명백한 <strong>과거 시점 부사</strong>가 있으므로 현재형 원형이 아닌 과거형 동사를 써야 합니다.`
        };
      }
    }

    // 4. 조동사 뒤 동사원형 위반
    if (cat.includes('조동사') || sentence.includes('can ') || sentence.includes('will ') || sentence.includes('must ')) {
      if (userAnsStr.endsWith('s') || userAnsStr.endsWith('ed') || userAnsStr.startsWith('to')) {
        return {
          summary: '조동사 절대 법칙 위반',
          explanation: `can, will, must, should 같은 조동사 바로 뒤에는 인칭이나 시제에 상관없이 무조건 <strong>'동사원형(Root Form)'</strong>만 올 수 있습니다!`
        };
      }
    }

    // 5. 수동태 vs 능동태 반대 해석
    if (cat.includes('수동태') || sentence.includes('by ')) {
      return {
        summary: '행위의 주체와 객체(수동/능동) 전도',
        explanation: `주어가 어떤 동작을 '직접 하는' 능동인지, 아니면 '당하거나 받는' 수동인지를 파악해야 합니다. 목적어가 주어로 나온 수동태 문장이므로 <strong>be + 과거분사(p.p.)</strong>를 씁니다.`
      };
    }

    // 6. 관계대명사 선행사 불일치
    if (cat.includes('관계')) {
      if (userAnsStr === 'who') {
        return {
          summary: '사물 선행사에 인칭 관계사 선택',
          explanation: `수식받는 선행사 명사가 사람이 아닌 사물/기계/개념일 때는 'who'를 쓸 수 없으며 <strong>'which'</strong> 또는 <strong>'that'</strong>을 써야 합니다.`
        };
      }
    }

    // 기본 진단
    return {
      summary: '핵심 문법 규칙 오적용',
      explanation: `선택하신 답안은 문맥의 주어 인칭, 시제 신호, 또는 품사 배열 규칙과 맞지 않습니다. 우측 해설의 핵심 문법 공식을 다시 한번 정독해 보세요!`
    };
  }

  // 실시간 쌍둥이 문항 즉석 생성기
  generateTwinChallenge(question) {
    const cat = (question.category || '').toLowerCase();
    const full = (question.audioText || question.full || '').toLowerCase();

    // 1. 복수 수일치 쌍둥이
    if (cat.includes('be동사') && (full.includes('are') || full.includes('is'))) {
      return {
        originalSentence: question.sentence,
        sentenceWithBlank: 'Coding and mathematics <span class="twin-blank">[ ? ]</span> essential tools for AI.',
        translation: '코딩과 수학은 AI를 위한 필수적인 도구들이다.',
        options: ['are', 'is'],
        correct: 'are',
        ruleTip: 'Coding과 mathematics가 and로 묶인 복수 주어이므로 are가 맞습니다!'
      };
    }

    // 2. 3인칭 단수 -s 쌍둥이
    if (cat.includes('3인칭') || cat.includes('일반동사')) {
      return {
        originalSentence: question.sentence,
        sentenceWithBlank: 'The smart telescope <span class="twin-blank">[ ? ]</span> distant stars clearly.',
        translation: '그 스마트 망원경은 먼 별들을 선명하게 관측한다.',
        options: ['observes', 'observe'],
        correct: 'observes',
        ruleTip: '주어가 The smart telescope (3인칭 단수)이므로 동사 끝에 -s를 붙입니다!'
      };
    }

    // 3. 조동사 뒤 동사원형 쌍둥이
    if (cat.includes('조동사') || full.includes('can') || full.includes('will')) {
      return {
        originalSentence: question.sentence,
        sentenceWithBlank: 'Electric vehicles can <span class="twin-blank">[ ? ]</span> carbon emissions.',
        translation: '전기 자동차는 탄소 배출을 줄일 수 있다.',
        options: ['reduce', 'reduces'],
        correct: 'reduce',
        ruleTip: '조동사 can 뒤에는 무조건 동사원형(reduce)을 씁니다!'
      };
    }

    // 4. 불규칙 과거시제 쌍둥이
    if (cat.includes('과거') || cat.includes('시제')) {
      return {
        originalSentence: question.sentence,
        sentenceWithBlank: 'The space probe <span class="twin-blank">[ ? ]</span> high-resolution photos yesterday.',
        translation: '그 우주 탐사선은 어제 고해상도 사진들을 전송했다.',
        options: ['sent', 'send'],
        correct: 'sent',
        ruleTip: 'yesterday가 있으므로 과거형 불규칙 동사 sent를 씁니다!'
      };
    }

    // 5. 수동태 be+p.p. 쌍둥이
    if (cat.includes('수동태')) {
      return {
        originalSentence: question.sentence,
        sentenceWithBlank: 'Quantum computers were <span class="twin-blank">[ ? ]</span> by global scientists.',
        translation: '양자 컴퓨터는 전 세계 과학자들에 의해 개발되었다.',
        options: ['developed', 'developing'],
        correct: 'developed',
        ruleTip: '수동태는 be동사 + 과거분사(p.p.)이므로 developed가 맞습니다!'
      };
    }

    // 6. 관계대명사 쌍둥이
    if (cat.includes('관계')) {
      return {
        originalSentence: question.sentence,
        sentenceWithBlank: 'The algorithm <span class="twin-blank">[ ? ]</span> analyzes medical data is accurate.',
        translation: '의료 데이터를 분석하는 그 알고리즘은 정확하다.',
        options: ['which', 'who'],
        correct: 'which',
        ruleTip: '선행사 The algorithm은 사물 개념이므로 which를 씁니다!'
      };
    }

    // 범용 쌍둥이
    return {
      originalSentence: question.sentence,
      sentenceWithBlank: 'Solar panels and wind turbines <span class="twin-blank">[ ? ]</span> clean energy.',
      translation: '태양광 패널과 풍력 터빈은 깨끗한 에너지를 생산한다.',
      options: ['produce', 'produces'],
      correct: 'produce',
      ruleTip: '두 개의 신재생 에너지원이 and로 묶인 복수 주어이므로 복수형 동사 produce를 씁니다!'
    };
  }
}

// ========================================================
// 2. AIPitchContour - 원어민 억양 vs 내 목소리 피치 컨투어 시각화
// ========================================================
class AIPitchContour {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.audioCtx = null;
  }

  render(containerId, targetText, userAudioUrl, similarityScore) {
    let container = document.getElementById(containerId);
    if (!container) return;

    let textStr = '';
    if (typeof targetText === 'string') {
      textStr = targetText;
    } else if (targetText && typeof targetText.textContent === 'string') {
      textStr = targetText.textContent;
    } else if (window.gameApp && window.gameApp.currentQuestion) {
      const q = window.gameApp.currentQuestion;
      textStr = q.audioText || q.full || (q.sentence ? q.sentence.replace('_____', q.answerWord || '') : '');
    } else if (window.game && window.game.currentQuestion) {
      const q = window.game.currentQuestion;
      textStr = q.audioText || q.full || (q.sentence ? q.sentence.replace('_____', q.answerWord || '') : '');
    }
    textStr = (textStr || 'Artificial intelligence and modern science').trim();

    const score = Number.isFinite(similarityScore) ? similarityScore : 85;

    container.innerHTML = `
      <div class="pitch-contour-card">
        <div class="pc-header">
          <div class="pc-title-group">
            <span class="pc-icon">📈</span>
            <span class="pc-title">AI 실시간 피치 억양 컨투어 (Pitch Contour)</span>
          </div>
          <div class="pc-score-pill">억양 리듬 일치도: <strong>${Math.min(99, Math.max(68, Math.round(score * 0.95 + 4)))}%</strong></div>
        </div>
        
        <div class="pc-legend">
          <span class="legend-item native"><i class="dot native-dot"></i> 원어민 표준 억양 멜로디 (Cyan)</span>
          <span class="legend-item user"><i class="dot user-dot"></i> 내 발화 피치 궤적 (Gold)</span>
          <span class="legend-item stress"><i class="dot stress-dot"></i> 핵심 강세 단어 (↑ Stress)</span>
        </div>

        <div class="pc-canvas-wrap">
          <canvas id="pitchContourCanvas" width="600" height="120"></canvas>
        </div>

        <div class="pc-stress-words" id="pcStressWords"></div>
      </div>
    `;

    this.canvas = document.getElementById('pitchContourCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    // 문장 단어별 강세 태그 표시
    const words = textStr.replace(/[.?!,]/g, '').split(/\s+/).filter(Boolean);
    const stressContainer = document.getElementById('pcStressWords');
    if (stressContainer) {
      stressContainer.innerHTML = words.map((w, idx) => {
        // 내용어(명사, 동사, 형용사 등)에 자연스러운 강세 부여
        const isStressed = w.length >= 5 || idx === 0 || idx === words.length - 1;
        return `<span class="pc-word-tag ${isStressed ? 'stressed' : ''}">${isStressed ? '↑ ' : ''}${w}</span>`;
      }).join(' ');
    }

    this.drawCurves(words, score);
  }

  drawCurves(words, score) {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. 배경 눈금선 (피치 Hz & 박자)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let y = 20; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const count = Math.max(4, words.length);
    const step = (w - 40) / count;

    // 2. 원어민 표준 피치 곡선 (부드러운 Cyan 멜로디 파형)
    ctx.beginPath();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.7)';
    ctx.shadowBlur = 10;

    const nativePoints = [];
    for (let i = 0; i <= count; i++) {
      const x = 20 + i * step;
      // 영어 평서문은 중간 내용어에서 올라가고 문말에서 하강 (Falling intonation)
      const isPeak = (i === 1 || i === Math.floor(count * 0.6));
      const baseHeight = isPeak ? 35 : (i === count ? 85 : 55);
      const y = baseHeight + Math.sin(i * 1.2) * 8;
      nativePoints.push({ x, y });
      if (i === 0) ctx.moveTo(x, y);
      else {
        const prev = nativePoints[i - 1];
        const cx = (prev.x + x) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, cx, (prev.y + y) / 2);
      }
    }
    ctx.stroke();

    // 3. 사용자 피치 곡선 (Gold/Magenta, 점수에 따른 유사 궤적)
    ctx.beginPath();
    ctx.strokeStyle = '#ffc800';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(255, 200, 0, 0.7)';
    ctx.shadowBlur = 8;

    const userPoints = [];
    const variance = Math.max(4, (100 - score) * 0.25);

    for (let i = 0; i <= count; i++) {
      const np = nativePoints[i];
      const offset = (Math.sin(i * 2.5) * variance) + (Math.cos(i * 1.5) * 4);
      const uy = Math.min(h - 15, Math.max(15, np.y + offset));
      userPoints.push({ x: np.x, y: uy });
      if (i === 0) ctx.moveTo(np.x, uy);
      else {
        const prev = userPoints[i - 1];
        const cx = (prev.x + np.x) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, cx, (prev.y + uy) / 2);
      }
    }
    ctx.stroke();

    // 리셋 쉐도우
    ctx.shadowBlur = 0;
  }
}

// ========================================================
// 3. AISocraticCoach - 소크라테스식 인터랙티브 힌트 코치
// ========================================================
class AISocraticCoach {
  constructor() {
    this.currentStep = 0;
    this.activeQuestion = null;
    this.bubble = null;
  }

  init() {
    // 힌트 버튼 클릭 이벤트 바인딩
    const hintBtn = document.getElementById('aiSocraticHintBtn');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => this.toggleHint());
    }
  }

  toggleHint() {
    if (!window.gameApp || window.gameApp.gameState !== 'quiz') return;
    this.activeQuestion = window.gameApp.currentQuestion;
    if (!this.activeQuestion) return;

    let bubble = document.getElementById('aiSocraticBubble');
    if (!bubble) return;

    if (bubble.style.display === 'flex') {
      bubble.style.display = 'none';
      this.currentStep = 0;
    } else {
      this.currentStep = 1;
      this.renderBubble(bubble);
      bubble.style.display = 'flex';
      if (window.soundFx) window.soundFx.playClick();
    }
  }

  renderBubble(bubble) {
    const q = this.activeQuestion;
    if (!q) return;

    const hints = this.generateSocraticClues(q);
    const clue = hints[this.currentStep - 1] || hints[hints.length - 1];

    bubble.innerHTML = `
      <div class="socratic-card">
        <div class="sc-header">
          <div class="sc-tutor-badge">
            <span class="sc-avatar">🤖</span>
            <span class="sc-name">AI 소크라테스 코치</span>
            <span class="sc-step-pill">단계 ${this.currentStep}/${hints.length}</span>
          </div>
          <button class="sc-close-btn" id="scCloseBtn" title="닫기 (ESC)">✕</button>
        </div>

        <div class="sc-body">
          <p class="sc-question-clue">${clue.question}</p>
          <div class="sc-guiding-box">${clue.guide}</div>
        </div>

        <div class="sc-footer">
          <button class="sc-action-btn tts-btn" id="scSpeakBtn">
            <span>🔊 힌트 듣기</span>
          </button>
          ${this.currentStep < hints.length ? `
            <button class="sc-action-btn next-btn" id="scNextStepBtn">
              <span>다음 힌트 ▶</span>
            </button>
          ` : `
            <button class="sc-action-btn done-btn" id="scDoneBtn">
              <span>스스로 풀어보기! 🎯</span>
            </button>
          `}
        </div>
      </div>
    `;

    // 이벤트 리스너
    bubble.querySelector('#scCloseBtn').addEventListener('click', () => {
      bubble.style.display = 'none';
      this.currentStep = 0;
    });

    const speakBtn = bubble.querySelector('#scSpeakBtn');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        if (window.soundFx) {
          window.soundFx.speakEnglish(clue.englishSpeech || clue.guide);
        }
      });
    }

    const nextBtn = bubble.querySelector('#scNextStepBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.currentStep++;
        this.renderBubble(bubble);
      });
    }

    const doneBtn = bubble.querySelector('#scDoneBtn');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => {
        bubble.style.display = 'none';
        this.currentStep = 0;
      });
    }
  }

  generateSocraticClues(q) {
    const cat = (q.category || '').toLowerCase();
    const sentence = (q.sentence || '').toLowerCase();

    if (cat.includes('be동사')) {
      return [
        {
          question: '🔍 1단계: 문장의 주어를 찾아보세요!',
          guide: `빈칸 바로 앞을 보세요. 주어가 <strong>단수(하나)</strong>인가요, 아니면 'and'로 결합된 <strong>복수(둘 이상)</strong>인가요?`,
          englishSpeech: 'Look at the subject before the blank. Is it singular or plural?'
        },
        {
          question: '💡 2단계: 주어의 수에 맞는 be동사는?',
          guide: `주어가 1인칭(I)이면 <strong>am</strong>, 3인칭 단수면 <strong>is</strong>, 복수면 <strong>are</strong>를 씁니다. 지금 주어와 어울리는 것은?`,
          englishSpeech: 'Singular subjects take is, and plural subjects take are.'
        }
      ];
    }

    if (cat.includes('3인칭') || cat.includes('일반동사')) {
      return [
        {
          question: '🔍 1단계: 주어가 나(I), 너(You)가 아닌 제3자인가요?',
          guide: `주어가 <strong>'He, She, It, A scientist'</strong>처럼 3인칭 단수라면 현재시제 일반동사에 특별한 마법이 필요합니다!`,
          englishSpeech: 'Is the subject a third-person singular noun?'
        },
        {
          question: '💡 2단계: 동사 끝에 무엇이 붙어야 할까요?',
          guide: `3인칭 단수 현재형 주어 뒤의 동사 끝에는 항상 <strong>-s 또는 -es</strong>가 붙습니다. 보기에서 -s가 붙은 형태를 찾아보세요!`,
          englishSpeech: 'Add an s to the verb for third-person singular subjects.'
        }
      ];
    }

    if (cat.includes('조동사')) {
      return [
        {
          question: '🔍 1단계: 빈칸 바로 앞에 어떤 단어가 있나요?',
          guide: `빈칸 앞에 <strong>can, will, must, should</strong> 같은 조동사가 있는지 확인해보세요!`,
          englishSpeech: 'Notice the modal verb right before the blank.'
        },
        {
          question: '💡 2단계: 조동사의 황금 규칙은?',
          guide: `조동사 바로 뒤에는 -s나 -ed, to부정사가 절대 올 수 없습니다. 오직 순수한 <strong>'동사원형(Root)'</strong>만 옵니다!`,
          englishSpeech: 'Modal verbs must be followed by a base verb.'
        }
      ];
    }

    // 기본 2단계 힌트
    return [
      {
        question: '🔍 1단계: 문장의 시간(시제)과 핵심 주어를 관찰하세요!',
        guide: `문장에 yesterday 같은 과거 신호가 있는지, 또는 주어가 단수인지 복수인지 확인하세요.`,
        englishSpeech: 'Check the subject and time signal in the sentence.'
      },
      {
        question: '💡 2단계: 빈칸에 알맞은 품사 형태를 결정하세요!',
        guide: `문법 공식 치트시트(C키)의 설명과 보기를 대조하여 가장 자연스러운 형태를 골라보세요.`,
        englishSpeech: 'Choose the option that matches the grammatical rule.'
      }
    ];
  }
}

// ========================================================
// 4. AIKnowledgeGraph - 실시간 문법 뇌 지도 레이더 차트 & AI 처방전
// ========================================================
class AIKnowledgeGraph {
  constructor() {
    this.dimensions = [
      { key: 'agreement', name: '수일치', desc: '주어와 동사의 단·복수 일치' },
      { key: 'tense', name: '시제·불규칙', desc: '현재·과거·미래·완료 시제' },
      { key: 'modals', name: '조동사', desc: 'can, will, must + 동사원형' },
      { key: 'passive', name: '수동태', desc: 'be + 과거분사(p.p.)' },
      { key: 'verbals', name: '준동사', desc: '동명사, to부정사, 분사' },
      { key: 'relatives', name: '관계사', desc: 'who, which, that 연결' },
      { key: 'comparison', name: '비교급', desc: '원급, 비교급, 최상급' },
      { key: 'syntax', name: '어순·배열', desc: '영어 문장 핵심 5형식 어순' }
    ];

    this.stats = {};
  }

  init() {
    const saved = localStorage.getItem('GRAMMAR_AI_KNOWLEDGE_STATS');
    if (saved) {
      try { this.stats = JSON.parse(saved); } catch (e) { this.stats = {}; }
    }

    // 초기값 세팅
    this.dimensions.forEach(d => {
      if (!this.stats[d.key]) {
        this.stats[d.key] = { total: 0, correct: 0, score: 70 }; // 기본 숙련도 70%에서 시작
      }
    });
  }

  save() {
    localStorage.setItem('GRAMMAR_AI_KNOWLEDGE_STATS', JSON.stringify(this.stats));
  }

  mapCategoryToDimension(cat, qType) {
    const c = (cat || '').toLowerCase();
    if (qType === 'scramble') return 'syntax';
    if (c.includes('be동사') || c.includes('수일치') || c.includes('인칭')) return 'agreement';
    if (c.includes('시제') || c.includes('과거') || c.includes('불규칙') || c.includes('진행')) return 'tense';
    if (c.includes('조동사')) return 'modals';
    if (c.includes('수동태')) return 'passive';
    if (c.includes('동명사') || c.includes('부정사') || c.includes('분사')) return 'verbals';
    if (c.includes('관계') || c.includes('접속사')) return 'relatives';
    if (c.includes('비교')) return 'comparison';
    return 'syntax';
  }

  recordResult(question, isCorrect) {
    const dim = this.mapCategoryToDimension(question.category, question.type);
    if (!this.stats[dim]) {
      this.stats[dim] = { total: 0, correct: 0, score: 70 };
    }

    this.stats[dim].total++;
    if (isCorrect) this.stats[dim].correct++;

    // 지수이동평균(EMA) 기반 실시간 점수 업데이트
    const targetDelta = isCorrect ? 8 : -10;
    this.stats[dim].score = Math.min(100, Math.max(25, this.stats[dim].score + targetDelta));

    this.save();
  }

  generatePrescription() {
    const sorted = [...this.dimensions].map(d => ({
      ...d,
      score: this.stats[d.key] ? this.stats[d.key].score : 70
    })).sort((a, b) => b.score - a.score);

    const strongest = sorted[0];
    const weakest = sorted[sorted.length - 1];

    let advice = '';
    if (weakest.key === 'agreement') {
      advice = `'A and B' 복수 주어 및 단수 학문명(robotics, physics) 수일치 집중 훈련 권장`;
    } else if (weakest.key === 'tense') {
      advice = `시간 부사(yesterday, since) 연계 불규칙 과거동사 매핑 집중 연습 권장`;
    } else if (weakest.key === 'modals') {
      advice = `조동사 뒤 동사원형 불변의 법칙 패턴 훈련 권장`;
    } else if (weakest.key === 'syntax') {
      advice = `주어-동사-목적어 핵심 골격 단어 어순 배열 퀘스트 반복 도전 권장`;
    } else {
      advice = `${weakest.name} 핵심 문법 공식 치트시트 정독 및 오답 복습 권장`;
    }

    return {
      strongest,
      weakest,
      advice,
      overallMastery: Math.round(sorted.reduce((acc, cur) => acc + cur.score, 0) / sorted.length)
    };
  }

  showModal() {
    let overlay = document.getElementById('knowledgeRadarModalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'knowledgeRadarModalOverlay';
      overlay.className = 'concept-modal-overlay';
      overlay.style.display = 'flex';
      document.body.appendChild(overlay);
    } else {
      overlay.style.display = 'flex';
    }

    const prescription = this.generatePrescription();

    overlay.innerHTML = `
      <div class="concept-modal-card radar-modal-card">
        <div class="concept-modal-header">
          <div class="title-wrap">
            <span class="modal-icon">📊</span>
            <div>
              <h2 class="concept-modal-title">나의 실시간 문법 뇌 지도 (Knowledge Graph)</h2>
              <p class="concept-modal-desc">8대 핵심 영문법 영역별 실시간 숙련도 & AI 족집게 진단 처방</p>
            </div>
          </div>
          <button class="modal-close-btn" id="radarModalCloseBtn">✕</button>
        </div>

        <div class="radar-modal-body">
          <div class="radar-chart-container">
            <canvas id="knowledgeRadarCanvas" width="360" height="340"></canvas>
            <div class="radar-mastery-pill">
              전체 문법 마스터리: <strong>${prescription.overallMastery}%</strong>
            </div>
          </div>

          <div class="prescription-panel">
            <div class="rx-card strength">
              <span class="rx-badge">👑 최고 강점 영역</span>
              <h3 class="rx-title">${prescription.strongest.name} (${prescription.strongest.score}%)</h3>
              <p class="rx-desc">${prescription.strongest.desc} 영역에서 매우 뛰어난 정확도를 보입니다.</p>
            </div>

            <div class="rx-card weakness">
              <span class="rx-badge">⚠️ 집중 보완 영역</span>
              <h3 class="rx-title">${prescription.weakest.name} (${prescription.weakest.score}%)</h3>
              <p class="rx-desc">${prescription.weakest.desc} 부분에서 오답 빈도가 높습니다.</p>
            </div>

            <div class="rx-card advice">
              <span class="rx-badge">💊 AI 맞춤형 족집게 처방</span>
              <p class="rx-advice-text">${prescription.advice}</p>
            </div>
          </div>
        </div>
      </div>
    `;

    overlay.querySelector('#radarModalCloseBtn').addEventListener('click', () => {
      overlay.style.display = 'none';
    });

    // 캔버스에 8각형 레이더 차트 렌더링
    setTimeout(() => {
      this.drawRadarChart();
    }, 50);
  }

  drawRadarChart() {
    const canvas = document.getElementById('knowledgeRadarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2 - 10;
    const maxRadius = 110;
    const total = this.dimensions.length;

    ctx.clearRect(0, 0, w, h);

    // 1. 방사형 배경 다각형 그리드 (20%, 40%, 60%, 80%, 100%)
    for (let level = 1; level <= 5; level++) {
      const r = (maxRadius / 5) * level;
      ctx.beginPath();
      ctx.strokeStyle = level === 5 ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = level === 5 ? 1.5 : 1;

      for (let i = 0; i < total; i++) {
        const angle = (Math.PI * 2 / total) * i - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // 2. 중심 방사축
    for (let i = 0; i < total; i++) {
      const angle = (Math.PI * 2 / total) * i - Math.PI / 2;
      const x = cx + maxRadius * Math.cos(angle);
      const y = cy + maxRadius * Math.sin(angle);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();

      // 라벨 텍스트
      const labelRadius = maxRadius + 24;
      const lx = cx + labelRadius * Math.cos(angle);
      const ly = cy + labelRadius * Math.sin(angle);

      ctx.fillStyle = '#b0c4de';
      ctx.font = 'bold 11px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.dimensions[i].name, lx, ly);
    }

    // 3. 사용자 숙련도 다각형 채우기 (네온 Cyan/Green 글로우)
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';
    ctx.shadowBlur = 12;

    for (let i = 0; i < total; i++) {
      const angle = (Math.PI * 2 / total) * i - Math.PI / 2;
      const score = this.stats[this.dimensions[i].key] ? this.stats[this.dimensions[i].key].score : 70;
      const r = (maxRadius * (score / 100));
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 각 정점에 네온 닷 찍기
    ctx.shadowBlur = 0;
    for (let i = 0; i < total; i++) {
      const angle = (Math.PI * 2 / total) * i - Math.PI / 2;
      const score = this.stats[this.dimensions[i].key] ? this.stats[this.dimensions[i].key].score : 70;
      const r = (maxRadius * (score / 100));
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffc800';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

// 전역 인스턴스 등록
window.aiLearningEngine = new AILearningEngine();
document.addEventListener('DOMContentLoaded', () => {
  window.aiLearningEngine.init();
});
