// Гра наживо, зіставлення: підготовка кімнати (відповіді перемішані, пари лише в ключі викладача), межі й екран викладача
import { test, expect, seed, readDb } from "./fixtures.mjs";

const now = () => Date.now();
const L = ["Франція", "Італія", "Польща", "Іспанія"];
// відповіді в кімнаті перемішані; ключ: Париж(2), Рим(0), Варшава(3), Мадрид(1)
const room = status => ({ hostUid: "t1", status, currentQ: 0, questionStartedAt: now() - 3000, timePerQ: 30, scoring: "speed", testTitle: "Географія",
  questions: [{ type: "matching", text: "Зіставте країни з їхніми столицями", lefts: L, options: ["Рим", "Мадрид", "Париж", "Варшава"] }],
  players: { p1: { nickname: "А" }, p2: { nickname: "Б" }, p3: { nickname: "В" }, p4: { nickname: "Г" } },
  answers: { 0: {
    p1: { value: [2, 0, 3, 1], answeredAt: now() - 2000, isCorrect: true, points: 900 },
    p2: { value: [2, 0, 3, 1], answeredAt: now() - 1800, isCorrect: true, points: 900 },
    p3: { value: [2, 0, 1, 3], answeredAt: now() - 1500, isCorrect: false, points: 0 },
    p4: { value: [2, 1, 3, 0], answeredAt: now() - 1000, isCorrect: false, points: 0 } } } });
const db = status => ({ users: { t1: { role: "teacher" } }, teachers: { t1: { liveRooms: { "12345678": { key: { 0: [2, 0, 3, 1] } } } } }, rooms: { "12345678": room(status) } });

test("екран викладача під час питання: ярлик, пункти 1–4 і відповіді A–D у двох стовпчиках", async ({ page, errors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, db("question"), "t1");
  await page.goto("/live/play-teacher?code=12345678");
  await expect(page.locator("#q-type-wrap")).toContainText("Зіставте пари");
  const cells = page.locator("#answers-grid .ans");
  await expect(cells).toHaveCount(8);
  await expect(cells.nth(0).locator(".letter")).toHaveText("1"); await expect(cells.nth(0)).toContainText("Франція");
  await expect(cells.nth(1).locator(".letter")).toHaveText("A"); await expect(cells.nth(1)).toContainText("Рим");
  await expect(page.locator("#answers-grid")).toHaveClass(/mt2/);
  expect(errors).toEqual([]);
});

test("екран викладача після розкриття: рядки «пункт → відповідь», частка класу на кожній парі, підсумки", async ({ page, errors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, db("reveal"), "t1");
  await page.goto("/live/play-teacher?code=12345678");
  const rows = page.locator("#answers-grid .ans");
  await expect(rows).toHaveCount(4);
  await expect(page.locator("#answers-grid")).toHaveClass(/mt3/);
  await expect(rows.locator(".txt").filter({ hasNotText: /^(Франція|Італія|Польща|Іспанія)$/ })).toHaveText(["Париж", "Рим", "Варшава", "Мадрид"]);
  // Франція — 4 з 4 (100 %); Італія — p1,p2,p3 (75 %); Польща — p1,p2,p4 (75 %); Іспанія — p1,p2 (50 %)
  await expect(rows.nth(0).locator(".count")).toContainText("100%");
  await expect(rows.nth(1).locator(".count")).toContainText("75%");
  await expect(rows.nth(2).locator(".count")).toContainText("75%");
  await expect(rows.nth(3).locator(".count")).toContainText("50%");
  await expect(rows.nth(3)).toHaveClass(/warn/); await expect(rows.nth(0)).not.toHaveClass(/warn/);
  await expect(page.locator("#key-line")).toContainText("Повністю правильно: 2 з 4");
  await expect(page.locator("#key-line")).toContainText("Найчастіша помилка: Іспанія");
  expect(errors).toEqual([]);
});

test("підготовка гри: відповіді перемішані без пар навпроти, пари лише в ключі, у кімнату потрапляють пункти й відповіді", async ({ page, errors }) => {
  const rights = ["Париж", "Рим", "Варшава", "Мадрид"];
  const pairs = L.map((left, i) => ({ left, options: rights, correct: i }));
  await seed(page, { users: { t1: { role: "teacher" } }, teachers: { t1: { tests: { T1: { title: "Столиці", questions: [{ id: "m1", type: "matching", text: "Зіставте", pairs }] } } } } }, "t1");
  await page.goto("/live/setup?testId=T1");
  await expect(page.locator("#type-chips")).toContainText("1 × зіставлення");
  await page.locator("#launch-btn").click();
  await page.waitForURL(/lobby\?code=/);
  const d = await readDb(page);
  const code = Object.keys(d.rooms)[0], r = d.rooms[code], q = r.questions[0];
  expect(q.type).toBe("matching");
  expect(q.lefts).toEqual(L);
  expect([...q.options].sort()).toEqual([...rights].sort());
  const key = d.teachers.t1.liveRooms[code].key[0];
  expect(key.map(i => q.options[i])).toEqual(rights);                 // ключ відновлює правильну відповідь для кожного пункту
  expect(key.every((v, i) => v === i)).toBe(false);                   // жодної «пари навпроти»
  expect(q.pairs).toBeUndefined(); expect(q.correct).toBeUndefined();
  expect(JSON.stringify(r)).not.toContain(JSON.stringify(key));
  expect(errors).toEqual([]);
});

