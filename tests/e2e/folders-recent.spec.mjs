// Багато папок: угорі найсвіжіші (куди нещодавно додавали тест або вносили зміни), решта за «Усі папки», пошук за назвою
import { test, expect, seed } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

const DAY = 864e5, NOW = Date.now();
const names = ["Алгебра", "Біологія", "Географія", "Фізика", "Хімія", "Історія", "Музика", "Інформатика", "Література", "Право", "Економіка", "Астрономія"];
// 12 папок; створені в порядку списку, але свіжість задають тести: у «Право» змінювали вчора, у «Алгебра» — щойно
function manyFolders() {
  const d = rich(NOW), T = d.teachers.t1.tests, ids = Object.keys(T);
  d.teachers.t1.folders = Object.fromEntries(names.map((n, i) => ["f" + i, { id: "f" + i, name: n, color: "#3B6BF6", createdAt: NOW - 400 * DAY + i * DAY }]));
  T[ids[0]].folderId = "f0"; T[ids[0]].updatedAt = NOW - 1000;          // Алгебра — щойно
  T[ids[1]].folderId = "f9"; T[ids[1]].updatedAt = NOW - DAY;           // Право — вчора
  T[ids[2]].folderId = "f4"; T[ids[2]].updatedAt = NOW - 5 * DAY;       // Хімія — 5 днів тому
  T[ids[3]].folderId = "f11"; T[ids[3]].updatedAt = NOW - 30 * DAY;     // Астрономія — місяць тому
  return d;
}
const order = async page => { await page.locator('#t-rail-list .t-rr').first().waitFor(); return page.locator('#t-rail-list .t-rr[data-act="open-folder"]:not([data-id="all"]):not([data-id="none"]) .t-rr-name').allTextContents(); };

test("папки йдуть за свіжістю, а не за порядком створення; найсвіжіші зверху", async ({ page, errors }) => {
  await seed(page, manyFolders(), "t1");
  await page.goto("/tests");
  const o = await order(page);
  expect(o.slice(0, 4)).toEqual(["Алгебра", "Право", "Хімія", "Астрономія"]);   // за датою змін тестів усередині
  expect(o.length).toBe(8);                                                    // показано лише 8 найсвіжіших
  await expect(page.locator(".t-rr-more")).toContainText("ще 4");
  expect(errors).toEqual([]);
});

test("«Усі папки» розгортає решту й згортає назад; відкрита папка завжди видна", async ({ page, errors }) => {
  await seed(page, manyFolders(), "t1");
  await page.goto("/tests");
  await page.locator(".t-rr-more").click();
  expect((await order(page)).length).toBe(12);
  await expect(page.locator(".t-rr-more")).toContainText("найсвіжіші");
  await page.locator(".t-rr-more").click();
  expect((await order(page)).length).toBe(8);
  // відкрита папка поза топом (остання за свіжістю) лишається в списку
  await page.goto("/tests?folder=f1");
  expect(await order(page)).toContain("Біологія");
  expect((await order(page)).length).toBe(8);
  expect(errors).toEqual([]);
});

test("пошук папки: фільтр за назвою, фокус не губиться, Enter відкриває першу, Esc очищає", async ({ page, errors }) => {
  await seed(page, manyFolders(), "t1");
  await page.goto("/tests");
  const q = page.locator("#t-rail-q");
  await expect(q).toBeVisible();
  await q.click(); await page.keyboard.type("іст");                              // «Історія», «Інформатика» ні; «Астрономія» ні
  await expect(q).toBeFocused();                                                 // поле не перестворилось
  const o = await order(page);
  expect(o).toEqual(["Історія"]);
  await page.keyboard.press("Escape");
  await expect(q).toHaveValue("");
  expect((await order(page)).length).toBe(8);
  await page.keyboard.type("а");                                                 // багато збігів: показуємо всі, не лише топ
  expect((await order(page)).length).toBeGreaterThan(8 - 1);
  await page.keyboard.press("Escape");
  await page.keyboard.type("музика"); await expect(page.locator("#t-rail-list .t-rr").first()).toContainText("Музика");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/folder=f6/);
  await expect(q).toHaveValue("");
  await q.fill("такої немає");
  await expect(page.locator(".t-rr-empty")).toContainText("не знайдено");
  expect(errors).toEqual([]);
});

test("мало папок (≤ 8): поля пошуку й «Усі папки» немає", async ({ page, errors }) => {
  const d = manyFolders(); const f = d.teachers.t1.folders;
  for (const k of ["f8", "f9", "f10", "f11"]) delete f[k];
  for (const t of Object.values(d.teachers.t1.tests)) if (!f[t.folderId]) t.folderId = null;
  await seed(page, d, "t1");
  await page.goto("/tests");
  await expect(page.locator("#t-rail-q")).toHaveCount(0);
  await expect(page.locator(".t-rr-more")).toHaveCount(0);
  expect((await order(page)).length).toBe(8);
  expect(errors).toEqual([]);
});

test.describe("телефон", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("чіпи за свіжістю, пошук видно, нічого не вилазить за екран", async ({ page, errors }) => {
    await seed(page, manyFolders(), "t1");
    await page.goto("/tests"); await page.waitForTimeout(800);
    await expect(page.locator("#t-rail-q")).toBeVisible();
    expect((await order(page)).slice(0, 2)).toEqual(["Алгебра", "Право"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
});
