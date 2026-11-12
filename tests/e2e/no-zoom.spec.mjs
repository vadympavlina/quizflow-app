// На телефоні поля вводу мають шрифт від 16px, інакше iOS збільшує сторінку при фокусі
import { test, expect, seed } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

for (const pg of ["tests", "profile", "links", "constructor", "students"]) {
  test(`${pg}: усі поля вводу не менше 16px на телефоні`, async ({ page }) => {
    const d = rich(Date.now());
    await seed(page, d, "t1");
    const q = pg === "constructor" ? `?id=${Object.keys(d.teachers.t1.tests)[0]}` : "";
    await page.goto("/" + pg + q); await page.waitForTimeout(1800);
    const small = await page.evaluate(() => [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select")]
      .map(e => ({ id: e.id || e.className, fs: parseFloat(getComputedStyle(e).fontSize) })).filter(x => x.fs < 16));
    expect(small).toEqual([]);
  });
}

test("meta viewport не забороняє масштабування жестом (доступність)", async ({ page }) => {
  await page.goto("/404.html");
  const meta = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(meta).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/);
});
