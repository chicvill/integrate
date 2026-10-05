// ========================================================
// PronunciationCoach - 원어민 발음 정밀 클리닉 & 음소 교정 코칭 엔진
// V vs B, P vs F, R vs L, TH 치간음, 어휘 엑센트(강세) 차이점을 분석하고 맞춤 교정 가이드를 제공합니다.
// ========================================================

class PronunciationCoach {
  constructor() {
    // 첨단 기술 및 STEM 핵심 어휘 강세(Accent) 사전
    this.stressDict = {
      'algorithm': { syll: 'AL-go-ri-thm', stressIdx: 1, tip: '1음절 "AL"을 높고 강하게 발음하세요.' },
      'algorithms': { syll: 'AL-go-ri-thms', stressIdx: 1, tip: '1음절 "AL"을 높고 길게 발음하세요.' },
      'parameter': { syll: 'pa-RAM-e-ter', stressIdx: 2, tip: '2음절 "RAM"에 강세가 있습니다. 1음절에 힘을 주지 마세요.' },
      'parameters': { syll: 'pa-RAM-e-ters', stressIdx: 2, tip: '2음절 "RAM"에 강세가 있습니다.' },
      'autonomous': { syll: 'au-TON-o-mous', stressIdx: 2, tip: '2음절 "TON"을 강하고 명확하게 발음하세요.' },
      'autonomously': { syll: 'au-TON-o-mous-ly', stressIdx: 2, tip: '2음절 "TON"에 주강세가 옵니다.' },
      'intelligence': { syll: 'in-TEL-li-gence', stressIdx: 2, tip: '2음절 "TEL"을 가장 높게 올려주세요.' },
      'intelligent': { syll: 'in-TEL-li-gent', stressIdx: 2, tip: '2음절 "TEL"에 강세가 있습니다.' },
      'engineering': { syll: 'en-gi-NEER-ing', stressIdx: 3, tip: '3음절 "NEER"를 길고 선명하게 발음하세요.' },
      'engineer': { syll: 'en-gi-NEER', stressIdx: 3, tip: '3음절 "NEER"에 강세가 있습니다.' },
      'engineers': { syll: 'en-gi-NEERS', stressIdx: 3, tip: '3음절 "NEERS"에 강세가 있습니다.' },
      'scientific': { syll: 'sci-en-TIF-ic', stressIdx: 3, tip: '3음절 "TIF"를 강하게 터뜨려주세요.' },
      'scientist': { syll: 'SCI-en-tist', stressIdx: 1, tip: '1음절 "SCI(싸이)"에 주강세가 옵니다.' },
      'scientists': { syll: 'SCI-en-tists', stressIdx: 1, tip: '1음절 "SCI"를 강하게 발음하세요.' },
      'supercomputer': { syll: 'SU-per-com-pu-ter', stressIdx: 1, tip: '1음절 "SU"에 주강세, "pu"에 부강세가 옵니다.' },
      'satellite': { syll: 'SAT-el-lite', stressIdx: 1, tip: '1음절 "SAT"을 확실하게 올려주세요.' },
      'satellites': { syll: 'SAT-el-lites', stressIdx: 1, tip: '1음절 "SAT"에 강세가 있습니다.' },
      'telescope': { syll: 'TEL-e-scope', stressIdx: 1, tip: '1음절 "TEL"을 강하게 발음하세요.' },
      'telescopes': { syll: 'TEL-e-scopes', stressIdx: 1, tip: '1음절 "TEL"에 주강세가 옵니다.' },
      'technology': { syll: 'tech-NOL-o-gy', stressIdx: 2, tip: '2음절 "NOL"을 가장 높고 길게 발음하세요.' },
      'development': { syll: 'de-VEL-op-ment', stressIdx: 2, tip: '2음절 "VEL"에 강세가 있습니다.' },
      'astronomer': { syll: 'as-TRON-o-mer', stressIdx: 2, tip: '2음절 "TRON"을 강하게 끌어올리세요.' },
      'astrophysicist': { syll: 'as-tro-PHYS-i-cist', stressIdx: 3, tip: '3음절 "PHYS(피즈)"에 강세가 옵니다.' },
      'simulation': { syll: 'sim-u-LA-tion', stressIdx: 3, tip: '3음절 "-LA-"를 길고 확실하게 강조하세요.' },
      'simulations': { syll: 'sim-u-LA-tions', stressIdx: 3, tip: '3음절 "-LA-"에 주강세가 옵니다.' },
      'quantum': { syll: 'QUAN-tum', stressIdx: 1, tip: '1음절 "QUAN"을 세게 발음하세요.' },
      'equation': { syll: 'e-KWAY-tion', stressIdx: 2, tip: '2음절 "KWAY"를 높고 길게 소리 내세요.' },
      'equations': { syll: 'e-KWAY-tions', stressIdx: 2, tip: '2음절 "KWAY"에 강세가 옵니다.' },
      'analysis': { syll: 'a-NAL-y-sis', stressIdx: 2, tip: '2음절 "NAL"에 강세! (동사 analyze는 1음절 강세)' },
      'analyze': { syll: 'AN-a-lyze', stressIdx: 1, tip: '1음절 "AN"을 강하게 발음하세요.' },
      'analyzes': { syll: 'AN-a-lyz-es', stressIdx: 1, tip: '1음절 "AN"에 주강세가 옵니다.' },
      'humanoid': { syll: 'HU-man-oid', stressIdx: 1, tip: '1음절 "HU"에 강세가 옵니다.' },
      'microchip': { syll: 'MI-cro-chip', stressIdx: 1, tip: '1음절 "MI"를 강하고 선명하게 발음하세요.' },
      'exponentially': { syll: 'ex-po-NEN-tial-ly', stressIdx: 3, tip: '3음절 "NEN"을 가장 높게 발음하세요.' }
    };
  }

