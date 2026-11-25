// ═══════════════════════════════════════════════════════════════════════
// live/live-core.js — спільне ядро всіх сторінок QuizFlow Live
//
// Раніше кожна сторінка мала власну копію конфігу Firebase, тем, патернів,
// esc()/initialsOf() і логіки підрахунку балів — і вони встигли розійтися
// (прев'ю в setup показувало інші кольори, ніж бачили учні). Тепер усе тут.
// ═══════════════════════════════════════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, get, set, update, remove, onValue, serverTimestamp, onDisconnect,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
// firebase-auth (≈100 КБ) підвантажуємо лише на сторінках викладача — учням він не потрібен.
const AUTH_URL = "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const FC = {apiKey:"AIzaSyDsA4IQkn5tV41LDK43vzgm0XnRnbdgvTc",authDomain:"quizflow-8a978.firebaseapp.com",databaseURL:"https://quizflow-8a978-default-rtdb.europe-west1.firebasedatabase.app",projectId:"quizflow-8a978",storageBucket:"quizflow-8a978.firebasestorage.app",messagingSenderId:"206469794166",appId:"1:206469794166:web:55cd7007b429607acd5257"};
export const app  = getApps().length ? getApps()[0] : initializeApp(FC);
export const db   = getDatabase(app);

export { ref, get, set, update, remove, onValue, serverTimestamp, onDisconnect };

// Шляхи відносно цього модуля — працює і в корені домену, і на GitHub Pages
// у підпапці (раніше було жорстко "/live/patterns/…" і "/play.html").
const HERE = new URL(".", import.meta.url);
export const pageUrl = (rel) => new URL(rel, HERE).href;
// Учні приєднуються на окремому піддомені (репозиторій quizflow-play)
export const PLAY_HOME = "https://play.quizflow.space/";
export const joinUrl = (code) => `${PLAY_HOME}?code=${encodeURIComponent(code)}`;
export const HOME_URL = pageUrl("../");

// ─── Auth ──────────────────────────────────────────────────────────────
export async function requireTeacher() {
  const { getAuth, onAuthStateChanged } = await import(AUTH_URL);
  const auth = getAuth(app);
  const user = await new Promise(r => { const u = onAuthStateChanged(auth, x => { u(); r(x); }); });
  if (!user) {
    const here = "live/" + (location.pathname.split("/").pop() || "") + location.search;
    location.href = pageUrl("../login") + "?next=" + encodeURIComponent(here);
    throw new Error("no auth");
  }
  return user;
}

// ─── Серверний час ─────────────────────────────────────────────────────
// Годинники викладача і учнів можуть розходитись на секунди — таймер і бали
// «за швидкість» рахуємо за часом сервера Firebase.
let _offset = 0;
onValue(ref(db, ".info/serverTimeOffset"), s => { _offset = Number(s.val()) || 0; });
export const serverNow = () => Date.now() + _offset;

// ─── Присутність гравця ────────────────────────────────────────────────
// players/{pid}/online = true, поки вкладка відкрита; сервер сам ставить false,
// коли з'єднання обривається. Викладач не чекає тих, хто вже пішов.
export function trackPresence(code, pid) {
  const onlineRef = ref(db, `rooms/${code}/players/${pid}/online`);
  return onValue(ref(db, ".info/connected"), s => {
    if (s.val() !== true) return;
    onDisconnect(onlineRef).set(false).then(() => set(onlineRef, true)).catch(() => {});
  });
}
export const isActive = (p) => !!p && p.active !== false;
export const isOnline = (p) => isActive(p) && p.online !== false;

// ─── Кодування параметрів ──────────────────────────────────────────────
export function readParams(...keys) {
  const p = new URLSearchParams(location.search);
  return Object.fromEntries(keys.map(k => [k, p.get(k)]));
}
export const isValidCode = (c) => /^\d{8}$/.test(String(c || ""));

// ─── Рядки ─────────────────────────────────────────────────────────────
const ESC = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ESC[c]);

