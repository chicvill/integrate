import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface ThreeWayChatProps {
  sessionId: string;
  currentUserRole: 'student' | 'parent' | 'admin';
  title?: string;
  height?: string;
  showEncouragementCards?: boolean;
}

export default function ThreeWayChat({
  sessionId,
  currentUserRole,
  title = "💬 3자 실시간 소통방",
  height = "350px",
  showEncouragementCards = false
}: ThreeWayChatProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');

  const fetchMessages = async () => {
    if (!sessionId) return;
    try {
      const res = await axios.get(`${API_URL}/knowledge/messages/${sessionId}`);
      if (res.data.status === 'success') {
        setMessages(res.data.data);
      }
    } catch (e) {
      console.error("Failed to fetch messages", e);
    }
  };

  useEffect(() => {
    fetchMessages();
    const timer = setInterval(fetchMessages, 4000);
    return () => clearInterval(timer);
  }, [sessionId]);

  const handleSendMsg = async (textToSend?: string) => {
    const text = textToSend || newMsg.trim();
    if (!text || !sessionId) return;
    try {
      await axios.post(`${API_URL}/knowledge/messages/${sessionId}`, {
        sender_role: currentUserRole,
        content: text
      });
      if (!textToSend) setNewMsg('');
      await fetchMessages();
    } catch (e) {
      console.error("Failed to send message", e);
    }
  };

  return (
    <div style={{ flex: 1, minWidth: '300px', background: '#f1f8e9', border: '1px solid #c5e1a5', borderRadius: '10px', display: 'flex', flexDirection: 'column', height }}>
      <div style={{ background: '#33691e', padding: '12px 15px', borderRadius: '10px 10px 0 0', color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>
        {title}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#f9fbe7' }}>
        {messages.map((m: any) => {
          const isSelf = m.sender_role === currentUserRole;
          let roleLabel = '이용자(학생)';
          if (m.sender_role === 'admin') roleLabel = '관리자';
          if (m.sender_role === 'parent') roleLabel = '학부모';

          return (
            <div key={m.id || m.created_at} style={{ display: 'flex', justifyContent: isSelf ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%', padding: '8px 12px', borderRadius: '12px',
                background: isSelf ? '#33691e' : '#fff',
                color: isSelf ? '#fff' : '#333',
                border: '1px solid #dcdde1',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                fontSize: '12px'
              }}>
                <div style={{ fontSize: '9px', color: isSelf ? '#c5e1a5' : '#888', marginBottom: '3px', fontWeight: 'bold' }}>
                  {roleLabel} {isSelf && '(나)'}
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

      {showEncouragementCards && (
        <div style={{ background: '#f0f4c3', padding: '6px 10px', display: 'flex', gap: '6px', overflowX: 'auto', flexWrap: 'nowrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#33691e', whiteSpace: 'nowrap', alignSelf: 'center' }}>👏 응원 보내기:</span>
          <button
            type="button"
            onClick={() => handleSendMsg("🍕 오늘도 최선을 다하는 네가 정말 자랑스러워! 화이팅!")}
            style={{ background: '#fff', border: '1px solid #aed581', borderRadius: '12px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#33691e' }}
          >
            🍕 오늘도 수고했어!
          </button>
          <button
            type="button"
            onClick={() => handleSendMsg("☕ 차근차근 꾸준히 하는 습관이 최고의 무기란다! 끝까지 화이팅!")}
            style={{ background: '#fff', border: '1px solid #aed581', borderRadius: '12px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#33691e' }}
          >
            ☕ 끝까지 화이팅!
          </button>
          <button
            type="button"
            onClick={() => handleSendMsg("💯 대단하다! 차근차근 목표를 향해 나아가자!")}
            style={{ background: '#fff', border: '1px solid #aed581', borderRadius: '12px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#33691e' }}
          >
            💯 정말 대견해!
          </button>
        </div>
      )}

      <div style={{ padding: '8px', borderTop: '1px solid #c5e1a5', background: '#fff', borderRadius: '0 0 10px 10px', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSendMsg();
            }
          }}
          placeholder="메시지를 입력하세요..."
          style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '12px', outline: 'none' }}
        />
        <button
          type="button"
          onClick={() => handleSendMsg()}
          style={{ background: '#33691e', color: '#fff', border: 'none', padding: '0 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
        >
          전송
        </button>
      </div>
    </div>
  );
}
