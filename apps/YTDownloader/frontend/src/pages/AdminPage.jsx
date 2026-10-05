import React, { useState, useEffect } from 'react';
import { Server, HardDrive, RefreshCw } from 'lucide-react';
import { getApiBase } from '../utils/api';

export default function AdminPage({ systemStatus }) {
  const [status, setStatus] = useState(systemStatus || {});

  useEffect(() => {
    fetch(`${getApiBase()}/system-status`)
      .then((res) => {
        if (res.ok) return res.json();
        return fetch('/api/system-status').then(r => r.json());
      })
      .then((data) => setStatus(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div>
      <div className="glass-card">
        <h2>MQnet YTDownloader 시스템 설정 & Quota</h2>
        <p style={{ color: 'var(--text-muted)' }}>SaaS 및 스탠드얼론 운영 모드를 확인하고 스토리지 할당량을 관리합니다.</p>
      </div>

      <div className="grid-2">
        <div className="glass-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Server color="#22d3ee" /> 시스템 환경 정보
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span>운영 모드 (DEPLOYMENT_MODE)</span>
              <strong style={{ color: '#22d3ee' }}>{status.deployment_mode || 'SAAS_PORTAL'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span>AI 요약/자막 (ENABLE_AI_TRANSCRIPTION)</span>
              <strong>{status.enable_ai_transcription ? "활성화 (Enabled)" : "기본 활성화"}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span>데이터베이스 엔진</span>
              <strong>{status.database || 'SQLite / Supabase'} DB Engine</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>현재 저장된 미디어 수</span>
              <strong style={{ color: '#34d399' }}>{status.downloads_count != null ? status.downloads_count : 0}개 파일</strong>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <HardDrive color="#c084fc" /> SaaS Quota & Storage 정책
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            SaaS 포털 모드에서는 일일 최대 다운로드 한도가 자동으로 적용되어 서버 디스크 고갈을 방지합니다.
          </p>
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', color: '#34d399' }}>
            - 일일 무료 쿼터: 게스트 당 50회/일<br/>
            - 동시 다운로드 파이프라인: 병렬 비동기 큐 (Async Queue)<br/>
            - H.264 / AAC 100% 호환성 자동 트랜스코딩
          </div>
        </div>
      </div>
    </div>
  );
}
