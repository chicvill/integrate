import { useState, useEffect } from 'react';
import ScheduleBuilderWizard from './ScheduleBuilderWizard';
import KnowledgeBrowser from './KnowledgeBrowser';
import ParentDashboard from './ParentDashboard';
import StudentDashboard from './StudentDashboard';
import GoalOnboardingForm from './GoalOnboardingForm';
import Login from './Login';
import AdminDashboard from './AdminDashboard';
import ProfileEdit from './ProfileEdit';
import axios from 'axios';

import { API_URL } from './config';

const generateSessionId = () => "sess_" + Math.random().toString(36).substr(2, 9);

function App() {
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<'onboarding' | 'browser' | 'parent' | 'student' | 'admin' | 'profile_edit'>('onboarding');
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [wizardFormData, setWizardFormData] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showParentModal, setShowParentModal] = useState(false);

  const [isParentDirect, setIsParentDirect] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let sid = localStorage.getItem("selfstudy_session_id");
    if (!sid) {
      sid = generateSessionId();
      localStorage.setItem("selfstudy_session_id", sid);
    }
    setSessionId(sid);

    // URL parameter 및 localStorage 학부모 참관 코드 확인
    const urlParams = new URLSearchParams(window.location.search);
    const parentCodeParam = urlParams.get('parent_code') || urlParams.get('observer_code') || urlParams.get('code');
    if (parentCodeParam) {
      localStorage.setItem('selfstudy_parent_code', parentCodeParam.trim());
      setIsParentDirect(true);
      setCurrentTab('parent');
      setIsOnboarded(true);
      return;
    }

    const savedParentCode = localStorage.getItem('selfstudy_parent_code');
    const savedUserId = localStorage.getItem('selfstudy_saved_user_id');
    if (savedParentCode && !savedUserId) {
      setIsParentDirect(true);
      setCurrentTab('parent');
      setIsOnboarded(true);
    }
  }, []);

  const handleLogin = async (id: string) => {
    setIsParentDirect(false);
    setLoggedInUserId(id);
    setSessionId(id); // 사용자의 전화번호를 세션 ID로 사용
    localStorage.setItem("selfstudy_session_id", id);

    // 로그인 시 사용자 이름 조회
    try {
      const uRes = await axios.get(`${API_URL}/knowledge/user/${id}`);
      if (uRes.data.status === 'success' && uRes.data.data) {
        setUserName(uRes.data.data.name || '');
      }
    } catch (err) {
      console.error("Failed to fetch user name", err);
    }
    
    if (id === '010-1111-2222') {
      setIsOnboarded(true);
      setCurrentTab('admin');
      return;
    }
    
    // 로그인 시 기존 스케줄이 있는지 확인하여 있으면 대시보드로 이동
    try {
      const res = await axios.get(`${API_URL}/knowledge/student/${id}`);
      if (res.data.data) {
        setIsOnboarded(true);
        setCurrentTab('student');
        setActiveScheduleId(res.data.data.doc_id);
        return;
      }
    } catch (e) {
      console.error("Failed to fetch schedule on login", e);
    }

    // 파이널라이즈된 스케줄이 없으면 초안(진행중인 세션)이 있는지 확인
    try {
      const chatRes = await axios.get(`${API_URL}/knowledge/chat/${id}`);
      if (chatRes.data.data) {
        const session = chatRes.data.data;
        if (session.current_stage >= 2 && session.draft_schedule) {
          setWizardFormData(session.collected_data || {});
          setIsOnboarded(true);
          setCurrentTab('onboarding'); // AIChatWizard 화면으로 이동
          return;
        }
      }
    } catch (e) {
      console.error("Failed to fetch chat session on login", e);
    }

    // 아무것도 없으면 기본 폼으로 진입
    setIsOnboarded(false);
    setCurrentTab('onboarding');
  };

  const handleParentDirect = (code: string) => {
    if (code) {
      localStorage.setItem('selfstudy_parent_code', code.trim());
    }
    setIsParentDirect(true);
    setCurrentTab('parent');
    setIsOnboarded(true);
  };

  const handleReschedule = () => {
    setIsOnboarded(false); // 리스케줄링 시 온보딩을 다시 처음부터? (기존 로직: 챗봇 진입)
    setCurrentTab('onboarding');
    setIsSidebarOpen(false);
  };

  const handleLogout = () => {
    setLoggedInUserId(null);
    setUserName('');
    setIsOnboarded(false);
    setIsParentDirect(false);
    setActiveScheduleId(null);
    setIsSidebarOpen(false);
    localStorage.removeItem('selfstudy_saved_user_id');
    localStorage.removeItem('selfstudy_saved_user_name');
    localStorage.removeItem('selfstudy_parent_code');
  };

  const handleMenuClick = (tab: any, isOnboardedVal: boolean) => {
    setCurrentTab(tab);
    setIsOnboarded(isOnboardedVal);
    setIsSidebarOpen(false);
  };

  if (!sessionId) return <div>Loading...</div>;

  if (!loggedInUserId && !isParentDirect && currentTab !== 'parent') {
    return <Login onLogin={handleLogin} onOpenParentView={handleParentDirect} />;
  }

  return (
    <div style={{ 
      fontFamily: "'Pretendard', sans-serif", 
      height: '100vh', 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #0b1a6c 0%, #35158a 50%, #6830c2 100%)'
    }}>
      <header style={{ padding: '12px 15px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '28px', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >
            ☰
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ margin: 0, color: '#fff', fontSize: 'clamp(16px, 4vw, 22px)', fontWeight: '800', lineHeight: 1.2 }}>
              MQstudy <span style={{ color: '#82d7ff' }}>자기주도학습</span>
            </h1>
            {userName && (
              <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#e0e0e0', marginTop: '2px' }}>
                ({userName} {loggedInUserId === '010-1111-2222' ? '관리자' : '수험생'}님)
              </span>
            )}
          </div>
        </div>
        <div style={{ fontSize: '12px', fontWeight: '600', background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
          {currentTime.getFullYear()}-
          {String(currentTime.getMonth() + 1).padStart(2, '0')}-
          {String(currentTime.getDate()).padStart(2, '0')} {' '}
          {String(currentTime.getHours()).padStart(2, '0')}:
          {String(currentTime.getMinutes()).padStart(2, '0')}:
          {String(currentTime.getSeconds()).padStart(2, '0')}
        </div>
      </header>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }}
        />
      )}

      {/* Sidebar Drawer */}
      <div style={{
        position: 'fixed', top: 0, left: isSidebarOpen ? 0 : '-300px', width: '280px', height: '100vh',
        background: '#fff', zIndex: 1000, transition: 'left 0.3s ease', boxShadow: '5px 0 15px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#555' }}>✕</button>
        </div>
        
        <h3 style={{ margin: '0 0 20px 0', color: '#1976d2' }}>메뉴</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          {loggedInUserId === '010-1111-2222' ? (
            <>
              <button onClick={() => handleMenuClick('admin', true)} style={sidebarButtonStyle(currentTab === 'admin')}>🏫 관리 대시보드</button>
              <button onClick={() => handleMenuClick('parent', true)} style={sidebarButtonStyle(currentTab === 'parent')}>👥 학부모 참관 대시보드</button>
            </>
          ) : (
            <>
              <button onClick={() => handleMenuClick('student', true)} style={sidebarButtonStyle(currentTab === 'student')}>📈 나의 대시보드</button>
              <button onClick={() => { setIsSidebarOpen(false); handleReschedule(); }} style={{ ...sidebarButtonStyle(false), color: '#d32f2f', fontWeight: 'bold' }}>🚨 전체 일정 재조정 (AI)</button>
              <button onClick={() => handleMenuClick('onboarding', false)} style={sidebarButtonStyle(currentTab === 'onboarding' && !isOnboarded)}>📝 목표 및 개인정보 설정</button>
              
              <div style={{ padding: '10px 0', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  onClick={() => activeScheduleId ? handleReschedule() : alert('확정된 일정이 없습니다.')} 
                  style={sidebarButtonStyle(false)}
                >
                  ⚖️ 과목별 학습량 비율(가중치) 설정
                </button>
                <button 
                  onClick={() => activeScheduleId ? handleReschedule() : alert('확정된 일정이 없습니다.')} 
                  style={sidebarButtonStyle(false)}
                >
                  ⚖️ 단원별 학습량 비율(가중치) 설정
                </button>
              </div>
            </>
          )}
          
          <button onClick={() => handleMenuClick('profile_edit', true)} style={sidebarButtonStyle(currentTab === 'profile_edit')}>👤 개인 정보 수정</button>
          <button onClick={() => handleMenuClick('browser', true)} style={sidebarButtonStyle(currentTab === 'browser')}>📖 지식창고 탐색</button>
          {loggedInUserId !== '010-1111-2222' && (
            <button onClick={() => { setIsSidebarOpen(false); setShowParentModal(true); }} style={sidebarButtonStyle(currentTab === 'parent')}>👥 학부모 참관 코드 & QR</button>
          )}
        </div>

        {/* 로그아웃 버튼 */}
        <div style={{ marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid #eee' }}>
          <button 
            onClick={handleLogout} 
            style={{
              width: '100%',
              background: '#fff0f0',
              color: '#d32f2f',
              border: '1px solid #ffcdd2',
              padding: '12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            🚪 로그아웃
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '0 20px 20px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {currentTab === 'onboarding' && (
          !isOnboarded ? (
            <GoalOnboardingForm 
              sessionId={sessionId} 
              userId={loggedInUserId}
              onComplete={(formData) => {
                setWizardFormData(formData);
                setIsOnboarded(true);
              }} 
            />
          ) : (
            <ScheduleBuilderWizard 
              sessionId={sessionId} 
              userId={loggedInUserId!}
              initialFormData={wizardFormData}
              onFinalized={() => {
                setCurrentTab('student');
                // 확정 시 활성 스케줄 갱신 필요
                axios.get(`${API_URL}/knowledge/student/${loggedInUserId}`).then(res => {
                  if(res.data.data) setActiveScheduleId(res.data.data.doc_id);
                });
              }} 
            />
          )
        )}
        {currentTab === 'student' && <StudentDashboard sessionId={sessionId} onReschedule={handleReschedule} />}
        {currentTab === 'browser' && <KnowledgeBrowser />}
        {currentTab === 'parent' && <ParentDashboard />}
        {currentTab === 'admin' && <AdminDashboard onLogout={handleLogout} />}
        {currentTab === 'profile_edit' && (
          <ProfileEdit 
            userId={loggedInUserId!} 
            onSaved={(newName) => {
              setUserName(newName);
              setCurrentTab(loggedInUserId === '010-1111-2222' ? 'admin' : 'student');
            }} 
          />
        )}
      </main>

      {/* 학부모 참관 QR코드 및 참관 안내 모달 팝업 */}
      {showParentModal && (() => {
        const parentAccessUrl = `https://selfstudy.chicvill.store/?parent_code=P-${loggedInUserId}`;
        const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(parentAccessUrl)}`;

        const handleCopyLink = () => {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(parentAccessUrl);
            alert("✅ 학부모 참관 접속 링크가 복사되었습니다!\n카카오톡이나 문자 메시지로 학부모님께 공유해 주세요.");
          } else {
            prompt("아래 링크를 복사하여 전달해 주세요:", parentAccessUrl);
          }
        };

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.65)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div style={{
              background: '#fff', borderRadius: '20px', padding: '25px 28px',
              maxWidth: '460px', width: '100%', boxShadow: '0 15px 35px rgba(0,0,0,0.25)',
              position: 'relative', display: 'flex', flexDirection: 'column',
              maxHeight: '90vh', overflowY: 'auto'
            }}>
              <button 
                onClick={() => setShowParentModal(false)}
                style={{ position: 'absolute', top: '18px', right: '18px', background: '#f5f5f5', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>

              <h3 style={{ color: '#1976d2', margin: '0 0 16px 0', fontSize: '19px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📷 학부모 참관 QR코드 & 안내
              </h3>

              {/* QR코드 중앙 카드 */}
              <div style={{
                background: 'linear-gradient(135deg, #f0f7ff 0%, #e3f2fd 100%)',
                border: '1px solid #bbdefb',
                borderRadius: '16px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                boxShadow: '0 4px 12px rgba(25,118,210,0.08)'
              }}>
                <img 
                  src={qrCodeImageUrl} 
                  alt="학부모 참관 QR코드" 
                  style={{ width: '180px', height: '180px', borderRadius: '12px', background: '#fff', padding: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} 
                />
                <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: 'bold', color: '#0d47a1', textAlign: 'center' }}>
                  📱 학부모님 스마트폰 카메라로 QR 코드를 스캔하세요!
                </div>
              </div>

              {/* 참관 코드 및 링크 복사 박스 */}
              <div style={{ background: '#fff8e1', border: '1px solid #ffe082', padding: '14px 16px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#e65100', fontWeight: 'bold' }}>참관 코드 (직접 입력용)</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#b71c1c', letterSpacing: '1px' }}>
                    {`P-${loggedInUserId}`}
                  </div>
                </div>
                <button
                  onClick={handleCopyLink}
                  style={{ background: '#ff9800', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  📋 링크/코드 복사
                </button>
              </div>

              {/* 사용 방법 안내 */}
              <div style={{ fontSize: '13px', color: '#444', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
                <div style={{ fontWeight: 'bold', color: '#1976d2', fontSize: '14px' }}>📖 학부모 참관 사용 방법</div>
                
                <div style={{ background: '#f8f9fa', padding: '12px 14px', borderRadius: '10px', border: '1px solid #eee' }}>
                  <strong style={{ color: '#0d47a1' }}>1. QR 스캔만으로 즉시 접속:</strong> 학부모님이 스마트폰 카메라로 위 QR 코드를 스캔하면 별도 로그인 없이 바로 학부모 참관 화면이 열립니다.
                </div>
                
                <div style={{ background: '#fff3e0', padding: '12px 14px', borderRadius: '10px', border: '1px solid #ffe0b2' }}>
                  <strong style={{ color: '#e65100' }}>⭐ 2. 즐겨찾기 / 홈 화면 추가:</strong> 참관 창이 열리면 스마트폰 브라우저 메뉴에서 <strong>[즐겨찾기]</strong> 또는 <strong>[홈 화면에 추가]</strong>해 놓으시면, 언제든지 재접속하여 실시간 현황을 확인하실 수 있습니다.
                </div>
                
                <div style={{ background: '#f8f9fa', padding: '12px 14px', borderRadius: '10px', border: '1px solid #eee' }}>
                  <strong style={{ color: '#555' }}>3. 참관 코드 직접 입력:</strong> PC에서 접속 시 <span style={{ color: '#1976d2', fontWeight: 'bold' }}>https://selfstudy.chicvill.store</span> 접속 후 참관 코드(<strong style={{ color: '#0d47a1' }}>P-{loggedInUserId}</strong>)를 입력하여 접속 가능합니다.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    setShowParentModal(false);
                    setCurrentTab('parent');
                    setIsOnboarded(true);
                  }}
                  style={{ flex: 1, background: '#1976d2', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                >
                  👀 참관 화면 직접 테스트
                </button>
                <button
                  onClick={() => setShowParentModal(false)}
                  style={{ background: '#f5f5f5', color: '#555', border: '1px solid #ccc', padding: '12px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const sidebarButtonStyle = (isActive: boolean) => ({
  background: isActive ? '#e3f2fd' : 'transparent',
  color: isActive ? '#1976d2' : '#555',
  border: 'none',
  padding: '12px 15px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold',
  textAlign: 'left' as const,
  fontSize: '15px',
  transition: 'background 0.2s'
});

export default App;
