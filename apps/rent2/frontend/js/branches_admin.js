/**
 * apps/rent2/frontend/js/branches_admin.js
 * 본사 최고관리자(admin) 전용 가맹 매장 목록, 솔루션 이용료 수납, 매장 개설/삭제/수정.
 */

let adminBranchesList = [];

async function loadAdminBranches() {
  try {
    setAlert("본사 가맹 매장 및 사용료 수납 데이터를 불러오는 중...", "info");
    const res = await apiFetch(`${API_BASE}/branches`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    adminBranchesList = data.branches || [];

    // 본사 통계 집계
    let paidCount = 0, overdueCount = 0, feeCollectedTotal = 0;
    adminBranchesList.forEach(b => {
      const st = (b.billing_status || "PAID").toUpperCase();
      const fee = Number(b.monthly_fee) || 0;
      if (st === "PAID") {
        paidCount++;
        feeCollectedTotal += fee;
      } else {
        overdueCount++;
      }
    });

    const statTotal = document.getElementById("statBranchTotal");
    const statPaid = document.getElementById("statBranchPaid");
    const statOverdue = document.getElementById("statBranchOverdue");
    const statFee = document.getElementById("statBranchFeeTotal");

    if (statTotal) statTotal.textContent = `${adminBranchesList.length}개 매장`;
    if (statPaid) statPaid.textContent = `${paidCount}개 완료`;
    if (statOverdue) statOverdue.textContent = `${overdueCount}개 미납/연체`;
    if (statFee) statFee.textContent = `${feeCollectedTotal.toLocaleString()}원`;

    renderAdminBranches();
    setAlert("", "info");
  } catch (err) {
    console.error("loadAdminBranches 실패:", err);
    setAlert("매장 목록 로드 실패: " + (err.message || ""), "error");
  }
}

function renderAdminBranches() {
  const grid = document.getElementById("branchListGrid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!adminBranchesList.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:30px;text-align:center;border:1px dashed #000;">등록된 가맹 매장이 없습니다.</div>`;
    return;
  }

  adminBranchesList.forEach(b => {
    const card = document.createElement("div");
    card.className = "room-card";
    const st = (b.billing_status || "PAID").toUpperCase();
    const isPaid = st === "PAID";
    const isOverdue = st === "OVERDUE";
    const badgeColor = isPaid ? "#2e7d32" : (isOverdue ? "#c62828" : "#f57f17");
    const badgeBg = isPaid ? "#e8f5e9" : (isOverdue ? "#ffebee" : "#fffde7");
    const badgeText = isPaid ? "완납 (정상)" : (isOverdue ? "미납/연체" : "청구중");

    const fee = Number(b.monthly_fee) || 150000;
    const dueDay = b.billing_due_day || 25;
    const roomCount = b.total_rooms !== undefined ? b.total_rooms : (b.rooms_count || "-");

    card.innerHTML = `
      <div class="room-header">
        <span class="room-number" style="font-size:15px;">${b.name}</span>
        <span style="background:${badgeBg};color:${badgeColor};padding:3px 8px;border:1px solid ${badgeColor};font-weight:800;font-size:11px;">
          ${badgeText}
        </span>
      </div>
      <div class="room-body">
        <div class="row">
          <span style="font-weight:700;">ID: ${b.branch_id}</span>
          <span>총 <b>${roomCount}</b>개실</span>
        </div>
        <div class="row" style="color:#333;">
          <span>월 사용료: <b>${fee.toLocaleString()}원</b></span>
          <span>납부지정일: 매월 ${dueDay}일</span>
        </div>
        <div class="row" style="font-size:11px;color:#666;margin-top:4px;">
          <span>최종 납부일: ${b.last_paid_at || "내역 없음"}</span>
          <span>연락처: ${b.contact_phone || "-"}</span>
        </div>
        ${b.address ? `<div style="font-size:11px;color:#777;margin-top:2px;">소재지: ${b.address}</div>` : ""}
      </div>
      <div class="room-actions" style="margin-top:10px;">
        <button class="btn-sm" style="background:#000;color:#fff;" onclick="switchBranchAndGo('${b.branch_id}')">🚀 관제 이동</button>
        <button class="btn-sm" style="background:#2e7d32;color:#fff;border-color:#2e7d32;" onclick="quickPayBranchFee('${b.branch_id}', '${b.name}')">💵 사용료 수납</button>
        <button class="btn-sm btn-outline" onclick="openBranchBillingModal('${b.branch_id}')">⚙️ 설정</button>
        ${b.branch_id !== 'main' ? `<button id="btnDelBranch_${b.branch_id}" class="btn-sm btn-outline" style="color:#c62828;border-color:#c62828;" onclick="deleteAdminBranch('${b.branch_id}', '${b.name}')">삭제</button>` : ''}
      </div>
    `;
    grid.appendChild(card);
  });
}

// ── 매장 원클릭 이동 ──
function switchBranchAndGo(bid) {
  curBranch = bid;
  const sel = document.getElementById("branchSelect");
  if (sel) sel.value = bid;
  setTab("rooms");
  reloadRooms();
  setAlert(`🏢 [${bid}] 매장 관제 모드로 이동했습니다.`, "info");
}

// ── 매장 솔루션 사용료 원클릭 수납 ──
async function quickPayBranchFee(bid, name) {
  if (!confirm(`[${name}] 매장의 당월 솔루션 월 사용료를 '수납 완료(완납)' 처리하시겠습니까?`)) return;
  try {
    const res = await apiFetch(`${API_BASE}/branches/${bid}/pay-fee`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid_date: new Date().toISOString().slice(0, 10) })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setAlert(`✅ ${data.message || '수납 완료되었습니다.'}`, "success");
    await loadAdminBranches();
  } catch (err) {
    setAlert("사용료 수납 처리에 실패했습니다: " + (err.message || ""), "error");
  }
}

// ── 매장 사용료 및 수납 설정 모달 ──
function openBranchBillingModal(bid) {
  const b = adminBranchesList.find(x => x.branch_id === bid);
  if (!b) return;
  document.getElementById("bbBranchId").value = b.branch_id;
  document.getElementById("bbBranchName").value = `${b.name} (${b.branch_id})`;
  document.getElementById("bbBillingStatus").value = b.billing_status || "PAID";
  document.getElementById("bbMonthlyFee").value = b.monthly_fee || 150000;
  document.getElementById("bbDueDay").value = b.billing_due_day || 25;
  document.getElementById("bbLastPaidAt").value = b.last_paid_at || new Date().toISOString().slice(0, 10);
  document.getElementById("billingModalTitle").textContent = `💵 [${b.name}] 사용료 수납 설정`;
  openModal("modalBranchBilling");
}

async function handleUpdateBranchBillingSubmit(e) {
  if (e) e.preventDefault();
  const bid = document.getElementById("bbBranchId").value;
  const payload = {
    billing_status: document.getElementById("bbBillingStatus").value,
    monthly_fee: Number(document.getElementById("bbMonthlyFee").value),
    billing_due_day: Number(document.getElementById("bbDueDay").value),
    last_paid_at: document.getElementById("bbLastPaidAt").value
  };
  try {
    const res = await apiFetch(`${API_BASE}/branches/${bid}/billing`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    closeModal("modalBranchBilling");
    setAlert(`✅ 매장 수납 설정이 정상적으로 저장되었습니다.`, "success");
    await loadAdminBranches();
  } catch (err) {
    setAlert("수납 설정 저장 실패: " + (err.message || ""), "error");
  }
}

// ── 신규 매장(건물) 개설 ──
async function handleCreateBranchSubmit(e) {
  if (e) e.preventDefault();
  const bid = document.getElementById("nbBranchId").value.trim();
  const name = document.getElementById("nbName").value.trim();
  const phone = document.getElementById("nbPhone").value.trim();
  const address = document.getElementById("nbAddress").value.trim();
  const monthly_fee = Number(document.getElementById("nbMonthlyFee").value);
  const billing_due_day = Number(document.getElementById("nbDueDay").value);
  const room_count = Number(document.getElementById("nbRooms").value) || 15;

  if (!bid || !name) {
    setAlert("매장 ID와 매장명을 입력해 주세요.", "warning");
    return;
  }

  setAlert(`신규 매장 '${name}' 개설 중... ⏳`, "info");
  try {
    const res = await apiFetch(`${API_BASE}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branch_id: bid,
        name,
        contact_phone: phone,
        address,
        monthly_fee,
        billing_due_day,
        room_count
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP ${res.status}`);
    }

    closeModal("modalNewBranch");
    setAlert(`🎉 신규 매장 '${name}'(${room_count}개실)이 성공적으로 개설되었습니다!`, "success");
    document.getElementById("nbBranchId").value = "";
    document.getElementById("nbName").value = "";
    document.getElementById("nbPhone").value = "";
    document.getElementById("nbAddress").value = "";
    await loadBranches();
    await loadAdminBranches();
    switchBranchAndGo(bid);
  } catch (err) {
    setAlert(`매장 개설 실패: ${err.message}`, "error");
  }
}

// ── 매장 삭제 ──
async function deleteAdminBranch(bid, name) {
  if (bid === "main") {
    setAlert("기본 본사 부동산(시크빌 1호점)은 삭제할 수 없습니다.", "warning");
    return;
  }
  if (!confirm(`⚠️ 정말로 '${name}' (${bid}) 매장을 삭제하시겠습니까?\n모든 호실, 계약, 수납 데이터가 영구 삭제됩니다.`)) return;

  const btn = document.getElementById(`btnDelBranch_${bid}`) || (event && event.target);
  const origText = btn ? btn.textContent : "삭제";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "삭제 중... ⏳";
  }
  setAlert(`'${name}' 매장 및 데이터 삭제 진행 중... ⏳`, "info");

  try {
    const res = await apiFetch(`${API_BASE}/branches/${encodeURIComponent(bid)}`, { method: "DELETE" });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP ${res.status}`);
    }
    const data = await res.json().catch(() => ({}));
    setAlert(data.message || `'${name}' 매장이 성공적으로 삭제되었습니다.`, "success");

    if (curBranch === bid) {
      curBranch = "main";
    }

    await loadBranches();
    await loadAdminBranches();
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText;
    }
    setAlert(`매장 삭제 실패: ${err.message}`, "error");
  }
}
