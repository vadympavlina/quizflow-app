// Екран викладача в грі, текстове питання: ручне зарахування не збиває прокрутку списку
import { test, expect, seed } from "./fixtures.mjs";

const N = 25;
const room = () => {
  const now = Date.now();
  const players = Object.fromEntries(Array.from({ length: N }, (_, i) => ["p" + i, { nickname: "Гравець " + i }]));
  const answers = { 0: Object.fromEntries(Array.from({ length: N }, (_, i) => ["p" + i, { value: "Відповідь " + String(i).padStart(2, "0"), answeredAt: now - 25000 + i * 100, isCorrect: false, points: 0 }])) };
  return { hostUid: "t1", status: "reveal", currentQ: 0, questionStartedAt: now - 30000, timePerQ: 20, scoring: "speed", testTitle: "Столиці",
    questions: [{ type: "text", text: "Столиця України?" }], players, answers };
};
const db = () => ({ users: { t1: { role: "teacher" } }, teachers: { t1: { liveRooms: { "12345678": { key: { 0: "Київ" } } } } }, rooms: { "12345678": room() } });

test("зарахування відповіді не прокручує список угору й не губить фокус", async ({ page, errors }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page, db(), "t1");
  await page.goto("/live/play-teacher?code=12345678");
  await expect(page.locator("#grading .grp")).toHaveCount(N);
  const groups = page.locator("#grading .groups");
  // прокручуємо до кінця й зараховуємо останню групу
  const maxTop = await groups.evaluate(el => { el.scrollTop = el.scrollHeight; return el.scrollTop; });
  expect(maxTop, "список має прокручуватись").toBeGreaterThan(100);
  const last = page.locator("#grading .grp").last();
  await last.locator(".grade-btn").focus();
  await last.locator(".grade-btn").click();
  await expect(page.locator("#grading .grp.ok")).toHaveCount(1);           // зарахування дійшло й список перемалювався
  const top = await groups.evaluate(el => el.scrollTop);
  expect(top, "прокрутка лишилась на місці").toBeGreaterThanOrEqual(maxTop - 2);
  // фокус лишився на кнопці тієї ж групи (клавіатура не скидається на початок сторінки)
  const foc = await page.evaluate(() => { const a = document.activeElement; return { btn: !!a?.classList?.contains("grade-btn"), txt: a?.closest(".grp")?.querySelector(".v")?.textContent }; });
  expect(foc.btn).toBe(true);
  expect(foc.txt).toBe("Відповідь " + String(N - 1).padStart(2, "0"));
  // другий клік поспіль теж не збиває: скасувати зарахування
  await page.locator("#grading .grp").last().locator(".grade-btn").click();
  await expect(page.locator("#grading .grp.ok")).toHaveCount(0);
  expect(await groups.evaluate(el => el.scrollTop)).toBeGreaterThanOrEqual(maxTop - 2);
  expect(errors).toEqual([]);
});
