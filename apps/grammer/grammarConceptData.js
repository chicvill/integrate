// ========================================================
// GrammarConceptData - 전 학년 핵심 영문법 개념 치트시트 DB
// 문제 풀이 전/후 언제든 열어볼 수 있는 공식, 규칙, 단골 함정, 예문 총정리
// ========================================================

const GRAMMAR_CONCEPT_REGISTRY = {
  // 1. [초등 5~6학년] 현재진행형 (be + -ing)
  'elem-high-progressive': {
    title: '현재진행형 (Present Continuous)',
    gradeBadge: '초등 5~6 필수 [스마트 랩 🔬]',
    formula: '주어 + be동사(am / are / is) + 동사-ing',
    usage: '지금 말하고 있는 이 순간에 일어나는 동작("지금 ~하고 있는 중이다")을 나타냅니다.',
    rules: [
      '대부분의 동사: 동사원형 + -ing (clean ➔ cleaning, code ➔ coding, test ➔ testing)',
      '-e로 끝나는 동사: e를 빼고 + -ing (analyze ➔ analyzing, write ➔ writing, operate ➔ operating)',
      '단모음+단자음 동사: 마지막 자음을 한 번 더 쓰고 + -ing (run ➔ running, scan ➔ scanning, stop ➔ stopping)'
    ],
    trap: {
      wrong: 'The robot cleaning the lab now. (be동사 누락 ❌)',
      correct: 'The robot is cleaning the lab now. (be동사 + -ing ✅)'
    },
    examples: [
      'The robot is cleaning the science lab right now. (그 로봇은 지금 과학 연구실을 청소하고 있다.)',
      'The AI system is analyzing big data in real time. (AI 시스템은 실시간으로 빅데이터를 분석하고 있다.)',
      'We are coding a new space game together. (우리는 함께 새 우주 게임을 코딩하고 있다.)'
    ]
  },

  // 2. [초등 5~6학년] 조동사 can
  'elem-high-modal-can': {
    title: '조동사 can (Modal Verb Can)',
    gradeBadge: '초등 5~6 필수 [미래 컴퓨팅 ⚡]',
    formula: '주어 + can + 동사원형 (Base Form)',
    usage: '~할 수 있다(능력) 또는 ~해도 좋다(허가)를 나타내며, 본동사를 도와주는 역할을 합니다.',
    rules: [
      '조동사 can 바로 뒤에는 언제나 동사의 원래 형태인 "동사원형"만 옵니다.',
      '부정문은 can not (줄여서 can\'t), 의문문은 Can을 주어 앞으로 보냅니다. (Can AI solve ~?)'
    ],
    trap: {
      wrong: 'AI can solves complex equations. (주어가 3인칭 단수여도 -s 금지! ❌)',
      correct: 'AI can solve complex equations. (can 뒤에는 무조건 동사원형! ✅)'
    },
    examples: [
      'AI can solve complex math puzzles very quickly. (AI는 복잡한 수학 퍼즐을 매우 빠르게 풀 수 있다.)',
      'The drone can fly autonomously in the sky. (드론은 하늘을 자율 비행할 수 있다.)',
      'Supercomputers can process huge data at light speed. (슈퍼컴퓨터는 거대한 데이터를 빛의 속도로 처리할 수 있다.)'
    ]
  },

  // 3. [초등 3~4학년] Be동사 기초 (am, are, is)
  'elem-low-be': {
    title: 'Be동사 현재형 (am, are, is)',
    gradeBadge: '초등 3~4 기초 [코딩 & 데이터 💻]',
    formula: '주어의 인칭과 수에 따라 알맞은 Be동사 짝꿍 선택',
    usage: '~이다(신분/상태) 또는 ~에 있다(장소)를 나타냅니다.',
    rules: [
      '1인칭 나 (I) ➔ am',
      '2인칭 너 / 복수 (You, We, They, Python and JavaScript, Robots) ➔ are',
      '3인칭 단수 (He, She, It, This computer, The algorithm, An AI) ➔ is'
    ],
    trap: {
      wrong: 'Python and JavaScript is powerful languages. (2개 복수이므로 단수 is 금지! ❌)',
      correct: 'Python and JavaScript are powerful languages. (2개 복수이므로 are! ✅)'
    },
    examples: [
      'I am a future AI programmer. (나는 미래의 AI 프로그래머이다.)',
      'Python and JavaScript are powerful programming languages. (파이썬과 자바스크립트는 강력한 프로그래밍 언어들이다.)',
      'An AI assistant is very helpful in our science lab. (AI 어시스턴트는 우리 과학 연구실에서 매우 유용하다.)'
    ]
  },

  // 4. [초등 3~4학년] 지시대명사 (This, That, These, Those)
  'elem-low-demonstrative': {
    title: '지시대명사 (This / That / These / Those)',
    gradeBadge: '초등 3~4 기초 [과학 장비 🔬]',
    formula: '가까운 것(단수 This / 복수 These) vs 먼 것(단수 That / 복수 Those)',
    usage: '가까이 있거나 멀리 있는 사물/사람을 가리킬 때 씁니다.',
    rules: [
      '가까운 1개 (This is a microchip ~) vs 가까운 여러 개 (These are solar panels ~)',
      '멀리 있는 1개 (That is a space satellite ~) vs 멀리 있는 여러 개 (Those are quantum computers ~)'
    ],
    trap: {
      wrong: 'These is quantum computers. (복수에는 is 금지! ❌)',
      correct: 'These are quantum computers. (복수 These 뒤에는 are! ✅)'
    },
    examples: [
      'This is a new microchip for smart robots. (이것은 스마트 로봇을 위한 새로운 마이크로칩이다.)',
      'Those are solar panels on the space station. (저것들은 우주 정거장의 태양광 패널들이다.)'
    ]
  },

  // 5. [중학 1학년] 일반동사 3인칭 단수 현재형
  'mid-1-third-person': {
    title: '일반동사 3인칭 단수 현재형 (-s / -es)',
    gradeBadge: '중1 핵심 [알고리즘 📈]',
    formula: '3인칭 단수 주어 (The algorithm / The robot / The space probe) + 동사-s / -es',
    usage: '주어가 나(I), 너(You)가 아닌 제3자 단 1명/단수 사물이고 현재의 규칙적 사실이나 과학적 법칙일 때 동사에 -s/-es를 붙입니다.',
    rules: [
      '대부분: 동사 + -s (calculate ➔ calculates, build ➔ builds)',
      '-s, -sh, -ch, -x, -o, 자음+y로 끝날 때: + -es / -ies (analyze ➔ analyzes, explore ➔ explores)',
      '불규칙 have: have ➔ has (The robot has a sensor)'
    ],
    trap: {
      wrong: 'The smart algorithm analyze big data every second. (단수 주어에 -s 누락 ❌)',
      correct: 'The smart algorithm analyzes big data every second. (3인칭 단수이므로 analyzes! ✅)'
    },
    examples: [
      'The humanoid robot has an advanced optical sensor. (그 휴머노이드 로봇은 첨단 광학 센서를 가지고 있다.)',
      'The developer writes Python code every morning. (그 개발자는 매일 아침 파이썬 코드를 작성한다.)'
    ]
  },

  // 6. [중학 1학년] 불규칙 과거시제
  'mid-1-past': {
    title: '불규칙 과거시제 (Irregular Past Tense)',
    gradeBadge: '중1 핵심 [우주 탐사 🚀]',
    formula: '과거 시간 부사구(yesterday, last year, two days ago) + 과거형 동사',
    usage: '과거에 일어난 과학적 발견이나 역사적 사건을 나타냅니다.',
    rules: [
      '불규칙 동사는 -ed가 붙지 않고 형태가 완전히 바뀝니다.',
      'go ➔ went / see ➔ saw / build ➔ built / write ➔ wrote / find ➔ found / send ➔ sent'
    ],
    trap: {
      wrong: 'The rover goed to Mars last year. (goed라는 단어는 없음! ❌)',
      correct: 'The rover went to Mars last year. (go의 과거형은 went! ✅)'
    },
    examples: [
      'The rover went to Mars last year. (그 탐사선은 작년에 화성에 갔다.)',
      'The astronomer saw a new galaxy yesterday. (그 천문학자는 어제 새로운 은하를 관측했다.)'
    ]
  },

  // 7. [중학 2학년] to부정사 & 동명사 목적어
  'mid-2-gerund': {
    title: '동명사만을 목적어로 취하는 동사',
    gradeBadge: '중2 핵심 [소프트웨어 엔지니어링 💾]',
    formula: 'enjoy, finish, practice, avoid, keep + 동명사(-ing)',
    usage: '특정 동사들은 목적어로 to부정사가 아닌 동명사(-ing)만을 짝꿍으로 둡니다.',
    rules: [
      '동명사(-ing) 목적어: enjoy coding, finish training, practice flying, keep calculating',
      'to부정사 목적어: want to build, plan to launch, decide to research'
    ],
    trap: {
      wrong: 'I enjoy to code Python algorithms. (enjoy 뒤에 to부정사 금지! ❌)',
      correct: 'I enjoy coding Python algorithms. (enjoy 뒤에는 동명사 -ing! ✅)'
    },
    examples: [
      'I enjoy coding Python algorithms every weekend. (나는 주말마다 파이썬 알고리즘 코딩하는 것을 즐긴다.)',
      'The researcher finished training the AI model. (그 연구원은 AI 모델 훈련시키는 것을 끝마쳤다.)'
    ]
  },

  // 8. [중학 2학년] 수동태 (Passive Voice)
  'mid-2-passive': {
    title: '수동태 (be동사 + 과거분사 p.p.)',
    gradeBadge: '중2 핵심 [과학 기술 & 에너지 🛰️]',
    formula: '주어 + be동사(is/was/are/were) + 과거분사(p.p.) + by 행위자',
    usage: '주어가 직접 행동하는 것이 아니라, "~에 의해 발사되다 / 개발되다 / 쓰이다"라는 뜻입니다.',
    rules: [
      '시제에 따라 be동사를 변형: 현재는 is/are, 과거는 was/were',
      '동사는 반드시 3번째 형태인 과거분사(p.p.)를 사용: launch-launched-launched, write-wrote-written'
    ],
    trap: {
      wrong: 'The satellite was launch into orbit. (원형 금지! ❌)',
      correct: 'The satellite was launched into orbit. (과거분사 launched! ✅)'
    },
    examples: [
      'The space satellite was launched into orbit by the rocket. (그 인공위성은 로켓에 의해 궤도로 발사되었다.)',
      'Clean solar energy is used by modern electric cars. (청정 태양광 에너지는 현대 전기차들에 의해 사용된다.)'
    ]
  },

  // 9. [중학 2학년] 비교급
  'mid-2-comparative': {
    title: '형용사의 비교급 (-er than)',
    gradeBadge: '중2 핵심 [컴퓨팅 성능 🚀]',
    formula: '형용사-er (또는 more 형용사) + than (~보다 더 ...한)',
    usage: '컴퓨터의 연산 속도, 행성의 온도 등 두 대상의 성능과 수치를 비교할 때 씁니다.',
    rules: [
      '짧은 단어: 형용사 + -er (fast ➔ faster, smart ➔ smarter, cold ➔ colder)',
      '3음절 이상 단어: more + 형용사 (more powerful, more efficient)',
      '뒤에 반드시 비교 대상 앞의 \'than\'(~보다)이 짝꿍으로 옵니다.'
    ],
    trap: {
      wrong: 'A quantum computer is more fast than a PC. (fast는 1음절이므로 more fast 금지! ❌)',
      correct: 'A quantum computer is faster than a standard PC. (faster than! ✅)'
    },
    examples: [
      'A quantum computer is faster than a standard PC. (양자 컴퓨터는 일반 PC보다 더 빠르다.)',
      'AI is smarter than classical calculator programs. (인공지능은 이전 계산기 프로그램보다 더 똑똑하다.)'
    ]
  },

  // 10. [중학 3학년] 현재완료 시제
  'mid-3-present-perfect': {
    title: '현재완료 시제 (have / has + p.p.)',
    gradeBadge: '중3 심화 [우주 과학사 🌌]',
    formula: '주어 + have / has + 과거분사(p.p.)',
    usage: '과거부터 시작된 연구와 탐사가 현재까지 계속되거나 성과를 남겼을 때 씁니다.',
    rules: [
      '계속 (for ~동안, since ~이래로): have explored Mars for decades (수십 년간 화성을 탐사해 옴)',
      '완료 (already, just): has analyzed millions of images (이미 수백만 장을 분석 완료함)',
      '경험 (ever, never, twice): has launched space probes twice'
    ],
    trap: {
      wrong: 'Scientists have explore deep space for decades. (원형 explore 금지! ❌)',
      correct: 'Scientists have explored deep space for decades. (과거분사 explored! ✅)'
    },
    examples: [
      'Scientists have explored deep space for decades. (과학자들은 수십 년 동안 심우주를 탐사해 오고 있다.)',
      'The AI system has analyzed millions of medical images. (그 AI 시스템은 수백만 장의 의료 영상을 분석해 냈다.)'
    ]
  },

  // 11. [고등 / 수능] 어법
  'high-advanced': {
    title: '수능 실전 어법: 수일치 & 가정법 & 관계사',
    gradeBadge: '고등/수능 실전 [미래 과학 철학 ⚛️]',
    formula: '가정법 과거: If + 주어 + were/과거동사, 주어 + 조동사과거(would/could) + 동사원형',
    usage: '양자 물리학, 인공지능 발전과 같은 미래 가설 및 심층 과학 이론을 서술할 때 쓰입니다.',
    rules: [
      '수일치: The number of ~는 단수 취급 (is/requires), A number of ~는 복수 취급 (are)',
      '가정법 과거: If quantum computers were available, we could simulate ~',
      'that vs what: 뒤에 완전한 절이면 that, 선행사 없고 불완전하면 what'
    ],
    trap: {
      wrong: 'The number of parameters in AI models are increasing. (The number of는 단수! are 금지! ❌)',
      correct: 'The number of parameters in AI models is increasing. (The number of는 단수이므로 is! ✅)'
    },
    examples: [
      'If quantum computers were available everywhere, scientists could simulate complex molecules instantly. (만약 양자 컴퓨터가 상용화된다면 과학자들은 복잡한 분자를 즉시 시뮬레이션할 텐데.)',
      'Physicists believe that artificial intelligence will accelerate scientific breakthroughs. (물리학자들은 인공지능이 과학적 혁신을 가속화할 것이라 믿는다.)'
    ]
  }
};

