/* gateway/portal/portal.js — 앱 카탈로그를 /api/apps 에서 받아 동적으로 렌더링 */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = Bass.escapeHtml;
  const CATEGORY_LABEL = { all: "전체", business: "비즈니스", education: "교육", iot: "IoT", media: "미디어", utility: "유틸리티", ai: "AI", portal: "포털" };
  const state = { apps: [], health: {}, category: "all", query: "", user: null };

  function healthBadge(appId) {
    const h = state.health[appId];
    if (!h) return `<span class="bass-badge">확인 중</span>`;
    if (h.status === "HEALTHY") return `<span class="bass-badge bass-badge--ok">정상</span>`;
    return `<span class="bass-badge bass-badge--warn" title="${esc(h.reason || "")}">${esc(h.status)}</span>`;
  }

  function matches(a) {
    if (state.category !== "all" && a.category !== state.category) return false;
    if (!state.query) return true;
    const hay = [a.app_name, a.app_id, a.description, ...(a.features || [])].join(" ").toLowerCase();
    return hay.includes(state.query);
  }

  function renderApps() {
    const list = state.apps.filter(matches);
    $("app-grid").innerHTML = list.map((a, i) => `
      <article class="bass-card is-interactive app-card bass-reveal" style="animation-delay:${i * 50}ms" id="app-card-${esc(a.app_id)}">
        <div class="app-card__top"><div class="app-card__icon">${esc(a.icon)}</div>${healthBadge(a.app_id)}</div>
        <div><h3>${esc(a.app_name)}</h3>
          <div class="app-card__meta">${esc(CATEGORY_LABEL[a.category] || a.category)} · <code>${esc(a.api_path)}</code> · v${esc(a.version)}</div></div>
        <p>${esc(a.description || "설명이 없습니다.")}</p>
        <div class="features">${(a.features || []).map((f) => `<span class="feature">${esc(f)}</span>`).join("")}</div>
        <div class="bass-row">
          ${a.route_path ? `<a class="bass-btn bass-btn--primary" href="${esc(a.route_path)}" id="open-${esc(a.app_id)}">열기 →</a>` : `<span class="bass-muted">API 전용 앱</span>`}
          ${a.manual_path ? `<a class="bass-btn bass-btn--ghost" href="${esc(a.manual_path)}">📘 매뉴얼</a>` : ""}
        </div>
      </article>`).join("");
    $("empty-state").hidden = list.length > 0;
  }

  function renderChips() {
    const cats = ["all", ...new Set(state.apps.map((a) => a.category))];
    $("category-chips").innerHTML = cats.map((c) =>
      `<button class="chip" role="tab" data-cat="${esc(c)}" aria-selected="${c === state.category}" id="chip-${esc(c)}">${esc(CATEGORY_LABEL[c] || c)}</button>`).join("");
  }

  function renderIsolated(failed) {
    $("isolated-panel").hidden = failed.length === 0;
    $("isolated-list").innerHTML = failed.map((f) => `
      <div class="isolated__item"><b>apps/${esc(f.folder)}</b> · 실패 단계 <code>${esc(f.stage)}</code><br>
        <code>${esc(f.reason)}</code></div>`).join("");
  }

  async function loadCatalog() {
    try {
      const [catalog, health] = await Promise.all([Bass.request("/api/apps"), Bass.request("/api/health")]);
      state.apps = catalog.apps;
      state.health = health.apps;
      const healthy = Object.values(health.apps).filter((h) => h.status === "HEALTHY").length;
      $("kpi-apps").textContent = catalog.total;
      $("kpi-healthy").textContent = healthy;
      $("kpi-isolated").textContent = catalog.failed.length;
      $("kpi-disabled").textContent = catalog.disabled.length;
      const badge = $("platform-badge");
      badge.className = `bass-badge ${health.status === "HEALTHY" ? "bass-badge--ok" : "bass-badge--warn"} bass-badge--pulse`;
      badge.textContent = health.status === "HEALTHY" ? "모든 시스템 정상" : "일부 앱 점검 필요";
      renderChips(); renderApps(); renderIsolated(catalog.failed);
      if (catalog.failed.length) {
        Bass.updateAppAlert("warning", `${catalog.failed.length}개 앱이 격리되어 있습니다. 나머지 앱은 정상 운영 중입니다.`, "아래 '격리된 앱' 패널에서 원인을 확인하세요.");
      }
    } catch (err) {
      $("app-grid").innerHTML = "";
      $("platform-badge").className = "bass-badge bass-badge--err";
      $("platform-badge").textContent = "게이트웨이 연결 실패";
      Bass.showError(err);
    }
  }

  async function loadTimeline() {
    if (!state.user || !["superadmin", "admin"].includes(state.user.role)) return;
    try {
      const data = await Bass.request("/api/timeline?limit=40");
      $("timeline-list").innerHTML = data.events.length ? data.events.map((e) => `
        <li><time>${esc(e.at.slice(5, 16).replace("T", " "))}</time>
          <span><b>${esc(e.kind)}</b> · ${esc(e.action)} · <span class="bass-muted">${esc(e.actor)}</span><br>${esc(e.detail.summary || "")}</span></li>`).join("")
        : "<li class='bass-muted'>아직 기록된 변경이 없습니다.</li>";
    } catch (err) { Bass.showError(err); }
  }

  function renderUser() {
    const chip = $("user-chip");
    if (state.user) {
      chip.hidden = false;
      chip.textContent = `👤 ${state.user.name || state.user.username} · ${state.user.role}`;
      $("login-open").textContent = "로그아웃";
      $("timeline-refresh").hidden = false;
    } else {
      chip.hidden = true;
      $("login-open").textContent = "로그인";
      $("timeline-refresh").hidden = true;
      $("timeline-list").innerHTML = "<li class='bass-muted'>관리자로 로그인하면 전체 앱의 변경 이력을 볼 수 있습니다.</li>";
    }
  }

  async function restoreSession() {
    if (!Bass.token()) return renderUser();
    try { state.user = (await Bass.request("/auth/me")).user; }
    catch (_) { Bass.setToken(""); state.user = null; }
    renderUser();
    await loadTimeline();
  }

  // ── 이벤트 ──
  $("search").addEventListener("input", (e) => { state.query = e.target.value.trim().toLowerCase(); renderApps(); });
  $("category-chips").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-cat]");
    if (!chip) return;
    state.category = chip.dataset.cat; renderChips(); renderApps();
  });
  $("copy-cmd").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("create-cmd").textContent);
      Bass.updateAppAlert("success", "명령을 클립보드에 복사했습니다.", "BassSaasApp 폴더에서 터미널에 붙여넣어 실행하세요.");
    } catch (_) {
      Bass.updateAppAlert("warning", "브라우저가 클립보드 접근을 막았습니다.", "명령을 직접 드래그해서 복사해 주세요.");
    }
  });
  $("login-open").addEventListener("click", () => {
    if (state.user) { Bass.setToken(""); state.user = null; renderUser(); Bass.updateAppAlert("success", "로그아웃했습니다."); return; }
    $("login-dialog").showModal();
  });
  $("login-form").addEventListener("submit", async (e) => {
    if (e.submitter && e.submitter.value === "cancel") return;
    e.preventDefault();
    await Bass.withLock($("login-submit"), async () => {
      const res = await Bass.request("/auth/login", { method: "POST",
        body: { username: $("login-username").value, password: $("login-password").value } });
      Bass.setToken(res.token); state.user = res.user;
      $("login-dialog").close(); $("login-password").value = "";
      renderUser();
      Bass.updateAppAlert("success", `${res.user.name || res.user.username}님, 환영합니다.`, "앱 화면에서도 관리자 기능이 활성화됩니다.");
      await loadTimeline();
    }, "확인 중... ⏳");
  });
  $("timeline-refresh").addEventListener("click", () => Bass.withLock($("timeline-refresh"), loadTimeline, "…"));

  loadCatalog();
  restoreSession();
})();
