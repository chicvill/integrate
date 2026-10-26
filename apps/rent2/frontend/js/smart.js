/**
 * apps/rent2/frontend/js/smart.js
 * 만능 스마트 붙여넣기(은행문자, 구글시트, 파일경로, Ctrl+V 사진),
 * 카메라 촬영/영수증 OCR 스캔, 구글 스프레드시트 2025/2026 실시간 동기화.
 */

let currentPasteImageBase64 = "";
let currentPasteFileName = "";

// ── 만능 스마트 프롬프트 바 (Omni-Input Bar) 핸들러 ──
function autoExpandTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(Math.max(el.scrollHeight, 52), 160) + "px";
  updateOmniSendBtn();
}

function updateOmniSendBtn() {
  const txt = (document.getElementById("pasteText")?.value || "").trim();
  const hasContent = Boolean(txt || currentPasteImageBase64);
  const sendBtn = document.getElementById("btnOmniSend");
  if (sendBtn) {
    sendBtn.disabled = !hasContent;
    sendBtn.style.opacity = hasContent ? "1" : "0.45";
  }
  const univBtn = document.getElementById("btnUniversalSubmit");
  if (univBtn) {
    univBtn.disabled = !hasContent;
  }
}

function toggleOmniAttachMenu(show) {
  const menu = document.getElementById("omniAttachMenu");
  if (!menu) return;
  const isShown = menu.style.display === "flex";
  menu.style.display = (show !== undefined ? show : !isShown) ? "flex" : "none";
}

function triggerAttachAction(type) {
  toggleOmniAttachMenu(false);
  if (type === "camera") {
    document.getElementById("pasteFileCamera")?.click();
  } else if (type === "gallery") {
    document.getElementById("pasteFileGallery")?.click();
  } else if (type === "excel") {
    document.getElementById("pasteFileExcel")?.click();
  }
}

function handleScanKindChange(val) {
  document.querySelectorAll("input[name='pasteScanKind']").forEach(r => {
    r.checked = (r.value === val);
  });
  document.querySelectorAll(".omni-kind-tag").forEach(tag => {
    const radio = tag.querySelector("input[type='radio']");
    if (radio && radio.value === val) {
      tag.classList.add("active");
    } else {
      tag.classList.remove("active");
    }
  });
  previewUniversalPaste();
}

function renderOmniAttachmentChip(fileName, dataUrl) {
  currentPasteFileName = fileName || "첨부 이미지";
  const chipContainer = document.getElementById("omniAttachmentChip");
  const thumb = document.getElementById("omniThumbImg");
  const label = document.getElementById("omniFileName");
  if (chipContainer && thumb && label) {
    thumb.src = dataUrl;
    label.textContent = currentPasteFileName;
    chipContainer.style.display = "inline-flex";
  }
  const legacyImg = document.getElementById("pasteImgPreview");
  if (legacyImg) legacyImg.src = dataUrl;
  const legacySec = document.getElementById("pasteImageSection");
  if (legacySec) legacySec.style.display = "none";
  updateOmniSendBtn();
}

function handleDragOver(event) {
  event.preventDefault();
  document.getElementById("omniPromptContainer")?.classList.add("drag-over");
}

function handleDragLeave(event) {
  event.preventDefault();
  document.getElementById("omniPromptContainer")?.classList.remove("drag-over");
}

function handleDropFile(event) {
  event.preventDefault();
  document.getElementById("omniPromptContainer")?.classList.remove("drag-over");
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;
  processIncomingFile(files[0]);
}

function processIncomingFile(file) {
  if (!file) return;
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/") || name.endsWith(".jpg") || name.endsWith(".png") || name.endsWith(".jpeg") || name.endsWith(".webp")) {
    const reader = new FileReader();
    reader.onload = function(e) {
      currentPasteImageBase64 = e.target.result;
      renderOmniAttachmentChip(file.name, currentPasteImageBase64);
      previewUniversalPaste();
    };
    reader.readAsDataURL(file);
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv") || name.endsWith(".tsv")) {
    const txtEl = document.getElementById("pasteText");
    if (txtEl) {
      txtEl.value = `[로컬 장부 파일 선택됨: ${file.name}]`;
      autoExpandTextarea(txtEl);
      previewUniversalPaste();
    }
  }
}

