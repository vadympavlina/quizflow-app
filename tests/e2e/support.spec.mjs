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

// Телефон: шторка знизу. Сторінка під нею не гортається, «Назад» і свайп униз закривають шторку.
test.describe("телефон: шторка підтримки", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const swipe = async (page, x, y1, y2) => {
    const c = await page.context().newCDPSession(page);
    await c.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y1 }] });
    for (let i = 1; i <= 6; i++) await c.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y1 + (y2 - y1) * i / 6 }] });
    await c.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };

  test("сторінка під шторкою стоїть на місці; гортання списку — усередині шторки; «Назад» закриває шторку", async ({ page, errors }) => {
    const d = rich(Date.now());
    d.bugStatus = { t1: Object.fromEntries(Array.from({ length: 12 }, (_, i) => ["b" + i, { t: "Звернення номер " + (i + 1) + " — довгий опис проблеми, щоб список був вищим за екран", k: "bug", p: "Тести", at: Date.now() - i * 864e5, s: "new" }])) };
    await seed(page, d, "t1");
    await page.goto("/"); await page.waitForTimeout(1200);
    // сторінка має «осісти» (дані домальовуються), інакше браузер сам зсуває прокрутку під новий вміст
    await expect.poll(async () => { const h1 = await page.evaluate(() => document.documentElement.scrollHeight); await page.waitForTimeout(300); return h1 === await page.evaluate(() => document.documentElement.scrollHeight); }).toBe(true);
    await page.evaluate(() => scrollTo(0, 300));
    await page.locator(".qfs-fab").tap();
    const pop = page.locator(".qfs-pop");
    await expect(pop).toBeVisible();
    await page.waitForTimeout(350);
    const y0 = await page.evaluate(() => scrollY);
    expect(y0).toBe(300);
    await expect(page.locator("html")).toHaveClass(/qfs-lock/);
    // шторка — на всю ширину і притиснута до низу
    const b = await pop.boundingBox();
    expect(Math.round(b.x)).toBe(0); expect(Math.round(b.width)).toBe(390); expect(Math.round(b.y + b.height)).toBeGreaterThanOrEqual(843);
    // клавіатура сама не відкривається: фокус не в полі
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("TEXTAREA");
    // свайп по затемненню і по заголовку шторки не гортає сторінку
    await swipe(page, 200, 120, 40);
    await swipe(page, 200, b.y + 40, b.y + 10);
    expect(await page.evaluate(() => scrollY)).toBe(y0);
    // довгий список у «Моїх зверненнях» гортається всередині шторки
    await page.locator('.qfs-tabs [data-tab="mine"]').tap();
    const body = page.locator(".qfs-b");
    await expect(page.locator(".qfs-it").first()).toBeVisible();
    const bb = await body.boundingBox();
    await swipe(page, 200, bb.y + bb.height - 30, bb.y + 30);
    await page.waitForTimeout(400);
    expect(await body.evaluate(el => el.scrollTop)).toBeGreaterThan(20);
    expect(await page.evaluate(() => scrollY)).toBe(y0);
    await page.screenshot({ path: `${S}/sheet-mine.png` });
    // «Назад» (Android) закриває шторку і лишає на сторінці
    const url = page.url();
    await page.goBack(); await page.waitForTimeout(300);
    await expect(pop).toBeHidden();
    expect(page.url()).toBe(url);
    await expect(page.locator("html")).not.toHaveClass(/qfs-lock/);
    expect(await page.evaluate(() => scrollY)).toBe(y0);
    expect(errors).toEqual([]);
  });

  test("стягнути шторку вниз за верх — закривається; затемнення — теж; історія не росте", async ({ page, errors }) => {
    await seed(page, rich(Date.now()), "t1");
    await page.goto("/tests"); await page.waitForTimeout(1200);
    const len0 = await page.evaluate(() => history.length);
    const pop = page.locator(".qfs-pop");
    await page.locator(".qfs-fab").tap();
    await expect(pop).toBeVisible();
    await page.waitForTimeout(400); await page.screenshot({ path: `${S}/sheet-new.png` });
    const b = await pop.boundingBox();
    await swipe(page, 195, b.y + 8, b.y + 260);
    await expect(pop).toBeHidden();
    await expect(page.locator(".qfs-fab")).toBeVisible();
    await page.locator(".qfs-fab").tap();
    await expect(pop).toBeVisible();
    await page.locator(".qfs-bd").tap({ position: { x: 100, y: 60 } });
    await expect(pop).toBeHidden();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(len0 + 1);
    expect(await page.evaluate(() => history.state?.qfs)).toBeFalsy();
    // надсилання з телефона працює як і раніше
    await page.locator(".qfs-fab").tap();
    await page.locator(".qfs-ta").fill("Не відкривається журнал");
    await page.locator(".qfs-send").tap();
    await expect(page.locator(".qfs-ok")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

// Вибір «Проблема / Ідея», вкладок і «Надіслати ще» не ставить курсор у поле — воно не смикається, на телефоні не вискакує клавіатура
for (const [n, vp, touch] of [["комп'ютер", { width: 1280, height: 800 }, false], ["телефон", { width: 390, height: 844 }, true]]) {
  test.describe(`фокус поля опису (${n})`, () => {
    test.use({ viewport: vp, hasTouch: touch, isMobile: touch });
    test("вибір типу, вкладки, «Надіслати ще» не ставлять курсор у поле", async ({ page, errors }) => {
      await seed(page, rich(Date.now()), "t1");
      await page.goto("/tests"); await page.waitForTimeout(1200);
      const inTa = () => page.evaluate(() => document.activeElement?.classList.contains("qfs-ta"));
      const tap = l => touch ? l.tap() : l.click();
      await tap(page.locator(".qfs-fab"));
      await expect(page.locator(".qfs-pop")).toBeVisible();
      await page.waitForTimeout(150);
      if (touch) expect(await inTa()).toBe(false);          // на телефоні поле не в фокусі й одразу після відкриття
      await tap(page.locator('.qfs-kind [data-k="idea"]'));
      expect(await inTa()).toBe(false);
      await tap(page.locator('.qfs-kind [data-k="bug"]'));
      expect(await inTa()).toBe(false);
      await tap(page.locator('.qfs-tabs [data-tab="mine"]'));
      await tap(page.locator('.qfs-tabs [data-tab="new"]'));
      expect(await inTa()).toBe(false);
      await page.locator(".qfs-ta").fill("Щось не так");
      await tap(page.locator(".qfs-send"));
      await expect(page.locator(".qfs-ok")).toBeVisible();
      await tap(page.locator("[data-more]"));
      expect(await inTa()).toBe(false);
      await page.evaluate(() => { const t = document.querySelector(".qfs-ta"); t.blur(); });
      await tap(page.locator(".qfs-send"));                 // порожнє поле: помилка видно
      await expect(page.locator(".qfs-err")).toContainText("Опишіть");
      if (touch) expect(await inTa()).toBe(false);
      expect(errors).toEqual([]);
    });
  });
}
