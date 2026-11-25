// Звук фіналу, коли браузер його БЛОКУЄ (сторінку відкрито напряму, оновлено, iPhone): церемонія не йде мовчки, а чекає на дотик,
// який і вмикає звук, і запускає показ. Політика автовідтворення тут — як у справжньому браузері (потрібен жест).
import { test, expect, seed } from "./fixtures.mjs";

test.use({ launchOptions: { args: ["--autoplay-policy=document-user-activation-required"], ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) } });

const Q = [0, 1, 2].map(i => ({ type: "single", text: "Питання " + i, options: ["A", "B"] }));
const names = ["Марія Бондар", "Олег Шевчук", "Катя Мельник", "Дмитро Коваль", "Олена Ткач"];
const dbOk = () => {
  const players = Object.fromEntries(names.map((n, i) => ["p" + i, { nickname: n }]));
  const correct = [3, 2, 2, 1, 0], answers = {};
  for (let q = 0; q < 3; q++) { answers[q] = {}; names.forEach((n, i) => { const ok = q < correct[i]; answers[q]["p" + i] = { value: ok ? 0 : 1, isCorrect: ok, points: ok ? 800 - i * 20 : 0 }; }); }
  return { users: { t1: { role: "teacher" } }, teachers: { t1: { liveRooms: { "12345678": { key: {} } } } },
    rooms: { "12345678": { status: "finished", scoring: "speed", testTitle: "Географія", hostUid: "t1", questions: Q, players, answers, options: { podium: true } } } };
};
const countOsc = () => { window.__osc = 0; const P = (window.BaseAudioContext || window.AudioContext).prototype, o = P.createOscillator; P.createOscillator = function () { window.__osc++; return o.apply(this, arguments); }; };
const phase = page => page.evaluate(() => document.getElementById("T")?.dataset.phase);
const open = async page => { await page.addInitScript(countOsc); await seed(page, dbOk(), "t1"); };
const URL = "/live/podium?code=12345678";

test("звук заблоковано: замість мовчазної церемонії — екран «Показати результати», дотик вмикає звук і запускає показ", async ({ page, errors }) => {
  await open(page);
  await page.goto(URL);
  const gate = page.locator(".gate button");
  await expect(gate).toBeVisible();
  await expect(gate).toBeFocused();
  await page.waitForTimeout(1500);
  expect(await phase(page), "церемонія ще не стартувала").toBe("init");
  expect(await page.evaluate(() => window.__osc), "звуку ще немає").toBe(0);
  await gate.click();
  await expect(page.locator(".gate")).toHaveCount(0);
  await expect.poll(() => phase(page), { timeout: 4000 }).toBe("cards");
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__osc), "після дотику звук пішов").toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("звук заблоковано: показ запускається і з клавіатури (Enter)", async ({ page, errors }) => {
  await open(page);
  await page.goto(URL);
  await expect(page.locator(".gate button")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".gate")).toHaveCount(0);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__osc)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("звук заблоковано, але вимкнений самим користувачем — екрана «торкніться» немає, показ іде одразу", async ({ page, errors }) => {
  await open(page);
  await page.evaluate(() => localStorage.setItem("qf_snd", "0"));
  await page.goto(URL);
  await expect.poll(() => phase(page), { timeout: 4000 }).toBe("cards");
  await expect(page.locator(".gate")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("звук заблоковано, але в системі «зменшити рух» — екрана «торкніться» немає", async ({ page, errors }) => {
  await open(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(URL);
  await page.waitForTimeout(1500);
  await expect(page.locator(".gate")).toHaveCount(0);
  await expect(page.locator("#credits")).toBeVisible();
  await expect(page.locator("#cr-top li").first()).toContainText("Марія");
  expect(await phase(page), "без руху одразу підсумок").toBe("credits");
  expect(errors).toEqual([]);
});
