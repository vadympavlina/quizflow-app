// Сторінка входу: темна панель з персонажем і текстом зліва, форма справа; на телефоні лише форма
import { test, expect, seed } from "./fixtures.mjs";

const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

test("комп'ютер: зліва текст над персонажем, справа форма; нічого не вилазить за екран", async ({ page, errors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { users: {} });
  await page.goto("/login"); await page.waitForTimeout(900);
  const hero = await page.locator(".hero").boundingBox(), side = await page.locator(".side").boundingBox();
  expect(hero.x).toBeLessThan(side.x);                                             // панель зліва, форма справа
  // обидві панелі на весь екран, без полів навколо; заокруглення лише там, де вони стикаються
  expect(Math.round(hero.x)).toBe(0); expect(Math.round(hero.y)).toBe(0); expect(Math.round(hero.height)).toBe(800);
  expect(Math.round(side.y)).toBe(0); expect(Math.round(side.height)).toBe(800); expect(Math.round(side.x + side.width)).toBe(1280);
  const rad = await page.evaluate(() => { const c = getComputedStyle(document.querySelector(".side")), h = getComputedStyle(document.querySelector(".hero")); return [c.borderTopLeftRadius, c.borderBottomLeftRadius, c.borderTopRightRadius, c.borderBottomRightRadius, h.borderTopLeftRadius]; });
  expect(rad.map(x => parseFloat(x))).toEqual([34, 34, 0, 0, 0]);
  const h1 = await page.locator(".hero h1").boundingBox(), m = await page.locator(".mascot").boundingBox();
  expect(h1.y + h1.height).toBeLessThan(m.y + 40);                                 // текст над персонажем, без перекриття
  expect(m.y + m.height).toBeGreaterThan(hero.y + hero.height - 40);               // персонаж стоїть унизу панелі
  // персонаж — легкий файл (швидко вантажиться) і з'являється, коли завантажився
  const sz = await page.evaluate(async () => (await fetch(document.querySelector(".mascot").src)).blob().then(b => b.size));
  expect(sz).toBeLessThan(160000);
  await expect(page.locator(".mascot.in")).toHaveCount(1);
  for (const sel of ["#email", "#pass", "#loginBtn", "#remember", ".top-link"]) await expect(page.locator(sel)).toBeVisible();
  expect(await page.locator(".top-link").getAttribute("href")).toContain("play.quizflow.space");
  expect(await noOverflow(page)).toBe(true);
  // порожній вхід показує помилку, поле підсвічується
  await page.click("#loginBtn");
  await expect(page.locator("#loginMsg")).toContainText("email");
  expect(errors).toEqual([]);
});

test.describe("телефон", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("лише форма: лівої панелі немає, усе вміщається, відновлення пароля працює", async ({ page, errors }) => {
    await seed(page, { users: {} });
    await page.goto("/login"); await page.waitForTimeout(700);
    await expect(page.locator(".hero")).toBeHidden();
    for (const sel of ["#email", "#pass", "#loginBtn", ".top-link"]) await expect(page.locator(sel)).toBeVisible();
    const btn = await page.locator("#loginBtn").boundingBox();
    expect(btn.y + btn.height).toBeLessThan(844);                                  // кнопка видна без прокрутки
    expect(await noOverflow(page)).toBe(true);
    await page.locator('[data-go="forgot"]').tap();
    await expect(page.locator("#fAsk")).toBeVisible();
    await expect(page.locator("#femail")).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    expect(errors).toEqual([]);
  });
});
