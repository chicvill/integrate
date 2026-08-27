import { useEffect, useState, useRef } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const DEFAULT_TENANT = 'demo-office';

export default function App() {
  const [mode, setMode] = useState('login');
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT);
  const [fullName, setFullName] = useState('홍길동');
  const [email, setEmail] = useState('hong@example.com');
  const [password, setPassword] = useState('password123');
  const [userName, setUserName] = useState('홍길동');
  const [sessionId, setSessionId] = useState('');
  const [result, setResult] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [status, setStatus] = useState('idle');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('gwansang-saas-token'));
  const [imageFile, setImageFile] = useState(null);
  const [imageBase64, setImageBase64] = useState('');
  const [cropSrc, setCropSrc] = useState('');
  const [crop, setCrop] = useState({ unit: '%', width: 50, height: 50, x: 25, y: 25 });
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);
  const [token, setToken] = useState(localStorage.getItem('gwansang-saas-token') || '');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchWithAuth = async (url, options = {}) => {
    const headers = { ...(options.headers || {}) };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    return fetch(url, { ...options, headers });
  };

  const fetchMe = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetchWithAuth('/api/me');
      if (!res.ok) throw new Error('Not auth');
      const data = await res.json();
      setUser(data.user);
      if (data.user?.tenantId) {
        setTenantId(data.user.tenantId);
        setUserName(data.user.fullName || '사용자');
      }
    } catch (e) {
      localStorage.removeItem('gwansang-saas-token');
      setToken('');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, [token]);

  const loadSessions = async () => {
    if (!tenantId) return;
    const res = await fetchWithAuth(`/api/tenants/${tenantId}/sessions`);
    if (!res.ok) {
      setSessions([]);
      return;
    }
    const data = await res.json();
    setSessions(data.sessions || []);
  };

  useEffect(() => {
    if (token && user?.tenantId) {
      loadSessions();
    }
  }, [tenantId, token, user]);

  const handleAuth = async () => {
    setStatus('authenticating');
    const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
    const payload = mode === 'signup'
      ? { tenantId, fullName, email, password }
      : { tenantId, email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = '인증 실패';
        try { const errData = await res.json(); msg = errData.message; } catch(e){}
        setStatus('error');
        alert(msg);
        return;
      }
      const data = await res.json();
      localStorage.setItem('gwansang-saas-token', data.token);
      setToken(data.token);
      setUser(data.user);
      setStatus('authenticated');
      setUserName(data.user.fullName || '사용자');
    } catch (err) {
      setStatus('error');
      alert('서버 연결에 실패했습니다. (터미널에서 에러를 확인해주세요)');
    }
  };

  const createSession = async () => {
    if (!token) {
      alert('먼저 로그인하세요.');
      return;
    }

    setStatus('creating');
    const res = await fetchWithAuth('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ tenantId, userName }),
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus('error');
      alert(data.message || '세션 생성 실패');
      return;
    }

    setSessionId(data.sessionId);
    setStatus('ready');
    await loadSessions();
  };

  const analyze = async () => {
    if (!token || !sessionId) {
      alert('먼저 로그인 후 세션을 생성하세요.');
      return;
    }

    if (!imageBase64) {
      alert('먼저 얼굴 사진을 업로드하거나 촬영해주세요!');
      return;
    }
    setStatus('analyzing');
    try {
      const payload = {
        tenantId,
        sessionId,
        userName,
        imageData: imageBase64,
      };

      const res = await fetchWithAuth('/api/analyze', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        alert(data.message || '분석 실패');
        return;
      }

      if (data.warning) {
        alert('⚠️ ' + data.warning);
      }

      setResult(data.result);
      setStatus('done');
      await loadSessions();
    } catch (err) {
      setStatus('error');
      alert('분석 요청 중 오류가 발생했습니다.');
    }
  };

  const handleCropComplete = () => {
    if (!completedCrop || !imgRef.current) return;
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    const MAX_WIDTH = 800;
    let targetWidth = completedCrop.width * scaleX;
    let targetHeight = completedCrop.height * scaleY;
    
    if (targetWidth > MAX_WIDTH) {
      targetHeight = Math.round(targetHeight * (MAX_WIDTH / targetWidth));
      targetWidth = MAX_WIDTH;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      targetWidth,
      targetHeight
    );

    const base64Image = canvas.toDataURL('image/jpeg', 0.8);
    setImageBase64(base64Image);
    setCropSrc('');
  };

  const logout = () => {
    localStorage.removeItem('gwansang-saas-token');
    setToken('');
    setUser(null);
    setSessionId('');
    setResult(null);
    setSessions([]);
    setImageFile(null);
    setImageBase64('');
    setCropSrc('');
    setStatus('idle');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a, #1f2937)',
        color: '#f8fafc',
        fontFamily: 'sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
        color: '#cbd5e1'
      }}>
        로딩 중...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a, #1f2937)',
      color: '#f8fafc',
      fontFamily: 'sans-serif',
      padding: isMobile ? '20px 10px' : '40px 20px'
    }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: 24, gap: 12 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '1.8rem' : '2.5rem', margin: 0 }}>AI 관상 SaaS</h1>
            <p style={{ color: '#cbd5e1', marginTop: 8, fontSize: isMobile ? '0.9rem' : '1rem' }}>
              멀티테넌트 구조로 여러 사용자가 동시에 접근할 수 있는 서비스입니다.
            </p>
          </div>
          {user && (
            <button onClick={logout} style={secondaryButton}>
              로그아웃
            </button>
          )}
        </div>

        {!user ? (
          <div style={{ background: '#111827', borderRadius: 16, padding: isMobile ? 16 : 24, border: '1px solid #334155', maxWidth: 520, marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              <button onClick={() => setMode('login')} style={{ ...toggleButton, background: mode === 'login' ? '#f59e0b' : '#0f172a', color: mode === 'login' ? '#111827' : '#f8fafc' }}>
                로그인
              </button>
              <button onClick={() => setMode('signup')} style={{ ...toggleButton, background: mode === 'signup' ? '#f59e0b' : '#0f172a', color: mode === 'signup' ? '#111827' : '#f8fafc' }}>
                회원가입
              </button>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <label>
                Tenant ID
                <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} style={inputStyle} />
              </label>
              {mode === 'signup' && (
                <label>
                  이름
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
                </label>
              )}
              <label>
                이메일
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
              </label>
              <label>
                비밀번호
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
              </label>
              <button onClick={handleAuth} style={primaryButton}>{mode === 'login' ? '로그인' : '회원가입'}</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginBottom: 24 }}>
            <div style={{ background: '#111827', borderRadius: 16, padding: 20, border: '1px solid #334155' }}>
              <h3>1. 현재 사용자</h3>
              <div style={{ marginTop: 12, display: 'grid', gap: 8, color: '#cbd5e1' }}>
                <div><strong>이름:</strong> {user.fullName}</div>
                <div><strong>테넌트:</strong> {user.tenantId}</div>
                <div><strong>권한:</strong> {user.role}</div>
              </div>
            </div>

            <div style={{ background: '#111827', borderRadius: 16, padding: 20, border: '1px solid #334155' }}>
              <h3>2. 분석 실행</h3>
              <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                <label>
                  사용자명
                  <input value={userName} onChange={(e) => setUserName(e.target.value)} style={inputStyle} />
                </label>
                <button onClick={createSession} style={primaryButton}>세션 생성</button>
                <div style={{ color: '#cbd5e1' }}>현재 세션: {sessionId || '없음'}</div>
                
                {sessionId && (
                  <label style={{ display: 'block', marginTop: 8 }}>
                    <div style={{ marginBottom: 4 }}>사진 촬영 및 업로드 📸</div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={inputStyle} 
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setImageFile(file);
                          setImageBase64('');
                          setCropSrc('');
                          
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setCropSrc(event.target.result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                  </label>
                )}

                {cropSrc && !imageBase64 && (
                  <div style={{ marginTop: 16, textAlign: 'center', background: '#0f172a', padding: 12, borderRadius: 12 }}>
                    <div style={{ color: '#fbbf24', marginBottom: 12, fontWeight: 'bold' }}>네모 박스를 드래그하여 분석할 얼굴을 선택하세요!</div>
                    <ReactCrop 
                      crop={crop} 
                      onChange={c => setCrop(c)} 
                      onComplete={c => setCompletedCrop(c)}
                      aspect={1}
                    >
                      <img ref={imgRef} src={cropSrc} alt="Crop preview" style={{ maxWidth: '100%', maxHeight: '50vh' }} />
                    </ReactCrop>
                    <button onClick={handleCropComplete} style={{ ...primaryButton, marginTop: 12, width: '100%' }}>
                      ✅ 얼굴 선택 완료
                    </button>
                  </div>
                )}

                {imageBase64 && !cropSrc && (
                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <img src={imageBase64} alt="미리보기" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 12, border: '2px solid #334155' }} />
                    <div style={{ color: '#10b981', fontSize: '0.85rem', marginTop: 4 }}>✅ 선택된 얼굴이 준비되었습니다!</div>
                    <button onClick={() => { setImageBase64(''); setImageFile(null); }} style={{ ...secondaryButton, marginTop: 8, fontSize: '0.8rem' }}>다시 선택</button>
                  </div>
                )}

                <button onClick={analyze} disabled={status === 'analyzing'} style={{ ...primaryButton, opacity: status !== 'analyzing' ? 1 : 0.5, marginTop: 8 }}>
                  {status === 'analyzing' ? '분석 중입니다... 잠시만 기다려주세요⏳' : '얼굴 분석 실행'}
                </button>
                <div style={{ color: '#fbbf24', minHeight: 24 }}>상태: {status}</div>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div style={{ marginTop: 30, background: '#111827', border: '1px solid #334155', borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <h3 style={{ borderBottom: '1px solid #334155', paddingBottom: 10 }}>✨ AI 관상 분석 결과 ✨</h3>
            <div style={{ marginTop: 16, display: 'grid', gap: 12, lineHeight: 1.6 }}>
              <div><strong style={{ color: '#f59e0b' }}>동물상:</strong> {result.animalType} ({result.overallScore}점)</div>
              <div><strong style={{ color: '#f59e0b' }}>인상 요약:</strong> {result.animalDescription}</div>
              <div><strong style={{ color: '#f59e0b' }}>성향:</strong> {result.personality}</div>
              <hr style={{ borderColor: '#334155', margin: '8px 0' }} />
              <div><strong style={{ color: '#10b981' }}>💰 재물운:</strong> {result.wealthLuck}</div>
              <div><strong style={{ color: '#3b82f6' }}>🏢 직업운:</strong> {result.careerLuck}</div>
              <div><strong style={{ color: '#ec4899' }}>💖 연애운:</strong> {result.loveLuck}</div>
              <div style={{ marginTop: 8, padding: 12, background: '#1e293b', borderRadius: 8 }}>
                <strong>💡 조언:</strong> {result.advice}
              </div>
            </div>
          </div>
        )}

        {user && (
          <div style={{ background: '#111827', borderRadius: 16, padding: 20, border: '1px solid #334155' }}>
            <h3>테넌트 세션 목록</h3>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: 16, display: 'grid', gap: 12 }}>
              {sessions.length === 0 ? (
                <li style={{ color: '#94a3b8' }}>생성된 세션이 없습니다.</li>
              ) : (
                sessions.map((item) => (
                  <li key={item.sessionId} style={{ background: '#0f172a', padding: 12, borderRadius: 12, border: '1px solid #1e293b' }}>
                    <div><strong>{item.userName}</strong></div>
                    <div style={{ color: '#cbd5e1', fontSize: 13 }}>Session ID: {item.sessionId}</div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>{new Date(item.createdAt).toLocaleString()}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  marginTop: 8,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #475569',
  background: '#0f172a',
  color: '#f8fafc',
};

const primaryButton = {
  background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
  color: '#111827',
  border: 'none',
  borderRadius: 12,
  padding: '12px 16px',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButton = {
  background: '#0f172a',
  color: '#f8fafc',
  border: '1px solid #334155',
  borderRadius: 12,
  padding: '10px 16px',
  fontWeight: 700,
  cursor: 'pointer',
};

const toggleButton = {
  border: '1px solid #334155',
  borderRadius: 10,
  padding: '10px 14px',
  fontWeight: 700,
  cursor: 'pointer',
};
