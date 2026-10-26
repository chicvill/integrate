// 중1 기초 영문법 TV 퀘스트 - 선택형 + 무보기 말하기 + 듣기 평가 통합 엔진
class GrammarQuestGame {
  constructor() {
    this.TOTAL_QUESTIONS = 10;
    this.QUESTION_TIME = 22; // 기본 문제당 22초 (말하기/듣기 고려)
    this.currentQuestionTime = this.QUESTION_TIME;

    this.questions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.correctCount = 0;
    this.timeLeft = this.QUESTION_TIME;
    this.timer = null;

    this.focusedOption = 0;
    this.isAnswered = false;
    this.gameState = 'ready'; // 'ready', 'quiz', 'review', 'finished'

    // 학습자 AI 실시간 적응형 레벨 (1 ~ 6, 기본: 2 기초)
    const savedLevel = localStorage.getItem('GRAMMAR_ADAPTIVE_LEVEL') || localStorage.getItem('GRAMMAR_CURRENT_GRADE');
    this.currentLevel = window.grammarGenerator.normalizeLevel(savedLevel || 2);
    this.consecutiveCorrect = 0;
    this.consecutiveWrong = 0;

    // 학습 상태 영구 보관 (localStorage - 무로그인 브라우저 영구 보존)
    this.totalSolvedCount = parseInt(localStorage.getItem('GRAMMAR_TOTAL_SOLVED') || '0', 10);
    this.wrongQuestions = this.loadStorageArray('GRAMMAR_WRONG_QUESTIONS'); // 틀린 문제 객체 목록

    // DOM 요소
    this.gradeTabs = document.querySelectorAll('.grade-tab');
    this.qNumText = document.getElementById('qNumText');
    this.masteredProgressText = document.getElementById('masteredProgressText');
    this.scoreText = document.getElementById('scoreText');
    this.streakText = document.getElementById('streakText');
    this.timerBar = document.getElementById('timerBar');
    this.timerNumber = document.getElementById('timerNumber');
    
    this.categoryTag = document.getElementById('categoryTag');
    this.targetSentence = document.getElementById('targetSentence');
    this.sentenceTranslation = document.getElementById('sentenceTranslation');
    this.heroQuestionShowcase = document.getElementById('heroQuestionShowcase');
    
    // 선택형 2x2 그리드
    this.optionsGrid = document.getElementById('optionsGrid');
    this.optionCards = [
      document.getElementById('opt-0'),
      document.getElementById('opt-1'),
      document.getElementById('opt-2'),
      document.getElementById('opt-3')
    ];
    this.optionTexts = [
      document.getElementById('optText-0'),
      document.getElementById('optText-1'),
      document.getElementById('optText-2'),
      document.getElementById('optText-3')
    ];

    // 주관식 말하기 & 듣기 패널
    this.speechStageWrap = document.getElementById('speechStageWrap');
    this.audioListenBtn = document.getElementById('audioListenBtn');
    this.audioBtnCaption = document.getElementById('audioBtnCaption');
    this.speakingHintBox = document.getElementById('speakingHintBox');
    this.speechInstruction = document.getElementById('speechInstruction');
    this.speechLiveHeard = document.getElementById('speechLiveHeard');

    // 1. 단어 어순 배열 (Scramble) DOM
    this.scrambleStageWrap = document.getElementById('scrambleStageWrap');
    this.scrambleResetBtn = document.getElementById('scrambleResetBtn');
    this.scrambleSubmitBtn = document.getElementById('scrambleSubmitBtn');

    // 2. 2인 가족 대전 모드 DOM 및 상태
    this.modeToggleBtn = document.getElementById('modeToggleBtn');
    this.modeToggleText = document.getElementById('modeToggleText');
    this.battleScoreboard = document.getElementById('battleScoreboard');
    this.p1ScoreEl = document.getElementById('p1Score');
    this.p2ScoreEl = document.getElementById('p2Score');
    this.p1Tag = document.getElementById('p1Tag');
    this.p2Tag = document.getElementById('p2Tag');
    this.isBattleMode = false;
    this.p1Score = 0;
    this.currentTurnPlayer = 1;

    // 전체화면 토글 컨트롤러 (PC / 모바일)
    this.uiScaleBtn = document.getElementById('uiScaleBtn');
    this.uiScaleText = document.getElementById('uiScaleText');
    if (this.uiScaleText) {
      this.uiScaleText.textContent = '전체화면';
    }

    // 3. 문장 전체 섀도잉 & 발음 평가 전용 매니저 모듈
    this.shadowingManager = new ShadowingManager();

    // 4. 문법 개념 치트시트 모달 전용 매니저 모듈
    this.conceptGuideBtn = document.getElementById('conceptGuideBtn');
    this.conceptModalManager = new ConceptModalManager();

    // 5. 조작 및 사용법 도움말 모달 전용 매니저 모듈
    this.helpModalManager = new HelpModalManager();

    this.explanationBox = document.getElementById('explanationBox');
    this.expResultBadge = document.getElementById('expResultBadge');
    this.expContent = document.getElementById('expContent');

    // 햄버거 메뉴 및 좌측 슬라이드 드로어 DOM
    this.currentGradeBadge = document.getElementById('currentGradeBadge');
    this.hamburgerBtn = document.getElementById('hamburgerBtn');
    this.drawerOverlay = document.getElementById('drawerOverlay');
    this.drawerCloseBtn = document.getElementById('drawerCloseBtn');
    this.drawerMicToggleBtn = document.getElementById('drawerMicToggleBtn');
    this.drawerMicBtnText = document.getElementById('drawerMicBtnText');
    this.drawerMicStatusText = document.getElementById('drawerMicStatusText');
    this.drawerBattleStatusText = document.getElementById('drawerBattleStatusText');
    this.helpBtn = document.getElementById('helpBtn');

    // 모바일 뷰포트 전환 탭 & 메인 듀얼 뷰포트
    this.mobileViewportTabs = document.getElementById('mobileViewportTabs');
    this.mTabSolve = document.getElementById('mTabSolve');
    this.mTabExplain = document.getElementById('mTabExplain');
    this.mExplainBadge = document.getElementById('mExplainBadge');
    this.questDualViewport = document.getElementById('questDualViewport');
    this.panelSolve = document.getElementById('panelSolve');
    this.panelExplain = document.getElementById('panelExplain');
    this.explainPlaceholder = document.getElementById('explainPlaceholder');

    // 하단 전후 문제 이동 네비게이션
    this.prevQuestionBtn = document.getElementById('prevQuestionBtn');
    this.nextQuestionBtn = document.getElementById('nextQuestionBtn');
    this.nextBtnLabel = document.getElementById('nextBtnLabel');
    this.navQuestionTrack = document.getElementById('navQuestionTrack');

    this.gameOverlay = document.getElementById('gameOverlay');
    this.overlayIcon = document.getElementById('overlayIcon');
    this.overlayTitle = document.getElementById('overlayTitle');
    this.overlayDesc = document.getElementById('overlayDesc');
    this.startBtn = document.getElementById('startBtn');
    this.startBtnText = document.getElementById('startBtnText');
    this.micToggleBtn = document.getElementById('micToggleBtn');

    // 음성 인식기 초기화
    this.voiceCommander = new VoiceCommander(this.handleVoiceAction.bind(this));

    this.setupDrawer();
    this.setupMobileTabs();
    this.setupNavigation();
    this.updateProgressHUD();
    this.updateGradeTabsUI();
    this.updateGradeBadge();
    this.bindEvents();
    
    setTimeout(() => {
      this.startBtn.focus();
    }, 150);
  }

  get gradeName() {
    const cfg = window.grammarGenerator.getLevelConfig(this.currentLevel);
    return `AI 적응형: ${cfg.badge}`;
  }

  // AI 적응형 레벨 변경 메소드
  setLevel(level) {
    this.currentLevel = window.grammarGenerator.normalizeLevel(level);
    this.consecutiveCorrect = 0;
    this.consecutiveWrong = 0;
    localStorage.setItem('GRAMMAR_ADAPTIVE_LEVEL', this.currentLevel.toString());
    this.updateGradeTabsUI();
    this.updateGradeBadge();
    this.toggleDrawer(false);
    if (window.soundFx) window.soundFx.playCorrect();
    this.startNewGame();
  }

  setGrade(gradeOrLevel) {
    this.setLevel(gradeOrLevel);
  }

  updateGradeBadge() {
    if (this.currentGradeBadge) {
      this.currentGradeBadge.textContent = this.gradeName;
    }
  }

  // AI 실시간 적응형 레벨 평가 및 승급/조절 처리
  processAdaptiveResult(isCorrect) {
    if (isCorrect) {
      this.consecutiveCorrect++;
      this.consecutiveWrong = 0;

      // 2연속 정답 달성 시 상위 레벨로 자동 승급 판정!
      if (this.consecutiveCorrect >= 2 && this.currentLevel < 6) {
        const oldLvl = this.currentLevel;
        this.currentLevel++;
        this.consecutiveCorrect = 0;
        localStorage.setItem('GRAMMAR_ADAPTIVE_LEVEL', this.currentLevel.toString());
        this.updateGradeTabsUI();
        this.updateGradeBadge();
        const nextCfg = window.grammarGenerator.getLevelConfig(this.currentLevel);
        this.showAdaptiveToast(`🚀 AI 수준 상승! ${nextCfg.label} (${nextCfg.title})`);
      }
    } else {
      this.consecutiveWrong++;
      this.consecutiveCorrect = 0;

      // 2연속 오답 시 기초 다지기를 위해 한 단계 쉬운 수준으로 조절!
      if (this.consecutiveWrong >= 2 && this.currentLevel > 1) {
        const oldLvl = this.currentLevel;
        this.currentLevel--;
        this.consecutiveWrong = 0;
        localStorage.setItem('GRAMMAR_ADAPTIVE_LEVEL', this.currentLevel.toString());
        this.updateGradeTabsUI();
        this.updateGradeBadge();
        const prevCfg = window.grammarGenerator.getLevelConfig(this.currentLevel);
        this.showAdaptiveToast(`🛡️ AI 난이도 조절: ${prevCfg.label} (기초 복습 모드)`);
      }
    }
  }

