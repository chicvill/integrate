import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from './config';

interface LoginProps {
  onLogin: (userId: string) => void;
  onOpenParentView?: (parentCode: string) => void;
}

export default function Login({ onLogin, onOpenParentView }: LoginProps) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [userId, setUserId] = useState(() => localStorage.getItem('selfstudy_saved_user_id') || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 010-XXXX-XXXX 또는 P-010-XXXX-XXXX 형식 지원
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    // P- 접두사가 들어온 경우
    if (raw.toUpperCase().startsWith('P-')) {
      let digits = raw.slice(2).replace(/[^0-9]/g, '');
      let formatted = 'P-';
      if (digits.length > 3 && digits.length <= 7) {
        formatted += digits.slice(0, 3) + '-' + digits.slice(3);
      } else if (digits.length > 7) {
        formatted += digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7, 11);
      } else {
        formatted += digits;
      }
      setUserId(formatted);
      setErrorMessage('');
      return;
    }

    // 숫지만 있는 일반 전화번호 형식
    let val = raw.replace(/[^0-9]/g, '');
    if (val.length > 3 && val.length <= 7) {
      val = val.slice(0, 3) + '-' + val.slice(3);
    } else if (val.length > 7) {
      val = val.slice(0, 3) + '-' + val.slice(3, 7) + '-' + val.slice(7, 11);
    }
    setUserId(val);
    setErrorMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const id = userId.trim();
    const pw = password.trim();
    const userName = name.trim();

    if (id.toUpperCase().startsWith('P-')) {
      if (onOpenParentView) {
        onOpenParentView(id);
        return;
      }
    }

    if (!pw) {
      setErrorMessage('비밀번호를 입력해 주세요.');
      return;
    }
    if (!isLoginMode && !userName) {
      setErrorMessage('회원가입 시 성함을 입력해 주세요.');
      return;
    }

    // 입력받은 아이디가 11자리 숫자일 경우 자동으로 하이픈 추가
    let formattedId = id;
    if (/^010[0-9]{8}$/.test(formattedId)) {
      formattedId = formattedId.slice(0, 3) + '-' + formattedId.slice(3, 7) + '-' + formattedId.slice(7, 11);
    }

    const phoneRegex = /^010-[0-9]{4}-[0-9]{4}$/;
    if (!phoneRegex.test(formattedId)) {
      setErrorMessage('아이디는 전화번호(010-1234-5678) 또는 참관 코드(P-010-1234-5678) 형식이어야 합니다.');
      return;
    }

    setLoading(true);

    try {
      if (isLoginMode) {
        // 로그인 처리
        const endpoint = `${API_URL}/knowledge/login`;
        const res = await axios.post(endpoint, { user_id: formattedId, password: pw }, { timeout: 10000 });

        if (res.data && res.data.success) {
          localStorage.setItem('selfstudy_saved_user_id', formattedId);
          if (res.data.name) {
            localStorage.setItem('selfstudy_saved_user_name', res.data.name);
          }
          onLogin(formattedId);
        } else {
          setErrorMessage(res.data.message || '아이디 또는 비밀번호가 올바르지 않습니다.');
        }
      } else {
        // 회원가입 처리
        const endpoint = `${API_URL}/knowledge/signup`;
        const res = await axios.post(endpoint, { user_id: formattedId, password: pw, name: userName }, { timeout: 10000 });

        if (res.data && res.data.success) {
          setSuccessMessage('🎉 회원가입이 성공적으로 완료 되었습니다! 이제 로그인해 주세요.');
          localStorage.setItem('selfstudy_saved_user_id', formattedId);
          setIsLoginMode(true);
          setPassword('');
          setName('');
        } else {
          setErrorMessage(res.data.message || '이미 등록된 아이디이거나 회원가입에 실패했습니다.');
        }
      }
    } catch (err: any) {
      console.error('[AUTH ERR]', err);
      if (err.code === 'ERR_NETWORK' || !err.response) {
        setErrorMessage('🌐 서버 연결 실패 (Network Error): 백엔드 API 서버가 켜져 있는지 확인해 주세요.');
      } else {
        const detail = err.response?.data?.detail || err.response?.data?.message || err.message;
        setErrorMessage(`오류 발생: ${detail}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdminQuickFill = () => {
    setUserId('010-1111-2222');
    setPassword('1212');
    setIsLoginMode(true);
    setErrorMessage('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'rgba(30, 41, 59, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        padding: '36px 32px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc'
      }}>
        {/* 서비스 타이틀 */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.4)',
            marginBottom: '16px',
            fontSize: '28px'
          }}>
            📚
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 6px 0', letterSpacing: '-0.5px', color: '#ffffff' }}>
            SelfStudy Platform
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
            메타인지 기반 AI 맞춤형 학습 플래너
          </p>
        </div>

        {/* 로그인 / 회원가입 탭 탭 바 */}
        <div style={{
          display: 'flex',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '24px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <button
            type="button"
            onClick={() => { setIsLoginMode(true); setErrorMessage(''); setSuccessMessage(''); }}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: '8px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: isLoginMode ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
              color: isLoginMode ? '#ffffff' : '#94a3b8',
              boxShadow: isLoginMode ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none'
            }}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => { setIsLoginMode(false); setErrorMessage(''); setSuccessMessage(''); }}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: '8px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: !isLoginMode ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
              color: !isLoginMode ? '#ffffff' : '#94a3b8',
              boxShadow: !isLoginMode ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none'
            }}
          >
            회원가입
          </button>
        </div>

        {/* 에러 및 성공 메세지 바 */}
        {errorMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '13px',
            color: '#fca5a5',
            marginBottom: '20px',
            lineHeight: '1.5'
          }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {successMessage && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '13px',
            color: '#86efac',
            marginBottom: '20px',
            lineHeight: '1.5'
          }}>
            {successMessage}
          </div>
        )}

        {/* 폼 영역 */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {!isLoginMode && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                수험생 이름
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="홍길동"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
              아이디 (전화번호)
            </label>
            <input
              type="text"
              value={userId}
              onChange={handlePhoneChange}
              placeholder="010-1234-5678"
              maxLength={13}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '6px',
              padding: '14px',
              borderRadius: '10px',
              border: 'none',
              background: loading ? '#475569' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: '700',
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
              transition: 'transform 0.1s ease, box-shadow 0.2s ease'
            }}
          >
            {loading ? '처리 중...' : (isLoginMode ? '로그인하기' : '가입 완료하기')}
          </button>
        </form>

        {/* 퀵 관리자 및 학부모 참관 채우기 팁 */}
        {isLoginMode && (
          <div style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px dashed rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            textAlign: 'center'
          }}>
            {onOpenParentView && (
              <button
                type="button"
                onClick={() => onOpenParentView(userId.trim())}
                style={{
                  background: 'linear-gradient(135deg, #ff9800 0%, #ed6c02 100%)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '11px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(237, 108, 2, 0.25)'
                }}
              >
                👥 학부모 참관 대시보드로 바로 이동
              </button>
            )}
            
            <button
              type="button"
              onClick={handleAdminQuickFill}
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#60a5fa',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              💡 관리자 테스트 계정 자동입력 (010-1111-2222)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
