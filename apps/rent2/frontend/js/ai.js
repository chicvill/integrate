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
    if (data.reply && (data.reply.includes("완료") || data.reply.includes("수정") || data.reply.includes("납부") || data.reply.includes("등록"))) {
      if (typeof reloadRooms === "function") reloadRooms();
    }
  } catch (err) {
    if (out) out.textContent = "질의 응답 실패 (서버 연결 확인)";
  }
}

// ── 📱 스마트폰 최적화 모바일 AI 비서 컨트롤러 ──

function openAIAssistant() {
  // 상단 브리핑 카드 및 탭 메뉴를 숨겨 스마트폰 화면 공간을 최대로 확보
  const stats = document.querySelector(".stats-grid");
  const navTabs = document.querySelector(".nav-tabs");
  if (stats) stats.style.display = "none";
  if (navTabs) navTabs.style.display = "none";

  // 지점명 배지 동기화 (예: "시크빌 1호점 (본점)" -> "시크빌")
  const branchSel = document.getElementById("branchSelect");
  const badge = document.getElementById("aiBranchBadge");
  if (badge && branchSel && branchSel.selectedIndex >= 0) {
    const rawText = branchSel.options[branchSel.selectedIndex].text || "";
    const shortName = rawText.split(" ")[0].replace(/[0-9호점\(\),]/g, "").trim() || "시크빌";
    badge.textContent = shortName;
  }

  // AI 섹션 활성화
  setTab("ai");

  // 모바일 입력창 포커스 및 스크롤
  setTimeout(() => {
    const inp = document.getElementById("aiInputMobile");
    if (inp) {
      inp.focus();
    }
    scrollAIChatToBottom();
  }, 100);
}

function closeAIAssistant() {
  // 브리핑 카드와 탭 복구
  const stats = document.querySelector(".stats-grid");
  const navTabs = document.querySelector(".nav-tabs");
  if (stats) stats.style.display = "grid";
  if (navTabs) navTabs.style.display = "flex";

  // 호실 관제 탭으로 복귀
  setTab("rooms");
}

function scrollAIChatToBottom() {
  const box = document.getElementById("aiChatBox");
  if (box) {
    box.scrollTop = box.scrollHeight;
  }
}

function askQuickPrompt(text) {
  const inp = document.getElementById("aiInputMobile");
  if (inp) {
    inp.value = text;
  }
  submitMobileAI();
}

function handleAiInputKey(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submitMobileAI();
  }
}

function clearAIChat() {
  const box = document.getElementById("aiChatBox");
  if (!box) return;
  box.innerHTML = `
    <div class="ai-bubble ai-msg" style="align-self:flex-start;max-width:90%;background:#ffffff;border:1px solid #cbd5e1;padding:10px 12px;border-radius:8px 8px 8px 2px;box-shadow:0 1px 2px rgba(0,0,0,0.05);font-size:13px;line-height:1.5;color:#0f172a;">
      <div style="font-weight:800;margin-bottom:4px;color:#2563eb;display:flex;align-items:center;gap:4px;">
        <span>🤖 RENT2 AI 현장 비서</span>
      </div>
      대화가 초기화되었습니다. 🎙️<br>
      상단의 <b>[⚡ 퀵 버튼]</b>을 누르시거나 궁금하신 내용을 자유롭게 말씀해 주세요!
    </div>
  `;
}

function formatAiReply(text) {
  if (!text) return "";
  // 간이 마크다운 포맷팅 (개행, 굵은 글씨, 코드)
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // **볼드**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  
  // 개행
  html = html.replace(/\n/g, "<br>");

  return html;
}

async function submitMobileAI() {
  const inp = document.getElementById("aiInputMobile");
  const sendBtn = document.getElementById("btnAiSend");
  const chatBox = document.getElementById("aiChatBox");
  if (!inp || !chatBox) return;

  const query = inp.value.trim();
  if (!query) return;

  // 1. 사용자 질문 말풍선 렌더링
  const userDiv = document.createElement("div");
  userDiv.className = "ai-bubble user-msg";
  userDiv.textContent = query;
  chatBox.appendChild(userDiv);

  // 입력창 초기화 및 스크롤
  inp.value = "";
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = "분석중...";
  }

  // 2. AI 로딩 말풍선 렌더링
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "ai-bubble ai-msg";
  loadingDiv.id = "aiLoadingMsg";
  loadingDiv.innerHTML = `<span style="color:#64748b;">AI 비서가 실시간 장부를 분석 중입니다... ⏳</span>`;
  chatBox.appendChild(loadingDiv);
  scrollAIChatToBottom();

  try {
    const res = await apiFetch(`${API_BASE}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: query, building: curBranch, mode: "auto" })
    });

    const aiMsgEl = document.getElementById("aiLoadingMsg");
    if (!res.ok) {
      if (aiMsgEl) {
        aiMsgEl.removeAttribute("id");
        aiMsgEl.innerHTML = `<span style="color:#dc2626;font-weight:700;">⚠️ 오류: 서버와의 통신에 실패했습니다. (HTTP ${res.status})</span>`;
      }
      return;
    }

    const data = await res.json();
    const replyText = data.reply || (typeof data === "string" ? data : JSON.stringify(data, null, 2));

    if (aiMsgEl) {
      aiMsgEl.removeAttribute("id");
      aiMsgEl.innerHTML = formatAiReply(replyText);
    }

    // 변경 작업 실행 시 호실 카드 실시간 갱신
    if (replyText && (replyText.includes("완료") || replyText.includes("수정") || replyText.includes("납부") || replyText.includes("등록"))) {
      if (typeof reloadRooms === "function") {
        reloadRooms();
      }
    }
  } catch (err) {
    console.error("모바일 AI 질의 실패:", err);
    const aiMsgEl = document.getElementById("aiLoadingMsg");
    if (aiMsgEl) {
      aiMsgEl.removeAttribute("id");
      aiMsgEl.innerHTML = `<span style="color:#dc2626;">⚠️ 서버 연결 오류: AI 비서 응답을 불러올 수 없습니다.</span>`;
    }
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = "전송";
    }
    scrollAIChatToBottom();
  }
}
