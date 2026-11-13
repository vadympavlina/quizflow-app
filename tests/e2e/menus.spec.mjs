// Випадні меню на вузькому екрані не вилазять за межі вікна
import { test, expect, seed } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

for (const w of [390, 360, 320]) {
  test(`меню сортування в «Тестах» (${w} px) вміщається в екран і повертається на місце після закриття`, async ({ page, errors }) => {
    await page.setViewportSize({ width: w, height: 800 });
    await seed(page, rich(Date.now()), "t1");
    await page.goto("/tests"); await page.waitForTimeout(1400);
    await page.locator("#cd-tsort .cd-btn").click(); await page.waitForTimeout(350);
    const r = await page.evaluate(() => { const b = document.getElementById("cd-tsort-menu").getBoundingClientRect(); return { l: b.left, r: b.right, vw: document.documentElement.clientWidth }; });
    expect(r.l, "ліва межа меню").toBeGreaterThanOrEqual(7);
    expect(r.r, "права межа меню").toBeLessThanOrEqual(r.vw - 7);
    // усі пункти читаються (текст не зрізаний зліва)
    expect(await page.locator("#cd-tsort-menu .cd-item").first().isVisible()).toBe(true);
    await page.locator("#cd-tsort-menu .cd-item[data-sort=\"name\"]").click();
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => getComputedStyle(document.getElementById("cd-tsort-menu")).translate)).toMatch(/none|^0px/);
    expect(errors).toEqual([]);
  });
}

test("на широкому екрані меню не зсувається", async ({ page, errors }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/tests"); await page.waitForTimeout(1400);
  await page.locator("#cd-tsort .cd-btn").click(); await page.waitForTimeout(300);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById("cd-tsort-menu")).translate)).toMatch(/none|^0px/);
  expect(errors).toEqual([]);
});