// Текст питання — HTML з конструктора (жирний, курсив, колір). Конструктор
// очищає його при збереженні, але старі тести могли зберегтися раніше — тож
// на екранах гри ще раз лишаємо лише безпечні теги.
const RICH_OK = new Set(["B", "STRONG", "I", "EM", "U", "S", "SUB", "SUP", "BR", "P", "DIV", "SPAN", "UL", "OL", "LI", "CODE", "PRE", "MARK", "SMALL", "IMG"]);
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\))$/i;
// Колір, вибраний у конструкторі, може зливатися з тлом (темно-червоний на темно-синьому екрані гри):
// тоді підкладаємо світлу (або темну) плашку, щоб текст читався за будь-якого кольору.
const ON_DARK = true;
function colorLum(c) {
  let r, g, b;
  const m = c.match(/^#([0-9a-f]{3,8})$/i);
  if (m) { let h = m[1]; if (h.length <= 4) h = h.split("").map(x => x + x).join(""); r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); }
  else { [r, g, b] = (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number); }
  const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
  return .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
}
function markContrast(el, col) {
  const L = colorLum(col);
  if (!Number.isFinite(L)) return;
  const weak = ON_DARK ? L < .265 : L > .183;
  if (!weak) return;
  el.style.background = ON_DARK ? "rgba(255,255,255,.94)" : "#14195A";
  el.style.padding = "0 .28em";
  el.style.borderRadius = ".3em";
  el.style.boxDecorationBreak = "clone";
  el.style.webkitBoxDecorationBreak = "clone";
}
export function richHtml(html) {
  const src = String(html ?? "");
  if (!/[<&]/.test(src)) return esc(src).replace(/\r?\n/g, "<br>");
  const doc = new DOMParser().parseFromString(`<div>${src}</div>`, "text/html");
  const walk = (from, to) => {
    for (const n of [...from.childNodes]) {
      if (n.nodeType === 3) { to.appendChild(document.createTextNode(n.textContent)); continue; }
      if (n.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|SVG|MATH|TEMPLATE|FORM|INPUT|BUTTON|TEXTAREA|SELECT)$/.test(n.tagName)) continue;
      if (!RICH_OK.has(n.tagName)) { walk(n, to); continue; }
      const el = document.createElement(n.tagName);
      if (n.tagName === "IMG") {
        const srcAttr = n.getAttribute("src") || "";
        if (!/^(https:\/\/|data:image\/(png|jpe?g|gif|webp);)/i.test(srcAttr)) continue;
        el.src = srcAttr; el.alt = n.getAttribute("alt") || ""; el.loading = "lazy";
      }
      const col = (n.style?.color || "").trim();
      if (col && COLOR_RE.test(col)) { el.style.color = col; markContrast(el, col); }
      walk(n, el);
      to.appendChild(el);
    }
  };
  const out = document.createElement("div");
  walk(doc.body.firstChild, out);
  return out.innerHTML;
}

// ─── Аватари гравців (герої): обирає учень при вході, діє лише в цій грі ───
// Список генерується: cd tests && npm run avatars (quizflow-play). Картинки — assets/avatars/<id>.svg.
import { AVATARS } from "./avatars.js?v=3";
import { HATS, GLASSES, FIT, SC } from "./accessories.js?v=3";
export { AVATARS, HATS, GLASSES };
const AV_V = 3;                                           // піднімати, коли змінюються картинки
const AV_BY = new Map(AVATARS.map(a => [a.id, a]));
export const avatarInfo = (id) => AV_BY.get(id) || null;
export const avatarSrc = (id) => new URL(`../assets/avatars/${id}.svg?v=${AV_V}`, import.meta.url).href;
export const AVATAR_ID_RE = /^[a-z0-9-]{1,24}$/;
// Без аватара (старі гравці) лишаються ініціали на кольоровому тлі
export const avatarFill = (nick, id) => avatarInfo(id)?.bg || avatarColor(nick);
const HAT_BY = new Map(HATS.map(h => [h.id, h])), GL_BY = new Map(GLASSES.map(g => [g.id, g]));
export const hatInfo = (id) => HAT_BY.get(id) || null;
export const glassesInfo = (id) => GL_BY.get(id) || null;
// Розміщення убору/окулярів: спершу підгонка під героя, потім той самий масштаб, що й у самого героя
const place = (charId, kind, dyExtra = 0) => {
  const [k, sdy] = SC[charId] || [1, 0], [dx, dy, sc] = (FIT[charId] || {})[kind] || [0, 0, 1];
  return `translate(100 ${106 + sdy}) scale(${k}) translate(-100 -106) translate(${100 + dx} ${100 + dy + dyExtra}) scale(${sc}) translate(-100 -100)`;
};
// Герой (+ убір, окуляри). Без аксесуарів — звичайна картинка; з ними — один inline-SVG (id всередині унікальні).
export const avatarInner = (nick, id, opts = {}) => {
  if (!avatarInfo(id)) return esc(initialsOf(nick));
  const hat = HAT_BY.get(opts?.hat), gl = GL_BY.get(opts?.glasses);
  if (!hat && !gl) return `<img src="${esc(avatarSrc(id))}" alt="" draggable="false">`;
  const vb = hat?.tall ? "0 -22 200 200" : "12 8 176 176";
  return `<svg viewBox="${vb}" aria-hidden="true"><image href="${esc(avatarSrc(id))}" x="12" y="8" width="176" height="176"/>`
    + (gl ? `<g transform="${place(id, "gl")}">${gl.svg}</g>` : "")
    + (hat ? `<g transform="${place(id, "hat", hat.dy)}">${hat.svg}</g>` : "") + `</svg>`;
};
export const randomAvatar = () => AVATARS[Math.floor(Math.random() * AVATARS.length)]?.id || "";

