// ═══════════════════════════════════════════════════════════════════════
// shared/dash.js — дашборд викладача (лише index.html).
// Швидкі дії: запуск гри й посилання в один клік, останні тести, активні
// посилання, останні ігри. Без таблиць статистики. Дані тестів — з app.js/features.js
// (window.attempts / links / tests), ігри — власні слухачі тут.
// ═══════════════════════════════════════════════════════════════════════
import { watchRooms, liveRooms, roomTarget, roomState, IN_GAME } from "./rooms.js?v=1";
const { db, ref, onValue } = window._fb;
const uid = window._uid;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const qf = () => window._qf || {};
const plural = (n, f) => (qf().plural ? qf().plural(n, f) : f[2]);
const DAY = 864e5;
const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const toMs = v => typeof v === "number" ? v : Number(v) || 0;
const fmtDay = t => {
  if (!t) return "";
  const ds = dayStart(t), today = dayStart(Date.now());
  const time = new Date(t).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
  if (ds === today) return `сьогодні, ${time}`;
  if (ds === today - DAY) return `вчора, ${time}`;
  return new Date(t).toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
};
const svg = (d, w = 16, sw = 2) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  play:   '<polygon points="6 4 20 12 6 20 6 4"/>',
  send:   '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  users:  '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  file:   '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>',
  pulse:  '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  chart:  '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M3 20h18"/>',
  clock:  '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  flag:   '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  link:   '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
  chev:   '<polyline points="9 18 15 12 9 6"/>',
  plus:   '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  check:  '<polyline points="20 6 9 17 4 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x:      '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  monitor:'<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
};
const PAL = ["#2563EB", "#7C3AED", "#0D9488", "#EA580C", "#DB2777", "#0891B2", "#4F46E5", "#16A34A"];
const colorFor = s => { let h = 0; for (const ch of String(s || "")) h = (h * 31 + ch.codePointAt(0)) >>> 0; return PAL[h % PAL.length]; };
const abbr = t => { const w = String(t || "").match(/[\p{L}\p{N}]+/gu) || ["?"]; return (w.length === 1 ? w[0].slice(0, 2) : w.slice(0, 2).map(x => x[0]).join("")).toUpperCase(); };
const gradeTone = g => g == null ? "" : g >= 10 ? "ok" : g >= 7 ? "info" : g >= 4 ? "warn" : "bad";

// ─── Ігри: історія та кімнати, що зараз ідуть ─────────────────────────
const D = { games: null, rooms: new Map() };

function prepGame(code, g){
  const res = (Array.isArray(g.results) ? g.results : Object.values(g.results || {})).filter(Boolean)
    .map(r => ({ nick: r.nickname || "—", score: Number(r.score) || 0, correct: r.correct == null ? null : Number(r.correct) }))
    .sort((a, b) => b.score - a.score);
  const qc = Number(g.questionCount) || 0;
  const wc = res.filter(r => r.correct != null);
  return {
    code, title: g.testTitle || "Без назви", testId: g.testId || "", at: toMs(g.playedAt),
    n: res.length || Number(g.playerCount) || 0, qc, top: res[0] || null,
    acc: qc && wc.length ? Math.round(wc.reduce((s, r) => s + r.correct, 0) / (wc.length * qc) * 100) : null,
  };
}
onValue(ref(db, `teachers/${uid}/gameHistory`), snap => {
  D.games = Object.entries(snap.val() || {}).map(([c, g]) => prepGame(c, g || {})).sort((a, b) => b.at - a.at);
  schedule();
}, () => { D.games = []; schedule(); });

D.rooms = watchRooms(uid, () => schedule());

