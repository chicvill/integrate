/**
 * apps/rent2/frontend/js/rooms.js
 * 호실 목록 로드, 실시간 브리핑 집계, 호실 카드 렌더링, 필터링,
 * FIFO 수납/LIFO 취소, 퇴실 처리, 호실 계약 수정, 수납 내역 모달.
 */

// ── 호실 목록 동기화 ──
async function reloadRooms() {
  try {
    setAlert("호실 데이터 동기화 중...", "info");
    const res = await apiFetch(`${API_BASE}/rooms?branch_id=${curBranch}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const rawRooms = data.rooms || {};
    allRooms = Array.isArray(rawRooms) ? rawRooms : Object.values(rawRooms);
    
    // 브리핑 집계 (수납, 미납, 만기, 공실)
    let paidCount = 0, paidAmount = 0;
    let unpaidCount = 0, unpaidAmount = 0, vacantCount = 0, expiringCount = 0;
    const now = new Date();
    const curY = now.getFullYear(), curM = now.getMonth() + 1;

    allRooms.forEach(r => {
      const pays = r.payments || {};
      const curPay = pays[`${curY}-${curM}`] || pays[curM] || {};
      const isVacant = !r.name;

      if (isVacant) {
        vacantCount++;
      } else {
        const rentTotal = (curPay.rent_amount !== undefined ? curPay.rent_amount : (r.rent || 0)) + 
                          (curPay.maintenance_amount !== undefined ? curPay.maintenance_amount : (r.maintenance || 0));
        if (curPay.paid) {
          paidCount++;
          paidAmount += (curPay.amount || rentTotal);
        } else if (curPay.rent_amount > 0 || (r.rent || 0) > 0) {
          unpaidCount++;
          unpaidAmount += rentTotal;
        }
      }
      if (r.expiry) {
        const expD = new Date(r.expiry);
        const diffDays = Math.ceil((expD - now) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 65) {
          expiringCount++;
          r.diff_days = diffDays;
        }
      }
    });

    const fmtMoney = amt => (amt >= 10000 ? `${Math.round(amt / 10000).toLocaleString()}만원` : `${amt.toLocaleString()}원`);
    const statPaid = document.getElementById("statPaid");
    const statPaidAmount = document.getElementById("statPaidAmount");
    const statUnpaid = document.getElementById("statUnpaid");
    const statUnpaidAmount = document.getElementById("statUnpaidAmount");
    const statExpiring = document.getElementById("statExpiring");
    const statVacant = document.getElementById("statVacant");
    const statTotalRooms = document.getElementById("statTotalRooms");

    if (statPaid) statPaid.textContent = `${paidCount}실`;
    if (statPaidAmount) statPaidAmount.textContent = fmtMoney(paidAmount);
    if (statUnpaid) statUnpaid.textContent = `${unpaidCount}실`;
    if (statUnpaidAmount) statUnpaidAmount.textContent = fmtMoney(unpaidAmount);
    if (statExpiring) statExpiring.textContent = `${expiringCount}실`;
    if (statVacant) statVacant.textContent = `${vacantCount}실`;
    if (statTotalRooms) statTotalRooms.textContent = `총 ${allRooms.length}실`;

    setAlert("", "info");
    renderRooms();
  } catch (err) {
    console.error("reloadRooms 에러:", err);
    setAlert(`호실 데이터를 불러오지 못했습니다. (${err.message})`, "error");
  }
}

function filterRooms(status) {
  curFilter = curFilter === status ? "all" : status;
  const filterSelect = document.getElementById("filterStatus");
  if (filterSelect) filterSelect.value = curFilter;
  document.querySelectorAll(".stat-card").forEach(c => c.classList.remove("active"));
  if (curFilter === "paid") document.getElementById("cardPaid")?.classList.add("active");
  if (curFilter === "unpaid") document.getElementById("cardUnpaid")?.classList.add("active");
  if (curFilter === "expiring") document.getElementById("cardExpiring")?.classList.add("active");
  if (curFilter === "vacant") document.getElementById("cardVacant")?.classList.add("active");
  renderRooms();
}

function renderRooms() {
  const roomSearchInput = document.getElementById("roomSearch");
  const q = (roomSearchInput?.value || "").trim().toLowerCase();
  const filterSelect = document.getElementById("filterStatus");
  const st = filterSelect ? filterSelect.value : "all";
  const grid = document.getElementById("roomGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const now = new Date();
  const curY = now.getFullYear(), curM = now.getMonth() + 1;

  const filtered = allRooms.filter(r => {
    const pays = r.payments || {};
    const curPay = pays[`${curY}-${curM}`] || pays[curM] || {};
    const isVacant = !r.name;
    const isUnpaid = !isVacant && !curPay.paid && curPay.rent_amount > 0;
    const isPaid = !isVacant && curPay.paid;
    const isExpiring = r.diff_days !== undefined && r.diff_days <= 65 && r.diff_days >= 0;

    if (st === "unpaid" && !isUnpaid) return false;
    if (st === "paid" && !isPaid) return false;
    if (st === "vacant" && !isVacant) return false;
    if (st === "expiring" && !isExpiring) return false;

    if (q) {
      const matchRoom = String(r.room_number).includes(q);
      const matchTenant = (r.name || "").toLowerCase().includes(q);
      if (!matchRoom && !matchTenant) return false;
    }
    return true;
  });

  if (!filtered.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:30px;text-align:center;border:1px dashed #000;">조건에 해당하는 호실이 없습니다.</div>`;
    return;
  }

  filtered.forEach(r => {
    const pays = r.payments || {};
    const curPay = pays[`${curY}-${curM}`] || pays[curM] || {};
    const isVacant = !r.name;
    const isUnpaid = !isVacant && !curPay.paid && curPay.rent_amount > 0;
    const badgeClass = isVacant ? "badge-vacant" : (isUnpaid ? "badge-unpaid" : "badge-paid");
    const badgeText = isVacant ? "공실" : (isUnpaid ? "미납" : "완납");

    const rentStr = r.rent ? `${(r.rent / 10000)}만` : "0";
    const depStr = r.deposit ? `${(r.deposit / 10000)}만` : "0";
    const mntStr = r.maintenance ? ` · 관${(r.maintenance / 10000)}만` : "";
    const vatBadge = r.vat_target === false ? " · VAT제외" : (r.vat_separate ? " · VAT별도" : "");
    const costSummary = isVacant ? "현재 공실" : `월${rentStr}(보${depStr})${mntStr}${vatBadge}`;

    const card = document.createElement("div");
    card.className = `room-card ${isUnpaid ? "status-unpaid" : ""}`;
    card.innerHTML = `
      <div class="room-header">
        <div>
          <span class="room-number">${r.room_number}호</span>
          <span style="font-size:13px;font-weight:800;margin-left:4px;">${r.name || "(공실)"}</span>
          ${isUnpaid ? `<span style="color:#c62828;font-weight:900;font-size:11px;margin-left:2px;">[미납]</span>` : ""}
        </div>
        <span class="room-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="room-body">
        <div class="row">
          <span style="font-weight:700;">${costSummary}</span>
          <span style="color:#666;font-size:11px;">${r.phone || ""}</span>
        </div>
        ${r.move_out ? `<div class="row" style="color:#777;font-size:11px;margin-top:1px;"><span>만기: ${r.expiry || "-"}</span><span style="color:#c62828;font-weight:700;">퇴거: ${r.move_out}</span></div>` : (r.expiry ? `<div class="row" style="color:#777;font-size:11px;margin-top:1px;"><span>만기: ${r.expiry}</span><span>${r.diff_days !== undefined ? r.diff_days + '일 남음' : ''}</span></div>` : "")}
      </div>
      <div class="room-actions">
        ${!isVacant && !curPay.paid ? `<button class="btn-sm" style="background:#000;color:#fff;" onclick="quickPay(${r.room_number})">당월수납</button>` : ""}
        ${!isVacant && curPay.paid ? `<button class="btn-sm btn-outline" style="color:#c62828;border-color:#c62828;" onclick="quickCancelPay(${r.room_number})">수납취소</button>` : ""}
        <button class="btn-sm btn-outline" onclick="openPaymentHistory(${r.room_number})">수납내역</button>
        <button class="btn-sm btn-outline" onclick="openRoomDetail(${r.room_number})">수정</button>
        ${!isVacant ? `<button class="btn-sm btn-outline" onclick="endContract(${r.room_number}, '${r.name}')">퇴실</button>` : `<button class="btn-sm btn-outline" onclick="openRoomDetail(${r.room_number})">+입주계약</button>`}
      </div>
    `;
    grid.appendChild(card);
  });
}

// ── 원클릭 빠른 수납 (미납월 중 오래된 것부터 FIFO 적용) ──
async function quickPay(roomNum) {
  const r = (typeof allRooms !== "undefined") ? allRooms.find(x => x.room_number === roomNum) : null;
  const unpaids = r?.unpaid_months || [];
  const targetLabel = unpaids.length > 0 ? `${unpaids[0]}분 (가장 오래된 미납)` : "당월분";
  if (!confirm(`[${roomNum}호] ${targetLabel} 수납(정상 입금)으로 처리하시겠습니까?`)) return;

  const now = new Date();
  try {
    const res = await apiFetch(`${API_BASE}/rooms/${roomNum}/payment?branch_id=${curBranch}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        paid: true,
        paid_date: now.toISOString().slice(0, 10),
        note: "원클릭 수납"
      })
    });
    if (!res.ok) return;
    const data = await res.json();
    const pLabel = data.applied_period || `${now.getFullYear()}-${now.getMonth() + 1}`;
    const suffix = data.was_oldest_unpaid ? " (오래된 미납 우선 충당)" : "";
    setAlert(`✅ [${roomNum}호] ${pLabel}분 정상 수납 완료되었습니다!${suffix}`, "success");
    await reloadRooms();
  } catch (err) {
    setAlert("수납 처리에 실패했습니다: " + (err.message || ""), "error");
  }
}

// ── 수납 취소 (가장 최근월부터 LIFO 취소) ──
async function quickCancelPay(roomNum) {
  if (!confirm(`[${roomNum}호] 가장 최근에 수납된 월을 취소(미납으로 환원)하시겠습니까?`)) return;
  const now = new Date();
  try {
    const res = await apiFetch(`${API_BASE}/rooms/${roomNum}/cancel-payment?branch_id=${curBranch}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        note: "납부 취소"
      })
    });
    if (!res.ok) return;
    const data = await res.json();
    const cLabel = data.cancelled_period || "해당 월";
    setAlert(`↩️ [${roomNum}호] ${cLabel}분(가장 최근 수납월)이 취소(미납 환원)되었습니다.`, "warning");
    await reloadRooms();
  } catch (err) {
    setAlert("수납 취소 처리에 실패했습니다: " + (err.message || ""), "error");
  }
}

