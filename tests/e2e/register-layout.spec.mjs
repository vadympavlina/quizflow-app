// Реєстрація за запрошенням і знайомство — у стилі нового логіну: темна панель зліва, світла правобіч
import { test, expect, seed } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

const inv = () => { const d = rich(Date.now()); d.invite_tokens = { invitetoken1: { used: false, createdAt: Date.now(), expiresAt: Date.now() + 864e5 } }; return d; };

test("реєстрація: темна панель із персонажем і форма на всю висоту", async ({ page, errors }) => {
  await seed(page, inv(), "");
  await page.goto("/register?token=invitetoken1");
  await page.locator("#vForm").waitFor({ state: "visible" });
  const hero = await page.locator(".hero").boundingBox(), side = await page.locator(".side").boundingBox(), vp = page.viewportSize();
  expect(hero.height).toBe(vp.height); expect(side.height).toBeGreaterThanOrEqual(vp.height);
  expect(hero.width).toBeGreaterThan(side.width);                        // ліва частина ширша (60/40)
  await expect(page.locator(".mascot")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("знайомство: перелік кроків ліворуч, крок праворуч, гортання працює", async ({ page, errors }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/onboarding");
  await page.locator("#obMain").waitFor({ state: "visible" });
  await expect(page.locator("#obList .feat")).toHaveCount(6);
  await expect(page.locator("#obNum")).toContainText("1");
  await page.locator("#obNext").click();
  await expect(page.locator("#obNum")).toContainText("2");
  expect(errors).toEqual([]);
});

test.describe("телефон", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("лише форма, без горизонтального скролу; посилання на вхід коротке", async ({ page, errors }) => {
    await seed(page, inv(), "");
    await page.goto("/register?token=invitetoken1");
    await page.locator("#vForm").waitFor({ state: "visible" });
    await expect(page.locator(".hero")).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect((await page.locator(".top-link").boundingBox()).height).toBeLessThan(40);   // не переноситься на два рядки
    expect(errors).toEqual([]);
  });
});
