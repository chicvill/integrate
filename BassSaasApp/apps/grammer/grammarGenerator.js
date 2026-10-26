// 영문법 전 레벨 맞춤형 무한 영문법 생성기 & AI 실시간 적응형(Adaptive) 엔진
class MultiGradeGrammarGenerator {
  constructor() {
    this.currentLevel = 2; // 기본: Level 2 기초 (1 ~ 6)

    // 레벨별 메타데이터 (학년 대신 문법 단계별 숙련도 체계)
    this.levelConfigs = {
      1: { label: 'Level 1: 입문', badge: 'LV.1 입문', title: 'Be동사 · 지시대명사', color: '#00ffcc', gradeKey: 'elem-low' },
      2: { label: 'Level 2: 기초', badge: 'LV.2 기초', title: '현재진행 · 조동사 can', color: '#00d2ff', gradeKey: 'elem-high' },
      3: { label: 'Level 3: 발전', badge: 'LV.3 발전', title: '3인칭 단수 · 불규칙 과거', color: '#ffc800', gradeKey: 'mid-1' },
      4: { label: 'Level 4: 도약', badge: 'LV.4 도약', title: '동명사 · 수동태 · 비교급', color: '#ff9900', gradeKey: 'mid-2' },
      5: { label: 'Level 5: 숙련', badge: 'LV.5 숙련', title: '현재완료 · 관계대명사', color: '#ff007f', gradeKey: 'mid-3' },
      6: { label: 'Level 6: 마스터', badge: 'LV.6 마스터', title: '수일치 · 관계사 · 가정법', color: '#b800ff', gradeKey: 'high' }
    };

    // 기존 학년 키와의 상호 호환 매핑
    this.gradeToLevelMap = {
      'elem-low': 1,
      'elem-high': 2,
      'mid-1': 3,
      'mid-2': 4,
      'mid-3': 5,
      'high': 6
    };
  }

