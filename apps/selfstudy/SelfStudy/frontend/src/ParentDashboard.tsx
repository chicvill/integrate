import { useState, useEffect } from 'react';
import axios from 'axios';

import { API_URL } from './config';

export default function ParentDashboard() {
  const [observerCode, setObserverCode] = useState("");
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [attendance, setAttendance] = useState<any[]>([]);
  const [managementType, setManagementType] = useState<string>('자율형');
  const [voucherExpiry, setVoucherExpiry] = useState<string>('');

  // 3-way messaging
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!observerCode.trim()) return;
    
    setLoading(true);
    setErrorMsg("");
    setScheduleData(null);
    setMessages([]);
    
    try {
      const resp = await axios.get(`${API_URL}/knowledge/observe/${observerCode}`);
      setScheduleData(resp.data.data);
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
      const msgsResp = await axios.get(`${API_URL}/knowledge/messages/${sessId}`);
      if (msgsResp.data.status === 'success') {
        setMessages(msgsResp.data.data);
      }
    } catch (e) {
      console.error("Failed to fetch child data", e);
    }
  };

  // Poll messages every 5 seconds if scheduleData is loaded
  useEffect(() => {
    if (scheduleData?.payload?.session_id) {
      const sessId = scheduleData.payload.session_id;
      const timer = setInterval(() => {
        axios.get(`${API_URL}/knowledge/messages/${sessId}`)
          .then(res => {
            if (res.data.status === 'success') {
              setMessages(res.data.data);
            }
          })
          .catch(e => console.error(e));
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [scheduleData]);

  const handleSendMessage = async () => {
    if (!newMsg.trim() || !scheduleData) return;
    const sessId = scheduleData.payload.session_id;
    try {
      await axios.post(`${API_URL}/knowledge/messages`, {
        session_id: sessId,
        sender_role: 'parent',
        content: newMsg.trim()
      });
      setNewMsg('');
      fetchChildData(sessId);
    } catch (err) {
      console.error(err);
      alert("메시지 전송 실패");
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
      <h2 style={{ color: '#ff9800', textAlign: 'center', marginBottom: '10px' }}>👥 학부모 참관 대시보드</h2>
      <p style={{ color: '#666', textAlign: 'center', marginBottom: '30px' }}>자녀가 공유해준 6자리 참관 코드를 입력하세요.</p>
      
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '30px' }}>
        <input 
          type="text" 
          value={observerCode}
          onChange={e => setObserverCode(e.target.value.toUpperCase())}
          placeholder="예: A1B2C3" 
          maxLength={6}
          style={{ width: '200px', padding: '12px', borderRadius: '8px', border: '2px solid #ccc', textAlign: 'center', fontSize: '18px', letterSpacing: '2px', textTransform: 'uppercase' }}
        />
        <button 
          type="submit" 
          disabled={loading || observerCode.length < 6}
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
            <div style={{ flex: 1, minWidth: '300px', background: '#f1f8e9', border: '1px solid #c5e1a5', borderRadius: '8px', display: 'flex', flexDirection: 'column', height: '350px' }}>
              <div style={{ background: '#33691e', padding: '12px 15px', borderRadius: '8px 8px 0 0', color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>
                💬 3자 소통방 (관리자/자녀 피드백 주고받기)
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#f9fbe7' }}>
                {messages.map(m => {
                  const isSelf = m.sender_role === 'parent';
                  let roleLabel = '이용자(학생)';
                  if (m.sender_role === 'admin') roleLabel = '관리자';
                  if (m.sender_role === 'parent') roleLabel = '학부모(나)';

                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: isSelf ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '85%', padding: '8px 12px', borderRadius: '12px',
                        background: isSelf ? '#33691e' : '#fff',
                        color: isSelf ? '#fff' : '#333',
                        border: '1px solid #dcdde1',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        fontSize: '12px'
                      }}>
                        <div style={{ fontSize: '9px', color: isSelf ? '#c5e1a5' : '#888', marginBottom: '3px', fontWeight: 'bold' }}>
                          {roleLabel}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <div style={{ color: '#999', textAlign: 'center', marginTop: '80px', fontSize: '12px' }}>대화 내역이 없습니다.</div>
                )}
              </div>
              <div style={{ padding: '8px', borderTop: '1px solid #c5e1a5', background: '#fff', borderRadius: '0 0 8px 8px', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="관리자에게 전달할 메모 입력..."
                  style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc', outline: 'none', fontSize: '12px' }}
                />
                <button
                  onClick={handleSendMessage}
                  style={{ background: '#33691e', color: '#fff', border: 'none', padding: '0 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                >
                  전송
                </button>
              </div>
            </div>

          </div>
          
          <div style={{ textAlign: 'center', color: '#888', fontSize: '13px' }}>
            ※ 학부모 참관 모드에서는 자녀의 체크리스트를 임의로 수정할 수 없습니다.
          </div>
        </div>
      )}
    </div>
  );
}
