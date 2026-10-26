import { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function useChatEvaluation(sessionId: string, toggleTask: (weekNum: number, taskIdx: number, forceCompleted?: boolean) => void, setAchievementRates: React.Dispatch<React.SetStateAction<Record<string, number>>>) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: "안녕하세요! 오늘의 진도 점검을 도와드릴 AI입니다.\n위 리스트에서 [🎙️ 평가받기] 버튼을 눌러 평가를 시작해보세요."
  }]);
  const [inputMsg, setInputMsg] = useState("");
  const [evaluatingTaskInfo, setEvaluatingTaskInfo] = useState<{week_number: number, task_index: number, task_title: string} | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startEvaluation = useCallback((week_number: number, task_index: number, task: any) => {
    setEvaluatingTaskInfo({ week_number, task_index, task_title: task.task_title });
    setMessages([{ role: 'assistant', content: `[메타인지 평가 모드]\n'${task.task_title}' 단원의 학습을 마치셨군요! 가장 중요하게 배운 핵심 개념 한 가지를 동생에게 설명하듯 이야기해주세요.` }]);
  }, []);

  const handleSendEvaluation = useCallback(async () => {
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
  }, [inputMsg, evaluatingTaskInfo, sessionId, toggleTask, setAchievementRates]);

  const startRecording = useCallback(() => {
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
  }, []);

  return {
    messages,
    inputMsg,
    setInputMsg,
    evaluatingTaskInfo,
    loadingChat,
    isRecording,
    chatEndRef,
    startEvaluation,
    handleSendEvaluation,
    startRecording
  };
}
