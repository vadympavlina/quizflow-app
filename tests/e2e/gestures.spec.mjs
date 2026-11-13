// Жести на телефоні: свайп закриває меню (за відстанню або швидкістю), прокрутка списку — ні
import { test, expect, seed } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

async function touchDrag(page, cdp, from, to, { steps = 8, gap = 16 } = {}) {
  const pt = (x, y) => [{ x, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(from.x, from.y) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps) });
    if (gap) await page.waitForTimeout(gap);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
const isOpen = page => page.evaluate(() => document.documentElement.classList.contains("sb-open"));

async function openDrawer(page) {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/attempts"); await page.waitForTimeout(1200);
  await page.locator("#qtb-menu").click();
  await expect.poll(() => isOpen(page)).toBe(true);
  await page.waitForTimeout(450);                                    // дочекатись кінця виїзду
}

test("свайп ліворуч далеко — меню закривається; підкладка й меню йдуть за пальцем", async ({ page, errors }) => {
  await openDrawer(page);
  const cdp = await page.context().newCDPSession(page);
  // під час жесту меню зсунуте, а підкладка прозоріша
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 250, y: 300, id: 1 }] });
  for (let i = 1; i <= 6; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 250 - i * 20, y: 300, id: 1 }] }); await page.waitForTimeout(16); }
  const mid = await page.evaluate(() => ({ tx: new DOMMatrix(getComputedStyle(document.getElementById("sidebar")).transform).m41, op: +getComputedStyle(document.getElementById("sb-ov")).opacity }));
  expect(mid.tx).toBeLessThan(-100);                                  // −120 від початку: 1:1 за пальцем
  expect(mid.op).toBeLessThan(0.8);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 60, y: 300, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => isOpen(page)).toBe(false);
  expect(errors).toEqual([]);
});

test("швидкий короткий змах закриває меню (за швидкістю, а не відстанню)", async ({ page, errors }) => {
  await openDrawer(page);
  const cdp = await page.context().newCDPSession(page);
  await touchDrag(page, cdp, { x: 200, y: 300 }, { x: 100, y: 300 }, { steps: 4, gap: 0 });   // 100px (< 40% ширини) без пауз — швидкість не залежить від повільності CI
  await expect.poll(() => isOpen(page)).toBe(false);
  expect(errors).toEqual([]);
});

test("повільний короткий рух повертає меню назад і воно лишається відкритим", async ({ page, errors }) => {
  await openDrawer(page);
  const cdp = await page.context().newCDPSession(page);
  await touchDrag(page, cdp, { x: 200, y: 300 }, { x: 170, y: 300 }, { steps: 6, gap: 60 });  // 30px повільно
  await page.waitForTimeout(450);
  expect(await isOpen(page)).toBe(true);
  expect(await page.evaluate(() => Math.round(new DOMMatrix(getComputedStyle(document.getElementById("sidebar")).transform).m41))).toBe(0);
  expect(errors).toEqual([]);
});

test("вертикальна прокрутка списку пунктів меню не закриває його", async ({ page, errors }) => {
  await openDrawer(page);
  const cdp = await page.context().newCDPSession(page);
  await touchDrag(page, cdp, { x: 150, y: 500 }, { x: 148, y: 300 }, { steps: 8, gap: 16 });
  await page.waitForTimeout(400);
  expect(await isOpen(page)).toBe(true);
  expect(errors).toEqual([]);
});

// ── Шторки й панелі: змах закриває, коротка тяга повертає, кнопка «закрити» лишається ──
async function openSheet(page) {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/tests"); await page.waitForTimeout(1500);
  await page.evaluate(() => window.openM("m-folder"));
  await page.waitForTimeout(450);
}
const sheetOn = page => page.evaluate(() => document.getElementById("m-folder").classList.contains("on"));
const sheetY = page => page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector("#m-folder .mb")).transform).m42);

