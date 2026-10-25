/**
 * apps/rent2/frontend/js/core.js
 * 전역 상태, 토큰 인증, 안내 배너(Alert UX), 통합 API 클라이언트, 탭 및 모달 유틸리티.
 */

// ── 전역 상태 ──
let curBranch = "main";
let allRooms = [];
let curFilter = "all";
let scanBase64 = "";
let currentUser = null;

const API_BASE = "/api/rent2";

// ── 토큰 관리 ──
function getToken() {
  return localStorage.getItem("rent2_token") || "";
}

function setToken(tok) {
  if (tok) {
    localStorage.setItem("rent2_token", tok);
  } else {
    localStorage.removeItem("rent2_token");
  }
}

// ── 안내 배너 (Banner Alert UX) ──
function setAlert(msg, type = "info") {
  const el = document.getElementById("appAlert");
  if (!el) return;
  if (!msg) { el.style.display = "none"; return; }
  el.style.display = "block";
  el.textContent = msg;
  el.style.background = type === "error" ? "#000" : (type === "success" ? "#fff" : (type === "warning" ? "#fff8e1" : "#f4f4f4"));
  el.style.color = type === "error" ? "#fff" : "#000";
  el.style.borderColor = "#000";
}

// ── 모달 전용 인라인 배너 ──
function setLoginAlert(msg, type = "info") {
  const el = document.getElementById("loginAlert");
  if (!el) return;
  if (!msg) { el.style.display = "none"; return; }
  el.style.display = "block";
  el.textContent = msg;
  
  if (type === "error") {
    el.style.background = "#fef2f2";
    el.style.color = "#991b1b";
    el.style.border = "1px solid #f87171";
  } else if (type === "success") {
    el.style.background = "#f0fdf4";
    el.style.color = "#166534";
    el.style.border = "1px solid #4ade80";
  } else if (type === "warning") {
    el.style.background = "#fffbeb";
    el.style.color = "#92400e";
    el.style.border = "1px solid #fcd34d";
  } else {
    el.style.background = "#eff6ff";
    el.style.color = "#1e40af";
    el.style.border = "1px solid #93c5fd";
  }
}

// ── 통합 API 클라이언트 (JWT 헤더 자동 주입 & 401/403 차단 안내) ──
async function apiFetch(url, options = {}) {
  options.headers = options.headers || {};
  const token = getToken();
  if (token) {
    options.headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, options);

    if (res.status === 401) {
      setAlert("🔐 로그인이 필요하거나 세션이 만료되었습니다. 다시 로그인해 주세요.", "warning");
      currentUser = null;
      updateAuthUI(null);
      openModal("modalLogin");
      return res;
    }

    if (res.status === 403) {
      let detail = "접근 거부: 본인 소속 건물 외 타 건물의 정보에는 접근할 수 없습니다.";
      try {
        const errData = await res.clone().json();
        if (errData && errData.detail) detail = errData.detail;
      } catch (_) {}
      setAlert(`🚫 ${detail}`, "error");
      return res;
    }

    return res;
  } catch (err) {
    console.error("apiFetch 통신 실패:", err);
    throw err;
  }
}

// ── 인증 상태 UI 동기화 ──
function updateAuthUI(user) {
  const badge = document.getElementById("userBadge");
  const btn = document.getElementById("btnAuthAction");
  const sel = document.getElementById("branchSelect");

  if (user) {
    const icon = user.role === "superadmin" ? "👑" : "🏢";
    if (badge) {
      badge.textContent = `${icon} ${user.username}`;
      badge.title = `${user.role === "superadmin" ? "본사총괄" : "지점관리자"} (${user.username})`;
    }
    if (btn) {
      btn.textContent = "로그아웃";
      btn.onclick = logout;
    }
    if (sel) {
      if (user.role !== "superadmin") {
        sel.disabled = true;
        sel.title = "소속 건물 고정";
        const tabBr = document.getElementById("tabBranches");
        if (tabBr) tabBr.style.display = "none";
      } else {
        sel.disabled = false;
        sel.title = "건물 전환";
        const tabBr = document.getElementById("tabBranches");
        if (tabBr) tabBr.style.display = "inline-block";
      }
    }
  } else {
    if (badge) badge.textContent = "로그인";
    if (btn) {
      btn.textContent = "로그인";
      btn.onclick = () => openModal("modalLogin");
    }
    if (sel) {
      sel.disabled = true;
    }
    const tabBr = document.getElementById("tabBranches");
    if (tabBr) tabBr.style.display = "none";
  }
}

