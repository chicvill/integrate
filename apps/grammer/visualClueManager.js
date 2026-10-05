// ========================================================
// VisualClueManager - 영문법 상황별 비주얼 일러스트 & 힌트 시스템
// 문장의 핵심 상황, 주어, 동작, 시제를 분석하여 정답 유추를 돕는 고해상도 SVG 일러스트와 단서 태그를 제공합니다.
// ========================================================

class VisualClueManager {
  constructor() {
    this.clueRegistry = this.initRegistry();
  }

  // 상황별 SVG 일러스트 및 메타데이터 레지스트리
  initRegistry() {
    return {
      // 0-1. 인공지능 & 휴머노이드 로봇 (AI, Robot, Humanoid, Sensor)
      'ai_robot': {
        tag: '🤖 인공지능 & 첨단 로봇 (AI Tech)',
        color: '#00f0ff',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <defs>
              <linearGradient id="aiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#00f0ff" />
                <stop offset="100%" stop-color="#7928ca" />
              </linearGradient>
            </defs>
            <circle cx="80" cy="70" r="58" fill="rgba(0, 240, 255, 0.1)" stroke="rgba(0, 240, 255, 0.3)" stroke-width="1.5" stroke-dasharray="4 4" />
            <!-- 로봇 머리 -->
            <rect x="52" y="38" width="56" height="46" rx="10" fill="url(#aiGrad)" />
            <!-- 안테나 -->
            <line x1="80" y1="38" x2="80" y2="24" stroke="#00f0ff" stroke-width="3" />
            <circle cx="80" cy="22" r="5" fill="#ff007f" />
            <!-- 디지털 바이저 / 눈 -->
            <rect x="60" y="50" width="40" height="14" rx="7" fill="#080a16" />
            <circle cx="68" cy="57" r="4" fill="#00ffcc" />
            <circle cx="92" cy="57" r="4" fill="#00ffcc" />
            <!-- 입 그리드 -->
            <line x1="68" y1="74" x2="92" y2="74" stroke="#00f0ff" stroke-width="2" stroke-dasharray="3 2" />
            <!-- 몸통 -->
            <path d="M44 94 C44 88 116 88 116 94 L122 125 L38 125 Z" fill="url(#aiGrad)" opacity="0.9" />
            <circle cx="80" cy="108" r="8" fill="#080a16" stroke="#00ffcc" stroke-width="2" />
          </svg>
        `
      },

      // 0-2. 컴퓨터 코딩 & 알고리즘 (Python, Coding, Algorithm, Software)
      'coding': {
        tag: '💻 알고리즘 & 파이썬 코딩 (Software)',
        color: '#ffc800',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <defs>
              <linearGradient id="codeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffc800" />
                <stop offset="100%" stop-color="#ff007f" />
              </linearGradient>
            </defs>
            <circle cx="80" cy="70" r="58" fill="rgba(255, 200, 0, 0.1)" stroke="rgba(255, 200, 0, 0.3)" stroke-width="1.5" />
            <!-- 노트북 모니터 -->
            <rect x="36" y="32" width="88" height="58" rx="6" fill="#080a16" stroke="url(#codeGrad)" stroke-width="2.5" />
            <!-- 화면 안 코드 기호 -->
            <path d="M52 52 L44 60 L52 68" stroke="#00f0ff" stroke-width="3" fill="none" stroke-linecap="round" />
            <path d="M72 52 L80 60 L72 68" stroke="#00f0ff" stroke-width="3" fill="none" stroke-linecap="round" />
            <line x1="64" y1="50" x2="60" y2="70" stroke="#ff007f" stroke-width="2.5" stroke-linecap="round" />
            <!-- 키보드 베이스 -->
            <path d="M26 92 L134 92 L142 108 L18 108 Z" fill="url(#codeGrad)" />
            <rect x="66" y="96" width="28" height="5" rx="2" fill="#080a16" />
          </svg>
        `
      },

      // 0-3. 우주 과학 & 로켓 탐사 (Rocket, Mars, Rover, Orbit, Space)
      'space': {
        tag: '🚀 우주 탐사 & 화성 탐사선 (Space & Rover)',
        color: '#ff007f',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <defs>
              <linearGradient id="rocketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ff007f" />
                <stop offset="100%" stop-color="#7928ca" />
              </linearGradient>
            </defs>
            <circle cx="80" cy="70" r="58" fill="rgba(255, 0, 127, 0.1)" stroke="rgba(255, 0, 127, 0.3)" stroke-width="1.5" />
            <!-- 로켓 본체 -->
            <path d="M80 22 C94 40 96 74 96 88 L64 88 C64 74 66 40 80 22 Z" fill="url(#rocketGrad)" />
            <!-- 로켓 창문 -->
            <circle cx="80" cy="52" r="9" fill="#080a16" stroke="#00f0ff" stroke-width="2.5" />
            <!-- 날개 -->
            <path d="M64 72 L48 88 L64 88 Z" fill="#ff7700" />
            <path d="M96 72 L112 88 L96 88 Z" fill="#ff7700" />
            <!-- 부스터 불꽃 -->
            <path d="M72 88 Q80 114 80 120 Q80 114 88 88 Z" fill="#ffc800" />
            <path d="M75 88 Q80 106 80 110 Q80 106 85 88 Z" fill="#ff007f" />
          </svg>
        `
      },

      // 0-4. 양자 컴퓨팅 & 수학 (Quantum, Equation, Math, Supercomputer)
      'quantum_math': {
        tag: '⚛️ 양자컴퓨팅 & 수학 방정식 (Quantum Math)',
        color: '#b800ff',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(184, 0, 255, 0.1)" stroke="rgba(184, 0, 255, 0.3)" stroke-width="1.5" />
            <!-- 원자 궤도 타원들 -->
            <ellipse cx="80" cy="70" rx="46" ry="18" fill="none" stroke="#00f0ff" stroke-width="2" transform="rotate(30 80 70)" />
            <ellipse cx="80" cy="70" rx="46" ry="18" fill="none" stroke="#ff007f" stroke-width="2" transform="rotate(-30 80 70)" />
            <ellipse cx="80" cy="70" rx="46" ry="18" fill="none" stroke="#ffc800" stroke-width="2" transform="rotate(90 80 70)" />
            <!-- 원자핵 / 큐비트 코어 -->
            <circle cx="80" cy="70" r="10" fill="#00ffcc" stroke="#080a16" stroke-width="2" />
            <!-- 전자 큐비트들 -->
            <circle cx="44" cy="50" r="4.5" fill="#ff007f" />
            <circle cx="116" cy="90" r="4.5" fill="#00f0ff" />
          </svg>
        `
      },
      // 1. 두 친구 / 복수 주어 (Tom and Jerry, They are, We are 등)
      'friends': {
        tag: '👥 2명 (복수 주어 ➔ are)',
        color: '#00f0ff',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <defs>
              <linearGradient id="friendGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#00f0ff" />
                <stop offset="100%" stop-color="#0077ff" />
              </linearGradient>
              <linearGradient id="friendGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ff007f" />
                <stop offset="100%" stop-color="#ff7700" />
              </linearGradient>
            </defs>
            <!-- 배경 소프트 원형 글로우 -->
            <circle cx="80" cy="70" r="58" fill="rgba(0, 240, 255, 0.1)" stroke="rgba(0, 240, 255, 0.3)" stroke-width="1.5" stroke-dasharray="4 4" />
            
            <!-- 왼쪽 친구 (톰) -->
            <circle cx="55" cy="50" r="20" fill="url(#friendGrad1)" />
            <path d="M50 48 Q55 54 60 48" stroke="#080a16" stroke-width="2.5" fill="none" stroke-linecap="round" />
            <circle cx="49" cy="42" r="2.5" fill="#080a16" />
            <circle cx="61" cy="42" r="2.5" fill="#080a16" />
            <path d="M35 110 C35 80 75 80 75 110" fill="url(#friendGrad1)" />

            <!-- 오른쪽 친구 (제리) -->
            <circle cx="105" cy="54" r="18" fill="url(#friendGrad2)" />
            <path d="M100 53 Q105 58 110 53" stroke="#080a16" stroke-width="2.5" fill="none" stroke-linecap="round" />
            <circle cx="100" cy="48" r="2.5" fill="#080a16" />
            <circle cx="110" cy="48" r="2.5" fill="#080a16" />
            <path d="M85 110 C85 84 125 84 125 110" fill="url(#friendGrad2)" />

            <!-- 어깨동무 팔 연결선 -->
            <path d="M55 84 Q80 74 105 84" stroke="#ffc800" stroke-width="5" fill="none" stroke-linecap="round" />

            <!-- 반짝이는 우정 하트 & 별 -->
            <path d="M80 30 C76 22 66 26 70 34 C74 40 80 46 80 46 C80 46 86 40 90 34 C94 26 84 22 80 30 Z" fill="#ff007f" />
            <circle cx="30" cy="35" r="3" fill="#ffc800" class="clue-sparkle" />
            <circle cx="130" cy="38" r="3" fill="#00f0ff" class="clue-sparkle" />
          </svg>
        `
      },

      // 2. 음악 듣기 (listen to music, listening, guitar)
      'music': {
        tag: '🎧 음악 감상 (진행형 -ing)',
        color: '#ff007f',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <defs>
              <linearGradient id="musicGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ff007f" />
                <stop offset="100%" stop-color="#7928ca" />
              </linearGradient>
            </defs>
            <circle cx="80" cy="70" r="58" fill="rgba(255, 0, 127, 0.1)" stroke="rgba(255, 0, 127, 0.3)" stroke-width="1.5" />
            
            <!-- 리스너 얼굴 -->
            <circle cx="80" cy="65" r="26" fill="#ffe0bd" />
            <path d="M72 68 Q80 76 88 68" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round" />
            <!-- 감은 눈 (음악에 심취) -->
            <path d="M70 60 Q74 56 78 60" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round" />
            <path d="M82 60 Q86 56 90 60" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round" />

            <!-- 헤드폰 밴드 및 이어컵 -->
            <path d="M50 65 A32 32 0 0 1 110 65" stroke="url(#musicGrad)" stroke-width="7" fill="none" stroke-linecap="round" />
            <rect x="44" y="55" width="12" height="26" rx="6" fill="#00f0ff" />
            <rect x="104" y="55" width="12" height="26" rx="6" fill="#00f0ff" />

            <!-- 생동감 넘치는 음표들 -->
            <path d="M30 40 L30 25 L45 20 L45 35" stroke="#ffc800" stroke-width="3" fill="none" />
            <ellipse cx="26" cy="42" rx="6" ry="4" fill="#ffc800" transform="rotate(-20 26 42)" />
            <ellipse cx="41" cy="37" rx="6" ry="4" fill="#ffc800" transform="rotate(-20 41 37)" />
            
            <path d="M125 35 L125 22 L140 25" stroke="#00f0ff" stroke-width="3" fill="none" />
            <ellipse cx="121" cy="37" rx="6" ry="4" fill="#00f0ff" transform="rotate(-20 121 37)" />

            <!-- 사운드 웨이브 라인 -->
            <path d="M50 105 Q80 120 110 105" stroke="rgba(255, 255, 255, 0.4)" stroke-width="3" fill="none" stroke-dasharray="3 3" />
          </svg>
        `
      },

      // 3. 축구 운동 (play soccer, plays soccer)
      'soccer': {
        tag: '⚽ 축구 경기 (습관/현재형 plays)',
        color: '#00ff88',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <defs>
              <linearGradient id="ballGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="100%" stop-color="#cccccc" />
              </linearGradient>
            </defs>
            <circle cx="80" cy="70" r="58" fill="rgba(0, 255, 136, 0.1)" stroke="rgba(0, 255, 136, 0.3)" stroke-width="1.5" />

            <!-- 축구공 -->
            <g transform="translate(68, 52) scale(1.15)">
              <circle cx="16" cy="16" r="22" fill="url(#ballGrad)" stroke="#111" stroke-width="2" />
              <polygon points="16,8 24,14 21,23 11,23 8,14" fill="#111" />
              <line x1="16" y1="8" x2="16" y2="0" stroke="#111" stroke-width="2" />
              <line x1="24" y1="14" x2="31" y2="12" stroke="#111" stroke-width="2" />
              <line x1="21" y1="23" x2="27" y2="30" stroke="#111" stroke-width="2" />
              <line x1="11" y1="23" x2="5" y2="30" stroke="#111" stroke-width="2" />
              <line x1="8" y1="14" x2="1" y2="12" stroke="#111" stroke-width="2" />
            </g>

            <!-- 스피드 궤적 선 및 잔디 -->
            <path d="M25 88 Q50 82 66 75" stroke="#00ff88" stroke-width="4" stroke-linecap="round" fill="none" />
            <path d="M20 76 Q45 74 62 65" stroke="#ffc800" stroke-width="3" stroke-linecap="round" fill="none" />
            <path d="M30 100 Q55 92 72 85" stroke="#00f0ff" stroke-width="2" stroke-linecap="round" fill="none" />

            <!-- 잔디 필드 라인 -->
            <path d="M20 120 L140 120" stroke="rgba(0, 255, 136, 0.5)" stroke-width="4" stroke-linecap="round" />
            <line x1="40" y1="120" x2="36" y2="112" stroke="#00ff88" stroke-width="3" />
            <line x1="75" y1="120" x2="78" y2="110" stroke="#00ff88" stroke-width="3" />
            <line x1="120" y1="120" x2="124" y2="113" stroke="#00ff88" stroke-width="3" />
          </svg>
        `
      },

      // 4. 영어 선생님 / 학교 (English teacher, student)
      'teacher': {
        tag: '👩‍🏫 선생님 (단수 주어 She is)',
        color: '#ffc800',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(255, 200, 0, 0.1)" stroke="rgba(255, 200, 0, 0.3)" stroke-width="1.5" />

            <!-- 칠판 -->
            <rect x="25" y="25" width="75" height="50" rx="6" fill="#1b382b" stroke="#8b5a2b" stroke-width="4" />
            <text x="35" y="48" font-family="'Orbitron', sans-serif" font-size="13" font-weight="900" fill="#ffc800">ABC</text>
            <text x="35" y="65" font-family="sans-serif" font-size="10" font-weight="bold" fill="#ffffff">English</text>

            <!-- 안경 쓴 선생님 캐릭터 -->
            <g transform="translate(10, 0)">
              <path d="M90 120 C90 92 125 92 125 120" fill="#4a5fc1" />
              <circle cx="108" cy="65" r="18" fill="#ffe0bd" />
              <path d="M90 65 C90 48 126 48 126 65 Q115 52 108 52 Q100 52 90 65" fill="#4a2511" />
              <rect x="98" y="62" width="8" height="6" rx="2" fill="none" stroke="#ffc800" stroke-width="1.5" />
              <rect x="110" y="62" width="8" height="6" rx="2" fill="none" stroke="#ffc800" stroke-width="1.5" />
              <line x1="106" y1="65" x2="110" y2="65" stroke="#ffc800" stroke-width="1.5" />
              <path d="M104 74 Q108 78 112 74" stroke="#c44" stroke-width="2" fill="none" stroke-linecap="round" />
              <line x1="88" y1="85" x2="68" y2="55" stroke="#ffc800" stroke-width="3.5" stroke-linecap="round" />
            </g>
          </svg>
        `
      },

      // 5. 동물원 / 지난 주말 (zoo, last weekend, went)
      'zoo': {
        tag: '🦒 동물원 (과거 시제 went)',
        color: '#ff9900',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(255, 153, 0, 0.1)" stroke="rgba(255, 153, 0, 0.3)" stroke-width="1.5" />

            <!-- 동물원 아치 문 -->
            <path d="M30 115 L30 65 Q80 30 130 65 L130 115" stroke="#ff9900" stroke-width="5" fill="none" />
            <rect x="52" y="42" width="56" height="20" rx="4" fill="#ff9900" />
            <text x="80" y="56" text-anchor="middle" font-family="'Orbitron', sans-serif" font-size="11" font-weight="900" fill="#111">ZOO</text>

            <!-- 기린 실루엣 -->
            <g transform="translate(68, 62)">
              <ellipse cx="20" cy="38" rx="14" ry="10" fill="#f5a623" />
              <line x1="12" y1="46" x2="12" y2="58" stroke="#f5a623" stroke-width="3" />
              <line x1="26" y1="46" x2="26" y2="58" stroke="#f5a623" stroke-width="3" />
              <path d="M28 35 L34 10 L38 8 L38 35" fill="#f5a623" />
              <circle cx="36" cy="8" r="4" fill="#f5a623" />
              <line x1="36" y1="6" x2="35" y2="2" stroke="#d48210" stroke-width="2" />
              <circle cx="18" cy="36" r="2.5" fill="#a45800" />
              <circle cx="24" cy="38" r="2" fill="#a45800" />
              <circle cx="32" cy="22" r="2" fill="#a45800" />
            </g>

            <!-- 달력 마커 (지난 주말 표시) -->
            <g transform="translate(25, 30)">
              <rect x="0" y="0" width="26" height="24" rx="3" fill="#ffffff" stroke="#ff3366" stroke-width="2" />
              <rect x="0" y="0" width="26" height="8" rx="2" fill="#ff3366" />
              <text x="13" y="20" text-anchor="middle" font-size="10" font-weight="900" fill="#111">PAST</text>
            </g>
          </svg>
        `
      },

      // 6. 귀여운 강아지 / 반려동물 소유 (cute puppy, has, have)
      'puppy': {
        tag: '🐶 강아지 (소유 동사 has/have)',
        color: '#ffc800',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(255, 200, 0, 0.1)" stroke="rgba(255, 200, 0, 0.3)" stroke-width="1.5" />

            <g transform="translate(48, 38)">
              <ellipse cx="12" cy="22" rx="10" ry="18" fill="#c68a4c" transform="rotate(-15 12 22)" />
              <ellipse cx="52" cy="22" rx="10" ry="18" fill="#c68a4c" transform="rotate(15 52 22)" />
              <ellipse cx="32" cy="32" rx="26" ry="24" fill="#f3dfc8" />
              <circle cx="22" cy="28" r="4" fill="#222" />
              <circle cx="23" cy="26" r="1.5" fill="#fff" />
              <circle cx="42" cy="28" r="4" fill="#222" />
              <circle cx="43" cy="26" r="1.5" fill="#fff" />
              <ellipse cx="32" cy="37" rx="5" ry="3.5" fill="#222" />
              <path d="M28 42 Q32 46 36 42" stroke="#222" stroke-width="2" fill="none" stroke-linecap="round" />
              <path d="M30 43 Q32 50 34 43" fill="#ff5577" />
              <ellipse cx="18" cy="56" rx="8" ry="6" fill="#f3dfc8" stroke="#c68a4c" stroke-width="1.5" />
              <ellipse cx="46" cy="56" rx="8" ry="6" fill="#f3dfc8" stroke="#c68a4c" stroke-width="1.5" />
            </g>

            <path d="M125 35 C121 28 112 30 115 38 C118 43 125 48 125 48 C125 48 132 43 135 38 C138 30 129 28 125 35 Z" fill="#ff007f" />
          </svg>
        `
      },

      // 7. 매운 음식 / 부정문 (spicy food, doesn't like)
      'spicy': {
        tag: '🌶️ 매운 음식 (부정 조동사 doesn\'t)',
        color: '#ff3366',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(255, 51, 102, 0.1)" stroke="rgba(255, 51, 102, 0.3)" stroke-width="1.5" />

            <g transform="translate(45, 30)">
              <path d="M55 15 C45 35 15 50 10 75 C8 85 20 85 26 78 C42 58 65 40 68 20 Z" fill="#ff2244" />
              <path d="M68 20 Q75 10 65 5 Q62 10 55 15 Z" fill="#2e7d32" />
              <path d="M65 5 Q72 -2 78 2" stroke="#2e7d32" stroke-width="3" fill="none" stroke-linecap="round" />
            </g>

            <path d="M95 35 Q105 25 100 15" stroke="#ff9900" stroke-width="3" fill="none" stroke-linecap="round" />
            <path d="M110 45 Q120 35 115 25" stroke="#ff3366" stroke-width="3" fill="none" stroke-linecap="round" />

            <g transform="translate(100, 75)">
              <circle cx="16" cy="16" r="16" fill="#ff3366" />
              <line x1="8" y1="8" x2="24" y2="24" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
              <line x1="24" y1="8" x2="8" y2="24" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
            </g>
          </svg>
        `
      },

      // 8. 수영 / 조동사 능력 (swim, can swim)
      'swimming': {
        tag: '🏊 수영 능력 (조동사 can + 동사원형)',
        color: '#00f0ff',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(0, 240, 255, 0.1)" stroke="rgba(0, 240, 255, 0.3)" stroke-width="1.5" />

            <circle cx="95" cy="52" r="14" fill="#ffc800" />
            <path d="M90 52 L105 52" stroke="#080a16" stroke-width="4" stroke-linecap="round" />
            <ellipse cx="98" cy="52" rx="4" ry="3" fill="#00f0ff" />
            <path d="M50 72 Q75 60 90 62" stroke="#ffe0bd" stroke-width="10" stroke-linecap="round" fill="none" />
            <path d="M85 62 L125 45" stroke="#ffe0bd" stroke-width="8" stroke-linecap="round" fill="none" />

            <path d="M20 85 Q45 70 70 85 T120 85 T150 85" stroke="#00f0ff" stroke-width="5" fill="none" stroke-linecap="round" />
            <path d="M30 102 Q55 88 80 102 T130 102" stroke="#0088ff" stroke-width="4" fill="none" stroke-linecap="round" />
            <circle cx="120" cy="68" r="3" fill="#ffffff" />
            <circle cx="132" cy="62" r="2" fill="#ffffff" />
          </svg>
        `
      },

      // 9. 만화책 / 책 읽기 (comic book, reading, written)
      'book': {
        tag: '📖 책 읽기 (동명사 reading / 수동태 written)',
        color: '#00d2ff',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(0, 210, 255, 0.1)" stroke="rgba(0, 210, 255, 0.3)" stroke-width="1.5" />

            <g transform="translate(30, 42)">
              <path d="M50 65 C35 55 15 56 0 60 L0 10 C15 6 35 5 50 15 Z" fill="#ffffff" stroke="#00d2ff" stroke-width="2" />
              <path d="M50 65 C65 55 85 56 100 60 L100 10 C85 6 65 5 50 15 Z" fill="#eef8ff" stroke="#00d2ff" stroke-width="2" />
              <line x1="50" y1="15" x2="50" y2="65" stroke="#0077cc" stroke-width="3.5" />

              <line x1="10" y1="22" x2="38" y2="22" stroke="#99badd" stroke-width="2" stroke-linecap="round" />
              <line x1="10" y1="30" x2="40" y2="30" stroke="#99badd" stroke-width="2" stroke-linecap="round" />
              <line x1="10" y1="38" x2="32" y2="38" stroke="#99badd" stroke-width="2" stroke-linecap="round" />
              <line x1="60" y1="22" x2="90" y2="22" stroke="#99badd" stroke-width="2" stroke-linecap="round" />
              <line x1="60" y1="30" x2="88" y2="30" stroke="#99badd" stroke-width="2" stroke-linecap="round" />
              <line x1="60" y1="38" x2="78" y2="38" stroke="#99badd" stroke-width="2" stroke-linecap="round" />
            </g>

            <polygon points="80,18 83,26 91,26 84,31 87,39 80,34 73,39 76,31 69,26 77,26" fill="#ffc800" />
          </svg>
        `
      },

      // 10. 깨진 창문 / 수동태 (broken window, was broken by)
      'window': {
        tag: '🪟 깨진 창문 (수동태 be + p.p. broken)',
        color: '#ff3366',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(255, 51, 102, 0.1)" stroke="rgba(255, 51, 102, 0.3)" stroke-width="1.5" />

            <rect x="35" y="25" width="90" height="90" rx="4" fill="rgba(10, 20, 45, 0.8)" stroke="#8b5a2b" stroke-width="5" />
            <line x1="80" y1="25" x2="80" y2="115" stroke="#8b5a2b" stroke-width="4" />
            <line x1="35" y1="70" x2="125" y2="70" stroke="#8b5a2b" stroke-width="4" />

            <path d="M60 48 L72 62 L65 78 L85 68 L98 52" stroke="#00f0ff" stroke-width="2.5" fill="none" stroke-linecap="round" />
            <path d="M72 62 L88 56 L102 65" stroke="#ffffff" stroke-width="2" fill="none" />
            <polygon points="68,58 74,66 70,72 63,65" fill="rgba(0, 240, 255, 0.3)" />

            <circle cx="55" cy="85" r="12" fill="#ffffff" stroke="#333" stroke-width="1.5" />
            <path d="M48 77 Q55 85 48 93" stroke="#ff3366" stroke-width="1.5" fill="none" />
            <path d="M62 77 Q55 85 62 93" stroke="#ff3366" stroke-width="1.5" fill="none" />
          </svg>
        `
      },

      // 11. 키 비교 / 비교급 (taller than, comparison)
      'height': {
        tag: '📏 키 비교 (~보다 더 큰 taller than)',
        color: '#ffc800',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(255, 200, 0, 0.1)" stroke="rgba(255, 200, 0, 0.3)" stroke-width="1.5" />

            <line x1="30" y1="20" x2="30" y2="120" stroke="#ffc800" stroke-width="3" />
            <line x1="30" y1="30" x2="38" y2="30" stroke="#ffc800" stroke-width="2" />
            <line x1="30" y1="50" x2="42" y2="50" stroke="#ffc800" stroke-width="3" />
            <line x1="30" y1="70" x2="38" y2="70" stroke="#ffc800" stroke-width="2" />
            <line x1="30" y1="90" x2="42" y2="90" stroke="#ffc800" stroke-width="3" />
            <line x1="30" y1="110" x2="38" y2="110" stroke="#ffc800" stroke-width="2" />

            <g transform="translate(50, 20)">
              <circle cx="20" cy="16" r="10" fill="#00f0ff" />
              <rect x="15" y="26" width="10" height="42" rx="4" fill="#00f0ff" />
              <line x1="16" y1="68" x2="14" y2="98" stroke="#00f0ff" stroke-width="4" stroke-linecap="round" />
              <line x1="24" y1="68" x2="26" y2="98" stroke="#00f0ff" stroke-width="4" stroke-linecap="round" />
            </g>

            <g transform="translate(95, 45)">
              <circle cx="18" cy="16" r="10" fill="#ff77aa" />
              <rect x="13" y="26" width="10" height="30" rx="4" fill="#ff77aa" />
              <line x1="14" y1="56" x2="12" y2="73" stroke="#ff77aa" stroke-width="4" stroke-linecap="round" />
              <line x1="22" y1="56" x2="24" y2="73" stroke="#ff77aa" stroke-width="4" stroke-linecap="round" />
            </g>

            <path d="M135 70 L135 35" stroke="#00ff88" stroke-width="4" stroke-linecap="round" fill="none" />
            <polygon points="135,26 128,38 142,38" fill="#00ff88" />
          </svg>
        `
      },

      // 12. 파리 여행 / 완료 시제 (visited Paris, have visited)
      'paris': {
        tag: '🗼 파리 여행 (현재완료 경험 have visited)',
        color: '#ff007f',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(255, 0, 127, 0.1)" stroke="rgba(255, 0, 127, 0.3)" stroke-width="1.5" />

            <g transform="translate(56, 18)">
              <line x1="24" y1="5" x2="24" y2="25" stroke="#ffc800" stroke-width="3" />
              <polygon points="24,5 20,25 28,25" fill="#ffc800" />
              <rect x="14" y="45" width="20" height="5" fill="#ff007f" />
              <path d="M12 50 L0 102 L14 102 L20 78 Q24 70 28 78 L34 102 L48 102 L36 50 Z" fill="#4466aa" stroke="#ff007f" stroke-width="1.5" />
            </g>

            <path d="M18 45 Q30 38 42 45" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round" />
            <polygon points="128,30 142,32 135,36" fill="#00f0ff" />
            <path d="M100 40 Q118 36 128 32" stroke="rgba(0, 240, 255, 0.6)" stroke-width="2" stroke-dasharray="2 3" fill="none" />
          </svg>
        `
      },

      // 13. 피자 식사 / 과거형 (ate pizza, eating dinner)
      'pizza': {
        tag: '🍕 피자 식사 (과거 ate / 진행 eating)',
        color: '#ff9900',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(255, 153, 0, 0.1)" stroke="rgba(255, 153, 0, 0.3)" stroke-width="1.5" />

            <g transform="translate(45, 26)">
              <path d="M5 25 Q35 10 65 25 L35 95 Z" fill="#f5a623" stroke="#c47a16" stroke-width="3" />
              <path d="M9 30 Q35 18 61 30 L35 88 Z" fill="#ffdd55" />
              <circle cx="25" cy="40" r="7" fill="#d0021b" />
              <circle cx="45" cy="45" r="6" fill="#d0021b" />
              <circle cx="35" cy="62" r="5" fill="#d0021b" />
              <circle cx="36" cy="35" r="2.5" fill="#2e7d32" />
              <circle cx="22" cy="55" r="2.5" fill="#222222" />
              <circle cx="46" cy="62" r="2" fill="#2e7d32" />
            </g>

            <g transform="translate(118, 55)">
              <line x1="0" y1="0" x2="0" y2="40" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" />
              <path d="M-5 0 L-5 12 Q0 16 5 12 L5 0" stroke="#ffffff" stroke-width="2" fill="none" />
            </g>
          </svg>
        `
      },

      // 14. 자전거 타기 (ride a bike, bought a new bike)
      'bicycle': {
        tag: '🚲 자전거 타기 (동사원형 ride / 과거 bought)',
        color: '#00ff88',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(0, 255, 136, 0.1)" stroke="rgba(0, 255, 136, 0.3)" stroke-width="1.5" />

            <g transform="translate(25, 45)">
              <circle cx="22" cy="42" r="18" fill="none" stroke="#ffffff" stroke-width="3.5" />
              <circle cx="22" cy="42" r="3" fill="#00ff88" />
              <circle cx="88" cy="42" r="18" fill="none" stroke="#ffffff" stroke-width="3.5" />
              <circle cx="88" cy="42" r="3" fill="#00ff88" />

              <polyline points="22,42 46,42 66,20 38,20 22,42" fill="none" stroke="#00ff88" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
              <line x1="46" y1="42" x2="38" y2="20" stroke="#00ff88" stroke-width="4" />
              <line x1="66" y1="20" x2="88" y2="42" stroke="#00ff88" stroke-width="4" />

              <line x1="33" y1="16" x2="43" y2="16" stroke="#ff3366" stroke-width="5" stroke-linecap="round" />
              <path d="M68 12 L64 20" stroke="#ffc800" stroke-width="4" stroke-linecap="round" />
              <line x1="60" y1="12" x2="72" y2="12" stroke="#ffc800" stroke-width="4" stroke-linecap="round" />
            </g>
          </svg>
        `
      },

      // 15. 거실 TV 시청 (watch TV, watching TV)
      'tv': {
        tag: '📺 TV 시청 (일반동사 watch / 진행 watching)',
        color: '#00f0ff',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(0, 240, 255, 0.1)" stroke="rgba(0, 240, 255, 0.3)" stroke-width="1.5" />

            <line x1="68" y1="40" x2="52" y2="22" stroke="#00f0ff" stroke-width="3" stroke-linecap="round" />
            <line x1="92" y1="40" x2="108" y2="22" stroke="#00f0ff" stroke-width="3" stroke-linecap="round" />

            <rect x="35" y="40" width="90" height="60" rx="8" fill="#182348" stroke="#00f0ff" stroke-width="3.5" />
            <rect x="42" y="46" width="62" height="48" rx="4" fill="rgba(0, 240, 255, 0.25)" />
            <polygon points="65,60 65,80 82,70" fill="#ffffff" />

            <circle cx="114" cy="56" r="4" fill="#ffc800" />
            <circle cx="114" cy="72" r="4" fill="#ff007f" />
            <line x1="50" y1="100" x2="42" y2="114" stroke="#00f0ff" stroke-width="3.5" stroke-linecap="round" />
            <line x1="110" y1="100" x2="118" y2="114" stroke="#00f0ff" stroke-width="3.5" stroke-linecap="round" />
          </svg>
        `
      },

      // 16. 가방 / 소유격 대명사 (his bag, my bag)
      'bag': {
        tag: '🎒 가방 (소유격 대명사 his / my)',
        color: '#ffc800',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(255, 200, 0, 0.1)" stroke="rgba(255, 200, 0, 0.3)" stroke-width="1.5" />

            <path d="M65 42 Q80 26 95 42" stroke="#ff9900" stroke-width="4" fill="none" stroke-linecap="round" />

            <rect x="45" y="42" width="70" height="68" rx="14" fill="#ffc800" stroke="#d48210" stroke-width="3" />
            <rect x="55" y="68" width="50" height="34" rx="8" fill="#ff9900" />
            <line x1="55" y1="74" x2="105" y2="74" stroke="#ffffff" stroke-width="2" />
            <rect x="75" y="52" width="10" height="8" rx="2" fill="#333333" />

            <path d="M22 65 L40 65" stroke="#00f0ff" stroke-width="4" stroke-linecap="round" />
            <polygon points="40,60 48,65 40,70" fill="#00f0ff" />
          </svg>
        `
      },

      // 17. 사과 / 지시대명사 (This is an apple, apple)
      'apple': {
        tag: '🍎 사과 (단수 지시 This is an apple)',
        color: '#ff3366',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(255, 51, 102, 0.1)" stroke="rgba(255, 51, 102, 0.3)" stroke-width="1.5" />

            <path d="M80 45 Q82 28 92 25" stroke="#6d4c41" stroke-width="3.5" fill="none" stroke-linecap="round" />
            <path d="M80 38 Q95 30 102 38 Q95 46 80 38" fill="#4caf50" />

            <g transform="translate(42, 38)">
              <path d="M38 12 C24 12 12 24 12 42 C12 65 30 82 38 82 C46 82 64 65 64 42 C64 24 52 12 38 12 Z" fill="#ff2244" stroke="#d50000" stroke-width="2" />
              <ellipse cx="26" cy="32" rx="5" ry="9" fill="rgba(255, 255, 255, 0.4)" transform="rotate(-25 26 32)" />
            </g>
          </svg>
        `
      },

      // 18. 케이크 / 수동태 (cake was made by)
      'cake': {
        tag: '🎂 케이크 (수동태 was made by)',
        color: '#ff007f',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(255, 0, 127, 0.1)" stroke="rgba(255, 0, 127, 0.3)" stroke-width="1.5" />

            <g transform="translate(35, 45)">
              <rect x="10" y="35" width="70" height="32" rx="6" fill="#f8bbd0" stroke="#ec407a" stroke-width="2.5" />
              <rect x="22" y="16" width="46" height="22" rx="4" fill="#ffffff" stroke="#ec407a" stroke-width="2" />
              <circle cx="28" cy="15" r="4" fill="#ff007f" />
              <circle cx="45" cy="15" r="4" fill="#ff007f" />
              <circle cx="62" cy="15" r="4" fill="#ff007f" />

              <line x1="45" y1="12" x2="45" y2="2" stroke="#00f0ff" stroke-width="2.5" />
              <circle cx="45" cy="0" r="3.5" fill="#ffc800" />
            </g>
          </svg>
        `
      },

      // 19. 생각 / 가정법 (If I were you, would have)
      'hypothetical': {
        tag: '💭 상상/가정법 (If I were in your shoes)',
        color: '#b800ff',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(184, 0, 255, 0.1)" stroke="rgba(184, 0, 255, 0.3)" stroke-width="1.5" />

            <circle cx="50" cy="95" r="16" fill="#ffe0bd" />
            <path d="M30 125 C30 112 70 112 70 125" fill="#3f51b5" />

            <circle cx="62" cy="76" r="4" fill="#ffffff" />
            <circle cx="72" cy="66" r="6" fill="#ffffff" />
            <g transform="translate(70, 18)">
              <ellipse cx="35" cy="28" rx="30" ry="20" fill="#ffffff" stroke="#b800ff" stroke-width="2.5" />
              <text x="35" y="36" text-anchor="middle" font-family="'Orbitron', sans-serif" font-size="20" font-weight="900" fill="#b800ff">IF?</text>
            </g>
          </svg>
        `
      },

      // 20. 영어 말하기 / 대화 (speak English, can speak)
      'speech': {
        tag: '🗣️ 영어 말하기 (조동사 can speak)',
        color: '#00f0ff',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(0, 240, 255, 0.1)" stroke="rgba(0, 240, 255, 0.3)" stroke-width="1.5" />
            <!-- 말하는 사람 옆모습 -->
            <circle cx="55" cy="65" r="22" fill="#ffe0bd" />
            <path d="M68 64 L78 68 L68 74 Z" fill="#ff3366" />
            <circle cx="62" cy="58" r="3" fill="#222" />
            <!-- 말풍선 -->
            <g transform="translate(72, 22)">
              <path d="M5 20 C5 5 60 5 60 25 C60 40 32 40 22 50 L20 40 C5 40 5 32 5 20 Z" fill="#ffffff" stroke="#00f0ff" stroke-width="2.5" />
              <text x="32" y="27" text-anchor="middle" font-family="'Orbitron', sans-serif" font-size="11" font-weight="900" fill="#0077ff">HELLO!</text>
            </g>
          </svg>
        `
      },

      // 21. 기본 공통 영문법 퀘스트 (Generic Quest)
      'generic': {
        tag: '✨ 핵심 영문법 공식 퀘스트',
        color: '#00f0ff',
        svg: `
          <svg viewBox="0 0 160 140" class="clue-svg">
            <circle cx="80" cy="70" r="58" fill="rgba(0, 240, 255, 0.1)" stroke="rgba(0, 240, 255, 0.3)" stroke-width="1.5" />

            <g transform="translate(45, 32)">
              <rect x="10" y="15" width="50" height="60" rx="4" fill="#1b2448" stroke="#00f0ff" stroke-width="2.5" />
              <line x1="20" y1="30" x2="50" y2="30" stroke="#ffc800" stroke-width="3" stroke-linecap="round" />
              <line x1="20" y1="45" x2="45" y2="45" stroke="#00f0ff" stroke-width="3" stroke-linecap="round" />
              <line x1="20" y1="60" x2="40" y2="60" stroke="#ff007f" stroke-width="3" stroke-linecap="round" />

              <path d="M48 20 Q65 5 72 0 Q65 15 52 35 Z" fill="#ffc800" />
              <line x1="52" y1="35" x2="46" y2="44" stroke="#ffc800" stroke-width="2" />
            </g>
            <circle cx="35" cy="40" r="3" fill="#ffc800" class="clue-sparkle" />
            <circle cx="125" cy="45" r="3" fill="#00f0ff" class="clue-sparkle" />
          </svg>
        `
      }
    };
  }

