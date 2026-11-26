// Швидке вікно «Створити гру» враховує всі типи live-гри (а не лише старі чотири) і кладе в кімнату перемішані порядок і зіставлення.
import { test, expect, seed, readDb } from "./fixtures.mjs";

const pair = (l, r) => ({ left: l, options: [r, "Хибно 1", "Хибно 2"], correct: 0 });
const mixed = () => ({
  users: { t1: { role: "teacher" } },
  teachers: { t1: { tests: { TM: { title: "Усі типи", status: "published", createdAt: Date.now(), questions: [
    { id: "a", type: "single", text: "Одна", options: ["A", "B"], correct: 0 },
    { id: "b", type: "multi", text: "Кілька", options: ["A", "B", "C"], correct: [0, 2] },
    { id: "c", type: "truefalse", text: "Так чи ні", options: ["Правда", "Неправда"], correct: 0 },
    { id: "d", type: "ordering", text: "Порядок", items: ["Один", "Два", "Три", "Чотири"] },
    { id: "e", type: "matching", text: "Пари", pairs: [pair("Франція", "Париж"), pair("Італія", "Рим"), pair("Польща", "Варшава")] },
    { id: "f", type: "text", text: "Текст", correct: "Дніпро" },
    { id: "g", type: "number", text: "Число", correct: 366 },
    { id: "h", type: "long", text: "Розгорнута відповідь" },
    { id: "i", type: "ordering", text: "Порядок з одного пункту", items: ["Єдиний"] },
  ] } } } },
});

test("швидка гра: у тесті з усіма типами не входить лише зламаний порядок", async ({ page, errors }) => {
  await seed(page, mixed(), "t1");
  await page.goto("/tests"); await page.waitForTimeout(1500);
  await page.locator(".t-lb.live").first().click();
  await expect(page.locator("#m-game.on")).toBeVisible();
  await expect(page.locator("#gm-sub")).toContainText("8 пит.");
  await expect(page.locator("#gm-note")).toContainText("1 питання не увійде");
  await page.click("#gm-go");
  await page.waitForURL(/live\/lobby\?code=\d{8}/);
  const db = await readDb(page), room = Object.values(db.rooms)[0];
  expect(room.questions.map(q => q.type)).toEqual(["single", "multi", "truefalse", "ordering", "matching", "text", "number", "long"]);
  expect(room.qCount).toBe(8);
  expect([...room.questions[3].options].sort()).toEqual(["Один", "Два", "Три", "Чотири"].sort());   // впорядкування: пункти в кімнаті перемішані
  expect(room.questions[4].lefts).toEqual(["Франція", "Італія", "Польща"]);
  expect(JSON.stringify(room.questions)).not.toContain("correct");
  const key = Object.values(db.teachers.t1.liveRooms)[0].key;
  expect(Object.keys(key)).toHaveLength(7);   // у розгорнутої відповіді ключа немає (null у базі не зберігається)
  expect(errors.filter(e => !/lobby|bad params/.test(e))).toEqual([]);
});
