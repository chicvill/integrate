import { useState, useEffect } from 'react';
import axios from 'axios';

import { API_URL } from './config';

interface Props {
  sessionId: string;
  userId: string;
  initialFormData: any;
  onFinalized: () => void;
}

export default function ScheduleBuilderWizard({ sessionId, userId, initialFormData, onFinalized }: Props) {
  const [step, setStep] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // States to hold intermediate AI data
  const [goalData] = useState<any>(initialFormData);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [planTitle, setPlanTitle] = useState('');
  const [overallStrategy, setOverallStrategy] = useState('');
  const [targetDateIso, setTargetDateIso] = useState('');
  
  useEffect(() => {
    const loadSession = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/knowledge/chat/${sessionId}`);
        if (res.data.data) {
          const session = res.data.data;
          if (session.draft_schedule) {
            const draft = session.draft_schedule;
            setPlanTitle(draft.plan_title || "맞춤형 진도 계획");
            setOverallStrategy(draft.overall_strategy || "");
            
            const sheet = draft.spreadsheet_data || draft;
            if (sheet.subjects && sheet.subjects.length > 0) {
              setSubjects(sheet.subjects);
              setTargetDateIso(sheet.target_date_iso || goalData?.마감일);
              setLoading(false);
              return;
            }
          }
        }
      } catch (err) {
        console.error("Failed to load session", err);
      }
      
      // Fallback: If no saved subjects, generate them via AI
      await generateSubjects();
    };
    
    loadSession();
  }, []);

  const generateSubjects = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/knowledge/generate_subjects`, {
        user_goal: goalData,
        tags: ["대화형온보딩", goalData?.목표 || ""]
      });
      const data = res.data.data;
      if (data.error) {
        setError(`AI 에러: ${data.error}`);
      }
      setPlanTitle(data.plan_title || "맞춤형 진도 계획");
      setOverallStrategy(data.overall_strategy || "");
      setTargetDateIso(data.target_date_iso || goalData?.마감일);
      setSubjects(data.subjects || data.Subjects || []);
    } catch (err) {
      setError("과목 생성 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  const generateSubjectWeights = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/knowledge/generate_subject_weights`, {
        subjects: subjects,
        user_goal: goalData
      });
      const data = res.data.data;
      if (data.error) {
        setError(`AI 에러: ${data.error}`);
        setLoading(false);
        return;
      }
      // Merge weights
      const weightedSubjects = data.subjects || data.Subjects || [];
      setSubjects(weightedSubjects);
      setStep(3);
    } catch (err) {
      setError("과목 비중 산출 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  const generateUnits = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/knowledge/generate_units`, {
        subjects: subjects,
        user_goal: goalData
      });
      const data = res.data.data;
      if (data.error) {
        setError(`AI 에러: ${data.error}`);
        setLoading(false);
        return;
      }
      setSubjects(data.subjects || data.Subjects || []);
      setStep(4);
    } catch (err) {
      setError("단원 생성 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  const generateUnitWeights = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/knowledge/generate_unit_weights`, {
        subjects_with_units: subjects,
        user_goal: goalData
      });
      const data = res.data.data;
      if (data.error) {
        setError(`AI 에러: ${data.error}`);
        setLoading(false);
        return;
      }
      setSubjects(data.subjects || data.Subjects || []);
      setStep(5);
    } catch (err) {
      setError("단원 비중 산출 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  const finalizeSchedule = async () => {
    setLoading(true);
    try {
      const aiDraft = {
        plan_title: planTitle,
        overall_strategy: overallStrategy,
        target_date_iso: targetDateIso,
        subjects: subjects
      };
      
      await axios.post(`${API_URL}/knowledge/generate_schedule_final`, {
        form_data: { ...goalData, user_id: userId },
        ai_draft: aiDraft,
        session_id: sessionId
      });
      
      onFinalized();
    } catch (err) {
      setError("최종 스케줄 생성 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  // UI Handlers for editing
  const handleSubjectChange = (idx: number, key: string, val: any) => {
    const newSubjects = [...subjects];
    newSubjects[idx][key] = val;
    setSubjects(newSubjects);
  };
  
  const handleAddSubject = () => setSubjects([...subjects, { subject_name: "" }]);
  const handleRemoveSubject = (idx: number) => setSubjects(subjects.filter((_, i) => i !== idx));

  const handleUnitChange = (sIdx: number, uIdx: number, key: string, val: any) => {
    const newSubjects = [...subjects];
    newSubjects[sIdx].units[uIdx][key] = val;
    setSubjects(newSubjects);
  };
  
  const handleAddUnit = (sIdx: number) => {
    const newSubjects = [...subjects];
    if(!newSubjects[sIdx].units) newSubjects[sIdx].units = [];
    newSubjects[sIdx].units.push({ unit_name: "" });
    setSubjects(newSubjects);
  };
  
  const handleRemoveUnit = (sIdx: number, uIdx: number) => {
    const newSubjects = [...subjects];
    newSubjects[sIdx].units = newSubjects[sIdx].units.filter((_:any, i:number) => i !== uIdx);
    setSubjects(newSubjects);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', background: '#fff', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
      <h2 style={{ color: '#1565c0', textAlign: 'center' }}>⚙️ 맞춤형 스케줄러 빌더</h2>
      
      {/* Stepper Progress */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', borderBottom: '2px solid #eee', paddingBottom: '15px' }}>
        {[2,3,4,5].map(s => (
          <div key={s} style={{ fontWeight: 'bold', color: step >= s ? '#1565c0' : '#ccc' }}>
            Step {s}
          </div>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', color: '#666', margin: '20px 0' }}>AI가 계산 중입니다. 잠시만 기다려주세요... ⏳</div>}
      {error && <div style={{ color: 'red', marginBottom: '20px' }}>{error}</div>}

      {!loading && step === 2 && (
        <div>
          <h3>📚 Step 2: 과목 리스트 확정</h3>
          <p style={{ color: '#666' }}>AI가 도출한 과목 리스트입니다. 누락되거나 불필요한 과목이 있다면 수정해주세요.</p>
          {subjects.map((s, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input 
                type="text" 
                value={s.subject_name} 
                onChange={e => handleSubjectChange(idx, 'subject_name', e.target.value)} 
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
              <button onClick={() => handleRemoveSubject(idx)} style={{ background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '6px', padding: '0 15px' }}>삭제</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button onClick={handleAddSubject} style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ccc', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>+ 과목 추가</button>
            <button onClick={generateSubjects} style={{ background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🔄 AI로 새로 생성</button>
          </div>
          <div style={{ marginTop: '30px', textAlign: 'right' }}>
            <button onClick={generateSubjectWeights} style={{ background: '#1565c0', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>다음 단계 (과목 비중 산출) ➡️</button>
          </div>
        </div>
      )}

      {!loading && step === 3 && (
        <div>
          <h3>⚖️ Step 3: 과목별 비중 조절</h3>
          <p style={{ color: '#666' }}>AI가 산출한 과목별 학습 비중입니다. 총합이 100%가 되도록 조정해주세요.</p>
          {subjects.map((s, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
              <span style={{ width: '150px', fontWeight: 'bold' }}>{s.subject_name}</span>
              <input 
                type="number" 
                value={s.weight_percent || 0} 
                onChange={e => handleSubjectChange(idx, 'weight_percent', Number(e.target.value))} 
                style={{ width: '80px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', textAlign: 'right' }}
              /> %
            </div>
          ))}
          <div style={{ fontWeight: 'bold', marginTop: '15px' }}>
            합계: <span style={{ color: subjects.reduce((a, b) => a + (b.weight_percent || 0), 0) === 100 ? 'green' : 'red' }}>
              {subjects.reduce((a, b) => a + (b.weight_percent || 0), 0)}%
            </span>
          </div>
          <div style={{ marginTop: '30px', textAlign: 'right' }}>
            <button onClick={generateUnits} disabled={subjects.reduce((a, b) => a + (b.weight_percent || 0), 0) !== 100} style={{ background: '#1565c0', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', opacity: subjects.reduce((a, b) => a + (b.weight_percent || 0), 0) === 100 ? 1 : 0.5 }}>다음 단계 (단원 생성) ➡️</button>
          </div>
        </div>
      )}

      {!loading && step === 4 && (
        <div>
          <h3>📑 Step 4: 단원(목차) 리스트 확정</h3>
          <p style={{ color: '#666' }}>과목별 구체적인 학습 단원(Action) 리스트입니다. 자유롭게 편집하세요.</p>
          <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: '10px' }}>
            {subjects.map((s, sIdx) => (
              <div key={sIdx} style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>{s.subject_name}</h4>
                {(s.units || []).map((u:any, uIdx:number) => (
                  <div key={uIdx} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <input 
                      type="text" 
                      value={u.unit_name} 
                      onChange={e => handleUnitChange(sIdx, uIdx, 'unit_name', e.target.value)} 
                      style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                    />
                    <button onClick={() => handleRemoveUnit(sIdx, uIdx)} style={{ background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '6px', padding: '0 10px' }}>X</button>
                  </div>
                ))}
                <button onClick={() => handleAddUnit(sIdx)} style={{ background: '#fff', border: '1px solid #ccc', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>+ 단원 추가</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '30px', textAlign: 'right' }}>
            <button onClick={generateUnitWeights} style={{ background: '#1565c0', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>다음 단계 (단원 비중 산출) ➡️</button>
          </div>
        </div>
      )}

      {!loading && step === 5 && (
        <div>
          <h3>⚖️ Step 5: 단원별 비중 조절</h3>
          <p style={{ color: '#666' }}>각 과목 내에서 단원들의 중요도를 조절하세요. (과목별 총합 100%)</p>
          <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: '10px' }}>
            {subjects.map((s, sIdx) => {
              const total = (s.units || []).reduce((a:any, b:any) => a + (b.weight_percent || 0), 0);
              return (
                <div key={sIdx} style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#1565c0', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{s.subject_name}</span>
                    <span style={{ color: total === 100 ? 'green' : 'red', fontSize: '14px' }}>합계: {total}%</span>
                  </h4>
                  {(s.units || []).map((u:any, uIdx:number) => (
                    <div key={uIdx} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                      <span style={{ flex: 1, fontSize: '14px' }}>{u.unit_name}</span>
                      <input 
                        type="number" 
                        value={u.weight_percent || 0} 
                        onChange={e => handleUnitChange(sIdx, uIdx, 'weight_percent', Number(e.target.value))} 
                        style={{ width: '60px', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', textAlign: 'right' }}
                      /> %
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          
          <div style={{ marginTop: '30px', textAlign: 'right' }}>
            <button 
              onClick={finalizeSchedule} 
              disabled={subjects.some(s => (s.units||[]).reduce((a:any,b:any)=>a+(b.weight_percent||0),0) !== 100)}
              style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '15px 30px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', opacity: subjects.some(s => (s.units||[]).reduce((a:any,b:any)=>a+(b.weight_percent||0),0) !== 100) ? 0.5 : 1 }}
            >
              🚀 최종 스케줄 생성 (완료)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
