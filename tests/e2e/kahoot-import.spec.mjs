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

test("Новий тест: посилання на Kahoot підставляє назву й питання, тест створюється одразу з ними і відкривається в конструкторі", async ({ page, errors }) => {
  const calls = [];
  await fakeWorker(page, calls, { body: OK });
  await seed(page, db(), "t1");
  await page.goto("/tests"); await page.waitForTimeout(800);
  await page.locator("#sb-new").click();
  await expect(page.locator("#nt-kh")).toBeHidden();
  await page.locator("#nt-kh-t").click();                                      // маленька кнопка «Імпортувати з Kahoot»
  await expect(page.locator("#nt-kh")).toBeVisible();
  await page.fill("#nt-kh-url", KH);
  await page.locator("#nt-kh-go").click();
  await expect(page.locator("#nt-kh-msg")).toContainText("Знайдено 4 питання");
  await expect(page.locator("#nt-kh-msg")).toContainText("2 пропущено");
  await expect(page.locator("#nt-n")).toHaveValue("Minecraft AI: Розумні світи");   // назва з Kahoot
  await expect(page.locator("#nt-submit")).toContainText("Створити тест · 4");
  expect(calls[0].auth).toBe("Bearer mock-token-t1");
  await page.locator("#nt-submit").click();
  await page.waitForURL(/constructor\?id=/);
  await expect(page.locator(".qi")).toHaveCount(4);                            // питання вже в конструкторі
  await expect(page.locator("#title")).toHaveValue("Minecraft AI: Розумні світи");
  expect(errors).toEqual([]);
});

test("Новий тест: помилка Kahoot не блокує звичайне створення тесту", async ({ page, errors }) => {
  const calls = [];
  await fakeWorker(page, calls, { status: 404, body: { ok: false, error: "Тест не знайдено або він приватний." } });
  await seed(page, db(), "t1");
  await page.goto("/tests"); await page.waitForTimeout(800);
  await page.locator("#sb-new").click();
  await page.locator("#nt-kh-t").click();
  await page.fill("#nt-kh-url", KH);
  await page.locator("#nt-kh-go").click();
  await expect(page.locator("#nt-kh-msg")).toContainText("приватний");
  await expect(page.locator("#nt-submit")).toHaveText("Створити тест →");
  await page.fill("#nt-n", "Звичайний тест");
  await page.locator("#nt-submit").click();
  await page.waitForURL(/constructor\?id=/);
  await expect(page.locator("#title")).toHaveValue("Звичайний тест");         // створився порожній тест, як і раніше
  expect(errors.filter(e => !/404/.test(e))).toEqual([]);
});
