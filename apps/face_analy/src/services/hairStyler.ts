/**
 * apps/face_analy/src/services/hairStyler.ts
 * HTML5 Canvas 기반 가상 헤어스타일 렌더러 & 살롱 스타일링 엔진.
 * 두상 크기와 이마 높이에 맞춘 실시간 크기/위치 조절(Scale, Offset) 및
 * 부드러운 모발 텍스처(Feathering, Multi-strand, Soft Alpha)를 지원합니다.
 */

export interface HairFittingParams {
  offsetY: number; // 상하 위치 조절 (-30 ~ +30, 기본값: -6)
  scaleX: number;  // 너비/두상 크기 조절 (0.5 ~ 1.3, 기본값: 0.8)
  scaleY: number;  // 기장/길이 조절 (0.5 ~ 1.3, 기본값: 0.8)
  opacity: number; // 모발 투명도/농도 (0.4 ~ 1.0, 기본값: 0.85)
}

export const DEFAULT_FITTING_PARAMS: HairFittingParams = {
  offsetY: -6,
  scaleX: 0.82,
  scaleY: 0.82,
  opacity: 0.88,
};

export interface HairStyleOption {
  id: string;
  name: string;
  category: 'TETO' | 'EGEN' | 'ALL';
  desc: string;
  salonPrompt: string;
  colorName: string;
  colorHex: string;
  difficulty: '★☆☆' | '★★☆' | '★★★';
  hairLength: string;
  suitableFace: string;
}

export const HAIRSTYLE_PRESETS: HairStyleOption[] = [
  // ── 테토상 추천 (샤프, 시크, T존 강조) ──
  {
    id: 'slick_dandy',
    name: '슬릭 댄디컷',
    category: 'TETO',
    desc: '이마를 살짝 드러내며 가볍게 떨어지는 시스루 슬릭 라인으로 도시적인 T존 카리스마를 완성합니다.',
    salonPrompt: '앞머리는 눈썹 선에서 가볍게 질감 처리하고, 옆머리는 9mm 다운펌으로 깔끔하게 밀착해주세요.',
    colorName: '애쉬 블랙',
    colorHex: '#1e242b',
    difficulty: '★☆☆',
    hairLength: '눈썹 선 (미디엄 숏)',
    suitableFace: '달걀형, 샤프한 역삼각형, 각진 페이스라인',
  },
  {
    id: 'guile_cut',
    name: '가일 / 아이비리그컷',
    category: 'TETO',
    desc: '한쪽 이마를 시원하게 열어 뚜렷한 눈썹뼈와 콧대를 돋보이게 하는 트렌디한 포멀 스타일.',
    salonPrompt: '7:3 가르마로 한쪽은 포마드로 단정하게 넘기고 반대편은 자연스럽게 떨어지는 가일 스타일로 커트해주세요.',
    colorName: '미드나잇 다크',
    colorHex: '#181b22',
    difficulty: '★★☆',
    hairLength: '눈썹 위 2cm (숏)',
    suitableFace: '직선적 턱선, 또렷한 이목구비, 둥근형 보완',
  },
  {
    id: 'tassel_cut',
    name: '시크 테슬컷 / 스트레이트',
    category: 'TETO',
    desc: '칼각으로 떨어지는 태슬 텍스처로 샤프한 턱선과 페이스라인의 입체감을 극대화합니다.',
    salonPrompt: '끝선이 뭉치지 않는 슬릭 태슬 질감 처리와 볼륨매직으로 차분하고 곧게 떨어지게 해주세요.',
    colorName: '매트 쿨 브라운',
    colorHex: '#2b2622',
    difficulty: '★☆☆',
    hairLength: '턱선 ~ 쇄골 선 (단발/미디엄)',
    suitableFace: 'V라인, 세련된 하관, 계란형',
  },

  // ── 에겐상 추천 (부드러움, 러블리, 곡선미) ──
  {
    id: 'soft_asche',
    name: '소프트 애즈펌',
    category: 'EGEN',
    desc: '이마를 부드럽게 감싸는 자연스러운 C컬 볼륨으로 다정하고 온화한 인상을 돋보이게 합니다.',
    salonPrompt: '앞머리 미간 중앙만 살짝 애즈 형태로 벌어지고, 전체적으로 굵은 자연스러운 C컬 볼륨펌을 넣어주세요.',
    colorName: '웜 모카 브라운',
    colorHex: '#382a20',
    difficulty: '★☆☆',
    hairLength: '눈썹 덮는 기장 (미디엄)',
    suitableFace: '둥근형, 볼살이 있는 동안형, 부드러운 인상',
  },
  {
    id: 'shadow_volume',
    name: '쉐도우 볼륨펌',
    category: 'EGEN',
    desc: '풍성한 텍스처 컬감이 이마와 얼굴선을 포근하게 감싸주어 동안 매력과 러블리함을 배가합니다.',
    salonPrompt: '모발 전체에 불규칙하면서도 부드러운 쉐도우 S컬 펌으로 볼륨감 있게 텍스처를 살려주세요.',
    colorName: '밀크 초콜릿 브라운',
    colorHex: '#453324',
    difficulty: '★★☆',
    hairLength: '눈썹 선 ~ 눈 아래 (미디엄)',
    suitableFace: '둥근형, 이마가 넓은 편, 부드러운 윤곽',
  },
  {
    id: 'romantic_wave',
    name: '로맨틱 웨이브 & 시스루 뱅',
    category: 'EGEN',
    desc: '부드러운 곡선 웨이브가 양 볼을 감싸주어 순하고 사랑스러운 무드를 완성합니다.',
    salonPrompt: '눈썹을 가볍게 스치는 시스루 뱅에 굵은 빌드펌/그레이스펌 형태의 자연스러운 S컬을 넣어주세요.',
    colorName: '내추럴 소프트 브라운',
    colorHex: '#3a2d24',
    difficulty: '★★☆',
    hairLength: '어깨선 아래 롱 기장',
    suitableFace: '달걀형, 둥근형, 러블리한 동안',
  },
];

