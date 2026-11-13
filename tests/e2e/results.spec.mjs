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
  await expect(page.locator(".p.w .tie")).toContainText("Нічия");
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
