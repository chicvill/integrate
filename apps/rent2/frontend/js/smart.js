/**
 * apps/rent2/frontend/js/smart.js
 * 만능 스마트 붙여넣기(은행문자, 구글시트, 파일경로, Ctrl+V 사진),
 * 카메라 촬영/영수증 OCR 스캔, 구글 스프레드시트 2025/2026 실시간 동기화.
 */

let currentPasteImageBase64 = "";

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
        const imgEl = document.getElementById("pasteImgPreview");
        const secEl = document.getElementById("pasteImageSection");
        if (imgEl && secEl) {
          imgEl.src = currentPasteImageBase64;
          secEl.style.display = "block";
        }
        previewUniversalPaste();
      };
      reader.readAsDataURL(blob);
      event.preventDefault(); // 기본 텍스트 삽입 방지
      return;
    }
  }
  setTimeout(previewUniversalPaste, 50);
}

function clearPasteImage() {
  currentPasteImageBase64 = "";
  const secEl = document.getElementById("pasteImageSection");
  if (secEl) secEl.style.display = "none";
  previewUniversalPaste();
}

function getSelectedPasteScanKind() {
  const r = document.querySelector("input[name='pasteScanKind']:checked");
  return r ? r.value : "receipt";
}

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
      btn.innerHTML = "스마트 실행";
      btn.className = "btn-primary";
      btn.style.background = "#000";
    }
    return;
  }

  if (box) box.style.display = "block";

  // 1. 사진 / 이미지 데이터 감지
  if (currentPasteImageBase64 || txt.startsWith("data:image/")) {
    const kind = getSelectedPasteScanKind();
    const kindDesc = kind === "receipt" ? "지출 영수증 (일자·금액 자동 전표 등록)" : "임대차 계약서 (호실·세입자 자동 갱신)";
    if (badge) {
      badge.innerHTML = "📷 클립보드 사진 감지됨";
      badge.style.background = "#0284c7";
    }
    if (body) {
      body.innerHTML = `붙여넣은 사진이 감지되었습니다.<br>선택된 분석: <b>${kindDesc}</b>`;
    }
    if (btn) {
      btn.innerHTML = `⚡ 사진 AI 분석 및 등록 (${kind === 'receipt' ? '영수증' : '계약서'})`;
      btn.className = "btn-primary";
      btn.style.background = "#0284c7";
    }
    return;
  }

  // 2. 구글 스프레드시트 URL 감지
  if (txt.includes("docs.google.com/spreadsheets")) {
    if (badge) {
      badge.innerHTML = "📊 구글 스프레드시트 링크 감지됨";
      badge.style.background = "#16a34a";
    }
    if (body) {
      body.innerHTML = `<b>시크빌 2025년 및 2026년 장부 링크</b>입니다.<br>실행 시 29개 호실의 연도별 계약 및 월별 납부내역이 실시간 동기화됩니다.`;
    }
    if (btn) {
      btn.innerHTML = "🔄 2025/2026 장부 실시간 동기화";
      btn.className = "btn-primary";
      btn.style.background = "#16a34a";
    }
    return;
  }

  // 3. 로컬 파일 경로 감지
  const cleanPath = txt.replace(/["';]/g, "").trim();
  const lower = cleanPath.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv") || lower.endsWith(".tsv")) {
    const fname = cleanPath.split(/[\\/]/).pop();
    if (badge) {
      badge.innerHTML = "📁 엑셀/CSV 장부 파일 경로 감지됨";
      badge.style.background = "#0d9488";
    }
    if (body) {
      body.innerHTML = `장부 파일: <b>${fname}</b><br>경로: <code>${cleanPath}</code>`;
    }
    if (btn) {
      btn.innerHTML = "📋 장부 파일 동기화 실행";
      btn.className = "btn-primary";
      btn.style.background = "#0d9488";
    }
    return;
  } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp") || lower.endsWith(".pdf")) {
    const fname = cleanPath.split(/[\\/]/).pop();
    const kind = getSelectedPasteScanKind();
    if (badge) {
      badge.innerHTML = "🖼️ 사진/영수증 파일 경로 감지됨";
      badge.style.background = "#8b5cf6";
    }
    if (body) {
      body.innerHTML = `이미지 파일: <b>${fname}</b><br>경로: <code>${cleanPath}</code>`;
    }
    if (btn) {
      btn.innerHTML = "🔍 사진 파일 AI OCR 분석";
      btn.className = "btn-primary";
      btn.style.background = "#8b5cf6";
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

  const roomM = txt.match(/(\d{3,4})\s*호?/);
  let moneyM = txt.match(/(\d{1,3}(?:,\d{3})+|\d{4,9})\s*원?/) || txt.match(/(\d+(?:\.\d+)?)\s*만\s*원?/);
  const roomNum = roomM ? parseInt(roomM[1], 10) : null;
  let estAmount = moneyM ? moneyM[0] : null;

  // 질문형 어미가 있거나 은행 입금 패턴이 아니면 AI 비서 질의로 감지
  if (isQuestionOrInstruction || (!roomNum && !estAmount)) {
    if (badge) {
      badge.innerHTML = "🤖 AI 비서 질문 / 작업 지시 감지됨";
      badge.style.background = "#2563eb";
    }
    if (body) {
      body.innerHTML = `입력 내용: <b>"${txt.length > 50 ? txt.slice(0, 50) + '...' : txt}"</b><br>AI 비서가 29개실 실시간 장부를 분석하여 즉시 답변하고 전산 작업을 처리합니다.`;
    }
    if (btn) {
      btn.innerHTML = "🚀 AI 비서에게 질문 / 지시 실행";
      btn.className = "btn-primary";
      btn.style.background = "#2563eb";
    }
    return;
  }

  if (!estAmount && roomNum) {
    const withoutRoom = txt.replace(roomM[0], "");
    const shortNum = withoutRoom.match(/\b(\d{2,3})\b/);
    if (shortNum) {
      const val = parseInt(shortNum[1], 10);
      if (val >= 10 && val <= 900) {
        estAmount = `${(val * 10000).toLocaleString()}원 (약식 ${val}만)`;
      }
    }
  }

  if (!estAmount && roomNum && typeof allRooms !== "undefined") {
    const found = allRooms.find(r => r.room_number === roomNum);
    if (found) {
      const total = (found.rent || 0) + (found.maintenance || 0);
      if (total > 0) {
        estAmount = `${total.toLocaleString()}원 <span style="color:#0277bd;font-weight:normal;">(계약기준 자동적용)</span>`;
      }
    }
  }

  if (badge) {
    badge.innerHTML = "💬 은행 입금 알림 문자 / 카톡 감지됨";
    badge.style.background = "#000";
  }
  if (body) {
    body.innerHTML = `인식 호실: <b>${roomNum ? roomNum + "호" : "<span style='color:#c62828;'>미인식 (호실 번호 필요)</span>"}</b> | 금액: <b>${estAmount || "<span style='color:#666;'>확정 시 계약금액 적용</span>"}</b>`;
  }
  if (btn) {
    btn.innerHTML = "💳 입금 수납 처리 확정";
    btn.className = "btn-primary";
    btn.style.background = "#000";
  }
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
  setTimeout(() => {
    const pt = document.getElementById("pasteText");
    if (pt) {
      pt.focus();
    }
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
}

function clearPasteArea() {
  const pt = document.getElementById("pasteText");
  if (pt) pt.value = "";
  clearPasteImage();
  const resBox = document.getElementById("pasteAiResultBox");
  if (resBox) resBox.style.display = "none";
  previewUniversalPaste();
}

function handlePasteKeyDown(event) {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
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

  const btn = document.getElementById("btnUniversalSubmit");
  const origText = btn ? btn.innerHTML : "실행";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "AI 비서 분석 및 처리 중... ⏳";
  }

  // 1. AI 질문 / 지시문인 경우 -> /api/rent2/ai/chat 직결 처리
  const isQuestionOrInstruction = (
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
      }

      setAlert("🤖 AI 비서 답변이 완료되었습니다. 창에서 결과를 확인하세요.", "success");

      // 쓰기 작업 실행 시 호실 데이터 동기화
      if (reply && (reply.includes("완료") || reply.includes("수정") || reply.includes("납부") || reply.includes("등록"))) {
        await reloadRooms();
      }
    } catch (err) {
      console.error("AI 질의 실패:", err);
      if (resBox && resContent) {
        resBox.style.display = "block";
        resContent.innerHTML = `<span style="color:#dc2626;">⚠️ AI 비서 오류: ${err.message || '네트워크 연결 오류'}</span>`;
      }
      setAlert(`AI 비서 질의 실패: ${err.message}`, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    }
    return;
  }

  // 2. 은행 입금문자 / 구글시트 / 파일 / 사진 인제스트 처리
  setAlert("만능 인제스트 분석 및 처리 진행 중...", "info");

  try {
    const res = await apiFetch(`${API_BASE}/smart/universal-ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        image_base64: img,
        scan_kind: scanKind,
        branch_id: curBranch
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || "처리 실패");
    }

    if (data.success) {
      let alertMsg = data.message || "처리가 성공적으로 완료되었습니다.";
      if (data.kind === "bank_payment" && data.applied_count > 0) {
        const first = data.items?.[0];
        const amtStr = first ? ` (${first.room_number}호 ${((first.applied_amount || first.amount) || 0).toLocaleString()}원)` : "";
        const periodInfo = (first && first.applied_year && first.applied_month) ? ` · ${first.applied_year}-${first.applied_month < 10 ? '0' : ''}${first.applied_month}분` : "";
        alertMsg = `✅ 입금 수납 완료: ${data.applied_count}건 수납 처리되었습니다!${amtStr}${periodInfo}`;
      } else if (data.kind === "google_sheet" || data.kind === "file_excel") {
        alertMsg = `✅ 장부 동기화 완료: 2025/2026년 전체 데이터가 성공적으로 반영되었습니다.`;
      } else if (data.ocr_kind === "receipt" || data.expense) {
        alertMsg = `✅ 영수증 지출 전표 등록 완료! (${data.message || ''})`;
      } else if (data.ocr_kind === "contract") {
        alertMsg = `✅ 계약서 인식 및 호실 정보 갱신 완료!`;
      }

      setAlert(alertMsg, "success");
      closeModal("modalPaste");
      const pt = document.getElementById("pasteText");
      if (pt) pt.value = "";
      clearPasteImage();
      await reloadRooms();
      if (typeof loadVatReport === "function") loadVatReport();
    } else {
      setAlert(data.message || "내용을 분석하지 못했습니다. 형식을 확인해 주세요.", "error");
    }
  } catch (err) {
    console.error("Universal Ingest 실패:", err);
    setAlert(`처리 중 오류 발생: ${err.message || '네트워크 오류'}`, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }
}

// ── 카메라 촬영 / OCR 스캔 ──
function openReceiptScanModal() {
  const sk = document.getElementById("scanKind");
  if (sk) sk.value = "receipt";
  openModal("modalScan");
}

function previewScanImage(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const fnEl = document.getElementById("scanFileName");
  if (fnEl) {
    fnEl.textContent = `✅ 선택된 사진: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    fnEl.style.color = "#166534";
    fnEl.style.borderColor = "#166534";
    fnEl.style.background = "#f0fdf4";
    fnEl.style.fontWeight = "700";
  }
  const reader = new FileReader();
  reader.onload = e => {
    scanBase64 = e.target.result;
    const sip = document.getElementById("scanImagePreview");
    const sipb = document.getElementById("scanImagePreviewBox");
    if (sip) sip.src = scanBase64;
    if (sipb) sipb.style.display = "block";
  };
  reader.readAsDataURL(file);
}

async function runScanOCR() {
  if (!scanBase64) { alert("촬영하거나 업로드할 사진을 선택하세요."); return; }
  const kindEl = document.getElementById("scanKind");
  const kind = kindEl ? kindEl.value : "receipt";
  const endpoint = kind === "contract" ? `${API_BASE}/smart/ocr-contract` : `${API_BASE}/smart/ocr-receipt`;
  const btn = document.getElementById("btnScanRun");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "AI 분석 중... ⏳";
  }
  setAlert("이미지 AI OCR 분석 진행 중...", "info");

  try {
    const res = await apiFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64: scanBase64, branch_id: curBranch, auto_apply: true })
    });
    if (!res.ok) return;
    const data = await res.json();
    const resBox = document.getElementById("scanResultBox");
    if (resBox) {
      resBox.style.display = "block";
      resBox.textContent = JSON.stringify(data.extracted || data.extracted_rows || data, null, 2);
    }

    if (data.success) {
      setAlert(data.message || "성공적으로 반영되었습니다.", "success");
      await reloadRooms();
      if (kind === "receipt") {
        if (typeof loadExpenses === "function") loadExpenses();
        if (typeof loadIncomeTax === "function") loadIncomeTax();
      }
    } else {
      setAlert(data.message || "OCR 분석 실패", "error");
    }
  } catch (err) {
    setAlert("OCR 요청 중 통신 오류", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "AI 스캔 및 자동 등록";
    }
  }
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
