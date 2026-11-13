// Вкладки-фільтри на телефоні: затінення краю показує, що є ще, активна вкладка в зоні видимості
import { test, expect, seed } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("вкладки «Спроб» гортаються: праворуч затінення, після прокрутки — з обох боків", async ({ page, errors }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/attempts"); await page.waitForTimeout(3200);
  const tabs = page.locator("#sec-attempts .tabs").first();
  await expect(tabs).toHaveClass(/fade-r/);
  await expect(tabs).not.toHaveClass(/fade-l/);
  await tabs.evaluate(el => { el.scrollLeft = 60; });
  await page.waitForTimeout(200);
  await expect(tabs).toHaveClass(/fade-l/);
  expect(errors).toEqual([]);
});

test("«Гра» на сторінці «Тести» — головна дія, «Посилання» — другорядна", async ({ page }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/tests"); await page.waitForTimeout(1800);
  const bg = sel => page.locator(sel).first().evaluate(e => getComputedStyle(e).backgroundColor);
  const live = await bg("#sec-tests .t-lb.live"), link = await bg('#sec-tests .t-lb[data-act="link"]');
  expect(live).not.toBe("rgb(255, 255, 255)");
  expect(link).toBe("rgb(255, 255, 255)");
});
