import React, { useState, useEffect } from 'react';
import { DoorOpen, UserCheck, LogOut, ShieldCheck, User } from 'lucide-react';

export default function SeatMapPage() {
  const [seats, setSeats] = useState([]);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [userName, setUserName] = useState('');
  const [phone, setPhone] = useState('');
  const [userType, setUserType] = useState('GENERAL'); // 'GENERAL' or 'MANAGED'
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSeats();
  }, []);

  const fetchSeats = async () => {
    try {
      const res = await fetch('/api/seats/');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSeats(data);
      } else if (data && Array.isArray(data.seats)) {
        setSeats(data.seats);
      } else {
        setSeats([]);
      }
    } catch (err) {
      console.error("Failed to fetch seats:", err);
      setSeats([]);
    }
  };


  const handleAssignSeat = async () => {
    if (!userName || !phone || !selectedSeat) {
      setMessage("이름, 전화번호 및 좌석을 선택해주세요.");
      return;
    }
    try {
      // 1. Register or update user with selected userType (GENERAL vs MANAGED)
      const userRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName, phone: phone, user_type: userType })
      });
      const userData = await userRes.json();

      // 2. Assign seat
      const assignRes = await fetch('/api/seats/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userData.id, seat_number: selectedSeat.seat_number })
      });

      if (assignRes.ok) {
        const typeText = userType === 'MANAGED' ? '관리형' : '일반';
        setMessage(`[성공] ${selectedSeat.seat_number} 좌석에 ${userData.name} (${typeText}) 배정이 완료되었습니다!`);
        fetchSeats();
        setSelectedSeat(null);
        setUserName('');
        setPhone('');
      } else {
        const errData = await assignRes.json();
        setMessage(`[오류] ${errData.detail}`);
      }
    } catch (err) {
      setMessage("좌석 배정 중 오류가 발생했습니다.");
    }
  };

  const handleCheckoutSeat = async (seatNumber) => {
    try {
      const res = await fetch(`/api/seats/leave/${seatNumber}`, { method: 'POST' });
      if (res.ok) {
        setMessage(`[성공] ${seatNumber} 좌석 퇴실 처리가 완료되었습니다.`);
        fetchSeats();
        setSelectedSeat(null);
      } else {
        setMessage("퇴실 처리 실패");
      }
    } catch (err) {
      setMessage("퇴실 처리 중 오류 발생");
    }
  };

  const handleTriggerDoor = async () => {
    try {
      const res = await fetch('/api/door/trigger/1', { method: 'POST' });
      const data = await res.json();
      setMessage(data.message);
    } catch (err) {
      setMessage("도어 개폐 요청 실패");
    }
  };

  const handleOpenSelfStudy = (phone) => {
    const baseUrl = import.meta.env.VITE_SELFSTUDY_URL || 'https://selfstudy.chicvill.store';
    const targetUrl = phone ? `${baseUrl}/?parent_code=P-${phone}` : baseUrl;
    window.open(targetUrl, '_blank');
  };

  return (
    <div>
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>실시간 좌석 현황판</h2>
          <p style={{ color: 'var(--text-muted)' }}>원하시는 좌석을 클릭하여 이용자(일반/관리형)를 입실 배정하세요.</p>
        </div>
        <button onClick={handleTriggerDoor} className="btn-primary" style={{ background: 'var(--accent-emerald)' }}>
          <DoorOpen size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          출입문 개폐 (IoT NFC)
        </button>
      </div>

      {message && (
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-blue)', color: '#60a5fa' }}>
          {message}
        </div>
      )}

      <div className="grid-2">
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>좌석배치도</h3>
            <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.8rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#60a5fa' }}></span> 일반 이용자
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#c084fc' }}></span> 관리형 이용자
              </span>
            </div>
          </div>

          <div className="grid-seat">
            {(Array.isArray(seats) ? seats : []).map((seat) => {
              const isOccupied = seat.status === 'OCCUPIED';

              const isManagedUser = seat.current_user_type === 'MANAGED';
              const isSelected = selectedSeat?.id === seat.id;

              let boxStyle = {
                boxShadow: isSelected ? '0 0 0 3px var(--accent-blue)' : 'none',
                borderColor: isOccupied
                  ? (isManagedUser ? '#c084fc' : '#60a5fa')
                  : 'rgba(255, 255, 255, 0.1)',
                background: isOccupied
                  ? (isManagedUser ? 'rgba(192, 132, 252, 0.12)' : 'rgba(96, 165, 250, 0.12)')
                  : 'var(--bg-card)'
              };

              return (
                <div
                  key={seat.id}
                  className={`seat-box ${isOccupied ? 'occupied' : ''}`}
                  onClick={() => setSelectedSeat(seat)}
                  style={boxStyle}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{seat.seat_number}</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '4px', color: isOccupied ? (isManagedUser ? '#c084fc' : '#60a5fa') : 'var(--text-muted)' }}>
                    {isOccupied
                      ? (isManagedUser ? `관리형 (${seat.current_user_name || '사용중'})` : `일반 (${seat.current_user_name || '사용중'})`)
                      : '이용 가능'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card">
          <h3>좌석 입실 & 배정하기</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            선택된 좌석: <strong style={{ color: 'var(--accent-blue)', fontSize: '1.1rem' }}>{selectedSeat ? selectedSeat.seat_number : '선택 안됨'}</strong>
          </p>

          {selectedSeat && selectedSeat.status === 'OCCUPIED' ? (
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: '#f8fafc' }}>
                현재 이용자: {selectedSeat.current_user_name || '이용 중인 사용자'}
              </div>
              <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: selectedSeat.current_user_type === 'MANAGED' ? '#c084fc' : '#60a5fa' }}>
                구분: {selectedSeat.current_user_type === 'MANAGED' ? '관리형 회원' : '일반 회원'}
              </div>
              
              {selectedSeat.current_user_type === 'MANAGED' && (
                <button
                  onClick={() => handleOpenSelfStudy(selectedSeat.current_user_phone)}
                  className="btn-primary"
                  style={{ width: '100%', marginBottom: '0.8rem', background: 'var(--accent-purple)', border: '1px solid #c084fc' }}
                >
                  <ShieldCheck size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  SelfStudy 회원 상담 열기
                </button>
              )}

              <button
                onClick={() => handleCheckoutSeat(selectedSeat.seat_number)}
                className="btn-primary"
                style={{ width: '100%', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#f87171' }}
              >
                <LogOut size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                퇴실 처리하기
              </button>
            </div>
          ) : (
            <>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500' }}>이용자 구분 (회원 유형)</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem' }}>
                <button
                  type="button"
                  onClick={() => setUserType('GENERAL')}
                  className="btn-primary"
                  style={{
                    flex: 1,
                    background: userType === 'GENERAL' ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.05)',
                    border: userType === 'GENERAL' ? '1px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff'
                  }}
                >
                  <User size={16} style={{ marginRight: '6px' }} />
                  일반 회원
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('MANAGED')}
                  className="btn-primary"
                  style={{
                    flex: 1,
                    background: userType === 'MANAGED' ? 'var(--accent-purple)' : 'rgba(255, 255, 255, 0.05)',
                    border: userType === 'MANAGED' ? '1px solid var(--accent-purple)' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff'
                  }}
                >
                  <ShieldCheck size={16} style={{ marginRight: '6px', color: '#c084fc' }} />
                  관리형 회원
                </button>
              </div>

              <label style={{ display: 'block', marginBottom: '0.4rem' }}>이름</label>
              <input
                className="input-field"
                placeholder="홍길동"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />

              <label style={{ display: 'block', marginBottom: '0.4rem', marginTop: '0.8rem' }}>전화번호</label>
              <input
                className="input-field"
                placeholder="01012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <button onClick={handleAssignSeat} className="btn-primary" style={{ width: '100%', marginTop: '1.2rem' }}>
                <UserCheck size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                입실 / 좌석 배정 완료 ({userType === 'MANAGED' ? '관리형' : '일반'})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
