// ═══════════════════════════════════════════════════════════════════════
// shared/app.js — ядро QuizFlow (Firebase, auth, sidebar, спільні утиліти)
//
// Експортує ES-модульно І вішає на window — щоб inline handlers
// (onclick="toast('...')", etc.) продовжували працювати
// ═══════════════════════════════════════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, get, set, push, update, remove, onValue, off } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { loadCaps, CAP_FLAGS, CAP_LIMITS, pluralUk } from "./caps.js?v=3";
import { limitNotice } from "./notices.js?v=2";

// ─── Firebase ──────────────────────────────────────────────────────────
const FC = {
  apiKey: "AIzaSyDsA4IQkn5tV41LDK43vzgm0XnRnbdgvTc",
  authDomain: "quizflow-8a978.firebaseapp.com",
  databaseURL: "https://quizflow-8a978-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "quizflow-8a978",
  storageBucket: "quizflow-8a978.firebasestorage.app",
  messagingSenderId: "206469794166",
  appId: "1:206469794166:web:55cd7007b429607acd5257"
};
const app  = getApps().length ? getApps()[0] : initializeApp(FC);
const db   = getDatabase(app);
const auth = getAuth(app);

// Експонуємо на window — щоб features.js міг використати без імпорту
window._fb = { db, ref, get, set, push, update, remove, onValue, off };

export { db, ref, get, set, push, update, remove, onValue, off };

// ─── Auth через Firebase Auth ──────────────────────────────────────────
// Чекаємо, поки Firebase повністю відновить сесію (authStateReady — після
// перенесення між сховищами й оновлення токена), а не перший сигнал
const _fbUser = await (typeof auth.authStateReady === "function"
  ? auth.authStateReady().then(() => auth.currentUser)
  : new Promise((resolve) => { const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u); }); }));

// Після входу повертаємо на ту саму сторінку (login?next=…)
const _here = () => (location.pathname.split("/").pop() || "") + location.search + location.hash;
if (!_fbUser) {
  // Позначка для сторінки входу: сесії тут немає — не відправляти сюди ж автоматично (інакше цикл)
  try { sessionStorage.setItem("qf_auth_bounce", String(Date.now())); } catch {}
  location.replace("login" + (_here() ? "?next=" + encodeURIComponent(_here()) : ""));
  throw new Error("no auth");
}

// Зчитуємо профіль з Realtime DB
const _userSnap = await get(ref(db, `users/${_fbUser.uid}`));
if (!_userSnap.exists()) {
  await signOut(auth);
  location.href = "login?noprofile=1";
  throw new Error("no user profile");
}

const _userDb = _userSnap.val();

// Перевіряємо чи не заблокований
if (_userDb.blocked === true) {
  await signOut(auth);
  try { localStorage.removeItem("qf_signed_in"); } catch {}
  location.href = "login?blocked=1";
  throw new Error("blocked");
}

// Збираємо _user з Firebase UID + даними з DB
const _user = {
  id:      _fbUser.uid,
  email:   _fbUser.email,
  name:    _userDb.name    || "",
  surname: _userDb.surname || "",
  role:    _userDb.role    || "teacher",
  // Кастомні ролі (окремий шар над системним admin/teacher, керується з admin/roles.html).
  // customRoleIds — мапа {roleId:true,...}; customRoleId — старе одиничне поле для сумісності.
  customRoleIds: _userDb.customRoleIds && typeof _userDb.customRoleIds === "object"
    ? Object.keys(_userDb.customRoleIds).filter(k => _userDb.customRoleIds[k])
    : (_userDb.customRoleId ? [_userDb.customRoleId] : []),
};

export const user = _user;
export const uid  = _fbUser.uid;

window._user = _user;
window._uid  = uid;

// ─── Можливості й ліміти (адмінка → «Можливості») ─────────────────────────
// Завантажуються у фоні; поки не завантажились — нічого не блокуємо.
export const capsReady = loadCaps(db, { ..._user, features: _userDb.features }).then(c => (window.QF_CAPS = c)).catch(() => null);
// Чи дозволена функція. Якщо ні — пояснює викладачу чому.
window.qfCan = (flag) => {
  const c = window.QF_CAPS;
  if (!c || c.flags[flag] !== false) return true;
  toast(`«${CAP_FLAGS[flag]?.label || flag}» вимкнено адміністратором`, "err");
  return false;
};
// Чи можна додати ще один об'єкт при поточній кількості current
window.qfLimit = (key, current) => {
  const lim = window.QF_CAPS?.limits?.[key] || 0;
  if (lim) limitNotice(db, uid, key, current, lim, [_user.name, _user.surname].filter(Boolean).join(" "));   // 80% / 100% → сигнал адміністратору
  if (!lim || current < lim) return true;
  toast(`Досягнуто ліміту: ${lim} ${pluralUk(lim, CAP_LIMITS[key].unit)}. Зверніться до адміністратора.`, "err");
  return false;
};

// ─── Path / DB helpers ─────────────────────────────────────────────────
export function tp(path) {
  return `teachers/${uid}/${path}`;
}
export async function dbGet(path) {
  return await get(ref(db, tp(path)));
}
window.tp = tp;
window.dbGet = dbGet;

// ─── Utilities ─────────────────────────────────────────────────────────
export const $ = id => document.getElementById(id);
export const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const ts = () => Date.now();

