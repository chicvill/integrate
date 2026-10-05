import { useState, useEffect } from 'react';
import axios from 'axios';

import { API_URL } from './config';

interface ProfileEditProps {
  userId: string;
  onSaved: (newName: string) => void;
}

export default function ProfileEdit({ userId, onSaved }: ProfileEditProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await axios.get(`${API_URL}/knowledge/user/${userId}`);
        if (res.data.status === 'success' && res.data.data) {
          setName(res.data.data.name || '');
          setPassword(res.data.data.password || '');
        }
      } catch (err) {
        console.error("Failed to load user info", err);
      }
    };
    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }
    if (!password.trim()) {
      alert("비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const res = await axios.post(`${API_URL}/knowledge/user/update`, {
        user_id: userId,
        name: name.trim(),
        password: password.trim()
      });
      if (res.data.status === 'success') {
        setMessage("개인 정보가 성공적으로 수정되었습니다.");
        localStorage.setItem('selfstudy_saved_user_name', name.trim());
        setTimeout(() => {
          onSaved(name.trim());
        }, 1500);
      } else {
        setMessage(res.data.message || "정보 수정에 실패했습니다.");
      }
    } catch (err: any) {
      console.error(err);
      setMessage(err.response?.data?.detail || "오류가 발생했습니다.");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '500px', margin: '40px auto', background: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
      <h2 style={{ color: '#1976d2', marginBottom: '25px', borderBottom: '2px solid #1976d2', paddingBottom: '10px', fontSize: '20px' }}>
        👤 개인 정보 수정
      </h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>전화번호 (아이디 - 변경 불가)</label>
          <input 
            type="text" 
            value={userId} 
            disabled 
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', background: '#f5f5f5', color: '#666', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>이름</label>
          <input 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)}
            placeholder="이름을 입력하세요"
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>비밀번호</label>
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            placeholder="새 비밀번호를 입력하세요"
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          style={{ background: '#1976d2', color: '#fff', padding: '15px', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? '저장 중...' : '저장하기'}
        </button>
      </form>
      {message && (
        <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', background: message.includes('실패') || message.includes('오류') ? '#ffebee' : '#e8f5e9', color: message.includes('실패') || message.includes('오류') ? '#c62828' : '#2e7d32', textAlign: 'center', fontWeight: 'bold' }}>
          {message}
        </div>
      )}
    </div>
  );
}
