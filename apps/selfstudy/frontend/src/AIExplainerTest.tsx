import { useState } from 'react';
import axios from 'axios';

import { API_URL } from './config';

interface AIExplainerTestProps {
  sessionId: string;
  subject: string;
  onClose: () => void;
  onComplete: (score: number) => void;
}

export default function AIExplainerTest({ sessionId, subject, onClose, onComplete }: AIExplainerTestProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

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
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setIsListening(false);
      evaluateUnderstanding(text);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const evaluateUnderstanding = async (text: string) => {
    setLoading(true);
    try {
      // API call to evaluate (we'll mock it for now or implement in backend)
      const resp = await axios.post(`${API_URL}/knowledge/evaluate`, {
        session_id: sessionId,
        subject: subject,
        explanation: text
      });
      setResult(resp.data);
      if (resp.data.score) {
        onComplete(resp.data.score);
      }
    } catch (err) {
      console.error(err);
      alert("평가 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', width: '500px', maxWidth: '90%', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✖</button>
        
        <h2 style={{ color: '#1976d2', marginTop: 0 }}>🎙️ {subject} 성취도 평가</h2>
        <p style={{ color: '#555', fontSize: '14px' }}>오늘 공부한 핵심 내용을 AI 면접관에게 소리내어 설명해보세요! 설명이 명확할수록 높은 성취도 점수를 받습니다.</p>

        {!result && (
          <div style={{ textAlign: 'center', margin: '40px 0' }}>
            <button 
              onClick={handleMicClick}
              disabled={loading || isListening}
              style={{
                background: isListening ? '#f44336' : '#1976d2',
                color: '#fff', border: 'none', borderRadius: '50%', width: '100px', height: '100px',
                fontSize: '40px', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                animation: isListening ? 'pulse 1.5s infinite' : 'none'
              }}
            >
              🎤
            </button>
            <p style={{ marginTop: '15px', color: isListening ? '#f44336' : '#666', fontWeight: 'bold' }}>
              {isListening ? '듣고 있습니다... 말씀해주세요!' : '버튼을 눌러 말하기'}
            </p>
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', color: '#1976d2', fontWeight: 'bold' }}>AI가 답변을 분석 중입니다... ⏳</div>}

        {result && (
          <div style={{ marginTop: '20px', background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>분석 결과: {result.score}점</h3>
            <p style={{ fontSize: '14px', color: '#555', margin: '0 0 10px 0' }}><strong>내 답변:</strong> {transcript}</p>
            <div style={{ fontSize: '14px', color: '#1565c0', background: '#e3f2fd', padding: '10px', borderRadius: '4px' }}>
              <strong>AI 피드백:</strong> {result.feedback}
            </div>
            <button onClick={onClose} style={{ marginTop: '20px', width: '100%', background: '#4caf50', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              확인
            </button>
          </div>
        )}
      </div>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 15px rgba(244, 67, 54, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(244, 67, 54, 0); }
        }
      `}</style>
    </div>
  );
}