export function toArr(snap) {
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, v]) => {
    if (v && v.questions && !Array.isArray(v.questions)) {
      v.questions = Object.values(v.questions);
    }
    if (v && !v.questions) v.questions = [];
    return { id, ...v };
  });
}

window.$ = $;
window.esc = esc;
window.ts = ts;
window.toArr = toArr;

// ─── Logout ────────────────────────────────────────────────────────────
window.doLogout = async () => {
  // Чистимо кеші навігації
  localStorage.removeItem("qf_nav_cache");
  localStorage.removeItem("qf_nav_ts");
  localStorage.removeItem("qf_user_cache");
  localStorage.removeItem("qf_signed_in");
  sessionStorage.clear();
  await signOut(auth);
  location.href = "login";
};

// ─── Toast ─────────────────────────────────────────────────────────────
let _toastTimer;
export function toast(msg, type = "ok") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = "show " + (type === "err" ? "err" : "");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}
window.toast = toast;

// ─── Loader ────────────────────────────────────────────────────────────
export function ldr(show) {
  let el = document.getElementById("app-loader");
  // Якщо лоадера немає — створюємо (на випадок якщо скрипт викликається без HTML-лоадера)
  if (!el) {
    el = document.createElement("div");
    el.id = "app-loader";
    el.innerHTML = '<div style="width:44px;height:44px;border:3.5px solid rgba(45,91,227,.15);border-top-color:#2d5be3;border-radius:50%;animation:appSpin .8s linear infinite"></div><div style="font-size:13px;color:#6b7280;margin-top:12px;font-family:DM Sans,sans-serif">Завантаження...</div>';
    el.style.cssText = "position:fixed;inset:0;background:#f0f3fa;z-index:9998;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity .25s ease";
    document.body.appendChild(el);
    if (!document.getElementById("app-ldr-kf")) {
      const s = document.createElement("style");
      s.id = "app-ldr-kf";
      s.textContent = "@keyframes appSpin{to{transform:rotate(360deg)}}";
      document.head.appendChild(s);
    }
  }
  if (show) {
    el.style.display = "flex";
    requestAnimationFrame(() => { el.style.opacity = "1"; });
  } else {
    // Показуємо main (знімаємо opacity:0 з CSS); меню видно завжди
    if (!document.body.classList.contains("app-ready")) {
      document.body.classList.add("app-ready");
      document.dispatchEvent(new Event("qf:ready"));
    }
    el.style.opacity = "0";
    setTimeout(() => {
      el.style.display = "none";
      // Видаляємо з DOM щоб він не мішав
      try { el.remove(); } catch {}
    }, 260);
  }
}
window.ldr = ldr;
window.appReady = () => ldr(false);

// ─── Sidebar toggle ────────────────────────────────────────────────────
// Реалізація — у shared/nav.js (window.toggleSidebar)

