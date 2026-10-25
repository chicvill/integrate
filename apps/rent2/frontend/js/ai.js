/**
 * MQnet 임차관리 rent2 - AI 비서 & 음성 인식 모듈 (ai.js)
 * - Web Speech API 기반 음성 마이크 질문
 * - LLM AI 대화 및 자동 도구 실행 (FastAPI /ai/chat)
 */

let aiSpeechRecognition = null;
let isVoiceListening = false;

// 모달 내부 전용 실시간 음성 상태 배너 업데이트 헬퍼
function setPasteVoiceStatus(htmlMsg, type = "info") {
  const el = document.getElementById("pasteVoiceStatus");
  if (!el) {
    if (typeof setAlert === "function") setAlert(htmlMsg.replace(/<[^>]+>/g, ""), type);
    return;
  }
  if (!htmlMsg) {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }

  el.style.display = "block";
  if (type === "listening") {
    el.style.border = "1.5px solid #ef4444";
    el.style.background = "#fef2f2";
    el.style.color = "#991b1b";
  } else if (type === "success") {
    el.style.border = "1.5px solid #16a34a";
    el.style.background = "#f0fdf4";
    el.style.color = "#166534";
  } else if (type === "warning" || type === "error") {
    el.style.border = "1.5px solid #ea580c";
    el.style.background = "#fff7ed";
    el.style.color = "#9a3412";
  } else {
    el.style.border = "1.5px solid #2563eb";
    el.style.background = "#eff6ff";
    el.style.color = "#1e40af";
  }
  el.innerHTML = htmlMsg;
}