test("підготовка гри: рукописне зіставлення з власними варіантами кожної пари входить у гру правильними відповідями", async ({ page, errors }) => {
  // так створює конструктор: у кожної пари свій список варіантів і позначена правильна
  const pairs = [
    { left: "Франція", options: ["Рим", "Париж", "Берлін"], correct: 1 },
    { left: "Італія", options: ["Рим", "Мадрид"], correct: 0 },
    { left: "Польща", options: ["Варшава", "Прага", "Відень", "Київ"], correct: 0 },
  ];
  await seed(page, { users: { t1: { role: "teacher" } }, teachers: { t1: { tests: { T1: { title: "Столиці", questions: [{ id: "m1", type: "matching", text: "Зіставте", pairs }] } } } } }, "t1");
  await page.goto("/live/setup?testId=T1");
  await expect(page.locator("#type-chips")).toContainText("1 × зіставлення");
  await expect(page.locator("#excluded-note")).toBeHidden();
  await page.locator("#launch-btn").click();
  await page.waitForURL(/lobby\?code=/);
  const d = await readDb(page);
  const code = Object.keys(d.rooms)[0], q = d.rooms[code].questions[0], key = d.teachers.t1.liveRooms[code].key[0];
  expect(q.lefts).toEqual(["Франція", "Італія", "Польща"]);
  expect([...q.options].sort()).toEqual(["Варшава", "Париж", "Рим"]);        // у банку лише правильні відповіді, без хибних варіантів
  expect(key.map(i => q.options[i])).toEqual(["Париж", "Рим", "Варшава"]);
  expect(key.every((v, i) => v === i)).toBe(false);
  expect(errors).toEqual([]);
});

test("підготовка гри: 7 пар, однакова правильна відповідь у кількох пунктів чи неправильно позначена не входять у гру", async ({ page, errors }) => {
  const mk = (id, n) => ({ id, type: "matching", text: id, pairs: Array.from({ length: n }, (_, i) => ({ left: "п" + i, options: ["a" + i, "b" + i], correct: 0 })) });
  await seed(page, { users: { t1: { role: "teacher" } }, teachers: { t1: { tests: { T1: { title: "Т", questions: [
    mk("ok", 3),
    mk("seven", 7),
    { id: "same", type: "matching", text: "same", pairs: [{ left: "x", options: ["k", "m"], correct: 0 }, { left: "y", options: ["n", "k"], correct: 1 }] },
    { id: "bad", type: "matching", text: "bad", pairs: [{ left: "x", options: ["k", "m"], correct: 9 }, { left: "y", options: ["n", "p"], correct: 0 }] },
  ] } } } } }, "t1");
  await page.goto("/live/setup?testId=T1");
  await expect(page.locator("#type-chips")).toContainText("1 × зіставлення");
  await expect(page.locator("#excluded-note")).toContainText("3 питання не увійдуть");
  await expect(page.locator("#excluded-note")).toContainText("однаковою правильною відповіддю");
  expect(errors).toEqual([]);
});

test("екран викладача, 6 довгих пар на 1280×720: усі рядки видно повністю, рядки не стискаються до смужок", async ({ page, errors }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const lefts = ["Переяславська рада", "Хрещення Русі", "Битва під Крутами", "Незалежність України", "Чорнобильська катастрофа", "Помаранчева революція"];
  const options = ["1654 рік, союз із Московським царством", "988 рік", "1918 рік", "1991 рік, референдум 1 грудня", "1986 рік", "2004 рік"];
  const d = db("question");
  d.rooms["12345678"].questions = [{ type: "matching", text: "Зіставте історичні події з їхніми датами та коротким описом наслідків", lefts, options }];
  d.rooms["12345678"].answers = {};
  d.teachers.t1.liveRooms["12345678"].key = { 0: [0, 1, 2, 3, 4, 5] };
  await seed(page, d, "t1");
  await page.goto("/live/play-teacher?code=12345678");
  const tiles = page.locator("#answers-grid .ans");
  await expect(tiles).toHaveCount(12);
  const g = await page.evaluate(() => { const t = [...document.querySelectorAll("#answers-grid .ans")], st = document.querySelector("#stage").getBoundingClientRect(), last = t[t.length - 1].getBoundingClientRect();
    return { minH: Math.min(...t.map(x => x.getBoundingClientRect().height)), lastBottom: last.bottom, stageBottom: st.bottom }; });
  expect(g.minH).toBeGreaterThanOrEqual(34);
  expect(g.lastBottom).toBeLessThanOrEqual(g.stageBottom + 1);
  expect(errors).toEqual([]);
});

test("екран викладача, розкриття 6 пар на 1024×640: рядки не обрізаються, екран прокручується", async ({ page, errors }) => {
  await page.setViewportSize({ width: 1024, height: 640 });
  const d = db("reveal");
  d.rooms["12345678"].questions = [{ type: "matching", text: "Зіставте історичні події з їхніми датами", lefts: ["А", "Б", "В", "Г", "Ґ", "Д"], options: ["1", "2", "3", "4", "5", "6"] }];
  d.rooms["12345678"].answers = { 0: { p1: { value: [0, 1, 2, 3, 4, 5], answeredAt: now() - 1000, isCorrect: true, points: 900 } } };
  d.teachers.t1.liveRooms["12345678"].key = { 0: [0, 1, 2, 3, 4, 5] };
  await seed(page, d, "t1");
  await page.goto("/live/play-teacher?code=12345678");
  await expect(page.locator("#answers-grid .ans")).toHaveCount(6);
  const h = await page.evaluate(() => [...document.querySelectorAll("#answers-grid .ans")].map(x => x.getBoundingClientRect().height));
  expect(Math.min(...h)).toBeGreaterThanOrEqual(34);
  expect(errors).toEqual([]);
});
