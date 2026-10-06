import React from 'react';
import { ShoppingCart, Activity, Package, Settings, ExternalLink } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, systemStatus }) {
  const isStandalone = systemStatus?.is_standalone;

  return (
    <nav style={{
      background: 'rgba(23, 42, 69, 0.9)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      padding: '1rem 1.5rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          MQnet Store & Situation Room
        </h1>
        <span className={isStandalone ? "badge badge-standalone" : "badge badge-saas"}>
          {isStandalone ? "N100 LOCAL POS (STANDALONE)" : "SAAS CLOUD SITUATION PORTAL"}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('pos')}
          className="btn-primary"
          style={{ background: activeTab === 'pos' ? 'var(--accent-amber)' : 'transparent', border: '1px solid var(--border-color)' }}
        >
          <ShoppingCart size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          카운터 POS
        </button>

        <button
          onClick={() => setActiveTab('situation')}
          className="btn-primary"
          style={{ background: activeTab === 'situation' ? 'var(--accent-cyan)' : 'transparent', border: '1px solid var(--border-color)' }}
        >
          <Activity size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          실시간 상황실 (Situation Room)
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className="btn-primary"
          style={{ background: activeTab === 'inventory' ? 'var(--bg-card)' : 'transparent', border: '1px solid var(--border-color)' }}
        >
          <Package size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          재고 & 상품 관리
        </button>

        <button
          onClick={() => setActiveTab('admin')}
          className="btn-primary"
          style={{ background: activeTab === 'admin' ? 'var(--bg-card)' : 'transparent', border: '1px solid var(--border-color)' }}
        >
          <Settings size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          설정 & Sync
        </button>

        <a
          href="/situation"
          target="_blank"
          rel="noreferrer"
          className="btn-primary"
          style={{ background: 'rgba(6, 182, 212, 0.15)', border: '1px solid var(--accent-cyan)', color: '#22d3ee', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
        >
          <ExternalLink size={14} style={{ marginRight: '4px' }} />
          상황실 전용창 (/situation)
        </a>

        <a
          href="./manual.html"
          target="_blank"
          rel="noreferrer"
          className="btn-primary"
          style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid var(--accent-amber)', color: '#fbbf24', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
        >
          📖 운영 매뉴얼
        </a>
      </div>
    </nav>
  );
}
