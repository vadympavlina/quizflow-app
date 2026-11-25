// Питання «Правда / Неправда» у конструкторі: фіксовані варіанти, вибір правильної, зміна типу, імпорт, збереження
import { test, expect, seed, readDb } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

async function open(page) {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/constructor?id=T1");
  await expect(page.locator("#ql-list .qi").first()).toBeVisible();
}
const count = page => page.locator("#ql-list .qi").count();

test("нове питання «Правда / Неправда»: дві картки, без редагування варіантів, вибір правильної", async ({ page, errors }) => {
  await open(page);
  const n0 = await count(page);
  await page.locator('[data-act="add-menu"]').first().click();
  await page.locator('.pi[data-v="truefalse"]').click();
  await expect.poll(() => count(page)).toBe(n0 + 1);
  await expect(page.locator(".tf-b")).toHaveCount(2);
  await expect(page.locator("#opts textarea")).toHaveCount(0);                       // варіанти змінювати не можна
  await expect(page.locator('[data-act="opt-add"]')).toHaveCount(0);
  await expect(page.locator("#q-hint")).toContainText("Не позначено правильну відповідь");
  await page.locator("#q-text").click(); await page.keyboard.type("Земля обертається навколо Сонця");
  await page.locator('.tf-b[data-i="0"]').click();
  await expect(page.locator('.tf-b[data-i="0"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.tf-b[data-i="1"]')).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#q-hint")).not.toContainText("Не позначено");
  await page.locator('.tf-b[data-i="1"]').click();                                   // можна передумати
  await expect(page.locator('.tf-b[data-i="1"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#ql-list .qi.on").locator(".qi-type")).toHaveText("Правда / Неправда");
  expect(errors).toEqual([]);
});

test("зміна типу: з «Одна відповідь» зберігається правильна, з «Правда / Неправда» у варіанти вертаються Правда й Неправда", async ({ page, errors }) => {
  await open(page);
  await page.locator('[data-act="add-menu"]').first().click();
  await page.locator('.pi[data-v="single"]').click();
  await page.locator('[data-act="type-menu"]').click();
  await page.locator('.pi[data-v="truefalse"]').click();
  await expect(page.locator(".tf-b")).toHaveCount(2);
  await page.locator('.tf-b[data-i="1"]').click();
  await page.locator('[data-act="type-menu"]').click();
  await page.locator('.pi[data-v="single"]').click();
  const vals = await page.locator("#opts textarea").evaluateAll(a => a.map(x => x.value));
  expect(vals.slice(0, 2)).toEqual(["Правда", "Неправда"]);
  expect(await page.locator("#opts .opt.ok").count()).toBe(1);                       // правильна відповідь не загубилась
  expect(errors).toEqual([]);
});

test("імпорт списком: пара «Правда/Неправда» або «Так/Ні» стає питанням «Правда / Неправда»", async ({ page, errors }) => {
  await open(page);
  const n0 = await count(page);
  await page.locator(".import-btn").click();
  await page.locator('[data-act="im-tab"][data-tab="text"]').click();
  await page.locator("#im-text").fill([
    "1. Вода кипить при 100 °C", "*Правда", "Неправда", "",
    "2. Сонце — планета", "Так", "*Ні", "",
    "3. Яка столиця Франції?", "*Париж", "Лондон",
  ].join("\n"));
  await page.locator("#im-go").click();
  await expect.poll(() => count(page)).toBe(n0 + 3);
  const types = await page.evaluate(() => [...document.querySelectorAll("#ql-list .qi .qi-type")].slice(-3).map(e => e.textContent.trim()));
  expect(types).toEqual(["Правда / Неправда", "Правда / Неправда", "Одна відповідь"]);
  expect(errors).toEqual([]);
});

test("збереження: у базі лежать фіксовані варіанти й індекс правильної", async ({ page, errors }) => {
  await open(page);
  await page.locator('[data-act="add-menu"]').first().click();
  await page.locator('.pi[data-v="truefalse"]').click();
  await page.locator("#q-text").click(); await page.keyboard.type("Київ — столиця України");
  await page.locator('.tf-b[data-i="0"]').click();
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(1200);
  const db = await readDb(page);
  const qs = Object.values(db.teachers.t1.tests.T1.questions);
  const q = qs.find(x => x.type === "truefalse");
  expect(q.options).toEqual(["Правда", "Неправда"]);
  expect(q.correct).toEqual([0]);
  expect(errors).toEqual([]);
});
