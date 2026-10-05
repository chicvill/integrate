import { useState } from 'react';
import axios from 'axios';

import { API_URL } from './config';

interface LoginProps {
  onLogin: (userId: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [userId, setUserId] = useState(() => localStorage.getItem('selfstudy_saved_user_id') || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length > 3 && val.length <= 7) {
      val = val.slice(0, 3) + '-' + val.slice(3);
    } else if (val.length > 7) {
      val = val.slice(0, 3) + '-' + val.slice(3, 7) + '-' + val.slice(7, 11);
    }
    setUserId(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = userId.trim();
    const pw = password.trim();
    if (!id || !pw) {
      alert("아이디와 비밀번호를 입력해주세요.");
      return;
    }

    if (!isLoginMode && !name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    // 아이디 유효성 검사 (010-XXXX-XXXX 형태인지 확인)
    const phoneRegex = /^010-[0-9]{4}-[0-9]{4}$/;
    if (!phoneRegex.test(id)) {
      alert("고객 아이디는 전화번호(010-1234-5678) 형식이어야 합니다.");
      return;
    }

    setLoading(true);

    try {
      if (isLoginMode) {
        const res = await axios.post(`${API_URL}/knowledge/login`, { user_id: id, password: pw });
        if (res.data.success) {
          localStorage.setItem('selfstudy_saved_user_id', id);
          localStorage.setItem('selfstudy_saved_user_name', res.data.name || '');
          onLogin(id);
        } else {
          alert(res.data.message || "로그인에 실패했습니다.");
        }
      } else {
        const res = await axios.post(`${API_URL}/knowledge/signup`, { user_id: id, password: pw, name: name.trim() });
        if (res.data.success) {
          alert("회원가입이 완료되었습니다. 로그인해주세요!");
          localStorage.setItem('selfstudy_saved_user_id', id);
          setIsLoginMode(true);
          setPassword('');
          setName('');
        } else {
          alert(res.data.message || "회원가입에 실패했습니다.");
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.detail || err.message || "오류가 발생했습니다.";
      alert(`[오류 상세] ${msg}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', color: '#1976d2', marginBottom: '30px' }}>
        {isLoginMode ? '수험생 로그인' : '수험생 회원가입'}
      </h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {!isLoginMode && (
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>이름</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              placeholder="본인의 이름을 입력하세요"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>
        )}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>아이디 (전화번호)</label>
          <input 
            type="text" 
            value={userId} 
            onChange={handlePhoneChange}
            placeholder="010-1234-5678"
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>비밀번호</label>
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          style={{ background: '#1976d2', color: '#fff', padding: '15px', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? '처리 중...' : (isLoginMode ? '로그인' : '회원가입')}
        </button>
      </form>
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button 
          onClick={() => {
            setIsLoginMode(!isLoginMode);
            setName('');
            setPassword('');
          }}
          style={{ background: 'none', border: 'none', color: '#1976d2', textDecoration: 'underline', cursor: 'pointer' }}
        >
          {isLoginMode ? '계정이 없으신가요? 회원가입하기' : '이미 계정이 있으신가요? 로그인하기'}
        </button>
      </div>
    </div>
  );
}
