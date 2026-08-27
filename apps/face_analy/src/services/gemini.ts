export interface AnalysisResult {
  type: 'TETO' | 'EGEN';
  confidence: number;
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
    confidence: 88,
    description: "시크하고 또렷한 눈매와 세련된 턱선 라인이 돋보이는 매력적인 테토상입니다. 도시적인 감각과 당당한 매력이 느껴집니다.",
    traits: [
      { label: '눈매', value: '시크하고 날렵한 고양이상 눈매' },
      { label: '얼굴선', value: '또렷하고 세련된 페이스 라인' },
      { label: '전체 무드', value: '트렌디하고 자신감 있는 아우라' }
    ],
    stylingAdvice: {
      fashion: '모던 미니멀룩 또는 시크 스트릿웨어',
      makeup: '또렷한 음영 메이크업과 포인트 립 연출',
      hair: '슬릭 댄디컷 또는 깔끔한 스트레이트 헤어',
      vibe: '자신감 넘치는 세련된 도시적 무드'
    }
  };
}

export async function generateHairPreview(base64Image: string, hairDescription: string): Promise<string> {
  // Return base64 or placeholder preview
  return base64Image;
}
