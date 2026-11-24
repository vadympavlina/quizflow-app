// Поки сторінка вантажиться, її закриває лоадер на весь екран (меню теж), а потім усе з'являється разом
import { test, expect, seed } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

test("лоадер закриває весь екран разом із меню, потім зникає", async ({ page, errors }) => {
  await seed(page, rich(Date.now()), "t1");
  // Затримуємо Firebase, щоб застати стан завантаження
  await page.route(/shared\/app\.js/, async r => { await new Promise(x => setTimeout(x, 1200)); await r.continue(); });
  await page.goto("/tests", { waitUntil: "commit" });
  const ldr = page.locator("#app-loader");
  await expect(ldr).toBeVisible();
  const box = await ldr.boundingBox();
  const vp = page.viewportSize();
  expect(box.x).toBe(0); expect(box.y).toBe(0);
  expect(box.width).toBe(vp.width); expect(box.height).toBe(vp.height);
  // Меню існує, але лежить під лоадером
  const top = await page.evaluate(() => { const sb = document.getElementById("sidebar"); if (!sb) return "none"; const r = sb.getBoundingClientRect(); return document.elementFromPoint(r.left + 20, r.top + 60)?.closest("#app-loader") ? "loader" : "page"; });
  expect(["loader", "none"]).toContain(top);
  await expect(ldr).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator("#sidebar")).toBeVisible();
  expect(errors).toEqual([]);
});
