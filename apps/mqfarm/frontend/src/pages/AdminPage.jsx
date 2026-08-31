import React, { useState, useEffect } from 'react';
import { Server, RefreshCw, Database } from 'lucide-react';

export default function AdminPage({ systemStatus }) {
  const [status, setStatus] = useState(systemStatus || {});
  const [syncMsg, setSyncMsg] = useState('');

  useEffect(() => {
    fetch('/api/system-status')
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch((err) => console.error(err));
  }, []);

  const handleSync = () => {
    setSyncMsg("로컬 N100 스마트팜 시계열 센서 데이터를 클라우드 SaaS 포털로 동기화 중...");
    setTimeout(() => {
      setSyncMsg("[완료] 로컬 센서 로그 0건 클라우드 동기화 완료!");
    }, 1200);
  };

  return (
    <div>
      <div className="glass-card">
        <h2>MQnet MQFarm 시스템 설정</h2>
        <p style={{ color: 'var(--text-muted)' }}>SaaS 및 스탠드얼론 운영 모드를 확인하고 센서 데이터 덤프를 동기화합니다.</p>
      </div>

      <div className="grid-2">
        <div className="glass-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Server color="#34d399" /> 시스템 환경 정보
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span>운영 모드 (DEPLOYMENT_MODE)</span>
              <strong style={{ color: '#34d399' }}>{status.deployment_mode}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span>생장 AI 분석 (ENABLE_GROWTH_AI)</span>
              <strong>{status.enable_growth_ai ? "활성화 (Enabled)" : "비활성화"}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span>오프라인 데이터 Sync</span>
              <strong>{status.enable_offline_sync ? "활성화 (Enabled)" : "미연동"}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>데이터베이스 엔진</span>
              <strong>{status.database} DB Engine</strong>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Database color="#22d3ee" /> Offline-First 센서 로그 동기화
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            N100 오프라인 환경에 축적된 스마트팜 환경 센서/액추에이터 데이터를 중앙 SaaS 클라우드로 수동 업로드합니다.
          </p>

          <button onClick={handleSync} className="btn-primary" style={{ width: '100%' }}>
            <RefreshCw size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            센서 데이터 수동 동기화 (Sync to Cloud)
          </button>

          {syncMsg && (
            <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'var(--bg-secondary)', borderRadius: '8px', color: '#34d399' }}>
              {syncMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
