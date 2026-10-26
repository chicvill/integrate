import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

import { API_URL } from './config';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatWizardProps {
  sessionId: string;
  rescheduleScheduleId?: string | null;
  onFinalized?: () => void;
  initialModal?: 'none' | 'subject' | 'unit';
}

export default function AIChatWizard({ sessionId, rescheduleScheduleId, onFinalized, initialModal = 'none' }: AIChatWizardProps) {
  const [stage, setStage] = useState<number>(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [collectedData, setCollectedData] = useState<any>({});
  const [draftSchedule, setDraftSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [observerCode, setObserverCode] = useState("");
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [evaluatingTaskInfo, setEvaluatingTaskInfo] = useState<any>(null);
  
  // Tab states
  const [activeSubjectTab, setActiveSubjectTab] = useState<number>(0);
  const [activeWeekTab, setActiveWeekTab] = useState<number>(1);
  
  // Modal states
  const [showModal, setShowModal] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    return localStorage.getItem('selfstudy_hide_strategy_modal_date') !== today;
  });
  const [doNotShowToday, setDoNotShowToday] = useState(false);

  const handleCloseModal = () => {
    if (doNotShowToday) {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('selfstudy_hide_strategy_modal_date', today);
    }
    setShowModal(false);
  };
  
  // Weight adjustment states
  const [showSubjectWeightModal, setShowSubjectWeightModal] = useState(false);
  const [showUnitWeightModal, setShowUnitWeightModal] = useState(false);
  const [tempWeights, setTempWeights] = useState<number[]>([]);

  const openSubjectWeightModal = () => {
    if (!draftSchedule?.spreadsheet_data?.subjects) return;
    setTempWeights(draftSchedule.spreadsheet_data.subjects.map((s: any) => s.weight_percent));
    setShowSubjectWeightModal(true);
  };

  const openUnitWeightModal = () => {
    if (!draftSchedule?.spreadsheet_data?.subjects?.[activeSubjectTab]?.units) return;
    setTempWeights(draftSchedule.spreadsheet_data.subjects[activeSubjectTab].units.map((u: any) => u.weight_percent));
    setShowUnitWeightModal(true);
  };

  const handleUpdateWeights = async (type: 'subject' | 'unit') => {
    const sum = tempWeights.reduce((a, b) => a + b, 0);
    if (sum !== 100) {
      alert("비중의 합이 100%가 되어야 합니다.");
      return;
    }
    setLoading(true);
    try {
      const newSpreadsheet = JSON.parse(JSON.stringify(draftSchedule.spreadsheet_data));
      if (type === 'subject') {
        newSpreadsheet.subjects.forEach((s: any, idx: number) => {
          s.weight_percent = tempWeights[idx];
        });
      } else {
        newSpreadsheet.subjects[activeSubjectTab].units.forEach((u: any, idx: number) => {
          u.weight_percent = tempWeights[idx];
        });
      }
      const res = await axios.post(`${API_URL}/knowledge/schedule/update_weights`, {
        session_id: sessionId,
        new_spreadsheet_data: newSpreadsheet
      });
      setDraftSchedule(res.data.draft_schedule);
      setShowSubjectWeightModal(false);
      setShowUnitWeightModal(false);
    } catch (err) {
      console.error(err);
      alert("비중 업데이트 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  const startEvaluation = (week_number: number, task_index: number, task: any) => {
    setEvaluatingTaskInfo({ week_number, task_index, task_title: task.task_title });
    setMessages(prev => [...prev, { role: 'assistant', content: `[${task.task_title}] 학습 내용을 평가합니다. 배운 내용을 자유롭게 설명해주세요.` }]);
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 최초 진입 시 로딩 상태 등 초기화
    if (rescheduleScheduleId) {
      // 리스케줄링 모드로 강제 진입
      setLoading(true);
      axios.post(`${API_URL}/knowledge/chat/reschedule`, {
        session_id: sessionId,
        schedule_id: rescheduleScheduleId
      }).then(() => {
        setMessages([{ role: 'assistant', content: '진도가 밀려서 속상하시죠? 괜찮습니다! 현재까지의 달성률을 바탕으로 남은 일정을 어떻게 조정하면 좋을지 말씀해 주세요.' }]);
        setStage(3);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    } else {
      setLoading(true);
      axios.get(`${API_URL}/knowledge/chat/${sessionId}`).then(res => {
        if (res.data && res.data.data) {
          const session = res.data.data;
          setStage(session.current_stage);
          setCollectedData(session.collected_data);
          setDraftSchedule(session.draft_schedule);
          if (session.chat_history && session.chat_history.length > 0) {
            setMessages(session.chat_history);
          }
        } else {
          // 백엔드에 세션이 없는 경우 (Fallback)
          setMessages([{
            role: 'assistant',
            content: "안녕하세요! 나만의 맞춤형 학습 계획을 세워드릴 AI 튜터입니다."
          }]);
        }
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    }
  }, [sessionId, rescheduleScheduleId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, draftSchedule]);

  useEffect(() => {
    if (draftSchedule && initialModal !== 'none') {
      if (initialModal === 'subject') {
        openSubjectWeightModal();
      } else if (initialModal === 'unit') {
        // Need to make sure activeSubjectTab has units before opening
        if (draftSchedule?.spreadsheet_data?.subjects?.[activeSubjectTab]?.units) {
          openUnitWeightModal();
        }
      }
    }
  }, [draftSchedule, initialModal]);

  useEffect(() => {
    if (draftSchedule?.curriculum?.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      let targetWeek = draftSchedule.curriculum[0].week_number;
      
      for (const week of draftSchedule.curriculum) {
        if (week.daily_tasks && week.daily_tasks.length > 0) {
          const firstDate = week.daily_tasks[0].date;
          const lastDate = week.daily_tasks[week.daily_tasks.length - 1].date;
          if (todayStr >= firstDate && todayStr <= lastDate) {
            targetWeek = week.week_number;
            break;
          } else if (todayStr < firstDate) {
            // If today is before this week and we haven't found a match yet, it might be the closest upcoming week.
            // But we'll just stick to targetWeek assignment logic.
          }
        }
      }
      setActiveWeekTab(targetWeek);
    }
  }, [draftSchedule?.curriculum]);

  useEffect(() => {
    if (isSpeakerEnabled && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant') {
        const utterance = new SpeechSynthesisUtterance(lastMsg.content);
        utterance.lang = 'ko-KR';
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [messages, isSpeakerEnabled]);

  const handleMicClick = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputMsg(prev => prev + (prev ? " " : "") + transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const userText = inputMsg;
    setInputMsg("");
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    if (evaluatingTaskInfo) {
      try {
        const response = await axios.post(`${API_URL}/knowledge/evaluate`, {
          session_id: sessionId,
          subject: evaluatingTaskInfo.task_title,
          explanation: userText
        });
        
        const { score, feedback } = response.data;
        
        setMessages(prev => [...prev, { role: 'assistant', content: `[평가 완료: ${score}점]\n\n${feedback}` }]);
        
        const newSchedule = { ...draftSchedule };
        const weekObj = newSchedule.curriculum.find((w: any) => w.week_number === evaluatingTaskInfo.week_number);
        if (weekObj) {
          weekObj.daily_tasks[evaluatingTaskInfo.task_index].score = score;
          weekObj.daily_tasks[evaluatingTaskInfo.task_index].completed = true;
        }
        setDraftSchedule(newSchedule);
        setEvaluatingTaskInfo(null);
      } catch (err) {
        console.error(err);
        setMessages(prev => [...prev, { role: 'assistant', content: "평가 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }]);
        setEvaluatingTaskInfo(null);
      }
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/knowledge/chat`, {
        session_id: sessionId,
        message: userText
      });

      const { ai_response, current_stage, collected_data, draft_schedule } = response.data;
      
      setMessages(prev => [...prev, { role: 'assistant', content: ai_response }]);
      setStage(current_stage);
      setCollectedData(collected_data);
      if (draft_schedule) {
        setDraftSchedule(draft_schedule);
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }]);
    }
    setLoading(false);
  };

  const handleFinalize = async () => {
    setLoading(true);
    try {
      const resp = await axios.post(`${API_URL}/knowledge/finalize`, { session_id: sessionId });
      setIsFinalized(true);
      setObserverCode(resp.data.observer_code);
      if (onFinalized) {
        onFinalized(); // 즉시 대시보드로 이동
      }
    } catch (err) {
      alert("확정 처리 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  return (
    <>
    <div style={{ display: 'flex', height: '85vh', maxWidth: '1300px', margin: '10px auto', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
      
      {/* 좌측 패널: 진행 상황 및 초안 일정 렌더링 */}
      <div style={{ width: '45%', background: '#f8f9fa', padding: '30px', borderRight: '1px solid #eee', overflowY: 'auto' }}>
        <h2 style={{ color: '#1976d2', marginTop: 0 }}>📊 {stage === 1 ? '목표 설정 중...' : (stage === 3 ? '일정 재조정 중... 🔄' : '맞춤형 진도 계획표 (초안)')}</h2>
        
        {stage === 1 && (
          <div style={{ marginTop: '40px', background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <h3 style={{ fontSize: '16px', marginTop: 0, color: '#555', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>📝 실시간 수집 데이터</h3>
            {Object.keys(collectedData).length === 0 ? (
              <p style={{ color: '#999', fontSize: '14px' }}>AI와 대화하며 목표를 설정해 보세요!</p>
            ) : (
              <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.6', color: '#333' }}>
                {Object.entries(collectedData).map(([k, v]) => (
                  <li key={k}><strong>{k}:</strong> {typeof v === 'object' ? JSON.stringify(v) : String(v)}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {(stage === 2 || stage === 3) && draftSchedule && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #bbdefb', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                <button 
                  onClick={() => setShowModal(true)} 
                  style={{ background: '#f5f5f5', border: '1px solid #ccc', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold', color: '#555' }}
                >
                  💡 AI 전략 보기
                </button>
              </div>
              <h3 style={{ margin: '0 0 20px 0', color: '#1565c0', wordBreak: 'keep-all' }}>
                {initialModal !== 'none' ? '비율(가중치) 설정 중...' : (draftSchedule.plan_title || "진도 계획")}
              </h3>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1976d2', paddingBottom: '5px', marginBottom: '10px' }}>
                  <h4 style={{ color: '#333', margin: 0 }}>📊 과목별/단원별 학습시간 배분(%)</h4>
                  <button onClick={openSubjectWeightModal} style={{ background: '#fff', border: '1px solid #1976d2', color: '#1976d2', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>✏️ 과목 비중 조절</button>
                </div>
                <p style={{ fontSize: '12px', color: '#666', marginTop: 0 }}>💡 팁: 비중을 수정하고 싶다면 우측 채팅창에 말씀해주세요!</p>
                
                {/* Subject Tabs */}
                {draftSchedule.spreadsheet_data?.subjects?.length > 0 && (
                  <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', overflowX: 'auto' }}>
                    {draftSchedule.spreadsheet_data.subjects.map((subj: any, i: number) => (
                      <button 
                        key={i}
                        onClick={() => setActiveSubjectTab(i)}
                        style={{
                          background: activeSubjectTab === i ? '#1565c0' : '#e0e0e0',
                          color: activeSubjectTab === i ? '#fff' : '#333',
                          border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer',
                          fontWeight: activeSubjectTab === i ? 'bold' : 'normal',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {subj.subject_name}
                      </button>
                    ))}
                  </div>
                )}
                
                {draftSchedule.spreadsheet_data?.subjects?.[activeSubjectTab] && (
                  <div style={{ marginBottom: '15px', background: '#fff', border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ background: '#e3f2fd', padding: '10px 15px', borderBottom: '1px solid #ccc', fontWeight: 'bold', color: '#1565c0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{draftSchedule.spreadsheet_data.subjects[activeSubjectTab].subject_name} (비중: {draftSchedule.spreadsheet_data.subjects[activeSubjectTab].weight_percent}%)</span>
                      <button onClick={openUnitWeightModal} style={{ background: '#fff', border: '1px solid #1565c0', color: '#1565c0', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>✏️ 단원 비중 조절</button>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #ccc' }}>
                          <th style={{ padding: '8px', textAlign: 'left' }}>단원명</th>
                          <th style={{ padding: '8px', width: '80px', textAlign: 'center' }}>단원 비중</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draftSchedule.spreadsheet_data.subjects[activeSubjectTab].units?.map((u: any, j: number) => (
                          <tr key={j} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px 15px', borderRight: '1px solid #eee' }}>{u.unit_name}</td>
                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#4caf50' }}>{u.weight_percent}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '30px' }}>
                <h4 style={{ color: '#333', borderBottom: '2px solid #1976d2', paddingBottom: '5px' }}>🗓️ 일자별 스케줄 매칭 결과</h4>
                
                {/* Week Tabs */}
                {draftSchedule.curriculum?.length > 0 && (
                  <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', overflowX: 'auto', paddingBottom: '5px' }}>
                    {draftSchedule.curriculum.map((week: any) => (
                      <button 
                        key={week.week_number}
                        onClick={() => setActiveWeekTab(week.week_number)}
                        style={{
                          background: activeWeekTab === week.week_number ? '#2e7d32' : '#e0e0e0',
                          color: activeWeekTab === week.week_number ? '#fff' : '#333',
                          border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer',
                          fontWeight: activeWeekTab === week.week_number ? 'bold' : 'normal',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Week {week.week_number}
                      </button>
                    ))}
                  </div>
                )}

                {draftSchedule.curriculum?.filter((w: any) => w.week_number === activeWeekTab).map((week: any) => {
                  const selectedSubjectName = draftSchedule.spreadsheet_data?.subjects?.[activeSubjectTab]?.subject_name;
                  const filteredTasks = week.daily_tasks?.map((task: any, origIdx: number) => ({ task, origIdx }))
                                      .filter((item: any) => !selectedSubjectName || item.task.subject === selectedSubjectName);
                  
                  const firstDate = week.daily_tasks?.[0]?.date || '';
                  const lastDate = week.daily_tasks?.[week.daily_tasks.length - 1]?.date || '';
                  const dateRange = firstDate && lastDate ? `[${firstDate}] ~ [${lastDate}]` : `Week ${week.week_number}`;
                  
                  return (
                    <div key={week.week_number} style={{ marginBottom: '15px', borderLeft: '3px solid #1976d2', paddingLeft: '15px' }}>
                      <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '16px' }}>{dateRange}</h4>
                      {filteredTasks?.length === 0 ? (
                        <p style={{ margin: 0, fontSize: '13px', color: '#999', paddingLeft: '15px' }}>해당 주차에는 선택한 과목({selectedSubjectName})의 일정이 없습니다.</p>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '14px', color: '#666', listStyleType: 'none' }}>
                          {filteredTasks?.map((item: any, idx: number) => {
                            const { task, origIdx } = item;
                            const cleanDay = task.day ? task.day.replace(/Week \d+ - /g, '').trim() : '';
                            const displayTitle = task.task_title.replace(' (진행중)', '').replace(' (완료)', '');
                            return (
                              <li key={idx} style={{ padding: '4px 0', display: 'flex', alignItems: 'center' }}>
                                <strong style={{ color: task.completed ? '#2e7d32' : '#1976d2', display: 'inline-block', width: '30px' }}>{cleanDay}</strong> :  
                                <span style={{ textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? '#888' : '#555', marginLeft: '5px' }}> 
                                  {displayTitle} ({task.estimated_minutes}분) 
                                </span>
                                {task.score !== undefined ? (
                                  <span style={{fontSize:'12px', color:'#2e7d32', marginLeft:'10px', fontWeight: 'bold', background: '#e8f5e9', padding: '2px 6px', borderRadius: '4px'}}>✅ {task.score}% 달성</span>
                                ) : (
                                  <button onClick={() => startEvaluation(week.week_number, origIdx, task)} style={{ marginLeft: '10px', background: '#e3f2fd', color: '#1565c0', border: '1px solid #bbdefb', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>🎙️ 평가하기</button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {!isFinalized && (
              <button 
                onClick={handleFinalize}
                disabled={loading}
                style={{ marginTop: '20px', width: '100%', background: '#4caf50', color: '#fff', padding: '15px', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(76,175,80,0.3)' }}
              >
                ✅ 이 계획으로 확정하기
              </button>
            )}

            {isFinalized && (
              <div style={{ marginTop: '20px', background: '#e8f5e9', padding: '20px', borderRadius: '8px', border: '1px solid #c8e6c9', textAlign: 'center' }}>
                <h3 style={{ color: '#2e7d32', margin: '0 0 10px 0' }}>🎉 일정이 확정되었습니다!</h3>
                <p style={{ color: '#1b5e20', fontSize: '14px', margin: 0 }}>
                  부모님이나 선생님께 아래 <strong>참관 코드</strong>를 알려주시면 진도표를 공유할 수 있습니다.<br/><br/>
                  <span style={{ background: '#fff', padding: '10px 20px', fontSize: '24px', fontWeight: 'bold', letterSpacing: '3px', borderRadius: '8px', border: '2px dashed #4caf50', display: 'inline-block' }}>
                    {observerCode}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 우측 패널: AI 채팅창 */}
      <div style={{ width: '55%', display: 'flex', flexDirection: 'column', background: '#eef2f5' }}>
        <div style={{ padding: '10px 20px', background: '#fff', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => {
              setIsSpeakerEnabled(!isSpeakerEnabled);
              if (isSpeakerEnabled) window.speechSynthesis.cancel();
            }}
            style={{ background: isSpeakerEnabled ? '#4caf50' : '#e0e0e0', color: isSpeakerEnabled ? '#fff' : '#555', border: 'none', padding: '8px 15px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
          >
            {isSpeakerEnabled ? '🔊 AI 음성 켜짐' : '🔈 AI 음성 꺼짐'}
          </button>
        </div>
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ 
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? '#1976d2' : '#fff',
              color: msg.role === 'user' ? '#fff' : '#333',
              padding: '12px 18px',
              borderRadius: '20px',
              maxWidth: '80%',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap'
            }}>
              {msg.content}
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', background: '#fff', padding: '12px 18px', borderRadius: '20px', color: '#888' }}>
              AI가 생각 중입니다...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* 입력창 */}
        <div style={{ background: '#fff', padding: '15px 20px', borderTop: '1px solid #ddd' }}>
          {isFinalized ? (
            <div style={{ textAlign: 'center', color: '#4caf50', fontWeight: 'bold' }}>
              모든 절차가 완료되었습니다! 🎉 대시보드로 이동하세요.
            </div>
          ) : (
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button"
                onClick={handleMicClick}
                disabled={loading || isListening}
                style={{ background: isListening ? '#f44336' : '#e0e0e0', color: isListening ? '#fff' : '#333', border: 'none', padding: '0 15px', borderRadius: '20px', cursor: 'pointer', fontSize: '18px' }}
                title="마이크로 말하기"
              >
                🎤
              </button>
              <input 
                type="text" 
                value={inputMsg}
                onChange={e => setInputMsg(e.target.value)}
                placeholder={evaluatingTaskInfo ? "학습한 내용을 설명해주세요..." : (stage === 1 ? "답변을 입력해주세요..." : "수정하고 싶은 내용을 말해주세요...")} 
                disabled={loading}
                style={{ flex: 1, padding: '12px', borderRadius: '20px', border: '1px solid #ccc', outline: 'none' }}
              />
              <button 
                type="submit" 
                disabled={loading || !inputMsg.trim()}
                style={{ background: '#1976d2', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                전송
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
    
    {/* Strategy Modal */}
    {showModal && draftSchedule && (stage === 2 || stage === 3) && (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: '20px'
      }}>
        <div style={{
          background: '#fff', borderRadius: '20px', padding: '30px', maxWidth: '600px', width: '100%',
          boxShadow: '0 15px 40px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', maxHeight: '90vh'
        }}>
          <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '12px', marginBottom: '25px', color: '#0d47a1', fontSize: '15px', lineHeight: '1.5' }}>
            💡 <strong>{stage === 3 ? "AI가 재배치한 새로운 일정입니다!" : "AI가 추천하는 초안입니다!"}</strong><br/>우측 채팅창에 원하는 수정사항을 말하면 AI가 즉시 반영해 드립니다.
          </div>
          <h3 style={{ margin: '0 0 15px 0', color: '#1565c0', fontSize: '22px' }}>{draftSchedule.plan_title || "진도 계획"}</h3>
          
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
            <p style={{ fontSize: '15px', color: '#444', lineHeight: '1.8', margin: 0, whiteSpace: 'pre-wrap' }}>
              <strong>전략:</strong><br/>
              {draftSchedule.overall_strategy}
            </p>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '25px', borderTop: '2px solid #f0f0f0', paddingTop: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '15px', color: '#666', fontWeight: 'bold' }}>
              <input 
                type="checkbox" 
                checked={doNotShowToday} 
                onChange={e => setDoNotShowToday(e.target.checked)} 
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              오늘 하루 다시 보지 않기
            </label>
            <button 
              onClick={handleCloseModal} 
              style={{ background: '#1565c0', color: '#fff', border: 'none', padding: '12px 30px', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', boxShadow: '0 4px 10px rgba(21, 101, 192, 0.3)' }}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Subject Weight Modal */}
    {showSubjectWeightModal && draftSchedule?.spreadsheet_data?.subjects && (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
      }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '30px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#1565c0', fontSize: '20px' }}>✏️ 과목 비중 직접 조절</h3>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>각 과목의 비중(%)을 조절하세요. 총합이 100%가 되어야 합니다.</p>
          
          <div style={{ maxHeight: '40vh', overflowY: 'auto', paddingRight: '5px' }}>
            {draftSchedule.spreadsheet_data.subjects.map((subj: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <span style={{ fontWeight: 'bold', color: '#444' }}>{subj.subject_name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input 
                    type="number" min="0" max="100" 
                    value={tempWeights[idx] === undefined ? '' : tempWeights[idx]} 
                    onChange={e => {
                      const newW = [...tempWeights];
                      newW[idx] = parseInt(e.target.value) || 0;
                      setTempWeights(newW);
                    }}
                    style={{ width: '60px', padding: '8px', textAlign: 'right', border: '1px solid #ccc', borderRadius: '8px', outline: 'none' }}
                  />
                  <span style={{ color: '#666', fontWeight: 'bold' }}>%</span>
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #eee', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
            <span>합계</span>
            <span style={{ color: tempWeights.reduce((a, b) => a + b, 0) === 100 ? '#2e7d32' : '#d32f2f' }}>
              {tempWeights.reduce((a, b) => a + b, 0)}%
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
            <button onClick={() => setShowSubjectWeightModal(false)} style={{ flex: 1, padding: '12px', border: 'none', background: '#e0e0e0', color: '#333', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>취소</button>
            <button 
              onClick={() => handleUpdateWeights('subject')} 
              style={{ flex: 1, padding: '12px', border: 'none', background: '#1976d2', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', opacity: tempWeights.reduce((a, b) => a + b, 0) === 100 ? 1 : 0.5 }}
              disabled={tempWeights.reduce((a, b) => a + b, 0) !== 100 || loading}
            >
              {loading ? '재계산 중...' : '확인 및 적용'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Unit Weight Modal */}
    {showUnitWeightModal && draftSchedule?.spreadsheet_data?.subjects?.[activeSubjectTab] && (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
      }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '30px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <h3 style={{ margin: '0 0 5px 0', color: '#1565c0', fontSize: '20px' }}>✏️ 단원 비중 직접 조절</h3>
          <p style={{ fontSize: '14px', color: '#e65100', fontWeight: 'bold', marginBottom: '5px' }}>{draftSchedule.spreadsheet_data.subjects[activeSubjectTab].subject_name}</p>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>해당 과목 내 단원들의 비중(%)을 조절하세요. 총합이 100%가 되어야 합니다.</p>
          
          <div style={{ maxHeight: '40vh', overflowY: 'auto', paddingRight: '5px' }}>
            {draftSchedule.spreadsheet_data.subjects[activeSubjectTab].units.map((u: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <span style={{ fontWeight: 'bold', color: '#444', fontSize: '14px', width: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={u.unit_name}>{u.unit_name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input 
                    type="number" min="0" max="100" 
                    value={tempWeights[idx] === undefined ? '' : tempWeights[idx]} 
                    onChange={e => {
                      const newW = [...tempWeights];
                      newW[idx] = parseInt(e.target.value) || 0;
                      setTempWeights(newW);
                    }}
                    style={{ width: '60px', padding: '8px', textAlign: 'right', border: '1px solid #ccc', borderRadius: '8px', outline: 'none' }}
                  />
                  <span style={{ color: '#666', fontWeight: 'bold' }}>%</span>
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #eee', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
            <span>합계</span>
            <span style={{ color: tempWeights.reduce((a, b) => a + b, 0) === 100 ? '#2e7d32' : '#d32f2f' }}>
              {tempWeights.reduce((a, b) => a + b, 0)}%
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
            <button onClick={() => setShowUnitWeightModal(false)} style={{ flex: 1, padding: '12px', border: 'none', background: '#e0e0e0', color: '#333', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>취소</button>
            <button 
              onClick={() => handleUpdateWeights('unit')} 
              style={{ flex: 1, padding: '12px', border: 'none', background: '#1976d2', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', opacity: tempWeights.reduce((a, b) => a + b, 0) === 100 ? 1 : 0.5 }}
              disabled={tempWeights.reduce((a, b) => a + b, 0) !== 100 || loading}
            >
              {loading ? '재계산 중...' : '확인 및 적용'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
