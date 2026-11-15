// Юніт-тести логіки дозволів (shared/perms.js): без браузера.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
// shared/perms.js — браузерний ES-модуль без package.json поруч; для Node вантажимо його вміст як модуль
const src = fs.readFileSync(new URL("../../shared/perms.js", import.meta.url), "utf8");
const { resolvePerms, normalizeCfg, pageAllowed, conflicts, PERM_KEYS, WRITE_KEYS, PERMS, IMPLIES, PAGE_PERMS, pagePerm } =
  await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));

const T = (cfg, profile, nav) => resolvePerms(cfg, profile, nav).perms;

test("за замовчуванням викладачу дозволено все", () => {
  const p = T({}, { role: "teacher" });
  PERM_KEYS.forEach(k => expect(p[k], k).toBe(true));
});

test("для всіх: вимкнений дозвіл вимкнений скрізь, поки роль чи людина не дозволить", () => {
  const cfg = { v: 2, perms: { "games.run": false } };
  expect(T(cfg, { role: "teacher" })["games.run"]).toBe(false);
  const withRole = { ...cfg, roles: { r1: { perms: { "games.run": true } } } };
  expect(T(withRole, { role: "teacher", customRoleIds: { r1: true } })["games.run"]).toBe(true);
  expect(T(withRole, { role: "teacher" })["games.run"]).toBe(false);
});

test("особисте налаштування сильніше за роль і за «для всіх»", () => {
  const cfg = { v: 2, roles: { r1: { perms: { export: true } } }, perms: { export: false } };
  const prof = { role: "teacher", customRoleIds: { r1: true }, features: { perms: { export: false } } };
  expect(resolvePerms(cfg, prof).perms.export).toBe(false);
  expect(resolvePerms(cfg, prof).src.export).toBe("user");
});

test("ролі лише додають: достатньо однієї, що дозволяє; «Ні» в ролі нічого не забороняє", () => {
  const cfg = { v: 2, perms: { ai: false }, roles: { a: { perms: { "ai": false } }, b: { perms: { "ai": true } } } };
  expect(T(cfg, { role: "teacher", customRoleIds: { a: true, b: true } }).ai).toBe(true);
  expect(T(cfg, { role: "teacher", customRoleIds: { a: true } }).ai).toBe(false);   // база закрита, роль не дає
  expect(T({ v: 2, roles: { a: { perms: { ai: false } } } }, { role: "teacher", customRoleIds: { a: true } }).ai).toBe(true);   // база відкрита, «Ні» в ролі не діє
});

test("залежності вмикаються самі, але особисте «Ні» не відновлюється", () => {
  const cfg = { v: 2, perms: { "tests.view": false, "tests.use": false } , roles: { r: { perms: { "tests.edit": true, "games.run": true } } } };
  const p = T(cfg, { role: "teacher", customRoleIds: { r: true } });
  expect(p["tests.view"]).toBe(true);        // з tests.edit
  expect(p["tests.use"]).toBe(true);         // з games.run і tests.view
  const own = T(cfg, { role: "teacher", customRoleIds: { r: true }, features: { perms: { "tests.view": false } } });
  expect(own["tests.view"]).toBe(false);
});

test("роль «лише ігри»: тести бачить для вибору, сторінки «Тести» і редагування немає", () => {
  const cfg = { v: 2, perms: { "tests.view": false, "tests.edit": false, "tests.import": false, "tests.share": false, "links.manage": false }, roles: { g: { perms: { "games.run": true } } } };
  const p = T(cfg, { role: "teacher", customRoleIds: { g: true } });
  expect(p["games.run"]).toBe(true);
  expect(p["tests.use"]).toBe(true);
  expect(p["tests.view"]).toBe(false);
  expect(p["tests.edit"]).toBe(false);
  expect(p["links.manage"]).toBe(false);
  expect(pageAllowed(p, "tests")).toBe(false);
  expect(pageAllowed(p, "constructor")).toBe(false);
  expect(pageAllowed(p, "history")).toBe(true);
});

test("роль «лише тести»: ігор немає", () => {
  const cfg = { v: 2, perms: { "games.run": false, "games.history": false, "online.view": false }, roles: { t: { perms: { "tests.use": true } } } };
  const p = T(cfg, { role: "teacher", customRoleIds: { t: true } });
  expect(p["games.run"]).toBe(false);
  expect(pageAllowed(p, "history")).toBe(false);
  expect(pageAllowed(p, "tests")).toBe(true);
  expect(p["tests.edit"]).toBe(true);
});

test("«лише перегляд» вимикає всі дії зі змінами, але не перегляд і експорт", () => {
  const p = resolvePerms({}, { role: "teacher", readOnly: true });
  WRITE_KEYS.forEach(k => expect(p.perms[k], k).toBe(false));
  expect(p.perms["tests.view"]).toBe(true);
  expect(p.perms["attempts.view"]).toBe(true);
  expect(p.perms.export).toBe(true);
  expect(p.readOnly).toBe(true);
});

test("адміністратор може все, навіть у «лише перегляд» і при вимкненому для всіх", () => {
  const p = resolvePerms({ v: 2, perms: { "games.run": false } }, { role: "admin", readOnly: true });
  PERM_KEYS.forEach(k => expect(p.perms[k], k).toBe(true));
  expect(p.readOnly).toBe(false);
});

test("старий формат: прапорці games/import/export стають дозволами", () => {
  const cfg = { flags: { games: false, export: false }, roles: { r: { flags: { games: true } } } };
  expect(T(cfg, { role: "teacher" })["games.run"]).toBe(false);
  expect(T(cfg, { role: "teacher" }).export).toBe(false);
  expect(T(cfg, { role: "teacher", customRoleIds: { r: true } })["games.run"]).toBe(true);
  expect(T(cfg, { role: "teacher", features: { flags: { import: false } } })["tests.import"]).toBe(false);
});