// 클립보드 붙여넣기 이벤트 가로채기 (이미지 파일 즉시 감지)
function handleClipboardPaste(event) {
  const items = (event.clipboardData || (event.originalEvent && event.originalEvent.clipboardData))?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") !== -1) {
      const blob = items[i].getAsFile();
      if (!blob) continue;
      const reader = new FileReader();
      reader.onload = function(e) {
        currentPasteImageBase64 = e.target.result;
        renderOmniAttachmentChip("클립보드 캡처 이미지", currentPasteImageBase64);
        previewUniversalPaste();
      };
      reader.readAsDataURL(blob);
      event.preventDefault(); // 기본 텍스트 삽입 방지
      return;
    }
  }
  setTimeout(() => {
    const pt = document.getElementById("pasteText");
    if (pt) autoExpandTextarea(pt);
    previewUniversalPaste();
  }, 50);
}

function clearPasteImage() {
  currentPasteImageBase64 = "";
  currentPasteFileName = "";
  const chipContainer = document.getElementById("omniAttachmentChip");
  if (chipContainer) chipContainer.style.display = "none";
  const secEl = document.getElementById("pasteImageSection");
  if (secEl) secEl.style.display = "none";
  const fc = document.getElementById("pasteFileCamera");
  if (fc) fc.value = "";
  const fg = document.getElementById("pasteFileGallery");
  if (fg) fg.value = "";
  const fe = document.getElementById("pasteFileExcel");
  if (fe) fe.value = "";
  previewUniversalPaste();
  updateOmniSendBtn();
}

function getSelectedPasteScanKind() {
  const r = document.querySelector("input[name='pasteScanKind']:checked");
  return r ? r.value : "auto";
}

// 외부 클릭 시 첨부 메뉴 닫기
document.addEventListener("click", function(e) {
  const menu = document.getElementById("omniAttachMenu");
  const btn = document.getElementById("btnOmniAttach");
  if (menu && menu.style.display === "flex" && !menu.contains(e.target) && !btn?.contains(e.target)) {
    menu.style.display = "none";
  }
});

