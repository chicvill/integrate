import { useState, useEffect } from 'react';
import axios from 'axios';

import { API_URL } from './config';
import TextbookSelectorChips from './components/TextbookSelectorChips';

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
  
  const [recommendedTextbooks, setRecommendedTextbooks] = useState<any[]>([]);
  const [selectedTextbookTitle, setSelectedTextbookTitle] = useState<string>('');

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
      await fetchRecommendedTextbooks();
    };
    
    loadSession();
  }, []);

  const fetchRecommendedTextbooks = async () => {
    try {
      const res = await axios.post(`${API_URL}/knowledge/recommend_textbooks`, {
        user_goal: goalData
      });
      const tbList = res.data?.data?.textbooks || res.data?.data?.Textbooks || [];
      setRecommendedTextbooks(tbList);
    } catch (e) {
      console.error("Textbook recommendation error", e);
    }
  };

  const applyTextbookToSubjects = (tb: any) => {
    setSelectedTextbookTitle(tb.title);
    const formattedSubject = {
      subject_name: tb.title,
      textbook_title: tb.title,
      weight_percent: 100,
      units: (tb.units || []).map((u: any) => ({
        unit_name: u.unit_name,
        start_page: u.start_page,
        end_page: u.end_page,
        difficulty_type: u.difficulty_type || 'normal',
        weight_multiplier: u.weight_multiplier || 1.0,
        weight_percent: Math.round(100 / ((tb.units && tb.units.length) || 1))
      }))
    };
    setSubjects([formattedSubject]);
  };

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
    setError('');
    try {
      const cleanSubjects = subjects.map(s => ({
        ...s,
        weight_percent: Number(s.weight_percent) || 0,
        units: (s.units || []).map((u: any) => ({
          unit_name: typeof u === 'string' ? u : (u.unit_name || '단원'),
          weight_percent: Number(typeof u === 'object' ? u.weight_percent : 0) || 0
        }))
      }));

      const aiDraft = {
        plan_title: planTitle || "맞춤형 진도 계획",
        overall_strategy: overallStrategy || "",
        target_date_iso: targetDateIso || goalData?.마감일 || "",
        subjects: cleanSubjects
      };
      
      const res = await axios.post(`${API_URL}/knowledge/generate_schedule_final`, {
        form_data: { ...(goalData || {}), user_id: userId },
        ai_draft: aiDraft,
        session_id: sessionId
      });

      if (res.data && res.data.status === 'success') {
        onFinalized();
      } else {
        setError(res.data?.message || "스케줄 생성 중 오류가 발생하였습니다.");
      }
    } catch (err: any) {
      console.error("Finalize schedule error:", err);
      const detail = err.response?.data?.detail || err.message || "서버 통신 오류";
      setError(`최종 스케줄 생성 중 오류가 발생하였습니다 (${detail})`);
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
      {error && <div style={{ color: 'red', marginBottom: '20px', background: '#ffebee', padding: '12px', borderRadius: '8px', border: '1px solid #ffcdd2' }}>{error}</div>}

      {!loading && step === 2 && (
        <div>
          <h3>📚 Step 2: 과목 및 교재 확정</h3>
          <p style={{ color: '#666' }}>AI가 수험생의 목표에 맞춰 분석한 대표 교재 및 과목 리스트입니다.</p>
          
          <TextbookSelectorChips
            recommendedTextbooks={recommendedTextbooks}
            selectedTextbookTitle={selectedTextbookTitle}
            onSelectTextbook={applyTextbookToSubjects}
          />

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
          <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => window.location.reload()} style={{ background: '#f5f5f5', color: '#555', border: '1px solid #ccc', padding: '12px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>⬅️ 목표 재입력</button>
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
          <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setStep(2)} style={{ background: '#f5f5f5', color: '#555', border: '1px solid #ccc', padding: '12px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>⬅️ 이전 단계 (과목 확정)</button>
            <button onClick={generateUnits} disabled={subjects.reduce((a, b) => a + (b.weight_percent || 0), 0) !== 100} style={{ background: '#1565c0', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', opacity: subjects.reduce((a, b) => a + (b.weight_percent || 0), 0) === 100 ? 1 : 0.5 }}>다음 단계 (단원 생성) ➡️</button>
          </div>
        </div>
      )}

      {!loading && step === 4 && (
        <div>
          <h3>📑 Step 4: 교재 단원(목차) 및 페이지 범주 확정</h3>
          <p style={{ color: '#666' }}>교재의 단원명과 시작/끝 페이지 범위를 편집할 수 있습니다.</p>
          <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: '10px' }}>
            {subjects.map((s, sIdx) => (
              <div key={sIdx} style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>{s.subject_name}</h4>
                {(s.units || []).map((u:any, uIdx:number) => (
                  <div key={uIdx} style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input 
                      type="text" 
                      value={u.unit_name} 
                      onChange={e => handleUnitChange(sIdx, uIdx, 'unit_name', e.target.value)} 
                      style={{ flex: 2, minWidth: '160px', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#666' }}>p.</span>
                      <input 
                        type="number" 
                        value={u.start_page || ''} 
                        placeholder="시작" 
                        onChange={e => handleUnitChange(sIdx, uIdx, 'start_page', Number(e.target.value))} 
                        style={{ width: '55px', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', textAlign: 'center' }}
                      />
                      <span>~</span>
                      <input 
                        type="number" 
                        value={u.end_page || ''} 
                        placeholder="끝" 
                        onChange={e => handleUnitChange(sIdx, uIdx, 'end_page', Number(e.target.value))} 
                        style={{ width: '55px', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', textAlign: 'center' }}
                      />
                    </div>
                    <button onClick={() => handleRemoveUnit(sIdx, uIdx)} style={{ background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 10px' }}>X</button>
                  </div>
                ))}
                <button onClick={() => handleAddUnit(sIdx)} style={{ background: '#fff', border: '1px solid #ccc', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>+ 단원 추가</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setStep(3)} style={{ background: '#f5f5f5', color: '#555', border: '1px solid #ccc', padding: '12px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>⬅️ 이전 단계 (과목 비중)</button>
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
          
          <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setStep(4)} style={{ background: '#f5f5f5', color: '#555', border: '1px solid #ccc', padding: '15px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>⬅️ 이전 단계 (단원 확정)</button>
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