/**
 * 캔버스에 가상 헤어스타일 및 컬러 필터, 살롱 워터마크를 합성하여 고해상도 Data URL을 반환
 */
export async function renderStyledHair(
  base64Image: string,
  styleId: string,
  customParams?: Partial<HairFittingParams>
): Promise<string> {
  const selectedStyle =
    HAIRSTYLE_PRESETS.find((s) => s.id === styleId) || HAIRSTYLE_PRESETS[0];

  const params: HairFittingParams = {
    ...DEFAULT_FITTING_PARAMS,
    ...(customParams || {}),
  };

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const width = img.naturalWidth || img.width || 600;
      const height = img.naturalHeight || img.height || 600;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Image);
        return;
      }

      // 1. 원본 사진 렌더링
      ctx.drawImage(img, 0, 0, width, height);

      // 2. 살롱 조명 & 부드러운 분위기 필터 (자연스러운 틴팅)
      ctx.save();
      applySalonLighting(ctx, width, height, selectedStyle);
      ctx.restore();

      // 3. 모발 텍스처 렌더링 (파라미터 기반 크기, 위치, 소프트 페더링 적용)
      ctx.save();
      drawNaturalHairstyle(ctx, width, height, selectedStyle, params);
      ctx.restore();

      // 4. 프리미엄 살롱 엠블럼 & 워터마크 카드 (하단)
      drawSalonEmblem(ctx, width, height, selectedStyle);

      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };

    img.onerror = (e) => {
      console.error('Failed to load image for hair rendering:', e);
      resolve(base64Image);
    };

    img.src = base64Image;
  });
}

/**
 * 살롱 조명 & 비네팅 효과 (자연스러운 톤 매칭)
 */
