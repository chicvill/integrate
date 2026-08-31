import React, { useState, useEffect } from 'react';
import { Sliders, Power, RefreshCw } from 'lucide-react';

export default function ControlPage() {
  const [actuators, setActuators] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchActuators();
  }, []);

  const fetchActuators = async () => {
    try {
      const res = await fetch('/api/actuators/');
      const data = await res.json();
      setActuators(data);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleActuator = async (actuatorName, currentStatus) => {
    try {
      const res = await fetch('/api/actuators/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actuator_name: actuatorName,
          is_on: !currentStatus,
          mode: 'MANUAL'
        })
      });
      if (res.ok) {
        setMsg(`[제어 신호 전송] ${actuatorName} -> ${!currentStatus ? '가동 (ON)' : '정지 (OFF)'}`);
        fetchActuators();
      }
    } catch (err) {
      setMsg("제어 신호 전송 실패");
    }
  };

  return (
    <div>
      <div className="glass-card">
        <h2>스마트팜 구동 장비 제어 (IoT Actuator Control)</h2>
        <p style={{ color: 'var(--text-muted)' }}>환기 팬, 히터, 보광 LED, 관수 펌프 및 양액 투입기를 수동 또는 자동 모드로 제어합니다.</p>
      </div>

      {msg && (
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-emerald)', color: '#34d399' }}>
          {msg}
        </div>
      )}

      <div className="grid-2">
        {actuators.map((act) => (
          <div key={act.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{act.actuator_name}</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>제어 모드: {act.mode}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                fontWeight: 'bold',
                background: act.is_on ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                color: act.is_on ? '#34d399' : '#f43f5e'
              }}>
                {act.is_on ? 'ON (가동중)' : 'OFF (정지)'}
              </span>

              <button
                onClick={() => toggleActuator(act.actuator_name, act.is_on)}
                className="btn-primary"
                style={{
                  background: act.is_on ? '#f43f5e' : 'var(--accent-emerald)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Power size={16} />
                {act.is_on ? 'OFF 스위치' : 'ON 스위치'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