// ── 퇴실 처리 ──
async function endContract(roomNum, tenantName) {
  if (!confirm(`${roomNum}호 ${tenantName} 세입자를 오늘 날짜로 퇴실 처리하시겠습니까? 이력은 자동 보존됩니다.`)) return;
  try {
    const res = await apiFetch(`${API_BASE}/rooms/${roomNum}/contract?branch_id=${curBranch}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", move_out: new Date().toISOString().slice(0, 10) })
    });
    if (!res.ok) return;
    setAlert(`${roomNum}호 퇴실 처리 및 이력 보존 완료`, "success");
    await reloadRooms();
  } catch (err) {
    setAlert("퇴실 처리에 실패했습니다.", "error");
  }
}

// ── 호실별 월별 수납 내역 모달 열기 ──
function openPaymentHistory(roomNumber) {
  const room = allRooms.find(x => x.room_number === roomNumber);
  if (!room) {
    setAlert(`${roomNumber}호 정보를 찾을 수 없습니다.`, "warning");
    return;
  }

  const titleEl = document.getElementById("payHistTitle");
  const summaryEl = document.getElementById("payHistSummary");
  const tbody = document.getElementById("payHistTableBody");
  const tfoot = document.getElementById("payHistTableFoot");

  const tenantName = room.name || "(공실)";
  titleEl.innerHTML = `💳 <b>${roomNumber}호</b> ${tenantName} 수납 내역`;

  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const prevY = curY - 1;

  const isVatSeparate = Boolean(room.vat_separate);
  const isVatTarget = room.vat_target !== false;
  let vatTypeDesc = "VAT 포함";
  if (!isVatTarget) vatTypeDesc = "VAT 제외 (면세)";
  else if (isVatSeparate) vatTypeDesc = "VAT 별도 (10% 별도 부과)";

  const pays = room.payments || {};

  const periods = [];
  for (let y = curY; y >= prevY; y--) {
    const startM = (y === curY) ? curM : 12;
    const endM = (y === prevY) ? 1 : 1;
    for (let m = startM; m >= endM; m--) {
      periods.push({ year: y, month: m });
    }
  }

  let totalPaidCount = 0;
  let totalUnpaidCount = 0;
  let sumRent = 0;
  let sumMaint = 0;
  let sumVat = 0;
  let sumTotal = 0;

  tbody.innerHTML = "";

  periods.forEach(p => {
    const key = `${p.year}-${p.month}`;
    const payInfo = pays[key] || pays[p.month] || {};
    const isPaid = Boolean(payInfo.paid);
    const periodIdx = p.year * 12 + p.month;

    let moveInIdx = 0;
    if (room.move_in) {
      const parts = room.move_in.split("-");
      if (parts.length >= 2) moveInIdx = parseInt(parts[0], 10) * 12 + parseInt(parts[1], 10);
    }
    let moveOutIdx = 9999999;
    if (room.move_out) {
      const parts = room.move_out.split("-");
      if (parts.length >= 2) moveOutIdx = parseInt(parts[0], 10) * 12 + parseInt(parts[1], 10);
    }

    const isBeforeMoveIn = moveInIdx > 0 && periodIdx < moveInIdx && !payInfo.is_previous_tenant && !isPaid;
    const isMoveInMonth = moveInIdx > 0 && periodIdx === moveInIdx;
    const payTiming = room.pay_timing || "후불";
    const isPostpayMoveInVacant = isMoveInMonth && payTiming === "후불" && !isPaid;
    const isAfterMoveOut = moveOutIdx < 9999999 && periodIdx > moveOutIdx && !isPaid;

    const isExplicitVacant = Boolean(payInfo.vacancy) || 
                            payInfo.tenant_name === "공실" || 
                            payInfo.note === "공실" ||
                            (payInfo.note && payInfo.note.includes("공실")) ||
                            (!room.name || room.name === "(공실)");

    let rawRentAmt = Number(payInfo.rent_amount !== undefined ? payInfo.rent_amount : (room.rent || 0));
    let rawMaintAmt = Number(payInfo.maintenance_amount !== undefined ? payInfo.maintenance_amount : (room.maintenance || 0));

    const isZeroAmountUnpaid = !isPaid && rawRentAmt === 0 && rawMaintAmt === 0;
    const isVacant = isExplicitVacant || isBeforeMoveIn || isPostpayMoveInVacant || isAfterMoveOut || isZeroAmountUnpaid;

    const rentAmt = isVacant ? 0 : rawRentAmt;
    const maintAmt = isVacant ? 0 : rawMaintAmt;
    const paidDate = payInfo.paid_date || (isPaid ? `${p.year}-${String(p.month).padStart(2, '0')}-05` : "-");

    let vatAmt = 0;
    let vatDisplay = "-";
    if (isVacant) {
      vatDisplay = "-";
    } else if (isVatSeparate && isVatTarget) {
      vatAmt = Math.round(rentAmt * 0.1);
      vatDisplay = `${vatAmt.toLocaleString()}원`;
    } else if (!isVatTarget) {
      vatDisplay = `<span style="color:#64748b;font-size:11px;">면세</span>`;
    } else {
      vatDisplay = `<span style="color:#64748b;font-size:11px;">포함</span>`;
    }

    const monthTotal = rentAmt + maintAmt + vatAmt;

    if (isPaid) {
      totalPaidCount++;
      sumRent += rentAmt;
      sumMaint += maintAmt;
      sumVat += vatAmt;
      sumTotal += monthTotal;
    } else if (!isVacant && room.name) {
      totalUnpaidCount++;
    }

    let badgeHtml = "";
    if (isPaid) {
      badgeHtml = `<span style="display:inline-block;padding:2px 6px;background:#000;color:#fff;border-radius:2px;font-size:11px;font-weight:700;">완납</span>`;
    } else if (isVacant) {
      badgeHtml = `<span style="display:inline-block;padding:2px 6px;background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;border-radius:2px;font-size:11px;font-weight:600;">공실</span>`;
    } else {
      badgeHtml = `<span style="display:inline-block;padding:2px 6px;background:#fee2e2;color:#dc2626;border:1px solid #dc2626;border-radius:2px;font-size:11px;font-weight:700;">미납</span>`;
    }

    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #e5e7eb";
    if (!isPaid && !isVacant && room.name) {
      tr.style.background = "#fff8f8";
    } else if (isVacant) {
      tr.style.background = "#fafafa";
    }

    tr.innerHTML = `
      <td style="padding:6px 4px;font-weight:800;border-right:1px solid #e5e7eb;">${p.year}-${String(p.month).padStart(2, '0')}</td>
      <td style="padding:6px 4px;border-right:1px solid #e5e7eb;">${badgeHtml}</td>
      <td style="padding:6px 4px;border-right:1px solid #e5e7eb;color:#555;">${isPaid ? paidDate : '-'}</td>
      <td style="padding:6px 4px;text-align:right;border-right:1px solid #e5e7eb;">${rentAmt > 0 ? rentAmt.toLocaleString() + '원' : '-'}</td>
      <td style="padding:6px 4px;text-align:right;border-right:1px solid #e5e7eb;">${maintAmt > 0 ? maintAmt.toLocaleString() + '원' : '-'}</td>
      <td style="padding:6px 4px;text-align:right;border-right:1px solid #e5e7eb;">${vatDisplay}</td>
      <td style="padding:6px 4px;text-align:right;font-weight:800;background:${isPaid ? '#f8fafc' : '#fff'};">${monthTotal > 0 ? monthTotal.toLocaleString() + '원' : '-'}</td>
    `;
    tbody.appendChild(tr);
  });

  summaryEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:4px;">
      <div><b>임차인:</b> ${tenantName} ${room.phone ? `(${room.phone})` : ''}</div>
      <div><b>과세유형:</b> ${vatTypeDesc}</div>
    </div>
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;color:#333;">
      <div><b>조회기간:</b> ${prevY}년 01월 ~ ${curY}년 ${String(curM).padStart(2, '0')}월 (총 ${periods.length}개월)</div>
      <div><b>수납현황:</b> <span style="color:#166534;font-weight:700;">완납 ${totalPaidCount}회</span> / <span style="color:#dc2626;font-weight:700;">미납 ${totalUnpaidCount}회</span></div>
    </div>
  `;

  tfoot.innerHTML = `
    <tr style="background:#f1f5f9;">
      <td colspan="3" style="padding:8px 4px;text-align:center;"><b>완납 합계 (${totalPaidCount}개월)</b></td>
      <td style="padding:8px 4px;text-align:right;font-weight:800;">${sumRent.toLocaleString()}원</td>
      <td style="padding:8px 4px;text-align:right;font-weight:800;">${sumMaint.toLocaleString()}원</td>
      <td style="padding:8px 4px;text-align:right;font-weight:800;">${sumVat > 0 ? sumVat.toLocaleString() + '원' : (isVatSeparate ? '0원' : '-')}</td>
      <td style="padding:8px 4px;text-align:right;font-weight:900;background:#e0e7ff;color:#1e1b4b;">${sumTotal.toLocaleString()}원</td>
    </tr>
  `;

  openModal("modalPaymentHistory");
}

// ── 호실 상세 수정 모달 ──
function openRoomDetail(roomNum) {
  const r = allRooms.find(x => x.room_number === roomNum);
  if (!r) return;
  document.getElementById("modalRoomTitle").textContent = `${roomNum}호 계약 상세/수정`;
  document.getElementById("rfRoomNumber").value = roomNum;
  document.getElementById("rfName").value = r.name || "";
  document.getElementById("rfPhone").value = r.phone || "";
  document.getElementById("rfIdNumber").value = r.id_number || "";
  document.getElementById("rfDeposit").value = r.deposit || 0;
  document.getElementById("rfRent").value = r.rent || 0;
  document.getElementById("rfMaintenance").value = r.maintenance || 0;
  document.getElementById("rfPayTiming").value = r.pay_timing || "후불";
  document.getElementById("rfVatTarget").checked = (r.vat_target !== false && r.vat_target !== "false");
  document.getElementById("rfVatSeparate").checked = (r.vat_separate === true || r.vat_separate === "true");
  document.getElementById("rfMoveIn").value = r.move_in || "";
  document.getElementById("rfExpiry").value = r.expiry || "";
  document.getElementById("rfMoveOut").value = r.move_out || "";
  openModal("modalRoom");
}

async function saveRoomForm(e) {
  if (e) e.preventDefault();
  const n = document.getElementById("rfRoomNumber").value;
  const vatTarget = document.getElementById("rfVatTarget").checked;
  const vatSeparate = document.getElementById("rfVatSeparate").checked;
  const payload = {
    name: document.getElementById("rfName").value.trim(),
    phone: document.getElementById("rfPhone").value.trim(),
    id_number: document.getElementById("rfIdNumber").value.trim(),
    deposit: Number(document.getElementById("rfDeposit").value),
    rent: Number(document.getElementById("rfRent").value),
    maintenance: Number(document.getElementById("rfMaintenance").value),
    pay_timing: document.getElementById("rfPayTiming").value,
    vat_target: vatTarget,
    vat_separate: vatSeparate,
    vat_included: !vatSeparate,
    move_in: document.getElementById("rfMoveIn").value,
    expiry: document.getElementById("rfExpiry").value,
    move_out: document.getElementById("rfMoveOut").value
  };

  const btn = document.getElementById("btnSaveRoom");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "저장 중... ⏳";
  }

  try {
    const res = await apiFetch(`${API_BASE}/rooms/${n}/contract?branch_id=${curBranch}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP ${res.status}`);
    }

    closeModal("modalRoom");
    const vatDesc = !vatTarget ? "부가세제외(면세)" : (vatSeparate ? "부가세별도(발행)" : "부가세포함");
    setAlert(`✅ [${n}호] 계약 정보가 정상 저장되었습니다. (${vatDesc})`, "success");
    await reloadRooms();
    if (typeof loadVatReport === "function") {
      loadVatReport();
    }
  } catch (err) {
    console.error("계약 저장 실패:", err);
    setAlert(`계약 저장 실패: ${err.message}`, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "계약 정보 저장";
    }
  }
}
