/**
 * apps/rent/frontend/js/api.js
 * MQnet SaaS 표준 모듈화 API 클라이언트 (Clean Architecture)
 * - Base URL 자동 판정 및 인증 헤더 자동 주입
 * - 공통 HttpClient (GET, POST, PUT, PATCH) 기반 중복 코드 제거
 * - 도메인별 네임스페이스 (rooms, payments, expenses, vat, branches, auth)
 * - 기존 개별 함수 100% 하위 호환성 유지
 */

// ── 1. API Base & Auth Helper ──
export function getApiBase(appName = 'rent') {
  // 게이트웨이 통합 포털 및 서브패스 환경에서 항상 /api/rent 단일 진입점 보장
  return `/api/${appName}`;
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

// ── 2. Unified HTTP Client ──
function buildQueryString(params = {}) {
  const entries = Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
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
      if (typeof errData.detail === 'string') {
        errMsg = errData.detail;
      } else if (Array.isArray(errData.detail)) {
        errMsg = errData.detail.map(d => (d.msg || JSON.stringify(d))).join(', ');
      } else if (errData.message) {
        errMsg = errData.message;
      }
    } catch (_) {}
    throw new Error(errMsg);
  }
  return await res.json();
}

export const http = {
  get(endpoint, params = {}) {
    const base = getApiBase('rent');
    return fetchWithAuth(`${base}${endpoint}${buildQueryString(params)}`);
  },
  post(endpoint, data = {}, params = {}) {
    const base = getApiBase('rent');
    return fetchWithAuth(`${base}${endpoint}${buildQueryString(params)}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  put(endpoint, data = {}, params = {}) {
    const base = getApiBase('rent');
    return fetchWithAuth(`${base}${endpoint}${buildQueryString(params)}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  patch(endpoint, data = {}, params = {}) {
    const base = getApiBase('rent');
    return fetchWithAuth(`${base}${endpoint}${buildQueryString(params)}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },
  delete(endpoint, params = {}) {
    const base = getApiBase('rent');
    return fetchWithAuth(`${base}${endpoint}${buildQueryString(params)}`, {
      method: 'DELETE'
    });
  }
};

// ── 3. 도메인별 모듈화 API 서비스 ──

export const roomsApi = {
  list: (branchId = 'main') => http.get('/rooms', { branch_id: branchId }),
  updateContract: (roomNumber, data, branchId = 'main') => http.put(`/rooms/${roomNumber}`, data, { branch_id: branchId }),
  batchImport: (roomsData, branchId = 'main') => http.post('/rooms/batch-import', roomsData, { branch_id: branchId }),
  ocrImport: (imageBase64, branchId = 'main') => http.post('/rooms/ocr-import', { image_base64: imageBase64 }, { branch_id: branchId }),
  fillPayments: (roomNumber = null, branchId = 'main') => http.post('/rooms/fill-payments', { room_number: roomNumber }, { branch_id: branchId }),
  getExpiring: (branchId = 'main', daysWindow = 65) => http.get('/expiring-rooms', { branch_id: branchId, days_window: daysWindow })
};

export const paymentsApi = {
  process: (roomNumber, month, branchId = 'main', paidDate = null, note = '정상 입금', tenantName = null, year = 2026, rentAmount = null, maintenanceAmount = null) =>
    http.post(`/rooms/${roomNumber}/payment`, {
      month,
      year,
      paid_date: paidDate,
      note,
      tenant_name: tenantName,
      rent_amount: rentAmount,
      maintenance_amount: maintenanceAmount
    }, { branch_id: branchId }),
  cancel: (roomNumber, month, branchId = 'main', year = 2026) =>
    http.post(`/rooms/${roomNumber}/cancel-payment`, { month, year }, { branch_id: branchId }),
  matrixImport: (matrixRooms, branchId = 'main') =>
    http.post('/payments/matrix-import', { rooms: matrixRooms }, { branch_id: branchId })
};

export const expensesApi = {
  list: (branchId = 'main') => http.get('/expenses', { branch_id: branchId }),
  create: (data, branchId = 'main') => http.post('/expenses', data, { branch_id: branchId }),
  delete: (expenseId, branchId = 'main') => http.delete(`/expenses/${expenseId}`, { branch_id: branchId })
};

export const historiesApi = {
  list: (branchId = 'main', roomNumber = null) => {
    const params = { branch_id: branchId };
    if (roomNumber) params.room_number = roomNumber;
    return http.get('/tenant-histories', params);
  },
  delete: (historyId, branchId = 'main') =>
    http.delete(`/tenant-histories/${historyId}`, { branch_id: branchId })
};

export const branchesApi = {
  list: (activeOnly = false) => {
    const params = {};
    if (typeof activeOnly === 'boolean') {
      params.active_only = activeOnly;
    }
    return http.get('/branches', params);
  },
  create: (arg1, arg2) => {
    const data = arg2 !== undefined ? arg2 : arg1;
    return http.post('/branches', data);
  },
  update: (arg1, arg2, arg3) => {
    const branchId = arg3 !== undefined ? arg2 : arg1;
    const data = arg3 !== undefined ? arg3 : arg2;
    return http.patch(`/branches/${branchId}`, data);
  },
  delete: (arg1, arg2) => {
    const branchId = arg2 !== undefined ? arg2 : arg1;
    return http.delete(`/branches/${branchId}`);
  },
  updateBilling: (arg1, arg2, arg3, arg4) => {
    const branchId = arg3 !== undefined ? arg2 : arg1;
    const billingStatus = arg3 !== undefined ? arg3 : arg2;
    const lastPaidAt = arg4 || null;
    return http.patch(`/branches/${branchId}/billing`, { billing_status: billingStatus, last_paid_at: lastPaidAt });
  }
};

export const authApi = {
  login: (username, password) => http.post('/auth/admin-login', { username, password }),
  register: (data) => http.post('/auth/register', data),
  getUsers: () => http.get('/auth/users'),
  approveUser: (userId, action, assignedBranchId = null) =>
    http.patch(`/auth/users/${userId}/status`, { action, assigned_branch_id: assignedBranchId }),
  updateUser: (userId, data) => http.patch(`/auth/users/${userId}`, data),
  deleteUser: (userId) => http.delete(`/auth/users/${userId}`),
  requestUpgrade: (data) => http.post('/upgrade-request', data)
};

export const vatApi = {
  getReport: (startMonth = 1, endMonth = 6, year = 2026, branchId = 'main', roomNumbers = null) => {
    const params = { start_month: startMonth, end_month: endMonth, year, branch_id: branchId };
    if (roomNumbers && roomNumbers.length > 0) {
      params.room_numbers = roomNumbers.join(',');
    }
    return http.get('/vat-report', params);
  },
  getSettings: async (branchId = 'main') => {
    try {
      const res = await http.get('/vat-settings', { branch_id: branchId });
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
  },
  saveSettings: async (branchId, targetRooms) => {
    localStorage.setItem(`rent_vat_rooms_${branchId}`, JSON.stringify(targetRooms));
    try {
      return await http.post('/vat-settings', { branch_id: branchId, vat_target_rooms: targetRooms });
    } catch (err) {
      return { success: true, branch_id: branchId, vat_target_rooms: targetRooms, offline: true };
    }
  }
};

// ── 4. 100% 하위 호환용 개별 함수 Exports ──
export const apiGetRooms = roomsApi.list;
export const apiUpdateContract = roomsApi.updateContract;
export const apiBatchImportRooms = roomsApi.batchImport;
export const apiOcrImportImage = roomsApi.ocrImport;
export const apiFillTenantPayments = roomsApi.fillPayments;
export const apiGetExpiringRooms = roomsApi.getExpiring;

export const apiProcessPayment = paymentsApi.process;
export const apiCancelPayment = paymentsApi.cancel;
export const apiBatchImportPaymentMatrix = paymentsApi.matrixImport;

export const apiGetExpenses = expensesApi.list;
export const apiCreateExpense = expensesApi.create;
export const apiDeleteExpense = expensesApi.delete;

export const apiGetTenantHistories = historiesApi.list;
export const apiDeleteTenantHistory = historiesApi.delete;

export const apiGetBranches = branchesApi.list;
export const fetchBranches = branchesApi.list;
export const apiCreateBranch = branchesApi.create;
export const createBranch = branchesApi.create;
export const apiUpdateBranch = branchesApi.update;
export const updateBranch = branchesApi.update;
export const apiDeleteBranch = branchesApi.delete;
export const deleteBranch = branchesApi.delete;
export const apiUpdateBranchBilling = branchesApi.updateBilling;
export const updateBranchBilling = branchesApi.updateBilling;

export const apiAdminLogin = authApi.login;
export const apiRegisterUser = authApi.register;
export const apiGetUsers = authApi.getUsers;
export const apiApproveUser = authApi.approveUser;
export const apiUpdateUser = authApi.updateUser;
export const apiDeleteUser = authApi.deleteUser;
export const apiRequestUpgrade = authApi.requestUpgrade;

export const apiGetVatReport = vatApi.getReport;
export const apiGetVatSettings = vatApi.getSettings;
export const apiSaveVatSettings = vatApi.saveSettings;

export const backupApi = {
  restore: (backupData, targetBranchId = 'main') =>
    http.post('/backup/restore', backupData, { target_branch_id: targetBranchId })
};
export const apiRestoreBackup = backupApi.restore;
