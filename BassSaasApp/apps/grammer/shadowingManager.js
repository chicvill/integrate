// ========================================================
// ShadowingManager - 문장 전체 섀도잉 및 발음 정확도 평가 전용 모듈
// MediaRecorder 오디오 캡처, Web Speech API 음성 대조, 원어민 발음 비교를 독립적으로 관리합니다.
// ========================================================

class ShadowingManager {
  constructor() {
    this.panel = document.getElementById('shadowingPanel');
    this.listenBtn = document.getElementById('shadowListenBtn');
    this.recordBtn = document.getElementById('shadowRecordBtn');
    this.resultBox = document.getElementById('shadowResultBox');
    this.scoreStars = document.getElementById('shadowScoreStars');
    this.scoreNumber = document.getElementById('shadowScoreNumber');
    this.heardText = document.getElementById('shadowHeardText');
    this.playUserVoiceBtn = document.getElementById('playUserVoiceBtn');
    this.playNativeCompareBtn = document.getElementById('playNativeCompareBtn');
    this.playUserVoiceText = document.getElementById('playUserVoiceText');

    this.isRecording = false;
    this.currentUserAudioUrl = null;
    this.currentUserAudio = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.shadowStream = null;
    this.shadowRecognizer = null;
    this.accumulatedHeard = '';
    this.currentTargetFull = '';
    this.maxRecordTimeout = null;
    this.wasVoiceCommanderActive = false;
    this.silenceTimeout = null;
    this.hasSpoken = false;

    this.bindEvents();
  }

  bindEvents() {
    if (this.listenBtn) {
      this.listenBtn.addEventListener('click', () => {
        if (window.gameApp) window.gameApp.playListeningAudio();
      });
    }

    if (this.recordBtn) {
      this.recordBtn.addEventListener('click', () => {
        if (this.isRecording) {
          this.stopRecording();
        } else {
          this.startRecording();
        }
      });
    }

    if (this.playUserVoiceBtn) {
      this.playUserVoiceBtn.addEventListener('click', () => this.playUserVoice());
    }

    if (this.playNativeCompareBtn) {
      this.playNativeCompareBtn.addEventListener('click', () => this.playNativeCompare());
    }
  }

  // Aliases for seamless backward compatibility
  startShadowRecording(targetText) {
    return this.startRecording(targetText);
  }

  stopShadowRecording(score, heard) {
    return this.stopRecording(score, heard);
  }

  playUserRecordedVoice() {
    return this.playUserVoice();
  }

  playNativeComparisonVoice(targetText) {
    return this.playNativeCompare(targetText);
  }