function handleAuthButtonClick() {
  if (currentUser) {
    logout();
  } else {
    openModal("modalLogin");
  }
}

// ── 세션 복원 및 검증 ──
async function restoreSession() {
  const tok = getToken();
  if (!tok) {
    updateAuthUI(null);
    openModal("modalLogin");
    return false;
  }
  try {
    const res = await apiFetch(`${API_BASE}/auth/me`);
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      updateAuthUI(currentUser);
      return true;
    }
  } catch (err) {
    console.warn("세션 검증 통신 오류", err);
  }
  updateAuthUI(null);
  openModal("modalLogin");
  return false;
}

// ── 로그인 제출 처리 ──
async function handleLoginSubmit(event) {
  if (event) event.preventDefault();
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  const submitBtn = document.getElementById("btnLoginSubmit");
  const quickBtns = document.querySelectorAll("#modalLogin .btn-outline");

  const username = usernameInput ? usernameInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value.trim() : "";
  if (!username) {
    setLoginAlert("⚠️ 아이디를 입력해 주세요.", "warning");
    if (usernameInput) usernameInput.focus();
    return;
  }
  if (!password) {
    setLoginAlert("⚠️ 비밀번호를 입력해 주세요.", "warning");
    if (passwordInput) passwordInput.focus();
    return;
  }

  // 중복 클릭 방지 (Debounce) 및 로딩 상태 부여
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "로그인 확인 중... ⏳";
  }
  quickBtns.forEach(b => { b.disabled = true; });
  setLoginAlert("로그인 인증 확인 중입니다...", "info");

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errMsg = err.detail || "아이디 또는 비밀번호가 올바르지 않습니다.";
      setLoginAlert(`❌ 로그인 실패: ${errMsg}`, "error");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "로그인";
      }
      quickBtns.forEach(b => { b.disabled = false; });
      return;
    }

    const data = await res.json();
    setToken(data.access_token);
    currentUser = data.user;
    updateAuthUI(currentUser);

    const displayName = currentUser.name || currentUser.username;
    const branchName = currentUser.branch_name || currentUser.branch || "본사";
    setLoginAlert(`✅ 로그인 성공: ${displayName}님 환영합니다!`, "success");

    setTimeout(async () => {
      closeModal("modalLogin");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "로그인";
      }
      quickBtns.forEach(b => { b.disabled = false; });
      setAlert(`✅ 로그인 성공: ${displayName}님 환영합니다. (소속: ${branchName})`, "success");

      try {
        await loadBranches();
        await reloadRooms();
      } catch (err) {
        console.error("로그인 후 데이터 로드 오류:", err);
      }
    }, 350);

  } catch (err) {
    console.error("로그인 네트워크 오류:", err);
    setLoginAlert("❌ 서버 통신 오류: 네트워크 연결 상태를 확인해 주세요.", "error");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "로그인";
    }
    quickBtns.forEach(b => { b.disabled = false; });
  }
}

// ── 빠른 테스트 계정 원클릭 로그인 ──
async function quickLogin(user, pass) {
  const u = document.getElementById("loginUsername");
  const p = document.getElementById("loginPassword");
  if (u) u.value = user;
  if (p) p.value = pass;
  setLoginAlert(`⚡ ${user} 계정으로 원클릭 로그인 진행 중...`, "info");
  await handleLoginSubmit();
}

// ── 로그아웃 ──
function logout() {
  setToken(null);
  currentUser = null;
  updateAuthUI(null);
  allRooms = [];
  renderRooms();
  document.getElementById("statPaid").textContent = "-";
  document.getElementById("statPaidAmount").textContent = "0원";
  document.getElementById("statUnpaid").textContent = "-";
  document.getElementById("statUnpaidAmount").textContent = "0원";
  document.getElementById("statExpiring").textContent = "-";
  document.getElementById("statVacant").textContent = "-";
  document.getElementById("statTotalRooms").textContent = "0개실";
  setAlert("로그아웃 되었습니다. 지점 관리자 계정으로 로그인해 주세요.", "info");
  openModal("modalLogin");
}

