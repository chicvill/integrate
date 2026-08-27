import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, TrendingUp, Cpu } from 'lucide-react';

export default function SituationPage() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/situation/metrics');
      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      console.error("Failed to fetch situation metrics:", err);
    }
  };

  return (
    <div>
      <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(245, 158, 11, 0.2))' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity color="#22d3ee" /> 매장 통합 상황실 (Situation Room)
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
          실시간 주문, 매출, 부족 재고 경보 및 AI 운영 관제 진단이 제공됩니다.
        </p>
      </div>

      <div className="grid-2">
        <div className="glass-card">
          <h3>실시간 모니터링 지표</h3>
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>오늘 누적 매출</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fbbf24' }}>
                {metrics ? `${metrics.sales_today.toLocaleString()}원` : '로딩중...'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>주문 건수</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#34d399' }}>
                {metrics ? `${metrics.order_count}건` : '로딩중...'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>재고 경고 품목 (30개 미만)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#f43f5e', marginTop: '4px' }}>
                {metrics && metrics.low_stock_items?.length > 0
                  ? metrics.low_stock_items.join(', ')
                  : '경고 품목 없음 (안정)'}
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu color="#c084fc" /> AI 관제 진단 브리핑
          </h3>
          <div
            style={{
              marginTop: '1.5rem',
              background: 'var(--bg-secondary)',
              padding: '1.2rem',
              borderRadius: '8px',
              borderLeft: '4px solid var(--accent-cyan)',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6'
            }}
          >
            {metrics ? metrics.ai_analysis : 'AI 분석을 수집 중입니다...'}
          </div>
        </div>
      </div>
    </div>
  );
}
