/**
 * templates/saas-template/frontend/js/smart_ingest.js
 * MQnet 표준 스마트 인제스트 (Universal Smart Ingest & Camera Scan) 공통 프론트엔드 모듈.
 * 
 * 기능:
 * 1. 은행/알림 문자, 구글시트 URL, 로컬 파일경로 자동 판별
 * 2. 클립보드 사진(Ctrl+V) 자동 가로채기 및 썸네일 미리보기
 * 3. 스마트폰 후면 카메라 직촬영(capture="environment") 및 갤러리 파일 선택
 * 4. 올인원 단일 엔드포인트(/api/smart/universal-ingest) 연동
 */

let currentPasteImageBase64 = null;
let currentCameraBase64 = null;
let onIngestSuccessCallback = null;

export function initSmartIngest(options = {}) {
  if (options.onSuccess) {
    onIngestSuccessCallback = options.onSuccess;
  }
}

// ── 만능 붙여넣기 모달 열기/닫기 ──
export function openUniversalPasteModal() {
  const modal = document.getElementById("universalPasteModal");
  if (modal) modal.style.display = "flex";
  const txt = document.getElementById("universalPasteText");
  if (txt) {
    txt.focus();
    previewUniversalPaste();
  }
}

export function closeUniversalPasteModal() {
  const modal = document.getElementById("universalPasteModal");
  if (modal) modal.style.display = "none";
}

// ── 카메라/스캔 모달 열기/닫기 ──
export function openCameraScanModal() {
  const modal = document.getElementById("cameraScanModal");
  if (modal) modal.style.display = "flex";
}

export function closeCameraScanModal() {
  const modal = document.getElementById("cameraScanModal");
  if (modal) modal.style.display = "none";
}

// ── 클립보드 사진 붙여넣기(Ctrl+V) 가로채기 ──
export function handleClipboardPaste(e) {
  const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") !== -1) {
      e.preventDefault();
      const file = items[i].getAsFile();
      const reader = new FileReader();
      reader.onload = function(evt) {
        currentPasteImageBase64 = evt.target.result;
        const section = document.getElementById("universalPasteImageSection");
        const preview = document.getElementById("universalPasteImgPreview");
        if (section) section.style.display = "block";
        if (preview) preview.src = currentPasteImageBase64;
        previewUniversalPaste();
      };
      reader.readAsDataURL(file);
      break;
    }
  }
}

export function clearPasteImage() {
  currentPasteImageBase64 = null;
  const section = document.getElementById("universalPasteImageSection");
  const preview = document.getElementById("universalPasteImgPreview");
  if (section) section.style.display = "none";
  if (preview) preview.src = "";
  previewUniversalPaste();
}

// ── 실시간 입력 감지 프리뷰 ──
export function previewUniversalPaste() {
  const txt = (document.getElementById("universalPasteText")?.value || "").trim();
  const previewBox = document.getElementById("universalPastePreviewBox");
  const badge = document.getElementById("universalPasteBadge");
  const body = document.getElementById("universalPasteBody");
  const btn = document.getElementById("universalSubmitBtn");

  if (!txt && !currentPasteImageBase64) {
    if (previewBox) previewBox.style.display = "none";
    if (btn) {
      btn.innerHTML = "⚡ 스마트 자동 실행";
      btn.className = "btn btn-primary";
    }
    return;
  }

  if (previewBox) previewBox.style.display = "block";

  // 1. 클립보드 사진
  if (currentPasteImageBase64) {
    if (badge) {
      badge.innerHTML = "📷 붙여넣은 사진 (클립보드 감지)";
      badge.style.background = "#8b5cf6";
      badge.style.color = "#fff";
    }
    if (body) {
      body.innerHTML = "클립보드에서 사진을 성공적으로 감지했습니다.<br>실행 시 Gemini Vision AI가 문서를 스캔하여 자동 입력합니다.";
    }
    if (btn) {
      btn.innerHTML = "⚡ 사진 AI 분석 및 자동 등록";
      btn.className = "btn btn-ai";
    }
    return;
  }

  // 2. 구글 스프레드시트 링크
  if (txt.includes("docs.google.com/spreadsheets")) {
    if (badge) {
      badge.innerHTML = "📊 구글 스프레드시트 링크 감지됨";
      badge.style.background = "#10b981";
      badge.style.color = "#fff";
    }
    if (body) {
      body.innerHTML = "<b>구글 클라우드 장부 링크</b>입니다.<br>실행 시 클라우드 장부 데이터가 시스템에 실시간 동기화됩니다.";
    }
    if (btn) {
      btn.innerHTML = "🔄 장부 실시간 동기화 실행";
      btn.className = "btn btn-primary";
    }
    return;
  }

  // 3. 로컬 파일 경로 감지
  const cleanPath = txt.replace(/["';]/g, "").trim();
  const lower = cleanPath.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv") || lower.endsWith(".tsv")) {
    const fname = cleanPath.split(/[\\/]/).pop();
    if (badge) {
      badge.innerHTML = "📁 엑셀 / CSV 장부 파일 경로 감지됨";
      badge.style.background = "#0d9488";
      badge.style.color = "#fff";
    }
    if (body) {
      body.innerHTML = `로컬 파일: <b>${fname}</b><br>경로: <code>${cleanPath}</code>`;
    }
    if (btn) {
      btn.innerHTML = "📋 데이터 파일 동기화 실행";
      btn.className = "btn btn-primary";
    }
    return;
  } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp") || lower.endsWith(".pdf")) {
    const fname = cleanPath.split(/[\\/]/).pop();
    if (badge) {
      badge.innerHTML = "🖼️ 사진/문서 파일 경로 감지됨";
      badge.style.background = "#8b5cf6";
      badge.style.color = "#fff";
    }
    if (body) {
      body.innerHTML = `로컬 사진: <b>${fname}</b><br>경로: <code>${cleanPath}</code>`;
    }
    if (btn) {
      btn.innerHTML = "🔍 사진 파일 AI OCR 분석";
      btn.className = "btn btn-ai";
    }
    return;
  }

  // 4. 알림 문자 / 메신저 텍스트
  const moneyM = txt.match(/(\d{1,3}(?:,\d{3})+|\d{4,9})\s*원?/);
  if (moneyM || /입금|결제|승인|이체|주문|출결/.test(txt)) {
    const amt = moneyM ? moneyM[0] : "자동 파싱";
    if (badge) {
      badge.innerHTML = "💬 알림 문자 / 메시지 감지됨";
      badge.style.background = "#3b82f6";
      badge.style.color = "#fff";
    }
    if (body) {
      body.innerHTML = `추출 금액: <b>${amt}</b><br>문자/카톡 내용을 분석하여 관련 데이터로 스마트 적재합니다.`;
    }
    if (btn) {
      btn.innerHTML = "💳 스마트 수납/반영 실행";
      btn.className = "btn btn-primary";
    }
    return;
  }

  // 5. 일반 텍스트
  if (badge) {
    badge.innerHTML = "📝 일반 텍스트 입력";
    badge.style.background = "#64748b";
    badge.style.color = "#fff";
  }
  if (body) {
    body.innerHTML = "텍스트를 분석하여 적절한 처리 방식을 안내합니다.";
  }
  if (btn) {
    btn.innerHTML = "⚡ 스마트 자동 실행";
    btn.className = "btn btn-primary";
  }
}