// ── 지점 목록 로드 (권한별 필터링 자동 반영) ──
async function loadBranches() {
  try {
    const res = await apiFetch(`${API_BASE}/branches`);
    if (!res.ok) return;
    const data = await res.json();
    const sel = document.getElementById("branchSelect");
    sel.innerHTML = "";
    const branches = data.branches || [];

    branches.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.branch_id;
      opt.textContent = b.name;
      sel.appendChild(opt);
    });

    if (branches.length > 0) {
      if (currentUser && currentUser.role !== "superadmin") {
        const targetBid = currentUser.branch || branches[0].branch_id;
        sel.value = targetBid;
        curBranch = targetBid;
        sel.disabled = true;
      } else {
        sel.disabled = false;
        if (!branches.some(b => b.branch_id === curBranch)) {
          curBranch = branches[0].branch_id;
        }
        sel.value = curBranch;
      }
    }
  } catch (err) {
    console.error("지점 로드 실패", err);
  }
}

function switchBranch(bid) {
  if (currentUser && currentUser.role !== "superadmin" && bid !== currentUser.branch) {
    setAlert("🚫 타 건물의 정보는 접근할 수 없습니다.", "error");
    return;
  }
  curBranch = bid;
  reloadRooms();
  if (document.getElementById("secTax").style.display !== "none") {
    loadVatReport();
    loadIncomeTax();
  }
  if (document.getElementById("secExpenses").style.display !== "none") {
    loadExpenses();
  }
}

// ── 탭 전환 ──
function setTab(name) {
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
  const tabBtn = document.getElementById(`tab${name.charAt(0).toUpperCase() + name.slice(1)}`);
  if (tabBtn) tabBtn.classList.add("active");
  else if (window.event && window.event.target && window.event.target.classList.contains("nav-tab")) {
    window.event.target.classList.add("active");
  }

  // AI 탭을 벗어날 때 브리핑 카드와 탭 네비게이션 복구
  if (name !== "ai") {
    const stats = document.querySelector(".stats-grid");
    const navTabs = document.querySelector(".nav-tabs");
    if (stats) stats.style.display = "grid";
    if (navTabs) navTabs.style.display = "flex";
  }

  document.getElementById("secRooms").style.display = name === "rooms" ? "block" : "none";
  document.getElementById("secTax").style.display = name === "tax" ? "block" : "none";
  document.getElementById("secExpenses").style.display = name === "expenses" ? "block" : "none";
  document.getElementById("secAI").style.display = name === "ai" ? "block" : "none";
  const secBr = document.getElementById("secBranches");
  if (secBr) secBr.style.display = name === "branches" ? "block" : "none";

  if (name === "ai") {
    const branchSel = document.getElementById("branchSelect");
    const badge = document.getElementById("aiBranchBadge");
    if (badge && branchSel && branchSel.selectedIndex >= 0) {
      const rawText = branchSel.options[branchSel.selectedIndex].text || "";
      const shortName = rawText.split(" ")[0].replace(/[0-9호점\(\),]/g, "").trim() || "시크빌";
      badge.textContent = shortName;
    }
    if (typeof scrollAIChatToBottom === "function") {
      setTimeout(scrollAIChatToBottom, 50);
    }
  }

  if (name === "tax") { loadVatReport(); loadIncomeTax(); }
  if (name === "expenses") { loadExpenses(); }
  if (name === "branches") { loadAdminBranches(); }
}

// ── 모달 유틸 ──
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("open");
    if (id === "modalLogin") {
      setLoginAlert("", "info");
      setTimeout(() => {
        const u = document.getElementById("loginUsername");
        if (u) {
          u.focus();
          u.select();
        }
      }, 60);
    }
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
  if (id === "modalPaste" && typeof reloadRooms === "function") {
    reloadRooms();
  }
}

// ── 초기 기동 ──
window.addEventListener("DOMContentLoaded", async () => {
  const expDateEl = document.getElementById("expDate");
  if (expDateEl) expDateEl.value = new Date().toISOString().slice(0, 10);
  const authenticated = await restoreSession();
  if (authenticated) {
    await loadBranches();
    await reloadRooms();
  }
});
