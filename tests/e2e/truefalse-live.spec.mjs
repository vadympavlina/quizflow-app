// Гра наживо, «Правда / Неправда»: питання входить у гру, екран викладача показує два варіанти зі значками й розподіл
import { test, expect, seed } from "./fixtures.mjs";

const now = () => Date.now();
const room = status => ({ hostUid: "t1", status, currentQ: 0, questionStartedAt: now() - 3000, timePerQ: 30, scoring: "speed", testTitle: "Правда чи ні",
  questions: [{ type: "truefalse", text: "Земля обертається навколо Сонця", options: ["Правда", "Неправда"] }],
  players: { p1: { nickname: "А" }, p2: { nickname: "Б" }, p3: { nickname: "В" } },
  answers: { 0: { p1: { value: 0, answeredAt: now() - 2000 }, p2: { value: 0, answeredAt: now() - 1500 }, p3: { value: 1, answeredAt: now() - 1000 } } } });
const db = status => ({ users: { t1: { role: "teacher" } }, teachers: { t1: { liveRooms: { "12345678": { key: { 0: [0] } } } } }, rooms: { "12345678": room(status) } });

test("екран викладача: два варіанти зі значками, після розкриття правильний підсвічений і видно розподіл", async ({ page, errors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, db("reveal"), "t1");
  await page.goto("/live/play-teacher?code=12345678");
  await expect(page.locator("#q-type-wrap")).toContainText("Правда чи неправда");
  const cells = page.locator("#answers-grid .ans");
  await expect(cells).toHaveCount(2);
  await expect(cells.nth(0).locator(".letter svg")).toHaveCount(1);
  await expect(cells.nth(0)).toHaveClass(/correct/);
  await expect(cells.nth(1)).toHaveClass(/dim/);
  await expect(cells.nth(0).locator(".count")).toContainText("2");
  await expect(cells.nth(1).locator(".count")).toContainText("1");
  await expect(page.locator("#key-line")).toContainText("Правильна відповідь");
  expect(errors).toEqual([]);
});

test("підготовка гри: питання «Правда / Неправда» входить у гру і не потрапляє до виключених", async ({ page, errors }) => {
  const d = { users: { t1: { role: "teacher" } }, teachers: { t1: { tests: { T1: { title: "Тест", questions: [
    { id: "a", type: "truefalse", text: "Вода мокра", options: ["Правда", "Неправда"], correct: [0] },
    { id: "b", type: "single", text: "Столиця?", options: ["Київ", "Рим"], correct: [0] },
    { id: "c", type: "matching", text: "Пари", pairs: [{ left: "а", options: ["б"], correct: 0 }] },
  ] } } } } };
  await seed(page, d, "t1");
  await page.goto("/live/setup?testId=T1");
  await expect(page.locator("#type-chips")).toContainText("правда / неправда");
  await expect(page.locator("#type-chips")).toContainText("2 питання");        // одна відповідь і правда/неправда; відповідність пропущена
  await expect(page.locator("#excluded-note")).toContainText("1 питання не увійде");
  expect(errors).toEqual([]);
});