// ─── Рендер (з дебаунсом: дані тестів і ігор приходять хвилями) ───────
let raf = 0;
function schedule(){ if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
window.renderDash = schedule;
document.addEventListener("qf:live", schedule);

function render(){
  if (!$("sec-dashboard")) return;
  const A = window.attempts || [], L = window.links || [], T = window.tests || [];
  const now = Date.now();
  const games = D.games || [];

  // Шапка
  const h = new Date().getHours();
  const name = (window._user?.name || "").trim().split(/\s+/)[0] || window._user?.login || "";
  $("dx-hello").textContent = (h < 5 ? "Доброї ночі" : h < 12 ? "Доброго ранку" : h < 18 ? "Добрий день" : "Добрий вечір") + (name ? `, ${name}` : "");
  const td = dayStart(now);
  const gToday = games.filter(g => g.at >= td).length, aToday = A.filter(a => (a.createdAt || 0) >= td).length;
  const date = new Date().toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });
  $("dx-sub").textContent = [date.charAt(0).toUpperCase() + date.slice(1),
    gToday ? `${gToday} ${plural(gToday, ["гра", "гри", "ігор"])} сьогодні` : "",
    aToday ? `${aToday} ${plural(aToday, ["спроба", "спроби", "спроб"])} сьогодні` : ""].filter(Boolean).join(" · ");

  // Підписи швидких дій: що було востаннє, що чекає
  const lastG = games[0];
  $("dx-q-game").textContent = lastG ? `Остання: ${lastG.title}` : "Вікторина для класу";
  const openLinks = L.filter(l => qf().isOpenState?.(qf().linkState?.(l, now)));
  $("dx-q-link").textContent = openLinks.length ? `${openLinks.length} ${plural(openLinks.length, ["активне", "активні", "активних"])} зараз` : "Для студентів";
  const pend = A.filter(a => a.status === "pending_review").length;
  $("dx-q-revs").textContent = pend ? "Оцініть відкриті питання" : "Усе перевірено";
  const nb = $("dx-q-revn"); nb.hidden = !pend; nb.textContent = pend;

  renderNow(A, L, now);
  renderTests(A, L, T, games, now);
  renderLinks(A, L, T, now);
  renderGames(games, T);
  renderStart(A, L, T, games);
}

// «Зараз»: ігри, що йдуть, студенти в тестах, і що потребує уваги
function renderNow(A, L, now){
  const box = $("dx-now"); if (!box) return;
  const items = [];
  liveRooms(D.rooms).forEach(r => {
    const inGame = IN_GAME.includes(r.status);
    const target = roomTarget(r), state = roomState(r);
    items.push(`<a class="dx-now-it game" href="live/${target}?code=${encodeURIComponent(r.code)}" target="_blank" rel="noopener">
      <span class="dx-now-ic">${inGame ? '<i class="dx-pulse"></i>' : ""}${svg(IC.play, 15)}</span>
      <span class="dx-now-b" title="${esc(r.title)}"><b>Гра ${esc(r.code)} · ${r.players.length} ${plural(r.players.length, ["гравець", "гравці", "гравців"])}</b><small>${esc(state)}${r.title ? ` · ${esc(r.title)}` : ""}</small></span>
      <span class="dx-now-go">${svg(IC.chev, 14, 2.5)}</span></a>`);
  });
  const online = A.filter(a => qf().isOnline ? qf().isOnline(a, now) : a.status === "in_progress");
  if (online.length){
    const tIds = [...new Set(online.map(a => a.testId))];
    const tt = tIds.length === 1 ? (window.tests || []).find(t => t.id === tIds[0])?.title : "";
    items.push(`<a class="dx-now-it live" href="online">
      <span class="dx-now-ic"><i class="dx-pulse"></i>${svg(IC.users, 15)}</span>
      <span class="dx-now-b"><b>${online.length} ${plural(online.length, ["проходить", "проходять", "проходять"])} тест зараз</b><small>${tt ? esc(tt) : `${tIds.length} ${plural(tIds.length, ["тест", "тести", "тестів"])}`}</small></span>
      <span class="dx-now-go">${svg(IC.chev, 14, 2.5)}</span></a>`);
  }
  const susp = qf().suspNewCount?.() || 0;
  if (susp) items.push(`<a class="dx-now-it bad" href="suspicious">
      <span class="dx-now-ic">${svg(IC.flag, 15)}</span>
      <span class="dx-now-b"><b>${susp} ${plural(susp, ["нова підозріла", "нові підозрілі", "нових підозрілих"])}</b><small>Виходи, копіювання, скріншоти</small></span>
      <span class="dx-now-go">${svg(IC.chev, 14, 2.5)}</span></a>`);
  box.hidden = !items.length;
  box.innerHTML = items.length ? `<div class="dx-sec-l">Зараз</div><div class="dx-now-list">${items.join("")}</div>` : "";
}

