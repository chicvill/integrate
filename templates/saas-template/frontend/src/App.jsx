import React, { useState, useEffect } from 'react';
import { PortalHeader, createApiClient } from '@mqnet/ui';

const api = createApiClient('{{APP_ID}}');

export function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // API 연결 샘플
    setLoading(true);
    api.get('/api/data')
      .then(res => setData(res.items || []))
      .catch(() => {
        // Mock fallback
        setData([
          { id: 1, title: 'MQnet 통합 모듈 정상 로드', status: 'active' },
          { id: 2, title: '공통 PortalHeader 연동 완료', status: 'ready' }
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 🌟 공통 포털 헤더 */}
      <PortalHeader
        appName="{{APP_NAME}}"
        appIcon="{{APP_ICON}}"
        category="{{APP_CATEGORY}}"
        portalUrl="/"
      />

      {/* 메인 콘텐츠 영역 */}
      <main style={{ flex: 1, padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* 히어로 배너 */}
        <section style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(59, 130, 246, 0.05))',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '20px',
          padding: '2.5rem',
          marginBottom: '2rem',
          backdropFilter: 'blur(12px)'
        }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0 0 0.75rem 0', letterSpacing: '-0.02em' }}>
            {{APP_NAME}} <span style={{ background: 'linear-gradient(135deg, #6366f1, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>대시보드</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1.05rem', margin: 0, lineHeight: 1.6 }}>
            MQnet 통합 플랫폼 표준 Vite 템플릿 기반으로 구축된 고성능 독립 SaaS 서비스입니다.
          </p>
        </section>

        {/* 대시보드 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div className="mq-glass mq-glass-hover" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <div style={{ color: '#818cf8', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>SERVICE STATUS</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc' }}>Active 🟢</div>
            <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' }}>포털 게이트웨이 직접 연결</div>
          </div>
          <div className="mq-glass mq-glass-hover" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <div style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>DATA ITEMS</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc' }}>{data.length} 건</div>
            <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' }}>백엔드 API 동기화 상태</div>
          </div>
          <div className="mq-glass mq-glass-hover" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <div style={{ color: '#34d399', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>TECH STACK</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc' }}>Vite + React</div>
            <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' }}>@mqnet/ui 공유 모듈 탑재</div>
          </div>
        </div>

        {/* 아이템 목록 카드 */}
        <section className="mq-glass" style={{ padding: '1.75rem', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1.25rem 0' }}>📋 연동 항목 관리</h2>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>데이터 로딩 중...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data.map(item => (
                <div key={item.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem 1.25rem',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <span style={{ fontWeight: 600 }}>{item.title}</span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.65rem',
                    borderRadius: '999px',
                    background: item.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                    color: item.status === 'active' ? '#34d399' : '#818cf8'
                  }}>
                    {item.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
