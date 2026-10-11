/**
 * apps/face_analy/src/services/hairStyler.ts
 * HTML5 Canvas 기반 가상 헤어스타일 렌더러 & 살롱 스타일링 엔진.
 * 사진 속 인물의 헤어라인과 상단 윤곽에 맞춘 스타일별 텍스처, 컬감, 톤 필터 및 살롱 엠블럼을 합성합니다.
 */

export interface HairStyleOption {
  id: string;
  name: string;
  category: 'TETO' | 'EGEN' | 'ALL';
  desc: string;
  salonPrompt: string;
  colorName: string;
  colorHex: string;
}

export const HAIRSTYLE_PRESETS: HairStyleOption[] = [
  // ── 테토상 추천 (샤프, 시크, T존 강조) ──
  {
    id: 'slick_dandy',
    name: '슬릭 댄디컷',
    category: 'TETO',
    desc: '이마를 살짝 드러내며 정갈하게 떨어지는 시크한 라인으로 도시적인 T존 카리스마를 완성합니다.',
    salonPrompt: '앞머리는 눈썹 선에서 가볍게 시스루 슬릭 연출하고 옆머리는 다운펌으로 단정하게 밀착해주세요.',
    colorName: '애쉬 블랙',
    colorHex: '#1e242b',
  },
  {
    id: 'guile_cut',
    name: '가일 / 아이비리그컷',
    category: 'TETO',
    desc: '한쪽 이마를 시원하게 열어 뚜렷한 눈썹뼈와 콧대를 돋보이게 하는 트렌디한 포멀 스타일.',
    salonPrompt: '7:3 가르마로 한쪽은 포마드로 넘기고 반대편은 자연스럽게 떨어지는 가일 스타일로 커트해주세요.',
    colorName: '미드나잇 다크',
    colorHex: '#181b22',
  },
  {
    id: 'tassel_cut',
    name: '시크 테슬컷 / 스트레이트',
    category: 'TETO',
    desc: '칼각으로 떨어지는 태슬 텍스처로 샤프한 턱선과 페이스라인의 입체감을 극대화합니다.',
    salonPrompt: '질감을 살린 칼단발/스트레이트 라인에 끝선이 뭉치지 않는 슬릭 태슬 질감으로 처리해주세요.',
    colorName: '매트 쿨 브라운',
    colorHex: '#2b2622',
  },

  // ── 에겐상 추천 (부드러움, 러블리, 곡선미) ──
  {
    id: 'soft_asche',
    name: '소프트 애즈펌',
    category: 'EGEN',
    desc: '이마를 부드럽게 감싸는 자연스러운 C컬 볼륨으로 다정하고 온화한 인상을 돋보이게 합니다.',
    salonPrompt: '앞머리 가운데만 살짝 애즈 형태로 벌어지고 전체적으로 굵은 C컬 볼륨펌을 넣어주세요.',
    colorName: '웜 모카 브라운',
    colorHex: '#3b2f27',
  },
  {
    id: 'shadow_volume',
    name: '쉐도우 볼륨펌',
    category: 'EGEN',
    desc: '풍성한 텍스처 컬감이 이마와 얼굴선을 포근하게 감싸주어 동안 매력과 러블리함을 배가합니다.',
    salonPrompt: '모발 전체에 불규칙하면서도 부드러운 쉐도우 S컬 펌으로 볼륨감 있게 연출해주세요.',
    colorName: '밀크 초콜릿 브라운',
    colorHex: '#4a3728',
  },
  {
    id: 'romantic_wave',
    name: '로맨틱 웨이브 & 시스루 뱅',
    category: 'EGEN',
    desc: '부드러운 곡선 웨이브가 양 볼을 감싸주어 순하고 사랑스러운 무드를 완성합니다.',
    salonPrompt: '눈썹을 살짝 덮는 가벼운 시스루 뱅에 굵은 빌드펌/그레이스펌 형태의 곡선 컬을 넣어주세요.',
    colorName: '내추럴 소프트 브라운',
    colorHex: '#3d302a',
  },
];

