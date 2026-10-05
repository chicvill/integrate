import type { RefObject } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatbotProps {
  messages: ChatMessage[];
  inputMsg: string;
  setInputMsg: (msg: string | ((prev: string) => string)) => void;
  evaluatingTaskInfo: { week_number: number, task_index: number, task_title: string } | null;
  loadingChat: boolean;
  isRecording: boolean;
  chatEndRef: RefObject<HTMLDivElement>;
  startRecording: () => void;
  handleSendEvaluation: () => void;
}

export default function AIChatbot({
  messages,
  inputMsg,
  setInputMsg,
  evaluatingTaskInfo,
  loadingChat,
  isRecording,
  chatEndRef,
  startRecording,
  handleSendEvaluation
}: AIChatbotProps) {
  return (
    <div style={{ flex: '1 1 320px', minWidth: '280px', minHeight: '400px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', border: '1px solid #bbdefb' }}>
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

      <div style={{ padding: '15px', borderTop: '1px solid #eee', background: '#fff', borderRadius: '0 0 12px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <textarea
          rows={2}
          value={inputMsg}
          onChange={e => setInputMsg(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendEvaluation();
            }
          }}
          placeholder={evaluatingTaskInfo ? "학습한 내용을 설명해주세요..." : "무엇이든 자유롭게 질문하거나 [평가받기]를 눌러주세요..."}
          disabled={loadingChat}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px 15px',
            borderRadius: '8px',
            border: '1px solid #ccc',
            outline: 'none',
            fontSize: '14px',
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: '1.4'
          }}
        />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={startRecording}
            title="마이크로 입력하기"
            style={{ 
              background: isRecording ? '#ffebee' : '#f5f5f5', 
              color: isRecording ? '#d32f2f' : '#333', 
              border: '1px solid #ccc', 
              borderRadius: '8px', 
              padding: '8px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            <span>{isRecording ? '🛑' : '🎤'}</span>
            <span>{isRecording ? '녹음 중지' : '음성 입력'}</span>
          </button>

          <button 
            onClick={handleSendEvaluation}
            disabled={!inputMsg.trim() || loadingChat}
            style={{ 
              background: !inputMsg.trim() ? '#ccc' : '#1976d2', 
              color: '#fff', 
              border: 'none', 
              padding: '8px 24px', 
              borderRadius: '8px', 
              cursor: !inputMsg.trim() ? 'not-allowed' : 'pointer', 
              fontWeight: 'bold',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🚀 전송</span>
          </button>
        </div>
      </div>
    </div>
  );
}
