// Історія ігор: режими «за балами» і «за правильними», показники, розподіл, питання, CSV
import { test, expect, seed } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

const NOW = Date.now(), H = 36e5, DAY = 864e5;
const names = ["Оля", "Максим", "Іра", "Тарас", "Соломія", "Богдан", "Надія", "Єва", "Денис", "Марта"];
// speed: 500–1000 за правильну; acc: рівно 1000 за правильну
const mk = (code, title, ago, scoring, qc, correct) => ({
  code, testId: "T" + code, testTitle: title, playedAt: NOW - ago, playerCount: correct.length, questionCount: qc, ...(scoring ? { scoring } : {}),
  results: correct.map((c, i) => ({ nickname: names[i % names.length] + (i >= names.length ? " " + i : ""), correct: c, score: scoring === "speed" ? Math.round(c * 1000 * (0.62 + (i % 4) * 0.08)) : c * 1000 })),
});
function data({ stats = true } = {}) {
  const d = rich(NOW);
  const speed = mk("111111", "Фізика: рух", 2 * H, "speed", 10, [10, 9, 8, 8, 6, 5, 3, 2]);
  const acc = mk("222222", "Історія: Козацька доба", 5 * H, "correct", 10, [10, 10, 10, 9, 7, 7, 4, 2, 1]);
  const old = mk("333333", "Хімія без режиму", 3 * DAY, null, 8, [8, 8, 5, 3]);   // старий запис: scoring немає, бали кратні 1000 -> «за правильними»
  if (stats) acc.questionStats = Array.from({ length: 10 }, (_, i) => ({ t: i === 3 ? "Хто <b>очолив</b> повстання?" : "Питання " + (i + 1), c: [9, 8, 7, 2, 6, 9, 5, 4, 8, 3][i], n: 9 }));
  d.teachers.t1.gameHistory = { 111111: speed, 222222: acc, 333333: old };
  return d;
}
const ready = async page => { await page.locator(".gh-game").first().waitFor(); };