test("модалка на телефоні — шторка: змах вниз закриває, коротка тяга повертає назад", async ({ page, errors }) => {
  await openSheet(page);
  const box = await page.locator("#m-folder .mb").boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2, y = box.y + 14;
  // коротка тяга (60 px) — шторка йде за пальцем, а після відпускання повертається
  await touchDrag(page, cdp, { x, y }, { x, y: y + 60 });
  await page.waitForTimeout(450);
  expect(await sheetOn(page)).toBe(true);
  expect(Math.abs(await sheetY(page))).toBeLessThan(2);
  // довгий змах вниз — закривається
  await touchDrag(page, cdp, { x, y }, { x, y: y + 260 });
  await expect.poll(() => sheetOn(page)).toBe(false);
  expect(errors).toEqual([]);
});

test("шторка: під час тяги йде за пальцем, а кнопкою «закрити» теж закривається", async ({ page, errors }) => {
  await openSheet(page);
  const box = await page.locator("#m-folder .mb").boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2, y = box.y + 14;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= 6; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + i * 15, id: 1 }] }); await page.waitForTimeout(16); }
  expect(await sheetY(page)).toBeGreaterThan(40);                       // 1:1 за пальцем (мінус поріг 12 px)
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(450);
  await page.evaluate(() => window.closeM("m-folder"));                 // не жест: звичайне закриття
  await expect.poll(() => sheetOn(page)).toBe(false);
  expect(errors).toEqual([]);
});

test("бокова панель: змах вправо закриває (qfDismiss), змах вбік у протилежний бік — ні", async ({ page, errors }) => {
  await seed(page, rich(Date.now()), "t1");
  await page.goto("/tests"); await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const p = document.createElement("div");
    p.id = "t-panel"; p.style.cssText = "position:fixed;top:0;right:0;bottom:0;width:300px;background:#fff;z-index:900;touch-action:pan-y";
    document.body.appendChild(p); window._closed = 0;
    window.qfDismiss(p, { dir: "right", close: () => { window._closed++; p.remove(); } });
  });
  const cdp = await page.context().newCDPSession(page);
  await touchDrag(page, cdp, { x: 200, y: 400 }, { x: 150, y: 400 });   // у протилежний бік
  await page.waitForTimeout(450);
  expect(await page.evaluate(() => window._closed)).toBe(0);
  await touchDrag(page, cdp, { x: 200, y: 400 }, { x: 380, y: 400 });   // далекий змах вправо
  await expect.poll(() => page.evaluate(() => window._closed)).toBe(1);
  expect(errors).toEqual([]);
});

// Видима прозорість шторки = добуток прозорості її самої й усіх батьків; вона не має падати нижче 1
const sheetAlpha = page => page.evaluate(() => { let a = 1; for (let n = document.querySelector("#m-folder .mb"); n; n = n.parentElement) a *= +getComputedStyle(n).opacity; return a; });

test("шторка не стає прозорою: ні під час тяги, ні після змаху, ні при закритті кнопкою", async ({ page, errors }) => {
  await openSheet(page);
  const box = await page.locator("#m-folder .mb").boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2, y = box.y + 14;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= 8; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + i * 25, id: 1 }] }); await page.waitForTimeout(16); }
  expect(await sheetAlpha(page), "під час тяги").toBe(1);
  // затемнення фону при цьому слабшає — це нормально
  const bgMid = await page.evaluate(() => +getComputedStyle(document.getElementById("m-folder")).backgroundColor.match(/[\d.]+/g)[3]);
  expect(bgMid).toBeLessThan(0.46);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  // далі, поки шторка їде вниз, вона лишається непрозорою
  const seen = [];
  for (let i = 0; i < 8; i++) { seen.push(await sheetAlpha(page)); await page.waitForTimeout(30); }
  expect(Math.min(...seen), "після змаху").toBe(1);
  await expect.poll(() => sheetOn(page)).toBe(false);
  // і при закритті кнопкою
  await openSheet(page);
  await page.evaluate(() => window.closeM("m-folder"));
  const seen2 = [];
  for (let i = 0; i < 8; i++) { seen2.push(await sheetAlpha(page)); await page.waitForTimeout(25); }
  expect(Math.min(...seen2), "закриття кнопкою").toBe(1);
  expect(errors).toEqual([]);
});
