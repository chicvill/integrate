import React, { useState, useEffect } from 'react';
import './theme.css';

/**
 * MQnet Shared Portal Header Component (@mqnet/ui/PortalHeader)
 * Rendered at the top of every SaaS application for seamless portal navigation.
 */
export function PortalHeader({
  appName = 'MQnet SaaS App',
  appIcon = '✨',
  category = 'Service',
  portalUrl = '/',
  rightSlot = null
}) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('mqnet_user') || localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('mqnet_token');
    localStorage.removeItem('token');
    localStorage.removeItem('mqnet_user');
    localStorage.removeItem('user');
    setUser(null);
    window.location.reload();
  };

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 9999,
      width: '100%',
      background: 'rgba(9, 13, 22, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '0.65rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
      fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      {/* Left: Back to Portal button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <a
          href={portalUrl}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.4rem 0.85rem',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#cbd5e1',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 700,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
            e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#cbd5e1';
          }}
        >
          <span>⬅</span>
          <span>MQnet 포털</span>
        </a>

        {/* Current App Identifier */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{appIcon}</span>
          <span style={{ color: '#f8fafc', fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em' }}>
            {appName}
          </span>
          <span style={{
            fontSize: '0.7rem',
            padding: '0.15rem 0.5rem',
            borderRadius: '999px',
            background: 'rgba(99, 102, 241, 0.15)',
            color: '#818cf8',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {category}
          </span>
        </div>
      </div>

      {/* Right Slot & User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {rightSlot}

        {/* System Online Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: '0.78rem',
          color: '#34d399',
          fontWeight: 600,
          background: 'rgba(16, 185, 129, 0.1)',
          padding: '0.3rem 0.65rem',
          borderRadius: '999px',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
          <span>Connected</span>
        </div>

        {/* User Session */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>
              👤 {user.name || user.email || '회원님'}
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#94a3b8',
                borderRadius: '8px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              로그아웃
            </button>
          </div>
        ) : (
          <button
            onClick={() => window.open('/portal#auth', '_blank')}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            로그인
          </button>
        )}
      </div>
    </header>
  );
}

export default PortalHeader;