// 만능 입력 실시간 분석 & 미리보기 갱신
function previewUniversalPaste() {
  const txt = (document.getElementById("pasteText")?.value || "").trim();
  const box = document.getElementById("pastePreview");
  const badge = document.getElementById("pastePreviewBadge");
  const body = document.getElementById("pastePreviewBody");
  const btn = document.getElementById("btnUniversalSubmit");

  if (!txt && !currentPasteImageBase64) {
    if (box) box.style.display = "none";
    if (btn) {
      btn.innerHTML = "확인";
      btn.className = "btn-primary";
      btn.style.background = "#2563eb";
    }
    return;
  }

  // 1. 사진 / 이미지 데이터 감지 (스캔 종류별 즉시 버튼 안내)
  if (currentPasteImageBase64 || txt.startsWith("data:image/")) {
    const scanKind = getSelectedPasteScanKind();
    document.querySelectorAll(".omni-kind-tag").forEach(tag => {
      const radio = tag.querySelector("input[type='radio']");
      if (radio && radio.value === scanKind) {
        tag.classList.add("active");
      } else {
        tag.classList.remove("active");
      }
    });
    updateOmniSendBtn();
    const helpEl = document.getElementById("pasteScanKindHelp");
    if (helpEl) {
      if (scanKind === "bank_sms") {
        helpEl.innerHTML = "💡 스마트폰 입금 알림 문자나 계좌이체 캡처를 올리시면 <b>1초 만에 세입자 호실로 자동 수납</b>됩니다.";
      } else if (scanKind === "contract") {
        helpEl.innerHTML = "💡 호실별 표(장부) 사진을 올리시면 <b>모든 호실의 세입자 정보가 일괄 자동 등록</b>됩니다.";
      } else if (scanKind === "receipt") {
        helpEl.innerHTML = "💡 영수증이나 지출 전표 사진을 올리시면 <b>지출 장부에 자동 등록</b>됩니다.";
      } else {
        helpEl.innerHTML = "💡 AI가 사진을 자동 분석하여 <b>입금 알림, 계약 대장, 영수증 중 최적의 방식으로 자동 등록</b>합니다.";
      }
    }
    if (box) box.style.display = "none";
    if (btn) {
      if (scanKind === "bank_sms") {
        btn.innerHTML = "확인 (⚡ 1초 입금 수납)";
        btn.style.background = "#0f172a";
      } else if (scanKind === "contract") {
        btn.innerHTML = "확인 (계약 대장 등록)";
        btn.style.background = "#1e40af";
      } else if (scanKind === "receipt") {
        btn.innerHTML = "확인 (영수증 전표 등록)";
        btn.style.background = "#2563eb";
      } else {
        btn.innerHTML = "확인 (⚡ AI 스마트 자동 분석)";
        btn.style.background = "#2563eb";
      }
      btn.className = "btn-primary";
    }
    return;
  }

  // 2. 구글 스프레드시트 URL 감지
  if (txt.includes("docs.google.com/spreadsheets")) {
    if (box) box.style.display = "none";
    if (btn) {
      btn.innerHTML = "확인 (시트 동기화)";
      btn.className = "btn-primary";
      btn.style.background = "#16a34a";
    }
    return;
  }

  // 3. 로컬 파일 경로 감지
  const cleanPath = txt.replace(/["';]/g, "").trim();
  const lower = cleanPath.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv") || lower.endsWith(".tsv") ||
      lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp") || lower.endsWith(".pdf")) {
    if (box) box.style.display = "none";
    if (btn) {
      btn.innerHTML = "확인 (파일 반영)";
      btn.className = "btn-primary";
      btn.style.background = "#0d9488";
    }
    return;
  }

  // 4. 은행 입금 문자 / 카카오톡 알림 또는 5. 자연어 AI 질문/지시 판별
  const isQuestionOrInstruction = (
    txt.includes("?") || txt.includes("알려줘") || txt.includes("조회") || txt.includes("요약") ||
    txt.includes("목록") || txt.includes("누구") || txt.includes("확인해") || txt.includes("얼마") ||
    txt.includes("공실") || txt.includes("도와줘") || txt.includes("정리해") || txt.includes("현황") ||
    txt.includes("만기") || txt.includes("장부") || txt.includes("보고서")
  );

  // 계좌번호, 전화번호, 잔액, 시간 마스킹으로 호실/금액 오인식 차단
  let cleanTxt = txt
    .replace(/잔[액고]\s*[:\s]*[\d,]+(?:\s*원)?/g, " ")
    .replace(/\b(?:\d{2,6}[-*]){1,4}[\d*]{2,8}\b/g, " ")
    .replace(/\b\d{2,4}[-*]\d{2,4}[-*]\d{2,6}\b/g, " ")
    .replace(/\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g, " ")
    .replace(/\b\d{10,16}\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, " ");

  let roomNum = null;
  let matchedTenant = "";

  // 1단계: 세입자(송금자) 이름으로 allRooms 매칭
  if (typeof allRooms !== "undefined" && Array.isArray(allRooms)) {
    for (const r of allRooms) {
      if (r.name && r.name.length >= 2 && txt.includes(r.name)) {
        roomNum = r.room_number;
        matchedTenant = r.name;
        break;
      }
    }
  }

  // 2단계: 명시적 'OO호' 탐색
  const explicitRoomM = cleanTxt.match(/\b(\d{3,4})\s*호\b/);
  if (explicitRoomM) {
    const exp = parseInt(explicitRoomM[1], 10);
    if (!roomNum || (typeof allRooms !== "undefined" && allRooms.some(x => x.room_number === exp))) {
      roomNum = exp;
    }
  }

  // 3단계: 세입자명과 '호'가 모두 없는 경우, allRooms에 존재하는 3~4자리 호실 번호 탐색
  if (!roomNum && typeof allRooms !== "undefined" && Array.isArray(allRooms)) {
    for (const r of allRooms) {
      const regex = new RegExp(`\\b${r.room_number}\\b`);
      if (regex.test(cleanTxt)) {
        roomNum = r.room_number;
        break;
      }
    }
  }

  // 금액 추출: 만원 단위 및 원 단위
  let moneyM = cleanTxt.match(/(\d+(?:\.\d+)?)\s*만\s*원?/) ||
               cleanTxt.match(/(\d{1,3}(?:,\d{3})+|\d{4,9})\s*원/) ||
               cleanTxt.match(/(?:입금|수납|보냈습니다)\s*[:\s]*(\d{1,3}(?:,\d{3})+|\d{4,9})/);
  let estAmount = moneyM ? (moneyM[0].includes("만") ? moneyM[0] : `${parseInt((moneyM[1] || moneyM[0]).replace(/[^0-9]/g, ''), 10).toLocaleString()}원`) : null;

  // AI 질문/작업 지시일 때는 중간 감지 과정 박스를 완전히 감추고 깔끔하게 '확인' 버튼만 유지
  if (isQuestionOrInstruction || (!roomNum && !estAmount && !matchedTenant)) {
    if (box) box.style.display = "none";
    if (btn) {
      btn.innerHTML = "확인";
      btn.className = "btn-primary";
      btn.style.background = "#2563eb";
    }
    return;
  }

  // 은행 입금 문자인 경우 금액 폴백 (계약 월세+관리비)
  if (!estAmount && roomNum && typeof allRooms !== "undefined") {
    const found = allRooms.find(r => r.room_number === roomNum);
    if (found) {
      const total = (found.rent || 0) + (found.maintenance || 0);
      if (total > 0) {
        estAmount = `${total.toLocaleString()}원`;
      }
    }
  }

  if (box) box.style.display = "block";
  if (badge) {
    badge.innerHTML = "💬 입금 감지";
    badge.style.background = "#0f172a";
  }
  if (body) {
    const tenantSuffix = matchedTenant ? ` (${matchedTenant})` : "";
    body.innerHTML = `호실: <b>${roomNum ? roomNum + "호" + tenantSuffix : (matchedTenant ? matchedTenant + "님" : "호실 미인식")}</b> | 금액: <b>${estAmount || "계약금액 적용"}</b>`;
  }
  if (btn) {
    btn.innerHTML = "확인 (수납)";
    btn.className = "btn-primary";
    btn.style.background = "#0f172a";
  }
  updateOmniSendBtn();
}

// ── 만능 스마트 모달 제어 헬퍼 ──
function togglePasteHelp() {
  const box = document.getElementById("pasteHelpBox");
  if (!box) return;
  box.style.display = box.style.display === "none" ? "block" : "none";
}

function openAIPasteModal() {
  openModal("modalPaste");
  const resBox = document.getElementById("pasteAiResultBox");
  if (resBox) resBox.style.display = "none";
  const helpBox = document.getElementById("pasteHelpBox");
  if (helpBox) helpBox.style.display = "none";
  if (typeof setPasteVoiceStatus === "function") setPasteVoiceStatus("");

  // 현재 대상 매장명 배지 즉시 갱신
  const sel = document.getElementById("branchSelect");
  const branchName = sel ? (sel.options[sel.selectedIndex]?.text || curBranch) : curBranch;
  const badge = document.getElementById("pasteTargetBranchBadge");
  if (badge) {
    badge.textContent = `📍 ${branchName}`;
  }
  const modelBadge = document.getElementById("omniModelBadge");
  if (modelBadge) {
    modelBadge.innerHTML = `<span>⚡ ${branchName} · 만능 AI</span><span style="font-size:10px;color:#94a3b8;">▾</span>`;
  }

  // 첨부 상태 동기화
  const chipContainer = document.getElementById("omniAttachmentChip");
  if (chipContainer) {
    chipContainer.style.display = currentPasteImageBase64 ? "inline-flex" : "none";
  }

  setTimeout(() => {
    const pt = document.getElementById("pasteText");
    if (pt) {
      autoExpandTextarea(pt);
      pt.focus();
    }
    updateOmniSendBtn();
  }, 80);
}

function pasteQuickQuery(queryText) {
  const pt = document.getElementById("pasteText");
  if (pt) {
    pt.value = queryText;
    // input 이벤트 강제 발화로 실시간 동기화
    pt.dispatchEvent(new Event("input", { bubbles: true }));
    previewUniversalPaste();
    pt.focus();
    // 커서를 텍스트 맨 뒤로 이동시켜 즉시 추가/수정 가능하게 대기
    pt.setSelectionRange(pt.value.length, pt.value.length);
  }
  const resBox = document.getElementById("pasteAiResultBox");
  if (resBox) resBox.style.display = "none";
  if (typeof setPasteVoiceStatus === "function") setPasteVoiceStatus("");
}

function clearPasteArea() {
  const pt = document.getElementById("pasteText");
  if (pt) pt.value = "";
  clearPasteImage();
  const resBox = document.getElementById("pasteAiResultBox");
  if (resBox) resBox.style.display = "none";
  if (typeof setPasteVoiceStatus === "function") setPasteVoiceStatus("");
  previewUniversalPaste();
}

function handlePasteKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submitUniversalIngest();
  }
}

