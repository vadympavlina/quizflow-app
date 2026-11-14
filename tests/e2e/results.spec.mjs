// Фінал для викладача: пʼєдестал-плакат, нічия, режим «Точність», усе екранується
import { test, expect, seed } from "./fixtures.mjs";

const Q = [0, 1, 2].map(i => ({ type: "single", text: "Питання " + i, options: ["A", "B"] }));
const room = (scoring, tie) => {
  const names = ["Марія <b>Бондар</b>", "Олег Шевчук", "Катя Мельник", "Дмитро Коваль", "Олена Ткач"];
  const players = Object.fromEntries(names.map((n, i) => ["p" + i, { nickname: n }]));
  const correct = [3, tie ? 3 : 2, 2, 1, 0];
  const answers = {};
  for (let q = 0; q < 3; q++) { answers[q] = {}; names.forEach((n, i) => { const ok = q < correct[i]; answers[q]["p" + i] = { value: ok ? 0 : 1, isCorrect: ok, points: scoring === "correct" ? (ok ? 1000 : 0) : (ok ? 800 + i : 0) }; }); }
  return { status: "finished", scoring, testTitle: "Географія", hostUid: "t1", questions: Q, players, answers, options: { podium: true } };
};
const dbWith = r => ({ users: { t1: { role: "teacher" } }, teachers: { t1: { liveRooms: { "12345678": { key: {} } } } }, rooms: { "12345678": r } });

test("фінал: переможець, пʼєдестал і список; імена екрануються", async ({ page, errors }) => {
  await seed(page, dbWith(room("speed")), "t1");
  await page.goto("/live/podium?code=12345678");
  await page.waitForTimeout(500);
  await expect(page.locator(".p.w .nm")).toContainText("Марія");
  await expect(page.locator(".p.w .nm b")).toHaveCount(0);        // розмітка в імені не виконується
  await expect(page.locator(".p.s2")).toContainText("Катя");
  await expect(page.locator(".p.s3")).toContainText("Олег");
  await expect(page.locator("#rows .row")).toHaveCount(2);
  await expect(page.locator("#end-btn")).toBeVisible();
  expect(errors).toEqual([]);
});

test("фінал: нічия показується разом, «Точність» без балів", async ({ page, errors }) => {
  await seed(page, dbWith(room("correct", true)), "t1");
  await page.goto("/live/podium?code=12345678");
  await page.waitForTimeout(500);
  await expect(page.locator(".p.w .tie")).toContainText("Ділять 1-е місце · 2 гравці");
  await expect(page.locator(".p.w .nm")).toHaveCount(2);
  await expect(page.locator(".p.w")).not.toContainText("балів");
  expect(errors).toEqual([]);
});

test("фінал: без пʼєдесталу — заголовок і всі гравці; порожня гра не падає", async ({ page, errors }) => {
  const r = room("speed"); r.options = { podium: false };
  await seed(page, dbWith(r), "t1");
  await page.goto("/live/podium?code=12345678");
  await page.waitForTimeout(400);
  await expect(page.locator(".p.w .nm")).toContainText("Географія");
  await expect(page.locator("#rows .row")).toHaveCount(5);
  const e = { ...room("speed"), players: {}, answers: {} };
  await seed(page, dbWith(e), "t1");
  await page.goto("/live/podium?code=12345678");
  await expect(page.locator(".empty")).toContainText("не було учасників");
  expect(errors).toEqual([]);
});

test("фінал: кнопки зверху справа ховаються, коли ними не користуються, і повертаються від руху миші; на телефоні не ховаються", async ({ page, errors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, dbWith(room("speed")), "t1");
  await page.goto("/live/podium?code=12345678");
  const op = () => page.evaluate(() => +getComputedStyle(document.querySelector(".acts")).opacity);
  expect(await op()).toBe(1);                                              // спершу видно
  await page.waitForTimeout(5300);
  expect(await op(), "через 4 с без дій").toBe(0);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".acts")).pointerEvents)).toBe("none");
  await page.mouse.move(400, 400); await page.mouse.move(420, 410);
  await page.waitForTimeout(600);
  expect(await op(), "після руху миші").toBe(1);
  // клавіатура: Tab показує кнопки й вони лишаються, поки фокус усередині
  await page.waitForTimeout(5300);
  expect(await op()).toBe(0);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(600);
  expect(await op(), "після Tab").toBe(1);
  await page.waitForTimeout(5300);
  expect(await op(), "фокус усередині — лишаються").toBe(1);
  // вузький екран: кнопки в потоці, не ховаються
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(5300);
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(5300);
  expect(await op(), "телефон").toBe(1);
  expect(errors).toEqual([]);
});


test("фінал: усі, хто ділить місце, видно по імені (без «+N»), мітка з номером місця, імена екрануються", async ({ page, errors }) => {
  const names = Array.from({ length: 12 }, (_, i) => i === 0 ? "Хакер <img src=x onerror=alert(1)>" : "Учень " + String(i).padStart(2, "0"));
  const players = Object.fromEntries(names.map((n, i) => ["p" + i, { nickname: n }]));
  // місця щільні: 3 гравці на 1-му (900), 7 на 2-му (500), 2 на 3-му (300)
  const pts = [900, 900, 900, 500, 500, 500, 500, 500, 500, 500, 300, 300];
  const answers = { 0: Object.fromEntries(names.map((n, i) => ["p" + i, { value: 0, isCorrect: true, points: pts[i] }])) };
  const r = { status: "finished", scoring: "speed", testTitle: "Тест", hostUid: "t1", questions: Q, players, answers, options: { podium: true } };
  await seed(page, dbWith(r), "t1");
  await page.goto("/live/podium?code=12345678");
  await page.waitForTimeout(500);
  await expect(page.locator(".p.w .tie")).toContainText("Ділять 1-е місце · 3 гравці");
  await expect(page.locator(".p.w .nm")).toHaveCount(3);
  await expect(page.locator(".p.w")).toContainText("по");
  expect(await page.locator("img[src='x']").count()).toBe(0);               // розмітка в імені не виконується
  // другу й третю панелі теж ділять: усі 7 і 2 гравці видно, мітка з правильним числівником
  await expect(page.locator(".p.s2 .tie")).toContainText("Ділять 2-е місце · 7 гравців");
  await expect(page.locator(".p.s2 .nm")).toHaveCount(7);
  await expect(page.locator(".p.s3 .tie")).toContainText("Ділять 3-є місце · 2 гравці");
  await expect(page.locator(".p.s3 .nm")).toHaveCount(2);
  // усі однакові: 12 на першому місці — видно кожного, без підсумку «+N»
  const all = { ...r, answers: { 0: Object.fromEntries(names.map((n, i) => ["p" + i, { value: 0, isCorrect: true, points: 500 }])) } };
  await seed(page, dbWith(all), "t1");
  await page.goto("/live/podium?code=12345678");
  await page.waitForTimeout(500);
  await expect(page.locator(".p.w .nm")).toHaveCount(12);
  await expect(page.locator(".p.w")).not.toContainText("+");
  expect(await page.evaluate(() => { const t = document.querySelector(".p.w .tied"); return t.scrollWidth <= t.clientWidth + 2; }), "імена не вилазять вбік").toBe(true);
  expect(errors).toEqual([]);
});
