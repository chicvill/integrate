/**
 * MQnet 임차관리 rent2 - 세무 & 지출 모듈 (tax.js)
 * - 부가가치세 신고 리포트 (1기/2기, 호실별, 월별 매트릭스)
 * - 부가세 엑셀 / 홈택스 양식 다운로드
 * - 종합소득세 필요경비 집계 및 적격증빙 내역
 * - 지출 장부 (간이영수증, 세금계산서, 신용카드 등) CRUD
 */

// ── [세무 리포트] 부가세 및 종합소득세 ──
async function loadVatReport() {
  const pEl = document.getElementById("vatPeriod");
  const p = pEl ? pEl.value : "1";
  const sm = p === "1" ? 1 : 7;
  const em = p === "1" ? 6 : 12;
  const yrEl = document.getElementById("vatYear");
  const yr = yrEl ? parseInt(yrEl.value, 10) : (new Date().getFullYear() - 1);

  try {
    const res = await apiFetch(`${API_BASE}/vat-report?branch_id=${curBranch}&start_month=${sm}&end_month=${em}&year=${yr}`);
    if (!res.ok) return;
    const data = await res.json();
    const totEl = document.getElementById("vatTotalCollected");
    const supEl = document.getElementById("vatSupply");
    const taxEl = document.getElementById("vatTax");
    if (totEl) totEl.textContent = `${(data.total_collected || 0).toLocaleString()}원`;
    if (supEl) supEl.textContent = `${(data.total_supply || 0).toLocaleString()}원`;
    if (taxEl) taxEl.textContent = `${(data.total_vat || 0).toLocaleString()}원`;

    const months = data.months || (p === "1" ? [1,2,3,4,5,6] : [7,8,9,10,11,12]);
    const thead = document.querySelector("#vatTable thead");
    const tbody = document.querySelector("#vatTable tbody");
    const tfoot = document.getElementById("vatTableFoot");

    if (!thead || !tbody) return;

    // 1. 헤더 월별 컬럼 동적 반영 (연도.월 표기: 2025.07)
    const monthThs = months.map(m => `<th class="center" style="min-width:78px;">${yr}.${String(m).padStart(2, '0')}</th>`).join("");
    thead.innerHTML = `
      <tr id="vatTableHeadRow">
        <th class="center" style="min-width:44px;">호실</th>
        <th class="center" style="min-width:60px;">임차인</th>
        <th class="center" style="min-width:44px;">유형</th>
        <th class="center" style="min-width:48px;">부가세</th>
        ${monthThs}
        <th class="center" style="min-width:82px;background:#e9ecef;">납입합계</th>
        <th class="center" style="min-width:82px;">공급가액</th>
        <th class="center" style="min-width:76px;">세액(10%)</th>
      </tr>
    `;

    // 2. 바디 렌더링
    tbody.innerHTML = "";
    const rows = data.rows || [];
    if (!rows.length) {
      const colSpan = 4 + months.length + 3;
      tbody.innerHTML = `<tr><td colspan="${colSpan}" class="center" style="padding:24px;color:#666;">해당 기간의 부가가치세 신고 내역이 없습니다.</td></tr>`;
      if (tfoot) tfoot.innerHTML = "";
      return;
    }

    const monthSums = {};
    months.forEach(m => { monthSums[m] = 0; });

    rows.forEach(r => {
      const tr = document.createElement("tr");
      const mAmounts = r.monthly_amounts || {};
      const monthTds = months.map(m => {
        const val = mAmounts[m] || 0;
        monthSums[m] += val;
        return `<td class="num">${val > 0 ? val.toLocaleString() + '원' : '-'}</td>`;
      }).join("");

      const vLabel = r.vat_label || "포함";
      let vBadge = `<span style="display:inline-block;padding:1px 5px;background:#f1f5f9;color:#334155;border-radius:2px;font-size:10.5px;font-weight:700;">포함</span>`;
      if (vLabel.includes("별도")) {
        vBadge = `<span style="display:inline-block;padding:1px 5px;background:#166534;color:#fff;border-radius:2px;font-size:10.5px;font-weight:700;">별도(발행)</span>`;
      } else if (vLabel.includes("제외") || vLabel.includes("면세")) {
        vBadge = `<span style="display:inline-block;padding:1px 5px;border:1px solid #94a3b8;color:#64748b;border-radius:2px;font-size:10.5px;font-weight:700;">제외(면세)</span>`;
      }

      tr.innerHTML = `
        <td class="center"><b>${r.room_number}</b></td>
        <td class="center">${r.tenant_name || "-"}</td>
        <td class="center">${r.lease_type || "월세"}</td>
        <td class="center">${vBadge}</td>
        ${monthTds}
        <td class="num" style="font-weight:800;background:#fafafa;">${(r.period_total || 0).toLocaleString()}원</td>
        <td class="num">${(r.supply_value || 0).toLocaleString()}원</td>
        <td class="num">${(r.vat_value || 0).toLocaleString()}원</td>
      `;
      tbody.appendChild(tr);
    });

    // 3. 하단 월별 합계행
    if (tfoot) {
      const monthSumTds = months.map(m => `<td class="num" style="font-weight:800;">${monthSums[m].toLocaleString()}원</td>`).join("");
      tfoot.innerHTML = `
        <tr style="background:#f2f2f2;font-weight:800;border-top:2px solid #000;">
          <td class="center">합계</td>
          <td class="center">${rows.length}개실</td>
          <td class="center">-</td>
          <td class="center">-</td>
          ${monthSumTds}
          <td class="num" style="font-weight:900;background:#e9ecef;">${(data.total_collected || 0).toLocaleString()}원</td>
          <td class="num" style="font-weight:900;">${(data.total_supply || 0).toLocaleString()}원</td>
          <td class="num" style="font-weight:900;">${(data.total_vat || 0).toLocaleString()}원</td>
        </tr>
      `;
    }
  } catch (err) {
    console.error("부가세 로드 실패", err);
  }
}