function applySalonLighting(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: HairStyleOption
) {
  if (style.category === 'TETO') {
    // 테토: 세련되고 쿨한 콘트라스트 & 소프트 비네팅
    const vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.4, w / 2, h / 2, w * 0.85);
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vigGrad.addColorStop(1, 'rgba(15, 23, 42, 0.28)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, w, h);
  } else {
    // 에겐: 화사하고 따뜻한 소프트 글로우 틴팅
    const glowGrad = ctx.createRadialGradient(w / 2, h * 0.35, w * 0.15, w / 2, h * 0.35, w * 0.75);
    glowGrad.addColorStop(0, 'rgba(255, 248, 240, 0.08)');
    glowGrad.addColorStop(1, 'rgba(60, 40, 30, 0.18)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);
  }
}

/**
 * 자연스러운 모발 렌더링 (하드한 단색 폴리곤 제거, 부드러운 페더링 및 레이어드 스트랜드 적용)
 */
function drawNaturalHairstyle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: HairStyleOption,
  params: HairFittingParams
) {
  const { offsetY, scaleX, scaleY, opacity } = params;

  // 기준 중심점 (얼굴 중앙 상단)
  const cx = w * 0.5;
  // 기본 헤어라인 높이 (이마 상단 기준) + 사용자 Y 오프셋 반영
  const baseHairlineY = h * 0.22 + (offsetY / 100) * h;
  const crownY = Math.max(0, baseHairlineY - h * 0.20 * scaleY);

  // 두상 너비 (scaleX 반영)
  const halfWidth = w * 0.34 * scaleX;
  const leftX = cx - halfWidth;
  const rightX = cx + halfWidth;

  ctx.globalAlpha = Math.min(1, Math.max(0.3, opacity));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ── 1. 정수리 & 사이드 볼륨 베이스 (소프트 그라데이션) ──
  ctx.save();
  const baseGrad = ctx.createRadialGradient(
    cx,
    crownY + (baseHairlineY - crownY) * 0.4,
    halfWidth * 0.2,
    cx,
    crownY + (baseHairlineY - crownY) * 0.4,
    halfWidth * 1.15
  );
  baseGrad.addColorStop(0, style.colorHex);
  baseGrad.addColorStop(0.7, hexToRgba(style.colorHex, 0.82));
  baseGrad.addColorStop(0.95, hexToRgba(style.colorHex, 0.3));
  baseGrad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  // 정수리 둥근 볼륨 돔
  ctx.ellipse(
    cx,
    (crownY + baseHairlineY) * 0.5,
    halfWidth * 1.05,
    (baseHairlineY - crownY) * 0.75,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  // ── 2. 스타일별 정교한 앞머리 텍스처 & 가닥 렌더링 ──
  ctx.save();
  if (style.id === 'slick_dandy') {
    renderSlickDandyBangs(ctx, cx, baseHairlineY, crownY, halfWidth, style.colorHex, scaleY);
  } else if (style.id === 'guile_cut') {
    renderGuileBangs(ctx, cx, baseHairlineY, crownY, halfWidth, style.colorHex, scaleY);
  } else if (style.id === 'soft_asche') {
    renderSoftAscheBangs(ctx, cx, baseHairlineY, crownY, halfWidth, style.colorHex, scaleY);
  } else if (style.id === 'shadow_volume') {
    renderShadowVolumeBangs(ctx, cx, baseHairlineY, crownY, halfWidth, style.colorHex, scaleY);
  } else if (style.id === 'tassel_cut') {
    renderTasselCutBangs(ctx, cx, baseHairlineY, crownY, halfWidth, style.colorHex, scaleY);
  } else {
    renderRomanticWaveBangs(ctx, cx, baseHairlineY, crownY, halfWidth, style.colorHex, scaleY);
  }
  ctx.restore();

  // ── 3. 자연스러운 모발 스트랜드 및 하이라이트 레이어 ──
  renderHairHighlights(ctx, cx, crownY, baseHairlineY, halfWidth, style.colorHex);
}

/**
 * 1. 슬릭 댄디컷: 가볍게 한쪽으로 흐르는 시스루 슬릭 질감
 */
function renderSlickDandyBangs(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  crownY: number,
  hw: number,
  color: string,
  scaleY: number
) {
  const bangLength = (baseY - crownY) * 0.38 * scaleY;
  const numStrands = 28;

  // 사이드 헤어 다운펌 밀착 라인
  ctx.fillStyle = hexToRgba(color, 0.65);
  ctx.beginPath();
  ctx.ellipse(cx - hw * 0.85, baseY, hw * 0.22, bangLength * 1.1, 0.15, 0, Math.PI * 2);
  ctx.ellipse(cx + hw * 0.85, baseY, hw * 0.22, bangLength * 1.1, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // 슬릭 앞머리 스트랜드 (시스루하게 이마가 자연스럽게 비침)
  for (let i = 0; i < numStrands; i++) {
    const t = (i / numStrands) * 2 - 1; // -1 to 1
    const sx = cx + t * hw * 0.72;
    const sy = baseY - bangLength * 0.25;

    // 약간 좌측/우측으로 흐르는 곡선
    const endX = sx + hw * 0.08 * (t > 0 ? 1 : 0.6);
    const endY = baseY + bangLength * (0.8 + 0.2 * Math.sin(i));

    const grad = ctx.createLinearGradient(sx, sy, endX, endY);
    grad.addColorStop(0, hexToRgba(color, 0.85));
    grad.addColorStop(0.75, hexToRgba(color, 0.6));
    grad.addColorStop(1, hexToRgba(color, 0));

    ctx.strokeStyle = grad;
    ctx.lineWidth = 3 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + hw * 0.04, sy + bangLength * 0.5, endX, endY);
    ctx.stroke();
  }
}

/**
 * 2. 가일컷 / 아이비리그: 한쪽 이마 시원하게 개방 (포마드 넘김)
 */
function renderGuileBangs(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  crownY: number,
  hw: number,
  color: string,
  scaleY: number
) {
  const bangLength = (baseY - crownY) * 0.35 * scaleY;

  // 우측: 시원하게 뒤로 넘긴 포마드 (이마 시원하게 노출)
  for (let i = 0; i < 18; i++) {
    const sx = cx + (i / 18) * hw * 0.75;
    const sy = baseY - bangLength * 0.2;
    const ex = sx + hw * 0.12;
    const ey = baseY - bangLength * 0.1 + (i % 3) * 2;

    ctx.strokeStyle = hexToRgba(color, 0.75);
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + hw * 0.06, sy - 10, ex, ey);
    ctx.stroke();
  }

  // 좌측: 세련된 쉼표/가일 앞머리 곡선
  for (let i = 0; i < 16; i++) {
    const sx = cx - (i / 16) * hw * 0.65;
    const sy = baseY - bangLength * 0.1;
    const ex = sx + hw * 0.06;
    const ey = baseY + bangLength * 0.85;

    const grad = ctx.createLinearGradient(sx, sy, ex, ey);
    grad.addColorStop(0, hexToRgba(color, 0.85));
    grad.addColorStop(0.8, hexToRgba(color, 0.5));
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 3 + (i % 2);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx - hw * 0.05, sy + bangLength * 0.5, ex, ey);
    ctx.stroke();
  }
}