/**
 * 캔버스에 가상 헤어스타일 및 컬러 필터, 살롱 워터마크를 합성하여 고해상도 Data URL을 반환
 */
export async function renderStyledHair(
  base64Image: string,
  styleId: string
): Promise<string> {
  const selectedStyle =
    HAIRSTYLE_PRESETS.find((s) => s.id === styleId) || HAIRSTYLE_PRESETS[0];

  return new Promise((resolve, reject) => {
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

      // 2. 살롱 조명 & 톤 필터 적용 (스타일 분위기에 따른 틴팅)
      ctx.save();
      if (selectedStyle.category === 'TETO') {
        // 테토: 세련되고 쿨한 콘트라스트 & 비네팅
        const vigGrad = ctx.createRadialGradient(
          width / 2,
          height / 2,
          width * 0.35,
          width / 2,
          height / 2,
          width * 0.75
        );
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, 'rgba(10, 15, 25, 0.35)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, width, height);

        // 쿨톤 틴트
        ctx.fillStyle = 'rgba(30, 41, 59, 0.08)';
        ctx.fillRect(0, 0, width, height);
      } else {
        // 에겐: 화사하고 따뜻한 소프트 글로우 틴팅
        const glowGrad = ctx.createRadialGradient(
          width / 2,
          height * 0.4,
          width * 0.1,
          width / 2,
          height * 0.4,
          width * 0.7
        );
        glowGrad.addColorStop(0, 'rgba(255, 245, 235, 0.12)');
        glowGrad.addColorStop(1, 'rgba(78, 52, 46, 0.15)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.restore();

      // 3. 스타일별 헤어 실루엣 & 텍스처 렌더링 (이마 상단 0 ~ 38% 영역)
      ctx.save();
      drawHairstyleOverlay(ctx, width, height, selectedStyle);
      ctx.restore();

      // 4. 모발 톤 컬러링 (헤어라인 주변 부드러운 컬러 그라데이션)
      ctx.save();
      applyHairToneGrading(ctx, width, height, selectedStyle);
      ctx.restore();

      // 5. 프리미엄 살롱 엠블럼 & 워터마크 카드 (하단)
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
 * 스타일별 정교한 헤어 기하학 및 볼륨 렌더링
 */
function drawHairstyleOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: HairStyleOption
) {
  const hairColor = style.colorHex;

  // 상단 정수리 볼륨 및 헤어라인 기준점
  const crownY = h * 0.02;
  const hairlineY = h * 0.28;
  const leftEarX = w * 0.14;
  const rightEarX = w * 0.86;
  const centerX = w * 0.5;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (style.id === 'slick_dandy') {
    // ── 1. 슬릭 댄디컷: 정갈한 사이드 파팅, 날렵한 질감 ──
    const grad = ctx.createLinearGradient(0, crownY, 0, hairlineY + h * 0.1);
    grad.addColorStop(0, hairColor);
    grad.addColorStop(0.7, 'rgba(20, 24, 30, 0.88)');
    grad.addColorStop(1, 'rgba(20, 24, 30, 0.15)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(leftEarX, hairlineY + h * 0.08);
    // 정수리 볼륨
    ctx.bezierCurveTo(leftEarX - w * 0.04, crownY + h * 0.05, centerX - w * 0.2, crownY, centerX, crownY);
    ctx.bezierCurveTo(centerX + w * 0.2, crownY, rightEarX + w * 0.04, crownY + h * 0.05, rightEarX, hairlineY + h * 0.08);
    // 우측 귀 위 페이드
    ctx.lineTo(rightEarX - w * 0.05, hairlineY + h * 0.02);
    // 슬릭 앞머리 라인 (한쪽으로 자연스럽게 흐르는 댄디 라인)
    ctx.bezierCurveTo(centerX + w * 0.25, hairlineY + h * 0.05, centerX + w * 0.08, hairlineY + h * 0.06, centerX - w * 0.05, hairlineY + h * 0.04);
    ctx.bezierCurveTo(centerX - w * 0.18, hairlineY + h * 0.02, leftEarX + w * 0.05, hairlineY + h * 0.04, leftEarX, hairlineY + h * 0.08);
    ctx.closePath();
    ctx.fill();

    // 슬릭 텍스처 가닥 (광택선)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = Math.max(2, w * 0.005);
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(centerX + i * w * 0.05, crownY + h * 0.04);
      ctx.quadraticCurveTo(centerX + (i + 1) * w * 0.06, hairlineY - h * 0.04, centerX + (i + 2) * w * 0.05, hairlineY + h * 0.03);
      ctx.stroke();
    }
  } else if (style.id === 'guile_cut') {
    // ── 2. 가일 / 아이비리그: 한쪽 이마 시원하게 개방 (T존 극대화) ──
    const grad = ctx.createLinearGradient(0, crownY, 0, hairlineY + h * 0.08);
    grad.addColorStop(0, hairColor);
    grad.addColorStop(0.8, 'rgba(15, 20, 26, 0.92)');
    grad.addColorStop(1, 'rgba(15, 20, 26, 0.1)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(leftEarX, hairlineY + h * 0.05);
    ctx.bezierCurveTo(leftEarX - w * 0.02, crownY + h * 0.03, centerX - w * 0.15, crownY, centerX, crownY);
    ctx.bezierCurveTo(centerX + w * 0.2, crownY, rightEarX + w * 0.02, crownY + h * 0.03, rightEarX, hairlineY + h * 0.05);
    // 가일 우측: 뒤로 시원하게 넘긴 포마드
    ctx.lineTo(rightEarX - w * 0.08, hairlineY - h * 0.02);
    ctx.bezierCurveTo(centerX + w * 0.25, hairlineY - h * 0.03, centerX + w * 0.05, hairlineY - h * 0.01, centerX - w * 0.02, hairlineY + h * 0.04);
    // 가일 좌측: 시크하게 아래로 떨어지는 반 가일 쉼표 라인
    ctx.bezierCurveTo(centerX - w * 0.15, hairlineY + h * 0.08, leftEarX + w * 0.08, hairlineY + h * 0.04, leftEarX, hairlineY + h * 0.05);
    ctx.closePath();
    ctx.fill();

    // 포마드 광택선
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = Math.max(2, w * 0.006);
    ctx.beginPath();
    ctx.moveTo(centerX + w * 0.08, crownY + h * 0.06);
    ctx.quadraticCurveTo(centerX + w * 0.22, crownY + h * 0.1, rightEarX - w * 0.12, hairlineY - h * 0.02);
    ctx.stroke();
  } else if (style.id === 'soft_asche') {
    // ── 3. 소프트 애즈펌: 가운데가 살짝 열린 부드러운 C컬 애즈 ──
    const grad = ctx.createLinearGradient(0, crownY, 0, hairlineY + h * 0.12);
    grad.addColorStop(0, hairColor);
    grad.addColorStop(0.75, 'rgba(40, 28, 22, 0.88)');
    grad.addColorStop(1, 'rgba(40, 28, 22, 0.1)');

    ctx.fillStyle = grad;
    // 좌측 C컬 날개
    ctx.beginPath();
    ctx.moveTo(leftEarX, hairlineY + h * 0.1);
    ctx.bezierCurveTo(leftEarX - w * 0.05, crownY + h * 0.04, centerX - w * 0.25, crownY, centerX, crownY + h * 0.02);
    ctx.bezierCurveTo(centerX - w * 0.05, hairlineY - h * 0.02, centerX - w * 0.08, hairlineY + h * 0.06, centerX - w * 0.02, hairlineY + h * 0.07);
    ctx.bezierCurveTo(centerX - w * 0.15, hairlineY + h * 0.08, leftEarX + w * 0.08, hairlineY + h * 0.06, leftEarX, hairlineY + h * 0.1);
    ctx.closePath();
    ctx.fill();

    // 우측 C컬 날개 (가운데 자연스러운 애즈 틈 형성)
    ctx.beginPath();
    ctx.moveTo(centerX, crownY + h * 0.02);
    ctx.bezierCurveTo(centerX + w * 0.25, crownY, rightEarX + w * 0.05, crownY + h * 0.04, rightEarX, hairlineY + h * 0.1);
    ctx.bezierCurveTo(rightEarX - w * 0.08, hairlineY + h * 0.06, centerX + w * 0.15, hairlineY + h * 0.08, centerX + w * 0.04, hairlineY + h * 0.07);
    ctx.bezierCurveTo(centerX + w * 0.08, hairlineY + h * 0.06, centerX + w * 0.05, hairlineY - h * 0.02, centerX, crownY + h * 0.02);
    ctx.closePath();
    ctx.fill();

    // 부드러운 컬 라인
    ctx.strokeStyle = 'rgba(255, 230, 200, 0.25)';
    ctx.lineWidth = Math.max(2, w * 0.005);
    ctx.beginPath();
    ctx.arc(centerX - w * 0.15, hairlineY + h * 0.02, w * 0.08, 0.2, 1.2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX + w * 0.15, hairlineY + h * 0.02, w * 0.08, 0, 1.1 * Math.PI);
    ctx.stroke();
  } else if (style.id === 'shadow_volume') {
    // ── 4. 쉐도우 볼륨펌: 풍성한 S컬 텍스처와 포근한 앞머리 ──
    const grad = ctx.createLinearGradient(0, crownY, 0, hairlineY + h * 0.14);
    grad.addColorStop(0, hairColor);
    grad.addColorStop(0.8, 'rgba(50, 36, 26, 0.9)');
    grad.addColorStop(1, 'rgba(50, 36, 26, 0.15)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(leftEarX, hairlineY + h * 0.1);
    ctx.bezierCurveTo(leftEarX - w * 0.06, crownY + h * 0.03, centerX - w * 0.25, crownY - h * 0.02, centerX, crownY - h * 0.02);
    ctx.bezierCurveTo(centerX + w * 0.25, crownY - h * 0.02, rightEarX + w * 0.06, crownY + h * 0.03, rightEarX, hairlineY + h * 0.1);
    // 컬감 있는 불규칙한 앞머리 라인
    for (let t = 0; t <= 6; t++) {
      const px = rightEarX - (t / 6) * (rightEarX - leftEarX);
      const py = hairlineY + h * 0.06 + (t % 2 === 0 ? h * 0.03 : h * 0.01);
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // 쉐도우 펌 입체 컬 하이라이트
    ctx.strokeStyle = 'rgba(255, 220, 180, 0.22)';
    ctx.lineWidth = Math.max(2, w * 0.006);
    for (let c = 0; c < 5; c++) {
      ctx.beginPath();
      const cx = leftEarX + (c + 0.5) * ((rightEarX - leftEarX) / 5);
      ctx.ellipse(cx, hairlineY, w * 0.05, h * 0.03, (c - 2) * 0.15, 0, Math.PI);
      ctx.stroke();
    }
  } else if (style.id === 'tassel_cut') {
    // ── 5. 테슬컷 / 칼단발 ──
    const grad = ctx.createLinearGradient(0, crownY, 0, hairlineY + h * 0.2);
    grad.addColorStop(0, hairColor);
    grad.addColorStop(0.7, 'rgba(25, 25, 28, 0.92)');
    grad.addColorStop(1, 'rgba(25, 25, 28, 0.1)');

    ctx.fillStyle = grad;
    // 정수리부터 양옆 볼을 타고 직선으로 떨어지는 실루엣
    ctx.beginPath();
    ctx.moveTo(leftEarX - w * 0.04, hairlineY + h * 0.22);
    ctx.lineTo(leftEarX - w * 0.03, crownY + h * 0.05);
    ctx.bezierCurveTo(centerX - w * 0.2, crownY, centerX + w * 0.2, crownY, rightEarX + w * 0.03, crownY + h * 0.05);
    ctx.lineTo(rightEarX + w * 0.04, hairlineY + h * 0.22);
    ctx.lineTo(rightEarX - w * 0.04, hairlineY + h * 0.2);
    ctx.bezierCurveTo(rightEarX - w * 0.05, hairlineY + h * 0.05, centerX + w * 0.15, hairlineY + h * 0.04, centerX, hairlineY + h * 0.04);
    ctx.bezierCurveTo(centerX - w * 0.15, hairlineY + h * 0.04, leftEarX + w * 0.05, hairlineY + h * 0.05, leftEarX + w * 0.04, hairlineY + h * 0.2);
    ctx.closePath();
    ctx.fill();
  } else {
    // ── 6. 로맨틱 웨이브 / 시스루 뱅 ──
    const grad = ctx.createLinearGradient(0, crownY, 0, hairlineY + h * 0.2);
    grad.addColorStop(0, hairColor);
    grad.addColorStop(0.7, 'rgba(45, 32, 28, 0.88)');
    grad.addColorStop(1, 'rgba(45, 32, 28, 0.1)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(leftEarX - w * 0.05, hairlineY + h * 0.25);
    ctx.bezierCurveTo(leftEarX - w * 0.08, crownY + h * 0.05, centerX - w * 0.2, crownY, centerX, crownY);
    ctx.bezierCurveTo(centerX + w * 0.2, crownY, rightEarX + w * 0.08, crownY + h * 0.05, rightEarX + w * 0.05, hairlineY + h * 0.25);
    // 부드러운 S라인 웨이브 측면
    ctx.bezierCurveTo(rightEarX - w * 0.02, hairlineY + h * 0.15, centerX + w * 0.2, hairlineY + h * 0.06, centerX, hairlineY + h * 0.05);
    ctx.bezierCurveTo(centerX - w * 0.2, hairlineY + h * 0.06, leftEarX + w * 0.02, hairlineY + h * 0.15, leftEarX - w * 0.05, hairlineY + h * 0.25);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * 모발 톤 컬러 그라데이션 적용
 */
function applyHairToneGrading(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: HairStyleOption
) {
  // 상단 헤어라인 부위에 미세한 톤 필터 적용
  const tintGrad = ctx.createLinearGradient(0, 0, 0, h * 0.35);
  tintGrad.addColorStop(0, style.colorHex);
  tintGrad.addColorStop(0.6, 'rgba(0,0,0,0.15)');
  tintGrad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = tintGrad;
  ctx.fillRect(0, 0, w, h * 0.4);
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * 캔버스 하단 고급 살롱 엠블럼 워터마크 카드
 */
function drawSalonEmblem(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: HairStyleOption
) {
  const cardHeight = Math.max(50, Math.round(h * 0.1));
  const cardY = h - cardHeight;

  // 반투명 그라데이션 배경 바
  const barGrad = ctx.createLinearGradient(0, cardY, 0, h);
  barGrad.addColorStop(0, 'rgba(15, 23, 42, 0)');
  barGrad.addColorStop(0.35, 'rgba(15, 23, 42, 0.75)');
  barGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, cardY, w, cardHeight);

  // 살롱 로고 & 스타일 텍스트
  const paddingX = Math.round(w * 0.05);
  const textY1 = cardY + cardHeight * 0.55;
  const textY2 = cardY + cardHeight * 0.85;

  ctx.textAlign = 'left';

  // 1. 헤어스타일 명칭
  const fontSize1 = Math.max(14, Math.round(w * 0.038));
  ctx.font = `bold ${fontSize1}px Pretendard, system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`✂️ ${style.name} (${style.colorName})`, paddingX, textY1);

  // 2. 살롱 태그
  const fontSize2 = Math.max(10, Math.round(w * 0.024));
  ctx.font = `${fontSize2}px Pretendard, system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = style.category === 'TETO' ? '#818cf8' : '#34d399';
  ctx.fillText(
    `MQ SALON AI STYLED • ${style.category === 'TETO' ? '테토 맞춤 슬릭 실루엣' : '에겐 맞춤 볼륨 실루엣'}`,
    paddingX,
    textY2
  );

  // 우측 상단 워터마크 태그
  ctx.textAlign = 'right';
  ctx.font = `bold ${Math.max(9, Math.round(w * 0.022))}px sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText('VIRTUAL FITTING', w - paddingX, textY2);
}