function downloadVat(fmt) {
  const pEl = document.getElementById("vatPeriod");
  const p = pEl ? pEl.value : "1";
  const yrEl = document.getElementById("vatYear");
  const yr = yrEl ? yrEl.value : (new Date().getFullYear() - 1);
  const sm = p === "1" ? 1 : 7, em = p === "1" ? 6 : 12;
  const token = getToken();
  window.open(`${API_BASE}/vat-report/download?branch_id=${curBranch}&start_month=${sm}&end_month=${em}&year=${yr}&format_type=${fmt}&token=${encodeURIComponent(token)}`);
}

async function loadIncomeTax() {
  const yrEl = document.getElementById("taxYear");
  const yr = yrEl ? yrEl.value : new Date().getFullYear();
  try {
    const res = await apiFetch(`${API_BASE}/tax/income-tax?branch_id=${curBranch}&year=${yr}`);
    if (!res.ok) return;
    const data = await res.json();
    const rentEl = document.getElementById("taxRentIncome");
    const expEl = document.getElementById("taxExpense");
    const netEl = document.getElementById("taxNetIncome");
    if (rentEl) rentEl.textContent = `${(data.total_rent_income || 0).toLocaleString()}원`;
    if (expEl) expEl.textContent = `${(data.total_expense || 0).toLocaleString()}원`;
    if (netEl) netEl.textContent = `${(data.net_income || 0).toLocaleString()}원`;

    const tb = document.querySelector("#taxReceiptTable tbody");
    if (tb) {
      tb.innerHTML = "";
      for (const [k, v] of Object.entries(data.by_receipt || {})) {
        const tr = document.createElement("tr");
        const note = ["세금계산서", "신용카드", "현금영수증"].includes(k) ? "적격증빙" : (k === "간이영수증" ? "3만원 초과 시 가산세" : "-");
        tr.innerHTML = `<td><b>${k}</b></td><td class="num">${(v || 0).toLocaleString()}원</td><td>${note}</td>`;
        tb.appendChild(tr);
      }
    }
  } catch (err) {
    console.error("종소세 로드 실패", err);
  }
}

function downloadIncomeTax(fmt) {
  const yrEl = document.getElementById("taxYear");
  const yr = yrEl ? yrEl.value : new Date().getFullYear();
  const token = getToken();
  window.open(`${API_BASE}/tax/income-tax/${fmt}?branch_id=${curBranch}&year=${yr}&token=${encodeURIComponent(token)}`);
}

// ── 지출 장부 ──
async function loadExpenses() {
  try {
    const res = await apiFetch(`${API_BASE}/expenses?branch_id=${curBranch}`);
    if (!res.ok) return;
    const data = await res.json();
    const tb = document.querySelector("#expensesTable tbody");
    if (!tb) return;
    tb.innerHTML = "";
    (data.expenses || []).forEach(e => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${e.date}</td>
        <td><b>${e.item}</b></td>
        <td class="num">${(e.amount || 0).toLocaleString()}원</td>
        <td>${e.receipt_type || "간이영수증"}</td>
        <td>${e.note || ""}</td>
        <td><button class="btn-sm btn-outline" onclick="deleteExpense('${e.id}')">삭제</button></td>
      `;
      tb.appendChild(tr);
    });
  } catch (err) {
    console.error("지출 로드 실패", err);
  }
}

async function saveExpense(e) {
  if (e && e.preventDefault) e.preventDefault();
  const payload = {
    date: document.getElementById("expDate")?.value,
    item: document.getElementById("expItem")?.value.trim(),
    amount: Number(document.getElementById("expAmount")?.value || 0),
    receipt_type: document.getElementById("expReceiptType")?.value,
    note: document.getElementById("expNote")?.value.trim()
  };
  try {
    const res = await apiFetch(`${API_BASE}/expenses?branch_id=${curBranch}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) return;
    closeModal("modalExpense");
    setAlert("지출 전표가 등록되었습니다.", "success");
    loadExpenses();
  } catch (err) {
    setAlert("지출 등록 실패", "error");
  }
}

async function deleteExpense(eid) {
  if (!confirm("지출 내역을 삭제하시겠습니까?")) return;
  try {
    const res = await apiFetch(`${API_BASE}/expenses/${eid}?branch_id=${curBranch}`, { method: "DELETE" });
    if (!res.ok) return;
    loadExpenses();
  } catch (err) {
    setAlert("삭제 실패", "error");
  }
}
