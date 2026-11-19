// Кулька «Підтримка» справа знизу: звернення, «Мої звернення» зі статусом, не заважає вікнам
import { test, expect, seed, readDb } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";
const S = "/tmp/claude-0/-home-user-QuizFlow/45fb55bb-9a1f-5088-bc4a-437be91ed82d/scratchpad";

test("кулька: надіслати проблему — повне звернення в bugReports, коротка копія в bugStatus, контекст сам", async ({ page, errors }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/tests"); await page.waitForTimeout(1200);
  const fab = page.locator(".qfs-fab");
  await expect(fab).toBeVisible();
  await fab.click();
  await expect(page.locator(".qfs-pop")).toBeVisible();
  await expect(page.locator(".qfs-ctx")).toContainText("Тести");
  await page.locator(".qfs-send").click();
  await expect(page.locator(".qfs-err")).toContainText("Опишіть");
  await page.locator('.qfs-kind [data-k="idea"]').click();
  await page.locator(".qfs-ta").fill("Додати темну тему");
  await page.locator(".qfs-send").click();
  await expect(page.locator(".qfs-ok")).toContainText("надіслано");
  const db = await readDb(page);
  const [id, r] = Object.entries(db.bugReports)[0];
  expect(r.message).toBe("Додати темну тему");
  expect(r.reportType).toBe("improvement");
  expect(r.uid).toBe("t1");
  expect(r.ctx.page).toContain("Тести");
  expect(r.ctx.browser).toBeTruthy();
  expect(db.bugStatus.t1[id]).toMatchObject({ t: "Додати темну тему", k: "idea", s: "new" });
  await page.locator('.qfs-tabs [data-tab="mine"]').click();
  await expect(page.locator(".qfs-it")).toContainText("Додати темну тему");
  await expect(page.locator(".qfs-it .qfs-st")).toHaveText("Надіслано");
  await page.keyboard.press("Escape");
  await expect(page.locator(".qfs-pop")).toBeHidden();
  expect(errors).toEqual([]);
});

test("статус з адмінки: крапка на кульці, у «Моїх зверненнях» — «Виправлено» і відповідь; після перегляду крапка зникає", async ({ page, errors }) => {
  const d = rich(Date.now());
  d.bugStatus = { t1: { b1: { t: "Не зберігається картинка", k: "bug", p: "Конструктор", at: Date.now() - 864e5, s: "resolved", r: "Виправили, оновіть сторінку" } } };
  await seed(page, d, "t1");
  await page.goto("/"); await page.waitForTimeout(1200);
  await expect(page.locator(".qfs-fab")).toHaveClass(/has-dot/);
  await page.locator(".qfs-fab").click();
  await expect(page.locator('.qfs-tabs [data-tab="mine"] i')).toHaveText("1");
  await page.locator('.qfs-tabs [data-tab="mine"]').click();
  await expect(page.locator(".qfs-it .qfs-st")).toHaveText("Виправлено");
  await expect(page.locator(".qfs-reply")).toContainText("Виправили");
  await page.waitForTimeout(1400);
  await page.locator(".qfs-pop [data-x]").click();
  await expect(page.locator(".qfs-fab")).not.toHaveClass(/has-dot/);
  await page.reload(); await page.waitForTimeout(1200);
  await expect(page.locator(".qfs-fab")).not.toHaveClass(/has-dot/);
  expect(errors).toEqual([]);
});

test("пункт меню «Повідомити про помилку» відкриває ту саму панель; кулька ховається під відкритим вікном", async ({ page, errors }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/tests"); await page.waitForTimeout(1200);
  await page.evaluate(() => window.openBugReport());
  await expect(page.locator(".qfs-pop")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.querySelector(".mo")?.classList.add("on"));
  await expect(page.locator(".qfs-fab")).toBeHidden();
  await page.evaluate(() => document.querySelector(".mo.on")?.classList.remove("on"));
  await expect(page.locator(".qfs-fab")).toBeVisible();
  // «Сховати кнопку» — лишається тонка смужка на краю, кнопка повертається з неї
  await page.locator(".qfs-fab").click();
  await page.locator(".qfs-pop [data-hide]").click();
  await expect(page.locator(".qfs-fab")).toBeHidden();
  await page.locator(".qfs-tab").click();
  await expect(page.locator(".qfs-pop")).toBeVisible();
  expect(errors).toEqual([]);
});

for (const [n, vp] of [["комп'ютер", { width: 1280, height: 800 }], ["телефон", { width: 390, height: 844 }]]) {
  test(`конструктор (${n}): кулька є, контекст — тест і номер питання, не перекриває нижню панель`, async ({ page, errors }) => {
    await page.setViewportSize(vp);
    const d = rich(Date.now());
    await seed(page, d, "t1");
    const id = Object.keys(d.teachers.t1.tests)[0];
    await page.goto("/constructor?id=" + id); await page.waitForTimeout(1300);
    const fab = page.locator(".qfs-fab");
    await expect(fab).toBeVisible();
    const fb = await fab.boundingBox(), nav = await page.locator(".qnav").boundingBox();
    if (vp.width < 700) expect(fb.y + fb.height).toBeLessThanOrEqual(nav.y + 1);   // над панеллю «Попереднє / Наступне»
    await page.screenshot({ path: `${S}/sup-c-${vp.width}.png` });
    await fab.click();
    await expect(page.locator(".qfs-ctx")).toContainText("Конструктор");
    await expect(page.locator(".qfs-ctx")).toContainText("Питання 1");
    await page.locator(".qfs-ta").fill("Не перетягується питання");
    await page.waitForTimeout(500); await page.screenshot({ path: `${S}/sup-o-${vp.width}.png` });
    await page.locator(".qfs-send").click();
    await expect(page.locator(".qfs-ok")).toBeVisible();
    const r = Object.values((await readDb(page)).bugReports)[0];
    expect(r.ctx.test).toBeTruthy();
    expect(r.ctx.q).toBe(1);
    await page.locator(".qfs-pop [data-x]").click();
    await page.locator('.tb[data-act="ai"], [data-act="ai"]').first().click();
    await expect(fab).toBeHidden();                                                   // під вікном AI кульки немає
    expect(errors).toEqual([]);
  });
}
