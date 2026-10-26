// ========================================================
// HelpModalManager - 게임 조작 및 사용법 도움말 모달 전용 모듈
// 상단 [도움말] 버튼, 단축키(H), 음성 명령("도움말")을 통해 팝업을 제어합니다.
// ========================================================

class HelpModalManager {
  constructor() {
    this.overlay = document.getElementById('helpModalOverlay');
    this.openBtn = document.getElementById('helpBtn');
    this.closeBtn = document.getElementById('helpCloseBtn');
    this.okBtn = document.getElementById('helpOkBtn');

    this.isOpen = false;
    this.bindEvents();
  }

  bindEvents() {
    if (this.openBtn) {
      this.openBtn.addEventListener('click', () => this.open());
    }
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

    // 전역 ESC 및 H 단축키 지원
    window.addEventListener('keydown', (e) => {
      if (this.isOpen) {
        if (e.key === 'Escape' || e.key === 'Back' || e.code === 'Escape') {
          e.preventDefault();
          this.close();
        } else if (e.key === 'Enter' || e.code === 'Enter') {
          e.preventDefault();
          this.close();
        }
      } else {
        if (e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
          // 입력 폼이나 모달이 아닐 때 H키로 도움말 열기
          this.open();
        }
      }
    });
  }

  open() {
    if (!this.overlay) return;
    this.overlay.style.display = 'flex';
    this.isOpen = true;

    if (window.soundFx) {
      window.soundFx.playCardFocus();
    }

    setTimeout(() => {
      if (this.okBtn) {
        this.okBtn.focus();
      }
    }, 60);
  }

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

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}

window.HelpModalManager = HelpModalManager;
