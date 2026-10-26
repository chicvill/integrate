import React, { useState, useEffect } from 'react';
import { Thermometer, Droplets, Wind, Sun, Sprout, Activity } from 'lucide-react';

export default function MonitoringPage() {
  const [sensor, setSensor] = useState(null);

  useEffect(() => {
    fetchSensorData();
    const interval = setInterval(fetchSensorData, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchSensorData = async () => {
    try {
      const res = await fetch('/api/sensors/current');
      const data = await res.json();
      setSensor(data);
    } catch (err) {
      console.error("Failed to fetch sensor data:", err);
    }
  };

  return (
    <div>
      <div className="glass-card">
        <h2>실시간 센서 관제 모니터링 (IoT Telemetry)</h2>
        <p style={{ color: 'var(--text-muted)' }}>스마트팜 내부 온습도, CO2, 조도, 토양 수분 및 pH 수치를 3초 주기로 수집합니다.</p>
      </div>

      <div className="grid-4">
        <div className="sensor-card">
          <Thermometer color="#f87171" size={28} style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>내부 온도</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#f87171', marginTop: '4px' }}>
            {sensor ? `${sensor.temperature}°C` : '로딩중...'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>목표: 24.0°C</div>
        </div>

        <div className="sensor-card">
          <Droplets color="#38bdf8" size={28} style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>상대 습도</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '4px' }}>
            {sensor ? `${sensor.humidity}%` : '로딩중...'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>목표: 65.0%</div>
        </div>

        <div className="sensor-card">
          <Wind color="#a78bfa" size={28} style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>CO2 농도</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#a78bfa', marginTop: '4px' }}>
            {sensor ? `${sensor.co2_ppm} ppm` : '로딩중...'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>권장: 450~700 ppm</div>
        </div>

        <div className="sensor-card">
          <Sun color="#fbbf24" size={28} style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>일사/조도</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fbbf24', marginTop: '4px' }}>
            {sensor ? `${sensor.light_lux.toLocaleString()} lux` : '로딩중...'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>광합성 조도 충족</div>
        </div>

        <div className="sensor-card">
          <Sprout color="#34d399" size={28} style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>토양 함수율</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#34d399', marginTop: '4px' }}>
            {sensor ? `${sensor.soil_moisture}%` : '로딩중...'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>적정 수분 범위</div>
        </div>

        <div className="sensor-card">
          <Activity color="#22d3ee" size={28} style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>양액 pH 농도</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#22d3ee', marginTop: '4px' }}>
            {sensor ? `${sensor.ph_level} pH` : '로딩중...'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>약산성 산도 (안정)</div>
        </div>
      </div>
    </div>
  );
}
