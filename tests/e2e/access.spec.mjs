// Доступ за роллю: сторінка, закрита для ролі, не відкривається й за прямим посиланням,
// навіть коли в меню її немає. Адміністратору й викладачам з потрібною роллю — відкрита.
import { test, expect, seed } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

const nav = () => [
  { id: "sec-main", type: "section", label: "Головне", order: 0, items: [
    { id: "dashboard", label: "Дашборд", file: "./", icon: "dashboard", protected: true },
    { id: "tests", label: "Тести", file: "tests", icon: "files", roleIds: ["authors"] },
    { id: "links", label: "Посилання", file: "links", icon: "link" },
  ] },
];
function db(roles) {
  const d = rich(Date.now());
  d.users.t1.customRoleIds = Object.fromEntries(roles.map(r => [r, true]));
  d.roles = { authors: { name: "Автори" }, games: { name: "Ігри" } };
  d.settings = { ...(d.settings || {}), navigation: nav(), navigation_ts: 1 };
  return d;
}

test("сторінка, закрита для ролі, показує «Немає доступу»", async ({ page, errors }) => {
  await seed(page, db(["games"]), "t1");
  await page.goto("/tests");
  await expect(page.locator("#qf-noaccess")).toBeVisible();
  await expect(page.locator("#qf-noaccess h1")).toHaveText("Немає доступу");
  await expect(page.locator("#sec-tests")).toBeHidden();
  // дозволена сторінка працює, а пункту «Тести» в меню немає
  await page.goto("/links");
  await expect(page.locator("#qf-noaccess")).toHaveCount(0);
  await expect(page.locator("#sidebar a[data-page=tests]")).toHaveCount(0);
  expect(errors.filter(e => !/no-access|Немає доступу/.test(e))).toEqual([]);
});

test("з потрібною роллю сторінка відкривається", async ({ page, errors }) => {
  await seed(page, db(["authors"]), "t1");
  await page.goto("/tests");
  await expect(page.locator("#qf-noaccess")).toHaveCount(0);
  await expect(page.locator("#sidebar a[data-page=tests]")).toBeVisible();
  expect(errors).toEqual([]);
});

test("адміністратор бачить усе", async ({ page, errors }) => {
  const d = db([]);
  d.users.t5.customRoleIds = {};
  d.settings.navigation = nav();
  await seed(page, d, "t5");
  await page.goto("/tests");
  await expect(page.locator("#qf-noaccess")).toHaveCount(0);
});

test("зміна ролі в адмінці закриває сторінку без повторного входу", async ({ page }) => {
  await seed(page, db(["authors"]), "t1");
  await page.goto("/tests");
  await expect(page.locator("#qf-noaccess")).toHaveCount(0);
  // роль знято, кеш меню протух
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("mockdb"));
    delete d.users.t1.customRoleIds.authors;
    d.settings.navigation_ts = 2;
    localStorage.setItem("mockdb", JSON.stringify(d));
  });
  await page.goto("/tests");
  await expect(page.locator("#qf-noaccess")).toBeVisible();
});

test("екран «Немає доступу» виглядає охайно на комп'ютері й телефоні", async ({ page }) => {
  await seed(page, db(["games"]), "t1");
  for (const vp of [{ width: 1280, height: 720 }, { width: 390, height: 780 }]) {
    await page.setViewportSize(vp);
    await page.goto("/tests");
    await expect(page.locator("#qf-noaccess")).toBeVisible();
    const sx = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    expect(sx, `${vp.width}: горизонтальний скрол`).toBe(false);
    await expect(page.locator("#app-loader")).toHaveCount(0);
    await page.screenshot({ path: `/tmp/s/noaccess-${vp.width}.png` });
  }
});

test("вимкнені «Ігри» й «Експорт» прибирають кнопки, а не показують тост", async ({ page, errors }) => {
  const d = db(["authors"]);
  d.settings.features = { flags: { games: false, export: false } };
  await seed(page, d, "t1");
  await page.goto("/");
  await expect(page.locator("#dx-q")).toBeVisible();
  await expect(page.locator('#dx-q [data-dx="game"]')).toBeHidden();
  for (const el of await page.locator('[data-dx="game"]').all()) await expect(el).toBeHidden();
  await expect(page.locator('#dx-q [data-dx="test"]')).toBeVisible();          // посилання лишається
  await page.goto("/tests");
  await expect(page.locator(".t-edit-btn[data-act=link], .t-lb[data-act=link]").first()).toBeVisible();
  for (const el of await page.locator('[data-act="live"]').all()) await expect(el).toBeHidden();
  await page.goto("/attempts");
  await expect(page.locator('[data-aact="export"]').first()).toBeHidden();
  await expect(page.locator("#qtb-extras .qtb-btn", { hasText: "Експорт" })).toBeHidden();
  await page.goto("/gradebook");
  await expect(page.locator("#gb-export-csv")).toBeHidden();
  expect(errors).toEqual([]);
});