export function initialsOf(nick) {
  const parts = String(nick || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (String(nick || "").trim() || "??").slice(0, 2).toUpperCase();
}

const AV_COLORS = ["#5B4FE8","#2F7F9E","#3F8A5A","#B0563E","#7A4FB5","#B0457A","#2E8A86","#9A7A1E"];
export function avatarColor(name) {
  let h = 0;
  for (const ch of String(name || "?")) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

export const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
};
export const fmtNum = (n) => Number(n || 0).toLocaleString("uk");

// ─── Теми ──────────────────────────────────────────────────────────────
// Єдине джерело правди для прев'ю в setup і для екранів гри.
export const THEMES = {
  "g-default": { name:"Океан",     css:"linear-gradient(135deg,#1E3A8A,#0F1844)" },
  "g-night":   { name:"Ніч",       css:"linear-gradient(135deg,#161B45,#0A0D24)" },
  "g-forest":  { name:"Ліс",       css:"linear-gradient(135deg,#1B4D2B,#0B2214)" },
  "g-amber":   { name:"Янтар",     css:"linear-gradient(135deg,#7A2E10,#2E1106)" },
  "g-grape":   { name:"Виноград",  css:"linear-gradient(135deg,#4C1D7A,#1E1648)" },
  "g-sun":     { name:"Сонце",     css:"linear-gradient(135deg,#7A4A08,#2E1A04)" },
  "g-ocean":   { name:"Глибина",   css:"linear-gradient(135deg,#0B5468,#0C1D4A)" },
  "g-violet":  { name:"Електрик",  css:"linear-gradient(135deg,#4527A0,#1A1458)" },
  "g-mint":    { name:"Мʼята",     css:"linear-gradient(135deg,#0C5C48,#052A24)" },
  "g-sky":     { name:"Небо",      css:"linear-gradient(135deg,#1D4E9E,#0C2350)" },
  "g-jade":    { name:"Джейд",     css:"linear-gradient(135deg,#0B5C5C,#052B30)" },
  "g-rose":    { name:"Троянда",   css:"linear-gradient(135deg,#7A1838,#2E0816)" },
  "g-magenta": { name:"Магента",   css:"linear-gradient(135deg,#6A1670,#2A0A33)" },
};

const PAT_DEFS = [
  ["grid","Сітка","64px 64px"], ["dots","Крапки","28px 28px"], ["waves","Хвилі","120px 56px"],
  ["hex","Соти","45.033px 78px"], ["diag","Діагоналі","36px 36px"], ["target","Мішень","112px 112px"],
  ["star","Зірки","96px 96px"], ["snow","Сніжинки","96px 96px"], ["heart","Серця","96px 96px"],
  ["flower","Квіти","104px 104px"], ["leaf","Листя","96px 96px"], ["prism","Призма","88px 88px"],
  ["wave2","Хвилі 2","64px 40px"],
];
export const PATTERNS = Object.fromEntries(PAT_DEFS.map(([id, name, size]) => [id, {
  name, size, bg: `url("${pageUrl(`patterns/${id}.svg?v=2`)}")`,
}]));

export const DEFAULT_THEME = { grad: "g-default", pat: "grid" };

export function applyTheme(theme, gradEl, patEl) {
  const t = { ...DEFAULT_THEME, ...(theme || {}) };
  if (gradEl) {
    gradEl.style.background = (THEMES[t.grad] || THEMES[DEFAULT_THEME.grad]).css;
    gradEl.style.opacity = "1";
  }
  if (patEl) {
    const p = PATTERNS[t.pat];
    patEl.style.backgroundImage = p ? p.bg : "none";
    patEl.style.backgroundSize = p ? p.size : "";
    patEl.style.backgroundRepeat = "repeat";
    patEl.style.opacity = p ? "1" : "0";   // яскравість задана в самих SVG: дрібні мотиви з повітрям, а не суцільна рябизна
  }
}

// ─── Питання й оцінювання ──────────────────────────────────────────────
export const LIVE_TYPES = ["single", "multi", "truefalse", "ordering", "text", "number"];
// Скільки пунктів у впорядкуванні вміщується на телефоні й на проєкторі
export const ORDER_MAX = 6;
export const OPT_CLASSES = ["a","b","c","d","e","f"];
export const OPT_LETTERS = ["A","B","C","D","E","F"];
export const isFreeform = (q) => q?.type === "text" || q?.type === "number";

export const TYPE_LABELS = {
  single: { cls:"single", label:"Одна правильна відповідь" },
  multi:  { cls:"multi",  label:"Кілька правильних відповідей" },
  truefalse: { cls:"truefalse", label:"Правда чи неправда" },
  ordering: { cls:"ordering", label:"Розставте за порядком" },
  text:   { cls:"text",   label:"Впишіть відповідь" },
  number: { cls:"number", label:"Введіть число" },
};
// Значок типу питання (контурний SVG, колір від тексту)
const TYPE_ICONS = {
  single: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none"/>',
  multi:  '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2"/><path d="M5.3 7.3l1.6 1.6 2.4-3"/><rect x="13" y="13" width="7.5" height="7.5" rx="2"/><path d="M14.8 16.8l1.6 1.6 2.4-3"/><path d="M14 6.5h6.5M3.5 17h6.5"/>',
  truefalse: '<path d="M3.5 8.5l3.2 3.2L11.5 5"/><path d="M14 14l6.5 6.5M20.5 14L14 20.5"/>',
  ordering: '<path d="M3 6h12M3 12h9M3 18h6M18 8V20M15 17l3 3 3-3"/>',
  text:   '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
  number: '<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',
};
// Позначка варіанта: буква, а в «Правда / Неправда» — значок ✓ чи ✕ (не лише колір)
export const optMark = (type, i) => type === "truefalse"
  ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${i === 0 ? '<path d="M20 6L9 17l-5-5"/>' : '<path d="M18 6L6 18M6 6l12 12"/>'}</svg>`
  : OPT_LETTERS[i];
// Виразний ярлик типу питання: значок + підпис. Стилі .tchip — у сторінках гри.
export const typeChip = (type, extraCls = "") => {
  const t = TYPE_LABELS[type] || TYPE_LABELS.single;
  return `<span class="tchip ${t.cls} ${extraCls}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TYPE_ICONS[t.cls] || TYPE_ICONS.single}</svg><span>${t.label}</span></span>`;
};
// Усі допустимі текстові відповіді в тому вигляді, як їх написав викладач (для показу)
export const textAnswers = (correct, type) => type === "number"
  ? (String(correct ?? "").trim() ? [String(correct).trim()] : [])
  : String(correct ?? "").split(/\s*(?:або|or|\||\/|,)\s*/i).map(x => x.trim()).filter(Boolean);

