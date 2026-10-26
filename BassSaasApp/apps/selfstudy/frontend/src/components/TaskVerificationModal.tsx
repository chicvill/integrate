import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface TaskVerificationModalProps {
  sessionId: string;
  targetTask: { weekNum: number; taskIdx: number; task: any };
  onClose: () => void;
  onVerified: (weekNum: number, taskIdx: number) => void;
}

export default function TaskVerificationModal({
  sessionId,
  targetTask,
  onClose,
  onVerified
}: TaskVerificationModalProps) {
  const [oneLineSummary, setOneLineSummary] = useState('');
  const [actualMinutes, setActualMinutes] = useState<number>(targetTask.task.estimated_minutes || 30);
  const [verifying, setVerifying] = useState(false);

  const handleConfirm = async () => {
    setVerifying(true);
    try {
      await axios.post(`${API_URL}/knowledge/task_verify`, {
        session_id: sessionId,
        task_title: targetTask.task.task_title || targetTask.task.unit_name,
        one_line_summary: oneLineSummary.trim(),
        actual_minutes: Number(actualMinutes) || 30
      });
      onVerified(targetTask.weekNum, targetTask.taskIdx);
    } catch (e) {
      console.error("Verification submit error", e);
    }
    setVerifying(false);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#fff', padding: '25px', borderRadius: '15px', maxWidth: '460px', width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#1565c0', fontSize: '18px' }}>📝 학습 완료 및 1줄 요약 인증</h3>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '15px' }}>
          <strong>[{targetTask.task.task_title || targetTask.task.unit_name}]</strong> 단원 학습을 완료하셨나요? 오늘 배운 내용을 간단히 1줄로 작성해주세요.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '4px' }}>
              오늘 배운 핵심 1줄 요약 (선택):
            </label>
            <input
              type="text"
              value={oneLineSummary}
              onChange={e => setOneLineSummary(e.target.value)}
              placeholder="예: 지수함수의 기본 성질과 그래프 대칭성을 이해함"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '14px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '4px' }}>
              실제 공부 소요 시간 (분):
            </label>
            <input
              type="number"
              value={actualMinutes}
              onChange={e => setActualMinutes(Number(e.target.value))}
              style={{ width: '100px', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', textAlign: 'center' }}
            /> 분
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ background: '#f5f5f5', border: '1px solid #ccc', color: '#555', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={verifying}
            style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {verifying ? '저장 중...' : '✅ 완료 인증하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