test("без доступу до «Тестів» зникають «Новий тест» і пов'язані дії", async ({ page, errors }) => {
  await seed(page, db(["games"]), "t1");
  await page.goto("/");
  await expect(page.locator("#dx-q")).toBeVisible();
  await expect(page.locator('[data-dx="new"]').first()).toBeHidden();
  await expect(page.locator("#sb-new")).toBeHidden();
  await expect(page.locator('#dx-q a[href="tests"]')).toBeHidden();
  await expect(page.locator('[data-dx="game"]').first()).toBeVisible();       // ігри лишаються
  expect(errors).toEqual([]);
});

test("екран результатів гри: без «Експорту» і «Ігор» немає CSV та «Зіграти ще раз»", async ({ page }) => {
  const Q = [0, 1].map(i => ({ type: "single", text: "Питання " + i, options: ["A", "B"] }));
  const players = { p0: { nickname: "Марія" }, p1: { nickname: "Олег" } };
  const answers = { 0: { p0: { value: 0, isCorrect: true, points: 900 }, p1: { value: 1, isCorrect: false, points: 0 } }, 1: { p0: { value: 0, isCorrect: true, points: 800 }, p1: { value: 0, isCorrect: true, points: 700 } } };
  const mk = flags => ({ users: { t1: { role: "teacher" } }, settings: { features: { flags } }, teachers: { t1: { liveRooms: { "12345678": { key: {} } } } },
    rooms: { "12345678": { status: "finished", scoring: "speed", testId: "T1", testTitle: "Географія", hostUid: "t1", questions: Q, players, answers, options: {} } } });
  await seed(page, mk({}), "t1");
  await page.goto("/live/podium?code=12345678");
  await expect(page.locator("#csv-btn")).toBeVisible();
  await expect(page.locator("#again-btn")).toBeVisible();
  await seed(page, mk({ export: false, games: false }), "t1");
  await page.goto("/live/podium?code=12345678");
  await expect(page.locator("#again-btn")).toBeHidden();
  await expect(page.locator("#csv-btn")).toBeHidden();
});

// ── Нова модель дозволів (settings/features.v = 2) ─────────────────────────────
const v2 = (roles, extra = {}, user = {}) => {
  const d = rich(Date.now());
  d.users.t1 = { ...d.users.t1, customRoleIds: { r: true }, ...user };
  d.roles = { r: { name: "Роль" } };
  d.settings = { features: { v: 2, roles: { r: { perms: roles } }, ...extra } };
  return d;
};
// Ролі лише додають права, тож «лише ігри» = базові права без тестів і посилань + роль, що дає ігри
const GAMES_ONLY = d => v2({ "games.run": true }, { perms: { "tests.view": false, "tests.edit": false, "tests.import": false, "tests.share": false, "links.manage": false, "links.view": false } });
const TESTS_ONLY = () => v2({}, { perms: { "games.run": false, "games.history": false, "online.view": false } });

test("роль «лише ігри»: сторінки тестів немає, а гру запустити можна", async ({ page, errors }) => {
  await seed(page, GAMES_ONLY(), "t1");
  await page.goto("/");
  await expect(page.locator("#dx-q")).toBeVisible();
  await expect(page.locator('#dx-q [data-dx="game"]')).toBeVisible();
  await expect(page.locator('[data-dx="new"]').first()).toBeHidden();
  await expect(page.locator('#dx-q [data-dx="test"]')).toBeHidden();
  await expect(page.locator('#dx-q a[href="tests"]')).toBeHidden();
  await expect(page.locator("#sb-new")).toBeHidden();
  await expect(page.locator("#sidebar a[data-page=tests]")).toHaveCount(0);
  await expect(page.locator("#sidebar a[data-page=links]")).toHaveCount(0);
  await expect(page.locator("#sidebar a[data-page=history]")).toBeVisible();
  // тести для вибору гри лишаються
  await expect(page.locator(".dx-card.t")).toBeVisible();
  for (const el of await page.locator('.dx-card.t [data-dxa="edit"], .dx-card.t [data-dxa="link"]').all()) await expect(el).toBeHidden();
  await page.goto("/tests");
  await expect(page.locator("#qf-noaccess")).toBeVisible();
  await page.goto("/constructor?id=x");
  await expect(page.getByText("Конструктор недоступний")).toBeVisible();
  await page.goto("/links");
  await expect(page.locator("#qf-noaccess")).toBeVisible();
  expect(errors.filter(e => !/no-access|Немає доступу/.test(e))).toEqual([]);
});

