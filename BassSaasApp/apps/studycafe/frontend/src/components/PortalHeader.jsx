import React from 'react';

export default function PortalHeader({
  appName = '스터디카페 관리',
  appIcon = '☕',
  category = 'Business'
}) {
  return (
    <div style={{
      width: '100%',
      background: 'rgba(9, 13, 22, 0.95)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '0.5rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
      zIndex: 1000,
      position: 'relative',
      fontFamily: "'Pretendard', sans-serif"
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#cbd5e1',
            textDecoration: 'none',
            fontSize: '0.8rem',
            fontWeight: 700
          }}
        >
          <span>⬅</span>
          <span>MQnet 포털</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '1.1rem' }}>{appIcon}</span>
          <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.95rem' }}>{appName}</span>
          <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '999px', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', fontWeight: 700 }}>
            {category}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
        <span>Online</span>
      </div>
    </div>
  );
}
