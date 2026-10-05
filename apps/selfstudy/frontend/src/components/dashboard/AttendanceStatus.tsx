import { useMemo } from 'react';

interface AttendanceStatusProps {
  managementType: string;
  attendance: any[];
}

export default function AttendanceStatus({ managementType, attendance }: AttendanceStatusProps) {
  const checkIsTardy = (actualIn: string | null, scheduledIn: string | null) => {
    if (!actualIn || !scheduledIn) return false;
    const [actH, actM] = actualIn.split(':').map(Number);
    const [schH, schM] = scheduledIn.split(':').map(Number);
    const actualMins = actH * 60 + actM;
    const scheduledMins = schH * 60 + schM;
    return actualMins > (scheduledMins + 10);
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayAttendance = useMemo(() => attendance.find(a => a.date === todayStr) || {}, [attendance, todayStr]);

  return (
    <div style={{ background: '#fff', padding: '20px 30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', flexShrink: 0 }}>
      <h3 style={{ color: managementType === '관리형' ? '#1976d2' : '#616161', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        📅 나의 등하원 및 관리 현황
        {managementType === '관리형' && (
          <span style={{ fontSize: '12px', fontWeight: 'normal', padding: '3px 8px', borderRadius: '10px', background: '#ffe0b2', color: '#e65100' }}>
            관리형 이용자
          </span>
        )}
      </h3>

      {managementType === '관리형' ? (
        <>
          {/* 오늘 등하원 체크 및 상태 표시 */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', background: '#f8f9fa', padding: '15px 20px', borderRadius: '8px', border: '1px solid #e0e0e0', marginBottom: '15px' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <span style={{ fontSize: '13px', color: '#666' }}>오늘의 등원 정보: </span>
              <strong style={{ color: '#4caf50' }}>{todayAttendance.check_in_time || '미등록'}</strong>
              <span style={{ margin: '0 15px', color: '#ddd' }}>|</span>
              <span style={{ fontSize: '13px', color: '#666' }}>오늘의 하원 정보: </span>
              <strong style={{ color: '#f44336' }}>{todayAttendance.check_out_time || '미등록'}</strong>
            </div>

            <div style={{ fontSize: '13px', color: '#e65100', fontWeight: 'bold' }}>
              {todayAttendance.consult_checked ? (
                <span>✅ 관리자 5분 메타인지 상담 완료</span>
              ) : (
                <span>⏳ 관리자 등하원 및 상담 대기 중</span>
              )}
            </div>
          </div>

          {/* 특이사항(상담 일지) 표시 */}
          {todayAttendance.consult_note && (
            <div style={{ background: '#fff8e1', border: '1px solid #ffe082', padding: '12px 15px', borderRadius: '8px', fontSize: '13px', color: '#b78103', marginBottom: '15px' }}>
              <strong>오늘의 메타인지 상담 피드백:</strong> {todayAttendance.consult_note}
            </div>
          )}

          {/* 최근 출석 이력 리스트 */}
          <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ background: '#f5f5f5', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>날짜</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>등원 시간</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>하원 시간</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>5분 상담</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>피드백</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map(h => {
                  const isTardy = checkIsTardy(h.check_in_time, h.scheduled_in_time);
                  return (
                    <tr key={h.id} style={{ borderBottom: '1px solid #eee', background: isTardy ? '#fffde7' : '#fff' }}>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}>{h.date}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{h.check_in_time || '-'}</span>
                        {h.scheduled_in_time && <span style={{ fontSize: '11px', color: '#888', marginLeft: '5px' }}>({h.scheduled_in_time})</span>}
                        {isTardy && (
                          <span style={{ marginLeft: '6px', background: '#d32f2f', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '4px', fontWeight: 'bold' }}>
                            지각 경고
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#f44336' }}>
                        <span>{h.check_out_time || '-'}</span>
                        {h.scheduled_out_time && <span style={{ fontSize: '11px', color: '#888', marginLeft: '5px' }}>({h.scheduled_out_time})</span>}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold', color: h.consult_checked ? 'green' : 'red' }}>
                        {h.consult_checked ? '완료' : '미완료'}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#666' }}>{h.consult_note || '-'}</td>
                    </tr>
                  );
                })}
                {attendance.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>출석 및 상담 내역이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div style={{ background: '#f9f9f9', border: '1px dashed #cccccc', padding: '22px 20px', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '30px' }}>🔒</div>
          <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#333' }}>
            1:1 대면 등하원 밀착 케어 & 5분 메타인지 상담 피드백
          </div>
          <div style={{ fontSize: '13px', color: '#666', maxWidth: '480px', lineHeight: '1.5' }}>
            등하원 시간 실시간 체크, 지각 경고 알림, 관리자 1:1 메타인지 구두 테스트 및 매일 피드백 일지가 제공되는 관리형 전용 서비스입니다.
          </div>
          <span style={{ background: '#fff3e0', color: '#e65100', padding: '6px 14px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #ffe0b2', marginTop: '4px' }}>
            🎒 관리자 문의를 통해 관리형 전환 시 혜택이 제공됩니다
          </span>
        </div>
      )}
    </div>
  );
}