  // 문장 내 음소 분석 및 한국인 단골 발음 오류 요소 진단
  analyzePhonetics(targetText, heardText = '') {
    const cleanTarget = targetText.toLowerCase().replace(/[^a-zA-Z\s]/g, '');
    const targetWords = cleanTarget.split(/\s+/).filter(Boolean);
    const cleanHeard = heardText.toLowerCase().replace(/[^a-zA-Z\s]/g, '');
    const heardWords = cleanHeard.split(/\s+/).filter(Boolean);

    // 1. 단어 단위 일치/불일치 분석
    const wordAnalysis = targetWords.map(tw => {
      const isMatched = heardWords.some(hw => hw === tw || hw.includes(tw) || tw.includes(hw));
      return {
        word: tw,
        matched: isMatched
      };
    });

    const guides = [];

    // 2. [V vs B] 진단
    const vWords = targetWords.filter(w => w.includes('v'));
    if (vWords.length > 0) {
      guides.push({
        id: 'v_vs_b',
        title: '👄 [V vs B] 윗니-아랫입술 마찰음 진단',
        color: '#00f0ff',
        badge: 'V vs B 마찰음',
        targetWords: [...new Set(vWords)],
        koreanHabit: '한국어 "ㅂ"처럼 두 입술을 단순히 붙였다 떼는 오류가 잦습니다.',
        nativeRule: '원어민의 V는 윗니로 아랫입술 안쪽을 가볍게 누른 상태에서 목청을 울려 "부으-" 진동(vibration)을 발생시켜야 합니다.',
        actionTip: '아랫입술에 윗니를 대고 휴대폰 진동처럼 떨림이 느껴지는지 손가락을 대어 확인하세요!'
      });
    }

    // 3. [P vs F] 진단
    const fWords = targetWords.filter(w => w.includes('f') || w.includes('ph'));
    if (fWords.length > 0) {
      guides.push({
        id: 'p_vs_f',
        title: '💨 [P vs F] 바람 빠지는 마찰음 진단',
        color: '#ffc800',
        badge: 'P vs F 공기마찰',
        targetWords: [...new Set(fWords)],
        koreanHabit: '한국어 "ㅍ"처럼 두 입술을 마주치며 강하게 터뜨려 P 소리를 내기 쉽습니다.',
        nativeRule: 'F는 두 입술을 마주치지 않고, 윗니를 아랫입술에 살짝 댄 상태에서 성대 울림 없이 공기만 "치-"하고 내뿜는 무성음입니다.',
        actionTip: '손바닥을 입앞에 댔을 때 "F"는 부드러운 바람이 넓게 퍼지고, "P"는 퍽 하고 좁게 때리는 차이가 있습니다.'
      });
    }

    // 4. [R vs L] 진단
    const rWords = targetWords.filter(w => w.includes('r'));
    const lWords = targetWords.filter(w => w.includes('l'));
    if (rWords.length > 0 || lWords.length > 0) {
      guides.push({
        id: 'r_vs_l',
        title: '👅 [R vs L] 혀끝 위치(공중 부양 vs 잇몸 밀착) 진단',
        color: '#ff007f',
        badge: 'R vs L 혀 위치',
        rTargets: [...new Set(rWords.slice(0, 3))],
        lTargets: [...new Set(lWords.slice(0, 3))],
        koreanHabit: '한국어 "ㄹ"은 R과 L의 중간 소리로, 영어의 두 음소를 명확히 분리하지 못하는 원인이 됩니다.',
        nativeRule: 'R은 혀끝을 뒤로 둥글게 말되 입천장 어디에도 닿지 않아야(공중부양) 하며, L은 혀끝이 윗니 뒤쪽 잇몸(치경)에 단단하게 닿아야 합니다.',
        actionTip: 'R을 발음할 때는 입술을 앞으로 살짝 모으고 혀끝을 절대 천장에 대지 마세요!'
      });
    }

    // 5. [TH 치간음] 진단
    const thWords = targetWords.filter(w => w.includes('th'));
    if (thWords.length > 0) {
      guides.push({
        id: 'th_sound',
        title: '🦷 [TH 치간음] 앞니 사이 혀 내밀기 진단',
        color: '#a770ff',
        badge: 'TH 치간음',
        targetWords: [...new Set(thWords)],
        koreanHabit: '"스(S)"나 "디/뜨(D/T)" 소리로 혀를 입안에 넣은 채 발음하는 경향이 있습니다.',
        nativeRule: 'TH(θ, ð)는 혀끝을 윗니와 아랫니 사이에 1cm가량 내밀어 공기를 마찰시키는 치간음입니다.',
        actionTip: '거울을 보았을 때 발음 순간 혀끝이 앞니 사이로 쏙 삐져나오는 것이 보여야 정석입니다.'
      });
    }

    // 6. [강세 & 엑센트] 단어 추출
    const stressMatches = [];
    targetWords.forEach(w => {
      const lower = w.toLowerCase();
      if (this.stressDict[lower]) {
        stressMatches.push({
          word: lower,
          ...this.stressDict[lower]
        });
      }
    });

    return {
      targetWords,
      heardWords,
      wordAnalysis,
      guides,
      stressMatches
    };
  }