/**
 * 3. 소프트 애즈펌: 가운데가 자연스럽게 열린 부드러운 C컬
 */
function renderSoftAscheBangs(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  crownY: number,
  hw: number,
  color: string,
  scaleY: number
) {
  const bangLength = (baseY - crownY) * 0.42 * scaleY;
  const numStrands = 24;

  // 좌측 C컬 날개 (중앙에서 바깥으로 둥글게 C컬)
  for (let i = 2; i < numStrands / 2; i++) {
    const t = i / (numStrands / 2);
    const sx = cx - t * hw * 0.65;
    const sy = baseY - bangLength * 0.2;
    const ex = sx - hw * 0.06;
    const ey = baseY + bangLength * (0.8 + 0.15 * Math.sin(i));

    const grad = ctx.createLinearGradient(sx, sy, ex, ey);
    grad.addColorStop(0, hexToRgba(color, 0.85));
    grad.addColorStop(0.7, hexToRgba(color, 0.6));
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 3.5 + (i % 2);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    // C컬 곡선
    ctx.quadraticCurveTo(sx + hw * 0.05, sy + bangLength * 0.5, ex, ey);
    ctx.stroke();
  }

  // 우측 C컬 날개 (중앙 애즈 틈 확보 후 바깥으로 C컬)
  for (let i = 2; i < numStrands / 2; i++) {
    const t = i / (numStrands / 2);
    const sx = cx + t * hw * 0.65;
    const sy = baseY - bangLength * 0.2;
    const ex = sx + hw * 0.06;
    const ey = baseY + bangLength * (0.8 + 0.15 * Math.cos(i));

    const grad = ctx.createLinearGradient(sx, sy, ex, ey);
    grad.addColorStop(0, hexToRgba(color, 0.85));
    grad.addColorStop(0.7, hexToRgba(color, 0.6));
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 3.5 + (i % 2);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    // C컬 곡선
    ctx.quadraticCurveTo(sx - hw * 0.05, sy + bangLength * 0.5, ex, ey);
    ctx.stroke();
  }
}

