// Усі листи, пов'язані з акаунтами: відновлення пароля (сторінка входу й адмінка),
// сторінка нового пароля з листа, лист новому викладачу через воркер пошти.
// Firebase Auth підмінено (e2e/mock/auth.js пише виклики в localStorage.authlog).
import { test, expect, seed, readDb } from "./fixtures.mjs";
import { admSeed } from "./seeds/admin.mjs";

const authlog = page => page.evaluate(() => JSON.parse(localStorage.getItem("authlog") || "[]"));
const WORKER = "https://mail.quizflow.test";

test("вхід → «Забули пароль?»: лист відновлення з поверненням на вхід", async ({ page, errors }) => {
  await seed(page, { users: {} });
  await page.goto("/login");
  await page.click('[data-go="forgot"]');
  await page.fill("#femail", "teacher@school.ua");
  await page.click("#forgotBtn");
  await expect(page.locator("#sentTo")).toHaveText("teacher@school.ua");
  const reset = (await authlog(page)).find(([k]) => k === "reset");
  expect(reset[1][0]).toBe("teacher@school.ua");
  expect(reset[1][1]).toMatch(/\/login\?email=teacher%40school\.ua$/);
  // Забагато запитів — зрозуміла помилка
  await page.evaluate(() => localStorage.removeItem("authlog"));
  await page.goto("/login?again=1#forgot");
  await page.fill("#femail", "limit@x.ua");
  await page.click("#forgotBtn");
  await expect(page.locator("#forgotMsg")).toContainText("Забагато запитів");
  expect(errors).toEqual([]);
});

test("посилання з листа → новий пароль", async ({ page, errors }) => {
  await seed(page, { users: {} });
  await page.goto("/auth-action?mode=resetPassword&oobCode=good");
  await page.fill("#p1", "NewPass-2026!");
  await page.fill("#p2", "NewPass-2026!");
  await page.click("#save");
  await expect.poll(async () => (await authlog(page)).find(([k]) => k === "confirm")?.[1]).toEqual(["good", "NewPass-2026!"]);
  // Прострочене посилання — пояснення, а не форма
  await page.goto("/auth-action?mode=resetPassword&oobCode=old");
  await expect(page.locator("body")).toContainText(/застаріл|термін|минув|недійсн/i);
  expect(errors).toEqual([]);
});

async function workerReset(page, status = 200, body = { ok: true }) {
  const calls = [];
  await page.context().route(`${WORKER}/**`, route => {
    const req = route.request();
    calls.push({ path: new URL(req.url()).pathname, body: JSON.parse(req.postData() || "null"), auth: req.headers()["authorization"] || "" });
    route.fulfill({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) });
  });
  return calls;
}

test("«Забули пароль?» через воркер: Firebase не надсилає свій лист", async ({ page, errors }) => {
  const calls = await workerReset(page);
  await seed(page, { settings: { mail: { workerUrl: WORKER } } });
  await page.goto("/login#forgot");
  await page.fill("#femail", "teacher@school.ua");
  await page.click("#forgotBtn");
  await expect(page.locator("#sentTo")).toHaveText("teacher@school.ua");
  expect(calls).toEqual([{ path: "/reset", body: { email: "teacher@school.ua" }, auth: "" }]);
  expect((await authlog(page)).filter(([k]) => k === "reset")).toEqual([]);
  expect(errors).toEqual([]);
});

test("«Забули пароль?»: воркер без службового ключа — запасний лист Firebase; ліміт — повідомлення", async ({ page, errors }) => {
  await workerReset(page, 503, { ok: false, error: "нема ключа", code: "not_configured" });
  await seed(page, { settings: { mail: { workerUrl: WORKER } } });
  await page.goto("/login#forgot");
  await page.fill("#femail", "teacher@school.ua");
  await page.click("#forgotBtn");
  await expect(page.locator("#sentTo")).toHaveText("teacher@school.ua");
  expect((await authlog(page)).find(([k]) => k === "reset")?.[1]?.[0]).toBe("teacher@school.ua");

  await page.context().unroute(`${WORKER}/**`);
  await workerReset(page, 429, { ok: false, error: "Забагато запитів. Спробуйте за кілька хвилин." });
  await page.goto("/login?again=1#forgot");
  await page.fill("#femail", "other@school.ua");
  await page.click("#forgotBtn");
  await expect(page.locator("#forgotMsg")).toContainText("Забагато запитів");
  expect(errors).toEqual([]);
});

test("вхід: без циклу, якщо панель щойно не побачила сесію", async ({ page, errors }) => {
  await seed(page, admSeed(Date.now()), "t1");
  await page.evaluate(() => sessionStorage.setItem("qf_auth_bounce", String(Date.now())));
  await page.goto("/login");
  await expect(page.locator("#loginMsg")).toContainText("Сесію не вдалося відновити");
  await page.waitForTimeout(800);
  expect(new URL(page.url()).pathname).toBe("/login");
  expect((await authlog(page)).some(([k]) => k === "signOut")).toBe(true);
  // Без позначки — звичайне автоповернення в панель
  await seed(page, admSeed(Date.now()), "t1");
  await page.goto("/login");
  await page.waitForURL(u => new URL(u).pathname === "/");
  expect(errors).toEqual([]);
});