// 만능 인제스트 & AI 비서 질의 통합 실행
async function submitUniversalIngest() {
  const text = (document.getElementById("pasteText")?.value || "").trim();
  const img = currentPasteImageBase64;
  const scanKind = getSelectedPasteScanKind();
  const resBox = document.getElementById("pasteAiResultBox");
  const resContent = document.getElementById("pasteAiResultContent");

  if (!text && !img) {
    setAlert("질문 내용이나 붙여넣을 데이터/사진(Ctrl+V)을 입력해 주세요.", "warning");
    return;
  }

  const isPhoto = Boolean(img || (text && text.startsWith("data:image/")));
  const btn = document.getElementById("btnUniversalSubmit");
  const origText = btn ? (btn.innerHTML.includes("확인") ? btn.innerHTML : "확인") : "확인";
  let photoTimerId = null;
  const startTime = Date.now();

  const omniSendBtn = document.getElementById("btnOmniSend");
  if (omniSendBtn) {
    omniSendBtn.disabled = true;
    omniSendBtn.innerHTML = "⏳";
    omniSendBtn.style.opacity = "0.7";
  }

  if (btn) {
    btn.disabled = true;
    if (isPhoto) {
      btn.innerHTML = "⚡ 초고속 AI 분석 중... (0.1초)";
      photoTimerId = setInterval(() => {
        const sec = ((Date.now() - startTime) / 1000).toFixed(1);
        if (btn && btn.disabled) {
          btn.innerHTML = `⚡ 초고속 AI 분석 중... (${sec}초)`;
        }
      }, 150);
    } else {
      btn.innerHTML = "확인 중... ⏳";
    }
  }

  // 0. 엑셀/구글 시트 장부 동기화 명령 직접 실행 (즉각 DB 반영 및 화면 갱신)
  const isSyncCommand = (
    !img && (
      text.includes("시트 동기화") || text.includes("엑셀 동기화") || text.includes("구글 시트") ||
      text.includes("장부 동기화") || text.includes("시트 연동") || text.includes("장부 반영") ||
      text === "동기화" || text === "시트동기화" || text === "엑셀동기화" || text.includes("엑셀 동기화")
    )
  );

  if (isSyncCommand) {
    try {
      const res = await apiFetch(`${API_BASE}/sync/google-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet_url: "", branch_id: curBranch })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.message || "동기화 실패");
      }

      if (resBox && resContent) {
        resBox.style.display = "block";
        resContent.innerHTML = `✅ <b>엑셀 / 구글 시트 2025·2026 장부 DB 동기화 완료!</b><br>` +
          `• <b>동기화 호실</b>: <b>${data.total_rooms}개실</b> (101호~703호 전체)<br>` +
          `• <b>DB 반영 내역</b>: <b>총 ${data.total_payments_synced}건</b> 수납/계약 데이터 원자적 적재 완료<br>` +
          `<small style="color:#64748b;">(기본 호실 화면과 수납 현황에 즉시 반영되었습니다)</small>`;
        setTimeout(() => {
          resBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
      }

      await reloadRooms();
      if (typeof loadVatReport === "function") loadVatReport();
      return;
    } catch (err) {
      console.error("동기화 오류:", err);
      if (resBox && resContent) {
        resBox.style.display = "block";
        resContent.innerHTML = `<span style="color:#dc2626;">⚠️ 엑셀/시트 동기화 실패: ${err.message || '네트워크 오류'}</span>`;
      }
      return;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "확인";
      }
    }
  }

  // 1. AI 질문 / 지시문인 경우 -> /api/rent2/ai/chat 직결 처리
  // 단, 여러 줄의 호실 데이터(2개 이상의 호실 번호 포함)인 경우 무조건 만능 인제스트(일괄 계약 등록)로 직행
  const linesWithRooms = text.split("\n").filter(l => l.match(/\b\d{3,4}\s*호?/));
  const isMultiRoomData = linesWithRooms.length >= 2;

  const isQuestionOrInstruction = !isMultiRoomData && (
    !img && !text.includes("docs.google.com/spreadsheets") &&
    (text.includes("?") || text.includes("알려줘") || text.includes("조회") || text.includes("요약") ||
     text.includes("목록") || text.includes("누구") || text.includes("확인해") || text.includes("얼마") ||
     text.includes("공실") || text.includes("도와줘") || text.includes("정리해") || text.includes("현황") ||
     text.includes("만기") || text.includes("장부") || text.includes("보고서") ||
     (!text.match(/(\d{3,4})\s*호?/) && !text.match(/(\d{1,3}(?:,\d{3})+|\d{4,9})\s*원?/)))
  );

  if (isQuestionOrInstruction) {
    try {
      const res = await apiFetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, building: curBranch, mode: "auto" })
      });

      if (!res.ok) {
        throw new Error(`AI 서버 오류 (HTTP ${res.status})`);
      }

      const data = await res.json();
      const reply = data.reply || (typeof data === "string" ? data : JSON.stringify(data, null, 2));

      if (resBox && resContent) {
        resBox.style.display = "block";
        resContent.innerHTML = typeof formatAiReply === "function" ? formatAiReply(reply) : reply.replace(/\n/g, "<br>");
        setTimeout(() => {
          resBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
      }

      // 쓰기 작업 실행 시 호실 데이터 조용히 백그라운드 동기화 (모달 유지)
      if (reply && (reply.includes("완료") || reply.includes("수정") || reply.includes("납부") || reply.includes("등록"))) {
        await reloadRooms();
      }
    } catch (err) {
      console.error("AI 질의 실패:", err);
      if (resBox && resContent) {
        resBox.style.display = "block";
        resContent.innerHTML = `<span style="color:#dc2626;">⚠️ AI 비서 오류: ${err.message || '네트워크 연결 오류'}</span>`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "확인";
      }
    }
    return;
  }

  // 2. 은행 입금문자 / 구글시트 / 파일 / 사진 인제스트 처리
  setAlert(isPhoto ? (scanKind === "bank_sms" ? "⚡ 입금 알림 사진을 AI가 초고속 분석 중입니다..." : scanKind === "contract" ? "📋 계약 대장 사진을 AI가 분석 중입니다..." : scanKind === "receipt" ? "🧾 영수증 사진을 AI가 분석 중입니다..." : "⚡ AI가 사진 유형을 자동 판별하여 분석 중입니다...") : "만능 인제스트 분석 및 처리 진행 중...", "info");

  try {
    const clearBeforeImport = document.getElementById("chkClearBeforeImport") ? document.getElementById("chkClearBeforeImport").checked : true;
    const res = await apiFetch(`${API_BASE}/smart/universal-ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        image_base64: img,
        scan_kind: scanKind,
        branch_id: curBranch,
        clear_before_import: clearBeforeImport
      })
    });

    let data;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await res.json().catch(() => null);
    } else {
      const rawText = await res.text().catch(() => "");
      if (!res.ok) {
        throw new Error(rawText ? `서버 처리 오류 (HTTP ${res.status}): ${rawText.slice(0, 150)}` : `서버 오류가 발생했습니다. (HTTP ${res.status})`);
      }
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        throw new Error(`서버 응답 파싱 실패 (HTTP ${res.status})`);
      }
    }

    if (!res.ok || !data) {
      throw new Error((data && (data.detail || data.message)) || `서버 처리 실패 (HTTP ${res.status})`);
    }

    if (data.success) {
      let alertMsg = data.message || "처리가 성공적으로 완료되었습니다.";
      if (data.kind === "bank_payment" && data.applied_count > 0) {
        const first = data.items?.[0];
        const amtStr = first ? ` (${first.room_number}호 ${((first.applied_amount || first.amount) || 0).toLocaleString()}원)` : "";
        const periodInfo = (first && first.applied_year && first.applied_month) ? ` · ${first.applied_year}-${first.applied_month < 10 ? '0' : ''}${first.applied_month}분` : "";
        const extractedDesc = data.extracted_text ? `<br><small style="font-size:11.5px;color:#334155;">📷 텍스트 추출: ${data.extracted_text.replace(/\n/g, ' ')}</small>` : "";
        alertMsg = `✅ <b>입금 수납 완료</b>: ${data.applied_count}건 수납 처리되었습니다!${amtStr}${periodInfo}${extractedDesc}`;
      } else if (data.kind === "google_sheet" || data.kind === "file_excel") {
        alertMsg = `✅ <b>장부 동기화 완료</b>: 2025/2026년 전체 데이터가 성공적으로 반영되었습니다.`;
      } else if (data.ocr_kind === "receipt" || data.expense) {
        alertMsg = `✅ <b>[사진 분석 완료]</b> 지출 영수증 전표가 정상 등록되었습니다! (${data.message || ''})`;
      } else if (data.kind === "contract_roster" || data.ocr_kind === "contract" || data.applied_count !== undefined) {
        const count = data.count || data.applied_count || data.total_extracted || 0;
        alertMsg = `✅ <b>[계약 대장 등록 완료]</b> 총 <b>${count}개 호실</b>의 임대차 계약 및 세입자 정보가 DB에 정상 등록되었습니다!`;
      }

      if (isPhoto && btn) {
        if (photoTimerId) clearInterval(photoTimerId);
        btn.innerHTML = "✅ 분석 완료! (닫는 중...)";
        btn.style.background = "#16a34a";
      }

      setTimeout(() => {
        closeModal("modalPaste");
        const pt = document.getElementById("pasteText");
        if (pt) pt.value = "";
        clearPasteImage();
        setAlert(alertMsg, "success");
      }, isPhoto ? 350 : 0);

      await reloadRooms();
      if (typeof loadVatReport === "function") loadVatReport();
    } else {
      const failMsg = data.message || "유효한 계약/세입자 정보를 인식하지 못했습니다. 글자가 선명하도록 다시 촬영해 주시거나 엑셀 텍스트를 붙여넣어 주세요.";
      if (resBox && resContent) {
        resBox.style.display = "block";
        resBox.style.borderColor = "#d97706";
        resBox.style.background = "#fffbeb";
        resContent.innerHTML = `<span style="color:#b45309;font-weight:800;font-size:13.5px;">⚠️ 분석 결과 안내 (반영 0건):</span><br><br>${failMsg.replace(/\n/g, '<br>')}<br><br><span style="font-size:11.5px;color:#64748b;">💡 조치 팁: 엑셀이나 스프레드시트의 셀을 복사(Ctrl+C)하여 만능 입력창에 붙여넣으시면 즉시 일괄 등록됩니다.</span>`;
        setTimeout(() => {
          resBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
      }
      setAlert(`⚠️ [분석 결과 안내] ${failMsg}`, "warning");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "다시 확인 / 시도 🔄";
        btn.style.background = "#d97706";
      }
    }
  } catch (err) {
    console.error("Universal Ingest 실패:", err);
    const errMsg = err.message || "네트워크 연결 오류 또는 서버 응답 실패";
    if (resBox && resContent) {
      resBox.style.display = "block";
      resBox.style.borderColor = "#dc2626";
      resBox.style.background = "#fef2f2";
      resContent.innerHTML = `<span style="color:#dc2626;font-weight:800;font-size:13.5px;">❌ 분석 중 오류 발생:</span><br><br>${errMsg.replace(/\n/g, '<br>')}<br><br><span style="font-size:11.5px;color:#64748b;">💡 조치 요령: 이미지 해상도를 확인하시거나, 엑셀 표를 복사(Ctrl+C)하여 텍스트로 붙여넣으시면 안정적으로 일괄 등록됩니다.</span>`;
      setTimeout(() => {
        resBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
    }
    setAlert(`❌ [분석 오류] ${errMsg}`, "error");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "다시 확인 / 시도 🔄";
      btn.style.background = "#dc2626";
    }
  } finally {
    if (photoTimerId) clearInterval(photoTimerId);
    if (btn && btn.disabled) {
      btn.disabled = false;
      btn.innerHTML = origText;
      btn.style.background = "";
    }
    const omniSendBtn = document.getElementById("btnOmniSend");
    if (omniSendBtn) {
      omniSendBtn.disabled = false;
      omniSendBtn.innerHTML = "➔";
      updateOmniSendBtn();
    }
  }
}