test("старий формат: сторінка, обмежена ролями, лишається лише цим ролям", () => {
  const nav = [{ id: "s", items: [{ id: "tests", roleIds: ["authors"] }, { id: "links" }, { id: "dashboard", protected: true, roleIds: ["x"] }] }];
  expect(pageAllowed(T({}, { role: "teacher", customRoleIds: { authors: true } }, nav), "tests")).toBe(true);
  expect(pageAllowed(T({}, { role: "teacher", customRoleIds: { other: true } }, nav), "tests")).toBe(false);
  expect(pageAllowed(T({}, { role: "teacher" }, nav), "tests")).toBe(false);          // без ролей теж немає
  expect(pageAllowed(T({}, { role: "admin" }, nav), "tests")).toBe(true);
  expect(pageAllowed(T({}, { role: "teacher" }, nav), "links")).toBe(true);
  // у новому форматі меню вже не береться до уваги
  expect(pageAllowed(T({ v: 2 }, { role: "teacher" }, nav), "tests")).toBe(true);
});

test("старе одиничне поле customRoleId і масив ролей читаються", () => {
  const cfg = { v: 2, roles: { r: { perms: { ai: false } } }, perms: {} };
  expect(T({ ...cfg, roles: { r: { perms: { ai: true } } }, perms: { ai: false } }, { role: "teacher", customRoleId: "r" }).ai).toBe(true);
  expect(T({ ...cfg, roles: { r: { perms: { ai: true } } }, perms: { ai: false } }, { role: "teacher", customRoleIds: ["r"] }).ai).toBe(true);
});

test("каталог узгоджений: залежності й сторінки посилаються на справжні дозволи", () => {
  Object.entries(IMPLIES).forEach(([k, deps]) => { expect(PERMS[k], k).toBeTruthy(); deps.forEach(d => expect(PERMS[d], d).toBeTruthy()); });
  Object.values(PAGE_PERMS).forEach(k => expect(PERMS[k], k).toBeTruthy());
});

test("попередження про суперечності", () => {
  expect(conflicts({ "games.run": true, "tests.use": false }).length).toBe(1);
  expect(conflicts({ "tests.edit": true, "tests.view": false }).length).toBe(1);
  expect(conflicts({ "games.run": true, "tests.use": true })).toEqual([]);
});

test("normalizeCfg терпить сміття", () => {
  expect(() => normalizeCfg(null, null)).not.toThrow();
  expect(() => normalizeCfg({ roles: { r: null }, perms: { x: 1, "ai": "no" } }, [null, { items: null }])).not.toThrow();
});

test("таблиця сторінок у nav.js збігається з perms.js", () => {
  const nav = fs.readFileSync(new URL("../../shared/nav.js", import.meta.url), "utf8");
  const m = nav.match(/var PAGE_PERMS = (\{.*?\});/);
  expect(m).toBeTruthy();
  const inNav = JSON.parse(m[1]);
  Object.entries(inNav).forEach(([page, perm]) => expect(PAGE_PERMS[page], page).toBe(perm));
  Object.keys(PAGE_PERMS).filter(p => !p.startsWith("live-")).forEach(p => expect(inNav[p], p).toBe(PAGE_PERMS[p]));
});

test("закрили сторінку «Тести» для всіх: типове «створювати тести» теж вимкнено, явно видане — ні", () => {
  const cfg = { v: 2, perms: { "tests.view": false }, roles: { w: { perms: { "tests.edit": true } } } };
  const plain = T(cfg, { role: "teacher" });
  expect(plain["tests.view"]).toBe(false);
  expect(plain["tests.edit"]).toBe(false);
  expect(plain["tests.import"]).toBe(false);
  expect(plain["tests.share"]).toBe(false);
  expect(plain["tests.use"]).toBe(true);                   // для вибору гри тести лишаються
  const author = T(cfg, { role: "teacher", customRoleIds: { w: true } });
  expect(author["tests.edit"]).toBe(true);
  expect(author["tests.view"]).toBe(true);                 // залежність видана разом із правом
});

test("ключі дозволів у базі без крапки: tests.view ↔ tests_view, читання приймає обидва записи", async () => {
  const mod = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
  expect(mod.storeKey("tests.view")).toBe("tests_view");
  expect(mod.storeKey("ai")).toBe("ai");
  PERM_KEYS.forEach(k => { expect(/[.$#\[\]\/]/.test(mod.storeKey(k)), k).toBe(false); expect(mod.permFromStore(mod.storeKey(k)), k).toBe(k); });
  expect(Object.keys(mod.encodePerms({ "games.run": true, ai: false, junk: 1 })).sort()).toEqual(["ai", "games_run"]);
  const cfg = { v: 2, perms: { tests_view: false, "games.run": false }, roles: { r: { perms: { tests_edit: true } } } };
  const p = resolvePerms(cfg, { role: "teacher", customRoleIds: { r: true } }).perms;
  expect(p["tests.view"]).toBe(true);        // з tests_edit через залежність
  expect(p["games.run"]).toBe(false);
  expect(resolvePerms(cfg, { role: "teacher" }).perms["tests.view"]).toBe(false);
});

test("пункт меню з довільним id визначається за файлом сторінки", () => {
  expect(pagePerm({ id: "x1", file: "game-history" })).toBe("games.history");
  expect(pagePerm({ id: "n2", file: "news.html" })).toBe("news.view");
  expect(pagePerm({ id: "history", file: "whatever" })).toBe("games.history");
  expect(pagePerm({ id: "d", file: "./" })).toBeNull();
  expect(pagePerm({ id: "o", file: "https://x.y/z" })).toBeNull();
});