// Порівняння текстових відповідей не залежить від регістру, пробілів, лапок, крапок на кінці, апострофів і дефісів:
// «Івано-Франківськ» = «івано франківськ», «Кобзар» = «"Кобзар".»
const normText = (s) => String(s ?? "").trim().toLowerCase()
  .replace(/[’ʼ`‘´]/g, "'").replace(/[«»"“”„]/g, "").replace(/[-‐‑–—_]+/g, " ")
  .replace(/[.,;:!?()…]+/g, " ").replace(/\s+/g, " ").trim();
// Відстань Левенштейна для допуску описок (лише для довгих слів)
function editDist(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// Допуск описок: слово від 6 літер — одна помилка, від 12 — дві; короткі й ті, де є цифри, лише точно
export const typoLimit = (v) => /\d/.test(v) ? 0 : v.length >= 12 ? 2 : v.length >= 6 ? 1 : 0;
// Правильних відповідей у текстовому питанні може бути кілька: «Київ / м. Київ», «HTML, або HyperText…».
// Роздільники ті самі, що в конструкторі й у тесті: «/», «|», кома, «або», «or».
export const textVariants = (correct) => String(correct ?? "").split(/\s*(?:або|or|\||\/|,)\s*/i).map(normText).filter(Boolean);
// Число: «3,5», «1 000», «5 см» — так; «5 6», «1e5», «5-6» — ні (раніше parseFloat мовчки брав початок рядка)
const toNum = (s) => {
  const t = String(s ?? "").trim().replace(/(\d)[\s\u00A0](?=\d{3}(\D|$))/g, "$1");
  const m = t.match(/^([+-]?\d+(?:[.,]\d+)?)\s*([^\d\s.,+-][^\d]*)?$/);
  return m ? parseFloat(m[1].replace(",", ".")) : NaN;
};
// Набір індексів варіантів: без дублікатів і сміття. Firebase інколи віддає
// масив як об'єкт {0:1,1:2} — теж приймаємо.
export function asIndexList(v) {
  const raw = Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [v];
  const nums = raw.filter(x => x !== null && x !== undefined && x !== "" && typeof x !== "boolean")
    .map(Number).filter(n => Number.isInteger(n) && n >= 0);
  return [...new Set(nums)].sort((a, b) => a - b);
}
// Порядок індексів зберігається як є (на відміну від asIndexList, що сортує): [2,0,1] ≠ [0,1,2]
export function orderList(v) {
  const raw = Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];
  return raw.filter(x => typeof x !== "boolean" && x !== null && x !== "").map(Number).filter(n => Number.isInteger(n) && n >= 0);
}
// Пункти впорядкування з питання: без порожніх, не більше ORDER_MAX і не менше двох
export const orderItems = (q) => (Array.isArray(q?.items) ? q.items : Object.values(q?.items || {})).map(x => String(x ?? "").trim()).filter(Boolean);
export const isLiveQuestion = (q) => !!q && LIVE_TYPES.includes(q.type || "single")
  && (q.type !== "ordering" || (orderItems(q).length >= 2 && orderItems(q).length <= ORDER_MAX));
// У публічну кімнату йдуть пункти в перемішаному порядку (options), а правильна послідовність — лише в ключі викладача:
// correct[k] = номер пункту з options, який має стояти на місці k. Перемішане ніколи не збігається з правильним.
export function shuffleOrdering(q, seedStr) {
  const items = orderItems(q), n = items.length;
  let perm = seededOrder(n, seedStr);
  for (let t = 1; t < 24 && perm.every((v, i) => v === i); t++) perm = seededOrder(n, `${seedStr}#${t}`);
  if (perm.every((v, i) => v === i)) perm = perm.slice(1).concat(perm[0]);
  return { options: perm.map(j => items[j]), correct: items.map((_, j) => perm.indexOf(j)) };
}
// Скільки варіантів має обрати учень (для підказки «Оберіть 2»)
export const pickCount = (correct) => asIndexList(correct).length;

// Суворе оцінювання «кількох правильних»: зараховується ЛИШЕ точний збіг.
//   правильні A,C:  A → ✗   A,C → ✓   A,B,C → ✗   A,B,C,D → ✗
// Тож вибрати «все підряд» чи вгадати половину не вийде.
export function checkCorrect(q, correct, value) {
  if (!q || value === undefined || value === null) return false;
  switch (q.type) {
    case "multi": {
      const want = asIndexList(correct), got = asIndexList(value);
      return want.length > 0 && got.length === want.length && got.every((v, i) => v === want[i]);
    }
    case "ordering": {
      const want = orderList(correct), got = orderList(value);
      return want.length >= 2 && got.length === want.length && got.every((v, i) => v === want[i]);
    }
    case "number": { const c = toNum(correct), u = toNum(value); return !isNaN(c) && !isNaN(u) && Math.abs(c - u) < 1e-9; }
    case "text": {
      const v = normText(value);
      if (v === "") return false;
      const vars = [normText(correct), ...textVariants(correct)];
      return vars.some(w => w === v || (w !== "" && typoLimit(w) > 0 && editDist(w, v) <= typoLimit(w)));
    }
    default: {
      // single: рівно один вибраний варіант і він правильний
      const want = asIndexList(correct), got = asIndexList(value);
      return got.length === 1 && want.includes(got[0]);
    }
  }
}

// Відповідь, надіслана пізніше за цей запас після кінця таймера, балів не отримує.
export const LATE_GRACE_MS = 1500;

export function calcPoints({ scoring, isCorrect, elapsedMs, timePerQ }) {
  if (!isCorrect) return 0;
  if (scoring !== "speed") return 1000;
  const ratio = Math.max(0, Math.min(1, 1 - (elapsedMs / 1000) / timePerQ));
  return Math.round(500 + 500 * ratio);
}

// Щільне ранжування: 1,1,2,3 — однаковий бал = однакове місце.
export function denseRank(list, key = "score") {
  let rank = 0, prev = null;
  list.forEach(p => { if (p[key] !== prev) { rank++; prev = p[key]; } p.rank = rank; });
  return list;
}

// Підсумки гри з вузла answers: { pid: { score, correct, answered } }
export function tallyAnswers(allAnswers) {
  const out = {};
  // питання йдуть за номером: серія = правильні підряд до останнього відповіді гравця
  Object.keys(allAnswers || {}).map(Number).sort((x, y) => x - y).forEach(qi => {
    const qA = allAnswers[qi] || allAnswers[String(qi)] || {};
    Object.entries(qA).forEach(([pid, a]) => {
      const t = out[pid] || (out[pid] = { score: 0, correct: 0, answered: 0, streak: 0 });
      t.score += Number(a?.points) || 0;
      if (a?.isCorrect) { t.correct++; t.streak++; } else if (typeof a?.isCorrect === "boolean") t.streak = 0;
      t.answered++;
    });
  });
  return out;
}

// Порядок серед рівних за результатом не за алфавітом (інакше «Аня» завжди вище за «Ярика»),
// а стабільний «випадковий» за кодом гравця: однаковий на всіх екранах.
function tieKey(pid) { let h = 2166136261; for (const ch of String(pid)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export function standings(players, allAnswers) {
  const tally = tallyAnswers(allAnswers);
  const list = Object.entries(players || {})
    .filter(([, p]) => p && p.active !== false)
    .map(([pid, p]) => ({ pid, nickname: p.nickname || "—", avatar: p.avatar || "", hat: p.hat || "", glasses: p.glasses || "", ...(tally[pid] || { score: 0, correct: 0, answered: 0, streak: 0 }) }))
    .sort((a, b) => b.score - a.score || b.correct - a.correct || tieKey(a.pid) - tieKey(b.pid));
  return denseRank(list);
}

// Компактна таблиця для телефонів учнів: { pid: { r: місце, s: бали, g: до попереднього місця, n: гравців } }.
// Викладач пише її разом із розкриттям відповіді — учень слухає лише свій рядок
// замість усіх відповідей класу.
export function rankMap(list) {
  const out = {};
  let prevRankScore = null, lastScore = null, lastRank = 0;
  list.forEach(p => {
    if (p.rank !== lastRank) { prevRankScore = lastScore; lastRank = p.rank; lastScore = p.score; }
    out[p.pid] = { r: p.rank, s: p.score, k: p.correct, st: p.streak || 0, g: p.rank > 1 && prevRankScore != null ? prevRankScore - p.score : 0, n: list.length };
  });
  return out;
}

// Детерміноване перемішування (однакове для учня після перезавантаження).
// Рядок-зерно → 32-бітний хеш з повним «лавинним» перемішуванням (murmur3) → генератор mulberry32:
// сусідні зерна («p1:3» і «p1:4») дають зовсім різні послідовності, а не схожі.
export function seededOrder(n, seedStr) {
  let h = 1779033703 ^ String(seedStr).length;
  for (const ch of String(seedStr)) { h = Math.imul(h ^ ch.codePointAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
  let a = h >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < 4; i++) rnd();   // прогрів
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order;
}


// Варіанти на кшталт «Усе вищеперелічене», «Жоден із варіантів», «А і Б» мають сенс лише на своєму місці: не перемішуємо
const PINNED_RE = /^\s*(?:(?:усе|все|всі|усі)\s+(?:вище|вищевказан\S*|вищеперелічен\S*|вищенаведен\S*|наведен\S*|перелічен\S*|з\s+перелічен\S*|з\s+вищеперелічен\S*|відповіді|варіанти|правильн\S*)|(?:жоден|жодна|жодне|жодні)(?:\s+(?:з|із)(?![\p{L}]).*)?\s*$|(?:немає|нема)\s+правильн\S*|(?:обидва|обидві|обоє)(?![\p{L}])|[а-дa-d]\s*(?:і|й|та|,|\+|and)\s*[а-дa-d]\s*[.)]?\s*$)/iu;
export const isPinnedOption = (t) => PINNED_RE.test(String(t ?? ""));
// Порядок показу варіантів: решта перемішується, закріплені лишаються на своїх місцях
export function optionOrder(options, seedStr) {
  const n = (options || []).length;
  const pinned = new Set(); (options || []).forEach((o, i) => { if (isPinnedOption(o)) pinned.add(i); });
  const free = []; for (let i = 0; i < n; i++) if (!pinned.has(i)) free.push(i);
  const mixed = seededOrder(free.length, seedStr).map(k => free[k]);
  const out = []; let f = 0;
  for (let i = 0; i < n; i++) out.push(pinned.has(i) ? i : mixed[f++]);
  return out;
}

// Порядок показу для питання qi з урахуванням попередніх: жоден (не закріплений) варіант не стає на те саме місце,
// що й у попередньому питанні. Тож якщо в тесті скрізь правильна, скажімо, третя відповідь, вона не «прилипає» до одного місця.
// Усе детерміновано: ті самі questions і seedBase завжди дають той самий порядок.
export function optionOrderFor(questions, qi, seedBase) {
  let prev = null, cur = null;
  for (let k = 0; k <= qi; k++) {
    const opts = (questions && questions[k] && questions[k].options) || [];
    const pinned = opts.map(isPinnedOption);
    const clash = (o) => prev && prev.length === o.length && o.some((v, s) => !pinned[s] && v === prev[s]);
    const freeN = pinned.filter(x => !x).length;
    cur = optionOrder(opts, `${seedBase}:${k}`);
    if (freeN >= 3 && clash(cur)) {
      let ok = null;
      for (let t = 1; t <= 16 && !ok; t++) { const o = optionOrder(opts, `${seedBase}:${k}#${t}`); if (!clash(o)) ok = o; }
      if (!ok) {   // запасний шлях: зсунути вільні місця попереднього порядку на одне
        const fs = []; for (let s = 0; s < opts.length; s++) if (!pinned[s]) fs.push(s);
        ok = prev.slice(); fs.forEach((s, x) => { ok[s] = prev[fs[(x + 1) % fs.length]]; });
      }
      cur = ok;
    }
    prev = cur;
  }
  return cur || [];
}

// ─── Підписки ──────────────────────────────────────────────────────────
// Слухає кілька вузлів і викликає cb один раз на «пачку» змін — multi-path
// update від викладача приходить як кілька подій в одному такті, тож без
// цього сторінка бачила б проміжні стани (новий currentQ зі старим статусом).
export function watchFields(base, fields, cb) {
  const state = {};
  const seen = new Set();
  let queued = false;
  const flush = () => { queued = false; if (seen.size === fields.length) cb({ ...state }); };
  const unsubs = fields.map(f => onValue(ref(db, `${base}/${f}`), s => {
    state[f] = s.val();
    seen.add(f);
    if (!queued) { queued = true; queueMicrotask(flush); }
  }));
  return () => unsubs.forEach(u => u());
}

// ─── Автопідбір розміру тексту ─────────────────────────────────────────
// Короткий текст — великим шрифтом, довгий — меншим, але так, щоб вміщувався
// в заданий простір без обрізання. Двійковий пошук по розміру шрифту.
export function fitText(el, { max, min, maxHeight }) {
  if (!el) return min;
  const fits = () => el.scrollHeight <= maxHeight + 1;
  el.style.fontSize = max + "px";
  if (fits()) return max;
  let lo = min, hi = max;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    el.style.fontSize = mid + "px";
    if (fits()) lo = mid; else hi = mid;
  }
  el.style.fontSize = lo + "px";
  return lo;
}
// Однаковий розмір для групи (варіанти відповідей) — за найдовшим
export function fitGroup(els, opts) {
  const list = [...els];
  if (!list.length) return;
  const size = Math.min(...list.map(el => fitText(el, opts)));
  list.forEach(el => { el.style.fontSize = size + "px"; });
  return size;
}
// Перерахунок при зміні розміру вікна та після завантаження картинок у питанні
export function onRefit(fn, root) {
  let raf = 0;
  const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fn); };
  window.addEventListener("resize", run);
  root?.addEventListener("load", run, true);   // img load не спливає — ловимо на capture
  document.fonts?.ready?.then(run);
  return run;
}