// ─── Жести панелей ─────────────────────────────────────────────────────
// Єдиний жест «змахнути, щоб закрити» для нижніх шторок (модалки на телефоні) і бічних панелей.
// Правила: жест стартує після 12 px і лише в потрібному напрямку; прокрутка вмісту має пріоритет
// (шторка тягнеться лише коли вміст догори); панель іде за пальцем 1:1, підкладка світлішає;
// відпустили — закриваємо за відстанню (понад 30%) або швидкістю (понад 0,5 px/мс), інакше
// м'яко повертаємо. Кнопка «закрити» й Esc лишаються. Слухач touchmove вішається лише на час жесту
// й лише на саму панель, тож прокрутка решти сторінки не сповільнюється.
window.qfDismiss = function (el, o) {
  if (!el || el._qfDismiss) return;
  el._qfDismiss = true;
  const dir = o.dir || "down";                                      // down | up | left | right
  const vert = dir === "down" || dir === "up", sgn = dir === "down" || dir === "right" ? 1 : -1;
  const reduce = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SKIP = "input,textarea,select,[contenteditable='true'],.qd-pop,[data-no-swipe]";
  let st = null;
  const ovl = () => (typeof o.overlay === "function" ? o.overlay() : o.overlay) || null;
  const size = () => (vert ? el.offsetHeight : el.offsetWidth) || 300;
  // Чи є всередині вміст, який ще можна прокрутити проти жесту (тоді це прокрутка, а не закриття)
  function scrolledInside(target) {
    for (let n = target; n && n !== el.parentNode; n = n.parentNode) {
      if (n.nodeType !== 1) continue;
      if (vert ? n.scrollHeight > n.clientHeight + 1 : n.scrollWidth > n.clientWidth + 1) {
        const pos = vert ? n.scrollTop : n.scrollLeft;
        const ov = getComputedStyle(n)[vert ? "overflowY" : "overflowX"];
        if (/auto|scroll/.test(ov) && (sgn > 0 ? pos > 0 : pos < (vert ? n.scrollHeight - n.clientHeight : n.scrollWidth - n.clientWidth) - 1)) return true;
      }
      if (n === el) break;
    }
    return false;
  }
  function paint(d) {
    const m = d > 0 ? d : d * 0.15;                                 // проти жесту — опір, а не жорсткий стоп
    el.style.transform = vert ? `translate3d(0,${m * sgn}px,0)` : `translate3d(${m * sgn}px,0,0)`;
    const v = ovl(); if (v) v.style.opacity = String(Math.max(0, 1 - Math.max(0, d) / (size() * 1.1)));
  }
  function reset() {
    el.style.transition = ""; el.style.transform = ""; el.style.willChange = "";
    const v = ovl(); if (v) { v.style.transition = ""; v.style.opacity = ""; }
  }
  function cleanup() {
    el.removeEventListener("touchmove", move); el.removeEventListener("touchend", end); el.removeEventListener("touchcancel", end);
    st = null;
  }
  function move(e) {
    if (!st) return;
    const t = e.touches[0]; if (!t) return;
    const dx = t.clientX - st.x, dy = t.clientY - st.y;
    const d = (vert ? dy : dx) * sgn, c = vert ? dx : dy;
    if (!st.drag) {
      if (Math.abs(c) > 10 && Math.abs(c) > Math.abs(d)) { cleanup(); return; }   // це інший жест (прокрутка вбік)
      if (d < -10) { cleanup(); return; }                                         // тягнуть у протилежний бік
      if (d < 12) return;                                                          // поріг активації
      st.drag = true; st.off = d;
      el.style.transition = "none"; el.style.willChange = "transform";
      const v = ovl(); if (v) v.style.transition = "none";
    }
    if (e.cancelable) e.preventDefault();                                          // тепер це наш жест, сторінка не прокручується
    const dist = d - st.off, dt = e.timeStamp - st.lt;
    if (dt > 0) st.v = 0.7 * ((d - st.ld) / dt) + 0.3 * st.v;                       // згладжена швидкість
    st.ld = d; st.lt = e.timeStamp; st.dist = dist;
    if (!st.tick && dist > size() * 0.3) { st.tick = true; try { navigator.vibrate && navigator.vibrate(8); } catch {} }
    if (st.tick && dist < size() * 0.3) st.tick = false;
    paint(dist);
  }
  function end() {
    if (!st) return;
    const s = st; cleanup();
    if (!s.drag) return;
    const far = s.dist > size() * 0.3 || (s.v > 0.5 && s.dist > 24);
    const v = ovl();
    if (reduce()) { reset(); if (far) o.close(); return; }
    if (far) {
      el.style.transition = "transform .22s cubic-bezier(.4,0,1,1)";
      if (v) { v.style.transition = "opacity .22s ease"; v.style.opacity = "0"; }
      el.style.transform = vert ? `translate3d(0,${sgn * 100}%,0)` : `translate3d(${sgn * 100}%,0,0)`;
      setTimeout(() => { o.close(); setTimeout(reset, 60); }, 190);
    } else {
      el.style.transition = "transform .3s cubic-bezier(.2,.8,.2,1)";
      if (v) { v.style.transition = "opacity .3s ease"; v.style.opacity = ""; }
      el.style.transform = "";
      setTimeout(reset, 320);
    }
  }
  el.addEventListener("touchstart", e => {
    if (st || e.touches.length !== 1 || (o.enabled && !o.enabled())) return;
    if (e.target.closest && e.target.closest(SKIP)) return;
    if (scrolledInside(e.target)) return;
    const t = e.touches[0];
    st = { x: t.clientX, y: t.clientY, lt: e.timeStamp, ld: 0, v: 0, dist: 0, off: 0, drag: false, tick: false };
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end); el.addEventListener("touchcancel", end);
  }, { passive: true });
};

// ─── Горизонтальні вкладки: затінення країв і автоцентрування активної ─────
// Вкладки-фільтри на вузькому екрані гортаються вбік. Затінення на краї показує, що є ще,
// а активна вкладка прокручується в центр. Без постійних спостерігачів за DOM: оновлюємо
// після завантаження, при зміні розміру й після кліку всередині вкладок.
const TAB_SEL = ".tabs,.nf-tabs,.sp-tabs,.l-tabs,.t-rail-list";
const TAB_ON = ".on,.active,.is-on,.is-active,[aria-selected='true'],[aria-current='true']";
function _tabHint(el, center) {
  const max = el.scrollWidth - el.clientWidth;
  if (center && max > 4) {
    const a = el.querySelector(TAB_ON);
    if (a) el.scrollLeft = Math.max(0, Math.min(max, a.offsetLeft - (el.clientWidth - a.offsetWidth) / 2));
  }
  el.classList.toggle("fade-l", el.scrollLeft > 4);
  el.classList.toggle("fade-r", max > 4 && el.scrollLeft < max - 4);
}
function qfTabHints(center) {
  document.querySelectorAll(TAB_SEL).forEach(el => {
    if (!el._qfTab) { el._qfTab = true; el.addEventListener("scroll", () => _tabHint(el, false), { passive: true }); }
    _tabHint(el, center);
  });
}
window.qfTabHints = qfTabHints;
document.addEventListener("click", e => {
  const box = e.target.closest && e.target.closest(TAB_SEL);
  if (box) setTimeout(() => _tabHint(box, true), 60);
});
let _tabRz; addEventListener("resize", () => { clearTimeout(_tabRz); _tabRz = setTimeout(() => qfTabHints(false), 120); });
[400, 1200, 2500].forEach(ms => setTimeout(() => qfTabHints(ms === 400), ms));

