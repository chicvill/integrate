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
      const allMicBtns = [document.getElementById(btnId), document.getElementById("btnOmniMic"), document.getElementById("btnMicPaste")].filter(Boolean);
      allMicBtns.forEach(b => {
        b.classList.add("mic-active");
        if (b.id === "btnOmniMic") {
          b.innerHTML = "🔴";
          b.title = "음성 입력 중 (마치려면 클릭)";
        } else {
          b.innerHTML = "🔴 듣는 중...";
          b.style.background = "#fee2e2";
          b.style.borderColor = "#ef4444";
          b.style.color = "#b91c1c";
        }
      });
      if (input) {
        input.placeholder = "음성을 듣고 있습니다... 편하게 말씀해 주세요 🎙️";
        input.focus();
      }
      setPasteVoiceStatus(
        `🔴 <b>음성을 듣고 있습니다...</b> 말씀해 주세요 🎙️<br><small style="font-weight:normal;color:#475569;">말씀을 마치시면 [🔴 마이크]를 다시 누르세요.</small>`,
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
        input.dispatchEvent(new Event("input", { bubbles: true }));
        if (typeof autoExpandTextarea === "function") autoExpandTextarea(input);
        if (typeof previewUniversalPaste === "function") previewUniversalPaste();
        if (typeof updateOmniSendBtn === "function") updateOmniSendBtn();
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
      const allMicBtns = [document.getElementById(btnId), document.getElementById("btnOmniMic"), document.getElementById("btnMicPaste")].filter(Boolean);
      allMicBtns.forEach(b => {
        b.classList.remove("mic-active");
        if (b.id === "btnOmniMic") {
          b.innerHTML = "🎙️";
          b.title = "마이크 음성 입력 🎙️";
        } else {
          b.innerHTML = "🎙️ 음성";
          b.style.background = "#ffffff";
          b.style.borderColor = "#2563eb";
          b.style.color = "#1d4ed8";
        }
      });
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

function formatAiReply(text) {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\n/g, "<br>");
  return html;
}
