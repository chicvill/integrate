import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

import { API_URL } from './config';

interface GoalOnboardingFormProps {
  sessionId: string;
  userId: string;
  onComplete: (formData: any) => void;
}

export default function GoalOnboardingForm({ sessionId, userId, onComplete }: GoalOnboardingFormProps) {
  const [loading, setLoading] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  
  // Who
  const [ageGroup, setAgeGroup] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [managementType, setManagementType] = useState('자율형'); // '자율형' or '관리형'
  
  // Active days list
  const [activeDaysList, setActiveDaysList] = useState<string[]>(['월', '화', '수', '목', '금']);
  
  // Scheduled Times (in, out, consult)
  const [scheduledTimes, setScheduledTimes] = useState<Record<string, { in: string; out: string; consult: string }>>({
    '월': { in: '09:00', out: '18:00', consult: '17:30' },
    '화': { in: '09:00', out: '18:00', consult: '17:30' },
    '수': { in: '09:00', out: '18:00', consult: '17:30' },
    '목': { in: '09:00', out: '18:00', consult: '17:30' },
    '금': { in: '09:00', out: '18:00', consult: '17:30' },
    '토': { in: '09:00', out: '18:00', consult: '17:30' },
    '일': { in: '09:00', out: '18:00', consult: '17:30' }
  });
  
  // What
  const [targetGoal, setTargetGoal] = useState('');
  const [materials, setMaterials] = useState('');
  
  // When & How
  const [targetDate, setTargetDate] = useState('');
  const [wantsBuffer, setWantsBuffer] = useState(true);

  const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];

  const TIME_OPTIONS_24H = useMemo(() => {
    const options: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 10) {
        options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    options.push('24:00');
    return options;
  }, []);

  useEffect(() => {
    // Fetch user profile on mount
    axios.get(`${API_URL}/knowledge/profile/${userId}`)
      .then(res => {
        const profile = res.data.data;
        if (profile && Object.keys(profile).length > 0) {
          setAgeGroup(profile['학습자_정보'] || '');
          setCurrentLevel(profile['현재_수준'] || '');
          setTargetGoal(profile['목표'] || '');
          setTargetDate(profile['마감일'] || '');
          
          if (Array.isArray(profile['공부가능요일'])) {
            setActiveDaysList(profile['공부가능요일']);
          }
          
          setWantsBuffer(profile['예비일_선호'] !== false);
          setManagementType(profile['관리방식'] || '자율형');
          if (profile['등하원예약시간']) {
            // Merge defaults with loaded profile scheduled times
            setScheduledTimes(prev => {
              const merged = { ...prev };
              Object.keys(profile['등하원예약시간']).forEach(d => {
                const inT = profile['등하원예약시간'][d].in || '09:00';
                let outT = profile['등하원예약시간'][d].out || '18:00';
                if (outT === inT) outT = '18:00';
                merged[d] = {
                  in: inT,
                  out: outT,
                  consult: profile['등하원예약시간'][d].consult || '17:30'
                };
              });
              return merged;
            });
            if (profile['등하원예약시간']['월']) {
              const inT = profile['등하원예약시간']['월'].in || '09:00';
              let outT = profile['등하원예약시간']['월'].out || '18:00';
              if (outT === inT) outT = '18:00';
              setWorkingTime({
                in: inT,
                out: outT,
                consult: profile['등하원예약시간']['월'].consult || '17:30'
              });
            }
          }
        }
      })
      .catch(err => console.error("Failed to load profile", err));

    // Check if there is an ongoing session
    axios.get(`${API_URL}/knowledge/chat/${sessionId}`)
      .then(res => {
        if (res.data && res.data.data) {
          const session = res.data.data;
          if (session.current_stage >= 2 && session.draft_schedule) {
            setHasDraft(true);
          }
        }
      })
      .catch(err => console.error("Failed to load session", err));
  }, [userId, sessionId]);

  const [selectedDayTab, setSelectedDayTab] = useState<string>('월');
  const [workingTime, setWorkingTime] = useState<{ in: string; out: string; consult: string }>({
    in: '09:00', out: '18:00', consult: '17:30'
  });

  const calculateHours = (inTime: string, outTime: string) => {
    if (!inTime || !outTime) return 0;
    let [inH, inM] = inTime.split(':').map(Number);
    let [outH, outM] = outTime.split(':').map(Number);
    if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return 0;

    // Disambiguate 12:00 PM vs Midnight for evening study (e.g., 22:00 ~ 12:00 -> treat 12:00 as midnight 24:00)
    if (inH >= 18 && outH === 12) {
      outH = 24;
    }

    let inMins = inH * 60 + inM;
    let outMins = outH * 60 + outM;

    if (inMins === outMins) return 0;

    // Handle overnight/midnight schedules (e.g., 22:00 ~ 01:00 = 3시간)
    if (outMins < inMins) {
      outMins += 24 * 60;
    }

    const diffMins = outMins - inMins;
    return Math.round((diffMins / 60) * 10) / 10;
  };

  const handleSelectTab = (day: string) => {
    setSelectedDayTab(day);
    if (scheduledTimes[day] && activeDaysList.includes(day)) {
      setWorkingTime(scheduledTimes[day]);
    }
    // If not configured, workingTime is NOT cleared, carrying over last entered time!
  };

  const handleWorkingTimeChange = (type: 'in' | 'out' | 'consult', val: string) => {
    const updated = {
      ...workingTime,
      [type]: val
    };
    setWorkingTime(updated);
    if (activeDaysList.includes(selectedDayTab)) {
      setScheduledTimes(prev => ({
        ...prev,
        [selectedDayTab]: updated
      }));
    }
  };

  const handleConfirmDayTime = (day: string) => {
    setScheduledTimes(prev => ({
      ...prev,
      [day]: { ...workingTime }
    }));
    if (!activeDaysList.includes(day)) {
      setActiveDaysList(prev => [...prev, day]);
    }
  };

  const handleDeleteDayTime = (day: string) => {
    setActiveDaysList(prev => prev.filter(d => d !== day));
    setScheduledTimes(prev => {
      const updated = { ...prev };
      delete updated[day];
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (activeDaysList.length === 0) {
      alert("최소 하루 이상의 학습 요일을 선택해주세요.");
      return;
    }
    
    if (!ageGroup || !targetGoal || !targetDate) {
      alert("필수 항목을 모두 입력해주세요.");
      return;
    }

    // Calculate hours mapping from the time inputs dynamically
    const calculatedHoursMap: Record<string, number> = {};
    activeDaysList.forEach(day => {
      const timeObj = scheduledTimes[day] || { in: '09:00', out: '18:00', consult: '17:30' };
      calculatedHoursMap[day] = calculateHours(timeObj.in, timeObj.out);
    });

    const formData = {
      "학습자_정보": ageGroup,
      "현재_수준": currentLevel,
      "목표": targetGoal,
      "교재_및_범위": materials,
      "마감일": targetDate,
      "공부가능요일": activeDaysList,
      "일일학습시간": calculatedHoursMap, // 스터디 카페 공부 시간 기반 자동 환산
      "예비일_선호": wantsBuffer,
      "관리방식": managementType,
      "등하원예약시간": scheduledTimes
    };

    if (hasDraft) {
      onComplete(formData);
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API_URL}/knowledge/profile`, {
        user_id: userId,
        form_data: formData
      });
      onComplete(formData);
    } catch (err) {
      console.error(err);
      alert("진도표 생성 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px', margin: '-30px auto 40px auto', background: '#fff', borderRadius: '30px', padding: '50px 40px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative', zIndex: 10 }}>
      <h2 style={{ textAlign: 'center', color: '#0b1a6c', marginBottom: '10px', fontSize: '28px', fontWeight: '800' }}>목표 및 개인정보 설정</h2>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '25px' }}>아래 질문지를 작성해주시면, AI가 완벽하게 최적화된 학습 스케줄을 즉시 짜드립니다.</p>
      
      {/* 💡 MQstudy 메타인지 학습법 및 진도 수립 안내 배너 */}
      <div style={{
        background: 'linear-gradient(135deg, #e3f2fd, #fff8e1)',
        border: '2px solid #90caf9',
        padding: '25px',
        borderRadius: '20px',
        marginBottom: '35px',
        boxShadow: '0 8px 20px rgba(0,0,0,0.02)'
      }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#0d47a1', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
          💡 MQstudy 메타인지 학습법 및 진도 계획 수립 안내
        </h3>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#37474f', fontSize: '13px', lineHeight: '1.7' }}>
          <li><strong>스터디 카페 실공부 시간 기준 진도 배분</strong>: 진도 계획은 인강 수강이나 이동 시간을 제외하고, 본 스터디 카페에서 오롯이 집중해 공부하는 시간(입실 예정 시간 ~ 퇴실 예정 시간)만을 기준으로 생성됩니다.</li>
          <li><strong>문제 풀이 위주 분량 배제</strong>: 단순한 문제집 몇 페이지 풀이식이 아닌, 대단원/소단원별로 정의된 <strong>핵심 학습 목표</strong>를 달성하는 데 집중합니다.</li>
          <li><strong>자기주도식 개념 습득</strong>: 학습 목표를 파악한 뒤 교과서, 참고서, 인강 등 이용자(학생) 본인에게 가장 적합한 학습 수단을 스스로 선택하여 정해진 시간 내에 깊이 있게 탐구합니다.</li>
          <li><strong>AI 튜터 구술 평가</strong>: 공부를 마친 단원은 AI 튜터와 음성 또는 텍스트 질답을 통해 설명해보며, 알고 있는 느낌을 넘어 개념을 완벽하게 내재화했는지 평가받는 방식으로 진행됩니다.</li>
        </ul>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '40px' }}>
        <div style={{ flex: 1, height: '1px', background: '#eee', maxWidth: '100px' }}></div>
        <span style={{ margin: '0 15px', color: '#82d7ff' }}>💙</span>
        <div style={{ flex: 1, height: '1px', background: '#eee', maxWidth: '100px' }}></div>
      </div>
 
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        {/* 1. Who */}
        <div style={{ background: '#f4f9ff', padding: '30px', borderRadius: '20px', border: '2px solid #d6e8ff' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#0b1a6c', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: '#4285f4', color: '#fff', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👤</span>
            1. 이용자(학생) 정보 (Who)
          </h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '250px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>연령 / 직업 (필수)</label>
              <input type="text" placeholder="예: 중학교 2학년, 직장인, 취준생" value={ageGroup} onChange={e => setAgeGroup(e.target.value)} style={inputStyle} required />
            </div>
            <div style={{ flex: 1, minWidth: '250px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>현재 실력 수준</label>
              <input type="text" placeholder="예: 기초 부족, 토익 600점 수준" value={currentLevel} onChange={e => setCurrentLevel(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>관리 방식 선택 (필수)</label>
            <div style={{ display: 'flex', gap: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '15px', color: '#555', fontWeight: 'bold' }}>
                <input type="radio" name="managementType" value="자율형" checked={managementType === '자율형'} onChange={e => setManagementType(e.target.value)} style={{ width: '18px', height: '18px' }} />
                🎒 자율형 (스스로 학습 관리)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '15px', color: '#555', fontWeight: 'bold' }}>
                <input type="radio" name="managementType" value="관리형" checked={managementType === '관리형'} onChange={e => setManagementType(e.target.value)} style={{ width: '18px', height: '18px' }} />
                🏫 관리형 (관리자 상담 및 등하원 시간 체크)
              </label>
            </div>
            <div style={{ marginTop: '12px', padding: '12px 15px', borderRadius: '8px', background: '#e8f5e9', color: '#2e7d32', fontSize: '13px', border: '1px solid #c8e6c9', maxWidth: '600px', lineHeight: '1.4' }}>
              💡 <strong>관리형 추천 안내</strong>: 관리자의 1:1 대면 상담 및 밀착 출결 피드백 등으로 성취도를 높일 수 있습니다. 집중적인 관리를 희망하신다면 <strong>[관리형]</strong> 선택을 적극 권장합니다.
            </div>
          </div>
        </div>

        {/* 2. What */}
        <div style={{ background: '#f4fff4', padding: '30px', borderRadius: '20px', border: '2px solid #cce8cc' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#1b5e20', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: '#4caf50', color: '#fff', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🎯</span>
            2. 무엇을 공부하나요? (What)
          </h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '250px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>최종 목표 시험 (필수)</label>
              <input type="text" placeholder="예: 2학기 기말고사 국영수 만점, 정보처리기사" value={targetGoal} onChange={e => setTargetGoal(e.target.value)} style={inputStyle} required />
            </div>
            <div style={{ flex: 1, minWidth: '250px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>교재 및 세부 범위</label>
              <input type="text" placeholder="예: 쎈 수학 1~5단원, 시나공 기본서 전체" value={materials} onChange={e => setMaterials(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* 3. When & How */}
        <div style={{ background: '#fff9f0', padding: '30px', borderRadius: '20px', border: '2px solid #ffe0b2' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#e65100', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: '#ff9800', color: '#fff', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📅</span>
            3. 일정 및 제약 조건 (When & How)
          </h3>
          
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>목표 기한 (D-Day) (필수)</label>
            <input type="text" placeholder="예: 10월 5일까지, 4주 동안" value={targetDate} onChange={e => setTargetDate(e.target.value)} style={inputStyle} required />
          </div>

          {/* 학습 요일 선택 & 요일별 시간 탭 입력 */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#555' }}>
              🗓️ 요일별 학습 시간 설정 (월~일 탭 선택)
            </label>
            
            {/* 요일 선택 탭 바 (설정 시 주황색 테마) */}
            <div style={{ display: 'flex', borderBottom: '2px solid #ffe0b2', gap: '4px', flexWrap: 'wrap' }}>
              {daysOfWeek.map(day => {
                const isSelected = selectedDayTab === day;
                const isConfigured = activeDaysList.includes(day) && !!scheduledTimes[day];
                const timeObj = isSelected ? workingTime : (scheduledTimes[day] || workingTime);
                const hours = (isConfigured || isSelected) ? calculateHours(timeObj.in, timeObj.out) : 0;

                return (
                  <button
                    type="button"
                    key={day}
                    onClick={() => handleSelectTab(day)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px 10px 0 0',
                      border: isSelected ? '2px solid #e65100' : (isConfigured ? '2px solid #ff9800' : '1px solid #ddd'),
                      borderBottom: isSelected ? '2px solid #fff' : '1px solid #ddd',
                      background: isConfigured ? (isSelected ? '#e65100' : '#ff9800') : (isSelected ? '#fff3e0' : '#f5f5f5'),
                      color: isConfigured ? '#fff' : (isSelected ? '#e65100' : '#777'),
                      fontWeight: 'bold',
                      fontSize: '14px',
                      cursor: 'pointer',
                      marginBottom: '-2px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {day}({isConfigured ? `${hours}시간` : '미설정'})
                  </button>
                );
              })}
            </div>

            {/* 선택된 요일 단일 입력 카드 (시간 입력창 + 삭제 + 확인 같은 라인) */}
            {(() => {
              const day = selectedDayTab;

              return (
                <div style={{ background: '#fff', padding: '20px', borderRadius: '0 0 15px 15px', border: '2px solid #ffe0b2', borderTop: 'none', marginBottom: '20px' }}>
                  {/* 등원, 하원, 상담 입력창과 삭제, 확인 버튼 한 라인 배치 */}

                  {/* 등원, 하원, 상담 입력창과 삭제, 확인 버튼 한 라인 배치 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: '#fafafa', padding: '15px', borderRadius: '10px', border: '1px solid #eee' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#555', whiteSpace: 'nowrap' }}>⏰ 등원:</label>
                      <select 
                        value={workingTime.in} 
                        onChange={e => handleWorkingTimeChange('in', e.target.value)}
                        style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid #ccc', outline: 'none', fontSize: '14px', background: '#fff', color: '#333', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        {TIME_OPTIONS_24H.filter(t => t !== '24:00').map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#555', whiteSpace: 'nowrap' }}>🚪 하원:</label>
                      <select 
                        value={workingTime.out} 
                        onChange={e => handleWorkingTimeChange('out', e.target.value)}
                        style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid #ccc', outline: 'none', fontSize: '14px', background: '#fff', color: '#333', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        {TIME_OPTIONS_24H.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {managementType === '관리형' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#e65100', whiteSpace: 'nowrap' }}>💬 상담:</label>
                        <select 
                          value={workingTime.consult || '17:30'} 
                          onChange={e => handleWorkingTimeChange('consult', e.target.value)}
                          style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid #ffcc80', outline: 'none', background: '#fff8e1', fontSize: '14px', fontWeight: 'bold', color: '#e65100', cursor: 'pointer' }}
                        >
                          {TIME_OPTIONS_24H.filter(t => t !== '24:00').map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 등/하원 창과 같은 라인에 위치한 확인 & 삭제 버튼 */}
                    <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                      <button
                        type="button"
                        onClick={() => handleConfirmDayTime(day)}
                        style={{
                          background: '#ff9800',
                          color: '#fff',
                          border: 'none',
                          padding: '8px 18px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '13px',
                          boxShadow: '0 2px 6px rgba(255, 152, 0, 0.3)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        ✅ 확인
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDayTime(day)}
                        style={{
                          background: '#fff',
                          color: '#d32f2f',
                          border: '1px solid #ef9a9a',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '13px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        🗑️ 삭제
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 주간 총 공부시간 계산 및 버아웃 경고 */}
            {(() => {
              let totalMins = 0;
              activeDaysList.forEach(d => {
                const t = scheduledTimes[d] || { in: '09:00', out: '18:00' };
                const [inH, inM] = t.in.split(':').map(Number);
                const [outH, outM] = t.out.split(':').map(Number);
                const diff = (outH * 60 + outM) - (inH * 60 + inM);
                if (diff > 0) totalMins += diff;
              });
              const weeklyHours = Math.round(totalMins / 60);
              const isOver60 = weeklyHours > 60;
              return (
                <div style={{ marginBottom: '15px', padding: '12px 15px', borderRadius: '8px', background: isOver60 ? '#fff3e0' : '#e8f5e9', border: `1px solid ${isOver60 ? '#ffe0b2' : '#c8e6c9'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: isOver60 ? '#e65100' : '#2e7d32' }}>
                    📊 예상 주간 총 학습 시간: {weeklyHours}시간 (학습 요일 {activeDaysList.length}일)
                  </span>
                  {isOver60 && (
                    <span style={{ fontSize: '12px', color: '#d32f2f', fontWeight: 'bold', background: '#ffebee', padding: '4px 8px', borderRadius: '6px' }}>
                      💡 주 60시간 초과: 무리한 계획은 버아웃을 유발할 수 있습니다!
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Buffer Sunday 옵션 */}
            <div style={{ marginBottom: '15px', background: '#f5f5f5', padding: '10px 15px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                id="wantsBuffer"
                checked={wantsBuffer}
                onChange={e => setWantsBuffer(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="wantsBuffer" style={{ fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', color: '#444' }}>
                🗓️ 일요일을 '보충 학습/자율 휴식일(Buffer Day)'로 지정하여 주간 학습 완성도 높이기
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 'bold', color: '#555' }}>
              <input type="checkbox" checked={wantsBuffer} onChange={e => setWantsBuffer(e.target.checked)} style={{ width: '20px', height: '20px' }} />
              주 1회 예비일(복습/휴식) 포함하기
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
          <button type="button" onClick={() => { if(confirm("기존에 작성 중이던 모든 계획표가 삭제되고 처음부터 다시 시작합니다. 계속하시겠습니까?")) { localStorage.removeItem('selfstudy_session_id'); window.location.reload(); } }} style={{ background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '30px', width: '70px', height: '60px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>🔄<br/>초기화</button>
          
          <button 
            type="submit" 
            disabled={loading}
            style={{
              flex: 1,
              background: loading ? '#9e9e9e' : 'linear-gradient(90deg, #1976d2, #0b1a6c)',
              color: '#fff', padding: '18px', border: 'none', borderRadius: '30px',
              fontSize: '18px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 10px 20px rgba(11, 26, 108, 0.3)'
            }}
          >
            {loading ? 'AI가 최적의 진도표를 계산 중입니다...' : '🚀 나만의 진도 계획표 생성하기'}
          </button>
          
          <button type="button" style={{ background: '#bdbdbd', color: '#fff', border: 'none', borderRadius: '30px', width: '60px', height: '60px', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold' }}>공유</button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '14px 18px',
  borderRadius: '12px',
  border: '1px solid #e0e0e0',
  outline: 'none',
  fontSize: '15px',
  boxSizing: 'border-box' as const,
  background: '#fff',
  color: '#333',
  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
};