// ─── Modal helpers ─────────────────────────────────────────────────────
// Стек відкритих модалок: Esc і клік по фону закривають лише верхню,
// фокус переходить у модалку й повертається на кнопку, що її відкрила,
// сторінка під модалкою не прокручується.
const _mStack = [];
function _syncBodyLock() { document.body.classList.toggle("mo-open", _mStack.length > 0); if (window.qfLock) window.qfLock.set("modal", _mStack.length > 0); }
window.openM = function (id) {
  const el = document.getElementById(id);
  if (!el) { console.warn("[openM] модалку не знайдено:", id); return; }
  const i = _mStack.findIndex(m => m.el === el);
  if (i >= 0) _mStack.splice(i, 1);
  _mStack.push({ el, opener: document.activeElement });
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  const mb = el.querySelector(".mb");
  if (mb) { mb.style.transform = ""; mb.style.transition = ""; el.style.opacity = ""; el.style.transition = ""; }
  el.style.display = "flex";
  void el.offsetWidth;          // reflow — щоб спрацювала анімація появи
  el.classList.add("on");
  // Телефон: модалка — нижня шторка, її можна змахнути вниз
  if (mb) qfDismiss(mb, { dir: "down", overlay: el, close: () => closeM(id), enabled: () => matchMedia("(max-width:1023px)").matches });
  _syncBodyLock();
  // Фокус: [autofocus] → перше порожнє поле → перша кнопка
  setTimeout(() => {
    if (!el.classList.contains("on") && el.style.display === "none") return;
    const f = el.querySelector("[autofocus]:not([disabled])")
      || [...el.querySelectorAll("input:not([type=hidden]):not([disabled]),textarea:not([disabled])")].find(x => x.offsetParent && !x.value)
      || el.querySelector(".mb button:not(.mcl):not([disabled])");
    try { f?.focus({ preventScroll: true }); } catch {}
  }, 60);
};
window.closeM = function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("on");
  const i = _mStack.findIndex(m => m.el === el);
  const entry = i >= 0 ? _mStack.splice(i, 1)[0] : null;
  _syncBodyLock();
  setTimeout(() => { if (!el.classList.contains("on")) el.style.display = "none"; }, 260);
  try { if (entry?.opener && document.contains(entry.opener)) entry.opener.focus({ preventScroll: true }); } catch {}
};
document.addEventListener("click", e => {
  if (e.target.classList && e.target.classList.contains("mo") && e.target.id) closeM(e.target.id);
});
// Esc закриває лише верхню модалку. Слухаємо в фазі capture й зупиняємо подію,
// щоб старі обробники сторінок не закривали одразу всі модалки.
window.addEventListener("keydown", e => {
  // Tab не виходить за межі верхньої модалки (клавіатура на ПК)
  if (e.key === "Tab") {
    const topM = [..._mStack].reverse().find(m => m.el.classList.contains("on") && m.el.style.display !== "none");
    if (!topM) return;
    const fs = [...topM.el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
    if (!fs.length) return;
    const first = fs[0], last = fs[fs.length - 1], a = document.activeElement;
    if (!topM.el.contains(a)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    return;
  }
  if (e.key !== "Escape") return;
  // Відкритий поповер/дропдаун у модалці закривається першим (своїм обробником)
  if (document.querySelector('[data-open="1"], .cd-menu.open')) return;
  const top = [..._mStack].reverse().find(m => m.el.classList.contains("on") && m.el.style.display !== "none");
  if (!top) return;
  e.stopPropagation(); e.preventDefault();
  closeM(top.el.id);
}, true);

// ─── Sidebar: завантаження + підсвітка активної сторінки ───────────────
// ─── Модалки: завантажуються один раз з shared/modals.html ─────────────
async function loadModals() {
  // Якщо сторінка уже містить <div id="modals-root"> — туди й вставимо,
  // інакше створимо новий контейнер перед </body>
  try {
    const resp = await fetch("shared/modals?v=25");
    if (!resp.ok) throw new Error("modals.html " + resp.status);
    const html = await resp.text();
    let root = document.getElementById("modals-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "modals-root";
      document.body.appendChild(root);
    }
    root.innerHTML = html;
  } catch (e) {
    console.error("[app.js] loadModals failed:", e);
  }
}

// Меню малює shared/nav.js синхронно з кешу ще до Firebase (тому воно не
// зникає між сторінками). Тут — лише дані користувача й фонова звірка
// конфігу навігації з базою; initApp на це не чекає.
function ensureNavScript() {
  if (window.QFNav) return Promise.resolve();
  return new Promise(res => {
    const s = document.createElement("script");
    s.src = new URL("./nav.js?v=17", import.meta.url).href;
    s.onload = s.onerror = () => res();
    document.head.appendChild(s);
  });
}

async function loadSidebar(activePage) {
  await ensureNavScript();
  const nav = window.QFNav;
  if (!nav) return;
  if (!document.getElementById("sidebar")) nav.render(null);
  nav.setActive(activePage);
  nav.setUser(_user);
  refreshNavConfig();
}

async function refreshNavConfig() {
  const NAV_CACHE_KEY = "qf_nav_cache";
  const NAV_TS_KEY    = "qf_nav_ts";
  try {
    const cachedTs  = localStorage.getItem(NAV_TS_KEY);
    const cachedNav = localStorage.getItem(NAV_CACHE_KEY);
    const tsSnap = await get(ref(db, "settings/navigation_ts"));
    const serverTs = tsSnap.exists() ? String(tsSnap.val()) : null;
    if (cachedNav && cachedTs && serverTs && cachedTs === serverTs) return; // кеш свіжий
    const navSnap = await get(ref(db, "settings/navigation"));
    if (navSnap.exists() && Array.isArray(navSnap.val())) {
      const navData = navSnap.val();
      localStorage.setItem(NAV_CACHE_KEY, JSON.stringify(navData));
      if (serverTs) localStorage.setItem(NAV_TS_KEY, serverTs);
      window.QFNav?.setNav(navData);
    } else {
      localStorage.removeItem(NAV_CACHE_KEY);
      localStorage.removeItem(NAV_TS_KEY);
      window.QFNav?.setNav(window.QFNav.DEFAULT_NAV);
    }
  } catch (e) {
    console.warn("[app.js] nav config refresh failed:", e.message);
  }
}

// ─── Оголошення й техроботи (керуються з admin/announcements) ─────────────
const ANN_DISMISS_KEY = "qf_ann_dismissed";
const ANN_IC = {
  info:     '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/>',
  success:  '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
  warning:  '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="16.8" r=".6" fill="currentColor"/>',
  critical: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12.5"/><circle cx="12" cy="16" r=".6" fill="currentColor"/>',
};
const annSvg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
function readDismissed() { try { return JSON.parse(localStorage.getItem(ANN_DISMISS_KEY) || "{}") || {}; } catch { return {}; } }

async function loadServiceNotices() {
  try {
    const [stSnap, anSnap] = await Promise.all([get(ref(db, "settings/status")), get(ref(db, "settings/announcements"))]);
    const st = stSnap.val() || {};
    if (st.panelOff === true && _user.role !== "admin") return showPanelMaintenance(st.message);
    renderAnnouncements(anSnap.val() || {});
  } catch (e) { console.warn("[app.js] service notices:", e.message); }
}

function renderAnnouncements(all) {
  const now = Date.now(), dismissed = readDismissed();
  const mine = new Set(_user.customRoleIds || []);
  const list = Object.entries(all).filter(([id, a]) => a && a.enabled !== false
      && (!a.startAt || a.startAt <= now) && (!a.endAt || a.endAt >= now)
      && (a.audience !== "roles" || Object.keys(a.roleIds || {}).some(r => mine.has(r)))
      && !(a.dismissible !== false && dismissed[id] && dismissed[id] >= (a.updatedAt || 0)))
    .sort((x, y) => ({ critical: 0, warning: 1, info: 2, success: 3 }[x[1].level] ?? 2) - ({ critical: 0, warning: 1, info: 2, success: 3 }[y[1].level] ?? 2));
  document.getElementById("qf-anns")?.remove();
  if (!list.length) return;
  const main = document.querySelector("main.main") || document.querySelector(".main");
  if (!main) return;
  const box = document.createElement("div");
  box.id = "qf-anns";
  box.innerHTML = list.map(([id, a]) => {
    const lv = ANN_IC[a.level] ? a.level : "info";
    const href = a.linkUrl && !/^\s*javascript:/i.test(a.linkUrl) ? a.linkUrl : "";
    return `<div class="qf-ann ${lv}" role="status" data-ann="${esc(id)}">
      <span class="qf-ann-ic">${annSvg(ANN_IC[lv])}</span>
      <div class="qf-ann-b">${a.title ? `<div class="qf-ann-t">${esc(a.title)}</div>` : ""}${a.text ? `<div class="qf-ann-x">${esc(a.text)}</div>` : ""}
        ${href ? `<a class="qf-ann-a" href="${esc(href)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : ""}>${esc(a.linkLabel || "Детальніше")}${annSvg('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>')}</a>` : ""}</div>
      ${a.dismissible !== false ? `<button type="button" class="qf-ann-close" aria-label="Закрити оголошення">${annSvg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')}</button>` : ""}
    </div>`;
  }).join("");
  box.addEventListener("click", e => {
    const b = e.target.closest(".qf-ann-close"); if (!b) return;
    const el = b.closest("[data-ann]"), id = el.dataset.ann;
    const d = readDismissed(); d[id] = Date.now();
    try { localStorage.setItem(ANN_DISMISS_KEY, JSON.stringify(d)); } catch {}
    el.classList.add("out"); setTimeout(() => { el.remove(); if (!box.children.length) box.remove(); }, 180);
  });
  // Під верхньою панеллю (nav.js), якщо вона є
  const tb = main.querySelector(":scope > .qtb");
  if (tb) tb.after(box); else main.prepend(box);
}

function showPanelMaintenance(msg) {
  const ov = document.createElement("div");
  ov.id = "qf-maint";
  ov.setAttribute("role", "alert");
  ov.innerHTML = `<div class="qf-maint-card">
    <span class="qf-maint-ic">${annSvg('<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>')}</span>
    <h2>Технічні роботи</h2>
    <p>${esc(msg || "Тривають технічні роботи. Спробуйте трохи пізніше.")}</p>
    <button type="button" onclick="location.reload()">Оновити сторінку</button>
  </div>`;
  document.body.appendChild(ov);
  ldr(false);
}

// ─── State ─────────────────────────────────────────────────────────────
// features.js читає і пише в window.folders / tests / links / attempts
window.folders = [];
window.tests = [];
window.links = [];
window.attempts = [];

const _dataReadyCbs = new Set();
export function onDataReady(cb) {
  _dataReadyCbs.add(cb);
  if (window._dataLoaded) cb();
  return () => _dataReadyCbs.delete(cb);
}
function notifyReady() {
  window._dataLoaded = true;
  _dataReadyCbs.forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
}

// ─── Cache helpers (sessionStorage) ────────────────────────────────────
function tryLoadCache(key, maxAgeMs) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.savedAt || Date.now() - parsed.savedAt > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(key) {
  try {
    const data = {
      folders: window.folders,
      tests: window.tests,
      links: window.links,
      attempts: window.attempts,
      savedAt: Date.now()
    };
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    // QuotaExceededError — просто не кешуємо, не критично
    console.warn("[app.js] cache save failed:", e.message);
  }
}

// Видалити кеш — виклик features.js після будь-якої мутації (create/update/delete)
window.invalidateQfCache = function() {
  try { sessionStorage.removeItem("qf_cache_v1"); } catch {}
};

// ─── Живі дані: links і attempts ────────────────────────────────────────
// Один підписник на вузол. Його перший знімок і є початковим завантаженням —
// раніше сторінка тягнула ці вузли двічі (get() тут і onValue() у features.js),
// а спроби — найважчі дані (у кожній копія питань тесту).
// Кожна зміна → window.links / window.attempts + подія "qf:live" (features.js
// збирає події пачкою й перемальовує сторінку не частіше ніж раз на ~200 мс).
const _sortDesc = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
const _liveStarted = new Set();
function startLive(name) {
  if (_liveStarted.has(name)) return Promise.resolve();
  _liveStarted.add(name);
  window._qfLive = true;
  return new Promise(resolve => {
    let first = true;
    const done = () => { if (first) { first = false; resolve(); } };
    onValue(ref(db, tp(name)), snap => {
      window[name] = toArr(snap).sort(_sortDesc);
      const wasFirst = first;
      done();
      document.dispatchEvent(new CustomEvent("qf:live", { detail: { name, first: wasFirst } }));
    }, err => { console.warn(`[app.js] live ${name}:`, err.message); done(); });
  });
}

async function loadAllData() {
  try {
    // ─── 1) Пробуємо sessionStorage-кеш ─────────────────────────────────
    const CACHE_KEY = "qf_cache_v1";
    const CACHE_MAX_AGE = 60 * 1000;

    const cached = tryLoadCache(CACHE_KEY, CACHE_MAX_AGE);
    if (cached) {
      window.folders  = cached.folders;
      window.tests    = cached.tests;
      window.links    = cached.links;
      window.attempts = cached.attempts;
      console.log(`[app.js] з кешу (${cached.tests.length} тестів, вік ${Math.round((Date.now()-cached.savedAt)/1000)}с)`);
      notifyReady();
      startLive("links"); startLive("attempts");   // свіжі дані прийдуть подією qf:live
      return;
    }

    // ─── 2) Кешу немає — тягнемо свіже з Firebase ───────────────────────
    const [fs, ts_] = await Promise.all([
      dbGet("folders"), dbGet("tests"), startLive("links"), startLive("attempts")
    ]);
    window.folders  = toArr(fs).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    window.tests    = toArr(ts_).sort(_sortDesc);
    console.log(`[app.js] data loaded (${window.tests.length} tests, ${window.attempts.length} attempts)`);

    saveCache(CACHE_KEY);
    notifyReady();
  } catch (e) {
    toast("Помилка завантаження: " + e.message, "err");
    console.error("[app.js] loadAllData:", e);
  }
}

// ─── Індекси для сторінки тесту ────────────────────────────────────────
// Студент на сторінці тесту не може читати всі спроби й картки студентів (правила
// бази), тому «вже проходив?» і «чия картка?» шукаються за ключем прізвище_ім'я:
//   attemptIndex/{testId}/{key} → attemptId,  studentIndex/{key} → studentId.
// Нові записи індексує сама сторінка тесту; тут раз на добу добудовуємо індекс
// для старих даних.
export function nameKey(name, surname){
  return `${String(surname||"").trim()}_${String(name||"").trim()}`.toLowerCase()
    .replace(/\s+/g, " ").replace(/[.#$\[\]\/\x00-\x1f\x7f]/g, "_").slice(0, 200) || "_";
}
async function backfillIndexes(){
  const FLAG = `qf_idx_${uid}`;
  try { if (Date.now() - Number(localStorage.getItem(FLAG) || 0) < 864e5) return; } catch { return; }
  try {
    const [ai, si, st] = await Promise.all([dbGet("attemptIndex"), dbGet("studentIndex"), dbGet("students")]);
    const aIdx = ai.val() || {}, sIdx = si.val() || {}, upd = {};
    for (const a of (window.attempts || []).slice().sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0))){
      if (!a.testId || !a.name || !a.surname) continue;
      const k = nameKey(a.name, a.surname);
      if (!aIdx[a.testId]?.[k]) upd[tp(`attemptIndex/${a.testId}/${k}`)] = a.id;
    }
    for (const [id, s] of Object.entries(st.val() || {})){
      if (!s?.name || !s?.surname) continue;
      const k = nameKey(s.name, s.surname);
      if (!sIdx[k]) upd[tp(`studentIndex/${k}`)] = id;
    }
    if (Object.keys(upd).length) await update(ref(db), upd);
    localStorage.setItem(FLAG, String(Date.now()));
  } catch (e) { console.warn("[app.js] index backfill:", e.message); }
}

// ─── Публічний ініціалізатор ───────────────────────────────────────────
/**
 * @param {string} pageName — що підсвітити в sidebar (data-page)
 * @param {Object} options — { skipData: true } якщо сторінка сама грузить
 */
export async function initApp(pageName, options = {}) {
  ldr(true);
  // Страховка: якщо сторінка впала до appReady(), не лишаємо її під лоадером
  const _safety = setTimeout(() => ldr(false), 12000);
  const _onFail = () => setTimeout(() => ldr(false), 1500);
  window.addEventListener("error", _onFail, { once: true });
  window.addEventListener("unhandledrejection", _onFail, { once: true });
  document.addEventListener("qf:ready", () => {
    clearTimeout(_safety);
    window.removeEventListener("error", _onFail);
    window.removeEventListener("unhandledrejection", _onFail);
  }, { once: true });
  // Sidebar + модалки завантажуємо паралельно
  await Promise.all([
    loadSidebar(pageName),
    loadModals()
  ]);
  loadServiceNotices();   // оголошення й техроботи — у фоні, сторінку не затримують
  if (!options.skipData) {
    await loadAllData();
    setTimeout(backfillIndexes, 3000);
    // Легкі дзеркала для адмінки: після старту і (не частіше ніж раз на хвилину) після змін спроб
    let _idxT = null, _idxLast = 0;
    const syncIdx = () => {
      if (_idxT) return;   // уже заплановано — нова подія ввійде в ту саму звірку
      _idxT = setTimeout(() => {
        _idxT = null; _idxLast = Date.now();
        import("./admin-index.js?v=1").then(async m => {
          const fb = { db, ref, get, update };
          await m.syncAdminIndex(uid, fb);
          const { qVersionKey } = await import("./qorder.js?v=1");
          await m.compactAttempts(uid, fb, { qVersionKey });   // пачками: наступна — при наступній звірці
        }).catch(e => console.warn("[app.js] admin index:", e.message));
      }, Math.max(4000, 60e3 - (Date.now() - _idxLast)));
    };
    syncIdx();
    document.addEventListener("qf:live", e => { if (e.detail?.name === "attempts" && !e.detail.first) syncIdx(); });
  }
  // ldr(false) НЕ викликаємо — це робить сторінка після того як все відрендерить
  // (див. initFeatures → renderAll → specific hook → appReady())
}

// Явна функція щоб показати "все готово" — сторінка викликає після renderAll

// ─── Bug Report ────────────────────────────────────────────────────────────
window.openBugReport = () => {
  let ov = document.getElementById("qf-bug-ov");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "qf-bug-ov";
    ov.style.cssText = "position:fixed;inset:0;background:rgba(11,20,55,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(5px)";
    ov.innerHTML = `<div style="background:#fff;border-radius:18px;padding:28px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(11,20,55,.2)">
      <h3 style="margin:0 0 4px;font-size:17px;font-weight:800;color:#0B1437;font-family:Manrope,sans-serif">Повідомити</h3>
      <p style="font-size:13px;color:#5B6A8F;margin:0 0 14px;font-family:Manrope,sans-serif">Оберіть тип та опишіть детально</p>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <button id="qf-type-bug" onclick="window.selectBugType('bug')" style="flex:1;padding:9px 12px;border-radius:10px;font-family:Manrope,sans-serif;font-size:13px;font-weight:700;cursor:pointer;border:2px solid #EF4444;background:#FEE2E2;color:#B91C1C;transition:all .15s">Проблема</button>
        <button id="qf-type-imp" onclick="window.selectBugType('improvement')" style="flex:1;padding:9px 12px;border-radius:10px;font-family:Manrope,sans-serif;font-size:13px;font-weight:700;cursor:pointer;border:2px solid #E3E8F2;background:#F4F6FB;color:#5B6A8F;transition:all .15s">Покращення</button>
      </div>
      <div style="font-size:12px;font-family:monospace;background:#F4F6FB;border:1px solid #E3E8F2;border-radius:7px;padding:6px 10px;color:#1E3A8A;margin-bottom:12px" id="qf-bug-pg"></div>
      <textarea id="qf-bug-txt" placeholder="Опишіть детально..." style="width:100%;min-height:90px;border:1.5px solid #E3E8F2;border-radius:11px;padding:10px 12px;font-family:Manrope,sans-serif;font-size:14px;resize:vertical;outline:none;box-sizing:border-box;color:#0B1437"></textarea>
      <div style="display:flex;gap:10px;margin-top:12px">
        <button onclick="window.closeBugReport()" style="flex:1;padding:10px;border-radius:9px;font-family:Manrope,sans-serif;font-size:14px;font-weight:700;cursor:pointer;border:1px solid #E3E8F2;background:#F4F6FB;color:#5B6A8F">Скасувати</button>
        <button id="qf-bug-sb" onclick="window.sendBugReport()" style="flex:1;padding:10px;border-radius:9px;font-family:Manrope,sans-serif;font-size:14px;font-weight:700;cursor:pointer;border:none;background:#1E3A8A;color:#fff">Надіслати</button>
      </div>
      <div id="qf-bug-ok" style="display:none;text-align:center;padding:16px;font-size:14px;font-weight:700;color:#059669;font-family:Manrope,sans-serif">Дякуємо! Повідомлення надіслано.</div>
    </div>`;
    ov.addEventListener("click", e => { if (e.target === ov) window.closeBugReport(); });
    document.body.appendChild(ov);
  }
  document.getElementById("qf-bug-pg").textContent = document.body.dataset.page || location.pathname.split("/").pop() || "—";
  document.getElementById("qf-bug-txt").value = "";
  window.selectBugType("bug");
  document.getElementById("qf-bug-ok").style.display = "none";
  const sb = document.getElementById("qf-bug-sb");
  if (sb) { sb.disabled = false; sb.textContent = "Надіслати"; }
  ov.style.display = "flex";
};
window.closeBugReport = () => {
  const ov = document.getElementById("qf-bug-ov");
  if (ov) ov.style.display = "none";
};
let _bugType = "bug";
window.selectBugType = (type) => {
  _bugType = type;
  const bugBtn = document.getElementById("qf-type-bug");
  const impBtn = document.getElementById("qf-type-imp");
  if (!bugBtn || !impBtn) return;
  if (type === "bug") {
    bugBtn.style.border = "2px solid #EF4444"; bugBtn.style.background = "#FEE2E2"; bugBtn.style.color = "#B91C1C";
    impBtn.style.border = "2px solid #E3E8F2"; impBtn.style.background = "#F4F6FB"; impBtn.style.color = "#5B6A8F";
  } else {
    impBtn.style.border = "2px solid #7C3AED"; impBtn.style.background = "#EDE9FE"; impBtn.style.color = "#6D28D9";
    bugBtn.style.border = "2px solid #E3E8F2"; bugBtn.style.background = "#F4F6FB"; bugBtn.style.color = "#5B6A8F";
  }
};
window.sendBugReport = async () => {
  const text = (document.getElementById("qf-bug-txt")?.value || "").trim();
  if (!text) { document.getElementById("qf-bug-txt")?.focus(); return; }
  const btn = document.getElementById("qf-bug-sb");
  if (btn) { btn.disabled = true; btn.textContent = "Надсилаємо..."; }
  const page = document.body.dataset.page || location.pathname.split("/").pop() || "—";
  const userName = document.getElementById("sb-teacher-name")?.textContent || "—";
  try {
    const { push, ref: fbR } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
    await push(fbR(db, "bugReports"), {
      message: text,
      reportType: _bugType,
      page,
      uid: uid || "—",
      userName,
      createdAt: Date.now(),
      status: "new"
    });
    // Дублюємо в Telegram (не блокує основний флоу — помилка тут не заважає
    // самому репорту, який уже успішно збережено вище)
    notifyTelegramBugReport({ text, reportType: _bugType, page, userName }).catch(() => {});
    const ok = document.getElementById("qf-bug-ok");
    if (ok) ok.style.display = "block";
    setTimeout(() => window.closeBugReport(), 2000);
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = "Надіслати"; }
    alert("Помилка: " + e.message);
  }
};

// ─── Дублювання репортів у Telegram ────────────────────────────────────────
// Читає settings/telegramBot (токен + увімкнено) і telegramChats (кому надсилати,
// notify:true) — те саме сховище, яким керує адмінська сторінка admin/telegram.html.
function escTg(s){
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

async function notifyTelegramBugReport({ text, reportType, page, userName }) {
  const { get: fbGet, ref: fbR } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
  const cfgSnap = await fbGet(fbR(db, "settings/telegramBot"));
  const cfg = cfgSnap.exists() ? cfgSnap.val() : null;
  if (!cfg?.enabled || !cfg?.token) return;

  // Отримувачі — у settings/telegramBot/recipients (admin/telegram). Старий шлях
  // через telegramChats (з усією історією переписки) лише як запасний.
  let recipients = Object.keys(cfg.recipients || {}).filter(id => cfg.recipients[id]);
  if (!cfg.recipients){
    const chatsSnap = await fbGet(fbR(db, "telegramChats"));
    const chats = chatsSnap.exists() ? chatsSnap.val() : {};
    recipients = Object.keys(chats).filter(id => chats[id]?.notify);
  }
  if (!recipients.length) return;

  const isImprovement = reportType === "improvement";
  const emoji = isImprovement ? "💡" : "🐞";
  const label = isImprovement ? "Ідея покращення" : "Проблема";
  const now = new Date().toLocaleString("uk-UA", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });

  const msg =
    `<b>${emoji} QuizFlow · ${label}</b>\n` +
    `<blockquote>${escTg(text)}</blockquote>\n` +
    `${escTg(userName)} · <code>${escTg(page)}</code> · ${now}`;

  await Promise.all(recipients.map(chatId =>
    fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" })
    }).catch(() => {})
  ));
}

export function appReady() {
  ldr(false);
}

export default { initApp, appReady, onDataReady, db, tp, user, uid, toast, ldr, $, esc, toArr };
