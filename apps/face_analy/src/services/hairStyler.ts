/**
 * apps/face_analy/src/services/hairStyler.ts
 * HTML5 Canvas 기반 가상 토탈 메이크오버 스튜디오 (헤어 피팅 + 퍼스널 메이크업 컨트롤러).
 * 두상 크기/위치 조절, 모발 텍스처 페더링, 립 틴트, 치크 블러셔, 피부 톤업, 눈매 음영을 실시간 합성합니다.
 */

export interface HairFittingParams {
  offsetY: number; // 상하 위치 조절 (-30 ~ +30, 기본값: -10)
  scaleX: number;  // 너비/두상 크기 조절 (0.5 ~ 1.3, 기본값: 0.76)
  scaleY: number;  // 기장/길이 조절 (0.5 ~ 1.3, 기본값: 0.76)
  opacity: number; // 모발 투명도/농도 (0.4 ~ 1.0, 기본값: 0.88)
}

export const DEFAULT_FITTING_PARAMS: HairFittingParams = {
  offsetY: -10,
  scaleX: 0.76,
  scaleY: 0.76,
  opacity: 0.88,
};

export interface MakeupParams {
  skinTone: number;       // 0 ~ 100 (피부결 정돈 & 톤업 필터)
  lipColor: 'coral' | 'rose' | 'red' | 'nude' | 'none'; // 립 틴트 컬러
  lipIntensity: number;   // 0 ~ 100 (립 발색 농도)
  blusherColor: 'peach' | 'pink' | 'contour' | 'none';  // 치크 블러셔 컬러
  blusherIntensity: number; // 0 ~ 100 (치크 생기 농도)
  eyeShading: number;     // 0 ~ 100 (눈매 음영 깊이)
}

export const DEFAULT_MAKEUP_TETO: MakeupParams = {
  skinTone: 45,
  lipColor: 'rose',
  lipIntensity: 65,
  blusherColor: 'contour',
  blusherIntensity: 45,
  eyeShading: 60,
};

export const DEFAULT_MAKEUP_EGEN: MakeupParams = {
  skinTone: 55,
  lipColor: 'coral',
  lipIntensity: 70,
  blusherColor: 'peach',
  blusherIntensity: 60,
  eyeShading: 30,
};

export interface FaceBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface LandmarkPoint {
  x: number;
  y: number;
}

export interface FaceLandmarks {
  crown: LandmarkPoint;
  hairline: LandmarkPoint;
  leftEye: LandmarkPoint;
  rightEye: LandmarkPoint;
  noseTip?: LandmarkPoint;
  mouthCenter: LandmarkPoint;
  chin?: LandmarkPoint;
  leftCheek?: LandmarkPoint;
  rightCheek?: LandmarkPoint;
}

export interface MakeoverConfig {
  styleId: string;
  customHairColor?: string;
  fittingParams?: HairFittingParams;
  makeupParams?: MakeupParams;
  faceBox?: FaceBox;
  landmarks?: FaceLandmarks;
}

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
 * 캔버스에 가상 토탈 메이크오버 (피부 보정, 메이크업, 헤어스타일, 살롱 워터마크) 렌더링
 */