  // 레벨 값 정규화 (숫자 1~6 또는 기존 학년 문자열 수용)
  normalizeLevel(val) {
    if (typeof val === 'number') {
      return Math.max(1, Math.min(6, Math.round(val)));
    }
    if (this.gradeToLevelMap[val]) {
      return this.gradeToLevelMap[val];
    }
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) {
      return Math.max(1, Math.min(6, parsed));
    }
    return 2;
  }

  getLevelConfig(levelOrGrade) {
    const lvl = this.normalizeLevel(levelOrGrade);
    return this.levelConfigs[lvl] || this.levelConfigs[2];
  }

  pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  }

  makeHintMask(word) {
    if (word.length <= 2) return `${word[0]} _`;
    const dashes = Array(word.length - 1).fill('_').join(' ');
    return `${word[0]} ${dashes}`;
  }

  // ========================================================
  // 1. [Level 1: 입문] Be동사 기초 & 지시대명사 (AI & 미래 기술)
  // ========================================================
  genLevel1(type) {
    const templates = [
      // Be동사 현재형 (수학, 과학, 공학, AI 테크 융합)
      () => {
        const items = [
          { sub: "I", ans: "am", comp: "a future AI programmer", ko: "나는 미래의 AI 프로그래머이다" },
          { sub: "You", ans: "are", comp: "a curious young scientist", ko: "너는 호기심 많은 어린 과학자이다" },
          { sub: "Python", ans: "is", comp: "a powerful coding language", ko: "파이썬은 강력한 코딩 언어이다" },
          { sub: "Robots", ans: "are", comp: "helpful engineering machines", ko: "로봇들은 유용한 공학 기계들이다" },
          { sub: "We", ans: "are", comp: "future space explorers", ko: "우리는 미래의 우주 탐험가들이다" },
          { sub: "This computer", ans: "is", comp: "very fast and smart", ko: "이 컴퓨터는 매우 빠르고 똑똑하다" },
          { sub: "Smart algorithms", ans: "are", comp: "the foundation of AI", ko: "스마트 알고리즘은 AI의 기초이다" },
          { sub: "Numbers and data", ans: "are", comp: "essential in mathematics", ko: "숫자와 데이터는 수학에서 필수적이다" },
          { sub: "Living cells", ans: "are", comp: "the building blocks of biology", ko: "살아있는 세포는 생물학의 구성 요소이다" },
          { sub: "Solar power", ans: "is", comp: "a clean green energy", ko: "태양광 에너지는 청정 친환경 에너지이다" }
        ];
        const item = this.pickRandom(items);
        const sentence = `${item.sub} _____ ${item.comp}.`;
        const full = `${item.sub} ${item.ans} ${item.comp}.`;
        const options = this.shuffle(["am", "are", "is", "be"]);
        return {
          category: "LV.1 Be동사 기초 [STEM & AI 💻]",
          sentence, full, ko: item.ko, ans: item.ans, options,
          tip: `주어 '${item.sub}' 뒤에 오는 알맞은 짝꿍 Be동사는 '${item.ans}'입니다.`
        };
      },
      // 지시대명사 This / These / That / Those (하드웨어, 우주장비, 수학, 첨단센서)
      () => {
        const items = [
          { sub: "This", verb: "is", obj: "a new microchip", ko: "이것은 새로운 마이크로칩이다", options: ["is", "are", "am", "be"], ans: "is" },
          { sub: "These", verb: "are", obj: "solar panels", ko: "이것들은 태양광 패널들이다", options: ["are", "is", "am", "be"], ans: "are" },
          { sub: "That", verb: "is", obj: "a space satellite", ko: "저것은 우주 인공위성이다", options: ["is", "are", "am", "be"], ans: "is" },
          { sub: "Those", verb: "are", obj: "quantum computers", ko: "저것들은 양자 컴퓨터들이다", options: ["are", "is", "am", "be"], ans: "are" },
          { sub: "This", verb: "is", obj: "an intelligent robotic sensor", ko: "이것은 지능형 로봇 센서이다", options: ["is", "are", "am", "be"], ans: "is" },
          { sub: "These", verb: "are", obj: "mathematical formulas", ko: "이것들은 수학 공식들이다", options: ["are", "is", "am", "be"], ans: "are" },
          { sub: "That", verb: "is", obj: "a hydrogen fuel cell", ko: "저것은 수소 연료 전지이다", options: ["is", "are", "am", "be"], ans: "is" },
          { sub: "Those", verb: "are", obj: "autonomous flying drones", ko: "저것들은 자율비행 드론들이다", options: ["are", "is", "am", "be"], ans: "are" }
        ];
        const item = this.pickRandom(items);
        const sentence = `${item.sub} _____ ${item.obj}.`;
        const full = `${item.sub} ${item.ans} ${item.obj}.`;
        return {
          category: "LV.1 지시대명사 [첨단 과학 장비 🔬]",
          sentence, full, ko: item.ko, ans: item.ans, options: this.shuffle(item.options),
          tip: `'${item.sub}'는 ${item.sub.endsWith('e') || item.sub === 'These' ? '복수' : '단수'}이므로 '${item.ans}'를 씁니다.`
        };
      }
    ];
    return this.wrapQuestion(this.pickRandom(templates)(), type, 1);
  }

  // ========================================================
  // 2. [Level 2: 기초] 현재진행형(be + ing) & 조동사 can (AI, 로봇, 공학)
  // ========================================================
  genLevel2(type) {
    const templates = [
      // 현재진행형 (be + -ing)
      () => {
        const items = [
          { sub: "The robot is", base: "clean", ing: "cleaning", obj: "the science lab now", ko: "그 로봇은 지금 과학 연구실을 청소하고 있다" },
          { sub: "The engineer is", base: "test", ing: "testing", obj: "the supersonic drone", ko: "그 엔지니어는 초음속 드론을 테스트하고 있다" },
          { sub: "The AI system is", base: "analyze", ing: "analyzing", obj: "big data in real time", ko: "AI 시스템은 실시간으로 빅데이터를 분석하고 있다" },
          { sub: "We are", base: "code", ing: "coding", obj: "a machine learning model", ko: "우리는 머신러닝 모델을 코딩하고 있다" },
          { sub: "The astronomer is", base: "observe", ing: "observing", obj: "distant stars right now", ko: "천문학자는 지금 먼 별들을 관측하고 있다" },
          { sub: "The supercomputer is", base: "calculate", ing: "calculating", obj: "complex mathematical equations", ko: "슈퍼컴퓨터는 복잡한 수학 방정식을 계산하고 있다" },
          { sub: "The scientist is", base: "examine", ing: "examining", obj: "microscopic DNA structures", ko: "과학자는 미세한 DNA 구조를 조사하고 있다" },
          { sub: "The electric car is", base: "charge", ing: "charging", obj: "its high-capacity battery", ko: "전기차는 대용량 배터리를 충전하고 있다" }
        ];
        const item = this.pickRandom(items);
        const sentence = `${item.sub} _____ ${item.obj}.`;
        const full = `${item.sub} ${item.ing} ${item.obj}.`;
        const options = this.shuffle([item.ing, item.base, `${item.base}s`, `${item.base}ed`]);
        return {
          category: "LV.2 현재진행형 [스마트 연구소 & AI 🤖]",
          sentence, full, ko: item.ko, ans: item.ing, options,
          tip: "'지금 ~하는 중이다'라는 현재진행형은 be동사 + 동사-ing 형태를 씁니다."
        };
      },
      // 조동사 can + 동사원형 (AI 연산, 자율비행, 슈퍼컴퓨팅)
      () => {
        const items = [
          { sub: "AI can", base: "solve", s: "solves", obj: "complex math puzzles", ko: "AI는 복잡한 수학 퍼즐을 풀 수 있다" },
          { sub: "The drone can", base: "fly", s: "flies", obj: "autonomously in bad weather", ko: "드론은 악천후에도 자율 비행할 수 있다" },
          { sub: "Robots can", base: "assist", s: "assists", obj: "surgeons in smart hospitals", ko: "로봇은 스마트 병원에서 외과의사를 보조할 수 있다" },
          { sub: "Supercomputers can", base: "process", s: "processes", obj: "huge scientific data at light speed", ko: "슈퍼컴퓨터는 거대한 과학 데이터를 빛의 속도로 처리할 수 있다" },
          { sub: "The space telescope can", base: "capture", s: "captures", obj: "clear images of deep galaxies", ko: "우주 망원경은 심우주 은하의 선명한 사진을 포착할 수 있다" },
          { sub: "Solar panels can", base: "generate", s: "generates", obj: "clean electrical energy every day", ko: "태양광 패널은 매일 청정 전기에너지를 생산할 수 있다" }
        ];
        const item = this.pickRandom(items);
        const sentence = `${item.sub} _____ ${item.obj}.`;
        const full = `${item.sub} ${item.base} ${item.obj}.`;
        const options = this.shuffle([item.base, item.s, `${item.base}ing`, `${item.base}ed`]);
        return {
          category: "LV.2 조동사 can [미래 첨단 컴퓨팅 ⚡]",
          sentence, full, ko: item.ko, ans: item.base, options,
          tip: "조동사 can 뒤에는 언제나 '동사원형'을 씁니다."
        };
      }
    ];
    return this.wrapQuestion(this.pickRandom(templates)(), type, 2);
  }

  // ========================================================
  // 3. [Level 3: 발전] 3인칭 단수, Be/일반과거, do/does (수학 알고리즘 & 우주과학)
  // ========================================================
  genLevel3(type) {
    const templates = [
      () => {
        const subjects = [
          { name: "The AI algorithm", isThird: true, ko: "그 AI 알고리즘은" },
          { name: "The robotic arm", isThird: true, ko: "그 로봇 팔은" },
          { name: "The space probe", isThird: true, ko: "그 우주 탐사선은" },
          { name: "The aerospace engineer", isThird: true, ko: "그 항공우주 엔지니어는" },
          { name: "The quantum computer", isThird: true, ko: "그 양자 컴퓨터는" },
          { name: "The data scientists", isThird: false, ko: "데이터 과학자들은" },
          { name: "The mechanical engineers", isThird: false, ko: "기계공학자들은" },
          { name: "Smart sensors", isThird: false, ko: "스마트 센서들은" }
        ];
        const verbs = [
          { base: "analyze", s: "analyzes", obj: "big data accurately", ko: "빅데이터를 정확하게 분석한다" },
          { base: "assemble", s: "assembles", obj: "electric vehicles in the factory", ko: "공장에서 전기차를 조립한다" },
          { base: "calculate", s: "calculates", obj: "complex orbital trajectories", ko: "복잡한 궤도 비행경로를 계산한다" },
          { base: "design", s: "designs", obj: "high-efficiency semiconductor chips", ko: "고효율 반도체 칩을 설계한다" },
          { base: "detect", s: "detects", obj: "gravitational waves in deep space", ko: "심우주에서 중력파를 감지한다" }
        ];
        const sub = this.pickRandom(subjects);
        const v = this.pickRandom(verbs);
        const ans = sub.isThird ? v.s : v.base;
        const sentence = `${sub.name} _____ ${v.obj}.`;
        const full = `${sub.name} ${ans} ${v.obj}.`;
        const options = this.shuffle([v.base, v.s, `${v.base}ing`, `${v.base}ed`]);
        return {
          category: "LV.3 일반동사 현재형 [빅데이터 & AI 📈]",
          sentence, full, ko: `${sub.ko} ${v.ko}.`, ans, options,
          tip: sub.isThird ? `주어 '${sub.name}'가 3인칭 단수이므로 동사에 -s/-es를 붙인 '${ans}'가 정답입니다.` : `주어가 복수/1,2인칭이므로 동사원형 '${ans}'를 씁니다.`
        };
      },
      () => {
        const pasts = [
          { sub: "The Mars rover", base: "go", ans: "went", obj: "to the red planet last year", ko: "화성 탐사선은 작년에 붉은 행성에 갔다" },
          { sub: "The astrophysicist", base: "see", ans: "saw", obj: "a black hole collision yesterday", ko: "그 천체물리학자는 어제 블랙홀 충돌을 관측했다" },
          { sub: "Engineers", base: "build", ans: "built", obj: "a quantum supercomputer two years ago", ko: "엔지니어들은 2년 전에 양자 슈퍼컴퓨터를 구축했다" },
          { sub: "The AI researcher", base: "write", ans: "wrote", obj: "a deep learning script last night", ko: "AI 연구원은 어젯밤에 딥러닝 스크립트를 작성했다" },
          { sub: "The mathematician", base: "find", ans: "found", obj: "a novel mathematical formula last week", ko: "수학자는 지난주에 새로운 수학 공식을 발견했다" },
          { sub: "The satellite", base: "send", ans: "sent", obj: "encrypted scientific telemetry data to Earth", ko: "인공위성은 암호화된 과학 원격측정 데이터를 지구로 전송했다" }
        ];
        const item = this.pickRandom(pasts);
        const sentence = `${item.sub} _____ ${item.obj}.`;
        const full = `${item.sub} ${item.ans} ${item.obj}.`;
        const options = this.shuffle([item.base, item.ans, `${item.base}s`, `${item.base}ing`]);
        return {
          category: "LV.3 불규칙 과거시제 [우주 탐사 & 수학 발견 🚀]",
          sentence, full, ko: item.ko, ans: item.ans, options,
          tip: `과거 표현이 있으므로 '${item.base}'의 불규칙 과거형인 '${item.ans}'를 씁니다.`
        };
      }
    ];
    return this.wrapQuestion(this.pickRandom(templates)(), type, 3);
  }

  // ========================================================
  // 4. [Level 4: 도약] to부정사, 동명사, 수동태(be p.p.), 비교급 (소프트웨어 & 공학 물리)
  // ========================================================
  genLevel4(type) {
    const templates = [
      // 동명사만을 목적어로 취하는 동사 (enjoy, finish, practice, avoid, keep, suggest)
      () => {
        const items = [
          { v: "enjoy", ing: "coding", to: "to code", obj: "Python algorithms for AI models", ko: "나는 AI 모델을 위한 파이썬 알고리즘 코딩하는 것을 즐긴다" },
          { v: "finish", ing: "training", to: "to train", obj: "the deep neural network", ko: "그 연구원은 심층 신경망 훈련시키는 것을 끝마쳤다" },
          { v: "practice", ing: "flying", to: "to fly", obj: "autonomous drones in robotics class", ko: "학생들은 로봇 공학 수업에서 자율 드론 조종을 연습한다" },
          { v: "keep", ing: "calculating", to: "to calculate", obj: "supercomputer climate simulations", ko: "슈퍼컴퓨터는 기후 시뮬레이션을 계속 계산했다" },
          { v: "avoid", ing: "making", to: "to make", obj: "calculation errors in engineering design", ko: "엔지니어들은 공학 설계에서 계산 오류를 범하는 것을 피한다" },
          { v: "suggest", ing: "using", to: "to use", obj: "renewable solar energy in smart cities", ko: "과학자들은 스마트 시티에서 재생 가능한 태양광 에너지를 사용할 것을 제안한다" }
        ];
        const item = this.pickRandom(items);
        const sentence = `I ${item.v} _____ ${item.obj}.`;
        const full = `I ${item.v} ${item.ing} ${item.obj}.`;
        const options = this.shuffle([item.ing, item.to, item.ing.replace('ing', ''), `${item.ing.replace('ing', '')}ed`]);
        return {
          category: "LV.4 동명사 목적어 [AI 프로그래밍 & 공학 💾]",
          sentence, full, ko: item.ko, ans: item.ing, options,
          tip: `'${item.v}' 동사 뒤에는 to부정사가 아닌 '동명사(-ing)'를 목적어로 씁니다.`
        };
      },
      // 수동태 (be + 과거분사 p.p.)
      () => {
        const items = [
          { sub: "The space probe", be: "was", pp: "launched", base: "launch", by: "into deep orbit by the rocket", ko: "그 우주 탐사선은 로켓에 의해 심우주 궤도로 발사되었다" },
          { sub: "This neural network code", be: "was", pp: "written", base: "write", by: "by an AI software engineer", ko: "이 신경망 코드는 AI 소프트웨어 엔지니어에 의해 작성되었다" },
          { sub: "Clean solar electricity", be: "is", pp: "used", base: "use", by: "by modern robotic factories", ko: "청정 태양광 전기는 현대 로봇 공장들에 의해 사용된다" },
          { sub: "The quantum equation", be: "was", pp: "discovered", base: "discover", by: "theoretical physicists", ko: "그 양자 방정식은 이론 물리학자들에 의해 발견되었다" },
          { sub: "High-tech semiconductor chips", be: "are", pp: "manufactured", base: "manufacture", by: "in automated cleanrooms", ko: "첨단 반도체 칩은 자동화된 클린룸에서 제조된다" },
          { sub: "The autonomous vehicle", be: "is", pp: "guided", base: "guide", by: "by smart navigation algorithms", ko: "자율주행 차량은 스마트 내비게이션 알고리즘에 의해 유도된다" }
        ];
        const item = this.pickRandom(items);
        const sentence = `${item.sub} ${item.be} _____ ${item.by}.`;
        const full = `${item.sub} ${item.be} ${item.pp} ${item.by}.`;
        const options = this.shuffle([item.pp, item.base, `${item.base}s`, `${item.base}ing`]);
        return {
          category: "LV.4 수동태 (be + p.p.) [첨단 과학 기술 & 반도체 🛰️]",
          sentence, full, ko: item.ko, ans: item.pp, options,
          tip: "수동태는 'be동사 + 과거분사(p.p.)' 형태이며 '~에 의해 되다'라는 뜻입니다."
        };
      },
      // 비교급 (than)
      () => {
        const items = [
          { sub: "A quantum computer is", ans: "faster", base: "fast", than: "than a classical supercomputer", ko: "양자 컴퓨터는 기존 슈퍼컴퓨터보다 더 빠르다" },
          { sub: "Modern AI is", ans: "smarter", base: "smart", than: "than earlier calculator programs", ko: "현대 인공지능은 이전 계산기 프로그램보다 훨씬 똑똑하다" },
          { sub: "Mars is", ans: "colder", base: "cold", than: "than planet Earth", ko: "화성은 지구 행성보다 더 춥다" },
          { sub: "Big data datasets are", ans: "larger", base: "large", than: "than traditional spreadsheets", ko: "빅데이터 데이터세트는 기존의 스프레드시트보다 훨씬 방대하다" },
          { sub: "Nanometer microchips are", ans: "smaller", base: "small", than: "than biological cells", ko: "나노미터 마이크로칩은 생물학적 세포보다 더 작다" },
          { sub: "Rocket engines are", ans: "stronger", base: "strong", than: "than conventional aircraft engines", ko: "로켓 엔진은 일반 항공기 엔진보다 더 강력하다" }
        ];
        const item = this.pickRandom(items);
        const sentence = `${item.sub} _____ ${item.than}.`;
        const full = `${item.sub} ${item.ans} ${item.than}.`;
        const options = this.shuffle([item.ans, item.base, `${item.base}est`, `more ${item.base}`]);
        return {
          category: "LV.4 비교급 [컴퓨팅 성능 & 나노물리 🚀]",
          sentence, full, ko: item.ko, ans: item.ans, options,
          tip: "뒤에 '~보다'를 뜻하는 than이 있으므로 형용사의 비교급(-er)을 씁니다."
        };
      }
    ];
    return this.wrapQuestion(this.pickRandom(templates)(), type, 4);
  }

  // ========================================================
  // 5. [Level 5: 숙련] 현재완료(have p.p.), 관계대명사(who/which/that) (첨단 연구 & AI)
  // ========================================================
  genLevel5(type) {
    const templates = [
      // 현재완료 시제 (have/has + p.p.)
      () => {
        const items = [
          { sub: "Astrophysicists have", ans: "explored", base: "explore", obj: "deep space anomalies for decades", ko: "천체물리학자들은 수십 년 동안 심우주 변칙 현상을 탐사해 오고 있다 (계속)" },
          { sub: "The AI diagnostic system has", ans: "analyzed", base: "analyze", obj: "millions of medical scans", ko: "그 AI 진단 시스템은 수백만 건의 의료 영상 검사를 분석해 냈다 (완료/경험)" },
          { sub: "Robotics engineers have", ans: "designed", base: "design", obj: "autonomous solar-powered drones", ko: "로봇 공학자들은 자율 비행 태양광 드론을 설계했다 (완료)" },
          { sub: "Space agencies have", ans: "launched", base: "launch", obj: "advanced quantum satellites into orbit", ko: "우주 기관들은 첨단 양자 위성들을 궤도로 발사했다 (결과)" },
          { sub: "Mathematicians have", ans: "proven", base: "prove", obj: "complex topological theorems recently", ko: "수학자들은 최근 복잡한 위상수학 정리를 증명해 냈다 (완료)" },
          { sub: "Biotech scientists have", ans: "developed", base: "develop", obj: "revolutionary genetic therapies", ko: "생명공학 과학자들은 혁신적인 유전자 치료법을 개발해 왔다 (계속/완료)" }
        ];
        const item = this.pickRandom(items);
        const sentence = `${item.sub} _____ ${item.obj}.`;
        const full = `${item.sub} ${item.ans} ${item.obj}.`;
        const options = this.shuffle([item.ans, item.base, `${item.base}s`, `${item.base}ing`]);
        return {
          category: "LV.5 현재완료 (have + p.p.) [우주 탐사 & 바이오 테크 🌌]",
          sentence, full, ko: item.ko, ans: item.ans, options,
          tip: "과거부터 현재까지의 경험/계속/완료를 나타내는 현재완료는 have/has + 과거분사(p.p.)를 씁니다."
        };
      },
      // 관계대명사 (who vs which)
      () => {
        const items = [
          { ant: "The computer scientist", ans: "who", wrong: "which", rest: "created the neural network won the Turing Award", ko: "인공 신경망을 개발한 그 컴퓨터 과학자는 튜링상을 수상했다", tip: "선행사가 사람(The computer scientist)이므로 주격 관계대명사 'who'를 씁니다." },
          { ant: "The robotics engineer", ans: "who", wrong: "which", rest: "designs humanoid bipedal robots is my role model", ko: "이족 보행 휴머노이드 로봇을 설계하는 로봇 공학자는 나의 롤모델이다", tip: "선행사가 사람(The robotics engineer)이므로 주격 관계대명사 'who'를 씁니다." },
          { ant: "The theoretical mathematician", ans: "who", wrong: "which", rest: "formulated the algorithm solved the calculation crisis", ko: "그 알고리즘을 공식화한 이론 수학자는 계산 위기를 해결했다", tip: "선행사가 사람(The theoretical mathematician)이므로 'who'를 씁니다." },
          { ant: "This is the supercomputer", ans: "which", wrong: "who", rest: "simulates global atmospheric changes accurately", ko: "이것은 지구 대기 변화를 정밀하게 시뮬레이션하는 슈퍼컴퓨터이다", tip: "선행사가 사물(the supercomputer)이므로 사물 관계대명사 'which'를 씁니다." },
          { ant: "We designed an algorithm", ans: "which", wrong: "who", rest: "solves quantum mathematical equations quickly", ko: "우리는 양자 수학 방정식을 신속하게 푸는 알고리즘을 설계했다", tip: "선행사가 사물(an algorithm)이므로 'which'를 씁니다." },
          { ant: "NASA launched a probe", ans: "which", wrong: "who", rest: "gathers mineral samples from distant asteroids", ko: "NASA는 먼 소행성에서 광물 표본을 수집하는 탐사선을 발사했다", tip: "선행사가 사물(a probe)이므로 'which'를 씁니다." }
        ];
        const item = this.pickRandom(items);
        const sentence = `${item.ant} _____ ${item.rest}.`;
        const full = `${item.ant} ${item.ans} ${item.rest}.`;
        const options = this.shuffle([item.ans, item.wrong, "what", "where"]);
        return {
          category: "LV.5 관계대명사 [AI 연구진 & 공학 시스템 🤖]",
          sentence, full, ko: item.ko, ans: item.ans, options, tip: item.tip
        };
      }
    ];
    return this.wrapQuestion(this.pickRandom(templates)(), type, 5);
  }

  // ========================================================
  // 6. [Level 6: 마스터] 고급 어법 (수일치, what vs that, 가정법) (미래 과학 철학 & AI)
  // ========================================================
  genLevel6(type) {
    const templates = [
      // 수능/고급 1순위: 복잡한 주어-동사 수일치
      () => {
        const items = [
          { sub: "The number of parameters in modern AI models", ans: "is", wrong: "are", rest: "increasing exponentially every year", ko: "현대 AI 모델의 파라미터 수는 매년 기하급수적으로 증가하고 있다", tip: "'The number of(~의 수)'가 핵심 주어이므로 단수동사 'is'를 씁니다." },
          { sub: "A number of data scientists", ans: "are", wrong: "is", rest: "researching next-generation quantum neural networks", ko: "많은 데이터 과학자들이 차세대 양자 신경망을 연구하고 있다", tip: "'A number of(많은)'는 복수 취급하므로 복수동사 'are'를 씁니다." },
          { sub: "The development of humanoid robots", ans: "requires", wrong: "require", rest: "precise mathematical calculations and mechanical engineering", ko: "휴머노이드 로봇의 개발은 정밀한 수학적 계산과 기계 공학을 필요로 한다", tip: "주어의 핵은 단수명사 'The development'이므로 단수동사 'requires'가 정답입니다." },
          { sub: "Analyzing massive datasets from particle colliders", ans: "broadens", wrong: "broaden", rest: "our scientific perspectives on the cosmos", ko: "입자 가속기의 거대한 데이터 세트를 분석하는 것은 우주에 대한 우리의 과학적 시야를 넓혀준다", tip: "동명사구(Analyzing ~)가 주어일 때는 단수 취급하므로 'broadens'를 씁니다." },
          { sub: "The integration of renewable energy and smart grids", ans: "demonstrates", wrong: "demonstrate", rest: "innovative sustainable engineering", ko: "재생 에너지와 스마트 그리드의 통합은 혁신적인 지속 가능 공학을 보여준다", tip: "주어의 핵은 단수명사 'The integration'이므로 단수동사 'demonstrates'를 씁니다." }
        ];
        const item = this.pickRandom(items);
        const sentence = `${item.sub} _____ ${item.rest}.`;
        const full = `${item.sub} ${item.ans} ${item.rest}.`;
        const options = this.shuffle([item.ans, item.wrong, "being", "been"]);
        return {
          category: "LV.6 주어-동사 수일치 [빅데이터 & 입자물리 🌌]",
          sentence, full, ko: item.ko, ans: item.ans, options, tip: item.tip
        };
      },
      // 수능/고급 2순위: 관계사 what vs 접속사 that
      () => {
        const items = [
          { lead: "The researcher demonstrated", ans: "what", wrong: "that", rest: "the neural network learned from quantum simulations", ko: "그 연구원은 신경망이 양자 시뮬레이션으로부터 학습한 것을 시연했다", tip: "learned의 목적어가 빠진 불완전한 문장이며 선행사가 없으므로 선행사를 포함한 관계대명사 'what'이 정답입니다." },
          { lead: "Engineers must focus on", ans: "what", wrong: "that", rest: "optimizes energy efficiency in quantum computing", ko: "엔지니어들은 양자 컴퓨팅에서 에너지 효율을 최적화하는 것에 집중해야 한다", tip: "전치사 on의 목적어 자리이며 주어가 없는 불완전한 절이므로 'what'을 씁니다." },
          { lead: "Physicists believe", ans: "that", wrong: "what", rest: "artificial intelligence will accelerate scientific breakthroughs", ko: "물리학자들은 인공지능이 과학적 혁신을 가속화할 것이라 믿는다", tip: "뒤에 완전한 절(주어+동사+목적어)이 이어지므로 명사절 접속사 'that'을 씁니다." },
          { lead: "Computer scientists proved", ans: "that", wrong: "what", rest: "the cryptographic algorithm is mathematically unbreakable", ko: "컴퓨터 과학자들은 그 암호화 알고리즘이 수학적으로 깰 수 없음을 증명했다", tip: "뒤에 문장 필수 성분이 모두 갖추어진 완전한 절이므로 접속사 'that'을 씁니다." },
          { lead: "The aerospace laboratory disclosed", ans: "what", wrong: "that", rest: "autonomous drones recorded during the supersonic flight test", ko: "항공우주 연구소는 자율 드론이 초음속 비행 시험 중 기록한 것을 공개했다", tip: "recorded의 목적어가 비어 있는 불완전한 절이며 선행사가 없으므로 'what'을 씁니다." }
        ];
        const item = this.pickRandom(items);
        const sentence = `${item.lead} _____ ${item.rest}.`;
        const full = `${item.lead} ${item.ans} ${item.rest}.`;
        const options = this.shuffle([item.ans, item.wrong, "which", "how"]);
        return {
          category: "LV.6 that vs what [AI 과학 연구 & 암호학 🔬]",
          sentence, full, ko: item.ko, ans: item.ans, options, tip: item.tip
        };
      },
      // 수능/고급 3순위: 가정법 과거 및 과거완료
      () => {
        const items = [
          { ifClause: "If quantum computers", ans: "were", wrong: "am", main: "commercially available, scientists could simulate complex molecules instantly", ko: "만약 양자 컴퓨터가 상용화된다면, 과학자들은 복잡한 분자 구조를 즉시 시뮬레이션할 텐데", tip: "현재 사실의 반대를 나타내는 가정법 과거에서는 be동사로 인칭에 관계없이 'were'를 씁니다." },
          { ifClause: "If the space rover had detected the anomaly earlier, it", ans: "would have adjusted", wrong: "will adjust", main: "its orbital path automatically", ko: "만약 그 우주 탐사선이 이상 현상을 더 일찍 감지했더라면, 궤도를 자동으로 조정했을 텐데", tip: "과거 사실의 반대를 나타내는 가정법 과거완료 귀결절은 '조동사 과거 + have p.p.'를 씁니다." },
          { ifClause: "If mechanical engineers designed more efficient solid-state batteries, electric planes", ans: "could fly", wrong: "can fly", main: "across entire continents without emissions", ko: "만약 기계 공학자들이 더 효율적인 전고체 배터리를 설계한다면, 전기 비행기가 탄소 배출 없이 대륙을 횡단 비행할 수 있을 텐데", tip: "현재 사실에 대한 가정을 나타내는 가정법 과거 주절은 '조동사 과거형 + 동사원형'을 씁니다." },
          { ifClause: "If the AI model had received unbiased training datasets, it", ans: "would have produced", wrong: "will produce", main: "more reliable mathematical proofs", ko: "만약 그 AI 모델이 편향되지 않은 훈련 데이터세트를 제공받았더라면, 더 신뢰할 수 있는 수학적 증명을 도출했을 텐데", tip: "과거 사실에 대한 가정을 나타내는 가정법 과거완료 귀결절은 '조동사 과거(would) + have p.p.'를 씁니다." }
        ];
        const item = this.pickRandom(items);
        const sentence = `${item.ifClause} _____ ${item.main}.`;
        const full = `${item.ifClause} ${item.ans} ${item.main}.`;
        const options = this.shuffle([item.ans, item.wrong, "was", "would adjust"]);
        return {
          category: "LV.6 가정법 [양자 & 우주 시뮬레이션 ⚛️]",
          sentence, full, ko: item.ko, ans: item.ans, options, tip: item.tip
        };
      }
    ];
    return this.wrapQuestion(this.pickRandom(templates)(), type, 6);
  }

  // 레벨 번호에 따른 생성기 매핑
  getGenFunc(level) {
    const lvl = this.normalizeLevel(level);
    switch (lvl) {
      case 1: return this.genLevel1.bind(this);
      case 2: return this.genLevel2.bind(this);
      case 3: return this.genLevel3.bind(this);
      case 4: return this.genLevel4.bind(this);
      case 5: return this.genLevel5.bind(this);
      case 6: return this.genLevel6.bind(this);
      default: return this.genLevel2.bind(this);
    }
  }

  // 기존 genElemLow 등의 하위 호환성 유지
  genElemLow(type) { return this.genLevel1(type); }
  genElemHigh(type) { return this.genLevel2(type); }
  genMid1(type) { return this.genLevel3(type); }
  genMid2(type) { return this.genLevel4(type); }
  genMid3(type) { return this.genLevel5(type); }
  genHigh(type) { return this.genLevel6(type); }

  // 공통 문제 래퍼
  wrapQuestion(data, type, levelNum) {
    const answerIndex = data.options.indexOf(data.ans);
    const lvl = this.normalizeLevel(levelNum);
    const cfg = this.levelConfigs[lvl] || this.levelConfigs[2];

    return {
      id: `gen-lvl${lvl}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      level: lvl,
      grade: cfg.gradeKey,
      levelLabel: cfg.label,
      levelBadge: cfg.badge,
      type: type, // 'choice', 'speaking', 'listening', 'scramble'
      category: data.category,
      sentence: data.sentence,
      displaySentence: data.sentence,
      audioText: data.full,
      translation: data.ko,
      options: data.options,
      answer: answerIndex,
      answerWord: data.ans,
      missingWord: data.ans,
      hint: `힌트: 정답 단어 (${this.makeHintMask(data.ans)})`,
      acceptableAnswers: [data.ans, `${answerIndex + 1}번`, `${answerIndex + 1}`],
      explanation: data.tip
    };
  }

  // ========================================================
  // AI 적응형(Adaptive) 1세트(10문제) 생성 엔진 (CAT)
  // 학습자의 현재 레벨을 중심으로 도전(상위) 및 복습(하위) 문제를 정교하게 조합
  // ========================================================
  generateSet(count = 10, priorityWrong = [], levelOrGrade = 2) {
    const currentLevel = this.normalizeLevel(levelOrGrade);
    this.currentLevel = currentLevel;

    // 4대 문법 평가 유형 (정답 사전 노출 방지)
    const questionTypes = ['choice', 'choice', 'scramble', 'speaking', 'listening'];
    const generated = [];

    // 1. 오답 복습 우선 포함 (학습자 레벨과 인접한 오답 우선)
    if (priorityWrong && priorityWrong.length > 0) {
      const matchWrong = priorityWrong.filter(w => {
        const wLvl = w.level || this.normalizeLevel(w.grade);
        return Math.abs(wLvl - currentLevel) <= 1;
      });
      matchWrong.slice(0, 3).forEach(mw => generated.push(mw));
    }

    // 2. 적응형 레벨 분포 풀 생성 (10문제 기준: 현재 레벨 60% + 상위 레벨 20% + 하위 레벨 20%)
    const levelDistribution = [];
    let countCurrent = Math.round(count * 0.6);
    let countUpper = Math.round(count * 0.2);
    let countLower = count - countCurrent - countUpper;

    if (currentLevel === 1) {
      countCurrent = Math.round(count * 0.7);
      countUpper = count - countCurrent;
      countLower = 0;
    } else if (currentLevel === 6) {
      countCurrent = Math.round(count * 0.7);
      countLower = count - countCurrent;
      countUpper = 0;
    }

    const upperLevel = Math.min(6, currentLevel + 1);
    const lowerLevel = Math.max(1, currentLevel - 1);

    for (let i = 0; i < countCurrent; i++) levelDistribution.push(currentLevel);
    for (let i = 0; i < countUpper; i++) levelDistribution.push(upperLevel);
    for (let i = 0; i < countLower; i++) levelDistribution.push(lowerLevel);

    const shuffledLevels = this.shuffle(levelDistribution);

    // 3. 문제 유형 풀 생성
    const typePool = [];
    while (typePool.length < count) {
      typePool.push(...this.shuffle(questionTypes));
    }

    // 4. 문제 생성 루프
    let attempts = 0;
    while (generated.length < count && attempts < 80) {
      attempts++;
      const targetLvl = shuffledLevels[generated.length] || currentLevel;
      const qType = typePool[generated.length] || this.pickRandom(questionTypes);
      const genFunc = this.getGenFunc(targetLvl);
      const newQ = genFunc(qType);

      if (!generated.some(g => g.sentence === newQ.sentence)) {
        generated.push(newQ);
      }
    }

    // 초반 1~2문제는 학습자 레벨 또는 하위 레벨로 배치하여 자신감 부여
    generated.sort((a, b) => (a.level || currentLevel) - (b.level || currentLevel));

    return generated.slice(0, count);
  }
}

window.grammarGenerator = new MultiGradeGrammarGenerator();