const timeAgoShort = t => fmtDay(t);
const btn = (cls, act, id, label, icon, title = "") => `<button type="button" class="dx-qb ${cls}" data-dxa="${act}" data-id="${esc(id)}"${title ? ` title="${esc(title)}" aria-label="${esc(title)}"` : ""}>${icon ? svg(icon, 13, 2.2) : ""}${label}</button>`;
const IC2 = { edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>', copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>', redo: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>', list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>' };

// «Ваші тести»: з чим ви працювали останнім — одразу «Гра» і «Посилання»
function renderTests(A, L, T, games, now){
  const box = $("dx-tests"); if (!box) return;
  const live = T.filter(t => t.status !== "archived" && (t.questions || []).length);
  const last = new Map(), bump = (id, at) => { if (id && at > (last.get(id) || 0)) last.set(id, at); };
  games.forEach(g => bump(g.testId, g.at)); L.forEach(l => bump(l.testId, toMs(l.createdAt))); A.forEach(a => bump(a.testId, toMs(a.createdAt)));
  const list = live.map(t => ({ t, at: Math.max(last.get(t.id) || 0, toMs(t.updatedAt), toMs(t.createdAt)) })).sort((a, b) => b.at - a.at).slice(0, 6);
  const cnt = $("dx-tests-cnt"); if (cnt) cnt.textContent = live.length ? `${live.length}` : "";
  if (!live.length){
    box.innerHTML = `<div class="dx-empty"><span class="dx-empty-ic">${svg(IC.file, 22)}</span><b>Ще немає тестів</b><span>Створіть перший тест: з нього можна зробити і гру, і посилання для студентів.</span><button type="button" class="dx-btn p" data-dx="new">${svg(IC.plus, 13, 2.4)}Новий тест</button></div>`;
    return;
  }
  box.innerHTML = list.map(({ t, at }) => {
    const c = colorFor(t.id), qn = (t.questions || []).length;
    const used = last.get(t.id) ? `використано ${fmtDay(last.get(t.id))}` : "ще не використано";
    return `<div class="dx-qr"><span class="dx-tile" style="background:${c}1A;color:color-mix(in srgb,${c} 66%,#0B1437)">${esc(abbr(t.title))}</span>
      <span class="dx-row-b"><b>${esc(t.title || "Без назви")}</b><small>${qn} ${plural(qn, ["питання", "питання", "питань"])} · ${esc(used)}</small></span>
      <span class="dx-qa">${btn("g", "game", t.id, "Гра", IC.play)}${btn("", "link", t.id, "Посилання", IC.link)}${btn("ic", "edit", t.id, "", IC2.edit, "Редагувати")}</span></div>`;
  }).join("") + `<div class="dx-all"><a class="go" href="tests">Усі тести${svg(IC.chev, 12, 2.5)}</a></div>`;
}

// Активні посилання: скопіювати одним натисканням
function renderLinks(A, L, T, now){
  const box = $("dx-links"); if (!box) return;
  const st = qf().linkState || (() => "active");
  const cntBy = new Map(); A.forEach(a => { if (a.linkId) cntBy.set(a.linkId, (cntBy.get(a.linkId) || 0) + 1); });
  const open = L.filter(l => qf().isOpenState?.(st(l, now)))
    .sort((a, b) => (a.closeAt || Infinity) - (b.closeAt || Infinity) || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 4);
  if (!open.length){
    box.innerHTML = `<div class="dx-mini-empty">Немає активних посилань · <button type="button" data-dx="test">створити</button></div>`;
    return;
  }
  box.innerHTML = open.map(l => {
    const t = T.find(x => x.id === l.testId), n = cntBy.get(l.id) || 0, max = qf().lnkMax?.(l) || 0, s = st(l, now);
    const when = s === "scheduled" ? `відкриється ${fmtDay(l.openAt)}` : l.closeAt ? `до ${fmtDay(l.closeAt)}` : "без терміну";
    const soon = l.closeAt && l.closeAt - now < DAY && s !== "scheduled";
    return `<div class="dx-qr"><span class="dx-row-b"><b>${esc(t?.title || "Тест видалено")}</b><small>${l.group ? `${esc(l.group)} · ` : ""}<span class="${soon ? "soon" : ""}">${esc(when)}</span> · ${n}${max ? `/${max}` : ""} ${plural(n, ["спроба", "спроби", "спроб"])}</small></span>
      <span class="dx-qa">${btn("", "copy", l.id, "Копіювати", IC2.copy)}${btn("ic", "results", l.id, "", IC2.list, "Результати")}</span></div>`;
  }).join("");
}

