// Ліміт часу задається в посиланні, а не в тесті
import { test, expect, seed, readDb } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

test("посилання: час на проходження зберігається в посиланні", async ({ page, errors }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/"); await page.waitForTimeout(1800);
  await page.locator('#dx-tests [data-dxa="link"]').first().click();
  await expect(page.locator("#m-link.on")).toBeVisible();
  await expect(page.locator("#nl-tm-off")).toBeChecked();          // тест без часу — за замовчуванням без ліміту
  await expect(page.locator("#nl-tm")).toBeDisabled();
  await page.locator('#nl-tm-presets [data-m="45"]').click();
  await expect(page.locator("#nl-tm-off")).not.toBeChecked();
  await expect(page.locator('#nl-tm-presets [data-m="45"]')).toHaveClass(/on/);
  await page.click("#nl-submit-btn");
  await expect.poll(async () => {
    const db = await readDb(page);
    return Object.values(db.teachers.t1.links).find(l => l.timeLimit === 2700) ? 1 : 0;
  }, { timeout: 10_000 }).toBe(1);
  expect(errors).toEqual([]);
});

test("нове вікно тесту і конструктор: поля часу немає", async ({ page, errors }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/tests"); await page.waitForTimeout(1500);
  await expect(page.locator("#nt-tm")).toHaveCount(0);
  await page.goto("/constructor?id=" + Object.keys(rich(Date.now()).teachers.t1.tests)[0]);
  await page.waitForTimeout(1500);
  await expect(page.locator("#time-sec")).toHaveCount(0);
  expect(errors).toEqual([]);
});
