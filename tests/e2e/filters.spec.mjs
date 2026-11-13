// Телефон: фільтри в нижній шторці з лічильником; на ПК лишаються в рядку
import { test, expect, seed } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

test.describe("телефон", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("«Спроби»: у рядку пошук і кнопка «Фільтри», списки — у шторці; лічильник показує активні", async ({ page, errors }) => {
    await seed(page, rich(Date.now()), "t1");
    await page.goto("/attempts"); await page.waitForTimeout(3000);
    const btn = page.locator(".qf-fbtn").first();
    await expect(btn).toBeVisible();
    const sb = await page.locator("#att-srch-wrap").boundingBox(), bb = await btn.boundingBox();
    expect(Math.abs(sb.y - bb.y)).toBeLessThan(20);                       // кнопка в одному рядку з пошуком
    expect(await page.locator("#att-f-test").isVisible()).toBe(false);    // списки сховані до відкриття
    await btn.click(); await page.waitForTimeout(500);
    await expect(page.locator(".qf-fs.on")).toBeVisible();
    await page.locator(".qf-fs-b .qd-btn").nth(1).click();               // «Усі групи»
    await page.locator(".qd-pop .qd-it").nth(1).click();
    await page.waitForTimeout(300);
    await page.locator(".qf-fs-x").click(); await page.waitForTimeout(450);
    await expect(page.locator(".qf-fb-n").first()).toHaveText("1");
    await expect(page.locator(".qf-fs.on")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("шторку фільтрів можна змахнути вниз", async ({ page }) => {
    await seed(page, rich(Date.now()), "t1");
    await page.goto("/attempts"); await page.waitForTimeout(3000);
    await page.locator(".qf-fbtn").first().click(); await page.waitForTimeout(500);
    const box = await page.locator(".qf-fs").boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const x = box.x + box.width / 2, y0 = box.y + 12;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0, id: 1 }] });
    for (let i = 1; i <= 8; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 + i * 30, id: 1 }] }); await page.waitForTimeout(16); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.locator(".qf-fs.on")).toHaveCount(0);
  });
});

test("ПК: фільтри «Спроб» лишаються в рядку, кнопки «Фільтри» немає", async ({ page }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/attempts"); await page.waitForTimeout(3000);
  expect(await page.locator("#att-f-test").isVisible()).toBe(true);
  expect(await page.locator(".qf-fbtn").first().isVisible()).toBe(false);
});