// Останні ігри: «Ще раз» — той самий тест одним вікном
function renderGames(games, T){
  const box = $("dx-games"); if (!box) return;
  if (D.games === null){ box.innerHTML = `<div class="dx-skel"></div><div class="dx-skel"></div>`; return; }
  if (!games.length){
    box.innerHTML = `<div class="dx-mini-empty">Ще не було жодної гри · <button type="button" data-dx="game">провести першу</button></div>`;
    return;
  }
  box.innerHTML = games.slice(0, 4).map(g => {
    const c = colorFor(g.testId || g.title), exists = T.some(t => t.id === g.testId && (t.questions || []).length);
    return `<div class="dx-qr"><span class="dx-tile" style="background:${c}1A;color:color-mix(in srgb,${c} 66%,#0B1437)">${esc(abbr(g.title))}</span>
      <span class="dx-row-b"><b>${esc(g.title)}</b><small>${esc(fmtDay(g.at))} · ${g.n} ${plural(g.n, ["гравець", "гравці", "гравців"])}${g.top ? ` · переміг ${esc(g.top.nick)}` : ""}</small></span>
      <span class="dx-qa">${exists ? btn("g", "game", g.testId, "Ще раз", IC2.redo) : ""}</span></div>`;
  }).join("");
}

// «Почніть роботу» — поки новий викладач не спробував обидва режими
function renderStart(A, L, T, games){
  const box = $("dx-start"); if (!box) return;
  const steps = [
    { done: T.some(t => t.status !== "archived" && (t.questions || []).length), t: "Створіть тест", s: "Питання для гри й для тесту — одні й ті самі", act: "new", btn: "Створити" },
    { done: games.length > 0 || D.rooms.size > 0, t: "Проведіть гру наживо", s: "Вікторина на уроці: учні заходять за кодом", act: "game", btn: "Запустити" },
    { done: L.length > 0, t: "Надішліть тест за посиланням", s: "Самостійна чи контрольна у зручний час", act: "test", btn: "Надіслати" },
  ];
  const n = steps.filter(x => x.done).length;
  // Лише поки немає жодного тесту: далі всі дії вже на плитках зверху
  if (D.games === null || n === steps.length || T.some(t => t.status !== "archived" && (t.questions || []).length)){ box.hidden = true; return; }
  const next = steps.findIndex(x => !x.done);
  box.hidden = false;
  box.innerHTML = `<div class="dx-start-h"><b>Почніть роботу з QuizFlow</b><span>${n} з ${steps.length}</span><span class="dx-bar"><i style="width:${Math.round(n / steps.length * 100)}%"></i></span></div>
    <ol>${steps.map((x, i) => `<li class="${x.done ? "done" : i === next ? "next" : ""}">
      <span class="n">${x.done ? svg(IC.check, 12, 3) : i + 1}</span><span class="dx-row-b"><b>${x.t}</b><small>${x.s}</small></span>
      ${x.done ? "" : `<button type="button" class="dx-btn ${i === next ? "p" : ""}" data-dx="${x.act}">${x.btn}</button>`}</li>`).join("")}</ol>`;
}

