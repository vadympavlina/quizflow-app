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

test("фінал: картки місць, переможець і список; імена екрануються", async ({ page, errors }) => {
  await seed(page, dbWith(room("speed")), "t1");
  await page.goto("/live/podium?code=12345678");
  await page.waitForTimeout(500);
  await expect(page.locator(".card.win .name")).toContainText("Марія");
  await expect(page.locator(".card.win .lab")).toHaveText("Переможець");
  await expect(page.locator(".card.win b")).toHaveCount(0);                 // розмітка в імені не виконується
  await expect(page.locator('.card[data-rank="2"] .name')).toContainText("Катя");
  await expect(page.locator('.card[data-rank="3"] .name')).toContainText("Олег");
  await expect(page.locator("#cr-rest li")).toHaveCount(2);                // решта списку: 4-те й 5-те місця
  await expect(page.locator("#cr-top li")).toHaveCount(3);
  await expect(page.locator("#end-btn")).toBeVisible();
  expect(errors).toEqual([]);
});

test("фінал: нічия показується разом, «Точність» без балів", async ({ page, errors }) => {
  await seed(page, dbWith(room("correct", true)), "t1");
  await page.goto("/live/podium?code=12345678");
  await page.waitForTimeout(500);
  await expect(page.locator(".card.win .lab")).toContainText("Ділять 1-е місце · 2 гравці");
  await expect(page.locator(".card.win .name .ln")).toHaveCount(2);
  await expect(page.locator(".card.win .score")).not.toContainText("балів");
  await expect(page.locator(".card.win .score")).toContainText("правильних у кожного");
  expect(errors).toEqual([]);
});

