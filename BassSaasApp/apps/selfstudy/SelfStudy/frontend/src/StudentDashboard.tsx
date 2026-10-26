import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from './config';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface StudentDashboardProps {
  sessionId: string;
  onReschedule: () => void;
}

export default function StudentDashboard({ sessionId, onReschedule: _onReschedule }: StudentDashboardProps) {
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  
  // Chat Evaluation States
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: "안녕하세요! 오늘의 진도 점검을 도와드릴 AI입니다.\n위 리스트에서 [🎙️ 평가받기] 버튼을 눌러 평가를 시작해보세요."
  }]);
  const [inputMsg, setInputMsg] = useState("");
  const [evaluatingTaskInfo, setEvaluatingTaskInfo] = useState<{week_number: number, task_index: number, task_title: string} | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // 성취율 상태
  const [achievementRates, setAchievementRates] = useState<Record<string, number>>({});
  const [attendance, setAttendance] = useState<any[]>([]);
  const [managementType, setManagementType] = useState<string>('자율형');
  const [scheduledTimes, setScheduledTimes] = useState<any>({});
  const [voucherExpiry, setVoucherExpiry] = useState<string>('');

  // 3-way messaging
  const [messagesList, setMessagesList] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSchedule = async () => {
    try {
      const resp = await axios.get(`${API_URL}/knowledge/student/${sessionId}`);
      if (resp.data.data) {
        setSchedule(resp.data.data);
        if (resp.data.data.payload?.spreadsheet_data?.subjects?.length > 0) {
          setSelectedSubject(resp.data.data.payload.spreadsheet_data.subjects[0].subject_name);
        }
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchAttendance = async () => {
    try {
      const resp = await axios.get(`${API_URL}/knowledge/attendance/${sessionId}`);
      if (resp.data.status === 'success') {
        setAttendance(resp.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProfile = async () => {
    try {
      const resp = await axios.get(`${API_URL}/knowledge/profile/${sessionId}`);
      if (resp.data.data) {
        setManagementType(resp.data.data['관리방식'] || '자율형');
        setScheduledTimes(resp.data.data['등하원예약시간'] || {});
        setVoucherExpiry(resp.data.data['이용권만료일'] || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessagesList = async () => {
    try {
      const res = await axios.get(`${API_URL}/knowledge/messages/${sessionId}`);
      if (res.data.status === 'success') {
        setMessagesList(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchSchedule();
      fetchAttendance();
      fetchProfile();
      fetchMessagesList();
      const timer = setInterval(fetchMessagesList, 5000);
      return () => clearInterval(timer);
    }
  }, [sessionId]);

  const toggleTask = async (weekNum: number, taskIdx: number, forceCompleted?: boolean) => {
    if (!schedule) return;
    
    const newSchedule = { ...schedule };
    const week = newSchedule.payload.curriculum.find((w: any) => w.week_number === weekNum);
    const task = week.daily_tasks[taskIdx];
    const newCompleted = forceCompleted !== undefined ? forceCompleted : !task.completed;
    task.completed = newCompleted;
    setSchedule(newSchedule);
    
    try {
      await axios.patch(`${API_URL}/knowledge/schedule/${schedule.doc_id}/task`, {
        week_number: weekNum,
        task_index: taskIdx,
        completed: newCompleted
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAutoReschedule = async () => {
    if (!window.confirm("진도가 밀린 미완료 일정만 오늘부터 남은 기간 동안 다시 배정합니다.\n완료한 진도 내역은 안전하게 보존됩니다. 진행하시겠습니까?")) {
      return;
    }
    
    setLoading(true);
    try {
      const resp = await axios.post(`${API_URL}/knowledge/schedule/reschedule_auto`, {
        session_id: sessionId
      });
      alert(resp.data.message);
      await fetchSchedule();
    } catch (err: any) {
      console.error(err);
      alert("일정 재조정 중 오류가 발생했습니다: " + (err.response?.data?.detail || err.message));
    }
    setLoading(false);
  };

  const payload = schedule?.payload || {};

  const startEvaluation = (week_number: number, task_index: number, task: any) => {
    setEvaluatingTaskInfo({ week_number, task_index, task_title: task.task_title });
    setMessages([{ role: 'assistant', content: `[메타인지 평가 모드]\n'${task.task_title}' 단원의 학습을 마치셨군요! 가장 중요하게 배운 핵심 개념 한 가지를 동생에게 설명하듯 이야기해주세요.` }]);
  };

  const handleSendEvaluation = async () => {
    if (!inputMsg.trim()) return;
    const currentMsg = inputMsg;
    setInputMsg("");
    setMessages(prev => [...prev, { role: 'user', content: currentMsg }]);
    setLoadingChat(true);

    try {
      if (evaluatingTaskInfo) {
        const resp = await axios.post(`${API_URL}/knowledge/evaluate`, {
          session_id: sessionId,
          subject: evaluatingTaskInfo.task_title,
          explanation: currentMsg
        });
        
        const score = resp.data.score || 0;
        const feedback = resp.data.feedback || "평가가 완료되었습니다.";
        
        setMessages(prev => [...prev, { role: 'assistant', content: `[점수: ${score}점]\n${feedback}` }]);
        setAchievementRates(prev => ({...prev, [`${evaluatingTaskInfo.week_number}_${evaluatingTaskInfo.task_index}`]: score}));
        toggleTask(evaluatingTaskInfo.week_number, evaluatingTaskInfo.task_index, true);
        setEvaluatingTaskInfo(null);
      } else {
        const resp = await axios.post(`${API_URL}/knowledge/chat`, {
          session_id: sessionId,
          message: `[자유 질문]\n사용자질문: ${currentMsg}`,
          state_override: { current_stage: 5 }
        });
        
        const reply = resp.data.reply;
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "응답 처리 중 오류가 발생했습니다. 다시 시도해주세요." }]);
    }
    setLoadingChat(false);
  };

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다. Chrome을 사용해주세요.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputMsg(prev => prev + (prev ? " " : "") + transcript);
    };
    
    recognition.start();
  };

  const handleSelfCheck = async (type: 'in' | 'out') => {
    const timeStr = new Date().toTimeString().slice(0, 5); // HH:MM
    const todayDate = new Date().toISOString().split('T')[0];
    
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const d = new Date();
    const dayName = days[d.getDay()];
    const scheduled = scheduledTimes[dayName];

    try {
      await axios.post(`${API_URL}/knowledge/attendance`, {
        session_id: sessionId,
        date: todayDate,
        check_in_time: type === 'in' ? timeStr : null,
        check_out_time: type === 'out' ? timeStr : null,
        is_managed: managementType === '관리형',
        consult_checked: false,
        consult_note: '',
        scheduled_in_time: scheduled?.in || null,
        scheduled_out_time: scheduled?.out || null
      });
      alert(`${type === 'in' ? '등원' : '하원'} 완료 처리되었습니다 (${timeStr})`);
      fetchAttendance();
    } catch (err) {
      console.error(err);
      alert("출석 체크 중 오류가 발생했습니다.");
    }
  };

  const handleSendMessage = async () => {
    if (!newMsg.trim()) return;
    try {
      await axios.post(`${API_URL}/knowledge/messages`, {
        session_id: sessionId,
        sender_role: 'student',
        content: newMsg.trim()
      });
      setNewMsg('');
      fetchMessagesList();
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

  let flatTasks: any[] = [];
  payload.curriculum?.forEach((week: any) => {
    week.daily_tasks?.forEach((task: any, idx: number) => {
      flatTasks.push({ week_number: week.week_number, task_index: idx, ...task });
    });
  });

  const filteredTasks = flatTasks.filter(t => t.subject === selectedSubject);
  const totalTasks = filteredTasks.length;
  const completedTasksCount = filteredTasks.filter(t => t.completed).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0;

  useEffect(() => {
    if (listContainerRef.current && filteredTasks.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const rows = listContainerRef.current.querySelectorAll('tr[data-date]');
      let targetRow: HTMLElement | null = null;
      
      for (let i = 0; i < rows.length; i++) {
        const rowDate = rows[i].getAttribute('data-date');
        if (rowDate && rowDate >= todayStr) {
          targetRow = rows[i] as HTMLElement;
          break;
        }
      }
      if (!targetRow && rows.length > 0) targetRow = rows[rows.length - 1] as HTMLElement;

      if (targetRow) {
        const container = listContainerRef.current;
        const scrollPos = targetRow.offsetTop - (container.clientHeight / 2) + (targetRow.clientHeight / 2);
        setTimeout(() => {
          container.scrollTo({ top: scrollPos, behavior: 'smooth' });
        }, 100);
      }
    }
  }, [filteredTasks.length, selectedSubject]);

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '50px' }}>일정을 불러오는 중입니다...</div>;
  if (!schedule) return <div style={{ textAlign: 'center', marginTop: '50px', color: '#fff' }}>확정된 일정이 없습니다. 온보딩을 완료해주세요!</div>;

  const remainingDays = getRemainingVoucherDays();

  return (
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minHeight: 0, paddingBottom: '20px' }}>
      
      {/* 자율형 관리형 전환 권유 배너 */}
      {managementType === '자율형' && (
        <div style={{
          background: '#e3f2fd',
          color: '#0d47a1',
          border: '1px solid #bbdefb',
          padding: '16px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0
        }}>
          <div style={{ fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🎒 관리형 전환 안내
          </div>
          <div>
            관리자의 1:1 대면 상담 및 밀착 출결 피드백 등으로 성취도를 높일 수 있습니다. 관리자에게 문의 바랍니다.
          </div>
        </div>
      )}

      {/* 이용권 만료 사전 안내 배너 */}
      {remainingDays !== null && remainingDays <= 7 && (
        <div style={{
          background: remainingDays <= 3 ? '#ffebee' : '#fff3e0',
          color: remainingDays <= 3 ? '#c62828' : '#ef6c00',
          border: `1px solid ${remainingDays <= 3 ? '#ffcdd2' : '#ffe0b2'}`,
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <span>⚠️ 이용권 만료 사전 안내: 정기 이용권 만료가 {remainingDays}일 남았습니다. ({voucherExpiry} 만료 예정) 재등록을 서둘러 주세요!</span>
        </div>
      )}

      {/* 상단: 일일 진도 계획표 */}
      <div style={{ background: '#fff', padding: '20px 30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ color: '#1976d2', margin: '0 0 10px 0' }}>🏃 나의 진도 계획표</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <p style={{ margin: 0, color: '#666' }}>[{payload.plan_title || '진도 계획'}]</p>
              <span style={{ fontSize: '13px', color: '#888', background: '#f5f5f5', padding: '4px 10px', borderRadius: '12px' }}>
                부모님 참관 코드: <strong>{payload.observer_code || ''}</strong>
              </span>
            </div>
          </div>
          <button 
            onClick={handleAutoReschedule}
            style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            🚨 전체 일정 재조정 (AI)
          </button>
        </div>

        {/* 과목 탭 */}
        <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '5px' }}>
          {(payload.spreadsheet_data?.subjects || []).map((subj: any) => (
            <button
              key={subj.subject_name}
              onClick={() => setSelectedSubject(subj.subject_name)}
              style={{
                background: selectedSubject === subj.subject_name ? '#1976d2' : '#f0f0f0',
                color: selectedSubject === subj.subject_name ? '#fff' : '#555',
                border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer',
                fontWeight: selectedSubject === subj.subject_name ? 'bold' : 'normal',
                whiteSpace: 'nowrap', fontSize: '15px'
              }}
            >
              {subj.subject_name}
            </button>
          ))}
        </div>

        {/* 진도 프로그레스 바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px', background: '#f8f9fa', padding: '10px 15px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#555', minWidth: '85px', whiteSpace: 'nowrap' }}>
            진도율 {progressPercent}%
          </span>
          <div style={{ flex: 1, height: '8px', background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: '#4caf50', borderRadius: '4px', transition: 'width 0.4s ease' }} />
          </div>
          <span style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap' }}>
            ({completedTasksCount} / {totalTasks} 완료)
          </span>
        </div>

        {/* 스크롤 가능한 일자별 리스트 */}
        <div ref={listContainerRef} style={{ height: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f5f5f5', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', zIndex: 1 }}>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #ddd', background: '#f5f5f5' }}>일자 (요일)</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '2px solid #ddd', background: '#f5f5f5' }}>배정시간</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #ddd', background: '#f5f5f5' }}>단원명</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '2px solid #ddd', background: '#f5f5f5' }}>상태 / 성취율</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task, idx) => {
                const isChecked = task.completed;
                const achievementKey = `${task.week_number}_${task.task_index}`;
                const rate = achievementRates[achievementKey] || (isChecked ? 100 : null);
                
                return (
                  <tr key={idx} data-date={task.date} style={{ borderBottom: '1px solid #eee', background: isChecked ? '#fdfdfd' : '#fff', height: '42px' }}>
                    <td style={{ padding: '8px 12px', color: '#555', fontWeight: 'bold' }}>{task.date} ({(typeof task.day === 'string' && task.day.includes('- ')) ? task.day.split('- ')[1] : task.day || '?'})</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#666' }}>{task.estimated_minutes}분</td>
                    <td style={{ padding: '8px 12px', color: isChecked ? '#aaa' : '#333', textDecoration: isChecked ? 'line-through' : 'none' }}>{task.unit_name}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {isChecked ? (
                        <span style={{ color: '#4caf50', fontWeight: 'bold' }}>성취율: {rate}%</span>
                      ) : (
                        <button 
                          onClick={() => startEvaluation(task.week_number, task.task_index, task)}
                          style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #81c784', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                        >
                          🎙️ 평가받기
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#999' }}>해당 과목의 일정이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 중단: 출석 및 관리 현황 */}
      <div style={{ background: '#fff', padding: '20px 30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', flexShrink: 0 }}>
        <h3 style={{ color: '#1976d2', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📅 나의 등하원 및 관리 현황
          <span style={{ fontSize: '12px', fontWeight: 'normal', padding: '3px 8px', borderRadius: '10px', background: managementType === '관리형' ? '#ffe0b2' : '#e0e0e0', color: managementType === '관리형' ? '#e65100' : '#666' }}>
            {managementType === '관리형' ? '관리형 이용자' : '자율형 이용자'}
          </span>
        </h3>

        {/* 오늘 등하원 체크 및 상태 표시 */}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', background: '#f8f9fa', padding: '15px 20px', borderRadius: '8px', border: '1px solid #e0e0e0', marginBottom: '15px' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <span style={{ fontSize: '13px', color: '#666' }}>오늘의 등원 정보: </span>
            <strong style={{ color: '#4caf50' }}>{attendance[0]?.date === new Date().toISOString().split('T')[0] && attendance[0]?.check_in_time ? attendance[0].check_in_time : '미등록'}</strong>
            <span style={{ margin: '0 15px', color: '#ddd' }}>|</span>
            <span style={{ fontSize: '13px', color: '#666' }}>오늘의 하원 정보: </span>
            <strong style={{ color: '#f44336' }}>{attendance[0]?.date === new Date().toISOString().split('T')[0] && attendance[0]?.check_out_time ? attendance[0].check_out_time : '미등록'}</strong>
          </div>

          {managementType === '관리형' ? (
            <div style={{ fontSize: '13px', color: '#e65100', fontWeight: 'bold' }}>
              {attendance[0]?.date === new Date().toISOString().split('T')[0] && attendance[0]?.consult_checked ? (
                <span>✅ 관리자 5분 메타인지 상담 완료</span>
              ) : (
                <span>⏳ 관리자 등하원 및 상담 대기 중</span>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => handleSelfCheck('in')}
                disabled={attendance[0]?.date === new Date().toISOString().split('T')[0] && !!attendance[0]?.check_in_time}
                style={{ background: '#4caf50', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
              >
                🎒 등원 체크
              </button>
              <button 
                onClick={() => handleSelfCheck('out')}
                disabled={attendance[0]?.date === new Date().toISOString().split('T')[0] && !!attendance[0]?.check_out_time}
                style={{ background: '#f44336', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
              >
                🚪 하원 체크
              </button>
            </div>
          )}
        </div>

        {/* 특이사항(상담 일지) 표시 */}
        {managementType === '관리형' && attendance[0]?.date === new Date().toISOString().split('T')[0] && attendance[0]?.consult_note && (
          <div style={{ background: '#fff8e1', border: '1px solid #ffe082', padding: '12px 15px', borderRadius: '8px', fontSize: '13px', color: '#b78103', marginBottom: '15px' }}>
            <strong>오늘의 메타인지 상담 피드백:</strong> {attendance[0].consult_note}
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
                {managementType === '관리형' && <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>5분 상담</th>}
                {managementType === '관리형' && <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>피드백</th>}
              </tr>
            </thead>
            <tbody>
              {attendance.map(h => {
                const isTardy = checkIsTardy(h.date, h.check_in_time, h.scheduled_in_time);
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
                    {managementType === '관리형' && (
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold', color: h.consult_checked ? 'green' : 'red' }}>
                        {h.consult_checked ? '완료' : '미완료'}
                      </td>
                    )}
                    {managementType === '관리형' && <td style={{ padding: '8px 12px', color: '#666' }}>{h.consult_note || '-'}</td>}
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

      {/* 하단: AI 챗봇 창 & 3자 실시간 메시지 연동 */}
      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: '400px', flexWrap: 'wrap' }}>
        
        {/* Left: AI 챗봇 창 */}
        <div style={{ flex: 1, minWidth: '350px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', border: '1px solid #bbdefb' }}>
          <div style={{ background: '#1976d2', padding: '15px 20px', borderRadius: '12px 12px 0 0', color: '#fff', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
            <span>🤖 AI 학습 평가 챗봇</span>
            {evaluatingTaskInfo && <span style={{ fontSize: '13px', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px' }}>평가 진행 중: {evaluatingTaskInfo.task_title}</span>}
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', background: '#f8fbff' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '80%', padding: '12px 16px', borderRadius: '12px',
                  background: msg.role === 'user' ? '#1976d2' : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  border: msg.role === 'user' ? 'none' : '1px solid #e0e0e0',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                  whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '14px'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loadingChat && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '12px 16px', borderRadius: '12px', color: '#888', fontSize: '14px' }}>AI가 생각 중입니다... ✍️</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: '15px', borderTop: '1px solid #eee', background: '#fff', borderRadius: '0 0 12px 12px', display: 'flex', gap: '10px' }}>
            <button 
              onClick={startRecording}
              title="마이크로 입력하기"
              style={{ 
                background: isRecording ? '#ffebee' : '#f5f5f5', 
                color: isRecording ? '#d32f2f' : '#555', 
                border: '1px solid #ccc', 
                borderRadius: '8px', 
                width: '45px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                transition: 'all 0.2s'
              }}
            >
              {isRecording ? '🛑' : '🎤'}
            </button>
            <input
              type="text"
              value={inputMsg}
              onChange={e => setInputMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendEvaluation()}
              placeholder={evaluatingTaskInfo ? "학습한 내용을 설명해주세요..." : "무엇이든 자유롭게 질문하거나 [평가받기]를 눌러주세요..."}
              disabled={loadingChat}
              style={{ flex: 1, padding: '12px 15px', borderRadius: '8px', border: '1px solid #ccc', outline: 'none', fontSize: '14px' }}
            />
            <button 
              onClick={handleSendEvaluation}
              disabled={!inputMsg.trim() || loadingChat}
              style={{ background: !inputMsg.trim() ? '#ccc' : '#1976d2', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '8px', cursor: !inputMsg.trim() ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
            >
              전송
            </button>
          </div>
        </div>

        {/* Right: 3자 실시간 메시지 창 */}
        <div style={{ flex: 1, minWidth: '350px', background: '#f1f8e9', border: '1px solid #c5e1a5', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#33691e', padding: '15px 20px', borderRadius: '12px 12px 0 0', color: '#fff', fontWeight: 'bold' }}>
            <span>💬 3자 실시간 메시지 창 (관리자/학부모 특이사항 소통)</span>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f9fbe7' }}>
            {messagesList.map(m => {
              const isSelf = m.sender_role === 'student';
              let roleLabel = '이용자(학생)';
              if (m.sender_role === 'admin') roleLabel = '관리자';
              if (m.sender_role === 'parent') roleLabel = '학부모';

              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: isSelf ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%', padding: '10px 14px', borderRadius: '12px',
                    background: isSelf ? '#33691e' : '#fff',
                    color: isSelf ? '#fff' : '#333',
                    border: '1px solid #dcdde1',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                    fontSize: '13px'
                  }}>
                    <div style={{ fontSize: '10px', color: isSelf ? '#c5e1a5' : '#888', marginBottom: '4px', fontWeight: 'bold' }}>
                      {roleLabel}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                  </div>
                </div>
              );
            })}
            {messagesList.length === 0 && (
              <div style={{ color: '#999', textAlign: 'center', marginTop: '100px', fontSize: '13px' }}>대화 내역이 없습니다.</div>
            )}
          </div>

          <div style={{ padding: '10px', borderTop: '1px solid #c5e1a5', background: '#fff', borderRadius: '0 0 12px 12px', display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              placeholder="관리자/학부모와 공유할 내용을 입력하세요..."
              style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none', fontSize: '13px' }}
            />
            <button
              onClick={handleSendMessage}
              style={{ background: '#33691e', color: '#fff', border: 'none', padding: '0 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
            >
              전송
            </button>
          </div>
        </div>

      </div>
      
    </div>
  );
}
