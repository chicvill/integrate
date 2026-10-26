import { useState, useEffect } from 'react';
import axios from 'axios';

import { API_URL } from './config';
import ThreeWayChat from './components/ThreeWayChat';

export default function ParentDashboard() {
  const [observerCode, setObserverCode] = useState("");
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [attendance, setAttendance] = useState<any[]>([]);
  const [managementType, setManagementType] = useState<string>('자율형');
  const [voucherExpiry, setVoucherExpiry] = useState<string>('');

  const doFetchObserverCode = async (code: string) => {
    if (!code.trim()) return;
    const cleanCode = code.trim();
    setObserverCode(cleanCode);
    setLoading(true);
    setErrorMsg("");
    setScheduleData(null);
    try {
      const resp = await axios.get(`${API_URL}/knowledge/observe/${cleanCode}`);
      setScheduleData(resp.data.data);
      localStorage.setItem('selfstudy_parent_code', cleanCode);
      if (resp.data.data.payload?.spreadsheet_data?.subjects?.length > 0) {
        setSelectedSubject(resp.data.data.payload.spreadsheet_data.subjects[0].subject_name);
      }
      const sessId = resp.data.data.payload?.session_id;
      if (sessId) {
        await fetchChildData(sessId);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "코드를 찾을 수 없습니다.");
    }
    setLoading(false);
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('parent_code') || urlParams.get('observer_code') || urlParams.get('code');
    const savedCode = localStorage.getItem('selfstudy_parent_code');
    const targetCode = codeParam || savedCode;
    if (targetCode) {
      doFetchObserverCode(targetCode.trim());
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    doFetchObserverCode(observerCode);
  };

  const fetchChildData = async (sessId: string) => {
    try {
      const attResp = await axios.get(`${API_URL}/knowledge/attendance/${sessId}`);
      if (attResp.data.status === 'success') {
        setAttendance(attResp.data.data);
      }
      const profResp = await axios.get(`${API_URL}/knowledge/profile/${sessId}`);
      if (profResp.data.data) {
        setManagementType(profResp.data.data['관리방식'] || '자율형');
        setVoucherExpiry(profResp.data.data['이용권만료일'] || '');
      }
    } catch (e) {
      console.error("Failed to fetch child data", e);
    }
  };

  const getRemainingVoucherDays = () => {
    if (!voucherExpiry) return null;
    const expiry = new Date(voucherExpiry);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const checkIsTardy = (_dateStr: string, actualIn: string | null, scheduledIn: string | null) => {
    if (!actualIn || !scheduledIn) return false;
    const [actH, actM] = actualIn.split(':').map(Number);
    const [schH, schM] = scheduledIn.split(':').map(Number);
    const actualMins = actH * 60 + actM;
    const scheduledMins = schH * 60 + schM;
    return actualMins > (scheduledMins + 10);
  };

  const payload = scheduleData?.payload || {};
  let flatTasks: any[] = [];
  payload.curriculum?.forEach((week: any) => {
    week.daily_tasks?.forEach((task: any, idx: number) => {
      flatTasks.push({ week_number: week.week_number, task_index: idx, ...task });
    });
  });

  const filteredTasks = flatTasks.filter((t: any) => t.subject === selectedSubject);
  const remainingDays = getRemainingVoucherDays();

  return (
    <div style={{ maxWidth: '1200px', margin: '40px auto', padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
      {/* 즐겨찾기 / 홈 화면 추가 안내 배너 */}
      <div style={{
        background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
        color: '#e65100',
        border: '1px solid #ffcc80',
        padding: '14px 20px',
        borderRadius: '10px',
        marginBottom: '20px',
        fontSize: '13px',
        lineHeight: '1.5',
        boxShadow: '0 2px 8px rgba(230,81,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{ fontSize: '24px', flexShrink: 0 }}>⭐</div>
        <div>
          <strong style={{ fontSize: '14px' }}>[학부모님 필수 팁] 이 페이지를 즐겨찾기 또는 홈 화면에 추가하세요!</strong><br/>
          스마트폰 브라우저 메뉴에서 <strong>[즐겨찾기]</strong> 또는 <strong>[홈 화면에 추가]</strong>해 두시면, 매번 로그인이나 코드 입력 없이 언제든지 자녀의 실시간 학습 현황과 출석 일지를 바로 확인하실 수 있습니다.
        </div>
      </div>

      <h2 style={{ color: '#ff9800', textAlign: 'center', marginBottom: '10px' }}>👥 학부모 참관 대시보드</h2>
      <p style={{ color: '#666', textAlign: 'center', marginBottom: '30px' }}>자녀가 공유해준 참관 코드 (예: P-010-1234-5678)를 입력하세요.</p>
      
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '30px' }}>
        <input 
          type="text" 
          value={observerCode}
          onChange={e => setObserverCode(e.target.value.toUpperCase())}
          placeholder="예: P-010-1234-5678" 
          maxLength={20}
          style={{ width: '260px', padding: '12px', borderRadius: '8px', border: '2px solid #ccc', textAlign: 'center', fontSize: '16px', letterSpacing: '1px', textTransform: 'uppercase' }}
        />
        <button 
          type="submit" 
          disabled={loading || !observerCode.trim()}
          style={{ background: '#ff9800', color: '#fff', border: 'none', padding: '0 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
        >
          {loading ? '조회 중...' : '조회하기'}
        </button>
      </form>

      {errorMsg && <div style={{ color: 'red', textAlign: 'center', marginBottom: '20px' }}>{errorMsg}</div>}

      {scheduleData && (
        <div style={{ background: '#fff8e1', padding: '25px', borderRadius: '12px', border: '1px solid #ffe082', display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {/* 상단 이용권 안내 배너 */}
          {remainingDays !== null && (
            <div style={{
              background: remainingDays <= 3 ? '#ffebee' : '#fffde7',
              color: remainingDays <= 3 ? '#c62828' : '#e65100',
              border: `1px solid ${remainingDays <= 3 ? '#ffcdd2' : '#ffd54f'}`,
              padding: '12px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>💳 이용자(학생) 정기 이용권 정보: 만료일 ({voucherExpiry})까지 {remainingDays}일 남았습니다.</span>
              {remainingDays <= 7 && <span style={{ fontSize: '11px', color: '#d32f2f' }}>(만료 임박 - 재등록 필요)</span>}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ffcc80', paddingBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#e65100' }}>{scheduleData.payload.plan_title || "진도 계획"}</h3>
            <span style={{ background: '#ffcc80', color: '#e65100', padding: '5px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
              🔒 읽기 전용 (참관 모드)
            </span>
          </div>
          
          <div style={{ fontSize: '14px', color: '#333' }}>
            <strong>학습 전략:</strong> {scheduleData.payload.overall_strategy}
          </div>

          {/* 과목 탭 */}
          <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '5px' }}>
            {(payload.spreadsheet_data?.subjects || []).map((subj: any) => (
              <button
                key={subj.subject_name}
                onClick={() => setSelectedSubject(subj.subject_name)}
                style={{
                  background: selectedSubject === subj.subject_name ? '#e65100' : '#ffe082',
                  color: selectedSubject === subj.subject_name ? '#fff' : '#e65100',
                  border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer',
                  fontWeight: selectedSubject === subj.subject_name ? 'bold' : 'normal',
                  whiteSpace: 'nowrap', fontSize: '15px'
                }}
              >
                {subj.subject_name}
              </button>
            ))}
          </div>

          {/* 스크롤 가능한 일자별 리스트 */}
          <div style={{ height: '260px', overflowY: 'auto', border: '1px solid #ffe082', borderRadius: '8px', background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#ffcc80', color: '#e65100', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #ffb74d' }}>일자 (요일)</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid #ffb74d' }}>배정시간</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #ffb74d' }}>단원명</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid #ffb74d' }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task, idx) => {
                  const isChecked = task.completed;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #fff3e0', background: isChecked ? '#fafafa' : '#fff', height: '42px' }}>
                      <td style={{ padding: '8px 12px', color: '#555', fontWeight: 'bold' }}>{task.date} ({(typeof task.day === 'string' && task.day.includes('- ')) ? task.day.split('- ')[1] : task.day || '?'})</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#888' }}>{task.estimated_minutes}분</td>
                      <td style={{ padding: '8px 12px', color: isChecked ? '#aaa' : '#333', textDecoration: isChecked ? 'line-through' : 'none' }}>{task.task_title || task.unit_name}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {isChecked ? <span style={{ color: '#4caf50', fontWeight: 'bold' }}>✅ 완료</span> : <span style={{ color: '#ccc' }}>진행 전</span>}
                      </td>
                    </tr>
                  );
                })}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>해당 과목의 일정이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 하단 배치: 출결현황 (Left 60%) & 3자 실시간 대화창 (Right 40%) */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            
            {/* 자녀 등하원 및 관리 현황 */}
            <div style={{ flex: 1.5, minWidth: '350px', background: '#fff', border: '1px solid #ffe082', borderRadius: '8px', padding: '20px' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#e65100', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                📅 자녀 등하원 및 관리 현황 
                <span style={{ fontSize: '11px', background: managementType === '관리형' ? '#ffe0b2' : '#e0e0e0', color: managementType === '관리형' ? '#e65100' : '#666', padding: '2px 6px', borderRadius: '4px' }}>
                  {managementType === '관리형' ? '관리형 이용자' : '자율형 이용자'}
                </span>
              </h4>
              
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', background: '#fffde7', padding: '15px', borderRadius: '8px', border: '1px solid #fff59d', marginBottom: '15px' }}>
                <div style={{ flex: 1, fontSize: '13px' }}>
                  <span>등원 정보: </span>
                  <strong style={{ color: '#4caf50' }}>{attendance[0]?.date === new Date().toISOString().split('T')[0] && attendance[0]?.check_in_time ? attendance[0].check_in_time : '미등록'}</strong>
                  <span style={{ margin: '0 10px', color: '#ddd' }}>|</span>
                  <span>하원 정보: </span>
                  <strong style={{ color: '#f44336' }}>{attendance[0]?.date === new Date().toISOString().split('T')[0] && attendance[0]?.check_out_time ? attendance[0].check_out_time : '미등록'}</strong>
                </div>
                {managementType === '관리형' && (
                  <div style={{ fontSize: '12px', color: '#e65100', fontWeight: 'bold' }}>
                    {attendance[0]?.date === new Date().toISOString().split('T')[0] && attendance[0]?.consult_checked ? (
                      <span>✅ 5분 메타인지 상담 완료</span>
                    ) : (
                      <span>⏳ 상담 진행 대기 중</span>
                    )}
                  </div>
                )}
              </div>

              {managementType === '관리형' && attendance[0]?.date === new Date().toISOString().split('T')[0] && attendance[0]?.consult_note && (
                <div style={{ background: '#fffde7', border: '1px solid #fff59d', padding: '12px 15px', borderRadius: '8px', fontSize: '13px', color: '#b78103', marginBottom: '15px' }}>
                  <strong>원장(관리자) 상담 피드백:</strong> {attendance[0].consult_note}
                </div>
              )}

              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #ffe082', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ background: '#fff8e1' }}>
                    <tr>
                      <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ffd54f' }}>날짜</th>
                      <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ffd54f' }}>등원 시간</th>
                      <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ffd54f' }}>하원 시간</th>
                      {managementType === '관리형' && <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ffd54f' }}>5분 상담</th>}
                      {managementType === '관리형' && <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ffd54f' }}>피드백</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map(h => {
                      const isTardy = checkIsTardy(h.date, h.check_in_time, h.scheduled_in_time);
                      return (
                        <tr key={h.id} style={{ borderBottom: '1px solid #fff3e0', background: isTardy ? '#fffde7' : '#fff' }}>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{h.date}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{h.check_in_time || '-'}</span>
                            {h.scheduled_in_time && <span style={{ fontSize: '10px', color: '#888', marginLeft: '4px' }}>({h.scheduled_in_time})</span>}
                            {isTardy && (
                              <span style={{ marginLeft: '6px', background: '#d32f2f', color: '#fff', fontSize: '9px', padding: '2px 4px', borderRadius: '4px', fontWeight: 'bold' }}>
                                지각
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center', color: '#f44336' }}>
                            <span>{h.check_out_time || '-'}</span>
                            {h.scheduled_out_time && <span style={{ fontSize: '10px', color: '#888', marginLeft: '4px' }}>({h.scheduled_out_time})</span>}
                          </td>
                          {managementType === '관리형' && (
                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: h.consult_checked ? 'green' : 'red' }}>
                              {h.consult_checked ? '완료' : '미완료'}
                            </td>
                          )}
                          {managementType === '관리형' && <td style={{ padding: '8px', color: '#666' }}>{h.consult_note || '-'}</td>}
                        </tr>
                      );
                    })}
                    {attendance.length === 0 && (
                      <tr>
                        <td colSpan={managementType === '관리형' ? 5 : 3} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>출석 및 상담 내역이 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3자 실시간 메시지 소통 */}
            <ThreeWayChat sessionId={scheduleData?.payload?.session_id || ''} currentUserRole="parent" showEncouragementCards={true} />
          </div>
          
          <div style={{ textAlign: 'center', color: '#888', fontSize: '13px' }}>
            ※ 학부모 참관 모드에서는 자녀의 체크리스트를 임의로 수정할 수 없습니다.
          </div>
        </div>
      )}
    </div>
  );
}
