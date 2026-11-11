// Дашборд: швидкі дії замість статистики
import { test, expect, seed } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

test("швидкі дії: плитки на місці, статистики тижня немає", async ({ page, errors }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/"); await page.waitForTimeout(1800);
  await expect(page.locator("#dx-q .dx-qi")).toHaveCount(6);
  await expect(page.locator(".dx-kpi")).toHaveCount(0);
  await expect(page.locator("#dx-q-revn")).toBeVisible();          // є роботи на перевірці — лічильник на плитці
  await expect(page.locator("#dx-tests .dx-qr")).not.toHaveCount(0);
  await expect(page.locator("#dx-links .dx-qr")).not.toHaveCount(0);
  expect(errors).toEqual([]);
});

test("«Запустити гру»: вибір тесту → вікно налаштувань → кімната в лоббі", async ({ page, errors }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/"); await page.waitForTimeout(1800);
  await page.locator('#dx-q [data-dx="game"]').click();
  await page.locator(".dx-pick-it").first().click();
  await expect(page.locator("#m-game.on")).toBeVisible();
  await page.click("#gm-go");
  await page.waitForURL(/live\/lobby\?code=\d{8}/);
  expect(errors.filter(e => !/lobby|bad params/.test(e))).toEqual([]);
});

test("рядок тесту: «Гра» і «Посилання» відкривають свої вікна", async ({ page }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/"); await page.waitForTimeout(1800);
  await page.locator('#dx-tests [data-dxa="game"]').first().click();
  await expect(page.locator("#m-game.on")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#m-game.on")).toHaveCount(0);
  await page.locator('#dx-tests [data-dxa="link"]').first().click();
  await expect(page.locator("#m-link.on")).toBeVisible();
});
