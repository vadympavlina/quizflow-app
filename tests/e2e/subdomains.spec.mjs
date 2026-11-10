// Зв'язки з іншими частинами сайту (піддомени): посилання ведуть куди треба
import { test, expect, seed } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

test("посилання для студентів ведуть на test.quizflow.space", async ({ page, errors }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/links"); await page.waitForTimeout(1500);
  const txt = await page.locator(".l-url-text").first().innerText();
  expect(txt).toMatch(/^test\.quizflow\.space\/\?link=/);
  const title = await page.locator(".l-url-text").first().getAttribute("title");
  expect(title).toMatch(/^https:\/\/test\.quizflow\.space\/\?link=[^&]+&t=t1$/);
  expect(errors).toEqual([]);
});

test("меню: кнопка адмін-панелі веде на admin.quizflow.space", async ({ page, errors }) => {
  const db = rich(Date.now()); db.users.t1.role = "admin";
  await seed(page, db, "t1");
  await page.goto("/tests"); await page.waitForTimeout(1500);
  await expect(page.locator("#admin-panel-btn")).toHaveAttribute("href", "https://admin.quizflow.space/overview");
  expect(errors).toEqual([]);
});

test("вхід: «Приєднатись до гри» веде на play.quizflow.space", async ({ page, errors }) => {
  await page.goto("/login"); await page.waitForTimeout(800);
  await expect(page.locator('a[href="https://play.quizflow.space/"]').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("запуск гри: підказка для учнів показує play.quizflow.space", async ({ page, errors }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/live/setup?testId=T1"); await page.waitForTimeout(1800);
  await expect(page.locator("#join-hint")).toHaveText("play.quizflow.space/");
  expect(errors).toEqual([]);
});
