import React from 'react';
import { Sprout, Activity, Sliders, Cpu, ExternalLink } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, systemStatus }) {
  const isStandalone = systemStatus?.is_standalone;

  return (
    <nav style={{
      background: 'rgba(13, 56, 38, 0.95)',
      borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
      padding: '1rem 1.5rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #34d399, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sprout color="#34d399" /> MQnet MQFarm Platform
        </h1>
        <span className={isStandalone ? "badge badge-standalone" : "badge badge-saas"}>
          {isStandalone ? "N100 LOCAL SMARTFARM (STANDALONE)" : "SAAS MULTI-FARM PORTAL"}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('monitoring')}
          className="btn-primary"
          style={{ background: activeTab === 'monitoring' ? 'var(--accent-emerald)' : 'transparent', border: '1px solid var(--border-color)' }}
        >
          <Activity size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          센서 관제
        </button>

        <button
          onClick={() => setActiveTab('control')}
          className="btn-primary"
          style={{ background: activeTab === 'control' ? 'var(--accent-teal)' : 'transparent', border: '1px solid var(--border-color)' }}
        >
          <Sliders size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          장비 제어
        </button>

        <button
          onClick={() => setActiveTab('growth')}
          className="btn-primary"
          style={{ background: activeTab === 'growth' ? 'var(--bg-card)' : 'transparent', border: '1px solid var(--border-color)' }}
        >
          <Cpu size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          생장 AI 비전
        </button>

        <a
          href="/monitoring"
          target="_blank"
          rel="noreferrer"
          className="btn-primary"
          style={{ background: 'rgba(52, 211, 153, 0.15)', border: '1px solid var(--accent-emerald)', color: '#34d399', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
        >
          <ExternalLink size={14} style={{ marginRight: '4px' }} />
          센서 관제 전용창 (/monitoring)
        </a>
      </div>
    </nav>
  );
}
