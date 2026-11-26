// Розгорнута відповідь у live-грі: учні пишуть як звичайний текст, зараховує викладач вручну
import { test, expect, seed, readDb } from "./fixtures.mjs";

const room = (status, answers = {}) => {
  const now = Date.now();
  return { hostUid: "t1", status, currentQ: 0, questionStartedAt: now - 30000, timePerQ: 60, scoring: "speed", testTitle: "Есе",
    questions: [{ type: "long", text: "Поясніть, чому небо блакитне" }],
    players: { p1: { nickname: "Ася", active: true, online: true }, p2: { nickname: "Богдан", active: true, online: true } }, answers,
    ...(status === "reveal" ? { revealed: { 0: { correct: null, at: now } } } : {}) };
};
const ans = (txt, i) => ({ value: txt, answeredAt: Date.now() - 20000 + i * 500, isCorrect: false, points: 0 });
const db = (status, answers) => ({ users: { t1: { role: "teacher" } }, teachers: { t1: { liveRooms: { "12345678": { key: { 0: null } } } } }, rooms: { "12345678": room(status, answers) } });

test("розгорнута відповідь: під час питання екран вчителя чекає на текст, без варіантів", async ({ page, errors }) => {
  await seed(page, db("question"), "t1");
  await page.goto("/live/play-teacher?code=12345678");
  await expect(page.locator(".tchip.long")).toContainText("Розгорнута відповідь");
  await expect(page.locator("#text-wait-hint")).toBeVisible();
  await expect(page.locator("#answers-grid")).toBeHidden();
  expect(errors).toEqual([]);
});

test("розгорнута відповідь: викладач зараховує вручну, бали йдуть учневі", async ({ page, errors }) => {
  await seed(page, db("reveal", { 0: { p1: ans("Через розсіювання Релея", 0), p2: ans("Бо відбиває море", 1) } }), "t1");
  await page.goto("/live/play-teacher?code=12345678");
  await expect(page.locator("#grading .grp")).toHaveCount(2);
  await expect(page.locator("#grading .correct-line")).toContainText("зарахуйте вручну");
  await page.locator("#grading .grp", { hasText: "Релея" }).locator(".grade-btn").click();
  await expect(page.locator("#grading .grp.ok")).toHaveCount(1);
  const a = (await readDb(page)).rooms["12345678"].answers[0];
  expect([a.p1.isCorrect, a.p1.gradedByTeacher, a.p1.points > 0]).toEqual([true, true, true]);
  expect([a.p2.isCorrect, a.p2.points]).toEqual([false, 0]);
  expect(errors).toEqual([]);
});
