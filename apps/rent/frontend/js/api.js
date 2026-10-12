/**
 * apps/rent/frontend/js/api.js
 * MQnet SaaS 표준 동적 API Base URL 판정 및 백엔드(integrat.db) 통신 클라이언트.
 * 오프라인/로컬 실행 시 localStorage 자동 폴백 지원.
 */

export function getApiBase(appName = 'rent') {
  const p = window.location.pathname.toLowerCase();
  if (p.startsWith(`/${appName.toLowerCase()}`)) {
    return `/api/${appName}`;
  }
  return '/api';
}

export function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'X-App-ID': 'rent'
  };
  const token = localStorage.getItem('mqnet_auth_token') || sessionStorage.getItem('mqnet_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchWithAuth(url, options = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {})
  };
  const sep = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${sep}_t=${Date.now()}`;

  const res = await fetch(fullUrl, {
    ...options,
    headers,
    cache: 'no-store'
  });

  if (!res.ok) {
    let errMsg = `HTTP Error ${res.status}`;
    try {
      const errData = await res.json();
      errMsg = errData.detail || errData.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }
  return await res.json();
}

// ── 핵심 원룸 API ──
export async function apiGetRooms(branchId = 'main') {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/rooms?branch_id=${encodeURIComponent(branchId)}`);
}

export async function apiUpdateContract(roomNumber, data, branchId = 'main') {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/rooms/${roomNumber}?branch_id=${encodeURIComponent(branchId)}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function apiBatchImportRooms(roomsData, branchId = 'main') {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/rooms/batch-import?branch_id=${encodeURIComponent(branchId)}`, {
    method: 'POST',
    body: JSON.stringify(roomsData)
  });
}

export async function apiOcrImportImage(imageBase64, branchId = 'main') {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/rooms/ocr-import?branch_id=${encodeURIComponent(branchId)}`, {
    method: 'POST',
    body: JSON.stringify({ image_base64: imageBase64 })
  });
}

export async function apiProcessPayment(roomNumber, month, branchId = 'main', paidDate = null, note = '정상 입금', tenantName = null) {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/rooms/${roomNumber}/payment?branch_id=${encodeURIComponent(branchId)}`, {
    method: 'POST',
    body: JSON.stringify({ month, paid_date: paidDate, note, tenant_name: tenantName })
  });
}

export async function apiCancelPayment(roomNumber, month, branchId = 'main') {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/rooms/${roomNumber}/cancel-payment?branch_id=${encodeURIComponent(branchId)}`, {
    method: 'POST',
    body: JSON.stringify({ month })
  });
}

export async function apiGetExpenses(branchId = 'main') {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/expenses?branch_id=${encodeURIComponent(branchId)}`);
}

export async function apiCreateExpense(data, branchId = 'main') {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/expenses?branch_id=${encodeURIComponent(branchId)}`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// ── 전출자 1년 보존 이력 API ──
export async function apiGetTenantHistories(branchId = 'main', roomNumber = null) {
  const base = getApiBase('rent');
  const roomQuery = roomNumber ? `&room_number=${roomNumber}` : '';
  return await fetchWithAuth(`${base}/tenant-histories?branch_id=${encodeURIComponent(branchId)}${roomQuery}`);
}

// ── 다중 건물/지점 API ──
export async function apiGetBranches(activeOnly = false) {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/branches?active_only=${activeOnly}`);
}

export async function apiCreateBranch(data) {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/branches`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function apiUpdateBranchBilling(branchId, billingStatus, lastPaidAt = null) {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/branches/${branchId}/billing`, {
    method: 'PATCH',
    body: JSON.stringify({ billing_status: billingStatus, last_paid_at: lastPaidAt })
  });
}

// ── 관리자 로그인 & 등업 신청 ──
export async function apiAdminLogin(username, password) {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/auth/admin-login`, {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function apiRequestUpgrade(data) {
  const base = getApiBase('rent');
  return await fetchWithAuth(`${base}/upgrade-request`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// ── 부가가치세(VAT) 기간별 수납 집계 API ──
export async function apiGetVatReport(startMonth = 1, endMonth = 6, year = 2026, branchId = 'main', roomNumbers = null) {
  const base = getApiBase('rent');
  let url = `${base}/vat-report?start_month=${startMonth}&end_month=${endMonth}&year=${year}&branch_id=${encodeURIComponent(branchId)}`;
  if (roomNumbers && roomNumbers.length > 0) {
    url += `&room_numbers=${encodeURIComponent(roomNumbers.join(','))}`;
  }
  return await fetchWithAuth(url);
}

export async function apiGetVatSettings(branchId = 'main') {
  const base = getApiBase('rent');
  try {
    const res = await fetchWithAuth(`${base}/vat-settings?branch_id=${encodeURIComponent(branchId)}`);
    if (res && res.vat_target_rooms) {
      localStorage.setItem(`rent_vat_rooms_${branchId}`, JSON.stringify(res.vat_target_rooms));
    }
    return res;
  } catch (err) {
    const cached = localStorage.getItem(`rent_vat_rooms_${branchId}`);
    if (cached) {
      try {
        return { success: true, branch_id: branchId, vat_target_rooms: JSON.parse(cached) };
      } catch (_) {}
    }
    throw err;
  }
}

export async function apiSaveVatSettings(branchId, targetRooms) {
  const base = getApiBase('rent');
  localStorage.setItem(`rent_vat_rooms_${branchId}`, JSON.stringify(targetRooms));
  try {
    return await fetchWithAuth(`${base}/vat-settings`, {
      method: 'POST',
      body: JSON.stringify({ branch_id: branchId, vat_target_rooms: targetRooms })
    });
  } catch (err) {
    // 로컬/오프라인 환경에서도 저장은 유지되도록 fallback 반환
    return { success: true, branch_id: branchId, vat_target_rooms: targetRooms, offline: true };
  }
}


