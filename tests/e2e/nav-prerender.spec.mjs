// Меню передзавантажує внутрішні сторінки (speculation rules) — перехід між розділами швидший.
import { test, expect, seed } from "./fixtures.mjs";

test("меню: правила передзавантаження лише для внутрішніх посилань меню", async ({ page, errors }) => {
  await seed(page, { users: { t1: { role: "teacher" } } }, "t1");
  await page.goto("/tests");
  const rules = await page.evaluate(() => { const s = document.querySelector("script[data-qf-spec]"); return s ? JSON.parse(s.textContent) : null; });
  if (rules === null) { test.skip(true, "браузер без speculation rules"); return; }
  const r = rules.prerender[0];
  expect(r.eagerness).toBe("moderate");
  expect(JSON.stringify(r.where)).toContain("#sidebar a.ni:not([target])");
  expect(JSON.stringify(r.where)).toContain('"/*"');
  expect(await page.locator("script[data-qf-spec]").count()).toBe(1);
  expect(errors).toEqual([]);
});
