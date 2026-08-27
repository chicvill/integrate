import { useEffect, useState } from 'react';

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
  const [token, setToken] = useState(localStorage.getItem('saas-token') || '');

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
    if (!token) return;

    const res = await fetchWithAuth('/api/me');
    if (!res.ok) {
      localStorage.removeItem('saas-token');
      setToken('');
      setUser(null);
      return;
    }

    const data = await res.json();
    setUser(data.user);
    if (data.user?.tenantId) {
      setTenantId(data.user.tenantId);
      setUserName(data.user.fullName || '사용자');
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

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus('error');
      alert(data.message || '인증 실패');
      return;
    }

    localStorage.setItem('saas-token', data.token);
    setToken(data.token);
    setUser(data.user);
    setStatus('authenticated');
    setUserName(data.user.fullName || '사용자');
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

    setStatus('analyzing');
    const payload = {
      tenantId,
      sessionId,
      userName,
      imageData: 'data:image/png;base64,example',
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

    setResult(data.result);
    setStatus('done');
    await loadSessions();
  };

  const logout = () => {
    localStorage.removeItem('saas-token');
    setToken('');
    setUser(null);
    setSessionId('');
    setResult(null);
    setSessions([]);
    setStatus('idle');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a, #1f2937)',
      color: '#f8fafc',
      fontFamily: 'sans-serif',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', margin: 0 }}>AI 관상 SaaS</h1>
            <p style={{ color: '#cbd5e1', marginTop: 8 }}>
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
          <div style={{ background: '#111827', borderRadius: 16, padding: 24, border: '1px solid #334155', maxWidth: 520, marginBottom: 24 }}>
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
                <button onClick={analyze} disabled={!sessionId} style={{ ...primaryButton, opacity: sessionId ? 1 : 0.5 }}>
                  얼굴 분석 실행
                </button>
                <div style={{ color: '#fbbf24', minHeight: 24 }}>상태: {status}</div>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div style={{ marginTop: 30, background: '#111827', border: '1px solid #334155', borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <h3>분석 결과</h3>
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <div><strong>사용자:</strong> {result.userName}</div>
              <div><strong>점수:</strong> {result.score}</div>
              <div><strong>요약:</strong> {result.summary}</div>
              <div>
                <strong>특성:</strong> {result.personality.join(', ')}
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