// ─── UI-дрібниці ───────────────────────────────────────────────────────
export function toast(msg, kind = "info", ms = 3200) {
  let host = document.getElementById("lv-toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "lv-toasts";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    host.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1000;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:max-content;max-width:calc(100vw - 32px)";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  const bg = kind === "err" ? "#B42323" : kind === "ok" ? "#1F7A4A" : "#201C33";
  el.style.cssText = `background:${bg};color:#fff;padding:11px 18px;border-radius:12px;font:600 14px/1.35 Manrope,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.28);pointer-events:auto;transition:opacity .25s,transform .25s;opacity:0;transform:translateY(8px)`;
  el.textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "none"; });
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, ms);
}

// Власне вікно підтвердження замість confirm(): на проєкторі й телефонах
// системне вікно виглядає чужорідно, а в повноекранному режимі ще й виходить з нього.
export function confirmDlg({ title, text = "", ok = "Так", cancel = "Скасувати", danger = false } = {}) {
  return new Promise(resolve => {
    const prevFocus = document.activeElement;
    const bd = document.createElement("div");
    bd.className = "lv-dlg-bd";
    bd.innerHTML = `<div class="lv-dlg" role="alertdialog" aria-modal="true" aria-labelledby="lv-dlg-t" aria-describedby="lv-dlg-x">
      <h2 id="lv-dlg-t">${esc(title)}</h2>${text ? `<p id="lv-dlg-x">${esc(text)}</p>` : ""}
      <div class="lv-dlg-a"><button type="button" data-v="0">${esc(cancel)}</button><button type="button" data-v="1" class="${danger ? "danger" : "ok"}">${esc(ok)}</button></div></div>`;
    if (!document.getElementById("lv-dlg-css")) {
      const st = document.createElement("style"); st.id = "lv-dlg-css";
      st.textContent = `.lv-dlg-bd{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;padding:20px;background:rgba(8,10,30,.55);backdrop-filter:blur(6px);animation:lvDlgF .15s ease-out}
.lv-dlg{width:100%;max-width:400px;background:#fff;color:#1D1930;border-radius:18px;padding:22px 22px 18px;box-shadow:0 30px 70px -20px rgba(0,0,0,.5);font-family:Manrope,system-ui,sans-serif;animation:lvDlgU .2s cubic-bezier(.22,1,.36,1)}
.lv-dlg h2{margin:0;font-size:18px;font-weight:800;letter-spacing:-.01em;line-height:1.3}
.lv-dlg p{margin:8px 0 0;font-size:14px;line-height:1.5;color:#5F5876}
.lv-dlg-a{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}
.lv-dlg-a button{font:700 14px Manrope,system-ui,sans-serif;padding:11px 16px;border-radius:11px;border:1.5px solid #E4E1F4;background:#fff;color:#1D1930;cursor:pointer}
.lv-dlg-a button:hover{background:#F6F5FB}
.lv-dlg-a .ok{background:#5B4FE8;border-color:#5B4FE8;color:#fff}.lv-dlg-a .ok:hover{background:#4A3FD1}
.lv-dlg-a .danger{background:#D14343;border-color:#D14343;color:#fff}.lv-dlg-a .danger:hover{background:#B83636}
.lv-dlg-a button:focus-visible{outline:2.5px solid #5B4FE8;outline-offset:2px}
@keyframes lvDlgF{from{opacity:0}}@keyframes lvDlgU{from{opacity:0;transform:translateY(10px) scale(.98)}}`;
      document.head.appendChild(st);
    }
    const close = (v) => { document.removeEventListener("keydown", onKey, true); bd.remove(); prevFocus?.focus?.({ preventScroll: true }); resolve(v); };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(false); }
      else if (e.key === "Tab") {           // фокус не виходить за межі вікна
        const b = [...bd.querySelectorAll("button")], i = b.indexOf(document.activeElement);
        e.preventDefault(); b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus();
      } else e.stopPropagation();           // пробіл/Enter/P не доходять до гарячих клавіш сторінки
    };
    bd.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) close(b.dataset.v === "1"); else if (e.target === bd) close(false); });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(bd);
    bd.querySelector(danger ? "[data-v='0']" : "[data-v='1']").focus();
  });
}