export async function renderTotalMakeover(
  base64Image: string,
  config: MakeoverConfig
): Promise<string> {
  const selectedStyle =
    HAIRSTYLE_PRESETS.find((s) => s.id === config.styleId) || HAIRSTYLE_PRESETS[0];

  const fitParams: HairFittingParams = {
    ...DEFAULT_FITTING_PARAMS,
    ...(config.fittingParams || {}),
  };

  const makeup: MakeupParams = {
    ...(selectedStyle.category === 'TETO' ? DEFAULT_MAKEUP_TETO : DEFAULT_MAKEUP_EGEN),
    ...(config.makeupParams || {}),
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

      // 2. 가상 메이크업 1단계: 피부 톤업 및 결 정돈
      if (makeup.skinTone > 0) {
        ctx.save();
        applySkinToneFilter(ctx, width, height, makeup.skinTone, selectedStyle.category, config.faceBox);
        ctx.restore();
      }

      // 3. 가상 메이크업 2단계: 아이섀도우 / 눈매 음영
      if (makeup.eyeShading > 0) {
        ctx.save();
        applyEyeContour(ctx, width, height, makeup.eyeShading, selectedStyle.category, config.landmarks);
        ctx.restore();
      }

      // 4. 가상 메이크업 3단계: 치크 블러셔
      if (makeup.blusherColor !== 'none' && makeup.blusherIntensity > 0) {
        ctx.save();
        applyBlusher(ctx, width, height, makeup.blusherColor, makeup.blusherIntensity, config.landmarks, config.faceBox);
        ctx.restore();
      }

      // 5. 가상 메이크업 4단계: 립 틴트 메이크업
      if (makeup.lipColor !== 'none' && makeup.lipIntensity > 0) {
        ctx.save();
        applyLipTint(ctx, width, height, makeup.lipColor, makeup.lipIntensity, config.landmarks, config.faceBox);
        ctx.restore();
      }

      // 6. 살롱 조명 & 부드러운 분위기 필터
      ctx.save();
      applySalonLighting(ctx, width, height, selectedStyle);
      ctx.restore();

      // 7. 모발 텍스처 렌더링 (파라미터 기반 크기, 위치, 소프트 페더링 적용)
      ctx.save();
      const hairColor = config.customHairColor || selectedStyle.colorHex;
      drawNaturalHairstyle(ctx, width, height, selectedStyle, fitParams, hairColor, config.landmarks, config.faceBox);
      ctx.restore();

      // 8. 프리미엄 살롱 엠블럼 & 워터마크 카드 (하단)
      drawSalonEmblem(ctx, width, height, selectedStyle, makeup);

      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };

    img.onerror = (e) => {
      console.error('Failed to load image for total makeover rendering:', e);
      resolve(base64Image);
    };

    img.src = base64Image;
  });
}

/**
 * 하위 호환용 래퍼 함수
 */
export async function renderStyledHair(
  base64Image: string,
  styleId: string,
  customParams?: Partial<HairFittingParams>
): Promise<string> {
  return renderTotalMakeover(base64Image, {
    styleId,
    fittingParams: customParams ? { ...DEFAULT_FITTING_PARAMS, ...customParams } : undefined,
  });
}

// ─── 💄 메이크업 레이어 렌더링 함수들 ──────────────────────────────

/**
 * 1. 피부 톤업 및 소프트 스킨 결 정돈 필터
 */
