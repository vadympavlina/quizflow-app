// Сторінка «Тести»: тести видно одразу, папки — списком збоку (на телефоні — чіпами)
import { test, expect, seed } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

const withFolders = () => {
  const d = rich(Date.now()), T = d.teachers.t1.tests, ids = Object.keys(T);
  d.teachers.t1.folders = {
    f1: { id: "f1", name: "Географія", color: "#3B6BF6", createdAt: 1 },
    f2: { id: "f2", name: "Програмування", color: "#14B8A6", createdAt: 2 },
  };
  T[ids[0]].folderId = "f1"; T[ids[1]].folderId = "f2";
  return d;
};

test("з папками: усі тести видно одразу, папка фільтрує список", async ({ page, errors }) => {
  await seed(page, withFolders(), "t1");
  await page.goto("/tests");
  await expect(page.locator(".t-lrow")).toHaveCount(4);                       // без кліків по папках
  await expect(page.locator("#t-rail")).toBeVisible();
  await expect(page.locator('#t-rail [data-id="all"] .t-rr-n')).toHaveText("4");
  await expect(page.locator('#t-rail [data-id="none"] .t-rr-n')).toHaveText("2");  // два тести без папки
  await expect(page.locator(".t-folder-card, .t-recent")).toHaveCount(0);          // великих карток папок більше немає

  await page.locator('#t-rail [data-id="f1"]').click();
  await expect(page).toHaveURL(/folder=f1/);
  await expect(page.locator(".t-lrow")).toHaveCount(1);
  await expect(page.locator('#t-rail [data-id="f1"]')).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("button", { name: "Змінити" })).toBeVisible();
  await expect(page.locator("#srch")).toHaveAttribute("placeholder", /Географія/);

  await page.goBack();                                                             // «Назад» повертає до всіх
  await expect(page.locator(".t-lrow")).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("список за замовчуванням: рядки з видимими діями, сітка — за перемикачем і запам'ятовується", async ({ page, errors }) => {
  await seed(page, withFolders(), "t1");
  await page.goto("/tests");
  await expect(page.locator(".t-lrow")).toHaveCount(4);
  const row = page.locator(".t-lrow").first();
  await expect(row.getByRole("button", { name: "Посилання" })).toBeVisible();      // дії видно без наведення
  await expect(row.getByRole("button", { name: "Редагувати" })).toBeVisible();
  expect((await row.boundingBox()).height).toBeLessThan(80);                      // один тест — один компактний рядок

  // Статусів і лічильників спроб у списку більше немає
  await expect(page.locator(".t-tab, .t-pill, .t-tabs")).toHaveCount(0);
  await expect(row).not.toContainText(/спроб|сер\./);

  await page.locator('[data-view="grid"]').click();
  await expect(page.locator(".t-quiz-card")).toHaveCount(4);
  await page.reload();
  await expect(page.locator(".t-quiz-card")).toHaveCount(4);                       // вибір сітки збережено
  await page.locator('[data-view="list"]').click();
  await expect(page.locator(".t-lrow")).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("без папок: рейки немає, лише список тестів", async ({ page, errors }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/tests?folder=нема");                                           // зайва папка в адресі не ламає сторінку
  await expect(page.locator(".t-lrow")).toHaveCount(4);
  await expect(page.locator("#t-rail")).toBeHidden();
  expect(errors).toEqual([]);
});

test.describe("телефон", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("папки — чіпи над списком, без горизонтальної прокрутки сторінки", async ({ page, errors }) => {
    await seed(page, withFolders(), "t1");
    await page.goto("/tests"); await page.waitForTimeout(1000);
    const chips = await page.locator(".t-rail-list").evaluate(e => ({ dir: getComputedStyle(e).flexDirection, w: document.documentElement.scrollWidth }));
    expect(chips.dir).toBe("row");
    expect(chips.w).toBeLessThanOrEqual(390);
    await page.locator('#t-rail [data-id="f2"]').click();
    await expect(page.locator(".t-lrow")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});

test("швидка гра: кнопка «Гра» відкриває вікно, створює кімнату з обраними налаштуваннями й веде в лоббі", async ({ page, errors }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/tests"); await page.waitForTimeout(1500);
  await page.locator(".t-lb.live").first().click();
  await expect(page.locator("#m-game.on")).toBeVisible();
  await page.locator('#gm-time button[data-t="30"]').click();
  await page.locator('#gm-score button[data-v="correct"]').click();
  await page.click("#gm-go");
  await page.waitForURL(/live\/lobby\?code=\d{8}/);
  const db = await page.evaluate(() => JSON.parse(localStorage.getItem("mockdb") || "{}"));
  const rooms = Object.values(db.rooms || {});
  expect(rooms).toHaveLength(1);
  expect([rooms[0].timePerQ, rooms[0].scoring, rooms[0].status]).toEqual([30, "correct", "lobby"]);
  expect(JSON.stringify(rooms[0].questions)).not.toContain("correct");     // правильних відповідей у публічній кімнаті немає
  expect(Object.values(db.teachers.t1.liveRooms)[0].key).toBeTruthy();   // ключ — у приватній гілці викладача
  expect(errors.filter(e => !/lobby|bad params/.test(e))).toEqual([]);
});

test("швидка гра: налаштування запам'ятовуються для наступної гри", async ({ page }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.addInitScript(() => localStorage.setItem("qf-live-setup", JSON.stringify({ time: 45, scoring: "correct", shuffle: false })));
  await page.goto("/tests"); await page.waitForTimeout(1500);
  await page.locator(".t-lb.live").first().click();
  await expect(page.locator('#gm-time button[data-t="45"]')).toHaveAttribute("aria-checked", "true");
  await expect(page.locator('#gm-score button[data-v="correct"]')).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#gm-sa")).not.toBeChecked();
});