export function fatal(msg, backHref = HOME_URL) {
  document.body.innerHTML = `<div style="min-height:100vh;display:grid;place-items:center;padding:24px;font-family:system-ui,sans-serif;background:#F6F5FB;color:#201C33;text-align:center">
    <div style="max-width:420px"><div style="width:60px;height:60px;margin:0 auto 12px;border-radius:18px;background:#FEF3C7;color:#B45309;display:grid;place-items:center"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
    <h1 style="font-size:22px;margin:0 0 8px">${esc(msg)}</h1>
    <a href="${esc(backHref)}" style="display:inline-block;margin-top:14px;padding:11px 20px;border-radius:10px;background:#5B4FE8;color:#fff;text-decoration:none;font-weight:700">Повернутися</a></div></div>`;
  throw new Error(msg);
}

// Чи дозволено викладачу (дозволи з адмінки). Достатньо будь-якого з перелічених.
// Недоступна сторінка за прямим посиланням показує пояснення замість гри.
export async function requirePerm(uid, ...perms) {
  let caps = null;
  try {
    const { loadCaps } = await import("../shared/caps.js?v=4");
    const prof = (await get(ref(db, `users/${uid}`))).val() || {};
    caps = await loadCaps(db, { ...prof, role: prof.role || "teacher" });
  } catch { return null; }                       // базу не прочитали — не блокуємо
  if (!perms.some(p => caps.perms[p] !== false)) fatal("Ця дія недоступна для вашого акаунта. Зверніться до адміністратора.");
  return caps;
}

export const safeStore = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
