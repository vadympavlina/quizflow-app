// Сторінка «Оновлення»: список випусків, фільтр за типом, пункт меню, екранування
import { test, expect, seed } from "./fixtures.mjs";

const db = { users: { t1: { role: "admin", name: "A" } }, teachers: { t1: { tests: {} } } };

test("оновлення: випуски від найновішого, фільтр за типом, пункт у меню", async ({ page, errors }) => {
  await seed(page, db, "t1");
  await page.goto("/updates");
  await expect(page.locator("#up-list .up-rel").first()).toBeVisible();
  await expect(page.locator(".up-last")).toHaveCount(1);
  await expect(page.locator("#sidebar .ni.active")).toContainText("Оновлення");

  const total = await page.locator(".up-it").count();
  expect(total).toBeGreaterThan(10);
  await page.locator('.up-chip[data-f="fix"]').click();
  const fixes = await page.locator(".up-it").count();
  expect(fixes).toBeGreaterThan(0);
  expect(fixes).toBeLessThan(total);
  await expect(page.locator(".up-it .up-tag:not(:has-text('Виправлено'))")).toHaveCount(0);
  await expect(page.locator(".up-last")).toHaveCount(0);       // позначка «останнє» лише без фільтра
  await page.locator('.up-chip[data-f="all"]').click();
  expect(await page.locator(".up-it").count()).toBe(total);

  // дати йдуть від новіших до старіших
  const dates = await page.evaluate(async () => (await import("/shared/changelog.js")).CHANGELOG.map(r => r.date));
  expect([...dates].sort().reverse()).toEqual(dates);
  expect(errors).toEqual([]);
});

test("оновлення: пункт меню з'являється й у збереженому в базі меню без нього", async ({ page }) => {
  await seed(page, { ...db, settings: { navigation: [{ label: "Головне", items: [{ id: "dashboard", label: "Дашборд", file: "./", icon: "dashboard" }, { id: "news", label: "Новини", file: "news", icon: "news" }] }] } }, "t1");
  await page.goto("/news");
  await expect(page.locator('#sidebar .ni[data-key="updates"], #sidebar a[href="updates"]').first()).toBeVisible();
});