// ── 카메라 촬영 및 앨범 사진 선택 핸들러 (AI 비서 원스톱 연동) ──
function handlePasteFileInput(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  processIncomingFile(file);
  event.target.value = "";
}

// 기존 호출 호환: 영수증 스캔 요청 시 AI 비서 사진 선택으로 직접 연결
function openReceiptScanModal() {
  openAIPasteModal();
  const r = document.querySelector("input[name='pasteScanKind'][value='receipt']");
  if (r) r.checked = true;
  const gal = document.getElementById("pasteFileGallery");
  if (gal) gal.click();
}

// ── 구글 스프레드시트 2025/2026 실시간 동기화 ──
function openGoogleSheetSyncModal() {
  const box = document.getElementById("syncResultBox");
  if (box) {
    box.style.display = "none";
    box.textContent = "";
  }
  openModal("modalGoogleSheetSync");
}

async function executeGoogleSheetSync() {
  const urlInput = document.getElementById("syncSheetUrl");
  const url = urlInput ? urlInput.value.trim() : "";
  const btn = document.getElementById("btnRunSheetSync");
  const box = document.getElementById("syncResultBox");

  if (!url) {
    setAlert("구글 스프레드시트 URL을 입력해주세요.", "warning");
    return;
  }

  const origText = btn ? btn.innerHTML : "동기화";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "구글 시트 분석 및 동기화 중... ⏳";
  }
  if (box) {
    box.style.display = "block";
    box.style.background = "#eff6ff";
    box.style.borderColor = "#3b82f6";
    box.style.color = "#1e40af";
    box.textContent = "구글 시트에서 2025년 및 2026년 데이터를 다운로드하여 분석 중입니다...";
  }

  try {
    const res = await apiFetch(`${API_BASE}/sync/google-sheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheet_url: url, branch_id: curBranch })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (box) {
        box.style.background = "#f0fdf4";
        box.style.borderColor = "#16a34a";
        box.style.color = "#166534";
        box.textContent = `✅ ${data.message}\n- 동기화 호실: ${data.total_rooms}개실\n- 총 납부기록 반영: ${data.total_payments_synced}건 (2025년 & 2026년)`;
      }
      setAlert(`구글 시트 동기화 완료: ${data.total_rooms}개 호실, 총 ${data.total_payments_synced}건 반영`, "success");
      reloadRooms();
      if (typeof loadVatReport === "function") loadVatReport();
    } else {
      throw new Error(data.detail || data.message || "동기화 응답 실패");
    }
  } catch (err) {
    console.error("구글 시트 동기화 오류:", err);
    if (box) {
      box.style.background = "#fef2f2";
      box.style.borderColor = "#dc2626";
      box.style.color = "#991b1b";
      box.textContent = `❌ 동기화 실패: ${err.message}`;
    }
    setAlert(`구글 시트 동기화 실패: ${err.message}`, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }
}

// AI 실행 결과 클립보드 복사 헬퍼
function copyPasteResult() {
  const content = document.getElementById("pasteAiResultContent");
  if (!content) return;
  const text = (content.innerText || content.textContent || "").trim();
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      if (typeof setAlert === "function") setAlert("📋 실행 결과가 클립보드에 복사되었습니다.", "success");
    }).catch(() => {
      if (typeof setAlert === "function") setAlert("결과 복사에 실패했습니다.", "warning");
    });
  } else {
    // 대체 복사
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    if (typeof setAlert === "function") setAlert("📋 실행 결과가 클립보드에 복사되었습니다.", "success");
  }
}

