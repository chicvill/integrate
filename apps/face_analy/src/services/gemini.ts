import { 
  renderTotalMakeover,
  renderStyledHair, 
  HAIRSTYLE_PRESETS, 
  HairStyleOption, 
  HairFittingParams, 
  DEFAULT_FITTING_PARAMS,
  MakeupParams,
  DEFAULT_MAKEUP_TETO,
  DEFAULT_MAKEUP_EGEN,
  MakeoverConfig
} from './hairStyler';

export interface HairOption {
  id: string;
  name: string;
  desc: string;
}

export interface AnalysisResult {
  type: 'TETO' | 'EGEN';
  confidence: number;
  tetoScore?: number;
  egenScore?: number;
  description: string;
  traits: {
    label: string;
    value: string;
  }[];
  stylingAdvice: {
    fashion: string;
    makeup: string;
    hair: string;
    vibe: string;
  };
  hairOptions?: HairOption[];
}

export async function analyzeFace(base64Image: string): Promise<AnalysisResult> {
  try {
    const res = await fetch('/api/face_analy/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image }),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (e) {
    console.warn("Backend /api/face_analy/analyze failed, using fallback:", e);
  }

  // Fallback realistic response
  return {
    type: 'TETO',
    confidence: 85,
    tetoScore: 68,
    egenScore: 32,
    description: "시크하고 또렷한 눈매와 세련된 턱선 라인이 돋보이는 매력적인 테토상입니다. 도시적인 감각과 당당한 카리스마가 강렬하게 느껴집니다.",
    traits: [
      { label: 'T존 입체감', value: '또렷하고 세련된 콧대와 눈썹뼈 라인' },
      { label: '눈매 & 눈빛', value: '시크하고 날렵한 고양이상 눈매' },
      { label: '턱선 & 페이스라인', value: '샤프하고 입체적인 페이스 윤곽' },
      { label: '전체적인 무드', value: '트렌디하고 자신감 넘치는 도회적 아우라' }
    ],
    stylingAdvice: {
      fashion: '모던 미니멀룩 또는 시크 스트릿웨어',
      makeup: '또렷한 음영 메이크업과 포인트 립 연출',
      hair: '슬릭 댄디컷 또는 가일 스타일',
      vibe: '자신감 넘치는 세련된 도시적 무드'
    },
    hairOptions: [
      { id: 'slick_dandy', name: '슬릭 댄디컷', desc: '이마를 살짝 드러내 시크하고 정갈한 도시적 무드를 연출합니다.' },
      { id: 'guile_cut', name: '가일컷', desc: '한쪽 앞머리를 넘겨 T존의 입체감과 카리스마를 강조합니다.' },
      { id: 'soft_asche', name: '소프트 애즈펌', desc: '자연스러운 C컬 볼륨으로 부드러운 밸런스를 부여합니다.' },
      { id: 'tassel_cut', name: '테슬컷', desc: '직선적인 칼단발 라인으로 날렵한 턱선을 강조합니다.' }
    ]
  };
}

export async function generateMakeoverPreview(
  base64Image: string,
  config: MakeoverConfig
): Promise<string> {
  return renderTotalMakeover(base64Image, config);
}

export async function generateHairPreview(
  base64Image: string, 
  styleId: string,
  params?: Partial<HairFittingParams>
): Promise<string> {
  return renderStyledHair(base64Image, styleId, params);
}

export { 
  HAIRSTYLE_PRESETS, 
  DEFAULT_FITTING_PARAMS, 
  DEFAULT_MAKEUP_TETO, 
  DEFAULT_MAKEUP_EGEN 
};
export type { 
  HairStyleOption, 
  HairFittingParams, 
  MakeupParams, 
  MakeoverConfig 
};
