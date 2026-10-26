// 영어 직접 발음 & 주관식 말하기/듣기 전용 Web Speech API 음성 제어 모듈
class VoiceCommander {
  constructor(onActionCallback) {
    this.onAction = onActionCallback;
    this.recognition = null;
    this.isListening = false;
    this.isSupported = false;
    this.autoRestart = true;
    this.currentLang = 'en-US'; // 영어 문법 퀴즈이므로 영어 발음 인식이 최우선!
    
    // UI 요소 캐싱
    this.statusCard = document.getElementById('voiceStatusCard');
    this.statusText = document.getElementById('voiceStatusText');
    this.heardText = document.getElementById('voiceHeardText');
    this.toggleBtn = document.getElementById('micToggleBtn');
    this.toggleBtnText = document.getElementById('micToggleBtnText');
    
    // 주관식 말하기/듣기 스테이지 요소
    this.speechLiveHeard = document.getElementById('speechLiveHeard');
    this.speechInstruction = document.getElementById('speechInstruction');
    this.speechMicToggleBtn = document.getElementById('speechMicToggleBtn');
    this.speechMicBtnText = document.getElementById('speechMicBtnText');
    this.speechWaveContainer = document.querySelector('.voice-wave-container');

    // 한글 음차 & 발음 변이 사전 (한국어/영어 혼용 인식 지원)
    this.phoneticMap = {
      'is': ['is', '이즈', '이', '이스', "it's", 'its', 'eas'],
      'are': ['are', '알', '아르', '아', '우리', 'our', 'r'],
      'am': ['am', '엠', '암', '애', 'aim', 'i\'m'],
      'was': ['was', '워즈', '왓즈', '와즈', 'wash', 'ones'],
      'were': ['were', '웨어', '워', '위어', 'where'],
      'went': ['went', '웬트', '왠트', '웨인', 'want', 'when', 'wind'],
      'go': ['go', '고', '고우'],
      'goes': ['goes', '고즈'],
      'gone': ['gone', '곤', '건'],
      'going': ['going', '고잉'],
      'have': ['have', '해브', '해프', '햅'],
      'has': ['has', '해즈', '햇'],
      'had': ['had', '해드', '헫'],
      'do': ['do', '두', 'to'],
      'does': ['does', '더즈', '다즈'],
      'did': ['did', '디드'],
      'play': ['play', '플레이'],
      'plays': ['plays', '플레이즈'],
      'played': ['played', '플레이드'],
      'playing': ['playing', '플레잉'],
      'study': ['study', '스터디'],
      'studies': ['studies', '스터디즈'],
      'studied': ['studied', '스터디드'],
      'studying': ['studying', '스터딩'],
      'clean': ['clean', '클린'],
      'cleaned': ['cleaned', '클린드'],
      'cleaning': ['cleaning', '클리닝'],
      'make': ['make', '메이크'],
      'makes': ['makes', '메익스'],
      'made': ['made', '메이드'],
      'making': ['making', '메이킹'],
      'read': ['read', '리드', '레드', 'red'],
      'reading': ['reading', '리딩'],
      'reads': ['reads', '리즈'],
      'write': ['write', '라이트', 'right'],
      'wrote': ['wrote', '로트', '우로트', 'road'],
      'written': ['written', '리튼'],
      'writing': ['writing', '라이팅', 'lighting'],
      'run': ['run', '런', 'learn'],
      'ran': ['ran', '랜'],
      'running': ['running', '러닝', '래닝'],
      'see': ['see', '씨', '시', 'sea'],
      'saw': ['saw', '쏘', '소'],
      'seen': ['seen', '씬', '신', 'scene'],
      'eat': ['eat', '잇', '이트'],
      'ate': ['ate', '에이트', 'eight'],
      'eaten': ['eaten', '이튼'],
      'eating': ['eating', '이팅'],
      'teach': ['teach', '티치'],
      'taught': ['taught', '토트'],
      'teaching': ['teaching', '티칭'],
      'buy': ['buy', '바이', 'by', 'bye'],
      'bought': ['bought', '보트', 'boat'],
      'take': ['take', '테이크'],
      'took': ['took', '툭'],
      'taken': ['taken', '테이큰'],
      'taking': ['taking', '테이킹'],
      'help': ['help', '헬프'],
      'helps': ['helps', '헬프스'],
      'helped': ['helped', '헬프트'],
      'helping': ['helping', '헬핑'],
      'watch': ['watch', '와치', '워치'],
      'watched': ['watched', '와치드'],
      'watching': ['watching', '와칭'],
      'swim': ['swim', '스윔'],
      'swimming': ['swimming', '스위밍'],
      'swam': ['swam', '스왬'],
      'sleep': ['sleep', '슬립'],
      'sleeping': ['sleeping', '슬리핑'],
      'slept': ['slept', '슬렙트'],
      'sing': ['sing', '싱'],
      'singing': ['singing', '싱잉'],
      'sang': ['sang', '생'],
      'sung': ['sung', '성'],
      'speak': ['speak', '스피크'],
      'spoke': ['spoke', '스포크'],
      'spoken': ['spoken', '스포큰'],
      'speaking': ['speaking', '스피킹'],
      'walk': ['walk', '워크', 'work'],
      'walked': ['walked', '워크트'],
      'walking': ['walking', '워킹', 'working'],
      'talk': ['talk', '토크'],
      'talked': ['talked', '토크트'],
      'talking': ['talking', '토킹'],
      'listen': ['listen', '리슨'],
      'listened': ['listened', '리슨드'],
      'listening': ['listening', '리스닝'],
      'cook': ['cook', '쿡'],
      'cooked': ['cooked', '쿡트'],
      'cooking': ['cooking', '쿠킹'],
      'open': ['open', '오픈'],
      'opened': ['opened', '오픈드'],
      'opening': ['opening', '오프닝'],
      'close': ['close', '클로즈'],
      'closed': ['closed', '클로즈드'],
      'closing': ['closing', '클로징'],
      'live': ['live', '리브'],
      'lived': ['lived', '리브드'],
      'living': ['living', '리빙'],
      'love': ['love', '러브'],
      'loved': ['loved', '러브드'],
      'loving': ['loving', '러빙'],
      'like': ['like', '라이크'],
      'liked': ['liked', '라이크트'],
      'liking': ['liking', '라이킹'],
      'want': ['want', '원트'],
      'wanted': ['wanted', '원티드'],
      'wanting': ['wanting', '원팅'],
      'need': ['need', '니드'],
      'needed': ['needed', '니디드'],
      'know': ['know', '노우', '노', 'no'],
      'knew': ['knew', '뉴', 'new'],
      'known': ['known', '노운'],
      'think': ['think', '씽크', '싱크'],
      'thought': ['thought', '쏘트', '소트'],
      'feel': ['feel', '필'],
      'felt': ['felt', '펠트'],
      'can': ['can', '캔'],
      'could': ['could', '쿠드'],
      'will': ['will', '윌'],
      'would': ['would', '우드', 'wood'],
      'shall': ['shall', '쉘'],
      'should': ['should', '슈드'],
      'may': ['may', '메이'],
      'might': ['might', '마이트'],
      'must': ['must', '머스트'],
      'bigger': ['bigger', '비거'],
      'biggest': ['biggest', '비기스트'],
      'smaller': ['smaller', '스몰러'],
      'smallest': ['smallest', '스몰리스트'],
      'faster': ['faster', '패스터'],
      'fastest': ['fastest', '패스티스트'],
      'slower': ['slower', '슬로워'],
      'slowest': ['slowest', '슬로위스트'],
      'taller': ['taller', '톨러'],
      'tallest': ['tallest', '톨리스트'],
      'better': ['better', '베터', '베러'],
      'best': ['best', '베스트'],
      'worse': ['worse', '워스'],
      'worst': ['worst', '워스트'],
      'more': ['more', '모어'],
      'most': ['most', '모스트'],
      'older': ['older', '올더'],
      'oldest': ['oldest', '올디스트'],
      'younger': ['younger', '영거'],
      'youngest': ['youngest', '영기스트'],
      'easier': ['easier', '이지어'],
      'easiest': ['easiest', '이지스트'],
      'harder': ['harder', '하더'],
      'hardest': ['hardest', '하디스트']
    };

    this.init();
  }

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API 미지원 브라우저');
      this.isSupported = false;
      if (this.statusText) this.statusText.textContent = '음성 미지원';
      if (this.heardText) this.heardText.textContent = '마이크 API 미지원 브라우저';
      if (this.toggleBtn) this.toggleBtn.style.display = 'none';
      return;
    }

    this.isSupported = true;
    try {
      this.recognition = new SpeechRecognition();
      // 영어 문법 단어를 정확하게 듣기 위해 en-US 기본 탑재
      this.recognition.lang = this.currentLang;
      this.recognition.continuous = true;
      this.recognition.interimResults = true; // 실시간 발화 중간 텍스트 표시
      this.recognition.maxAlternatives = 5;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.updateUI();
        console.log('[VoiceCommander] 마이크 음성 인식 시작됨 (lang:', this.currentLang, ')');
      };

      this.recognition.onresult = (event) => {
        // 최신 결과들 파싱
        let interimTranscript = '';
        let finalTranscript = '';
        const candidateWords = [];

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            for (let j = 0; j < res.length; j++) {
              const text = res[j].transcript.trim().toLowerCase();
              if (text && !candidateWords.includes(text)) {
                candidateWords.push(text);
              }
            }
            finalTranscript += res[0].transcript;
          } else {
            interimTranscript += res[0].transcript;
          }
        }

        // 1. 말하는 도중 중간 인식 텍스트(실시간 피드백) 노출
        if (interimTranscript) {
          const cleanInterim = interimTranscript.trim();
          this.showLiveHeard(`🎙️ 인식 중: "${cleanInterim}"...`, 'listening');
          if (this.heardText) this.heardText.textContent = `"${cleanInterim}"...`;
        }

        // 2. 최종 문장/단어가 완성되었을 때 매칭 수행
        if (candidateWords.length > 0) {
          const primaryWord = candidateWords[0] || '';
          console.log('[Voice Candidates Final]:', candidateWords);
          if (this.heardText) this.heardText.textContent = `"${primaryWord}"`;

          // 게임 문제 컨텍스트와 매칭 분석
          const action = this.parseCommand(candidateWords);
          if (action) {
            if (window.soundFx) window.soundFx.playVoiceAck();
            this.highlightRecognized();
            if (this.onAction) {
              this.onAction(action);
            }
          }
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('[Voice Error]:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.autoRestart = false;
          this.isListening = false;
          if (this.statusText) this.statusText.textContent = '마이크 권한 필요';
          if (this.heardText) this.heardText.textContent = '마이크 권한을 허용해주세요';
          this.showLiveHeard('⚠️ 마이크 권한이 차단되었습니다. 브라우저 주소창에서 권한을 허용해주세요.', 'error');
          this.updateUI();
        } else if (event.error === 'no-speech') {
          // 말소리가 감지되지 않음 -> 계속 청취 유지
        }
      };

      this.recognition.onend = () => {
        if (this.isListening && this.autoRestart) {
          try {
            this.recognition.start();
          } catch (e) {}
        } else {
          this.isListening = false;
          this.updateUI();
        }
      };

      if (this.statusCard) {
        this.statusCard.style.cursor = 'pointer';
        this.statusCard.title = '클릭/터치 또는 V키로 마이크 켜기/끄기';
        this.statusCard.addEventListener('click', () => this.toggle());
      }
      this.updateUI();
    } catch (err) {
      console.error('음성 인식 초기화 오류:', err);
      this.isSupported = false;
    }
  }

  // 실시간 발화 상태 표시 헬퍼
  showLiveHeard(message, type = 'normal') {
    if (!this.speechLiveHeard) {
      this.speechLiveHeard = document.getElementById('speechLiveHeard');
    }
    if (this.speechLiveHeard) {
      this.speechLiveHeard.textContent = message;
      this.speechLiveHeard.className = `speech-live-heard live-${type}`;
    }
  }

  // 단어 발음 일치 여부 정밀 판정 (영어 + 한글 음차 지원)
  matchWord(spoken, target) {
    if (!spoken || !target) return false;
    const s = spoken.toLowerCase().replace(/[^a-zA-Z0-9가-힣]/g, '').trim();
    const t = target.toLowerCase().replace(/[^a-zA-Z0-9가-힣]/g, '').trim();

    if (!s || !t) return false;
    if (s === t) return true;

    // 1. 포함 관계 (단어가 발화에 정확히 포함되어 있는 경우)
    if (s.includes(t) || t.includes(s)) {
      // 너무 짧은 1글자('a', 'i') 오탐 방지 (단, 실제 정답이 'a', 'i'인 경우 제외)
      if (t.length >= 2 || s === t) return true;
    }

    // 2. 음차 사전 대조 (target의 발음 변이들 중 일치하는지)
    const variants = this.phoneticMap[t];
    if (variants && variants.some(v => s === v || s.includes(v) || v.includes(s))) {
      return true;
    }

    // 3. Levenshtein 거리 유사도 비교 (철자 3글자 이상일 때 1글자 오차 허용)
    if (t.length >= 3) {
      const dist = this.levenshtein(s, t);
      if (dist <= 1 && Math.abs(s.length - t.length) <= 1) {
        return true;
      }
    }

    return false;
  }

  levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  // 발화 후보군 -> 게임 액션 변환
  parseCommand(candidates) {
    const currentQ = (window.gameApp && window.gameApp.currentQuestion) ? window.gameApp.currentQuestion : null;

    // 1. [최우선] 현재 문제의 정답 영어 단어 직접 발음 매칭
    if (currentQ) {
      // (1) 문장 전체 섀도잉 문제인 경우: 문장 전체 일치율 비교
      if (currentQ.type === 'shadowing') {
        const fullTarget = (currentQ.audioText || currentQ.full || currentQ.sentence.replace('_____', currentQ.answerWord || '')).toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').trim();
        const targetWords = fullTarget.split(/\s+/).filter(Boolean);

        for (const spoken of candidates) {
          const cleanSpoken = spoken.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').trim();
          const spokenWords = cleanSpoken.split(/\s+/).filter(Boolean);
          let matches = 0;
          spokenWords.forEach(sw => {
            if (targetWords.includes(sw)) matches++;
          });
          const matchRatio = matches / Math.max(1, targetWords.length);
          if (matchRatio >= 0.35 || cleanSpoken.includes(fullTarget) || fullTarget.includes(cleanSpoken)) {
            this.showLiveHeard(`✅ 섀도잉 발음 인식 완료: "${spoken}"`, 'correct');
            return {
              type: 'spokenShadowingAnswer',
              spokenSentence: spoken,
              targetSentence: fullTarget,
              similarity: Math.min(100, Math.max(65, Math.round(matchRatio * 100))),
              isCorrect: true
            };
          }
        }
      }

      // (2) 주관식 말하기 / 듣기 문제인 경우: acceptableAnswers 목록과 정밀 대조
      if (currentQ.type === 'speaking' || currentQ.type === 'listening') {
        const rawAnswers = currentQ.acceptableAnswers || [currentQ.answerWord || currentQ.missingWord || ''];
        const targets = rawAnswers.map(a => a.toLowerCase().trim()).filter(Boolean);

        // 후보군 중 정답과 일치하는 단어가 있는지 탐색
        for (const spoken of candidates) {
          for (const target of targets) {
            if (this.matchWord(spoken, target)) {
              this.showLiveHeard(`🎉 정답 인식 성공! "${spoken}" (목표: ${target})`, 'correct');
              return {
                type: 'spokenDirectAnswer',
                spokenWord: spoken,
                targetAnswer: target,
                isCorrect: true
              };
            }
          }
        }

        // 정답과 일치하지 않는 발음이 들어온 경우: 즉시 탈락시키지 않고 다시 말할 기회를 제공!
        if (candidates.length > 0) {
          const first = candidates[0];
          // 제어 명령어가 아닐 때 화면에 인식된 단어와 함께 '다시 말씀해보세요' 안내
          if (!this.isControlWord(first)) {
            this.showLiveHeard(`⚠️ 인식된 소리: "${first}" (정답과 다릅니다. 다시 또박또박 말씀해보세요!)`, 'retry');
            return null; // 바로 틀리게 끝내지 않고 재발화 허용!
          }
        }
      }

      // (3) 4지선다형 문제인 경우: 4개 보기의 영어 단어 또는 번호 대조
      if (currentQ.type === 'choice' && currentQ.options) {
        for (let optIdx = 0; optIdx < currentQ.options.length; optIdx++) {
          const optWord = currentQ.options[optIdx].toLowerCase().trim();
          for (const spoken of candidates) {
            if (this.matchWord(spoken, optWord)) {
              this.showLiveHeard(`🎯 보기 선택됨: ${optIdx + 1}번 "${optWord}"`, 'correct');
              return { type: 'selectOption', index: optIdx };
            }
          }
        }
      }
    }

    // 2. 제어 및 네비게이션 명령어 매칭 (한국어 & 영어 지원)
    for (const spoken of candidates) {
      const clean = spoken.toLowerCase().replace(/[\s.,?!]/g, '');

      // 번호 직접 선택 (1, 2, 3, 4 / one, two, three, four / 1번, 2번)
      if (/^(1|1번|일번|첫번째|one|first|numberone)$/.test(clean)) return { type: 'selectOption', index: 0 };
      if (/^(2|2번|이번|두번째|two|second|numbertwo)$/.test(clean)) return { type: 'selectOption', index: 1 };
      if (/^(3|3번|삼번|세번째|three|third|numberthree)$/.test(clean)) return { type: 'selectOption', index: 2 };
      if (/^(4|4번|사번|네번째|four|fourth|numberfour)$/.test(clean)) return { type: 'selectOption', index: 3 };

      // 다시 듣기 (리스닝 문제용)
      if (/^(다시듣기|다시들려줘|듣기|소리|play|listen|replay|audio)$/.test(clean) || clean.includes('다시들')) {
        return { type: 'replayAudio' };
      }

      // 난이도 레벨 변경 음성 명령 (Level 1 ~ 6 및 기존 명칭 지원)
      if (/^(레벨1|level1|lv1|1단계|초등3|초3|초4|초등기초)$/.test(clean) || clean.includes('레벨1') || clean.includes('level1')) {
        return { type: 'changeGrade', grade: 1 };
      }
      if (/^(레벨2|level2|lv2|2단계|초등5|초5|초6|초등심화)$/.test(clean) || clean.includes('레벨2') || clean.includes('level2')) {
        return { type: 'changeGrade', grade: 2 };
      }
      if (/^(레벨3|level3|lv3|3단계|중1|중학교1|중1학년)$/.test(clean) || clean.includes('레벨3') || clean.includes('level3')) {
        return { type: 'changeGrade', grade: 3 };
      }
      if (/^(레벨4|level4|lv4|4단계|중2|중학교2|중2학년)$/.test(clean) || clean.includes('레벨4') || clean.includes('level4')) {
        return { type: 'changeGrade', grade: 4 };
      }
      if (/^(레벨5|level5|lv5|5단계|중3|중학교3|중3학년)$/.test(clean) || clean.includes('레벨5') || clean.includes('level5')) {
        return { type: 'changeGrade', grade: 5 };
      }
      if (/^(레벨6|level6|lv6|6단계|고등|고1|고2|고3|수능|수능어법)$/.test(clean) || clean.includes('레벨6') || clean.includes('level6')) {
        return { type: 'changeGrade', grade: 6 };
      }

      // 방향키 이동
      if (/^(위|상|위로|up)$/.test(clean)) return { type: 'nav', dir: 'up' };
      if (/^(아래|하|밑|밑으로|down)$/.test(clean)) return { type: 'nav', dir: 'down' };
      if (/^(왼쪽|좌|좌측|left)$/.test(clean)) return { type: 'nav', dir: 'left' };
      if (/^(오른쪽|우|우측|right)$/.test(clean)) return { type: 'nav', dir: 'right' };

      // 결정 / 다음 / 시작
      if (/^(선택|확인|결정|정답|엔터|select|ok|enter|yes)$/.test(clean) || clean.includes('선택')) return { type: 'confirm' };
      if (/^(다음|다음문제|넘어가|next|go)$/.test(clean) || clean.includes('다음')) return { type: 'next' };
      if (/^(시작|스타트|게임시작|start)$/.test(clean) || clean.includes('시작')) return { type: 'start' };
      if (/^(다시|다시시작|재시작|restart|again)$/.test(clean) || clean.includes('다시')) return { type: 'restart' };

      // 조작 및 사용법 도움말 보기 명령
      if (/^(도움말|사용법|조작법|방법|가이드|help|guide)$/.test(clean) || clean.includes('도움말') || clean.includes('사용법')) {
        return { type: 'help' };
      }

      // 문법 개념 / 공식 / 치트시트 보기 명령
      if (/^(설명|문법|개념|힌트|공식|치트시트|grammar|concept|rule|hint)$/.test(clean) || clean.includes('설명') || clean.includes('문법') || clean.includes('개념')) {
        return { type: 'concept' };
      }

      // 모달 닫기
      if (/^(닫기|닫아줘|나가기|취소|close|cancel)$/.test(clean)) {
        return { type: 'closeModal' };
      }

      // 내 목소리 다시 듣기 (섀도잉 녹음 재생)
      if (/^(내목소리|내발음|내소리|들어보기|내목소리듣기)$/.test(clean) || clean.includes('내목소리') || clean.includes('내발음')) {
        return { type: 'replayUserVoice' };
      }

      // 원어민 발음 비교
      if (/^(원어민|원어민발음|원어민소리|비교|발음비교)$/.test(clean) || clean.includes('원어민') || clean.includes('비교')) {
        return { type: 'playNativeCompare' };
      }
    }

    return null;
  }

  // 제어 명령 단어인지 판별
  isControlWord(word) {
    const clean = word.toLowerCase().replace(/[\s.,?!]/g, '');
    return /^(다음|시작|다시|선택|정답|확인|위|아래|왼쪽|오른쪽|1번|2번|3번|4번|1|2|3|4|one|two|three|four|설명|문법|개념|힌트|공식|도움말|사용법|조작법|닫기|내목소리|내발음|원어민|비교|next|start|restart|help|rule|close)$/.test(clean);
  }

  highlightRecognized() {
    if (this.statusCard) this.statusCard.classList.add('listening');
    if (this.speechWaveContainer) this.speechWaveContainer.classList.add('active');
    setTimeout(() => {
      if (!this.isListening) {
        if (this.statusCard) this.statusCard.classList.remove('listening');
        if (this.speechWaveContainer) this.speechWaveContainer.classList.remove('active');
      }
    }, 400);
  }

  // 브라우저 마이크 권한 요청 및 시작
  async requestMicAccess() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // 스트림을 열어 브라우저 권한을 확실히 획득 후 트랙 해제
        stream.getTracks().forEach(t => t.stop());
      }
      this.start();
      return true;
    } catch (err) {
      console.warn('마이크 권한 요청 실패:', err);
      if (this.statusText) this.statusText.textContent = '마이크 권한 필요';
      this.showLiveHeard('⚠️ 마이크 사용 권한을 허용해야 음성 인식이 가능합니다.', 'error');
      this.updateUI();
      return false;
    }
  }

  start() {
    if (!this.isSupported || !this.recognition) return;
    this.autoRestart = true;
    try {
      this.recognition.start();
      this.isListening = true;
      this.updateUI();
    } catch (e) {
      // 이미 시작 중인 경우 예외 무시
      if (e.name === 'InvalidStateError') {
        this.isListening = true;
        this.updateUI();
      }
    }
  }

  stop() {
    if (!this.recognition) return;
    this.autoRestart = false;
    this.isListening = false;
    try {
      this.recognition.stop();
    } catch (e) {}
    this.updateUI();
  }

  toggle() {
    if (this.isListening) {
      this.stop();
    } else {
      this.requestMicAccess();
    }
  }

  updateUI() {
    // 1. 헤더 상단 미니 마이크 인디케이터
    if (this.statusCard) {
      if (this.isListening) {
        this.statusCard.classList.add('listening');
      } else {
        this.statusCard.classList.remove('listening');
      }
    }
    if (this.statusText) {
      this.statusText.textContent = this.isListening ? '마이크 ON 🎙️' : '마이크 OFF (V)';
    }
    if (this.heardText) {
      if (this.isListening && !this.heardText.textContent) {
        this.heardText.textContent = '단어를 말씀하세요';
      } else if (!this.isListening) {
        this.heardText.textContent = '마이크 버튼 또는 V키로 켜기';
      }
    }

    // 2. 홈 화면 마이크 토글 버튼
    if (this.toggleBtnText) {
      this.toggleBtnText.textContent = this.isListening ? '🔴 마이크 끄기' : '🎙️ 마이크 켜기 (영어 단어 직접 발음)';
    }

    // 3. 주관식 말하기/듣기 대형 스테이지 내부 전용 마이크 버튼
    if (!this.speechMicToggleBtn) {
      this.speechMicToggleBtn = document.getElementById('speechMicToggleBtn');
      this.speechMicBtnText = document.getElementById('speechMicBtnText');
    }
    if (this.speechMicToggleBtn) {
      if (this.isListening) {
        this.speechMicToggleBtn.classList.add('active');
        if (this.speechMicBtnText) this.speechMicBtnText.textContent = '🟢 마이크 켜짐 (영어로 답을 말씀하세요)';
      } else {
        this.speechMicToggleBtn.classList.remove('active');
        if (this.speechMicBtnText) this.speechMicBtnText.textContent = '🎙️ 마이크 켜고 음성으로 답하기 (클릭)';
      }
    }

    // 4. 음성 파형 애니메이션 활성화 상태
    if (!this.speechWaveContainer) {
      this.speechWaveContainer = document.querySelector('.voice-wave-container');
    }
    if (this.speechWaveContainer) {
      if (this.isListening) {
        this.speechWaveContainer.classList.add('active');
      } else {
        this.speechWaveContainer.classList.remove('active');
      }
    }

    // 5. 사이드 드로어 마이크 버튼 동기화
    if (window.gameApp && window.gameApp.updateMicUI) {
      window.gameApp.updateMicUI();
    }
  }
}

window.VoiceCommander = VoiceCommander;
