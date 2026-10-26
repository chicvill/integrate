import { useState, useMemo, useEffect, useRef } from 'react';

interface ProgressTableProps {
  schedule: any;
  achievementRates: Record<string, number>;
  toggleTask: (weekNum: number, taskIdx: number, forceCompleted?: boolean) => void;
  handleOpenVerifyModal: (weekNum: number, taskIdx: number, task: any) => void;
  startEvaluation: (weekNum: number, taskIdx: number, task: any) => void;
}

export default function ProgressTable({
  schedule,
  achievementRates,
  toggleTask,
  handleOpenVerifyModal,
  startEvaluation
}: ProgressTableProps) {
  const payload = schedule?.payload || {};
  
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Initialize selected subject if empty
  useEffect(() => {
    if (!selectedSubject && payload.spreadsheet_data?.subjects?.length > 0) {
      setSelectedSubject(payload.spreadsheet_data.subjects[0].subject_name);
    }
  }, [payload.spreadsheet_data?.subjects, selectedSubject]);

  const flatTasks = useMemo(() => {
    const tasks: any[] = [];
    payload.curriculum?.forEach((week: any) => {
      week.daily_tasks?.forEach((task: any, idx: number) => {
        tasks.push({ week_number: week.week_number, task_index: idx, ...task });
      });
    });
    return tasks;
  }, [payload.curriculum]);

  const filteredTasks = useMemo(() => {
    return flatTasks.filter(t => t.subject === selectedSubject);
  }, [flatTasks, selectedSubject]);

  const imbalanceAlert = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const subjectStats: Record<string, { totalPast: number, completedPast: number }> = {};
    
    flatTasks.forEach(t => {
      if (!t.subject || t.subject === '전과목 공통') return;
      if (!subjectStats[t.subject]) {
        subjectStats[t.subject] = { totalPast: 0, completedPast: 0 };
      }
      
      if (t.date <= todayStr) {
        subjectStats[t.subject].totalPast += 1;
        if (t.completed) {
          subjectStats[t.subject].completedPast += 1;
        }
      }
    });

    let maxRate = -1;
    let minRate = 101;
    let maxSubj = '';
    let minSubj = '';

    Object.entries(subjectStats).forEach(([subj, stats]) => {
      if (stats.totalPast > 0) {
        const rate = (stats.completedPast / stats.totalPast) * 100;
        if (rate > maxRate) {
          maxRate = rate;
          maxSubj = subj;
        }
        if (rate < minRate) {
          minRate = rate;
          minSubj = subj;
        }
      }
    });

    if (maxRate !== -1 && minRate !== 101 && (maxRate - minRate) >= 30) {
      return { maxSubj, maxRate: Math.round(maxRate), minSubj, minRate: Math.round(minRate) };
    }
    return null;
  }, [flatTasks]);

  const totalTasks = filteredTasks.length;
  const completedTasksCount = useMemo(() => filteredTasks.filter(t => t.completed).length, [filteredTasks]);
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

  return (
    <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', flexShrink: 0 }}>
      <div style={{ borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '15px' }}>
        <h2 style={{ color: '#1976d2', margin: '0 0 4px 0', fontSize: '20px' }}>🏃 나의 진도 계획표</h2>
        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>[{payload.plan_title || '진도 계획'}]</p>
      </div>

      {imbalanceAlert && (
        <div style={{ marginBottom: '15px', padding: '12px 16px', background: '#ffebee', borderRadius: '8px', border: '1px solid #ffcdd2', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🚨</span>
          <div style={{ fontSize: '14px', color: '#c62828', lineHeight: '1.4' }}>
            <strong>학습 불균형 감지!</strong> '{imbalanceAlert.maxSubj}' 달성률({imbalanceAlert.maxRate}%) 대비 '{imbalanceAlert.minSubj}' 달성률({imbalanceAlert.minRate}%)이 크게 뒤처져 있습니다. 오늘은 <strong>'{imbalanceAlert.minSubj}'</strong> 학습에 더 집중해 보세요!
          </div>
        </div>
      )}

      {/* 과목 탭 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '15px', overflowX: 'auto', paddingBottom: '6px', WebkitOverflowScrolling: 'touch' }}>
        {(payload.spreadsheet_data?.subjects || []).map((subj: any) => (
          <button
            key={subj.subject_name}
            onClick={() => setSelectedSubject(subj.subject_name)}
            style={{
              background: selectedSubject === subj.subject_name ? '#1976d2' : '#f0f0f0',
              color: selectedSubject === subj.subject_name ? '#fff' : '#555',
              border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer',
              fontWeight: selectedSubject === subj.subject_name ? 'bold' : 'normal',
              whiteSpace: 'nowrap', fontSize: '14px', flexShrink: 0
            }}
          >
            {subj.subject_name}
          </button>
        ))}
      </div>

      {/* 진도 프로그레스 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', background: '#f8f9fa', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#555', whiteSpace: 'nowrap' }}>
          진도율 {progressPercent}%
        </span>
        <div style={{ flex: 1, minWidth: '120px', height: '8px', background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: '#4caf50', borderRadius: '4px', transition: 'width 0.4s ease' }} />
        </div>
        <span style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap' }}>
          ({completedTasksCount} / {totalTasks} 완료)
        </span>
      </div>

      {/* 스크롤 가이드 힌트 */}
      <div style={{ fontSize: '11px', color: '#1976d2', background: '#e3f2fd', padding: '4px 10px', borderRadius: '4px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>👈 좌우로 스크롤하시면 전체 정보를 보실 수 있습니다 👉</span>
        <span style={{ fontSize: '10px', color: '#666' }}>(두 손가락으로 화면 확대 가능)</span>
      </div>

      {/* 스크롤 가능한 일자별 리스트 */}
      <div ref={listContainerRef} style={{ height: '240px', overflow: 'auto', border: '1px solid #eee', borderRadius: '8px', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f5f5f5', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #ddd', background: '#f5f5f5', width: '125px', whiteSpace: 'nowrap' }}>일자 (요일)</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid #ddd', background: '#f5f5f5', width: '80px', whiteSpace: 'nowrap' }}>배정시간</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #ddd', background: '#f5f5f5', minWidth: '220px' }}>단원명</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid #ddd', background: '#f5f5f5', width: '130px', whiteSpace: 'nowrap' }}>상태 / 성취율</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((task, idx) => {
              const isChecked = task.completed;
              const achievementKey = `${task.week_number}_${task.task_index}`;
              const rate = achievementRates[achievementKey] || (isChecked ? 100 : null);
              
              return (
                <tr key={idx} data-date={task.date} style={{ borderBottom: '1px solid #eee', background: isChecked ? '#fdfdfd' : '#fff' }}>
                  <td style={{ padding: '10px 12px', color: '#555', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{task.date} ({(typeof task.day === 'string' && task.day.includes('- ')) ? task.day.split('- ')[1] : task.day || '?'})</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#666', whiteSpace: 'nowrap' }}>{task.estimated_minutes}분</td>
                  <td style={{ padding: '10px 12px', color: isChecked ? '#aaa' : '#333', textDecoration: isChecked ? 'line-through' : 'none', wordBreak: 'keep-all', lineHeight: '1.4' }}>
                    <div style={{ fontWeight: 'bold' }}>
                      {task.page_range && task.task_title ? task.task_title.replace(task.page_range, '').trim() : (task.task_title || task.unit_name)}
                      {task.page_range && (
                        <span style={{ color: '#1565c0', marginLeft: '6px' }}>{task.page_range}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {isChecked ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <span style={{ color: '#4caf50', fontWeight: 'bold', fontSize: '13px' }}>✅ 완료 ({rate || 100}%)</span>
                        <button onClick={() => toggleTask(task.week_number, task.task_index, false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '11px' }}>취소</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button 
                          onClick={() => handleOpenVerifyModal(task.week_number, task.task_index, task)}
                          style={{ background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap' }}
                        >
                          📝 요약/완료
                        </button>
                        <button 
                          onClick={() => startEvaluation(task.week_number, task.task_index, task)}
                          style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #81c784', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap' }}
                        >
                          🎙️ 평가
                        </button>
                      </div>
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
  );
}
