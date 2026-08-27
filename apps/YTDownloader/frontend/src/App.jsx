import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DownloaderPage from './pages/DownloaderPage';
import LibraryPage from './pages/LibraryPage';
import AdminPage from './pages/AdminPage';
import { Download, FolderDown } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('downloader');
  const [systemStatus, setSystemStatus] = useState(null);

  const path = window.location.pathname.toLowerCase();
  const isDedicatedDownloader = path === '/downloader' || path.startsWith('/downloader/');
  const isDedicatedLibrary = path === '/library' || path.startsWith('/library/');

  useEffect(() => {
    fetch('/api/system-status')
      .then((res) => res.json())
      .then((data) => setSystemStatus(data))
      .catch((err) => console.error('Error fetching system status:', err));
  }, []);

  // 1. Dedicated Downloader View
  if (isDedicatedDownloader) {
    return (
      <div className="app-container">
        <header style={{
          background: 'rgba(30, 41, 59, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Download color="#22d3ee" size={24} />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f8fafc' }}>
              MQnet YTDownloader 초고속 다운로더 (Downloader View)
            </h1>
          </div>
          <span className="badge badge-saas">DOWNLOADER MODE</span>
        </header>
        <main className="main-content">
          <DownloaderPage />
        </main>
      </div>
    );
  }

  // 2. Dedicated Media Library View
  if (isDedicatedLibrary) {
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
            <FolderDown color="#c084fc" size={24} />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f8fafc' }}>
              MQnet 미디어 보관함 & 재생 (Library View)
            </h1>
          </div>
          <span className="badge badge-standalone">MEDIA LIBRARY MODE</span>
        </header>
        <main className="main-content">
          <LibraryPage />
        </main>
      </div>
    );
  }

  // 3. Integrated Manager View
  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemStatus={systemStatus}
      />
      <main className="main-content">
        {activeTab === 'downloader' && <DownloaderPage />}
        {activeTab === 'library' && <LibraryPage />}
        {activeTab === 'admin' && <AdminPage systemStatus={systemStatus} />}
      </main>
    </div>
  );
}