/**
 * 4. 쉐도우 볼륨펌: 풍성하고 불규칙한 S컬 텍스처
 */
function renderShadowVolumeBangs(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  crownY: number,
  hw: number,
  color: string,
  scaleY: number
) {
  const bangLength = (baseY - crownY) * 0.44 * scaleY;
  const numStrands = 32;

  for (let i = 0; i < numStrands; i++) {
    const t = (i / numStrands) * 2 - 1;
    const sx = cx + t * hw * 0.75;
    const sy = baseY - bangLength * 0.3;

    // S컬 지그재그 곡선
    const cp1x = sx + (i % 2 === 0 ? 8 : -8);
    const cp1y = sy + bangLength * 0.35;
    const cp2x = sx - (i % 2 === 0 ? 8 : -8);
    const cp2y = sy + bangLength * 0.7;
    const ex = sx + (i % 3 === 0 ? 6 : -6);
    const ey = baseY + bangLength * (0.8 + 0.18 * Math.sin(i * 1.5));

    const grad = ctx.createLinearGradient(sx, sy, ex, ey);
    grad.addColorStop(0, hexToRgba(color, 0.82));
    grad.addColorStop(0.75, hexToRgba(color, 0.55));
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey);
    ctx.stroke();
  }
}

/**
 * 5. 테슬컷 / 스트레이트: 매끄럽고 곧게 떨어지는 라인
 */
function renderTasselCutBangs(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  crownY: number,
  hw: number,
  color: string,
  scaleY: number
) {
  const sideLength = (baseY - crownY) * 0.95 * scaleY;

  // 양옆 뺨을 타고 일자로 곧게 떨어지는 태슬 가닥
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 12; i++) {
      const sx = cx + s * (hw * 0.72 + i * 2.5);
      const sy = baseY - (baseY - crownY) * 0.1;
      const ex = sx;
      const ey = baseY + sideLength * (0.85 + 0.1 * (i % 3));

      const grad = ctx.createLinearGradient(sx, sy, ex, ey);
      grad.addColorStop(0, hexToRgba(color, 0.85));
      grad.addColorStop(0.85, hexToRgba(color, 0.6));
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  }
}

/**
 * 6. 로맨틱 웨이브 & 시스루 뱅: 가벼운 앞머리와 흐르는 볼륨
 */