// 현재 문제 객체를 분석하여 가장 적합한 개념 카드 데이터를 반환하는 헬퍼 함수
function getConceptForQuestion(question) {
  if (!question) return GRAMMAR_CONCEPT_REGISTRY['elem-high-progressive'];

  const cat = (question.category || '').toLowerCase();
  const grade = (question.grade || '').toLowerCase();
  const text = `${cat} ${grade} ${(question.sentence || '')}`.toLowerCase();

  // 1. 초등 5~6 현재진행형
  if (text.includes('진행형') || text.includes('progressive') || text.includes('listening') || text.includes('reading') || text.includes('playing')) {
    return GRAMMAR_CONCEPT_REGISTRY['elem-high-progressive'];
  }
  // 2. 초등 5~6 조동사 can
  if (text.includes('조동사') || text.includes('can') || text.includes('능력')) {
    return GRAMMAR_CONCEPT_REGISTRY['elem-high-modal-can'];
  }
  // 3. 초등 3~4 지시대명사
  if (text.includes('지시대명사') || text.includes('this') || text.includes('these') || text.includes('that') || text.includes('those')) {
    return GRAMMAR_CONCEPT_REGISTRY['elem-low-demonstrative'];
  }
  // 4. 초등 3~4 Be동사
  if (grade === 'elem-low' || text.includes('초등 3~4 be동사')) {
    return GRAMMAR_CONCEPT_REGISTRY['elem-low-be'];
  }
  // 5. 중1 일반동사 3인칭 단수
  if (text.includes('3인칭') || text.includes('일반동사 현재형') || text.includes('plays') || text.includes('watches')) {
    return GRAMMAR_CONCEPT_REGISTRY['mid-1-third-person'];
  }
  // 6. 중1 과거시제
  if (text.includes('과거') || text.includes('past') || text.includes('went') || text.includes('saw') || text.includes('bought')) {
    return GRAMMAR_CONCEPT_REGISTRY['mid-1-past'];
  }
  // 7. 중2 동명사 / to부정사
  if (text.includes('동명사') || text.includes('to부정사') || text.includes('enjoy')) {
    return GRAMMAR_CONCEPT_REGISTRY['mid-2-gerund'];
  }
  // 8. 중2 수동태
  if (text.includes('수동태') || text.includes('passive') || text.includes('broken') || text.includes('written')) {
    return GRAMMAR_CONCEPT_REGISTRY['mid-2-passive'];
  }
  // 9. 중2 비교급
  if (text.includes('비교급') || text.includes('taller') || text.includes('than')) {
    return GRAMMAR_CONCEPT_REGISTRY['mid-2-comparative'];
  }
  // 10. 중3 현재완료
  if (text.includes('현재완료') || text.includes('lived') || text.includes('visited')) {
    return GRAMMAR_CONCEPT_REGISTRY['mid-3-present-perfect'];
  }
  // 11. 고등
  if (grade === 'high' || text.includes('가정법') || text.includes('what vs that')) {
    return GRAMMAR_CONCEPT_REGISTRY['high-advanced'];
  }

  // 기본 매칭: Be동사 현재형
  return GRAMMAR_CONCEPT_REGISTRY['elem-low-be'];
}

window.grammarConceptData = {
  registry: GRAMMAR_CONCEPT_REGISTRY,
  getConceptForQuestion: getConceptForQuestion
};
