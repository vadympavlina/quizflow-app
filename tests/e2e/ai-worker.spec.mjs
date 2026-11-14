// AI через воркер у конструкторі: браузер не бачить ключів, запит іде у воркер з токеном викладача,
// облік використання веде воркер (браузер не дублює його).
import { test, expect, seed, readDb } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

const WORKER = "https://mail.quizflow.test";
const ANSWER = JSON.stringify([{ type: "single", text: "Столиця Франції?", options: ["Париж", "Рим", "Берлін", "Мадрид"], correct: [0] }]);

async function fakeWorker(page, calls, { status = 200, body } = {}) {
  await page.context().route(`${WORKER}/**`, async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    calls.push({ path, body: req.postData() ? JSON.parse(req.postData()) : null, auth: req.headers()["authorization"] });
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body || { ok: true, text: ANSWER, tokens: 120, provider: "groq" }) });
  });
}
const db = (viaWorker = true) => {
  const d = rich(Date.now());
  d.settings = { mail: { workerUrl: WORKER }, ai: { enabled: true, groqModel: "llama-3.3-70b-versatile", ...(viaWorker ? { viaWorker: true } : {}) } };
  return d;
};
async function generate(page) {
  await page.goto("/constructor?id=T2");
  await page.locator('.tb[data-act="ai"]').click();
  await page.locator("#ai-topic").fill("Столиці Європи");
  await page.locator("#ai-go").click();
}

test("конструктор: генерація питань іде через воркер з токеном викладача й без ключа", async ({ page, errors }) => {
  const calls = [];
  await fakeWorker(page, calls);
  await seed(page, db(), "t1");
  await generate(page);
  await expect(page.getByText("Додано 1 питання")).toBeVisible({ timeout: 8000 });
  expect(calls.length).toBe(1);
  expect(calls[0].path).toBe("/ai");
  expect(calls[0].auth).toBe("Bearer mock-token-t1");
  expect(calls[0].body.feature).toBe("generation");
  expect(calls[0].body.messages[0].content).toContain("Столиці Європи");
  expect(JSON.stringify(calls[0].body)).not.toMatch(/gsk_|AIza/);
  // облік веде воркер: браузер лічильник не пише
  const usage = (await readDb(page)).aiUsage || {};
  expect(JSON.stringify(usage)).not.toContain("generation");
  expect(errors).toEqual([]);
});

test("відмова воркера (ліміт) показується викладачу, браузер не рахує її помилкою AI", async ({ page }) => {
  const calls = [];
  await fakeWorker(page, calls, { status: 429, body: { ok: false, error: "Ліміт AI-запитів на цей місяць вичерпано (50). Зверніться до адміністратора.", code: "qf/ai-quota" } });
  await seed(page, db(), "t1");
  await generate(page);
  await expect(page.getByText("Ліміт AI-запитів на цей місяць вичерпано")).toBeVisible({ timeout: 8000 });
  expect(JSON.stringify((await readDb(page)).aiUsage || {})).not.toContain("errors");
});

test("без прапорця viaWorker запит у воркер не йде (старий режим напряму)", async ({ page }) => {
  const calls = [];
  await fakeWorker(page, calls);
  await seed(page, db(false), "t1");
  await page.goto("/constructor?id=T2");
  await page.locator('.tb[data-act="ai"]').click();
  await page.locator("#ai-topic").fill("Тема");
  await page.locator("#ai-go").click();
  await page.waitForTimeout(1200);
  expect(calls.length).toBe(0);
});