function applySkinToneFilter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  intensity: number,
  category: 'TETO' | 'EGEN' | 'ALL',
  faceBox?: FaceBox
) {
  const alpha = (intensity / 100) * 0.35;
  const cx = faceBox ? ((faceBox.left + faceBox.right) / 200) * w : w * 0.5;
  const cy = faceBox ? ((faceBox.top + faceBox.bottom) / 200) * h : h * 0.52;
  const rx = faceBox ? Math.max(30, ((faceBox.right - faceBox.left) / 200) * w * 1.05) : w * 0.38;
  const ry = faceBox ? Math.max(30, ((faceBox.bottom - faceBox.top) / 200) * h * 1.05) : h * 0.38;

  // 얼굴 중심 타원형 화사한 톤업 글로우
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const glow = ctx.createRadialGradient(cx, cy, rx * 0.3, cx, cy, rx * 1.15);
  if (category === 'TETO') {
    glow.addColorStop(0, `rgba(255, 250, 245, ${alpha * 1.2})`);
    glow.addColorStop(1, 'rgba(230, 235, 245, 0)');
  } else {
    glow.addColorStop(0, `rgba(255, 240, 235, ${alpha * 1.3})`);
    glow.addColorStop(1, 'rgba(255, 230, 220, 0)');
  }
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // 매끄러운 피부결을 위한 미세 소프트 블러 오버레이
  ctx.globalCompositeOperation = 'lighter';
  const softGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  softGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.22})`);
  softGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = softGrad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * 2. 아이섀도우 & 눈매 음영 컨투어링 (검출된 눈 좌표 기반)
 */
function applyEyeContour(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  intensity: number,
  category: 'TETO' | 'EGEN' | 'ALL',
  landmarks?: FaceLandmarks
) {
  const alpha = (intensity / 100) * 0.32;
  const leftEyeX = landmarks?.leftEye?.x != null ? (landmarks.leftEye.x / 100) * w : w * 0.37;
  const leftEyeY = landmarks?.leftEye?.y != null ? (landmarks.leftEye.y / 100) * h : h * 0.44;
  const rightEyeX = landmarks?.rightEye?.x != null ? (landmarks.rightEye.x / 100) * w : w * 0.63;
  const rightEyeY = landmarks?.rightEye?.y != null ? (landmarks.rightEye.y / 100) * h : h * 0.44;

  const eyeDist = Math.hypot(rightEyeX - leftEyeX, rightEyeY - leftEyeY);
  const eyeRadius = Math.max(12, eyeDist * 0.36);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';

  const shadeColor = category === 'TETO' ? 'rgba(75, 55, 50, ' : 'rgba(100, 65, 55, ';

  // 좌측 눈매 음영
  const leftGrad = ctx.createRadialGradient(leftEyeX, leftEyeY, eyeRadius * 0.2, leftEyeX, leftEyeY, eyeRadius);
  leftGrad.addColorStop(0, `${shadeColor}${alpha})`);
  leftGrad.addColorStop(0.7, `${shadeColor}${alpha * 0.4})`);
  leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = leftGrad;
  ctx.beginPath();
  ctx.ellipse(leftEyeX, leftEyeY, eyeRadius, eyeRadius * 0.55, -0.05, 0, Math.PI * 2);
  ctx.fill();

  // 우측 눈매 음영
  const rightGrad = ctx.createRadialGradient(rightEyeX, rightEyeY, eyeRadius * 0.2, rightEyeX, rightEyeY, eyeRadius);
  rightGrad.addColorStop(0, `${shadeColor}${alpha})`);
  rightGrad.addColorStop(0.7, `${shadeColor}${alpha * 0.4})`);
  rightGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rightGrad;
  ctx.beginPath();
  ctx.ellipse(rightEyeX, rightEyeY, eyeRadius, eyeRadius * 0.55, 0.05, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * 3. 양 볼 치크 블러셔 (검출된 양 볼 좌표 기반)
 */
function applyBlusher(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colorType: 'peach' | 'pink' | 'contour' | 'none',
  intensity: number,
  landmarks?: FaceLandmarks,
  faceBox?: FaceBox
) {
  const alpha = (intensity / 100) * 0.42;
  const leftCheekX = landmarks?.leftCheek?.x != null ? (landmarks.leftCheek.x / 100) * w : w * 0.33;
  const leftCheekY = landmarks?.leftCheek?.y != null ? (landmarks.leftCheek.y / 100) * h : h * 0.54;
  const rightCheekX = landmarks?.rightCheek?.x != null ? (landmarks.rightCheek.x / 100) * w : w * 0.67;
  const rightCheekY = landmarks?.rightCheek?.y != null ? (landmarks.rightCheek.y / 100) * h : h * 0.54;

  const faceW = faceBox ? ((faceBox.right - faceBox.left) / 100) * w : w * 0.68;
  const cheekRadius = Math.max(20, faceW * 0.21);

  let rgb = '255, 145, 115'; // peach
  if (colorType === 'pink') rgb = '255, 120, 160';
  if (colorType === 'contour') rgb = '165, 110, 85';

  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';

  // 좌측 볼 치크
  const leftGrad = ctx.createRadialGradient(leftCheekX, leftCheekY, cheekRadius * 0.1, leftCheekX, leftCheekY, cheekRadius);
  leftGrad.addColorStop(0, `rgba(${rgb}, ${alpha * 1.2})`);
  leftGrad.addColorStop(0.7, `rgba(${rgb}, ${alpha * 0.4})`);
  leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = leftGrad;
  ctx.beginPath();
  ctx.ellipse(leftCheekX, leftCheekY, cheekRadius, cheekRadius * 0.68, 0.12, 0, Math.PI * 2);
  ctx.fill();

  // 우측 볼 치크
  const rightGrad = ctx.createRadialGradient(rightCheekX, rightCheekY, cheekRadius * 0.1, rightCheekX, rightCheekY, cheekRadius);
  rightGrad.addColorStop(0, `rgba(${rgb}, ${alpha * 1.2})`);
  rightGrad.addColorStop(0.7, `rgba(${rgb}, ${alpha * 0.4})`);
  rightGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rightGrad;
  ctx.beginPath();
  ctx.ellipse(rightCheekX, rightCheekY, cheekRadius, cheekRadius * 0.68, -0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * 4. 입술 립 틴트 메이크업 (검출된 입술 중심 좌표 기반)
 */
function applyLipTint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colorType: 'coral' | 'rose' | 'red' | 'nude' | 'none',
  intensity: number,
  landmarks?: FaceLandmarks,
  faceBox?: FaceBox
) {
  const alpha = (intensity / 100) * 0.55;
  const mouthX = landmarks?.mouthCenter?.x != null ? (landmarks.mouthCenter.x / 100) * w : w * 0.5;
  const mouthY = landmarks?.mouthCenter?.y != null ? (landmarks.mouthCenter.y / 100) * h : h * 0.71;

  const faceW = faceBox ? ((faceBox.right - faceBox.left) / 100) * w : w * 0.68;
  const lipWidth = Math.max(16, faceW * 0.22);
  const lipHeight = Math.max(8, lipWidth * 0.38);

  let rgb = '245, 105, 95'; // coral
  if (colorType === 'rose') rgb = '205, 65, 95';
  if (colorType === 'red') rgb = '220, 38, 38';
  if (colorType === 'nude') rgb = '195, 125, 105';

  ctx.save();
  // 입술 형태에 맞춘 타원형 그라데이션 틴팅
  ctx.globalCompositeOperation = 'color';
  const lipGrad = ctx.createRadialGradient(mouthX, mouthY, lipWidth * 0.15, mouthX, mouthY, lipWidth);
  lipGrad.addColorStop(0, `rgba(${rgb}, ${alpha * 1.3})`);
  lipGrad.addColorStop(0.65, `rgba(${rgb}, ${alpha * 0.65})`);
  lipGrad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = lipGrad;
  ctx.beginPath();
  ctx.ellipse(mouthX, mouthY, lipWidth, lipHeight, 0, 0, Math.PI * 2);
  ctx.fill();

  // 입술 중앙 생기 글로우 하이라이트
  ctx.globalCompositeOperation = 'soft-light';
  const glowGrad = ctx.createRadialGradient(mouthX, mouthY, 2, mouthX, mouthY, lipWidth * 0.7);
  glowGrad.addColorStop(0, `rgba(${rgb}, ${alpha * 0.9})`);
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.ellipse(mouthX, mouthY, lipWidth * 0.75, lipHeight * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── 💇 헤어스타일 렌더링 함수들 ──────────────────────────────

/**
 * 살롱 조명 & 비네팅 효과
 */
function applySalonLighting(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: HairStyleOption
) {
  if (style.category === 'TETO') {
    const vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.4, w / 2, h / 2, w * 0.85);
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vigGrad.addColorStop(1, 'rgba(15, 23, 42, 0.22)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, w, h);
  } else {
    const glowGrad = ctx.createRadialGradient(w / 2, h * 0.35, w * 0.15, w / 2, h * 0.35, w * 0.75);
    glowGrad.addColorStop(0, 'rgba(255, 248, 240, 0.08)');
    glowGrad.addColorStop(1, 'rgba(60, 40, 30, 0.14)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);
  }
}

/**
 * 자연스러운 모발 렌더링 (검출된 두상/헤어라인/정수리 좌표 기반)
 */
function drawNaturalHairstyle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: HairStyleOption,
  params: HairFittingParams,
  hairColor: string,
  landmarks?: FaceLandmarks,
  faceBox?: FaceBox
) {
  const { offsetY, scaleX, scaleY, opacity } = params;

  const faceW = faceBox ? ((faceBox.right - faceBox.left) / 100) * w : w * 0.68;
  const faceH = faceBox ? ((faceBox.bottom - faceBox.top) / 100) * h : h * 0.65;

  const detectedCx = landmarks?.hairline?.x != null
    ? (landmarks.hairline.x / 100) * w
    : faceBox
    ? ((faceBox.left + faceBox.right) / 200) * w
    : w * 0.5;

  const detectedHairlineY = landmarks?.hairline?.y != null
    ? (landmarks.hairline.y / 100) * h
    : faceBox
    ? (faceBox.top / 100) * h + faceH * 0.15
    : h * 0.22;

  const baseHairlineY = detectedHairlineY + (offsetY / 100) * h;

  const detectedCrownY = landmarks?.crown?.y != null
    ? (landmarks.crown.y / 100) * h
    : Math.max(0, detectedHairlineY - faceH * 0.32);

  const domeHeight = Math.max(25, (baseHairlineY - detectedCrownY) * scaleY);
  const crownY = Math.max(0, baseHairlineY - domeHeight);

  const halfWidth = (faceW * 0.54) * scaleX;
  const cx = detectedCx;

  ctx.globalAlpha = Math.min(1, Math.max(0.3, opacity));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. 정수리 & 사이드 볼륨 베이스 (소프트 그라데이션)
  ctx.save();
  const baseGrad = ctx.createRadialGradient(
    cx,
    crownY + (baseHairlineY - crownY) * 0.4,
    halfWidth * 0.2,
    cx,
    crownY + (baseHairlineY - crownY) * 0.4,
    halfWidth * 1.15
  );
  baseGrad.addColorStop(0, hairColor);
  baseGrad.addColorStop(0.7, hexToRgba(hairColor, 0.82));
  baseGrad.addColorStop(0.95, hexToRgba(hairColor, 0.3));
  baseGrad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = baseGrad;
  ctx.beginPath();
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

  // 2. 스타일별 정교한 앞머리 텍스처
  ctx.save();
  if (style.id === 'slick_dandy') {
    renderSlickDandyBangs(ctx, cx, baseHairlineY, crownY, halfWidth, hairColor, scaleY);
  } else if (style.id === 'guile_cut') {
    renderGuileBangs(ctx, cx, baseHairlineY, crownY, halfWidth, hairColor, scaleY);
  } else if (style.id === 'soft_asche') {
    renderSoftAscheBangs(ctx, cx, baseHairlineY, crownY, halfWidth, hairColor, scaleY);
  } else if (style.id === 'shadow_volume') {
    renderShadowVolumeBangs(ctx, cx, baseHairlineY, crownY, halfWidth, hairColor, scaleY);
  } else if (style.id === 'tassel_cut') {
    renderTasselCutBangs(ctx, cx, baseHairlineY, crownY, halfWidth, hairColor, scaleY);
  } else {
    renderRomanticWaveBangs(ctx, cx, baseHairlineY, crownY, halfWidth, hairColor, scaleY);
  }
  ctx.restore();

  // 3. 은은한 모발 스트랜드 하이라이트
  renderHairHighlights(ctx, cx, crownY, baseHairlineY, halfWidth, hairColor);
}

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

  ctx.fillStyle = hexToRgba(color, 0.65);
  ctx.beginPath();
  ctx.ellipse(cx - hw * 0.85, baseY, hw * 0.22, bangLength * 1.1, 0.15, 0, Math.PI * 2);
  ctx.ellipse(cx + hw * 0.85, baseY, hw * 0.22, bangLength * 1.1, -0.15, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < numStrands; i++) {
    const t = (i / numStrands) * 2 - 1;
    const sx = cx + t * hw * 0.72;
    const sy = baseY - bangLength * 0.25;
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
    ctx.quadraticCurveTo(sx + hw * 0.05, sy + bangLength * 0.5, ex, ey);
    ctx.stroke();
  }

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
    ctx.quadraticCurveTo(sx - hw * 0.05, sy + bangLength * 0.5, ex, ey);
    ctx.stroke();
  }
}

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

  for (let i = -2; i <= 2; i++) {
    const yOffset = crownY + (baseY - crownY) * 0.35 + i * 6;
    ctx.beginPath();
    ctx.arc(cx, yOffset, hw * 0.65, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 캔버스 하단 워터마크 카드
 */
function drawSalonEmblem(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: HairStyleOption,
  makeup?: MakeupParams
) {
  const cardHeight = Math.max(46, Math.round(h * 0.09));
  const cardY = h - cardHeight;

  const barGrad = ctx.createLinearGradient(0, cardY, 0, h);
  barGrad.addColorStop(0, 'rgba(15, 23, 42, 0)');
  barGrad.addColorStop(0.4, 'rgba(15, 23, 42, 0.78)');
  barGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, cardY, w, cardHeight);

  const paddingX = Math.round(w * 0.05);
  const textY1 = cardY + cardHeight * 0.52;
  const textY2 = cardY + cardHeight * 0.84;

  ctx.textAlign = 'left';

  const fontSize1 = Math.max(13, Math.round(w * 0.036));
  ctx.font = `bold ${fontSize1}px Pretendard, system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`✂️ ${style.name} (${style.colorName})`, paddingX, textY1);

  const fontSize2 = Math.max(10, Math.round(w * 0.023));
  ctx.font = `${fontSize2}px Pretendard, system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = style.category === 'TETO' ? '#818cf8' : '#34d399';
  
  const makeupDesc = makeup && makeup.lipColor !== 'none' 
    ? `+ 퍼스널 립/치크 메이크업 (${makeup.lipColor})` 
    : '가상 살롱 피팅';
  ctx.fillText(`MQ TOTAL MAKEOVER • ${makeupDesc}`, paddingX, textY2);

  ctx.textAlign = 'right';
  ctx.font = `bold ${Math.max(9, Math.round(w * 0.021))}px sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillText('AI MAKEOVER STUDIO', w - paddingX, textY2);
}

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