function toggleVoiceAI(targetId = "pasteText", btnId = "btnMicPaste") {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = document.getElementById(btnId);
  const input = document.getElementById(targetId);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isHttpInsecure = location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1";

  // 비보안 HTTP 환경에서는 HTTPS 도메인 연결 링크 안내
  if (isHttpInsecure) {
    const secureDomain = (location.hostname === "34.31.10.12" || location.hostname === "localhost") ? "34.31.10.12.nip.io" : location.hostname;
    const httpsUrl = `https://${secureDomain}${location.pathname}${location.search}`;
    if (input) input.focus();
    setPasteVoiceStatus(
      `🔒 <b>브라우저 마이크는 HTTPS 보안 연결이 필요합니다.</b><br>` +
      `<a href="${httpsUrl}" style="display:inline-block;margin-top:4px;padding:4px 10px;background:#2563eb;color:#fff;border-radius:4px;text-decoration:none;font-weight:700;">👉 🔒 HTTPS 보안 연결로 이동 (마이크 100% 활성화)</a><br>` +
      `<small style="color:#64748b;margin-top:3px;display:inline-block;">* 현재 페이지에서는 자판(키보드) 스페이스바 옆의 🎙️ 마이크를 누르셔도 바로 음성 입력됩니다.</small>`,
      "warning"
    );
    if (!SpeechRecognition) return;
  }

  // 브라우저 자체가 SpeechRecognition을 미지원하는 경우 키보드 마이크 안내
  if (!SpeechRecognition) {
    if (input) input.focus();
    setPasteVoiceStatus(
      `🎙️ <b>스마트폰 자판(키보드)의 마이크 버튼(🎙️)을 누르고 말씀하세요!</b><br>` +
      `<small style="color:#475569;">현재 브라우저는 웹 음성 API를 지원하지 않으나, <b>자판(키보드) 스페이스바 옆의 🎙️ 마이크</b>를 누르시면 100% 즉시 텍스트로 입력됩니다.</small>`,
      "warning"
    );
    return;
  }

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
    aiSpeechRecognition.continuous = true; // 중간 끊김 방지
    aiSpeechRecognition.maxAlternatives = 1;

    const baseText = input ? input.value : "";
    const origPlaceholder = input ? input.placeholder : "";

    aiSpeechRecognition.onstart = function() {
      isVoiceListening = true;
      if (btn) {
        btn.classList.add("mic-active");
        btn.innerHTML = "🔴 듣는 중...";
        btn.style.background = "#fee2e2";
        btn.style.borderColor = "#ef4444";
        btn.style.color = "#b91c1c";
        btn.title = "음성 입력 완료하려면 클릭";
      }
      if (input) {
        input.placeholder = "음성을 듣고 있습니다... 편하게 말씀해 주세요 🎙️";
        input.focus();
      }
      setPasteVoiceStatus(
        `🔴 <b>음성을 듣고 있습니다...</b> 말씀해 주세요 🎙️<br><small style="font-weight:normal;color:#475569;">말씀을 마치시면 [🔴 듣는 중]을 다시 누르세요. (스마트폰 키보드의 🎙️도 바로 입력됩니다)</small>`,
        "listening"
      );
    };

    aiSpeechRecognition.onresult = function(event) {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      const spoken = (finalTranscript + interimTranscript).trim();
      if (input && spoken) {
        input.value = (baseText ? baseText.trim() + " " : "") + spoken;
        // input 이벤트 강제 발화로 실시간 분석/미리보기 즉각 동기화
        input.dispatchEvent(new Event("input", { bubbles: true }));
        if (typeof previewUniversalPaste === "function") {
          previewUniversalPaste();
        }
      }

      if (spoken) {
        setPasteVoiceStatus(
          `💬 <b>인식 중:</b> "${spoken}"`,
          "listening"
        );
      }
    };

    aiSpeechRecognition.onerror = function(event) {
      console.warn("음성인식 오류:", event.error);
      if (input) input.focus();
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setPasteVoiceStatus(
          `⚠️ <b>브라우저 마이크 보안(HTTP) 차단됨</b><br>👉 <b>입력창 터치 후 스마트폰 자판(키보드)의 마이크 버튼(🎙️)</b>을 누르시면 100% 즉시 입력됩니다!`,
          "warning"
        );
      } else if (event.error === "no-speech") {
        setPasteVoiceStatus(
          `⚠️ 음성이 감지되지 않았습니다. 다시 말씀하시거나 <b>스마트폰 키보드의 마이크(🎙️)</b>를 이용해 보세요.`,
          "warning"
        );
      } else {
        setPasteVoiceStatus(`⚠️ 음성 알림: ${event.error}<br>👉 <b>스마트폰 자판(키보드)의 마이크(🎙️)</b>로 직접 말씀하셔도 바로 입력됩니다.`, "warning");
      }
    };

    aiSpeechRecognition.onend = function() {
      isVoiceListening = false;
      if (btn) {
        btn.classList.remove("mic-active");
        btn.innerHTML = "🎙️ 음성";
        btn.style.background = "#ffffff";
        btn.style.borderColor = "#2563eb";
        btn.style.color = "#1d4ed8";
        btn.title = "마이크 음성 입력 🎙️";
      }
      if (input) {
        input.placeholder = origPlaceholder;
        input.focus();
        const finalVal = input.value.trim();
        if (finalVal) {
          setPasteVoiceStatus(
            `✅ <b>음성 입력 완료:</b> "${finalVal}"<br><small style="font-weight:normal;color:#475569;">내용 수정 후 아래 <b>[확인]</b>을 누르세요.</small>`,
            "success"
          );
          if (typeof previewUniversalPaste === "function") {
            previewUniversalPaste();
          }
        }
      }
    };

    aiSpeechRecognition.start();
  } catch (err) {
    console.error("음성인식 시작 실패:", err);
    isVoiceListening = false;
    if (btn) {
      btn.classList.remove("mic-active");
      btn.innerHTML = "🎙️ 음성";
      btn.style.background = "#ffffff";
      btn.style.borderColor = "#2563eb";
      btn.style.color = "#1d4ed8";
    }
    if (input) input.focus();
    setPasteVoiceStatus(
      `👉 <b>입력창을 터치한 후 스마트폰 자판(키보드)의 마이크(🎙️)</b>를 누르시면 100% 즉시 음성 입력됩니다!`,
      "warning"
    );
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
