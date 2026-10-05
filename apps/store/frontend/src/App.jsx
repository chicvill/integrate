import React, { useState, useEffect } from 'react';
import PortalHeader from './components/PortalHeader';
import Navbar from './components/Navbar';
import PosPage from './pages/PosPage';
import SituationPage from './pages/SituationPage';
import InventoryPage from './pages/InventoryPage';
import AdminPage from './pages/AdminPage';
import { ShoppingCart, Activity } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('pos');
  const [systemStatus, setSystemStatus] = useState(null);

  const path = window.location.pathname.toLowerCase();
  const isDedicatedSituation = path === '/situation' || path.startsWith('/situation/');
  const isDedicatedPos = path === '/pos' || path.startsWith('/pos/');

  useEffect(() => {
    fetch('/api/system-status')
      .then((res) => res.json())
      .then((data) => setSystemStatus(data))
      .catch((err) => console.error('Error fetching system status:', err));
  }, []);

  // 1. Dedicated Situation Room View
  if (isDedicatedSituation) {
    return (
      <div className="app-container">
        <PortalHeader appName="매장 상황실" appIcon="📊" category="Monitoring" />
        <header style={{
          background: 'linear-gradient(135deg, #083344, #155e75)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity color="#22d3ee" size={24} />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f8fafc' }}>
              MQnet Store 실시간 상황실 (Situation Room)
            </h1>
          </div>
          <span className="badge badge-saas">SITUATION ROOM MODE</span>
        </header>
        <main className="main-content">
          <SituationPage />
        </main>
      </div>
    );
  }

  // 2. Dedicated POS View
  if (isDedicatedPos) {
    return (
      <div className="app-container">
        <header style={{
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShoppingCart color="#fbbf24" size={24} />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f8fafc' }}>
              MQnet 카운터 POS 결제
            </h1>
          </div>
          <span className="badge badge-standalone">POS COUNTER MODE</span>
        </header>
        <main className="main-content">
          <PosPage />
        </main>
      </div>
    );
  }

  // 3. Integrated Manager View
  return (
    <div className="app-container">
      <PortalHeader appName="매장 관제 & POS" appIcon="🍽️" category="Business" />
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemStatus={systemStatus}
      />
      <main className="main-content">
        {activeTab === 'pos' && <PosPage />}
        {activeTab === 'situation' && <SituationPage />}
        {activeTab === 'inventory' && <InventoryPage />}
        {activeTab === 'admin' && <AdminPage systemStatus={systemStatus} />}
      </main>
    </div>
  );
}