// ── 만능 붙여넣기 서버 제출 ──
export async function submitUniversalIngest(apiBase = "/api") {
  const txt = (document.getElementById("universalPasteText")?.value || "").trim();
  const img = currentPasteImageBase64;
  const branchSelect = document.getElementById("branchSelector");
  const branchId = branchSelect ? branchSelect.value : "main";

  if (!txt && !img) {
    alert("붙여넣을 텍스트 또는 사진(Ctrl+V)을 입력해 주세요.");
    return;
  }

  const btn = document.getElementById("universalSubmitBtn");
  const origText = btn ? btn.innerHTML : "실행";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "스마트 분석 및 처리 중... ⏳";
  }

  try {
    const res = await fetch(`${apiBase}/smart/universal-ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: txt,
        image_base64: img,
        branch_id: branchId
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.message || "처리 실패");

    alert(data.message || "스마트 인제스트 처리가 완료되었습니다.");
    closeUniversalPasteModal();
    if (document.getElementById("universalPasteText")) {
      document.getElementById("universalPasteText").value = "";
    }
    clearPasteImage();

    if (onIngestSuccessCallback) {
      onIngestSuccessCallback(data);
    }
  } catch (err) {
    console.error("Smart Ingest Error:", err);
    alert(`오류 발생: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }
}

// ── 카메라/갤러리 사진 선택 이벤트 ──
export function previewCameraImage(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const fnEl = document.getElementById("cameraFileName");
  if (fnEl) {
    fnEl.textContent = `✅ 선택된 사진: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    fnEl.style.color = "#10b981";
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    currentCameraBase64 = e.target.result;
    const preview = document.getElementById("cameraImgPreview");
    const previewBox = document.getElementById("cameraPreviewBox");
    if (preview) preview.src = currentCameraBase64;
    if (previewBox) previewBox.style.display = "block";
  };
  reader.readAsDataURL(file);
}

// ── 카메라 사진 AI OCR 전송 ──
export async function submitCameraScan(apiBase = "/api") {
  if (!currentCameraBase64) {
    alert("촬영하거나 업로드할 사진을 선택하세요.");
    return;
  }

  const btn = document.getElementById("cameraScanSubmitBtn");
  const origText = btn ? btn.innerHTML : "스캔";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "AI Vision 분석 중... ⏳";
  }

  try {
    const res = await fetch(`${apiBase}/smart/camera-ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_base64: currentCameraBase64
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.message || "분석 실패");

    alert(data.message || "카메라 사진 AI OCR 분석이 완료되었습니다.");
    closeCameraScanModal();
    if (onIngestSuccessCallback) {
      onIngestSuccessCallback(data);
    }
  } catch (err) {
    console.error("Camera OCR Error:", err);
    alert(`카메라 스캔 오류: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }
}
