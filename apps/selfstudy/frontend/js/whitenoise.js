// apps/selfstudy/frontend/js/whitenoise.js
// Web Audio API 기반 완전 무음원(Zero-Asset) 순수 합성 백색소음 & 완주 알림음 엔진
// 외부 mp3 파일 없이도 자연스러운 빗소리/집중 핑크노이즈/카페 노이즈를 부드럽게 합성 재생합니다.

class WhiteNoiseEngine {
  constructor() {
    this.audioCtx = null;
    this.noiseNode = null;
    this.gainNode = null;
    this.filterNode = null;
    this.isPlayingState = false;
    this.volume = 0.35; // 0.0 ~ 1.0 (너무 크지 않은 부드러운 기본 볼륨)
    this.soundType = 'rain'; // 'rain' (빗소리) | 'pink' (차분한 핑크노이즈) | 'cafe' (카페 허밍)
  }

  _initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // 1. 부드러운 핑크 노이즈 버퍼 생성 (Paul Kellet 알고리즘)
  _createNoiseBuffer() {
    const bufferSize = this.audioCtx.sampleRate * 2; // 2초 루프 버퍼
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  // 2. 백색소음 재생 시작
  start(type = 'rain') {
    this._initContext();
    if (!this.audioCtx) return;

    if (this.isPlayingState) {
      this.stop();
    }

    this.soundType = type;
    const buffer = this._createNoiseBuffer();
    this.noiseNode = this.audioCtx.createBufferSource();
    this.noiseNode.buffer = buffer;
    this.noiseNode.loop = true;

    // 로우패스 필터로 귀에 자극 없는 부드러운 음색(빗소리/카페) 조성
    this.filterNode = this.audioCtx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    if (type === 'rain') {
      this.filterNode.frequency.value = 850;
      this.filterNode.Q.value = 1.0;
    } else if (type === 'cafe') {
      this.filterNode.frequency.value = 550;
      this.filterNode.Q.value = 0.8;
    } else {
      this.filterNode.frequency.value = 1200;
      this.filterNode.Q.value = 0.5;
    }

    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.setValueAtTime(0.01, this.audioCtx.currentTime);
    // 페이드 인 (0.01 -> 설정 볼륨)
    this.gainNode.gain.exponentialRampToValueAtTime(Math.max(0.01, this.volume), this.audioCtx.currentTime + 1.2);

    this.noiseNode.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);
    this.gainNode.connect(this.audioCtx.destination);

    this.noiseNode.start();
    this.isPlayingState = true;
  }

  // 3. 백색소음 정지 (부드러운 페이드 아웃)
  stop() {
    if (!this.isPlayingState || !this.noiseNode) return;
    try {
      if (this.gainNode && this.audioCtx) {
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioCtx.currentTime);
        this.gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.6);
        setTimeout(() => {
          if (this.noiseNode) {
            try { this.noiseNode.stop(); this.noiseNode.disconnect(); } catch {}
            this.noiseNode = null;
          }
        }, 700);
      } else {
        this.noiseNode.stop();
        this.noiseNode = null;
      }
    } catch {}
    this.isPlayingState = false;
  }

  // 4. 토글
  toggle(type) {
    if (this.isPlayingState) {
      this.stop();
      return false;
    } else {
      this.start(type || this.soundType);
      return true;
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  isPlaying() {
    return this.isPlayingState;
  }

  // 5. 학습 완료 시 맑은 차임벨 타종 (수도원 종소리풍 부드러운 2중 벨)
  playChime() {
    try {
      this._initContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (아르페지오 화음)
      notes.forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.25, now + i * 0.12 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 1.8);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 2.0);
      });
    } catch (e) {
      console.warn('Chime audio error:', e);
    }
  }
}

export const WhiteNoise = new WhiteNoiseEngine();
