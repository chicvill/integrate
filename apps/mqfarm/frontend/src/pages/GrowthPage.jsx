import React, { useState, useEffect } from 'react';
import { Cpu, Camera, Leaf } from 'lucide-react';

export default function GrowthPage() {
  const [growth, setGrowth] = useState(null);

  useEffect(() => {
    fetchGrowth();
  }, []);

  const fetchGrowth = async () => {
    try {
      const res = await fetch('/api/growth/analysis');
      const data = await res.json();
      setGrowth(data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="glass-card">
        <h2>식물 생장 모델 & 비전 AI 분석 (Vision Analytics)</h2>
        <p style={{ color: 'var(--text-muted)' }}>카메라 비전 피드백(녹색 픽셀 비율) 및 AI 생장 모델로 작물 성장을 진단합니다.</p>
      </div>

      <div className="grid-2">
        <div className="glass-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Camera color="#34d399" /> 비전 센서 측정 데이터
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>녹색 픽셀 커버리지 비율 (Green Pixel Ratio)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#34d399' }}>
                {growth ? `${growth.green_pixel_ratio}%` : '로딩중...'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>추정 평균 초장 (Plant Height)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#2dd4bf' }}>
                {growth ? `${growth.estimated_height_cm} cm` : '로딩중...'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>주간 생육 증가율 (Growth Rate)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fbbf24' }}>
                {growth ? `+${growth.growth_rate_pct}% / 주` : '로딩중...'}
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Cpu color="#c084fc" /> Gemini AI 생육 최적화 브리핑
          </h3>
          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: '1.2rem',
              borderRadius: '8px',
              borderLeft: '4px solid var(--accent-emerald)',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6'
            }}
          >
            {growth ? growth.ai_status_summary : 'AI 진단 분석을 수집 중입니다...'}
          </div>
        </div>
      </div>
    </div>
  );
}