// ─── Вибір тесту для гри (власний список з пошуком, без <select>) ──────
function openPicker(){
  const T = (window.tests || []).filter(t => t.status !== "archived" && (t.questions || []).length);
  const played = new Map(); (D.games || []).forEach(g => { if (!played.has(g.testId)) played.set(g.testId, { n: 0, at: g.at }); played.get(g.testId).n++; });
  const list = T.map(t => ({ t, p: played.get(t.id) })).sort((a, b) => (b.p?.at || 0) - (a.p?.at || 0) || (b.t.updatedAt || b.t.createdAt || 0) - (a.t.updatedAt || a.t.createdAt || 0));
  const dlg = $("dx-pick"), inp = $("dx-pick-q"), box = $("dx-pick-list");
  let kb = 0;
  const draw = () => {
    const q = inp.value.trim().toLowerCase();
    const rows = q ? list.filter(x => (x.t.title || "").toLowerCase().includes(q)) : list;
    kb = Math.min(kb, Math.max(0, rows.length - 1));
    box.innerHTML = rows.length ? rows.map((x, i) => {
      const qn = (x.t.questions || []).length, c = colorFor(x.t.id);
      return `<button type="button" class="dx-pick-it${i === kb ? " kb" : ""}" data-tid="${esc(x.t.id)}">
        <span class="dx-tile" style="background:${c}1A;color:color-mix(in srgb,${c} 66%,#0B1437)">${esc(abbr(x.t.title))}</span>
        <span class="dx-row-b"><b>${esc(x.t.title || "Без назви")}</b><small>${qn} ${plural(qn, ["питання", "питання", "питань"])}${x.p ? ` · грали ${x.p.n} ${plural(x.p.n, ["раз", "рази", "разів"])}, ост. ${esc(fmtDay(x.p.at))}` : ""}</small></span>
        <span class="dx-pick-go">${svg(IC.play, 12)}</span></button>`;
    }).join("") : `<div class="dx-mini-empty">${list.length ? "Нічого не знайдено" : `Немає тестів з питаннями · <button type="button" data-dx="new">створити тест</button>`}</div>`;
    box.querySelector(".kb")?.scrollIntoView({ block: "nearest" });
    return rows;
  };
  let rows = [];
  inp.value = ""; rows = draw();
  dlg.hidden = false; requestAnimationFrame(() => dlg.classList.add("on"));
  setTimeout(() => inp.focus(), 30);
  inp.oninput = () => { kb = 0; rows = draw(); };
  inp.onkeydown = e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp"){ e.preventDefault(); kb = (kb + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % Math.max(1, rows.length); rows = draw(); }
    else if (e.key === "Enter" && rows[kb]){ e.preventDefault(); launch(rows[kb].t.id); }
  };
}
function closePicker(){ const d = $("dx-pick"); if (!d || d.hidden) return; d.classList.remove("on"); setTimeout(() => { d.hidden = true; }, 160); }
function launch(tid){ closePicker(); window.G?.gameModal?.(tid); }

// ─── Делеговані дії ───────────────────────────────────────────────────
document.addEventListener("click", e => {
  const act = e.target.closest("[data-dx]")?.dataset.dx;
  if (act === "game") return openPicker();
  if (act === "test") return window.G?.newLink?.();
  if (act === "new") { closePicker(); return window.G?.openTestInFolder?.(null); }
  if (act === "pick-close" || e.target.id === "dx-pick") return closePicker();
  const it = e.target.closest(".dx-pick-it"); if (it) return launch(it.dataset.tid);
  const qa = e.target.closest("[data-dxa]");
  if (qa){
    const id = qa.dataset.id, G = window.G;
    switch (qa.dataset.dxa){
      case "game": return G?.gameModal?.(id);
      case "link": return G?.qLink?.(id);
      case "edit": location.href = `constructor?id=${encodeURIComponent(id)}`; return;
      case "copy": return G?.copyLink?.(id, qa);
      case "results": return G?.linkResults?.(id);
    }
  }
  const att = e.target.closest(".dx-act[data-att]"); if (att) return window.G?.viewAtt?.(att.dataset.att);
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("dx-pick")?.hidden) { e.stopPropagation(); closePicker(); } }, true);

schedule();
// ./?game=1 (напр. зі сторінки «Онлайн») — одразу вибір тесту для гри
if (new URLSearchParams(location.search).get("game") === "1"){
  history.replaceState(null, "", location.pathname);
  setTimeout(openPicker, 400);
}