  // 발음 클리닉 UI 동적 렌더링
  renderClinic(container, targetText, heardText = '', score = 90) {
    if (!container) return;

    const analysis = this.analyzePhonetics(targetText, heardText);

    // 단어 일치 태그 HTML 생성
    const wordsHtml = analysis.wordAnalysis.map(item => {
      const statusClass = item.matched ? 'word-tag matched' : 'word-tag missed';
      const icon = item.matched ? '✅' : '⚠️';
      return `<span class="${statusClass}" title="${item.matched ? '정확하게 발음됨' : '발음 교정 필요'}">${icon} ${item.word}</span>`;
    }).join(' ');

    // 음소 가이드 카드 HTML 생성
    const guidesHtml = analysis.guides.map(g => {
      let targetsBadge = '';
      if (g.targetWords && g.targetWords.length > 0) {
        targetsBadge = `<div class="clinic-word-chips"><strong>문장 내 타겟 단어:</strong> ${g.targetWords.map(w => `<span class="chip-item">${w}</span>`).join('')}</div>`;
      } else if (g.rTargets && g.lTargets) {
        targetsBadge = `
          <div class="clinic-word-chips">
            <strong>R 단어:</strong> ${g.rTargets.map(w => `<span class="chip-item r">${w}</span>`).join('')}
            <strong style="margin-left:8px;">L 단어:</strong> ${g.lTargets.map(w => `<span class="chip-item l">${w}</span>`).join('')}
          </div>`;
      }

      return `
        <div class="clinic-card" style="border-left-color: ${g.color};">
          <div class="clinic-card-header">
            <span class="clinic-badge" style="background: ${g.color}22; color: ${g.color}; border: 1px solid ${g.color}55;">${g.badge}</span>
            <span class="clinic-card-title">${g.title}</span>
          </div>
          ${targetsBadge}
          <div class="clinic-card-body">
            <p class="clinic-rule"><strong>💡 원어민 발음 규칙:</strong> ${g.nativeRule}</p>
            <p class="clinic-habit"><strong>⚠️ 주의할 점:</strong> ${g.koreanHabit}</p>
            <p class="clinic-action"><strong>🎯 실전 입모양 팁:</strong> ${g.actionTip}</p>
          </div>
        </div>
      `;
    }).join('');

    // 강세(Stress) 가이드 카드 HTML 생성
    let stressHtml = '';
    if (analysis.stressMatches.length > 0) {
      const stressCards = analysis.stressMatches.map(sm => `
        <div class="stress-item-pill">
          <span class="stress-orig">${sm.word}</span> ➔ 
          <span class="stress-syll">${sm.syll}</span>
          <span class="stress-tip">(${sm.tip})</span>
        </div>
      `).join('');

      stressHtml = `
        <div class="clinic-card stress-card">
          <div class="clinic-card-header">
            <span class="clinic-badge stress-badge">⚡ 단어 강세 & 엑센트</span>
            <span class="clinic-card-title">원어민 강세 음절 분석 (높고 길게 소리내기)</span>
          </div>
          <div class="stress-list">
            ${stressCards}
          </div>
          <div class="clinic-action" style="margin-top: 8px;">
            <strong>🎯 강세 팁:</strong> 대문자로 표기된 음절은 음을 반음 높이고 길게 발음하고, 나머지 음절은 힘을 쑥 빼야 원어민 특유의 자연스러운 리듬이 완성됩니다.
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="clinic-wrap">
        <div class="clinic-header">
          <span class="clinic-main-badge">🔬 AI 원어민 발음 정밀 클리닉</span>
          <span class="clinic-subtitle">원어민 발음과 나의 발음 차이점 분석 & 1:1 맞춤 교정</span>
        </div>

        <!-- 단어별 적중 시각화 -->
        <div class="clinic-words-track">
          <div class="clinic-track-label">단어별 발음 분석:</div>
          <div class="clinic-tags-row">
            ${wordsHtml}
          </div>
        </div>

        <!-- 음소별 교정 가이드 목록 (v-b, p-f, r-l, th) -->
        <div class="clinic-cards-grid">
          ${guidesHtml}
          ${stressHtml}
        </div>
      </div>
    `;
    container.style.display = 'block';
  }
}

window.pronunciationCoach = new PronunciationCoach();
