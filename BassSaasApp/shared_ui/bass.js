/* shared_ui/bass.js — BassSaasApp 공통 프론트엔드 런타임
 *
 *   Bass.apiBase("laundry")            → 통합 모드 "/api/laundry", 독립 모드 "/api"
 *   await Bass.api("laundry", "/machines", { method: "POST", body: {...} })
 *   Bass.updateAppAlert("success" | "warning" | "diff" | "error", "메시지", "다음 행동 안내")
 *   await Bass.withLock(button, async () => {...}, "처리 중... ⏳")   // 이중 클릭 방지 + 실패 시 복원
 *
 * 무음 실패 금지: Bass.api 는 실패 시 { level, message, hint } 를 가진 BassError 를 던지고,
 * Bass.withLock 은 잡은 오류를 반드시 배너로 표시한다.
 */
(function (global) {
  "use strict";

  const TOKEN_KEY = "bass_token";
  const ICONS = { warning: "⚠️", diff: "⚖️", error: "❌", success: "✅" };

  class BassError extends Error {
    constructor({ level = "error", message = "알 수 없는 오류", hint = "", status = 0, data = null } = {}) {
      super(message);
      this.level = level; this.hint = hint; this.status = status; this.data = data;
    }
  }

  function apiBase(appId) {
    const p = global.location.pathname;
    return (p === `/${appId}` || p.startsWith(`/${appId}/`)) ? `/api/${appId}` : "/api";
  }

  function token() { return global.localStorage.getItem(TOKEN_KEY) || ""; }
  function setToken(t) { t ? global.localStorage.setItem(TOKEN_KEY, t) : global.localStorage.removeItem(TOKEN_KEY); }

  async function request(url, { method = "GET", body, headers = {} } = {}) {
    const h = { Accept: "application/json", ...headers };
    if (body !== undefined) h["Content-Type"] = "application/json";
    if (token()) h.Authorization = `Bearer ${token()}`;
    let res;
    try {
      res = await fetch(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (netErr) {
      throw new BassError({ level: "error", message: "서버에 연결할 수 없습니다.",
        hint: "네트워크 연결 또는 서버 실행 상태를 확인한 뒤 다시 시도해 주세요." });
    }
    let data = null;
    try { data = await res.json(); } catch (_) { /* 비 JSON 응답 */ }
    if (!res.ok || (data && data.success === false)) {
      throw new BassError({
        level: (data && data.level) || (res.status >= 500 ? "error" : "warning"),
        message: (data && (data.message || data.detail)) || `요청이 실패했습니다 (HTTP ${res.status}).`,
        hint: (data && data.hint) || "", status: res.status, data,
      });
    }
    return data;
  }

  function api(appId, path, opts) { return request(apiBase(appId) + path, opts); }

  function alertStack() {
    let el = document.getElementById("app-alert");
    if (!el) {
      el = document.createElement("div");
      el.id = "app-alert";
      (document.querySelector("main") || document.body).prepend(el);
    }
    el.classList.add("bass-alert-stack");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    return el;
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function updateAppAlert(level, message, hint = "", { timeout } = {}) {
    const lv = ICONS[level] ? level : "error";
    const stack = alertStack();
    const node = document.createElement("div");
    node.className = `bass-alert bass-alert--${lv}`;
    node.innerHTML = `<span class="bass-alert__icon">${ICONS[lv]}</span>
      <div><div class="bass-alert__msg">${escapeHtml(message)}</div>${hint ? `<div class="bass-alert__hint">${escapeHtml(hint)}</div>` : ""}</div>
      <button class="bass-alert__close" aria-label="닫기">×</button>`;
    const close = () => { node.classList.add("is-leaving"); setTimeout(() => node.remove(), 300); };
    node.querySelector(".bass-alert__close").addEventListener("click", close);
    while (stack.children.length >= 3) stack.firstElementChild.remove();
    stack.append(node);
    const ms = timeout ?? (lv === "success" ? 5000 : lv === "error" ? 0 : 9000);
    if (ms) setTimeout(close, ms);
    return node;
  }

  function showError(err) {
    if (err instanceof BassError) return updateAppAlert(err.level, err.message, err.hint);
    console.error(err);
    return updateAppAlert("error", "화면 처리 중 예기치 못한 오류가 발생했습니다.", "새로고침 후 다시 시도해 주세요.");
  }

  async function withLock(btn, fn, busyLabel = "처리 중... ⏳") {
    if (btn && btn.disabled) return undefined;     // 이중 클릭 차단
    const original = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.innerHTML = busyLabel; }
    try {
      return await fn();
    } catch (err) {
      showError(err);
      return undefined;
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = original; }
    }
  }

  global.Bass = { apiBase, api, request, updateAppAlert, showError, withLock, token, setToken, escapeHtml, BassError };
  global.updateAppAlert = updateAppAlert;
})(window);