test("фінал: без пʼєдесталу — заголовок і всі гравці; порожня гра не падає", async ({ page, errors }) => {
  const r = room("speed"); r.options = { podium: false };
  await seed(page, dbWith(r), "t1");
  await page.goto("/live/podium?code=12345678");
  await page.waitForTimeout(400);
  await expect(page.locator(".card")).toHaveCount(0);
  await expect(page.locator("#credits")).toBeVisible();
  await expect(page.locator(".cr-title")).toContainText("Географія");
  await expect(page.locator("#cr-rest li")).toHaveCount(5);
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


test("фінал: усі, хто ділить місце, видно по імені (без «+N»), мітка з номером місця, імена екрануються й не вилазять", async ({ page, errors }) => {
  const names = Array.from({ length: 12 }, (_, i) => i === 0 ? "Хакер <img src=x onerror=alert(1)>" : "Учень " + String(i).padStart(2, "0"));
  const players = Object.fromEntries(names.map((n, i) => ["p" + i, { nickname: n }]));
  // місця щільні: 3 гравці на 1-му (900), 7 на 2-му (500), 2 на 3-му (300)
  const pts = [900, 900, 900, 500, 500, 500, 500, 500, 500, 500, 300, 300];
  const answers = { 0: Object.fromEntries(names.map((n, i) => ["p" + i, { value: 0, isCorrect: true, points: pts[i] }])) };
  const r = { status: "finished", scoring: "speed", testTitle: "Тест", hostUid: "t1", questions: Q, players, answers, options: { podium: true } };
  // кадр церемонії можна зафіксувати параметром t (мс): без руху й звуку
  const frame = async (t) => { await page.goto("/live/podium?code=12345678&t=" + t); await page.waitForSelector("#T[data-frozen]"); };
  // межі тексту: імена не вилазять за свою половину картки і не налазять на рахунок
  const fits = (sel) => page.evaluate((sel) => { const c = document.querySelector(sel), n = c.querySelector(".name").getBoundingClientRect(), ru = c.querySelector(".rule").getBoundingClientRect(), m = c.querySelector(".medgrp, .med")?.getBoundingClientRect(); return { bottom: n.bottom <= ru.top + 2, side: !m || n.right <= m.left + 2 }; }, sel);
  await seed(page, dbWith(r), "t1");
  await page.goto("/live/podium?code=12345678");
  await page.waitForTimeout(400);
  await expect(page.locator(".card.win .lab")).toContainText("Переможці · Ділять 1-е місце · 3 гравці");
  await expect(page.locator(".card.win .name .ln")).toHaveCount(3);
  await expect(page.locator(".card.win .score")).toContainText("у кожного");
  expect(await page.locator("img[src='x']").count()).toBe(0);               // розмітка в імені не виконується
  await expect(page.locator('.card[data-rank="2"] .lab')).toContainText("Ділять 2-е місце · 7 гравців");
  await expect(page.locator('.card[data-rank="2"] .name .ln')).toHaveCount(7);
  await expect(page.locator('.card[data-rank="3"] .lab')).toContainText("Ділять 3-є місце · 2 гравці");
  await expect(page.locator('.card[data-rank="3"] .name .ln')).toHaveCount(2);
  await frame(5800); expect(await fits('.card[data-rank="2"]')).toEqual({ bottom: true, side: true });
  await frame(10500); expect(await fits(".card.win")).toEqual({ bottom: true, side: true });
  // усі однакові: 12 на першому місці — видно кожного, без підсумку «+N» у іменах
  const all = { ...r, answers: { 0: Object.fromEntries(names.map((n, i) => ["p" + i, { value: 0, isCorrect: true, points: 500 }])) } };
  await seed(page, dbWith(all), "t1");
  await page.goto("/live/podium?code=12345678");
  await page.waitForTimeout(400);
  await expect(page.locator(".card.win .name .ln")).toHaveCount(12);
  await expect(page.locator(".card.win .name")).not.toContainText("+");
  await expect(page.locator(".card")).toHaveCount(1);                       // усі на першому місці — лише одна картка
  await frame(4500); expect(await fits(".card.win")).toEqual({ bottom: true, side: true });
  expect(errors).toEqual([]);
});

test("фінал: довгі імена вміщаються, великий клас не ламає розкладку; на телефоні немає горизонтального скролу", async ({ page, errors }) => {
  const names = ["Олександра-Вікторія Святославівна Мельниченко-Коваленко", "Ян", "Богдан Хмельницький Молодший"];
  const players = Object.fromEntries(names.map((n, i) => ["p" + i, { nickname: n, avatar: i ? "fox" : "lion" }]));
  const pts = [900, 700, 500];
  const answers = { 0: Object.fromEntries(names.map((n, i) => ["p" + i, { value: 0, isCorrect: true, points: pts[i] }])) };
  const r = { status: "finished", scoring: "speed", testTitle: "Тест", hostUid: "t1", questions: Q, players, answers, options: { podium: true } };
  await seed(page, dbWith(r), "t1");
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 820, height: 1180 }]) {
    await page.setViewportSize(vp);
    for (const t of [2500, 5500, 9500, 15000]) {
      await page.goto("/live/podium?code=12345678&t=" + t); await page.waitForSelector("#T[data-frozen]");
      const inside = await page.evaluate(() => { const W = innerWidth; return [...document.querySelectorAll(".card:not([style*='hidden']) .name, .credits.on .cr-top .n")].every(e => { const b = e.getBoundingClientRect(); return b.left >= -2 && b.right <= W + 2; }); });
      expect(inside, `${vp.width}×${vp.height} t=${t}: текст у межах екрана`).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${vp.width}: без горизонтального скролу`).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test("фінал: церемонія йде сама, клік по екрану її не переривав, «Пропустити» і «Показати ще раз» працюють", async ({ page, errors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, dbWith(room("speed")), "t1");
  await page.goto("/live/podium?code=12345678");
  const phase = () => page.evaluate(() => document.getElementById("T")?.dataset.phase);
  await expect.poll(phase, { message: "церемонія стартує з карток", timeout: 4000 }).toBe("cards");
  await expect(page.locator("#skip-btn")).toBeVisible();
  // кліки по різних місцях екрана, у тому числі по самій картці
  for (const [x, y] of [[300, 300], [900, 200], [640, 700], [1100, 500]]) { await page.mouse.click(x, y); await page.waitForTimeout(60); }
  expect(await phase(), "після кліків церемонія досі йде").toBe("cards");
  // проходить пауза «І переможець…», потім сам переможець, потім титри
  await expect.poll(phase, { timeout: 9000 }).toBe("tension");
  await expect.poll(phase, { timeout: 4000 }).toBe("win");
  await expect.poll(phase, { timeout: 8000 }).toBe("credits");
  await expect(page.locator("#credits")).toBeVisible();
  await expect(page.locator("#skip-btn")).toBeHidden();
  // повторний показ запускається кнопкою
  await page.mouse.move(700, 300); await page.mouse.move(720, 310);   // кнопки ховаються, коли ними не користуються; рух миші повертає
  await page.waitForTimeout(600);
  await page.locator("#replay-btn").click();
  await expect.poll(phase, { timeout: 2000 }).toBe("cards");
  // «Пропустити» одразу веде до титрів
  await page.mouse.move(710, 310);
  await page.locator("#skip-btn").click();
  await expect.poll(phase, { timeout: 2000 }).toBe("credits");
  await expect(page.locator("#cr-top li").first()).toContainText("Марія");
  expect(errors).toEqual([]);
});

// Звук фіналу: Web Audio не стартує без жесту користувача. Рахуємо створені осцилятори — це і є озвучення церемонії.
const countOsc = () => { window.__osc = 0; const P = (window.BaseAudioContext || window.AudioContext).prototype, o = P.createOscillator; P.createOscillator = function () { window.__osc++; return o.apply(this, arguments); }; };

test("фінал: після кліку на попередній сторінці церемонія йде зі звуком сама, без нового кліку", async ({ page, errors }) => {
  await page.addInitScript(countOsc);
  await seed(page, dbWith(room("speed")), "t1");
  await page.mouse.click(5, 5);                                            // користувач щойно клікав (кнопка гри)
  await page.evaluate(() => { location.href = "/live/podium?code=12345678"; });
  await page.waitForTimeout(3500);
  expect(await page.evaluate(() => window.__osc), "звуки церемонії створюються").toBeGreaterThan(0);
  await expect(page.locator(".gate")).toHaveCount(0);                  // звук дозволений — екрана «торкніться» немає
  expect(errors).toEqual([]);
});
