/* apps/laundry/frontend/app.js — 무인빨래방 화면 로직 */
(() => {
  "use strict";
  const APP = "laundry";
  const $ = (id) => document.getElementById(id);
  const esc = Bass.escapeHtml;
  const STATUS = {
    IDLE: { label: "사용 가능", badge: "ok" },
    RUNNING: { label: "가동 중", badge: "info" },
    DONE: { label: "수거 대기", badge: "warn" },
    BROKEN: { label: "점검 중", badge: "err" },
  };
  let courses = {};
  let selected = null;

  async function checkAdmin() {
    if (!Bass.token()) return;
    try {
      const me = await Bass.request("/auth/me");
      document.body.classList.toggle("is-admin", ["superadmin", "admin"].includes(me.user.role));
    } catch (_) { Bass.setToken(""); }
  }

  function progressOf(m) {
    if (m.status === "DONE") return 100;
    if (m.status !== "RUNNING" || !m.started_at || !m.ends_at) return 0;
    const s = new Date(m.started_at).getTime(), e = new Date(m.ends_at).getTime();
    return Math.min(100, Math.max(0, ((Date.now() - s) / (e - s)) * 100));
  }

  function infoOf(m) {
    if (m.status === "RUNNING") return `<strong>${esc(m.course_name)}</strong><br>약 ${m.remaining_minutes}분 남음`;
    if (m.status === "DONE") return `<strong>${esc(m.course_name)} 완료</strong><br>세탁물을 꺼내 주세요${m.phone_tail ? ` · ****${esc(m.phone_tail)}` : ""}`;
    if (m.status === "BROKEN") return `<strong>점검 중</strong><br>${esc(m.broken_reason)}`;
    return "<strong>바로 사용 가능</strong><br>눌러서 코스 선택";
  }

  function actionOf(m) {
    if (m.status === "IDLE") return `<button class="bass-btn bass-btn--primary" data-act="open" id="start-${m.machine_no}">▶ 코스 선택</button>`;
    if (m.status === "DONE") return `<button class="bass-btn" data-act="collect" id="collect-${m.machine_no}">🧺 수거 완료</button>`;
    return `<button class="bass-btn" disabled>${m.status === "RUNNING" ? "가동 중" : "사용 불가"}</button>`;
  }

  function cardOf(m, i) {
    const st = STATUS[m.status] || STATUS.IDLE;
    return `<article class="bass-card machine is-${m.status.toLowerCase()} bass-reveal" style="animation-delay:${i * 40}ms" data-no="${esc(m.machine_no)}">
      <div class="machine__head"><span class="machine__no">${esc(m.machine_no)}</span>
        <span class="bass-badge bass-badge--${st.badge}">${st.label}</span></div>
      <div class="drum" aria-hidden="true"></div>
      <div class="progress"><i style="width:${progressOf(m)}%"></i></div>
      <div class="machine__info">${infoOf(m)}</div>
      <div class="bass-row" style="justify-content:center">${actionOf(m)}</div>
      <div class="bass-row admin-tools" style="justify-content:center">
        ${m.status === "BROKEN"
          ? `<button class="bass-btn bass-btn--sm" data-act="repair">🛠 점검 완료</button>`
          : `<button class="bass-btn bass-btn--sm bass-btn--danger" data-act="broken">⛔ 점검 등록</button>`}
      </div>
    </article>`;
  }

  async function load() {
    try {
      const [board, status, pays] = await Promise.all([
        Bass.api(APP, "/machines"), Bass.api(APP, "/status"), Bass.api(APP, "/payments?limit=8"),
      ]);
      const ms = board.machines;
      $("washer-grid").innerHTML = ms.filter((m) => m.machine_type === "washer").map(cardOf).join("") || "<p class='bass-muted'>세탁기가 없습니다.</p>";
      $("dryer-grid").innerHTML = ms.filter((m) => m.machine_type === "dryer").map(cardOf).join("") || "<p class='bass-muted'>건조기가 없습니다.</p>";
      const s = status.by_status;
      $("stat-idle").textContent = s.IDLE || 0;
      $("stat-running").textContent = s.RUNNING || 0;
      $("stat-done").textContent = s.DONE || 0;
      $("stat-sales").textContent = `${status.today_sales.amount.toLocaleString()}원`;
      $("payment-list").innerHTML = pays.payments.length
        ? pays.payments.map((p) => `<li><span>${esc(p.paid_at.slice(11, 16))} · ${esc(p.machine_no)} ${esc(p.course_name)}</span><b>${p.amount.toLocaleString()}원</b></li>`).join("")
        : "<li class='bass-muted'>아직 결제 내역이 없습니다.</li>";
      $("live-badge").className = "bass-badge bass-badge--info bass-badge--pulse";
      $("live-badge").textContent = "실시간 갱신";
    } catch (err) {
      $("live-badge").className = "bass-badge bass-badge--err";
      $("live-badge").textContent = "연결 끊김";
      Bass.showError(err);
    }
  }

  function openStart(no) {
    const card = document.querySelector(`[data-no="${CSS.escape(no)}"]`);
    const type = no.startsWith("D-") ? "dryer" : "washer";
    selected = no;
    $("start-title").textContent = `${no} 코스 선택`;
    $("course-list").innerHTML = Object.entries(courses[type] || {}).map(([key, c], i) =>
      `<label class="course"><input type="radio" name="course" value="${esc(key)}" data-price="${c.price}" ${i === 0 ? "checked" : ""}>
        <span>${esc(c.name)} <small class="bass-muted">${c.minutes}분</small></span><b>${c.price.toLocaleString()}원</b></label>`).join("");
    const first = $("course-list").querySelector("input:checked");
    $("paid-input").value = first ? first.dataset.price : "";
    $("start-dialog").showModal();
    if (card) card.blur();
  }

  $("course-list").addEventListener("change", (e) => {
    if (e.target.name === "course") $("paid-input").value = e.target.dataset.price;
  });

  $("start-form").addEventListener("submit", async (e) => {
    if (e.submitter && e.submitter.value === "cancel") return;
    e.preventDefault();
    const course = $("course-list").querySelector("input:checked");
    if (!course) return Bass.updateAppAlert("warning", "코스를 먼저 선택해 주세요.");
    await Bass.withLock($("start-submit"), async () => {
      const res = await Bass.api(APP, `/machines/${encodeURIComponent(selected)}/start`, {
        method: "POST", body: { course: course.value, paid: Number($("paid-input").value || 0), phone: $("phone-input").value },
      });
      $("start-dialog").close();
      Bass.updateAppAlert("success", res.message, `결제 ${res.payment.amount.toLocaleString()}원 · 완료 예정 ${res.machine.ends_at.slice(11, 16)}`);
      await load();
    }, "결제 처리 중... ⏳");
  });

  async function onBoardClick(e) {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const no = btn.closest("[data-no]").dataset.no;
    const act = btn.dataset.act;
    if (act === "open") return openStart(no);
    await Bass.withLock(btn, async () => {
      let body;
      if (act === "broken") {
        const reason = prompt(`${no} 점검 사유를 입력하세요`, "배수 불량");
        if (reason === null) return;
        body = { reason };
      }
      const res = await Bass.api(APP, `/machines/${encodeURIComponent(no)}/${act}`, { method: "POST", body });
      Bass.updateAppAlert("success", res.message);
      await load();
    });
  }

  $("washer-grid").addEventListener("click", onBoardClick);
  $("dryer-grid").addEventListener("click", onBoardClick);
  $("refresh-btn").addEventListener("click", () => Bass.withLock($("refresh-btn"), load, "불러오는 중..."));
  if (Bass.apiBase(APP) === "/api") $("back-portal").style.display = "none";   // 독립 실행 모드

  (async () => {
    try { courses = (await Bass.api(APP, "/courses")).courses; } catch (err) { Bass.showError(err); }
    await checkAdmin();
    await load();
    setInterval(load, 15000);
  })();
})();
