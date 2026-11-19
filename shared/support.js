// ═══════════════════════════════════════════════════════════════════════
// shared/support.js — «Підтримка»: кулька справа знизу на сторінках викладача й у конструкторі.
// Вкладка «Нове» — повідомити про проблему чи запропонувати ідею (контекст сторінки додається сам). Вкладка «Мої звернення» — свої звернення і їх статус з адмінки.
//
// Дані:
//   bugReports/{id}           — повне звернення (читає лише адмін; там і нотатки адміністратора)
//   bugStatus/{uid}/{id}      — коротка копія для автора: t (текст), k (bug|idea), p (сторінка), at, s (статус), r (відповідь)
// Статус і відповідь у bugStatus оновлює адмінка (сторінка «Проблеми»).
// ═══════════════════════════════════════════════════════════════════════
import { ref, push, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const ICON = {
  bubble: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v4"/><path d="M12 14h.01"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  min: '<path d="M5 12h14"/>',
};
const svg = (k, s = 18, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATUS = { new: ["Надіслано", "n"], in_progress: ["У роботі", "w"], resolved: ["Виправлено", "d"], done: ["Виправлено", "d"] };

const CSS = `
.qfs-fab{position:fixed;right:20px;bottom:calc(20px + var(--qfs-lift,0px) + env(safe-area-inset-bottom,0px));z-index:880;height:44px;padding:0 16px 0 13px;gap:8px;border-radius:999px;border:1px solid rgba(45,91,227,.16);background:rgba(255,255,255,.92);-webkit-backdrop-filter:blur(10px) saturate(1.4);backdrop-filter:blur(10px) saturate(1.4);color:#0B1437;display:inline-flex;align-items:center;cursor:pointer;box-shadow:0 12px 28px -14px rgba(15,30,92,.55),0 1px 3px rgba(15,30,92,.08);transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .2s,background .2s,color .2s,opacity .2s,visibility .2s;font:700 13.5px Manrope,system-ui,sans-serif;letter-spacing:-.01em;-webkit-tap-highlight-color:transparent}
.qfs-fab .qfs-ic{width:26px;height:26px;margin-left:-4px;border-radius:50%;display:grid;place-items:center;background:#2D5BE3;color:#fff;flex:none;transition:background .2s,color .2s}
.qfs-fab:hover{transform:translateY(-2px);background:#fff;box-shadow:0 16px 32px -14px rgba(15,30,92,.6),0 1px 3px rgba(15,30,92,.08)}
.qfs-fab:active{transform:translateY(0) scale(.97)}
.qfs-fab:focus-visible,.qfs-tab:focus-visible{outline:3px solid rgba(45,91,227,.35);outline-offset:2px}
.qfs-fab.on{background:#0B1437;color:#fff;border-color:#0B1437}
.qfs-fab.on .qfs-ic{background:rgba(255,255,255,.14)}
.qfs-fab .qfs-dot{position:absolute;top:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:#10B981;border:2px solid #fff;display:none}
.qfs-fab.has-dot .qfs-dot{display:block}
.qfs-hide .qfs-fab,.qfs-blocked .qfs-fab,.qfs-blocked .qfs-tab{opacity:0;visibility:hidden;pointer-events:none;transform:scale(.8)}
.qfs-tab{position:fixed;right:0;bottom:calc(84px + var(--qfs-lift,0px));z-index:880;width:12px;height:44px;border:0;border-radius:8px 0 0 8px;background:#2D5BE3;opacity:.55;cursor:pointer;display:none;transition:width .15s,opacity .15s}
.qfs-tab:hover{width:16px;opacity:.9}
.qfs-hide .qfs-tab{display:block}
.qfs-pop{position:fixed;right:20px;bottom:calc(78px + var(--qfs-lift,0px) + env(safe-area-inset-bottom,0px));z-index:881;width:360px;max-width:calc(100vw - 24px);max-height:min(560px,calc(100dvh - 120px - var(--qfs-lift,0px)));display:flex;flex-direction:column;background:#fff;border:1px solid #E3E8F2;border-radius:18px;box-shadow:0 26px 60px -22px rgba(15,30,92,.5);font-family:Manrope,system-ui,sans-serif;color:#0B1437;transform-origin:calc(100% - 23px) calc(100% + 30px);animation:qfsIn .2s cubic-bezier(.2,.8,.2,1)}
.qfs-pop[hidden]{display:none}
.qfs-bd{display:none}
.qfs-grab{display:none}
@keyframes qfsUp{from{transform:translateY(100%)}to{transform:none}}
@keyframes qfsIn{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
.qfs-h{display:flex;align-items:center;gap:10px;padding:14px 14px 0 16px}
.qfs-h b{flex:1;font-size:15px;font-weight:800}
.qfs-ib{width:30px;height:30px;border-radius:9px;border:0;background:none;color:#66728F;display:grid;place-items:center;cursor:pointer}
.qfs-ib:hover{background:#F1F4FA;color:#0B1437}
.qfs-tabs{display:flex;gap:4px;margin:10px 14px 0;padding:3px;border-radius:11px;background:#F1F4FA}
.qfs-tabs button{flex:1;height:30px;border:0;border-radius:9px;background:none;font:700 13px Manrope,system-ui,sans-serif;color:#5B6A8F;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.qfs-tabs button.on{background:#fff;color:#0B1437;box-shadow:0 1px 3px rgba(11,20,55,.1)}
.qfs-tabs i{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#10B981;color:#fff;font:700 11px "Geist Mono",monospace;font-style:normal;display:none;align-items:center;justify-content:center}
.qfs-tabs i.on{display:inline-flex}
.qfs-b{padding:12px 14px 14px;overflow:auto;overscroll-behavior:contain}
.qfs-kind{display:flex;gap:6px;margin-bottom:10px}
.qfs-kind button{flex:1;height:34px;border-radius:10px;border:1.5px solid #E3E8F2;background:#fff;font:700 13px Manrope,system-ui,sans-serif;color:#5B6A8F;cursor:pointer}
.qfs-kind button.on[data-k="bug"]{border-color:#FCA5A5;background:#FEF2F2;color:#B91C1C}
.qfs-kind button.on[data-k="idea"]{border-color:#C4B5FD;background:#F5F3FF;color:#6D28D9}
.qfs-ta{width:100%;min-height:96px;max-height:220px;resize:vertical;border:1.5px solid #E3E8F2;border-radius:12px;padding:10px 12px;font:500 14px/1.45 Manrope,system-ui,sans-serif;color:#0B1437;outline:none;box-sizing:border-box;background:#fff}
.qfs-ta:focus{border-color:#2D5BE3;box-shadow:0 0 0 3px rgba(45,91,227,.12)}
.qfs-row{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
.qfs-ctx{display:flex;gap:5px;flex-wrap:wrap;flex:1;min-width:0}
.qfs-ctx span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;font-weight:600;color:#5B6A8F;background:#F1F4FA;border-radius:7px;padding:3px 7px}
.qfs-hint{font-size:11.5px;color:#66728F;margin-top:6px}
.qfs-err{font-size:12.5px;color:#B91C1C;margin-top:8px;min-height:0}
.qfs-send{margin-top:10px;width:100%;height:40px;border:0;border-radius:11px;background:#2D5BE3;color:#fff;font:800 14px Manrope,system-ui,sans-serif;cursor:pointer;transition:background .15s}
.qfs-send:hover{background:#2449C2}.qfs-send:disabled{opacity:.6;cursor:default}
.qfs-ok{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:22px 8px 10px}
.qfs-ok span{width:46px;height:46px;border-radius:50%;background:#DCFCE7;color:#047857;display:grid;place-items:center}
.qfs-ok b{font-size:15px}.qfs-ok p{margin:0;font-size:13px;color:#5B6A8F;line-height:1.45}
.qfs-ok button{margin-top:6px;height:34px;padding:0 14px;border-radius:10px;border:1px solid #E3E8F2;background:#fff;font:700 13px Manrope,system-ui,sans-serif;color:#0B1437;cursor:pointer}
.qfs-list{display:flex;flex-direction:column;gap:8px}
.qfs-it{border:1px solid #E3E8F2;border-radius:12px;padding:10px 12px}
.qfs-it.new{border-color:#A7F3D0;background:#F0FDF7}
.qfs-it-h{display:flex;align-items:flex-start;gap:8px}
.qfs-it-t{flex:1;min-width:0;font-size:13.5px;font-weight:700;line-height:1.35;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.qfs-st{flex:none;font-size:11px;font-weight:800;padding:3px 7px;border-radius:7px;white-space:nowrap}
.qfs-st.n{background:#EEF2FF;color:#3730A3}.qfs-st.w{background:#FEF3C7;color:#92400E}.qfs-st.d{background:#DCFCE7;color:#047857}
.qfs-it-m{font-size:11.5px;color:#66728F;margin-top:4px}
.qfs-reply{margin-top:8px;padding:8px 10px;border-radius:9px;background:#F1F4FA;font-size:12.5px;line-height:1.45;color:#24335A;overflow-wrap:anywhere}
.qfs-reply b{display:block;font-size:11px;color:#2D5BE3;margin-bottom:2px}
.qfs-empty{text-align:center;padding:24px 8px;font-size:13px;color:#66728F;line-height:1.5}
.qfs-f{display:flex;justify-content:center;padding:0 14px 12px}
.qfs-f button{border:0;background:none;font:600 12px Manrope,system-ui,sans-serif;color:#66728F;cursor:pointer;padding:4px 6px;border-radius:7px}
.qfs-f button:hover{color:#0B1437;background:#F1F4FA}
@media (max-width:640px){
  .qfs-fab{right:14px;width:48px;height:48px;padding:0;justify-content:center;background:#2D5BE3;border-color:#2D5BE3;color:#fff;box-shadow:0 10px 24px -10px rgba(45,91,227,.7),0 2px 6px rgba(15,30,92,.12)}
  .qfs-fab:hover{background:#2D5BE3}
  .qfs-fab .qfs-ic{margin:0;background:none;width:auto;height:auto}
  .qfs-fab svg{width:22px;height:22px}
  .qfs-fab .qfs-lb{display:none}
  .qfs-fab.on{background:#0B1437;border-color:#0B1437}
  .qfs-fab.on .qfs-ic{background:none}
  .qfs-tuck .qfs-fab:not(.on){transform:translateX(calc(100% + 2px)) translateX(-14px);opacity:.55}
  /* Телефон: нижня шторка поверх затемнення; сторінка під нею не гортається, клавіатура її не ховає */
  .qfs-bd{display:block;position:fixed;inset:0;z-index:881;background:rgba(11,20,55,.38);opacity:0;visibility:hidden;transition:opacity .22s,visibility .22s;touch-action:none;-webkit-tap-highlight-color:transparent}
  .qfs-open .qfs-bd{opacity:1;visibility:visible}
  .qfs-pop{z-index:882;left:0;right:0;width:auto;max-width:none;bottom:var(--qfs-kb,0px);max-height:calc(var(--qfs-vh,100dvh) - 40px);border:0;border-radius:20px 20px 0 0;padding-bottom:calc(env(safe-area-inset-bottom,0px) * var(--qfs-safe,1));box-shadow:0 -12px 40px -16px rgba(11,20,55,.45);transform-origin:50% 100%;animation:qfsUp .26s cubic-bezier(.2,.8,.2,1);overscroll-behavior:contain;transition:transform .22s cubic-bezier(.2,.8,.2,1)}
  .qfs-pop.drag{transition:none}
  .qfs-grab{display:block;flex:none;height:22px;margin-bottom:-12px;touch-action:none;cursor:grab;position:relative}
  .qfs-grab::before{content:"";position:absolute;left:50%;top:8px;width:40px;height:5px;margin-left:-20px;border-radius:3px;background:#D5DBE8}
  .qfs-h{touch-action:none}
  .qfs-h b{font-size:16px}
  .qfs-ib{width:36px;height:36px}
  .qfs-tabs button{height:36px;font-size:13.5px}
  .qfs-kind button{height:40px}
  .qfs-pop{touch-action:none}
  .qfs-b,.qfs-ta{touch-action:pan-y}
  .qfs-b{flex:1 1 auto;min-height:0;-webkit-overflow-scrolling:touch}
  .qfs-ta{font-size:16px;min-height:110px;max-height:38vh;resize:none}
  .qfs-send{height:46px;font-size:15px}
  .qfs-f button{padding:8px 10px;font-size:12.5px}
  .qfs-open .qfs-fab{opacity:0;visibility:hidden;pointer-events:none}
  html.qfs-lock,html.qfs-lock body{overflow:hidden!important;overscroll-behavior:none}
}
@media (prefers-reduced-motion:reduce){.qfs-pop{animation:none!important;transition:none!important}.qfs-bd{transition:none}.qfs-fab{transition:opacity .2s,visibility .2s}}
`;

/**
 * @param {object} o
 * @param {object} o.db — база Firebase сторінки
 * @param {string} o.uid
 * @param {() => string} [o.userName]
 * @param {() => object} [o.context] — додатковий контекст: { page, test, q }
 * @param {() => number} [o.lift] — на скільки підняти кульку (px), напр. над нижньою панеллю
 * @param {string} [o.blockers] — CSS-селектори відкритих вікон, під час яких кульку ховаємо
 */
export function initSupport(o){
  if (!o?.db || !o?.uid || document.getElementById("qfs-root")) return null;
  const { db, uid } = o;
  const LS = k => `qf_sup_${k}_${uid}`;
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(LS(k))) ?? d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(LS(k), JSON.stringify(v)); } catch {} };

  // Останні помилки сторінки — підуть разом зі зверненням
  const errs = [];
  const onErr = m => { m = String(m || "").slice(0, 160); if (m && !errs.includes(m)) { errs.push(m); if (errs.length > 3) errs.shift(); } };
  addEventListener("error", e => onErr(e.message));
  addEventListener("unhandledrejection", e => onErr(e.reason?.message || e.reason));

  const st = document.createElement("style"); st.id = "qfs-css"; st.textContent = CSS; document.head.appendChild(st);
  const root = document.createElement("div"); root.id = "qfs-root";
  root.innerHTML = `
    <button type="button" class="qfs-fab" aria-label="Підтримка: повідомити про проблему" aria-expanded="false" aria-controls="qfs-pop" title="Повідомити про проблему"><span class="qfs-ic">${svg("bubble", 16, 2.2)}</span><span class="qfs-lb">Підтримка</span><span class="qfs-dot"></span></button>
    <button type="button" class="qfs-tab" aria-label="Показати кнопку підтримки" title="Підтримка"></button>
    <div class="qfs-bd" aria-hidden="true"></div>
    <section class="qfs-pop" id="qfs-pop" role="dialog" aria-label="Підтримка" tabindex="-1" hidden>
      <div class="qfs-grab" aria-hidden="true"></div>
      <div class="qfs-h"><b>Підтримка</b><button type="button" class="qfs-ib" data-x aria-label="Закрити">${svg("x", 17)}</button></div>
      <div class="qfs-tabs" role="tablist">
        <button type="button" role="tab" data-tab="new" class="on" aria-selected="true">Нове</button>
        <button type="button" role="tab" data-tab="mine" aria-selected="false">Мої звернення<i></i></button>
      </div>
      <div class="qfs-b" id="qfs-b"></div>
      <div class="qfs-f"><button type="button" data-hide>Сховати кнопку до кінця сесії</button></div>
    </section>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const fab = $(".qfs-fab"), pop = $(".qfs-pop"), body = $("#qfs-b");

  const S = { tab: "new", kind: "bug", sending: false, sent: false, items: null, denied: false };
  let draft = read("draft", "");

  // ─── Контекст ─────────────────────────────────────────────────────
  function browser(){
    const u = navigator.userAgent;
    const b = /Edg\/(\d+)/.exec(u) ? "Edge " + RegExp.$1 : /OPR\/(\d+)/.exec(u) ? "Opera " + RegExp.$1 : /Firefox\/(\d+)/.exec(u) ? "Firefox " + RegExp.$1
      : /Chrome\/(\d+)/.exec(u) ? "Chrome " + RegExp.$1 : /Version\/(\d+).*Safari/.exec(u) ? "Safari " + RegExp.$1 : "Браузер";
    const os = /Android/.test(u) ? "Android" : /iPhone|iPad|iPod/.test(u) ? "iOS" : /Windows/.test(u) ? "Windows" : /Mac OS/.test(u) ? "macOS" : /Linux/.test(u) ? "Linux" : "";
    return [b, os].filter(Boolean).join(", ");
  }
  function ctx(){
    let extra = {}; try { extra = o.context?.() || {}; } catch {}
    const fromTitle = (document.title || "").split(/\s+[—·|–-]\s+/).map(x => x.trim()).filter(x => x && !/^quizflow$/i.test(x))[0];
    const page = extra.page || fromTitle || location.pathname.split("/").pop() || "—";
    return { page: String(page).slice(0, 80), path: location.pathname.slice(0, 120), test: extra.test ? String(extra.test).slice(0, 120) : null,
      q: extra.q ?? null, browser: browser(), screen: `${innerWidth}×${innerHeight}`, errors: errs.length ? errs.slice() : null };
  }
  const chips = c => [c.page, c.test, c.q ? `Питання ${c.q}` : null, c.browser.split(",")[0]].filter(Boolean).map(t => `<span title="${esc(t)}">${esc(t)}</span>`).join("");

  // ─── Рендер ───────────────────────────────────────────────────────
  function render(){
    root.querySelectorAll(".qfs-tabs button").forEach(b => { const on = b.dataset.tab === S.tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    if (S.tab === "new") body.innerHTML = S.sent ? `
      <div class="qfs-ok"><span>${svg("check", 22, 2.6)}</span><b>Дякуємо, звернення надіслано</b>
        <p>Статус і відповідь з'являться у вкладці «Мої звернення».</p><button type="button" data-more>Написати ще</button></div>` : `
      <div class="qfs-kind" role="group" aria-label="Тип звернення">
        <button type="button" data-k="bug" class="${S.kind === "bug" ? "on" : ""}" aria-pressed="${S.kind === "bug"}">Проблема</button>
        <button type="button" data-k="idea" class="${S.kind === "idea" ? "on" : ""}" aria-pressed="${S.kind === "idea"}">Ідея</button>
      </div>
      <textarea class="qfs-ta" maxlength="2000" aria-label="Опис" placeholder="${S.kind === "bug" ? "Що сталося? Що ви робили перед цим?" : "Що варто додати чи змінити?"}">${esc(draft)}</textarea>
      <div class="qfs-row"><div class="qfs-ctx" title="Додається автоматично">${chips(ctx())}</div></div>
      <div class="qfs-hint">Сторінка й браузер додаються автоматично.</div>
      <div class="qfs-err" role="alert"></div>
      <button type="button" class="qfs-send" data-send ${S.sending ? "disabled" : ""}>${S.sending ? "Надсилаємо…" : "Надіслати"}</button>`;
    else body.innerHTML = renderList();
    paintDot();
  }
  function renderList(){
    const list = items();
    if (!list.length) return `<div class="qfs-empty">Тут з'являться ваші звернення та їхній статус.<br>Поки що звернень немає.</div>`;
    const seen = read("seen", {});
    return `<div class="qfs-list">${list.map(it => {
      const [label, cls] = STATUS[it.s] || STATUS.new;
      const fresh = isFresh(it, seen);
      const when = it.at ? new Date(it.at).toLocaleDateString("uk-UA", { day: "numeric", month: "short" }) : "";
      return `<div class="qfs-it${fresh ? " new" : ""}"><div class="qfs-it-h"><div class="qfs-it-t">${esc(it.t || "Без опису")}</div><span class="qfs-st ${cls}">${label}</span></div>
        <div class="qfs-it-m">${it.k === "idea" ? "Ідея" : "Проблема"}${it.p ? " · " + esc(it.p) : ""}${when ? " · " + when : ""}</div>
        ${it.r ? `<div class="qfs-reply"><b>Відповідь</b>${esc(it.r)}</div>` : ""}</div>`;
    }).join("")}</div>`;
  }
  // Звернення з бази (bugStatus), а якщо правила ще не дозволяють — з цього браузера
  function items(){
    const local = read("sent", []);
    if (!S.items) return local.map(x => ({ ...x, s: "new" }));
    const ids = new Set(S.items.map(x => x.id));
    return [...S.items, ...local.filter(x => !ids.has(x.id)).map(x => ({ ...x, s: "new" }))].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 30);
  }
  const mark = it => `${it.s || "new"}|${it.r ? 1 : 0}`;
  const isFresh = (it, seen) => (it.s && it.s !== "new" || it.r) && seen[it.id] !== mark(it);
  function paintDot(){
    const seen = read("seen", {}), n = items().filter(it => isFresh(it, seen)).length;
    fab.classList.toggle("has-dot", n > 0);
    const i = root.querySelector(".qfs-tabs i"); i.textContent = n; i.classList.toggle("on", n > 0);
    fab.setAttribute("aria-label", n ? `Підтримка: ${n} оновлення у зверненнях` : "Підтримка: повідомити про проблему");
  }
  function markSeen(){
    const seen = read("seen", {}); items().forEach(it => { seen[it.id] = mark(it); }); write("seen", seen);
  }

  // ─── Відкрити / закрити ───────────────────────────────────────────
  let _back = null;
  const phone = () => matchMedia("(max-width: 640px)").matches;
  const coarse = () => matchMedia("(pointer: coarse)").matches;
  const H = document.documentElement;

  // ─── Телефон: шторка ──────────────────────────────────────────────
  // Блокуємо прокрутку сторінки, тримаємо шторку над клавіатурою (visualViewport),
  // «Назад» на Android закриває шторку, а не сторінку; шторку можна стягнути вниз за верх.
  let sheet = false, savedY = 0;
  function sheetOn(){
    if (sheet) return; sheet = true;
    savedY = scrollY;
    H.classList.add("qfs-open", "qfs-lock");
    fitVV();
    try { if (!history.state?.qfs) history.pushState({ ...(history.state || {}), qfs: 1 }, ""); } catch {}
  }
  function sheetOff(fromHistory){
    if (!sheet) return false; sheet = false;
    H.classList.remove("qfs-open", "qfs-lock");
    if (Math.abs(scrollY - savedY) > 1) scrollTo(0, savedY);   // iOS міг зсунути сторінку, поки була клавіатура
    if (!fromHistory) { try { if (history.state?.qfs) history.back(); } catch {} }
    return true;
  }
  addEventListener("popstate", () => { if (sheet && !pop.hidden) close(true); });

  // Висота видимої області й клавіатура
  const vv = window.visualViewport;
  function fitVV(){
    if (!vv) return;
    const kb = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
    H.style.setProperty("--qfs-kb", kb + "px");
    H.style.setProperty("--qfs-vh", Math.round(vv.height) + "px");
    H.style.setProperty("--qfs-safe", kb > 0 ? "0" : "1");   // над клавіатурою відступ під «чубчик» не потрібен
  }
  vv?.addEventListener("resize", () => { if (sheet) fitVV(); });
  vv?.addEventListener("scroll", () => { if (sheet) fitVV(); });

  // Дотики: усередині шторки гортається лише те, що справді може гортатись у цей бік; решта не доходить до сторінки
  let tY = 0;
  const scrollable = el => { const o = getComputedStyle(el).overflowY; return (o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight + 1; };
  document.addEventListener("touchstart", e => { if (sheet) tY = e.touches[0].clientY; }, { passive: true, capture: true });
  document.addEventListener("touchmove", e => {
    if (!sheet || e.touches.length > 1) return;
    const dy = e.touches[0].clientY - tY;
    for (let el = e.target; el && el !== pop.parentNode && pop.contains(el); el = el.parentElement){
      if (!scrollable(el)) continue;
      if (dy > 0 && el.scrollTop > 0) return;
      if (dy < 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return;
      if (dy === 0) return;
    }
    if (e.cancelable) e.preventDefault();
  }, { passive: false, capture: true });

  // Стягнути вниз за верх шторки
  let dragY = null, dragD = 0, dragT = 0;
  const dragZone = t => t.closest(".qfs-grab") || (t.closest(".qfs-h") && !t.closest("button"));
  pop.addEventListener("touchstart", e => {
    if (!sheet || e.touches.length > 1 || !dragZone(e.target)) return;
    dragY = e.touches[0].clientY; dragD = 0; dragT = Date.now(); pop.classList.add("drag");
  }, { passive: true });
  pop.addEventListener("touchmove", e => {
    if (dragY == null) return;
    dragD = Math.max(0, e.touches[0].clientY - dragY);
    pop.style.transform = dragD ? `translateY(${dragD}px)` : "";
  }, { passive: true });
  const dragEnd = () => {
    if (dragY == null) return;
    const fast = dragD > 40 && Date.now() - dragT < 250;
    dragY = null; pop.classList.remove("drag");
    if (dragD > Math.min(140, pop.offsetHeight * .3) || fast){ pop.style.transform = "translateY(100%)"; setTimeout(close, 180); }
    else pop.style.transform = "";
  };
  pop.addEventListener("touchend", dragEnd); pop.addEventListener("touchcancel", dragEnd);

  function open(tab){
    if (tab) S.tab = tab;
    if (S.sent && S.tab === "new") S.sent = false;
    _back = document.activeElement;
    document.documentElement.classList.remove("qfs-hide"); sessionStorage.removeItem("qf_sup_hide");
    pop.hidden = false; fab.classList.add("on"); fab.setAttribute("aria-expanded", "true");
    pop.style.transform = "";
    render();
    if (S.tab === "mine") setTimeout(markSeen, 1200);
    if (phone()) sheetOn();
    // На телефоні клавіатуру не відкриваємо самі: вона зсуває екран ще до того, як людина щось вирішила
    setTimeout(() => (phone() || coarse() ? pop : (S.tab === "new" ? $(".qfs-ta") : $(".qfs-tabs .on")))?.focus({ preventScroll: true }), 30);
  }
  function close(fromHistory){
    if (pop.hidden) return;
    if (S.tab === "mine") markSeen();
    pop.hidden = true; fab.classList.remove("on"); fab.setAttribute("aria-expanded", "false");
    const wasSheet = sheetOff(fromHistory);
    paintDot();
    if (wasSheet) { document.activeElement?.blur?.(); return; }   // на телефоні фокус не повертаємо — інакше відкриється клавіатура або екран стрибне
    if (_back?.isConnected && _back !== document.body) _back.focus?.(); else fab.focus();
  }
  const toggle = () => pop.hidden ? open() : close();

  // ─── Надсилання ───────────────────────────────────────────────────
  async function send(){
    const ta = $(".qfs-ta"), text = (ta?.value || "").trim(), err = $(".qfs-err");
    if (text.length < 3){ err.textContent = "Опишіть коротко, що сталося"; ta?.focus(); return; }
    S.sending = true; draft = text; render();
    const c = ctx(), at = Date.now();
    let userName = "—"; try { userName = o.userName?.() || "—"; } catch {}
    try {
      const r = push(ref(db, "bugReports"));
      await set(r, { message: text, reportType: S.kind === "idea" ? "improvement" : "bug", page: c.page, uid, userName, createdAt: at, status: "new",
        ctx: c });
      const short = { t: text.slice(0, 300), k: S.kind, p: c.page, at };
      const sent = read("sent", []); sent.unshift({ id: r.key, ...short }); write("sent", sent.slice(0, 30));
      set(ref(db, `bugStatus/${uid}/${r.key}`), { ...short, s: "new" }).then(() => notify(r.key)).catch(() => {});
      draft = ""; write("draft", ""); S.sent = true;
    } catch (e){
      S.sending = false; render();
      $(".qfs-err").textContent = "Не вдалося надіслати: " + (e?.message || "перевірте інтернет");
      return;
    }
    S.sending = false; render();
  }
  // Telegram для адміністраторів — через воркер (токен бота лише там). Будь-яка помилка тут тиха.
  async function notify(id){
    try {
      const [{ get }, { getApps }, { getAuth }] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js"),
        import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),
      ]);
      const url = String((await get(ref(db, "settings/mail/workerUrl"))).val() || "").replace(/\/+$/, "");
      const user = getApps().length ? getAuth(getApps()[0]).currentUser : null;
      if (!url || !user) return;
      await fetch(url + "/telegram/notice", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + await user.getIdToken() },
        body: JSON.stringify({ key: id, type: "bug", uid }) });
    } catch {}
  }

  // ─── Події ────────────────────────────────────────────────────────
  fab.addEventListener("click", toggle);
  $(".qfs-tab").addEventListener("click", () => open());
  pop.addEventListener("click", e => {
    const t = e.target;
    if (t.closest("[data-x]")) return close();
    const tb = t.closest("[data-tab]"); if (tb){ if (S.tab === "mine") markSeen(); S.tab = tb.dataset.tab; render(); if (S.tab === "mine") setTimeout(markSeen, 1200); return; }
    const k = t.closest("[data-k]"); if (k){ draft = $(".qfs-ta")?.value || draft; S.kind = k.dataset.k; render(); $(".qfs-ta")?.focus(); return; }
    if (t.closest("[data-send]")) return send();
    if (t.closest("[data-more]")){ S.sent = false; render(); $(".qfs-ta")?.focus(); return; }
    if (t.closest("[data-hide]")){ close(); sessionStorage.setItem("qf_sup_hide", "1"); document.documentElement.classList.add("qfs-hide"); }
  });
  pop.addEventListener("input", e => { if (e.target.matches(".qfs-ta")){ draft = e.target.value; write("draft", draft); const er = $(".qfs-err"); if (er) er.textContent = ""; } });
  pop.addEventListener("keydown", e => {
    if (e.key === "Escape"){ e.stopPropagation(); close(); }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && e.target.matches(".qfs-ta")){ e.preventDefault(); send(); }
  });
  document.addEventListener("pointerdown", e => { if (!pop.hidden && !root.contains(e.target)) close(); }, true);
  $(".qfs-bd").addEventListener("click", () => close());
  if (sessionStorage.getItem("qf_sup_hide")) document.documentElement.classList.add("qfs-hide");

  // Кульку ховаємо, поки відкрите інше вікно, і на телефоні — поки людина друкує в полі сторінки
  const BLOCK = [".mo.on", ".modal.on", ".ai-panel.on", ".qf-fs.on", "#qf-bug-ov[style*='flex']", o.blockers].filter(Boolean).join(",");
  const sync = () => {
    const typing = matchMedia("(max-width: 640px)").matches && document.activeElement?.matches?.("input,textarea,[contenteditable='true']") && !root.contains(document.activeElement);
    const blocked = !!document.querySelector(BLOCK) || typing;
    document.documentElement.classList.toggle("qfs-blocked", blocked);
    if (blocked && !pop.hidden && !typing) close();
    let lift = 0; try { lift = Number(o.lift?.()) || 0; } catch {}
    document.documentElement.style.setProperty("--qfs-lift", lift + "px");
  };
  let _q = 0; const later = () => { if (!_q) _q = requestAnimationFrame(() => { _q = 0; sync(); }); };
  new MutationObserver(later).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class", "style"], childList: true });
  addEventListener("resize", () => { later(); if (!pop.hidden && sheet !== phone()) { if (sheet) { sheetOff(); pop.style.transform = ""; } else sheetOn(); } }); document.addEventListener("focusin", later); document.addEventListener("focusout", () => setTimeout(later, 50));
  sync();

  // На телефоні під час гортання вниз кулька ховається за край і не закриває вміст; повертається, коли гортання зупинилось або пішло вгору
  const tops = new WeakMap(); let tuckT = 0;
  const tuck = on => document.documentElement.classList.toggle("qfs-tuck", on);
  document.addEventListener("scroll", e => {
    if (!matchMedia("(max-width: 640px)").matches || !pop.hidden) return;
    const el = e.target === document ? document.scrollingElement : e.target;
    if (!el || root.contains(el)) return;
    const y = el.scrollTop, prev = tops.get(el) ?? y; tops.set(el, y);
    if (y - prev > 4 && y > 80) tuck(true); else if (prev - y > 4) tuck(false);
    clearTimeout(tuckT); tuckT = setTimeout(() => tuck(false), 900);
  }, { capture: true, passive: true });

  // Статуси з адмінки: живе оновлення, щоб крапка з'являлась одразу
  try {
    onValue(ref(db, `bugStatus/${uid}`), snap => {
      const v = snap.val() || {};
      S.items = Object.entries(v).filter(([, x]) => x && typeof x === "object").map(([id, x]) => ({ id, t: x.t, k: x.k, p: x.p, at: x.at, s: x.s, r: x.r }));
      if (!pop.hidden && S.tab === "mine") render(); else paintDot();
    }, () => { S.denied = true; paintDot(); });
  } catch {}
  paintDot();

  const api = { open, close, toggle };
  window.qfSupport = api;
  return api;
}
