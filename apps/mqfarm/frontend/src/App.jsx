import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MonitoringPage from './pages/MonitoringPage';
import ControlPage from './pages/ControlPage';
import GrowthPage from './pages/GrowthPage';
import AdminPage from './pages/AdminPage';
import { Activity, Sliders } from 'lucide-react';
import PortalHeader from './PortalHeader';

export default function App() {
  const [activeTab, setActiveTab] = useState('monitoring');
  const [systemStatus, setSystemStatus] = useState(null);

  const path = window.location.pathname.toLowerCase();
  const isDedicatedMonitoring = path === '/monitoring' || path.startsWith('/monitoring/');
  const isDedicatedControl = path === '/control' || path.startsWith('/control/');

  useEffect(() => {
    fetch('/api/system-status')
      .then((res) => res.json())
      .then((data) => setSystemStatus(data))
      .catch((err) => console.error('Error fetching system status:', err));
  }, []);

  // 1. Dedicated Monitoring View
  if (isDedicatedMonitoring) {
    return (
      <div className="app-container">
        <PortalHeader appName="MQFarm 센서 모니터링" appIcon="📊" category="IoT Monitor" />
        <header style={{
          background: 'rgba(13, 56, 38, 0.95)',
          borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity color="#34d399" size={24} />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f0fdf4' }}>
              MQnet MQFarm 센서 모니터링 (Monitoring View)
            </h1>
          </div>
          <span className="badge badge-saas">MONITORING MODE</span>
        </header>
        <main className="main-content">
          <MonitoringPage />
        </main>
      </div>
    );
  }

  // 2. Dedicated Actuator Control View
  if (isDedicatedControl) {
    return (
      <div className="app-container">
        <PortalHeader appName="MQFarm 구동 장비 제어" appIcon="🎛️" category="IoT Control" />
        <header style={{
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders color="#2dd4bf" size={24} />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f0fdf4' }}>
              MQnet MQFarm 구동 장비 제어 (Control View)
            </h1>
          </div>
          <span className="badge badge-standalone">ACTUATOR CONTROL MODE</span>
        </header>
        <main className="main-content">
          <ControlPage />
        </main>
      </div>
    );
  }

  // 3. Integrated Manager View
  return (
    <div className="app-container">
      <PortalHeader appName="MQFarm 스마트팜 통합관리" appIcon="🌱" category="IoT & Agriculture" />
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemStatus={systemStatus}
      />
      <main className="main-content">
        {activeTab === 'monitoring' && <MonitoringPage />}
        {activeTab === 'control' && <ControlPage />}
        {activeTab === 'growth' && <GrowthPage />}
        {activeTab === 'admin' && <AdminPage systemStatus={systemStatus} />}
      </main>
    </div>
  );
}