test("кожна гра показує свій режим і метрики відповідно до нього", async ({ page, errors }) => {
  await seed(page, data(), "t1");
  await page.goto("/game-history");
  await ready(page);
  const sp = page.locator('.gh-game[data-code="111111"]'), ac = page.locator('.gh-game[data-code="222222"]'), old = page.locator('.gh-game[data-code="333333"]');
  await expect(sp.locator(".gh-mode")).toHaveText("За балами");
  await expect(ac.locator(".gh-mode")).toHaveText("За правильними");
  await expect(old.locator(".gh-mode")).toHaveText("За правильними");               // режим вгаданий зі старих балів
  await expect(sp.locator(".gm .l").nth(1)).toHaveText(/сер\. бал/i);
  await expect(ac.locator(".gm .l").nth(1)).toHaveText(/сер\. правильних/i);
  await expect(ac.locator(".gm .l").nth(2)).toHaveText(/без помилок/i);
  await expect(ac.locator(".gm").nth(2).locator(".v")).toContainText("3");           // троє на 10/10
  await expect(ac.locator(".gh-pr .pt").first()).toHaveText("10/10");                // лідер за правильними, а не «10 000»
  await expect(sp.locator(".gh-pr .pt").first()).not.toContainText("/");
  await expect(ac.locator(".gh-spread .sbar i").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("фільтр за режимом", async ({ page, errors }) => {
  await seed(page, data(), "t1");
  await page.goto("/game-history");
  await ready(page);
  await expect(page.locator(".gh-kpi")).toHaveCount(0);   // великих карток зі статистикою немає
  await page.locator('#mode [data-mode="speed"]').click();
  await expect(page.locator(".gh-game")).toHaveCount(1);
  await page.locator('#mode [data-mode="acc"]').click();
  await expect(page.locator(".gh-game")).toHaveCount(2);
  await page.locator('#mode [data-mode="all"]').click();
  await expect(page.locator(".gh-game")).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("результати за правильними: точність, правильні відповіді, без балів", async ({ page, errors }) => {
  await seed(page, data(), "t1");
  await page.goto("/game-history");
  await ready(page);
  await page.locator('.gh-game[data-code="222222"] .gh-name').click();
  await expect(page.locator("#m-res")).toHaveClass(/on/);
  await expect(page.locator("#res-sub .gh-mode")).toHaveText("За правильними");
  const th = await page.locator("#res-body th").allTextContents();
  expect(th.join("|")).toMatch(/Точність/);
  expect(th.join("|")).toMatch(/Правильно/);
  expect(th.join("|")).not.toMatch(/Бали/);
  await expect(page.locator("#res-body tbody tr").first().locator(".res-main")).toContainText("10");
  expect(errors).toEqual([]);
});

test("результати за балами: бали в останній колонці", async ({ page, errors }) => {
  await seed(page, data(), "t1");
  await page.goto("/game-history");
  await ready(page);
  await page.locator('.gh-game[data-code="111111"] .gh-name').click();
  const th = (await page.locator("#res-body th").allTextContents()).join("|");
  expect(th).toMatch(/Бали/);
  expect(th).toMatch(/Правильно/);
  await expect(page.locator("#res-tabs")).toBeHidden();             // немає статистики по питаннях — вкладок немає
  expect(errors).toEqual([]);
});

test("вкладка «Питання»: відсоток правильних, найскладніші першими, текст екранується", async ({ page, errors }) => {
  await seed(page, data(), "t1");
  await page.goto("/game-history");
  await ready(page);
  await page.locator('.gh-game[data-code="222222"] .gh-name').click();
  await expect(page.locator("#res-tabs")).toBeVisible();
  await page.locator('#rtab [data-tab="questions"]').click();
  await expect(page.locator(".qs-row")).toHaveCount(10);
  await expect(page.locator("#res-pane-players")).toBeHidden();
  await page.locator('#qsort [data-qs="hard"]').click();
  await expect(page.locator(".qs-row").first().locator(".qs-p")).toContainText("22%");   // 2 з 9
  expect(await page.locator(".qs-t b").count()).toBe(0);                                   // тег не вставився як HTML
  await page.locator('#rtab [data-tab="players"]').click();
  await expect(page.locator("#res-pane-players")).toBeVisible();
  expect(errors).toEqual([]);
});

test("CSV за правильними не містить балів", async ({ page, errors }) => {
  await seed(page, data(), "t1");
  await page.goto("/game-history");
  await ready(page);
  await page.locator('.gh-game[data-code="222222"] .gh-name').click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.locator("#res-csv").click()]);
  const text = (await import("node:fs")).readFileSync(await dl.path(), "utf8");
  const head = text.split("\r\n")[0];
  expect(head).toContain("Точність");
  expect(head).not.toContain("Бали");
  expect(text.split("\r\n")[1]).toContain('"10"');
  expect(errors).toEqual([]);
});

test.describe("телефон", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("список і результати без горизонтального скролу", async ({ page, errors }) => {
    await seed(page, data(), "t1");
    await page.goto("/game-history");
    await ready(page);
    const wide = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(await wide()).toBeLessThanOrEqual(1);
    await page.locator('.gh-game[data-code="222222"] .gh-name').click();
    await expect(page.locator("#m-res")).toHaveClass(/on/);
    expect(await wide()).toBeLessThanOrEqual(1);
    const over = await page.evaluate(() => { const m = document.querySelector("#m-res .mb").getBoundingClientRect(); return m.right - innerWidth; });
    expect(over).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
});

test("оцінка за місцем: 12, 11, 10… без пропусків, однакове місце — однакова оцінка", async ({ page, errors }) => {
  await seed(page, data(), "t1");
  await page.goto("/game-history");
  await ready(page);
  await page.locator('.gh-game[data-code="222222"] .gh-name').click();   // 10,10,10,9,7,7,4,2,1 правильних
  const grades = (await page.locator("#res-body .res-gr").allTextContents()).map(Number);
  expect(grades).toEqual([12, 12, 12, 11, 10, 10, 9, 8, 7]);
  await expect(page.locator("#gv, #gv-note, #res-sum, #res-spread")).toHaveCount(0);   // інших способів оцінки й підсумку немає
  expect(errors).toEqual([]);
});
