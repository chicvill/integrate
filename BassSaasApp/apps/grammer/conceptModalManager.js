// ========================================================
// ConceptModalManager - 문법 개념 치트시트 모달 관리 전용 모듈
// 학년별 핵심 공식, 규칙, 단골 함정, 대표 예문 팝업 렌더링 및 키보드/리모컨 포커스를 제어합니다.
// ========================================================

class ConceptModalManager {
  constructor() {
    this.overlay = document.getElementById('conceptModalOverlay');
    this.closeBtn = document.getElementById('conceptCloseBtn');
    this.okBtn = document.getElementById('conceptOkBtn');
    this.gradeBadge = document.getElementById('conceptGradeBadge');
    this.title = document.getElementById('conceptTitle');
    this.formula = document.getElementById('conceptFormula');
    this.usage = document.getElementById('conceptUsage');
    this.rulesList = document.getElementById('conceptRulesList');
    this.trapWrong = document.getElementById('conceptTrapWrong');
    this.trapCorrect = document.getElementById('conceptTrapCorrect');
    this.examplesList = document.getElementById('conceptExamplesList');

    this.isOpen = false;
    this.bindEvents();
  }

  bindEvents() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }
    if (this.okBtn) {
      this.okBtn.addEventListener('click', () => this.close());
    }
    if (this.overlay) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });
    }
  }

  // 모달 열기 및 문제 데이터 기반 치트시트 동적 렌더링
  open(question) {
    const q = question || (window.gameApp ? window.gameApp.currentQuestion : null);
    if (!q) return;

    if (!window.grammarConceptData || !window.grammarConceptData.getConceptForQuestion) {
      console.warn('grammarConceptData가 아직 로드되지 않았습니다.');
      return;
    }

    const data = window.grammarConceptData.getConceptForQuestion(q);
    if (!data) return;

    if (this.gradeBadge) {
      this.gradeBadge.textContent = data.gradeBadge || '문법 핵심';
    }
    if (this.title) {
      this.title.textContent = data.title;
    }
    if (this.formula) {
      this.formula.textContent = data.formula;
    }
    if (this.usage) {
      this.usage.textContent = data.usage;
    }

    // 핵심 규칙 목록
    if (this.rulesList) {
      this.rulesList.innerHTML = '';
      if (Array.isArray(data.rules)) {
        data.rules.forEach(rule => {
          const li = document.createElement('li');
          li.textContent = rule;
          this.rulesList.appendChild(li);
        });
      }
    }

    // 단골 시험 함정 주의보
    if (data.trap) {
      if (this.trapWrong) this.trapWrong.textContent = data.trap.wrong || '';
      if (this.trapCorrect) this.trapCorrect.textContent = data.trap.correct || '';
    }

    // 대표 예문 목록
    if (this.examplesList) {
      this.examplesList.innerHTML = '';
      if (Array.isArray(data.examples)) {
        data.examples.forEach(ex => {
          const li = document.createElement('li');
          li.textContent = ex;
          this.examplesList.appendChild(li);
        });
      }
    }

    if (this.overlay) {
      this.overlay.style.display = 'flex';
    }
    this.isOpen = true;

    if (window.soundFx) {
      window.soundFx.playCardFocus();
    }

    // 모달 확인 버튼으로 포커스 이동 (리모컨 OK로 바로 닫을 수 있도록)
    setTimeout(() => {
      if (this.okBtn) {
        this.okBtn.focus();
      }
    }, 60);
  }

  // 모달 닫기 및 이전 게임 화면으로 포커스 복귀
  close() {
    if (!this.overlay) return;
    this.overlay.style.display = 'none';
    this.isOpen = false;

    if (window.soundFx) {
      window.soundFx.playButtonPress();
    }

    // 문제 화면으로 포커스 복귀
    if (window.gameApp) {
      if (window.gameApp.gameState === 'quiz' && window.gameApp.currentQuestion) {
        const q = window.gameApp.currentQuestion;
        if (q.type === 'choice') {
          const idx = window.gameApp.selectedOptionIndex >= 0 ? window.gameApp.selectedOptionIndex : (window.gameApp.focusedOption >= 0 ? window.gameApp.focusedOption : 0);
          window.gameApp.setOptionFocus(idx);
        } else if (q.type === 'scramble') {
          if (window.scrambleManager) window.scrambleManager.focusCurrentBlock();
        }
      }
    }
  }
}

window.ConceptModalManager = ConceptModalManager;