  // 문제의 문장, 카테고리, 힌트 등을 분석하여 가장 적합한 비주얼 단서를 도출
  inferClueKey(question) {
    if (!question) return 'generic';
    
    // 명시적 clueKey가 있으면 최우선 적용
    if (question.clueKey && this.clueRegistry[question.clueKey]) {
      return question.clueKey;
    }

    const sentence = (question.sentence || '').toLowerCase();
    const full = (question.audioText || '').toLowerCase();
    const trans = (question.translation || '').toLowerCase();
    const cat = (question.category || '').toLowerCase();
    const text = `${sentence} ${full} ${trans} ${cat}`;

    // 0-1. 인공지능 & 로봇공학
    if (text.includes('ai') || text.includes('robot') || text.includes('humanoid') || text.includes('인공지능') || text.includes('로봇')) {
      return 'ai_robot';
    }
    // 0-2. 컴퓨터 코딩 & 알고리즘 & 소프트웨어
    if (text.includes('code') || text.includes('coding') || text.includes('python') || text.includes('algorithm') || text.includes('software') || text.includes('알고리즘') || text.includes('프로그래밍') || text.includes('코딩')) {
      return 'coding';
    }
    // 0-3. 우주 탐사 & 화성 & 로켓 & 위성
    if (text.includes('rocket') || text.includes('mars') || text.includes('rover') || text.includes('space') || text.includes('satellite') || text.includes('galaxy') || text.includes('우주') || text.includes('화성') || text.includes('탐사선')) {
      return 'space';
    }
    // 0-4. 양자 컴퓨팅 & 수학 & 슈퍼컴퓨터 & 데이터
    if (text.includes('quantum') || text.includes('equation') || text.includes('math') || text.includes('supercomputer') || text.includes('양자') || text.includes('방정식') || text.includes('수학') || text.includes('데이터')) {
      return 'quantum_math';
    }

    // 1. 친구 / 복수 주어
    if (text.includes('tom and jerry') || text.includes('friends') || text.includes('singers') || text.includes('they are') || text.includes('we are') || text.includes('친구')) {
      return 'friends';
    }
    // 2. 음악 감상 / 기타
    if (text.includes('music') || text.includes('listen') || text.includes('guitar') || text.includes('음악')) {
      return 'music';
    }
    // 3. 축구
    if (text.includes('soccer') || text.includes('football') || text.includes('축구')) {
      return 'soccer';
    }
    // 4. 선생님 / 학생 / 학교
    if (text.includes('teacher') || text.includes('student') || text.includes('school') || text.includes('선생님')) {
      return 'teacher';
    }
    // 5. 동물원 / 지난 주말
    if (text.includes('zoo') || text.includes('weekend') || text.includes('동물원')) {
      return 'zoo';
    }
    // 6. 강아지 / 반려동물
    if (text.includes('puppy') || text.includes('dog') || text.includes('cat') || text.includes('강아지') || text.includes('고양이')) {
      return 'puppy';
    }
    // 7. 매운 음식 / spicy
    if (text.includes('spicy') || text.includes('food') || text.includes('매운')) {
      return 'spicy';
    }
    // 8. 수영 / swim
    if (text.includes('swim') || text.includes('수영')) {
      return 'swimming';
    }
    // 9. 책 / comic book / 만화책
    if (text.includes('comic') || text.includes('book') || text.includes('reading') || text.includes('책')) {
      return 'book';
    }
    // 10. 창문 / 깨진
    if (text.includes('window') || text.includes('broken') || text.includes('창문')) {
      return 'window';
    }
    // 11. 키 비교 / 비교급
    if (text.includes('taller') || text.includes('tall') || text.includes('faster') || text.includes('easier') || text.includes('비교급') || text.includes('더 크')) {
      return 'height';
    }
    // 12. 파리 여행 / 에펠탑
    if (text.includes('paris') || text.includes('visit') || text.includes('파리') || text.includes('여행')) {
      return 'paris';
    }
    // 13. 피자 / 음식
    if (text.includes('pizza') || text.includes('eat') || text.includes('dinner') || text.includes('lunch') || text.includes('피자') || text.includes('저녁')) {
      return 'pizza';
    }
    // 14. 자전거
    if (text.includes('bike') || text.includes('bicycle') || text.includes('자전거')) {
      return 'bicycle';
    }
    // 15. TV 시청
    if (text.includes('tv') || text.includes('watch') || text.includes('텔레비전')) {
      return 'tv';
    }
    // 16. 가방 / 책가방
    if (text.includes('bag') || text.includes('가방')) {
      return 'bag';
    }
    // 17. 사과
    if (text.includes('apple') || text.includes('사과')) {
      return 'apple';
    }
    // 18. 케이크
    if (text.includes('cake') || text.includes('케이크')) {
      return 'cake';
    }
    // 19. 가정법
    if (text.includes('if i') || text.includes('shoes') || text.includes('가정법')) {
      return 'hypothetical';
    }
    // 20. 영어 말하기
    if (text.includes('speak') || text.includes('말할 수') || text.includes('spoken')) {
      return 'speech';
    }

    return 'generic';
  }

  // 주어진 문제 객체에 맞는 힌트 일러스트와 힌트 태그 HTML 생성
  getClueData(question) {
    const key = this.inferClueKey(question);
    const clue = this.clueRegistry[key] || this.clueRegistry['generic'];
    return {
      key: key,
      tag: clue.tag,
      color: clue.color,
      svg: clue.svg
    };
  }

  // DOM에 비주얼 단서 렌더링 (배경 일러스트 워터마크 모드, 하단 텍스트 제거)
  renderInto(containerElement, question) {
    if (!containerElement) return;
    const clue = this.getClueData(question);
    
    containerElement.innerHTML = `
      <div class="visual-clue-bg-art" id="currentVisualClue" style="--clue-theme: ${clue.color};">
        ${clue.svg}
      </div>
    `;
  }

  // 정답 맞혔을 때 축하 애니메이션 트리거
  triggerSuccessReaction() {
    const clueCard = document.getElementById('currentVisualClue');
    if (!clueCard) return;
    clueCard.classList.add('clue-success-pop');
    setTimeout(() => {
      clueCard.classList.remove('clue-success-pop');
    }, 1200);
  }
}

window.visualClueManager = new VisualClueManager();
