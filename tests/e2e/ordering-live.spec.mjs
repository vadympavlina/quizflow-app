// Гра наживо, впорядкування: підготовка кімнати (пункти перемішуються, правильний порядок лише в ключі викладача),
// екран викладача (плитки без порядку → список у правильному порядку з часткою класу) і межі
import { test, expect, seed, readDb } from "./fixtures.mjs";

const now = () => Date.now();
// пункти в кімнаті перемішані; ключ: на місці 1 — пункт 1, далі 0, 3, 2
const room = status => ({ hostUid: "t1", status, currentQ: 0, questionStartedAt: now() - 3000, timePerQ: 30, scoring: "speed", testTitle: "Історія",
  questions: [{ type: "ordering", text: "Розташуйте події від найдавнішої до найновішої", options: ["Битва під Крутами", "Хрещення Русі", "Проголошення незалежності України", "Заснування Києва (за літописом)"] }],
  players: { p1: { nickname: "А" }, p2: { nickname: "Б" }, p3: { nickname: "В" }, p4: { nickname: "Г" } },
  answers: { 0: {
    p1: { value: [1, 0, 3, 2], answeredAt: now() - 2000, isCorrect: true, points: 900 },
    p2: { value: [1, 0, 3, 2], answeredAt: now() - 1800, isCorrect: true, points: 900 },
    p3: { value: [1, 2, 0, 3], answeredAt: now() - 1500, isCorrect: false, points: 0 },
    p4: { value: [0, 1, 3, 2], answeredAt: now() - 1000, isCorrect: false, points: 0 } } } });
const db = status => ({ users: { t1: { role: "teacher" } }, teachers: { t1: { liveRooms: { "12345678": { key: { 0: [1, 0, 3, 2] } } } } }, rooms: { "12345678": room(status) } });

test("екран викладача під час питання: ярлик і плитки A–D без правильного порядку", async ({ page, errors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, db("question"), "t1");
  await page.goto("/live/play-teacher?code=12345678");
  await expect(page.locator("#q-type-wrap")).toContainText("Розставте за порядком");
  const cells = page.locator("#answers-grid .ans");
  await expect(cells).toHaveCount(4);
  await expect(cells.nth(0).locator(".letter")).toHaveText("A");
  await expect(cells.nth(0)).toContainText("Битва під Крутами");
  await expect(cells.nth(0)).toHaveClass(/ord/);
  await expect(page.locator("#answers-grid")).not.toHaveClass(/list/);
  expect(errors).toEqual([]);
});

test("екран викладача після розкриття: правильний порядок, частка класу на кожному місці, підсумки", async ({ page, errors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, db("reveal"), "t1");
  await page.goto("/live/play-teacher?code=12345678");
  const rows = page.locator("#answers-grid .ans");
  await expect(rows).toHaveCount(4);
  await expect(page.locator("#answers-grid")).toHaveClass(/list/);
  await expect(rows.locator(".txt")).toHaveText(["Хрещення Русі", "Битва під Крутами", "Заснування Києва (за літописом)", "Проголошення незалежності України"]);
  await expect(rows.locator(".letter")).toHaveText(["1", "2", "3", "4"]);
  // ключ [1,0,3,2]: місце 1 — p1,p2,p3 (75 %); місце 2 — лише p1,p2 (50 %); місця 3 і 4 — p1,p2,p4 (75 %)
  await expect(rows.nth(0).locator(".count")).toContainText("75%");
  await expect(rows.nth(1).locator(".count")).toContainText("50%");
  await expect(rows.nth(1)).toHaveClass(/warn/);
  await expect(rows.nth(0)).toHaveClass(/good/);
  await expect(page.locator("#key-line")).toContainText("Повністю правильно: 2 з 4");
  await expect(page.locator("#key-line")).toContainText("Найчастіша помилка: 2-те місце");
  expect(errors).toEqual([]);
});

test("підготовка гри: пункти перемішані, правильний порядок лише в ключі, в кімнату не потрапляє", async ({ page, errors }) => {
  const items = ["Перший", "Другий", "Третій", "Четвертий"];
  await seed(page, { users: { t1: { role: "teacher" } }, teachers: { t1: { tests: { T1: { title: "Порядок", questions: [{ id: "o1", type: "ordering", text: "Розставте", items }] } } } } }, "t1");
  await page.goto("/live/setup?testId=T1");
  await expect(page.locator("#type-chips")).toContainText("1 × порядок");
  await page.locator("#launch-btn").click();
  await page.waitForURL(/lobby\?code=/);
  const d = await readDb(page);
  const code = Object.keys(d.rooms)[0], r = d.rooms[code], q = r.questions[0];
  expect(q.type).toBe("ordering");
  expect([...q.options].sort()).toEqual([...items].sort());
  expect(q.options).not.toEqual(items);                         // ніколи не збігається з правильним порядком
  expect(q.items).toBeUndefined(); expect(q.correct).toBeUndefined();
  const key = d.teachers.t1.liveRooms[code].key[0];
  expect(key.map(i => q.options[i])).toEqual(items);             // ключ відновлює правильну послідовність
  expect(JSON.stringify(r)).not.toContain(JSON.stringify(key));
  expect(errors).toEqual([]);
});

test("підготовка гри: впорядкування з понад 6 пунктами або з одним не входить у гру", async ({ page, errors }) => {
  const seven = ["1", "2", "3", "4", "5", "6", "7"];
  await seed(page, { users: { t1: { role: "teacher" } }, teachers: { t1: { tests: { T1: { title: "Т", questions: [
    { id: "a", type: "ordering", text: "Шість", items: ["1", "2", "3", "4", "5", "6"] },
    { id: "b", type: "ordering", text: "Сім", items: seven },
    { id: "c", type: "ordering", text: "Один", items: ["1"] },
  ] } } } } }, "t1");
  await page.goto("/live/setup?testId=T1");
  await expect(page.locator("#type-chips")).toContainText("1 × порядок");
  await expect(page.locator("#excluded-note")).toContainText("2 питання не увійдуть");
  await expect(page.locator("#excluded-note")).toContainText("понад 6 пунктів");
  expect(errors).toEqual([]);
});
