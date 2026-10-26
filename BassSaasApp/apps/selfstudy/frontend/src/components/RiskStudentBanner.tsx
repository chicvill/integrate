import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface RiskStudentBannerProps {
  onSelectStudent: (sessionId: string) => void;
}

export default function RiskStudentBanner({ onSelectStudent }: RiskStudentBannerProps) {
  const [riskStudents, setRiskStudents] = useState<any[]>([]);

  const fetchRiskStudents = async () => {
    try {
      const res = await axios.get(`${API_URL}/knowledge/admin_risk_students`);
      if (res.data.status === 'success') {
        setRiskStudents(res.data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch risk students", e);
    }
  };

  useEffect(() => {
    fetchRiskStudents();
    const timer = setInterval(fetchRiskStudents, 10000);
    return () => clearInterval(timer);
  }, []);

  if (riskStudents.length === 0) return null;

  return (
    <div style={{ background: '#ffebee', border: '1px solid #ffcdd2', padding: '15px 20px', borderRadius: '10px' }}>
      <div style={{ fontWeight: 'bold', color: '#d32f2f', fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        🚨 AI 집중 케어가 필요한 수험생 (최근 3일 진도 완료율 50% 미만): {riskStudents.length}명
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {riskStudents.map((st, idx) => (
          <div key={idx} style={{ background: '#fff', padding: '8px 14px', borderRadius: '8px', border: '1px solid #ffcdd2', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div>
              <span style={{ fontWeight: 'bold', color: '#333' }}>{st.name}</span>
              <span style={{ fontSize: '12px', color: '#d32f2f', fontWeight: 'bold', marginLeft: '6px' }}>
                (완료율 {st.completion_rate}%)
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (st.session_id) {
                  onSelectStudent(st.session_id);
                }
              }}
              style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
            >
              1:1 상담 💬
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