  // 새 문제 로드 시 이전 녹음 및 오디오 메모리 해제
  resetUI() {
    this.cleanupAudio();
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    if (this.maxRecordTimeout) {
      clearTimeout(this.maxRecordTimeout);
      this.maxRecordTimeout = null;
    }
    this.hasSpoken = false;
    this.isRecording = false;
    if (this.shadowRecognizer) {
      this.shadowRecognizer.onend = null;
      try { this.shadowRecognizer.stop(); } catch (e) {}
      this.shadowRecognizer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch (e) {}
    }
    if (this.shadowStream) {
      try { this.shadowStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      this.shadowStream = null;
    }
    this.accumulatedHeard = '';
    if (this.resultBox) {
      this.resultBox.style.display = 'none';
    }
    if (this.recordBtn) {
      this.recordBtn.classList.remove('recording');
      this.recordBtn.innerHTML = '<span>🎙️ 따라 말하기 시작</span>';
    }
    if (this.playUserVoiceBtn) {
      this.playUserVoiceBtn.classList.remove('playing', 'ready');
    }
    if (this.playUserVoiceText) {
      this.playUserVoiceText.textContent = '내 목소리 다시 듣기';
    }
    const clinicPanel = document.getElementById('pronunciationClinicPanel');
    if (clinicPanel) {
      clinicPanel.style.display = 'none';
      clinicPanel.innerHTML = '';
    }
    const pcContainer = document.getElementById('aiPitchContourContainer');
    if (pcContainer) pcContainer.innerHTML = '';
  }

  // 섀도잉 녹음 시작 (마이크 스트림 & 음성인식 병행)
  async startRecording(targetText) {
    if (this.isRecording) return;

    let target = targetText;
    if (!target && window.gameApp && window.gameApp.currentQuestion) {
      const q = window.gameApp.currentQuestion;
      target = (q.audioText || q.full || q.sentence.replace('_____', q.answerWord || ''));
    }
    this.currentTargetFull = (target || '').replace(/[.?!,;:]/g, '').trim().toLowerCase();

    // VoiceCommander가 마이크를 잡고 있다면 섀도잉 녹음 중에는 일시 정지 (마이크 충돌 방지)
    this.wasVoiceCommanderActive = false;
    if (window.gameApp && window.gameApp.voiceCommander && window.gameApp.voiceCommander.isListening) {
      this.wasVoiceCommanderActive = true;
      window.gameApp.voiceCommander.stop();
    }

    this.isRecording = true;
    this.audioChunks = [];
    this.accumulatedHeard = '';
    this.hasSpoken = false;
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }

    if (this.recordBtn) {
      this.recordBtn.classList.add('recording');
      this.recordBtn.innerHTML = '<span>🎙️ 녹음 중... (다 읽으면 자동 완료)</span>';
    }

    if (this.resultBox) {
      this.resultBox.style.display = 'flex';
      if (this.scoreStars) this.scoreStars.textContent = '🔴 REC (녹음 중)';
      if (this.scoreNumber) this.scoreNumber.textContent = '음성 인식 대기 중... (다 읽으면 자동 완료)';
      if (this.heardText) this.heardText.textContent = '마이크에 문장 전체를 편안하게 읽으세요...';
    }

    // 최대 30초 안전 타이머 (사용자가 완료 버튼을 누르지 않아도 무한 대기 방지)
    if (this.maxRecordTimeout) clearTimeout(this.maxRecordTimeout);
    this.maxRecordTimeout = setTimeout(() => {
      if (this.isRecording) {
        this.stopRecording();
      }
    }, 30000);

    // 1. MediaRecorder 오디오 스트림 녹음 (사용자 본인 목소리 녹음)
    this._mediaRecordingAvailable = false;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.shadowStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // iOS Safari: audio/mp4, Android Chrome: audio/webm;codecs=opus, Firefox: audio/ogg
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
              ? 'audio/ogg;codecs=opus'
              : '';

        // mimeType과 stream을 클로저로 미리 캡처 (onstop 비동기 실행 시 참조 손실 방지)
        const capturedMimeType = mimeType || 'audio/webm';
        const capturedStream = this.shadowStream;

        this.mediaRecorder = mimeType
          ? new MediaRecorder(this.shadowStream, { mimeType })
          : new MediaRecorder(this.shadowStream);

        this._mediaRecordingAvailable = true;

        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            this.audioChunks.push(e.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          // ⚠️ 스트림 트랙 해제는 onstop 안에서 (모바일: stop() 직후 트랙 해제 시 ondataavailable 미발화 버그 방지)
          try {
            if (capturedStream) capturedStream.getTracks().forEach(t => t.stop());
          } catch (e) {}
          if (this.shadowStream === capturedStream) this.shadowStream = null;

          if (this.audioChunks.length > 0) {
            if (this.currentUserAudioUrl) URL.revokeObjectURL(this.currentUserAudioUrl);
            const blob = new Blob(this.audioChunks, { type: capturedMimeType });
            this.currentUserAudioUrl = URL.createObjectURL(blob);
            // ✅ URL이 실제로 생성된 후에만 ready 표시 (250ms setTimeout 제거의 대안)
            if (this.playUserVoiceBtn) {
              this.playUserVoiceBtn.classList.add('ready');
              this.playUserVoiceBtn.focus();
            }
            if (this.playUserVoiceText) {
              this.playUserVoiceText.textContent = '내 목소리 다시 듣기 ▶';
            }
          } else {
            // 청크가 비어있으면 녹음 실패로 처리
            this._mediaRecordingAvailable = false;
            if (this.playUserVoiceBtn) this.playUserVoiceBtn.classList.remove('ready');
          }
          this.mediaRecorder = null;
        };

        this.mediaRecorder.start(100);
      }
    } catch (err) {
      console.warn('MediaRecorder 녹음 스트림 접근 불가:', err);
      this._mediaRecordingAvailable = false;
    }

    // 2. Web Speech API 음성 인식기 시작 (영어 실시간 텍스트 누적 추출)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        this.shadowRecognizer = new SpeechRecognition();
        this.shadowRecognizer.lang = 'en-US';
        this.shadowRecognizer.continuous = true;       // 문장 도중 1~2초 침묵 시 끊김 방지
        this.shadowRecognizer.interimResults = true;    // 실시간 인식 누적
        this.shadowRecognizer.maxAlternatives = 3;

        // 사용자가 문장을 다 읽은 후 침묵 감지 시 자동 완료 타이머
        const triggerAutoCompleteTimer = (customDelay = null) => {
          if (!this.isRecording || !this.hasSpoken) return;

          const targetWords = (this.currentTargetFull || '').split(/\s+/).filter(Boolean);
          const heardWords = (this.accumulatedHeard || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);

          let delay = 1500;
          if (customDelay !== null) {
            delay = customDelay;
          } else if (targetWords.length > 0) {
            const similarity = this.calculateSimilarity(this.accumulatedHeard.toLowerCase(), this.currentTargetFull);
            if (similarity >= 65 || heardWords.length >= Math.max(1, targetWords.length - 1)) {
              // 거의 다 읽었거나 전체 문장과 높은 일치도 -> 800ms 후 즉시 자동 완료
              delay = 800;
            } else if (heardWords.length >= Math.ceil(targetWords.length * 0.5)) {
              // 문장의 절반 이상 읽음 -> 1200ms
              delay = 1200;
            } else {
              // 문장 초반 발화 -> 1800ms
              delay = 1800;
            }
          }

          if (this.silenceTimeout) clearTimeout(this.silenceTimeout);
          this.silenceTimeout = setTimeout(() => {
            if (this.isRecording) {
              if (this.scoreNumber) this.scoreNumber.textContent = '인식 완료! 채점 중... ✨';
              if (this.recordBtn) this.recordBtn.innerHTML = '<span>✨ 분석 및 완료 중...</span>';
              this.stopRecording();
            }
          }, delay);
        };

        this.shadowRecognizer.onresult = (e) => {
          let fullTranscript = '';
          for (let i = 0; i < e.results.length; i++) {
            fullTranscript += e.results[i][0].transcript + ' ';
          }
          this.accumulatedHeard = fullTranscript.trim();
          if (this.accumulatedHeard.length > 0) {
            this.hasSpoken = true;
          }

          if (this.heardText && this.isRecording) {
            this.heardText.textContent = `실시간 인식: "${this.accumulatedHeard}"`;
          }
          if (this.scoreNumber && this.isRecording) {
            this.scoreNumber.textContent = '말씀하시는 중... 🎙️ (다 읽으면 자동 완료)';
          }

          // 음성이 들어올 때마다 타이머 갱신 (다 읽고 멈추면 delay 후 자동 완료)
          triggerAutoCompleteTimer();
        };

        this.shadowRecognizer.onspeechend = () => {
          if (this.isRecording && this.hasSpoken) {
            // 브라우저가 발화 종료를 감지했을 때 빠른 자동 완료 (700ms)
            triggerAutoCompleteTimer(700);
          }
        };

        this.shadowRecognizer.onerror = (e) => {
          console.warn('[Shadow STT Error]:', e.error);
        };

        this.shadowRecognizer.onend = () => {
          if (this.isRecording && this.shadowRecognizer) {
            // 이미 문장을 발화한 상태에서 인식이 끝났으면 즉시 자동 완료
            if (this.hasSpoken && this.accumulatedHeard.length > 0) {
              this.stopRecording();
              return;
            }
            // 아직 말을 시작하지 않은 경우 대기 유지
            try {
              this.shadowRecognizer.start();
            } catch (err) {}
          }
        };

        this.shadowRecognizer.start();
      } catch (e) {
        console.warn('SpeechRecognition 시작 오류:', e);
      }
    }
  }

  // 섀도잉 녹음 종료 및 평가 결과 표시
  stopRecording(score = null, heard = '') {
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    if (this.maxRecordTimeout) {
      clearTimeout(this.maxRecordTimeout);
      this.maxRecordTimeout = null;
    }

    if (this.recordBtn) {
      this.recordBtn.classList.remove('recording');
      this.recordBtn.innerHTML = '<span>🎙️ 다시 따라 말하기</span>';
    }

    // 1. STT 중지
    if (this.shadowRecognizer) {
      this.shadowRecognizer.onend = null; // 재시작 방지
      try { this.shadowRecognizer.stop(); } catch (e) {}
      this.shadowRecognizer = null;
    }

    // 2. MediaRecorder 중지 → onstop 내부에서 스트림 트랙 해제 (모바일 비동기 race 방지)
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch (e) {}
      // onstop이 비동기로 capturedStream.getTracks().stop() + null 처리
    } else {
      // MediaRecorder 없거나 이미 inactive → 직접 스트림 정리
      if (this.shadowStream) {
        try { this.shadowStream.getTracks().forEach(t => t.stop()); } catch (e) {}
        this.shadowStream = null;
      }
    }

    // 4. 결과 판정 및 점수 계산
    const finalHeard = (heard || this.accumulatedHeard || '').trim();
    let calculatedScore = score;

    if (calculatedScore === null) {
      if (finalHeard.length > 0 && this.currentTargetFull.length > 0) {
        calculatedScore = this.calculateSimilarity(finalHeard.toLowerCase(), this.currentTargetFull);
      } else {
        calculatedScore = null;
      }
    }

    // 5. 결과 UI 업데이트
    if (this.resultBox) {
      this.resultBox.style.display = 'flex';
    }

    if (calculatedScore !== null) {
      if (this.scoreNumber) this.scoreNumber.textContent = `발음 정확도: ${calculatedScore}점`;
      if (this.heardText) this.heardText.textContent = `인식된 발음: "${finalHeard}"`;
      if (this.scoreStars) {
        if (calculatedScore >= 85) {
          this.scoreStars.textContent = '⭐⭐⭐ (원어민 수준!)';
          if (window.soundFx) window.soundFx.playCombo();
        } else if (calculatedScore >= 65) {
          this.scoreStars.textContent = '⭐⭐ (훌륭해요!)';
          if (window.soundFx) window.soundFx.playCorrect();
        } else {
          this.scoreStars.textContent = '⭐ (조금 더 또박또박!)';
          if (window.soundFx) window.soundFx.playWrong();
        }
      }
    } else {
      if (this.scoreStars) this.scoreStars.textContent = '🎙️ 녹음 완료!';
      if (this.scoreNumber) this.scoreNumber.textContent = '목소리 녹음 완료';
      if (this.heardText) this.heardText.textContent = finalHeard ? `인식된 발음: "${finalHeard}"` : '녹음이 저장되었습니다. [내 목소리 다시 듣기]를 눌러보세요!';
      if (window.soundFx) window.soundFx.playCorrect();
    }

    // 6. AI 원어민 발음 정밀 클리닉 & 음소 교정 코칭 & 피치 컨투어 렌더링
    let targetSentence = '';
    if (window.gameApp && window.gameApp.currentQuestion) {
      const q = window.gameApp.currentQuestion;
      targetSentence = q.audioText || q.full || (q.sentence ? q.sentence.replace('_____', q.answerWord || '') : '');
    } else if (this.currentTargetFull) {
      targetSentence = this.currentTargetFull;
    }

    const clinicPanel = document.getElementById('pronunciationClinicPanel');
    if (clinicPanel && window.pronunciationCoach) {
      window.pronunciationCoach.renderClinic(clinicPanel, targetSentence, finalHeard, calculatedScore || 75);
    }

    // AI 실시간 피치 억양 컨투어 렌더링
    if (window.aiLearningEngine && window.aiLearningEngine.pitchContour) {
      window.aiLearningEngine.pitchContour.render('aiPitchContourContainer', targetSentence, this.currentUserAudioUrl, calculatedScore || 75);
    }

    // 7. VoiceCommander 재개 (섀도잉 전 켜져 있었던 경우)
    if (this.wasVoiceCommanderActive && window.gameApp && window.gameApp.voiceCommander) {
      this.wasVoiceCommanderActive = false;
      setTimeout(() => {
        if (window.gameApp && window.gameApp.voiceCommander && !this.isRecording) {
          window.gameApp.voiceCommander.start();
        }
      }, 600);
    }

  }

  // 발음 단어 유사도 계산
  calculateSimilarity(s1, s2) {
    if (!s1 || !s2) return 50;
    const clean1 = s1.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const clean2 = s2.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (clean1 === clean2) return 100;

    const words1 = clean1.split(/\s+/).filter(Boolean);
    const words2 = clean2.split(/\s+/).filter(Boolean);
    if (words1.length === 0 || words2.length === 0) return 50;

    let matches = 0;
    words1.forEach(w => {
      if (words2.includes(w)) {
        matches++;
      } else if (words2.some(w2 => w2.includes(w) || w.includes(w2))) {
        matches += 0.5;
      }
    });
    const ratio = matches / Math.max(words1.length, words2.length);
    return Math.min(100, Math.max(50, Math.round(ratio * 100)));
  }

  // 사용자 녹음 목소리 재생
  playUserVoice() {
    if (!this.currentUserAudioUrl) {
      if (this._mediaRecordingAvailable === false) {
        alert('⚠️ 마이크 접근 권한이 없거나 브라우저에서 녹음을 지원하지 않아 녹음이 진행되지 않았습니다.\n(음성 인식 결과만 표시되었습니다)');
      } else {
        alert('🎙️ 먼저 바로 옆의 [따라 말하기 시작] 버튼을 눌러 마이크로 문장을 읽고 녹음해 보세요!');
      }
      return;
    }

    if (this.currentUserAudio) {
      this.currentUserAudio.pause();
      this.currentUserAudio.currentTime = 0;
    }

    this.currentUserAudio = new Audio(this.currentUserAudioUrl);

    if (this.playUserVoiceBtn) {
      this.playUserVoiceBtn.classList.add('playing');
    }
    if (this.playUserVoiceText) {
      this.playUserVoiceText.textContent = '내 목소리 재생 중...';
    }

    const resetBtn = () => {
      if (this.playUserVoiceBtn) this.playUserVoiceBtn.classList.remove('playing');
      if (this.playUserVoiceText) this.playUserVoiceText.textContent = '내 목소리 다시 듣기';
    };

    this.currentUserAudio.onended = resetBtn;
    this.currentUserAudio.onerror = resetBtn;

    this.currentUserAudio.play().catch(e => {
      console.warn('사용자 녹음 오디오 재생 실패:', e);
      resetBtn();
    });
  }

  // 원어민 발음 비교 TTS 재생
  playNativeCompare(targetText) {
    if (this.currentUserAudio) {
      this.currentUserAudio.pause();
      if (this.playUserVoiceBtn) this.playUserVoiceBtn.classList.remove('playing');
      if (this.playUserVoiceText) this.playUserVoiceText.textContent = '내 목소리 다시 듣기';
    }

    let fullText = targetText;
    if (!fullText && window.gameApp && window.gameApp.currentQuestion) {
      const q = window.gameApp.currentQuestion;
      fullText = q.audioText || q.full;
      if (!fullText) {
        const ans = q.answerWord || (q.options ? q.options[q.answer] : '');
        fullText = q.sentence.replace('_____', ans);
      }
    }

    if (!fullText) return;
    fullText = fullText.trim();
    if (!fullText.endsWith('.') && !fullText.endsWith('?') && !fullText.endsWith('!')) {
      fullText += '.';
    }

    if (window.soundFx) {
      window.soundFx.speakEnglish(fullText);
    }
  }

  cleanupAudio() {
    if (this.currentUserAudio) {
      try { this.currentUserAudio.pause(); } catch (e) {}
      this.currentUserAudio = null;
    }
    if (this.currentUserAudioUrl) {
      URL.revokeObjectURL(this.currentUserAudioUrl);
      this.currentUserAudioUrl = null;
    }
    this.audioChunks = [];
  }
}

window.ShadowingManager = ShadowingManager;
