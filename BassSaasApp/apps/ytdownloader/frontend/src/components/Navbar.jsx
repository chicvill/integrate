import React from 'react';
import { Download, Film, FolderDown, Settings, ExternalLink } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, systemStatus }) {
  const isStandalone = systemStatus?.is_standalone;

  return (
    <nav style={{
      background: 'rgba(30, 41, 59, 0.95)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      padding: '1rem 1.5rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #22d3ee, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Film color="#22d3ee" /> MQnet YTDownloader SaaS
        </h1>
        <span className={isStandalone ? "badge badge-standalone" : "badge badge-saas"}>
          {isStandalone ? "N100 LOCAL STORAGE MODE" : "SAAS CLOUD DOWNLOAD PORTAL"}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('downloader')}
          className="btn-primary"
          style={{ background: activeTab === 'downloader' ? 'var(--accent-cyan)' : 'transparent', border: '1px solid var(--border-color)' }}
        >
          <Download size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          영상/음원 다운로드
        </button>

        <button
          onClick={() => setActiveTab('library')}
          className="btn-primary"
          style={{ background: activeTab === 'library' ? 'var(--accent-purple)' : 'transparent', border: '1px solid var(--border-color)' }}
        >
          <FolderDown size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          미디어 라이브러리
        </button>

        <button
          onClick={() => setActiveTab('admin')}
          className="btn-primary"
          style={{ background: activeTab === 'admin' ? 'var(--bg-card)' : 'transparent', border: '1px solid var(--border-color)' }}
        >
          <Settings size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          스토리지 & Quota
        </button>

        <a
          href="/downloader"
          target="_blank"
          rel="noreferrer"
          className="btn-primary"
          style={{ background: 'rgba(6, 182, 212, 0.15)', border: '1px solid var(--accent-cyan)', color: '#22d3ee', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
        >
          <ExternalLink size={14} style={{ marginRight: '4px' }} />
          다운로더 전용창 (/downloader)
        </a>
      </div>
    </nav>
  );
}
