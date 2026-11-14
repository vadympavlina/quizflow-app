// Екран викладача в грі: питання й результати під час розкриття вміщуються в екран 16:9 без прокрутки
import { test, expect, seed } from "./fixtures.mjs";

const NP = 12;
const SC = {
  "вибір, короткі варіанти": { q: [{ type: "single", text: "Яка річка найдовша в Україні?", options: ["Дніпро", "Дністер", "Південний Буг", "Десна"] }], key: { 0: 0 }, ans: i => ({ value: i % 4 }) },
  "вибір, дуже довгі варіанти": { q: [{ type: "single", text: "Який з перелічених процесів відбувається під час фотосинтезу в хлоропластах рослинних клітин при достатньому освітленні?", options: ["Поглинання вуглекислого газу та виділення кисню у світловій фазі разом із синтезом глюкози", "Розщеплення глюкози з виділенням енергії в мітохондріях клітини", "Бродіння з утворенням молочної кислоти за відсутності кисню", "Виділення азоту в атмосферу"] }], key: { 0: 0 }, ans: i => ({ value: i % 4 }) },
  "вибір, шість варіантів": { q: [{ type: "single", text: "Оберіть правильну відповідь", options: ["Один", "Два", "Три", "Чотири", "П'ять", "Шість"] }], key: { 0: 2 }, ans: i => ({ value: i % 6 }) },
  "текст": { q: [{ type: "text", text: "Столиця України?" }], key: { 0: "Київ" }, ans: i => ({ value: "Відповідь " + (i % 9) }) },
  "число": { q: [{ type: "number", text: "Скільки градусів у прямому куті?" }], key: { 0: 90 }, ans: i => ({ value: 80 + (i % 9) }) },
};
const dbFor = (s, scoring) => {
  const now = Date.now();
  const players = Object.fromEntries(Array.from({ length: NP }, (_, i) => ["p" + i, { nickname: "Гравець " + i }]));
  const answers = { 0: Object.fromEntries(Array.from({ length: NP }, (_, i) => ["p" + i, { ...s.ans(i), answeredAt: now - 25000 + i * 100, isCorrect: i % 2 === 0, points: i % 2 === 0 ? 800 - i * 10 : 0 }])) };
  return { users: { t1: { role: "teacher" } }, teachers: { t1: { liveRooms: { "12345678": { key: s.key } } } },
    rooms: { "12345678": { hostUid: "t1", status: "reveal", currentQ: 0, questionStartedAt: now - 30000, timePerQ: 20, scoring, testTitle: "Т", questions: s.q, players, answers } } };
};

for (const [W, H] of [[1920, 1080], [1366, 768], [1280, 720]]) {
  for (const [name, s] of Object.entries(SC)) {
    for (const scoring of ["speed", "correct"]) {
      test(`розкриття ${W}×${H}: «${name}», ${scoring === "speed" ? "бали" : "«Точність»"} — без прокрутки`, async ({ page, errors }) => {
        await page.setViewportSize({ width: W, height: H });
        await seed(page, dbFor(s, scoring), "t1");
        await page.goto("/live/play-teacher?code=12345678");
        await expect(page.locator("#stage.revealed")).toBeVisible();
        await page.waitForTimeout(500);
        const m = await page.evaluate(() => { const st = document.getElementById("stage"); return { stage: st.scrollHeight - st.clientHeight, doc: document.documentElement.scrollHeight - innerHeight }; });
        expect(m.stage, "прокрутка блока гри").toBeLessThanOrEqual(1);
        expect(m.doc, "прокрутка сторінки").toBeLessThanOrEqual(1);
        // результати в межах екрана і видимі
        const box = await page.locator("#leaders").boundingBox();
        expect(box.y + box.height).toBeLessThanOrEqual(H + 1);
        expect(errors).toEqual([]);
      });
    }
  }
}
