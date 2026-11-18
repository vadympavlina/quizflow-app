// Імпорт питань за посиланням на публічний Kahoot: воркер підмінено, перевіряємо вкладку, перегляд і додавання.
import { test, expect, seed } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

const WORKER = "https://mail.quizflow.test";
const KH = "https://create.kahoot.it/share/minecraft-ai/216bbd85-2759-43c0-b56f-63e2d937e67c";
const OK = { ok: true, title: "Minecraft AI: Розумні світи", skipped: 2, questions: [
  { type: "single", text: "Що таке Minecraft Education?", options: ["Версія гри для навчання", "Гра тільки для розваг", "Редактор відео"], correct: [0] },
  { type: "multi", text: "Які <b>блоки</b> горять?", options: ["Дерево", "Камінь", "Вугілля"], correct: [0, 2] },
  { type: "text", text: "Столиця України?", correct: "Київ / Kyiv" },
  { type: "ordering", text: "Розставте за порядком", items: ["Один", "Два", "Три"] },
] };
async function fakeWorker(page, calls, reply) {
  await page.context().route(`${WORKER}/**`, async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    calls.push({ path, body: req.postData() ? JSON.parse(req.postData()) : null, auth: req.headers()["authorization"] });
    route.fulfill({ status: reply.status || 200, contentType: "application/json", headers: cors, body: JSON.stringify(reply.body) });
  });
}
const db = () => { const d = rich(Date.now()); d.settings = { mail: { workerUrl: WORKER }, ai: { enabled: true } }; return d; };

test("Kahoot: посилання → перегляд питань → імпорт у тест; текст питань екранується", async ({ page, errors }) => {
  const calls = [];
  await fakeWorker(page, calls, { body: OK });
  await seed(page, db(), "t1");
  await page.goto("/constructor?id=T2");
  const before = await page.locator(".qi").count();
  await page.locator('[data-act="import"]').first().click();
  await page.locator('[data-act="im-tab"][data-tab="kahoot"]').click();
  await expect(page.locator("#im-pane-kahoot")).toBeVisible();
  await expect(page.locator('[data-act="template"]')).toBeHidden();
  await page.fill("#kh-url", KH);
  await page.locator("#kh-go").click();
  await expect(page.locator("#im-pv")).toBeVisible();
  await expect(page.locator("#im-sum")).toContainText("4 питання");
  await expect(page.locator("#kh-msg")).toContainText("Minecraft AI");
  expect(calls[0].path).toBe("/import/kahoot");
  expect(calls[0].body.url).toBe(KH);
  expect(calls[0].auth).toBe("Bearer mock-token-t1");
  expect(await page.locator("#im-list").innerHTML()).not.toContain("<b>блоки</b>");   // теги з Kahoot не потрапляють у HTML
  await page.locator("#im-go").click();
  await expect(page.locator(".qi")).toHaveCount(before + 4);
  expect(errors).toEqual([]);
});

test("Kahoot: помилка воркера показується під полем, імпорт недоступний", async ({ page, errors }) => {
  const calls = [];
  await fakeWorker(page, calls, { status: 404, body: { ok: false, error: "Тест не знайдено або він приватний. Імпорт працює лише з публічними тестами Kahoot." } });
  await seed(page, db(), "t1");
  await page.goto("/constructor?id=T2");
  await page.locator('[data-act="import"]').first().click();
  await page.locator('[data-act="im-tab"][data-tab="kahoot"]').click();
  await page.locator("#kh-go").click();
  await expect(page.locator("#kh-msg")).toContainText("Вставте посилання");           // порожнє поле
  await page.fill("#kh-url", KH);
  await page.keyboard.press("Enter");
  await expect(page.locator("#kh-msg")).toContainText("приватний");
  await expect(page.locator("#im-go")).toBeDisabled();
  expect(calls.length).toBe(1);
  expect(errors.filter(e => !/404/.test(e))).toEqual([]);
});
