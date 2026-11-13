// Сторінка під відкритою панеллю не прокручується (ПК: колесо; телефон: дотик по підкладці й по шторці)
import { test, expect, seed } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

async function prep(page, open) {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/attempts"); await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.evaluate(id => window.openM(id), open);
  await page.waitForTimeout(500);
}
const y = page => page.evaluate(() => Math.round(window.scrollY));

test("ПК: колесо над підкладкою й над модалкою не прокручує сторінку; після закриття прокрутка повертається", async ({ page, errors }) => {
  await prep(page, "m-folder");
  expect(await y(page)).toBe(200);
  await page.mouse.move(60, 300); await page.mouse.wheel(0, 700); await page.waitForTimeout(250);
  const box = await page.locator("#m-folder .mb").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 20); await page.mouse.wheel(0, 700); await page.waitForTimeout(250);
  expect(await y(page)).toBe(200);
  expect(await page.evaluate(() => document.documentElement.classList.contains("qf-lock"))).toBe(true);
  await page.evaluate(() => window.closeM("m-folder")); await page.waitForTimeout(350);
  expect(await page.evaluate(() => document.documentElement.classList.contains("qf-lock"))).toBe(false);
  await page.mouse.move(700, 400); await page.mouse.wheel(0, 400); await page.waitForTimeout(400);
  expect(await y(page)).toBeGreaterThan(200);
  expect(errors).toEqual([]);
});

test.describe("телефон", () => {
  test.use({ viewport: { width: 390, height: 700 }, hasTouch: true });
  async function drag(page, cdp, x, y0, y1) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0, id: 1 }] });
    for (let i = 1; i <= 8; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 + (y1 - y0) * i / 8, id: 1 }] }); await page.waitForTimeout(16); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  test("дотик по підкладці й тяга шторки не рухають сторінку під нею", async ({ page, errors }) => {
    await prep(page, "m-folder");
    const cdp = await page.context().newCDPSession(page);
    await drag(page, cdp, 200, 80, -100);                 // свайп вгору по підкладці
    await drag(page, cdp, 200, 100, 300);                 // свайп вниз по підкладці
    expect(await y(page)).toBe(200);
    const box = await page.locator("#m-folder .mb").boundingBox();
    await drag(page, cdp, box.x + box.width / 2, box.y + 14, box.y + 50);   // коротка тяга шторки: сторінка стоїть
    await page.waitForTimeout(450);
    expect(await y(page)).toBe(200);
    expect(errors).toEqual([]);
  });
});