function renderRomanticWaveBangs(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  crownY: number,
  hw: number,
  color: string,
  scaleY: number
) {
  const bangLength = (baseY - crownY) * 0.36 * scaleY;

  // 가벼운 시스루 앞머리 (가닥 사이 간격을 넓혀 투명하게)
  for (let i = 0; i < 14; i++) {
    const t = (i / 14) * 2 - 1;
    const sx = cx + t * hw * 0.45;
    const sy = baseY - bangLength * 0.2;
    const ex = sx + (t * 6);
    const ey = baseY + bangLength * (0.85 + 0.1 * (i % 2));

    const grad = ctx.createLinearGradient(sx, sy, ex, ey);
    grad.addColorStop(0, hexToRgba(color, 0.75));
    grad.addColorStop(0.8, hexToRgba(color, 0.45));
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx, sy + bangLength * 0.5, ex, ey);
    ctx.stroke();
  }

  // 양옆 S라인 웨이브
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 10; i++) {
      const sx = cx + s * (hw * 0.75 + i * 3);
      const sy = baseY;
      const ex = sx + s * 14;
      const ey = baseY + (baseY - crownY) * 0.8 * scaleY;

      ctx.strokeStyle = hexToRgba(color, 0.55);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(sx + s * 18, sy + 30, sx - s * 10, ey - 30, ex, ey);
      ctx.stroke();
    }
  }
}

/**
 * 은은한 정수리 볼륨 광택 및 하이라이트 레이어
 */
function renderHairHighlights(
  ctx: CanvasRenderingContext2D,
  cx: number,
  crownY: number,
  baseY: number,
  hw: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;

  // 정수리 곡선을 따라 흐르는 자연스러운 빛 반사선
  for (let i = -2; i <= 2; i++) {
    const yOffset = crownY + (baseY - crownY) * 0.35 + i * 6;
    ctx.beginPath();
    ctx.arc(cx, yOffset, hw * 0.65, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 캔버스 하단 살롱 엠블럼 워터마크 카드
 */
function drawSalonEmblem(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: HairStyleOption
) {
  const cardHeight = Math.max(46, Math.round(h * 0.09));
  const cardY = h - cardHeight;

  // 반투명 그라데이션 배경 바
  const barGrad = ctx.createLinearGradient(0, cardY, 0, h);
  barGrad.addColorStop(0, 'rgba(15, 23, 42, 0)');
  barGrad.addColorStop(0.4, 'rgba(15, 23, 42, 0.78)');
  barGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, cardY, w, cardHeight);

  // 살롱 로고 & 스타일 텍스트
  const paddingX = Math.round(w * 0.05);
  const textY1 = cardY + cardHeight * 0.52;
  const textY2 = cardY + cardHeight * 0.84;

  ctx.textAlign = 'left';

  // 1. 헤어스타일 명칭
  const fontSize1 = Math.max(13, Math.round(w * 0.036));
  ctx.font = `bold ${fontSize1}px Pretendard, system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`✂️ ${style.name} (${style.colorName})`, paddingX, textY1);

  // 2. 살롱 태그
  const fontSize2 = Math.max(10, Math.round(w * 0.023));
  ctx.font = `${fontSize2}px Pretendard, system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = style.category === 'TETO' ? '#818cf8' : '#34d399';
  ctx.fillText(
    `MQ SALON AI STYLED • ${style.category === 'TETO' ? '테토 맞춤 슬릭 실루엣' : '에겐 맞춤 볼륨 실루엣'}`,
    paddingX,
    textY2
  );

  // 우측 상단 워터마크 태그
  ctx.textAlign = 'right';
  ctx.font = `bold ${Math.max(9, Math.round(w * 0.021))}px sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillText('VIRTUAL FITTING', w - paddingX, textY2);
}

/**
 * Hex 색상을 rgba 문자열로 변환하는 헬퍼
 */
function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