test("роль «лише тести»: ігор і моніторингу немає", async ({ page, errors }) => {
  await seed(page, TESTS_ONLY(), "t1");
  await page.goto("/");
  await expect(page.locator("#dx-q")).toBeVisible();
  await expect(page.locator('#dx-q [data-dx="game"]')).toBeHidden();
  await expect(page.locator("#sidebar a[data-page=history]")).toHaveCount(0);
  await expect(page.locator(".ni-live")).toBeHidden();
  await expect(page.locator('#dx-q [data-dx="test"]')).toBeVisible();
  await page.goto("/game-history");
  await expect(page.locator("#qf-noaccess")).toBeVisible();
  await page.goto("/live?x=1");
  await expect(page.getByText("Live-моніторинг недоступний")).toBeVisible();
  await page.goto("/live/setup?testId=T1");
  await expect(page.getByText("Ця дія недоступна")).toBeVisible();
  expect(errors.filter(e => !/no-access|Немає доступу|Ця дія|Live-моніторинг/.test(e))).toEqual([]);
});

test("режим «лише перегляд»: сторінки відкриваються, дій зі змінами немає, є пояснення", async ({ page, errors }) => {
  await seed(page, v2({}, {}, { readOnly: true }), "t1");
  await page.goto("/tests");
  await expect(page.locator("#qf-noaccess")).toHaveCount(0);
  await expect(page.locator("#qf-readonly")).toBeVisible();
  await expect(page.locator("#t-new-test")).toBeHidden();
  for (const el of await page.locator('[data-act="live"], [data-act="link"]').all()) await expect(el).toBeHidden();
  await page.goto("/constructor?id=x");
  await expect(page.getByText("Конструктор недоступний")).toBeVisible();
  await page.goto("/attempts");
  await expect(page.locator("#qtb-extras .qtb-btn", { hasText: "Експорт" })).toBeVisible();   // експорт — це перегляд
  expect(errors.filter(e => !/no-access|Немає доступу/.test(e))).toEqual([]);
});

test("особисте налаштування сильніше за роль", async ({ page }) => {
  await seed(page, v2({}, { perms: { "games.run": false } }, { features: { perms: { "games.run": true } } }), "t1");
  await page.goto("/");
  await expect(page.locator('#dx-q [data-dx="game"]')).toBeVisible();
});

test("дозволи з кешу працюють одразу, без мерехтіння меню", async ({ page }) => {
  await seed(page, GAMES_ONLY(), "t1");
  await page.goto("/");
  await expect(page.locator("#sidebar a[data-page=history]")).toBeVisible();
  const cached = await page.evaluate(() => JSON.parse(localStorage.getItem("qf_perms_cache")));
  expect(cached.perms["tests.view"]).toBe(false);
  expect(cached.perms["games.run"]).toBe(true);
});

test("без дозволу на AI у конструкторі немає генерації питань", async ({ page, errors }) => {
  const d = v2({}, { perms: { ai: false } });
  await seed(page, d, "t1");
  await page.goto("/constructor?id=T2");
  await expect(page.locator(".tb")).not.toHaveCount(0);
  for (const el of await page.locator('[data-act="ai"]').all()) await expect(el).toBeHidden();
  await seed(page, v2({}), "t1");
  await page.goto("/constructor?id=T2");
  await expect(page.locator('.tb[data-act="ai"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("сповіщення «Змінено ваш доступ» від адміністратора показується у стрічці", async ({ page, errors }) => {
  const d = rich(Date.now());
  d.teachers.t1.notifications = { n1: { type: "access", title: "Змінено ваш доступ", msg: "Вам додано роль «Лише ігри». Сторінка «Тести» більше не доступна.", read: false, ts: Date.now() - 1000 } };
  await seed(page, d, "t1");
  await page.goto("/notifications");
  await expect(page.getByText("Змінено ваш доступ")).toBeVisible();
  await expect(page.getByText("Сторінка «Тести» більше не доступна.")).toBeVisible();
  await expect(page.getByText("Доступ", { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("зміна доступу в адмінці підхоплюється, коли викладач повертається на вкладку", async ({ page }) => {
  await page.addInitScript(() => { window.QF_CAPS_REFRESH_MS = 200; });
  await seed(page, db(["authors"]), "t1");
  await page.goto("/tests");
  await expect(page.locator("#qf-noaccess")).toHaveCount(0);
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("mockdb"));
    d.users.t1.customRoleIds = { games: true };          // роль «Автори» знято
    localStorage.setItem("mockdb", JSON.stringify(d));
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator("#qf-noaccess")).toBeVisible({ timeout: 8000 });
});
