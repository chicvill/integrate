/**
 * MQnet 임차관리 rent2 - AI 비서 & 음성 인식 모듈 (ai.js)
 * - Web Speech API 기반 음성 마이크 질문
 * - LLM AI 대화 및 자동 도구 실행 (FastAPI /ai/chat)
 */

let aiSpeechRecognition = null;
let isVoiceListening = false;

function toggleVoiceAI(targetId = "aiInput", btnId = "btnMicAI") {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setAlert("현재 브라우저는 음성 인식을 지원하지 않습니다. Chrome, Edge 또는 Safari 최신 버전을 권장합니다.", "warning");
    return;
  }

  const btn = document.getElementById(btnId);
  const input = document.getElementById(targetId);

  if (isVoiceListening) {
    if (aiSpeechRecognition) {
      try { aiSpeechRecognition.stop(); } catch (e) {}
    }
    return;
  }

  try {
    aiSpeechRecognition = new SpeechRecognition();
    aiSpeechRecognition.lang = "ko-KR";
    aiSpeechRecognition.interimResults = true;
    aiSpeechRecognition.continuous = false;

    const origPlaceholder = input ? input.placeholder : "";

    aiSpeechRecognition.onstart = function() {
      isVoiceListening = true;
      if (btn) {
        btn.classList.add("mic-active");
        btn.innerHTML = "🔴 듣는 중...";
        btn.title = "음성 입력 중지하려면 클릭";
      }
      if (input) {
        input.placeholder = "음성을 듣고 있습니다... 말씀해 주세요 🎙️";
      }
    };

    aiSpeechRecognition.onresult = function(event) {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        text += event.results[i][0].transcript;
      }
      if (input && text) {
        input.value = text;
      }
    };

    aiSpeechRecognition.onerror = function(event) {
      console.warn("음성인식 오류:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setAlert("마이크 권한이 차단되어 있습니다. 브라우저 주소창에서 마이크 권한을 허용해주세요.", "error");
      } else if (event.error !== "no-speech") {
        setAlert(`음성 인식 오류: ${event.error}`, "warning");
      }
    };

    aiSpeechRecognition.onend = function() {
      isVoiceListening = false;
      if (btn) {
        btn.classList.remove("mic-active");
        btn.innerHTML = "🎙️";
        btn.title = "음성으로 질문하기";
      }
      if (input) {
        input.placeholder = origPlaceholder;
        input.focus();
      }
    };

    aiSpeechRecognition.start();
  } catch (err) {
    console.error("음성인식 시작 실패:", err);
    isVoiceListening = false;
    if (btn) {
      btn.classList.remove("mic-active");
      btn.innerHTML = "🎙️";
    }
    setAlert("음성 인식을 시작할 수 없습니다.", "error");
  }
}

async function sendAI() {
  const inp = document.getElementById("aiInput");
  const q = inp ? inp.value.trim() : "";
  if (!q) return;
  const out = document.getElementById("aiResponse");
  if (out) out.textContent = "AI 분석 및 도구 호출 중... ⏳";
  try {
    const res = await apiFetch(`${API_BASE}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: q, building: curBranch, mode: "auto" })
    });
    if (!res.ok) return;
    const data = await res.json();
    if (out) out.textContent = data.reply || JSON.stringify(data, null, 2);
    // 쓰기 도구(수정, 납부, 퇴실 등)가 실행되었으면 호실 카드 즉시 자동 동기화
    if (data.reply && (data.reply.includes("완료") || data.reply.includes("수정") || data.reply.includes("납부") || data.reply.includes("등록"))) {
      if (typeof reloadRooms === "function") reloadRooms();
    }
  } catch (err) {
    if (out) out.textContent = "질의 응답 실패 (서버 연결 확인)";
  }
}
