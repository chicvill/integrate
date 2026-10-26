import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, LayoutGrid, Sparkles, Settings, ExternalLink, Monitor } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, systemStatus, title, badgeText, badgeClass }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isStandalone = systemStatus?.is_standalone;
  const currentTitle = title || "MQnet StudyCafe";
  const currentBadgeText = badgeText || (isStandalone ? "N100 LOCAL STANDALONE" : "SAAS CLOUD PORTAL");
  const currentBadgeClass = badgeClass || (isStandalone ? "badge badge-standalone" : "badge badge-saas");

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavigate = (target) => {
    setIsMenuOpen(false);
    if (target === 'seats') {
      if (setActiveTab && window.location.pathname === '/') {
        setActiveTab('seats');
      } else {
        window.location.href = '/';
      }
    } else if (target === 'admin') {
      if (setActiveTab && window.location.pathname === '/') {
        setActiveTab('admin');
      } else {
        window.location.href = '/#admin';
      }
    } else if (target === 'kiosk') {
      window.location.href = '/kiosk';
    }
  };

  return (
    <nav style={{
      background: 'rgba(30, 41, 59, 0.95)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      padding: '0.85rem 1.5rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'relative',
      zIndex: 1000
    }}>
      <div ref={menuRef} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
        {/* Hamburger Menu Toggle Button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="메뉴 열기"
          style={{
            background: isMenuOpen ? 'rgba(96, 165, 250, 0.25)' : 'rgba(255, 255, 255, 0.08)',
            border: isMenuOpen ? '1px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            color: '#f8fafc',
            padding: '0.5rem 0.6rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            boxShadow: isMenuOpen ? '0 0 10px rgba(96, 165, 250, 0.4)' : 'none'
          }}
        >
          {isMenuOpen ? <X size={22} color="#60a5fa" /> : <Menu size={22} />}
        </button>

        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
          {currentTitle}
        </h1>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 12px)',
            left: 0,
            background: 'rgba(15, 23, 42, 0.98)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '12px',
            padding: '0.75rem',
            width: '270px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            animation: 'fadeIn 0.15s ease-out'
          }}>
            <div style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '0.2rem' }}>
              시스템 바로가기 메뉴
            </div>

            <button
              onClick={() => handleNavigate('seats')}
              className="btn-primary"
              style={{
                background: activeTab === 'seats' && window.location.pathname === '/' ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                justifyContent: 'flex-start',
                width: '100%',
                padding: '0.7rem 0.9rem',
                fontSize: '0.9rem',
                color: '#fff'
              }}
            >
              <LayoutGrid size={18} style={{ marginRight: '10px', color: '#60a5fa' }} />
              통합 좌석관리
            </button>

            <button
              onClick={() => handleNavigate('admin')}
              className="btn-primary"
              style={{
                background: activeTab === 'admin' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                justifyContent: 'flex-start',
                width: '100%',
                padding: '0.7rem 0.9rem',
                fontSize: '0.9rem',
                color: '#fff'
              }}
            >
              <Settings size={18} style={{ marginRight: '10px' }} />
              시스템 설정
            </button>

            <button
              onClick={() => handleNavigate('kiosk')}
              className="btn-primary"
              style={{
                background: window.location.pathname.startsWith('/kiosk') ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                justifyContent: 'flex-start',
                width: '100%',
                padding: '0.7rem 0.9rem',
                fontSize: '0.9rem',
                color: '#fff'
              }}
            >
              <Monitor size={18} style={{ marginRight: '10px', color: '#34d399' }} />
              무인 키오스크 (/kiosk)
            </button>


          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span className={currentBadgeClass}>
          {currentBadgeText}
        </span>
      </div>
    </nav>
  );
}