  showAdaptiveToast(message) {
    let toast = document.getElementById('adaptiveToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'adaptiveToast';
      toast.className = 'adaptive-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  setupDrawer() {
    if (this.hamburgerBtn) {
      this.hamburgerBtn.addEventListener('click', () => this.toggleDrawer());
    }
    if (this.drawerCloseBtn) {
      this.drawerCloseBtn.addEventListener('click', () => this.toggleDrawer(false));
    }
    if (this.drawerOverlay) {
      this.drawerOverlay.addEventListener('click', (e) => {
        if (e.target === this.drawerOverlay) {
          this.toggleDrawer(false);
        }
      });
    }
    if (this.drawerMicToggleBtn) {
      this.drawerMicToggleBtn.addEventListener('click', () => {
        this.voiceCommander.toggle();
        this.updateMicUI();
      });
    }
    if (this.helpBtn) {
      this.helpBtn.addEventListener('click', () => {
        this.toggleDrawer(false);
        if (this.helpModalManager) this.helpModalManager.open();
      });
    }
  }

  toggleDrawer(open) {
    if (!this.drawerOverlay) return;
    const shouldOpen = (open !== undefined) ? open : !this.drawerOverlay.classList.contains('active');
    this.drawerOverlay.classList.toggle('active', shouldOpen);
    if (window.soundFx) window.soundFx.playMove();
  }

  updateMicUI() {
    const isListening = this.voiceCommander && this.voiceCommander.isListening;
    if (this.drawerMicStatusText) {
      this.drawerMicStatusText.textContent = isListening ? '마이크 켜짐 🎙️' : '마이크 꺼짐 (V키)';
    }
    if (this.drawerMicBtnText) {
      this.drawerMicBtnText.textContent = isListening ? '마이크 끄기' : '마이크 켜기';
    }
    const voiceStatusText = document.getElementById('voiceStatusText');
    if (voiceStatusText) {
      voiceStatusText.textContent = isListening ? '마이크 ON 🎙️' : '마이크 OFF (V)';
    }
    const voiceStatusCard = document.getElementById('voiceStatusCard');
    if (voiceStatusCard) {
      voiceStatusCard.classList.toggle('listening', isListening);
    }
    const speechMicToggleBtn = document.getElementById('speechMicToggleBtn');
    if (speechMicToggleBtn) {
      speechMicToggleBtn.classList.toggle('active', isListening);
    }
    const speechMicBtnText = document.getElementById('speechMicBtnText');
    if (speechMicBtnText) {
      speechMicBtnText.textContent = isListening ? '🟢 마이크 켜짐 (영어로 답을 말씀하세요)' : '🎙️ 마이크 켜고 음성으로 답하기 (클릭)';
    }
    const speechWaveContainer = document.querySelector('.voice-wave-container');
    if (speechWaveContainer) {
      speechWaveContainer.classList.toggle('active', isListening);
    }
  }

  setupMobileTabs() {
    if (this.mTabSolve) {
      this.mTabSolve.addEventListener('click', () => this.switchMobileTab('solve'));
    }
    if (this.mTabExplain) {
      this.mTabExplain.addEventListener('click', () => this.switchMobileTab('explain'));
    }

    if (this.questDualViewport) {
      this.questDualViewport.addEventListener('scroll', () => {
        const scrollLeft = this.questDualViewport.scrollLeft;
        const width = this.questDualViewport.offsetWidth;
        if (width > 0) {
          const isExplain = scrollLeft > width * 0.45;
          if (this.mTabSolve) this.mTabSolve.classList.toggle('active', !isExplain);
          if (this.mTabExplain) this.mTabExplain.classList.toggle('active', isExplain);
        }
      }, { passive: true });
    }
  }

  switchMobileTab(target) {
    if (!this.questDualViewport) return;
    if (target === 'solve') {
      this.questDualViewport.scrollTo({ left: 0, behavior: 'smooth' });
      if (this.mTabSolve) this.mTabSolve.classList.add('active');
      if (this.mTabExplain) this.mTabExplain.classList.remove('active');
    } else {
      const explainEl = document.getElementById('panelExplain');
      const leftPos = explainEl ? explainEl.offsetLeft : this.questDualViewport.offsetWidth;
      this.questDualViewport.scrollTo({ left: leftPos, behavior: 'smooth' });
      if (this.mTabSolve) this.mTabSolve.classList.remove('active');
      if (this.mTabExplain) this.mTabExplain.classList.add('active');
    }
  }

  setupNavigation() {
    if (this.prevQuestionBtn) {
      this.prevQuestionBtn.addEventListener('click', () => this.prevQuestion());
    }
    if (this.nextQuestionBtn) {
      this.nextQuestionBtn.addEventListener('click', () => this.nextQuestion());
    }
  }

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      if (window.soundFx) window.soundFx.playMove();
      this.loadQuestion();
    }
  }

  jumpToQuestion(idx) {
    if (idx >= 0 && idx < this.questions.length && idx !== this.currentIndex) {
      this.currentIndex = idx;
      if (window.soundFx) window.soundFx.playMove();
      this.loadQuestion();
    }
  }

  renderQuestionTrack() {
    if (!this.navQuestionTrack) return;
    this.navQuestionTrack.innerHTML = '';

    this.questions.forEach((q, idx) => {
      const dot = document.createElement('div');
      dot.className = 'nav-dot';
      if (idx === this.currentIndex) dot.classList.add('active');
      if (q.isAnswered) {
        dot.classList.add(q.isCorrect ? 'correct' : 'wrong');
      }
      dot.textContent = idx + 1;
      dot.title = `${idx + 1}번 문제로 이동`;
      dot.addEventListener('click', () => this.jumpToQuestion(idx));
      this.navQuestionTrack.appendChild(dot);
    });

    if (this.prevQuestionBtn) {
      this.prevQuestionBtn.disabled = (this.currentIndex === 0);
    }
    if (this.nextQuestionBtn) {
      const isLast = (this.currentIndex === this.questions.length - 1);
      const isCurrentAnswered = this.currentQuestion && this.currentQuestion.isAnswered;
      if (this.nextBtnLabel) {
        this.nextBtnLabel.textContent = (isLast && isCurrentAnswered) ? '결과 리포트' : '다음 문제';
      }
    }
  }

  updateGradeTabsUI() {
    if (!this.gradeTabs) return;
    this.gradeTabs.forEach(tab => {
      const tabLvl = window.grammarGenerator.normalizeLevel(tab.dataset.grade);
      tab.classList.toggle('active', tabLvl === this.currentLevel);
    });
  }

  loadStorageArray(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveStorageArray(key, arr) {
    try {
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {}
  }

  updateProgressHUD() {
    if (this.masteredProgressText) {
      this.masteredProgressText.textContent = `${this.totalSolvedCount}개 완료`;
    }
  }

  get currentQuestion() {
    return this.questions[this.currentIndex];
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      // 1. input, textarea 등 텍스트 입력 필드에 포커스가 있을 때는 전역 게임 단축키(M, V, C, F, 방향키, 스페이스 등) 무시!
      const targetTag = e.target && e.target.tagName;
      const isInputFocused = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || (e.target && e.target.isContentEditable);

      if (isInputFocused) {
        // ESC 키일 때만 입력창 포커스 해제 허용, 그 외의 모든 타이핑은 그대로 통과!
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      const key = e.key;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(key)) {
        e.preventDefault();
      }

      // Tab 키 누를 때 브라우저 기본 포커스 충돌 방지 및 게임 내 이동 연결
      if (key === 'Tab') {
        if (this.gameState === 'quiz') {
          const q = this.currentQuestion;
          if (q.type === 'choice') {
            if (e.shiftKey) this.navigateOptions('left');
            else this.navigateOptions('right');
          } else if (q.type === 'scramble') {
            if (window.scrambleManager) {
              if (e.shiftKey) window.scrambleManager.navigate('left');
              else window.scrambleManager.navigate('right');
            }
          }
        }
        return;
      }

      // PC/키보드 단축키 V: 마이크 켜기/끄기 음성 제어 토글
      if (key === 'v' || key === 'V') {
        e.preventDefault();
        if (this.voiceCommander && this.voiceCommander.isSupported) {
          this.voiceCommander.toggle();
          if (this.voiceCommander.isListening) {
            window.soundFx.playCombo();
          }
        }
        return;
      }

      // 단축키 M: 설정 & 학년 선택 사이드 드로어 메뉴 토글
      if (key === 'm' || key === 'M') {
        e.preventDefault();
        this.toggleDrawer();
        return;
      }

      // 단축키 C 또는 F1: 핵심 문법 개념 카드 열기 / 닫기
      if (key === 'c' || key === 'C' || key === 'F1') {
        e.preventDefault();
        if (this.conceptModalManager && this.conceptModalManager.isOpen) {
          this.conceptModalManager.close();
        } else {
          this.conceptModalManager.open(this.currentQuestion);
        }
        return;
      }

      // 단축키 F: 전체화면 토글
      if (key === 'f' || key === 'F') {
        e.preventDefault();
        this.toggleFullscreen();
        return;
      }

      // 이전 / 다음 문제 이동 단축키 (Alt+Left / Alt+Right)
      if (e.altKey && key === 'ArrowLeft') {
        e.preventDefault();
        this.prevQuestion();
        return;
      }
      if (e.altKey && key === 'ArrowRight') {
        e.preventDefault();
        this.nextQuestion();
        return;
      }

      // 드로어 또는 모달이 열려있을 때 ESC로 닫기
      if (key === 'Escape') {
        if (this.drawerOverlay && this.drawerOverlay.classList.contains('active')) {
          e.preventDefault();
          this.toggleDrawer(false);
          return;
        }
        if (this.helpModalManager && this.helpModalManager.isOpen) {
          e.preventDefault();
          this.helpModalManager.close();
          return;
        }
        if (this.conceptModalManager && this.conceptModalManager.isOpen) {
          e.preventDefault();
          this.conceptModalManager.close();
          return;
        }
      }

      if (this.gameState === 'ready' || this.gameState === 'finished') {
        if (key === 'Enter' || key === ' ') {
          this.startNewGame();
        }
        return;
      }

      if (this.gameState === 'quiz') {
        // 단축키 H: 조작 및 사용법 도움말 모달 열기
        if (['h', 'H'].includes(key)) {
          if (this.helpModalManager) this.helpModalManager.open();
          return;
        }

        // 단축키 C 또는 M: 문법 개념 카드 열기
        if (['c', 'C', 'm', 'M'].includes(key)) {
          if (this.conceptModalManager) this.conceptModalManager.open(this.currentQuestion);
          return;
        }

        const q = this.currentQuestion;

        // 선택형 문제인 경우
        if (q.type === 'choice') {
          switch (key) {
            case 'ArrowUp': this.navigateOptions('up'); break;
            case 'ArrowDown': this.navigateOptions('down'); break;
            case 'ArrowLeft': this.navigateOptions('left'); break;
            case 'ArrowRight': this.navigateOptions('right'); break;
            case '1': this.selectOption(0); break;
            case '2': this.selectOption(1); break;
            case '3': this.selectOption(2); break;
            case '4': this.selectOption(3); break;
            case 'Enter':
            case ' ':
              this.confirmSelection();
              break;
          }
        } else if (q.type === 'scramble') {
          // 어순 배열 문제일 때 방향키로 단어 이동 & OK로 스왑
          switch (key) {
            case 'ArrowLeft':
              if (window.scrambleManager) window.scrambleManager.navigate('left');
              break;
            case 'ArrowRight':
              if (window.scrambleManager) window.scrambleManager.navigate('right');
              break;
            case 'ArrowDown':
              if (window.scrambleManager) window.scrambleManager.navigate('down');
              break;
            case 'Enter':
            case ' ':
              if (window.scrambleManager) window.scrambleManager.handleOk();
              break;
          }
        } else if (q.type === 'listening') {
          if (key === 'Enter' || key === ' ') {
            this.playListeningAudio();
          }
        }
      } else if (this.gameState === 'review') {
        const sm = this.shadowingManager;
        const active = document.activeElement;
        if (sm && active === sm.playUserVoiceBtn && (key === 'Enter' || key === ' ')) {
          sm.playUserVoice();
          return;
        }
        if (sm && active === sm.playNativeCompareBtn && (key === 'Enter' || key === ' ')) {
          sm.playNativeCompare();
          return;
        }
        if (sm && active === sm.recordBtn && (key === 'Enter' || key === ' ')) {
          sm.startRecording();
          return;
        }
        if (sm && active === sm.listenBtn && (key === 'Enter' || key === ' ')) {
          this.playListeningAudio();
          return;
        }

        // 방향키로 섀도잉 컨트롤 간 이동 지원
        if (key === 'ArrowLeft') {
          if (sm && active === sm.playNativeCompareBtn && sm.playUserVoiceBtn) sm.playUserVoiceBtn.focus();
          else if (sm && active === sm.recordBtn && sm.listenBtn) sm.listenBtn.focus();
          return;
        }
        if (key === 'ArrowRight') {
          if (sm && active === sm.playUserVoiceBtn && sm.playNativeCompareBtn) sm.playNativeCompareBtn.focus();
          else if (sm && active === sm.listenBtn && sm.recordBtn) sm.recordBtn.focus();
          else {
            this.nextQuestion();
          }
          return;
        }

        if (['Enter', 'ArrowDown', ' '].includes(key)) {
          this.triggerDpadVisual(this.btnOk);
          this.nextQuestion();
        }
      }
    });

    if (this.btnUp) this.btnUp.addEventListener('click', () => this.handleDpadClick('up'));
    if (this.btnDown) this.btnDown.addEventListener('click', () => this.handleDpadClick('down'));
    if (this.btnLeft) this.btnLeft.addEventListener('click', () => this.handleDpadClick('left'));
    if (this.btnRight) this.btnRight.addEventListener('click', () => this.handleDpadClick('right'));
    if (this.btnOk) this.btnOk.addEventListener('click', () => this.confirmSelection());

    // 2인 가족 대전 토글
    if (this.modeToggleBtn) {
      this.modeToggleBtn.addEventListener('click', () => this.toggleBattleMode());
    }

    // 단어 어순 배열 버튼 이벤트
    if (this.scrambleResetBtn) {
      this.scrambleResetBtn.addEventListener('click', () => {
        if (window.scrambleManager) window.scrambleManager.resetShuffle();
      });
    }
    if (this.scrambleSubmitBtn) {
      this.scrambleSubmitBtn.addEventListener('click', () => {
        if (window.scrambleManager) window.scrambleManager.submitAnswer();
      });
    }

    // 4. 핵심 문법 개념 치트시트 모달 열기 버튼 이벤트
    if (this.conceptGuideBtn) {
      this.conceptGuideBtn.addEventListener('click', () => this.openConceptModal());
    }

    this.audioListenBtn.addEventListener('click', () => {
      this.playListeningAudio();
    });

    this.optionCards.forEach((card, idx) => {
      card.addEventListener('click', () => {
        if (this.gameState === 'quiz' && !this.isAnswered && this.currentQuestion.type === 'choice') {
          this.setOptionFocus(idx);
          this.selectOption(idx);
        }
      });
    });

    // 학년 탭 클릭 이벤트
    this.gradeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.setGrade(tab.dataset.grade);
      });
    });

    this.startBtn.addEventListener('click', () => this.startNewGame());
    this.micToggleBtn.addEventListener('click', () => {
      this.voiceCommander.toggle();
      window.soundFx.init();
    });

    // 주관식 말하기 스테이지 전용 마이크 토글 버튼
    const speechMicToggleBtn = document.getElementById('speechMicToggleBtn');
    if (speechMicToggleBtn) {
      speechMicToggleBtn.addEventListener('click', () => {
        if (this.voiceCommander) {
          this.voiceCommander.toggle();
        }
        if (window.soundFx) window.soundFx.init();
      });
    }

    // 주관식 키보드 수동 입력 폼
    this.speechTextInput = document.getElementById('speechTextInput');
    this.speechTextSubmitBtn = document.getElementById('speechTextSubmitBtn');
    if (this.speechTextSubmitBtn) {
      this.speechTextSubmitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.submitTextAnswer();
      });
    }
    if (this.speechTextInput) {
      this.speechTextInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.submitTextAnswer();
        }
      });
    }

    if (this.uiScaleBtn) {
      this.uiScaleBtn.addEventListener('click', () => this.toggleFullscreen());
    }
  }

  // 전체화면 토글 (PC / 스마트폰)
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(err => {
          console.log('Fullscreen failed:', err);
        });
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
    if (window.soundFx) window.soundFx.playMove();
  }

  // 음성 액션 수신 처리 (직접 영어 발음 & 명령어)
  handleVoiceAction(action) {
    console.log('[Voice Action Handled]:', action);
    window.soundFx.init();

    // 학년 변경 음성 명령
    if (action.type === 'changeGrade') {
      this.setGrade(action.grade);
      return;
    }

    // 조작 및 사용법 도움말 음성 명령 ("도움말", "사용법", "조작법", "help")
    if (action.type === 'help') {
      if (this.helpModalManager) this.helpModalManager.open();
      return;
    }

    // 문법 개념 / 설명 보기 음성 명령 ("설명", "문법", "개념", "공식", "힌트")
    if (action.type === 'concept') {
      this.openConceptModal();
      return;
    }

    // 모달이 열려있을 때 닫기 음성 명령 ("확인", "다음", "선택", "닫기")
    if (this.helpModalManager && this.helpModalManager.isOpen) {
      if (action.type === 'confirm' || action.type === 'next' || action.type === 'closeModal') {
        this.helpModalManager.close();
        return;
      }
    }
    if (this.conceptModalManager && this.conceptModalManager.isOpen) {
      if (action.type === 'confirm' || action.type === 'next' || action.type === 'closeModal') {
        this.closeConceptModal();
        return;
      }
    }

    // 내 목소리 다시 듣기 & 원어민 발음 비교 음성 명령
    if (action.type === 'replayUserVoice') {
      if (this.shadowingManager) this.shadowingManager.playUserRecordedVoice();
      return;
    }
    if (action.type === 'playNativeCompare') {
      if (this.shadowingManager) this.shadowingManager.playNativeComparisonVoice();
      return;
    }

    if (this.gameState === 'ready' || this.gameState === 'finished') {
      if (action.type === 'start' || action.type === 'restart' || action.type === 'confirm') {
        this.startNewGame();
      }
      return;
    }

    if (this.gameState === 'quiz') {
      // 1. 주관식 영어 단어 발음 입력 (스피킹/리스닝 문제)
      if (action.type === 'spokenDirectAnswer') {
        this.submitSpokenAnswer(action.spokenWord, action.isCorrect);
        return;
      }

      // 2. 문장 전체 섀도잉 발음 입력 (섀도잉 퀘스트)
      if (action.type === 'spokenShadowingAnswer') {
        this.submitShadowingAnswer(action.spokenSentence, action.similarity, action.isCorrect);
        return;
      }

      // 3. 리스닝/섀도잉 다시 듣기 요청
      if (action.type === 'replayAudio') {
        this.playListeningAudio();
        return;
      }

      // 3. 선택형 문제 보기 선택 (영어 발음 또는 번호)
      if (action.type === 'selectOption') {
        if (this.currentQuestion.type === 'choice') {
          this.setOptionFocus(action.index);
          this.selectOption(action.index);
        }
        return;
      }

      if (action.type === 'nav') {
        if (this.currentQuestion.type === 'choice') {
          this.navigateOptions(action.dir);
        } else if (this.currentQuestion.type === 'scramble') {
          if (window.scrambleManager) window.scrambleManager.navigate(action.dir);
        }
        return;
      }

      if (action.type === 'confirm') {
        this.confirmSelection();
      }
    } else if (this.gameState === 'review') {
      if (action.type === 'next' || action.type === 'confirm') {
        this.nextQuestion();
      }
    }
  }

  navigateOptions(dir) {
    let nextIdx = this.focusedOption;

    if (dir === 'up') {
      if (this.focusedOption === 2) nextIdx = 0;
      else if (this.focusedOption === 3) nextIdx = 1;
      else if (this.focusedOption === 0 || this.focusedOption === 1) nextIdx = -1; // 1번/2번에서 위(▲)로 누르면 상단 [📖 핵심 문법 개념] 버튼으로 이동!
    } else if (dir === 'down') {
      if (this.focusedOption === -1) {
        if (this.currentQuestion && this.currentQuestion.type === 'scramble') {
          this.setOptionFocus(null);
          if (window.scrambleManager) window.scrambleManager.focusCurrentBlock();
          return;
        }
        nextIdx = 0; // 선택형일 때 1번 보기로 복귀!
      }
      else if (this.focusedOption === 0) nextIdx = 2;
      else if (this.focusedOption === 1) nextIdx = 3;
    } else if (dir === 'left') {
      if (this.focusedOption === 1) nextIdx = 0;
      else if (this.focusedOption === 3) nextIdx = 2;
    } else if (dir === 'right') {
      if (this.focusedOption === 0) nextIdx = 1;
      else if (this.focusedOption === 2) nextIdx = 3;
    }

    if (nextIdx !== this.focusedOption) {
      window.soundFx.playMove();
      this.setOptionFocus(nextIdx);
    }
  }

  setOptionFocus(idx) {
    this.focusedOption = idx;
    this.optionCards.forEach((card, i) => {
      card.classList.toggle('focused', i === idx);
    });
    if (this.shortcutChips && Array.isArray(this.shortcutChips)) {
      this.shortcutChips.forEach((chip, i) => {
        if (chip) chip.classList.toggle('active', i === idx);
      });
    }

    // 상단 [📖 핵심 문법 개념] 버튼 포커스 스타일 동기화
    if (this.conceptGuideBtn) {
      this.conceptGuideBtn.classList.toggle('focused', idx === -1);
      if (idx === -1) {
        this.conceptGuideBtn.focus();
      }
    }
  }

  confirmSelection() {
    if (this.isConceptModalOpen) {
      this.closeConceptModal();
      return;
    }

    if (this.gameState === 'quiz' && !this.isAnswered) {
      // 상단 [📖 핵심 문법 개념] 버튼에 포커스된 상태에서 리모컨 OK 누르면 모달 열기!
      if (this.focusedOption === -1) {
        this.openConceptModal();
        return;
      }

      if (this.currentQuestion.type === 'choice') {
        this.selectOption(this.focusedOption);
      } else if (this.currentQuestion.type === 'scramble') {
        if (window.scrambleManager) window.scrambleManager.handleOk();
      } else if (this.currentQuestion.type === 'listening' || this.currentQuestion.type === 'shadowing') {
        this.playListeningAudio();
      }
    } else if (this.gameState === 'review') {
      this.nextQuestion();
    }
  }

  // 무한 자동 생성기(grammarGenerator)를 통한 10문제 생성 (AI 적응형 CAT 난이도 반영)
  buildQuestionSet() {
    let set = [];
    if (window.grammarGenerator) {
      set = window.grammarGenerator.generateSet(this.TOTAL_QUESTIONS, this.wrongQuestions, this.currentLevel);
    }
    set.forEach(q => {
      q.isAnswered = false;
      q.userAnswer = null;
      q.isCorrect = null;
      q.feedbackText = '';
      q.spokenSentence = null;
      q.similarity = null;
    });
    return set;
  }

  startNewGame() {
    this.score = 0;
    this.streak = 0;
    this.correctCount = 0;
    this.currentIndex = 0;
    this.p1Score = 0;
    this.p2Score = 0;
    this.currentTurnPlayer = 1;
    this.updateBattleHUD();

    // 실시간 무한 조합 문제 세트 생성
    this.questions = this.buildQuestionSet();
    this.gameOverlay.classList.remove('active');
    window.soundFx.playCorrect();

    this.updateProgressHUD();
    this.loadQuestion();
  }

  // 문제 화면 로드 (신규 풀이 or 이전/다음 탐색 시 기존 상태 복원)
  // 문장 길이 및 퀘스트 유형에 따라 지능형 타이머 시간 산출
  getQuestionTime(q) {
    if (!q) return this.QUESTION_TIME;

    if (q.type === 'scramble') {
      const fullText = q.audioText || q.full || (q.sentence ? q.sentence.replace('_____', q.answerWord || '') : '');
      const words = fullText.trim().split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      // 단어 어순 배열: 문장 길이에 비례한 지능형 연장
      // 기본 20초 + 단어당 4.5초 추가 (최소 32초 ~ 최대 90초)
      // 예: 4단어: 약 38초, 6단어: 약 47초, 8단어: 약 56초, 10단어: 약 65초, 12단어: 약 74초, 14단어: 약 83초
      const allocatedTime = 20 + Math.round(wordCount * 4.5);
      return Math.min(90, Math.max(32, allocatedTime));
    }

    if (q.type === 'shadowing') {
      return 28; // 문장 전체 따라 말하기도 넉넉하게 28초
    }

    return this.QUESTION_TIME; // 일반 선택형/주관식 22초
  }

  loadQuestion() {
    const q = this.currentQuestion;
    if (!q) return;

    const isWrongReview = this.wrongQuestions.some(wq => wq.sentence === q.sentence);

    this.qNumText.textContent = `${this.currentIndex + 1} / ${this.questions.length}`;
    this.scoreText.textContent = this.score;
    this.streakText.textContent = `${this.streak} 🔥`;
    this.updateProgressHUD();
    this.updateBattleHUD();

    if (isWrongReview) {
      this.categoryTag.innerHTML = `${q.category} <span style="color: var(--accent-red); font-size: 13px; margin-left: 8px;">[오답 복습 🔄]</span>`;
    } else {
      this.categoryTag.textContent = q.category;
    }

    // 퀘스트 유형별 헤더 뱃지 업데이트
    const typeBadges = {
      'choice': '🎯 4지선다 선택형 퀘스트',
      'scramble': '🧩 단어 어순 배열 퀘스트',
      'speaking': '🎙️ 무보기 직접 말하기 퀘스트',
      'listening': '🔊 원어민 듣기 평가 퀘스트',
      'shadowing': '🎧 문장 전체 섀도잉 퀘스트'
    };
    const focusBadge = document.querySelector('.q-focus-badge');
    if (focusBadge) {
      focusBadge.textContent = typeBadges[q.type] || 'TARGET SENTENCE';
    }

    // 문장 렌더링: 문제 풀이 중에는 Be동사 등 핵심 문법 단어를 무조건 [ ? ] 빈칸으로 감추어 질문 대상 명확화!
    const displaySentence = q.displaySentence || q.sentence;
    if (q.isAnswered) {
      // 이미 푼 문제의 경우 완성된 문장을 표시
      const fullSentence = q.audioText || q.full || q.sentence.replace('_____', q.answerWord || '');
      this.targetSentence.innerHTML = `<span class="shadowing-active-sentence" style="color: var(--accent-cyan); font-weight: bold; text-shadow: 0 0 16px rgba(0,240,255,0.4);">${fullSentence}</span>`;
    } else {
      // 미완료 문제 풀이 중에는 반드시 [ ? ] 빈칸 박스로 감춤
      const blankHtml = displaySentence.replace('_____', `<span class="blank-box" id="activeBlank">[ ? ]</span>`);
      this.targetSentence.innerHTML = blankHtml;
    }
    this.sentenceTranslation.textContent = `"${q.translation}"`;

    if (this.shadowingManager) {
      this.shadowingManager.resetUI();
    }

    // === 1. 이미 풀었던 문제 탐색 시: 정답/해설 복원 모드 ===
    if (q.isAnswered) {
      this.isAnswered = true;
      this.gameState = 'review';
      if (this.timer) clearInterval(this.timer);

      // 해설 패널 활성화 & 플레이스홀더 숨김
      if (this.explainPlaceholder) this.explainPlaceholder.style.display = 'none';
      if (this.explanationBox) this.explanationBox.classList.add('active');

      this.expResultBadge.className = q.isCorrect ? 'exp-badge correct' : 'exp-badge wrong';
      this.expResultBadge.textContent = q.feedbackText || (q.isCorrect ? '정답! ✅' : '오답 🔄');
      this.expContent.textContent = q.explanation;

      // 유형별 UI 복원
      if (q.type === 'choice') {
        if (this.heroQuestionShowcase) this.heroQuestionShowcase.style.display = 'flex';
        this.optionsGrid.style.display = 'grid';
        this.speechStageWrap.style.display = 'none';
        if (this.scrambleStageWrap) this.scrambleStageWrap.style.display = 'none';

        q.options.forEach((optText, i) => {
          this.optionTexts[i].textContent = optText;
          let cls = 'option-card focusable';
          if (i === q.answer) cls += ' correct-choice';
          else if (i === q.userAnswer && !q.isCorrect) cls += ' wrong-choice';
          this.optionCards[i].className = cls;
        });

        const blank = document.getElementById('activeBlank');
        if (blank) {
          blank.textContent = q.options[q.answer];
          blank.style.color = q.isCorrect ? 'var(--accent-green)' : 'var(--accent-red)';
          blank.style.borderColor = q.isCorrect ? 'var(--accent-green)' : 'var(--accent-red)';
        }
      } else if (q.type === 'scramble') {
        if (this.scrambleStageWrap) this.scrambleStageWrap.style.display = 'none';
        if (this.heroQuestionShowcase) this.heroQuestionShowcase.style.display = 'flex';
        this.optionsGrid.style.display = 'none';
        this.speechStageWrap.style.display = 'none';
        const full = q.audioText || q.full || q.sentence.replace('_____', q.answerWord || '');
        this.targetSentence.innerHTML = `<span style="color: var(--accent-green); text-shadow: 0 0 16px rgba(0,255,136,0.5);">${full}</span>`;
      } else {
        if (this.heroQuestionShowcase) this.heroQuestionShowcase.style.display = 'flex';
        this.optionsGrid.style.display = 'none';
        this.speechStageWrap.style.display = 'flex';
        if (this.scrambleStageWrap) this.scrambleStageWrap.style.display = 'none';
        const blank = document.getElementById('activeBlank');
        if (blank) {
          blank.textContent = q.answerWord || '';
          blank.style.color = 'var(--accent-green)';
        }
        if (q.type === 'shadowing' && q.spokenSentence && window.pronunciationCoach) {
          const clinicPanel = document.getElementById('pronunciationClinicPanel');
          if (clinicPanel) {
            const fullTarget = q.audioText || q.full || q.sentence.replace('_____', q.answerWord || '');
            window.pronunciationCoach.renderClinic(clinicPanel, fullTarget, q.spokenSentence, q.similarity || 85);
          }
        }
      }

      this.renderQuestionTrack();
      return;
    }

    // === 2. 아직 풀지 않은 새 문제 풀이 모드 ===
    this.gameState = 'quiz';
    this.isAnswered = false;
    this.currentQuestionTime = this.getQuestionTime(q);
    this.timeLeft = this.currentQuestionTime;

    if (this.explainPlaceholder) this.explainPlaceholder.style.display = 'flex';
    if (this.explanationBox) this.explanationBox.classList.remove('active');

    // AI 오답/쌍둥이/힌트 카드 초기화
    const aimCard = document.getElementById('aiMisconceptionCard');
    if (aimCard) aimCard.style.display = 'none';
    const twinCard = document.getElementById('aiTwinCard');
    if (twinCard) twinCard.style.display = 'none';
    const socraticBubble = document.getElementById('aiSocraticBubble');
    if (socraticBubble) socraticBubble.style.display = 'none';

    // 모바일 탭을 1. 문제 풀기로 자동 이동
    this.switchMobileTab('solve');

    // 유형별 활성화 세팅
    if (q.type === 'choice') {
      if (this.heroQuestionShowcase) this.heroQuestionShowcase.style.display = 'flex';
      this.optionsGrid.style.display = 'grid';
      this.speechStageWrap.style.display = 'none';
      if (this.scrambleStageWrap) this.scrambleStageWrap.style.display = 'none';

      q.options.forEach((optText, i) => {
        this.optionTexts[i].textContent = optText;
        this.optionCards[i].className = 'option-card focusable';
      });
      this.setOptionFocus(0);

    } else if (q.type === 'scramble') {
      if (this.heroQuestionShowcase) this.heroQuestionShowcase.style.display = 'none';
      this.optionsGrid.style.display = 'none';
      this.speechStageWrap.style.display = 'none';
      if (this.scrambleStageWrap) this.scrambleStageWrap.style.display = 'flex';

      const fullText = q.audioText || q.full || (q.sentence ? q.sentence.replace('_____', q.answerWord || '') : '');
      const wordCount = fullText.trim().split(/\s+/).filter(Boolean).length;
      const scrambleBadge = document.querySelector('.scramble-badge');
      if (scrambleBadge) {
        scrambleBadge.textContent = `🧩 단어 어순 배열 (${wordCount}단어 · ${this.currentQuestionTime}초)`;
      }

      if (window.scrambleManager) {
        window.scrambleManager.initQuestion(q, (isCorrect, assembled) => {
          this.handleScrambleComplete(isCorrect, assembled);
        });
      }

    } else if (q.type === 'speaking') {
      if (this.heroQuestionShowcase) this.heroQuestionShowcase.style.display = 'flex';
      this.optionsGrid.style.display = 'none';
      this.speechStageWrap.style.display = 'flex';
      if (this.scrambleStageWrap) this.scrambleStageWrap.style.display = 'none';
      this.audioListenBtn.style.display = 'none';
      this.speakingHintBox.style.display = 'block';
      this.speakingHintBox.textContent = q.hint || '영어 단어를 직접 마이크에 말하세요!';
      this.speechInstruction.textContent = '🎙️ 보기가 없습니다! 정답 단어를 영어로 직접 발음하세요.';
      
      const speechTextInput = document.getElementById('speechTextInput');
      if (speechTextInput) speechTextInput.value = '';

      // 마이크 상태에 따른 안내 및 자동 켜기 시도
      if (this.voiceCommander) {
        if (!this.voiceCommander.isListening) {
          this.voiceCommander.start();
        }
        if (this.voiceCommander.isListening) {
          this.speechLiveHeard.textContent = '🎙️ 듣고 있습니다... 마이크에 영어로 답을 말씀하세요!';
          this.speechLiveHeard.className = 'speech-live-heard live-listening';
        } else {
          this.speechLiveHeard.textContent = '마이크 버튼을 눌러 음성 인식을 시작하거나, 아래에 직접 입력하세요.';
          this.speechLiveHeard.className = 'speech-live-heard';
        }
      }
      this.updateMicUI();

    } else if (q.type === 'listening') {
      if (this.heroQuestionShowcase) this.heroQuestionShowcase.style.display = 'flex';
      this.optionsGrid.style.display = 'none';
      this.speechStageWrap.style.display = 'flex';
      if (this.scrambleStageWrap) this.scrambleStageWrap.style.display = 'none';
      this.audioListenBtn.style.display = 'flex';
      this.speakingHintBox.style.display = 'none';
      this.speechInstruction.textContent = '🔊 원어민 소리를 듣고 빠진 단어를 영어로 말하세요!';
      
      const speechTextInput = document.getElementById('speechTextInput');
      if (speechTextInput) speechTextInput.value = '';

      if (this.voiceCommander) {
        if (!this.voiceCommander.isListening) {
          this.voiceCommander.start();
        }
        if (this.voiceCommander.isListening) {
          this.speechLiveHeard.textContent = '🎙️ 듣고 있습니다... 마이크에 영어로 답을 말씀하세요!';
          this.speechLiveHeard.className = 'speech-live-heard live-listening';
        } else {
          this.speechLiveHeard.textContent = '마이크 버튼을 눌러 음성 인식을 시작하거나, 아래에 직접 입력하세요.';
          this.speechLiveHeard.className = 'speech-live-heard';
        }
      }
      this.updateMicUI();

      setTimeout(() => {
        this.playListeningAudio();
      }, 300);

    } else if (q.type === 'shadowing') {
      if (this.heroQuestionShowcase) this.heroQuestionShowcase.style.display = 'flex';
      this.optionsGrid.style.display = 'none';
      this.speechStageWrap.style.display = 'flex';
      if (this.scrambleStageWrap) this.scrambleStageWrap.style.display = 'none';
      this.audioListenBtn.style.display = 'flex';
      this.speakingHintBox.style.display = 'block';
      this.speakingHintBox.textContent = `🎧 원어민 발음을 듣고 문장 전체를 따라 읽으세요!`;
      this.speechInstruction.textContent = '🎙️ 원어민 소리를 듣고, 문장 전체를 마이크로 따라 읽어보세요!';
      this.speechLiveHeard.textContent = '원어민 소리를 들은 뒤 문장 전체를 말해보세요...';

      setTimeout(() => {
        this.playListeningAudio();
      }, 300);
    }

    this.renderQuestionTrack();
    this.startTimer();
  }

  // 원어민 영어 TTS 오디오 재생
  playListeningAudio() {
    const q = this.currentQuestion;
    if (!q || !q.audioText) return;

    this.audioListenBtn.classList.add('playing');
    this.audioBtnCaption.textContent = '원어민 발음 재생 중... 🔊';

    window.soundFx.speakEnglish(
      q.audioText,
      null,
      () => {
        this.audioListenBtn.classList.remove('playing');
        this.audioBtnCaption.textContent = '원어민 발음 다시 듣기 (OK / "다시 들려줘")';
      }
    );
  }

  startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.updateTimerUI();

    this.timer = setInterval(() => {
      this.timeLeft -= 1;
      this.updateTimerUI();

      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        this.timeOut();
      }
    }, 1000);
  }

  updateTimerUI() {
    const maxTime = this.currentQuestionTime || this.QUESTION_TIME || 22;
    const percent = Math.max(0, (this.timeLeft / maxTime) * 100);
    this.timerBar.style.width = `${percent}%`;
    this.timerNumber.textContent = `${this.timeLeft}s`;

    const isUrgent = this.timeLeft <= 5 || percent <= 15;
    const isWarning = this.timeLeft <= 10 || percent <= 30;

    if (isUrgent) {
      this.timerBar.style.backgroundColor = 'var(--accent-red)';
    } else if (isWarning) {
      this.timerBar.style.backgroundColor = 'var(--accent-gold)';
    } else {
      this.timerBar.style.backgroundColor = 'var(--accent-cyan)';
    }
  }

  // 키보드 직접 입력 정답 제출 처리 (말하기/듣기/섀도잉/선택형 등 모든 퀘스트 유형 완벽 대응)
  submitTextAnswer() {
    if (!this.speechTextInput) return;
    const text = (this.speechTextInput.value || '').trim();
    if (!text) return;
    if (this.isAnswered || this.gameState !== 'quiz') return;

    const q = this.currentQuestion;
    if (!q) return;

    const target = q.answerWord || q.missingWord || (q.options && q.options[q.answer] !== undefined ? q.options[q.answer] : '');
    let isCorrect = false;

    // 1. VoiceCommander의 matchWord 활용 (음차/영어/유사도)
    if (this.voiceCommander && typeof this.voiceCommander.matchWord === 'function') {
      isCorrect = this.voiceCommander.matchWord(text, target);
    }

    // 2. 직접 텍스트 비교 (소문자, 영숫자/한글 기준)
    const cleanInput = text.toLowerCase().replace(/[^a-zA-Z0-9가-힣]/g, '');
    const cleanTarget = (target || '').toLowerCase().replace(/[^a-zA-Z0-9가-힣]/g, '');
    if (cleanInput && cleanTarget && (cleanInput === cleanTarget || cleanInput.includes(cleanTarget) || (cleanTarget.includes(cleanInput) && cleanInput.length >= 2))) {
      isCorrect = true;
    }

    // 3. acceptableAnswers 목록 대조
    if (q.acceptableAnswers && Array.isArray(q.acceptableAnswers)) {
      for (const ans of q.acceptableAnswers) {
        const cleanAns = String(ans).toLowerCase().replace(/[^a-zA-Z0-9가-힣]/g, '');
        if (cleanInput && cleanAns && (cleanInput === cleanAns || cleanInput.includes(cleanAns))) {
          isCorrect = true;
          break;
        }
      }
    }

    // 4. 문장 전체 입력 대조 (섀도잉 또는 문장 단위 입력)
    const fullTarget = (q.audioText || q.full || (q.sentence ? q.sentence.replace('_____', target) : '')).toLowerCase().replace(/[^a-zA-Z0-9가-힣]/g, '');
    if (fullTarget && (cleanInput === fullTarget || cleanInput.includes(cleanTarget))) {
      isCorrect = true;
    }

    // 5. 4지선다형 번호(1, 2, 3, 4) 또는 보기 단어 입력
    if (q.type === 'choice' && q.options) {
      const numIdx = parseInt(text, 10) - 1;
      if (numIdx >= 0 && numIdx < q.options.length) {
        this.setOptionFocus(numIdx);
        this.selectOption(numIdx);
        this.speechTextInput.blur();
        return;
      }
      for (let i = 0; i < q.options.length; i++) {
        const optClean = q.options[i].toLowerCase().replace(/[^a-zA-Z0-9가-힣]/g, '');
        if (cleanInput === optClean) {
          this.setOptionFocus(i);
          this.selectOption(i);
          this.speechTextInput.blur();
          return;
        }
      }
    }

    // 6. 섀도잉 문제인 경우
    if (q.type === 'shadowing') {
      this.speechTextInput.blur();
      this.submitShadowingAnswer(text, isCorrect ? 95 : 40, isCorrect);
      return;
    }

    // 7. 주관식 말하기, 듣기 및 일반 제출
    this.speechTextInput.blur();
    this.submitSpokenAnswer(text, isCorrect);
  }

  // 주관식 말하기/듣기 단어 발음 제출 처리
  submitSpokenAnswer(spokenWord, isCorrect) {
    if (this.isAnswered || this.gameState !== 'quiz') return;
    this.isAnswered = true;
    this.gameState = 'review';
    if (this.timer) clearInterval(this.timer);

    const q = this.currentQuestion;
    if (q) {
      q.isAnswered = true;
      q.userAnswer = spokenWord;
      q.isCorrect = isCorrect;
    }
    this.processAdaptiveResult(isCorrect);
    const target = q.answerWord || q.missingWord || (q.options ? q.options[q.answer] : '');
    const blank = document.getElementById('activeBlank');

    if (this.speechLiveHeard) {
      this.speechLiveHeard.textContent = `인식된 발음: "${spokenWord}"`;
    }

    if (isCorrect) {
      this.correctCount++;
      this.streak++;
      this.totalSolvedCount++;
      // 오답 목록에서 해결된 문제 제거
      this.wrongQuestions = this.wrongQuestions.filter(wq => wq.sentence !== q.sentence);
      this.saveStorageArray('GRAMMAR_WRONG_QUESTIONS', this.wrongQuestions);
      localStorage.setItem('GRAMMAR_TOTAL_SOLVED', this.totalSolvedCount.toString());
      this.updateProgressHUD();

      const timeBonus = this.timeLeft * 5;
      const streakBonus = Math.max(0, (this.streak - 1) * 30);
      const earned = 120 + timeBonus + streakBonus;
      this.addScore(earned);

      if (blank) {
        blank.textContent = target;
        blank.style.color = 'var(--accent-green)';
        blank.style.borderColor = 'var(--accent-green)';
        blank.style.boxShadow = '0 0 20px var(--accent-green)';
      }

      if (this.streak >= 3) {
        window.soundFx.playCombo();
      } else {
        window.soundFx.playCorrect();
      }

      this.expResultBadge.className = 'exp-badge correct';
      const playerText = this.isBattleMode ? `[${this.currentTurnPlayer}P] ` : '';
      this.expResultBadge.textContent = `${playerText}정답 발음 성공! 🎙️ (+${earned}점)`;
    } else {
      this.streak = 0;
      if (!this.wrongQuestions.some(wq => wq.sentence === q.sentence)) {
        this.wrongQuestions.push(q);
      }
      this.saveStorageArray('GRAMMAR_WRONG_QUESTIONS', this.wrongQuestions);
      this.updateProgressHUD();

      if (blank) {
        blank.textContent = target;
        blank.style.color = 'var(--accent-red)';
        blank.style.borderColor = 'var(--accent-red)';
      }

      window.soundFx.playWrong();
      this.expResultBadge.className = 'exp-badge wrong';
      const playerText = this.isBattleMode ? `[${this.currentTurnPlayer}P] ` : '';
      this.expResultBadge.textContent = `${playerText}오답! (정답: "${target}") 다음 판에 다시 도전 🔄`;
    }

    this.scoreText.textContent = this.score;
    this.streakText.textContent = `${this.streak} 🔥`;
    this.expContent.textContent = q.explanation;
    this.explanationBox.classList.add('active');

    // 정답 확인 시 완성 문장 전체를 원어민 음성으로 자동 읽어줌!
    this.speakCorrectSentence(400);
  }

  // 선택형 문제에서 보기 번호/클릭 선택
  selectOption(chosenIndex) {
    if (this.isAnswered || this.gameState !== 'quiz') return;
    this.isAnswered = true;
    this.gameState = 'review';
    if (this.timer) clearInterval(this.timer);

    const q = this.currentQuestion;
    const isCorrect = chosenIndex === q.answer;
    if (q) {
      q.isAnswered = true;
      q.userAnswer = chosenIndex;
      q.isCorrect = isCorrect;
    }
    this.processAdaptiveResult(isCorrect);
    if (window.aiLearningEngine) {
      window.aiLearningEngine.onAnswerEvaluated(q, isCorrect, q.options ? q.options[chosenIndex] : chosenIndex);
    }
    const blank = document.getElementById('activeBlank');

    if (isCorrect) {
      this.correctCount++;
      this.streak++;
      this.totalSolvedCount++;
      this.wrongQuestions = this.wrongQuestions.filter(wq => wq.sentence !== q.sentence);
      this.saveStorageArray('GRAMMAR_WRONG_QUESTIONS', this.wrongQuestions);
      localStorage.setItem('GRAMMAR_TOTAL_SOLVED', this.totalSolvedCount.toString());
      this.updateProgressHUD();
      
      const timeBonus = this.timeLeft * 5;
      const streakBonus = Math.max(0, (this.streak - 1) * 30);
      const earned = 100 + timeBonus + streakBonus;
      this.addScore(earned);

      this.optionCards[chosenIndex].classList.add('correct-choice');
      if (blank) {
        blank.textContent = q.options[chosenIndex];
        blank.style.color = 'var(--accent-green)';
        blank.style.borderColor = 'var(--accent-green)';
        blank.style.boxShadow = '0 0 20px var(--accent-green)';
      }

      if (this.streak >= 3) {
        window.soundFx.playCombo();
      } else {
        window.soundFx.playCorrect();
      }

      this.expResultBadge.className = 'exp-badge correct';
      const playerText = this.isBattleMode ? `[${this.currentTurnPlayer}P] ` : '';
      this.expResultBadge.textContent = `${playerText}정답! ✅ (+${earned}점)`;
    } else {
      this.streak = 0;
      if (!this.wrongQuestions.some(wq => wq.sentence === q.sentence)) {
        this.wrongQuestions.push(q);
      }
      this.saveStorageArray('GRAMMAR_WRONG_QUESTIONS', this.wrongQuestions);
      this.updateProgressHUD();

      this.optionCards[chosenIndex].classList.add('wrong-choice');
      this.optionCards[q.answer].classList.add('correct-choice');

      if (blank) {
        blank.textContent = q.options[q.answer];
        blank.style.color = 'var(--accent-red)';
        blank.style.borderColor = 'var(--accent-red)';
      }

      window.soundFx.playWrong();
      this.expResultBadge.className = 'exp-badge wrong';
      const playerText = this.isBattleMode ? `[${this.currentTurnPlayer}P] ` : '';
      this.expResultBadge.textContent = `${playerText}오답! 다음 판에 다시 출제됩니다 🔄`;
    }

    this.scoreText.textContent = this.score;
    this.streakText.textContent = `${this.streak} 🔥`;
    this.expContent.textContent = q.explanation;
    this.enterReviewMode();

    // 정답 확인 시 완성 문장 전체를 원어민 음성으로 자동 읽어줌!
    this.speakCorrectSentence(400);
  }

  // 1. 단어 어순 배열 (Sentence Scramble) 완성 결과 처리
  handleScrambleComplete(isCorrect, assembled) {
    if (this.isAnswered || this.gameState !== 'quiz') return;
    this.isAnswered = true;
    this.gameState = 'review';
    if (this.timer) clearInterval(this.timer);

    const q = this.currentQuestion;
    if (q) {
      q.isAnswered = true;
      q.userAnswer = assembled;
      q.isCorrect = isCorrect;
    }
    this.processAdaptiveResult(isCorrect);
    if (window.aiLearningEngine) {
      window.aiLearningEngine.onAnswerEvaluated(q, isCorrect, text);
    }
    const blank = document.getElementById('activeBlank');

    if (isCorrect) {
      this.correctCount++;
      this.streak++;
      this.totalSolvedCount++;
      this.wrongQuestions = this.wrongQuestions.filter(wq => wq.sentence !== q.sentence);
      this.saveStorageArray('GRAMMAR_WRONG_QUESTIONS', this.wrongQuestions);
      localStorage.setItem('GRAMMAR_TOTAL_SOLVED', this.totalSolvedCount.toString());
      this.updateProgressHUD();

      const maxTime = this.currentQuestionTime || 30;
      const timeBonus = Math.min(150, Math.round((this.timeLeft / maxTime) * 80));
      const streakBonus = Math.max(0, (this.streak - 1) * 30);
      const earned = 150 + timeBonus + streakBonus;
      this.addScore(earned);

      if (blank) {
        blank.textContent = q.answerWord || '완성';
        blank.style.color = 'var(--accent-green)';
        blank.style.borderColor = 'var(--accent-green)';
        blank.style.boxShadow = '0 0 20px var(--accent-green)';
      }

      window.soundFx.playCorrect();
      this.expResultBadge.className = 'exp-badge correct';
      const playerText = this.isBattleMode ? `[${this.currentTurnPlayer}P] ` : '';
      this.expResultBadge.textContent = `${playerText}어순 완성 대성공! 🧩 (+${earned}점)`;

    } else {
      this.streak = 0;
      if (!this.wrongQuestions.some(wq => wq.sentence === q.sentence)) {
        this.wrongQuestions.push(q);
      }
      this.saveStorageArray('GRAMMAR_WRONG_QUESTIONS', this.wrongQuestions);
      this.updateProgressHUD();

      window.soundFx.playWrong();
      this.expResultBadge.className = 'exp-badge wrong';
      const playerText = this.isBattleMode ? `[${this.currentTurnPlayer}P] ` : '';
      this.expResultBadge.textContent = `${playerText}순서가 틀렸습니다! 🔄 올바른 문장을 확인해보세요.`;
    }

    this.scoreText.textContent = this.score;
    this.streakText.textContent = `${this.streak} 🔥`;
    this.expContent.textContent = q.explanation;
    this.enterReviewMode();

    // 정답 확인 시 완성 문장 전체를 원어민 음성으로 자동 읽어줌!
    this.speakCorrectSentence(400);
  }

  // 5. 문장 전체 섀도잉 (Shadowing) 평가 결과 처리
  submitShadowingAnswer(spokenSentence, similarity, isCorrect) {
    if (this.isAnswered || this.gameState !== 'quiz') return;
    this.isAnswered = true;
    this.gameState = 'review';
    if (this.timer) clearInterval(this.timer);

    const q = this.currentQuestion;
    if (q) {
      q.isAnswered = true;
      q.userAnswer = spokenSentence;
      q.spokenSentence = spokenSentence;
      q.similarity = similarity;
      q.isCorrect = isCorrect;
    }
    if (this.speechLiveHeard) {
      this.speechLiveHeard.textContent = `인식된 발음: "${spokenSentence}" (정확도 ${similarity}점)`;
    }

    if (isCorrect) {
      this.correctCount++;
      this.streak++;
      this.totalSolvedCount++;
      this.wrongQuestions = this.wrongQuestions.filter(wq => wq.sentence !== q.sentence);
      this.saveStorageArray('GRAMMAR_WRONG_QUESTIONS', this.wrongQuestions);
      localStorage.setItem('GRAMMAR_TOTAL_SOLVED', this.totalSolvedCount.toString());
      this.updateProgressHUD();

      const timeBonus = this.timeLeft * 5;
      const streakBonus = Math.max(0, (this.streak - 1) * 30);
      const earned = 140 + timeBonus + streakBonus;
      this.addScore(earned);

      window.soundFx.playCorrect();
      this.expResultBadge.className = 'exp-badge correct';
      const playerText = this.isBattleMode ? `[${this.currentTurnPlayer}P] ` : '';
      this.expResultBadge.textContent = `${playerText}문장 섀도잉 성공! 🎙️ (+${earned}점 / 발음 ${similarity}점)`;
    } else {
      this.streak = 0;
      if (!this.wrongQuestions.some(wq => wq.sentence === q.sentence)) {
        this.wrongQuestions.push(q);
      }
      this.saveStorageArray('GRAMMAR_WRONG_QUESTIONS', this.wrongQuestions);
      this.updateProgressHUD();

      window.soundFx.playWrong();
      this.expResultBadge.className = 'exp-badge wrong';
      const playerText = this.isBattleMode ? `[${this.currentTurnPlayer}P] ` : '';
      this.expResultBadge.textContent = `${playerText}발음 정확도 부족 (${similarity}점) 🔄 올바른 문장을 확인해보세요.`;
    }

    this.scoreText.textContent = this.score;
    this.streakText.textContent = `${this.streak} 🔥`;
    this.expContent.textContent = q.explanation;

    // AI 원어민 발음 정밀 클리닉 & 교정 코칭 패널 렌더링
    const clinicPanel = document.getElementById('pronunciationClinicPanel');
    if (clinicPanel && window.pronunciationCoach) {
      const fullTarget = q.audioText || q.full || q.sentence.replace('_____', q.answerWord || '');
      window.pronunciationCoach.renderClinic(clinicPanel, fullTarget, spokenSentence, similarity);
      const shadowBox = document.getElementById('shadowResultBox');
      if (shadowBox) {
        shadowBox.style.display = 'flex';
        const heardElem = document.getElementById('shadowHeardText');
        if (heardElem) heardElem.textContent = `"${spokenSentence}"`;
        const scoreElem = document.getElementById('shadowScoreNumber');
        if (scoreElem) scoreElem.textContent = `발음 정확도: ${similarity}점`;
      }
    }

    this.enterReviewMode();
    this.speakCorrectSentence(400);
  }

  // 정답/오답/시간초과 시 해설 모드 진입 (요소 겹침 방지)
  enterReviewMode() {
    this.gameState = 'review';
    if (this.timer) clearInterval(this.timer);

    const q = this.currentQuestion;
    if (q) {
      q.isAnswered = true;
      q.feedbackText = this.expResultBadge.textContent;
    }

    // 어순 배열 문제의 경우, 해설이 뜰 때 복잡한 단어 트랙을 숨기고
    // 상단 문장 보드에 완성된 정답 문장을 깔끔하게 보여주어 해설 상자와 절대 겹치지 않게 함!
    if (q && q.type === 'scramble') {
      if (this.scrambleStageWrap) this.scrambleStageWrap.style.display = 'none';
      if (this.heroQuestionShowcase) this.heroQuestionShowcase.style.display = 'flex';
      const full = q.audioText || q.full || q.sentence.replace('_____', q.answerWord || '');
      this.targetSentence.innerHTML = `<span style="color: var(--accent-green); text-shadow: 0 0 16px rgba(0,255,136,0.5);">${full}</span>`;
      if (q.translation) this.sentenceTranslation.textContent = `"${q.translation}"`;
    }

    if (this.explainPlaceholder) this.explainPlaceholder.style.display = 'none';
    this.explanationBox.classList.add('active');

    this.renderQuestionTrack();

    // 스마트폰/태블릿(960px 이하)에서는 문제 풀이 후 해설 탭으로 자동 이동
    if (window.innerWidth <= 960) {
      setTimeout(() => {
        this.switchMobileTab('explain');
      }, 350);
    }
  }

  // 2. 점수 가산 & 2인 배틀 모드 스코어 관리
  addScore(earned) {
    this.score += earned;
    if (this.isBattleMode) {
      if (this.currentTurnPlayer === 1) {
        this.p1Score += earned;
      } else {
        this.p2Score += earned;
      }
      this.updateBattleHUD();
    }
  }

  updateBattleHUD() {
    if (!this.battleScoreboard) return;
    this.p1ScoreEl.textContent = this.p1Score;
    this.p2ScoreEl.textContent = this.p2Score;
    if (this.isBattleMode) {
      this.p1Tag.classList.toggle('active-turn', this.currentTurnPlayer === 1);
      this.p2Tag.classList.toggle('active-turn', this.currentTurnPlayer === 2);
    }
  }

  toggleBattleMode() {
    this.isBattleMode = !this.isBattleMode;
    this.modeToggleText.textContent = this.isBattleMode ? '2인 대전 ON ⚔️' : '1인 솔로';
    this.battleScoreboard.style.display = this.isBattleMode ? 'flex' : 'none';
    window.soundFx.playCorrect();
    this.startNewGame();
  }

  // 3. 문장 전체 섀도잉 & 발음 평가 (ShadowingManager 위임)
  startShadowRecording() {
    if (this.shadowingManager) this.shadowingManager.startShadowRecording();
  }

  stopShadowRecording(score = null, heard = '') {
    if (this.shadowingManager) this.shadowingManager.stopShadowRecording(score, heard);
  }

  playUserRecordedVoice() {
    if (this.shadowingManager) this.shadowingManager.playUserRecordedVoice();
  }

  playNativeComparisonVoice() {
    if (this.shadowingManager) this.shadowingManager.playNativeComparisonVoice();
  }

  timeOut() {
    if (this.isAnswered) return;
    this.isAnswered = true;
    this.gameState = 'review';
    this.streak = 0;
    this.streakText.textContent = '0 🔥';

    const q = this.currentQuestion;
    if (q) {
      q.isAnswered = true;
      q.isCorrect = false;
    }
    this.processAdaptiveResult(false);
    if (!this.wrongQuestions.some(wq => wq.sentence === q.sentence)) {
      this.wrongQuestions.push(q);
    }
    this.saveStorageArray('GRAMMAR_WRONG_QUESTIONS', this.wrongQuestions);
    this.updateProgressHUD();

    window.soundFx.playWrong();

    if (q.type === 'choice' && this.optionCards[q.answer]) {
      this.optionCards[q.answer].classList.add('correct-choice');
    }

    const blank = document.getElementById('activeBlank');
    const target = q.answerWord || q.missingWord || (q.options ? q.options[q.answer] : '');
    if (blank) {
      blank.textContent = target;
      blank.style.color = 'var(--accent-green)';
      blank.style.borderBottomColor = 'var(--accent-green)';
    }

    this.expResultBadge.className = 'exp-badge wrong';
    this.expResultBadge.textContent = '시간 초과! ⏰ (다음 판에 다시 복습합니다)';
    this.expContent.textContent = q.explanation;
    this.enterReviewMode();

    // 시간 초과 시에도 정답 문장을 원어민 음성으로 읽어주어 귀로 기억하게 함!
    this.speakCorrectSentence(400);
  }

  // ========================================================
  // 핵심 문법 개념 카드 (Grammar Cheat Sheet) 모달 제어 (ConceptModalManager 위임)
  // ========================================================
  get isConceptModalOpen() {
    return this.conceptModalManager ? this.conceptModalManager.isOpen : false;
  }

  openConceptModal(question) {
    if (this.conceptModalManager) {
      this.conceptModalManager.open(question || this.currentQuestion);
    }
  }

  closeConceptModal() {
    if (this.conceptModalManager) {
      this.conceptModalManager.close();
    }
  }

  // ========================================================
  // 정답 확인 시 완성된 영어 문장 전체를 또렷하게 읽어주는 메소드
  // ========================================================
  speakCorrectSentence(delay = 400) {
    const q = this.currentQuestion;
    if (!q) return;

    // 문장의 정답 완성형 텍스트 도출
    let fullText = q.audioText || q.full;
    if (!fullText) {
      const ans = q.answerWord || (q.options ? q.options[q.answer] : '');
      fullText = q.sentence.replace('_____', ans);
    }

    // 마침표나 물음표 등 구두점 정돈
    fullText = fullText.trim();
    if (!fullText.endsWith('.') && !fullText.endsWith('?') && !fullText.endsWith('!')) {
      fullText += '.';
    }

    // 효과음(딩동댕/버저)과 겹치지 않게 약간의 지연 후 낭독!
    setTimeout(() => {
      if (window.soundFx) {
        window.soundFx.speakEnglish(
          fullText,
          () => {
            // 낭독 시작 시 문장에 부드러운 네온 하이라이트 점등
            const targetEl = document.getElementById('targetSentence');
            if (targetEl) targetEl.classList.add('tts-reading');
          },
          () => {
            // 낭독 종료 시 하이라이트 해제
            const targetEl = document.getElementById('targetSentence');
            if (targetEl) targetEl.classList.remove('tts-reading');
          }
        );
      }
    }, delay);
  }

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      if (this.isBattleMode) {
        // 턴 교체
        this.currentTurnPlayer = this.currentTurnPlayer === 1 ? 2 : 1;
        this.updateBattleHUD();
      }
      if (window.soundFx) window.soundFx.playMove();
      this.loadQuestion();
    } else {
      if (this.currentQuestion && this.currentQuestion.isAnswered) {
        this.showFinalReport();
      }
    }
  }

  showFinalReport() {
    this.gameState = 'finished';
    if (this.timer) clearInterval(this.timer);

    window.soundFx.playVictory();

    const percent = Math.round((this.correctCount / this.questions.length) * 100);
    const wrongCount = this.wrongQuestions.length;

    let grade = 'A+';
    let icon = '🏆';

    if (this.isBattleMode) {
      const winner = this.p1Score > this.p2Score ? '1P (BLUE)' : (this.p2Score > this.p1Score ? '2P (RED)' : '공동 무승부');
      icon = '⚔️';
      this.overlayIcon.textContent = icon;
      this.overlayTitle.textContent = `2인 대전 종료: ${winner} 승리!`;
      this.overlayDesc.innerHTML = `
        <div style="font-size: 22px; margin-bottom: 12px;">
          <span style="color: var(--accent-cyan); font-weight: 900;">1P: ${this.p1Score}점</span> VS 
          <span style="color: #ff3366; font-weight: 900;">2P: ${this.p2Score}점</span>
        </div>
        온 가족과 함께 총 <strong>${this.questions.length}</strong>문제를 멋지게 완료했습니다!<br>
        누적 해결한 영문법 문제: <strong style="color: var(--accent-cyan); font-size: 20px;">총 ${this.totalSolvedCount}개</strong>
      `;
    } else {
      if (percent >= 90) {
        grade = 'MASTER (A+)';
        icon = '👑';
      } else if (percent >= 70) {
        grade = 'EXCELLENT (A)';
        icon = '🌟';
      } else if (percent >= 50) {
        grade = 'GOOD (B)';
        icon = '👍';
      } else {
        grade = 'TRY AGAIN (C)';
        icon = '💪';
      }

      this.overlayIcon.textContent = icon;
      this.overlayTitle.textContent = `무한 퀘스트 완료: ${grade}`;
      this.overlayDesc.innerHTML = `
        이번 라운드: <strong>${this.questions.length}</strong>문제 중 <strong>${this.correctCount}</strong>문제 정답! (${percent}%)<br>
        누적 해결한 영문법 문제: <strong style="color: var(--accent-cyan); font-size: 20px;">총 ${this.totalSolvedCount}개</strong><br>
        <span style="color: var(--accent-red); font-size: 14px;">
          ${wrongCount > 0 ? `⚠️ 틀린 문제 ${wrongCount}개는 다음 게임에 최우선 다시 출제됩니다.` : '🎉 현재 누적된 오답이 없습니다!'}
        </span><br>
        획득 점수: <span style="color: var(--accent-gold); font-size: 24px; font-weight: 800;">${this.score}점</span>
        <div style="margin-top: 14px;">
          <button type="button" class="concept-guide-btn" id="overlayRadarBtn" style="margin: 0 auto; padding: 7px 18px; font-size: 13.5px; border-radius: 20px;">
            <span>📊 나의 실시간 문법 뇌 지도 & 처방전 확인</span>
          </button>
        </div>
      `;

      setTimeout(() => {
        const radarBtn = document.getElementById('overlayRadarBtn');
        if (radarBtn && window.aiLearningEngine) {
          radarBtn.addEventListener('click', () => window.aiLearningEngine.knowledgeGraph.showModal());
        }
      }, 50);
    }

    this.startBtnText.textContent = '새로운 문장 생성 & 도전 (OK / "시작")';
    this.gameOverlay.classList.add('active');
    this.startBtn.focus();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new GrammarQuestGame();
});
