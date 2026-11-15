// AI через воркер у конструкторі: браузер не бачить ключів, запит іде у воркер з токеном викладача,
// облік використання веде воркер (браузер не дублює його).
import { test, expect, seed, readDb } from "./fixtures.mjs";
import { rich } from "./seeds/rich.mjs";

const WORKER = "https://mail.quizflow.test";
const ANSWER = JSON.stringify([{ type: "single", text: "Столиця Франції?", options: ["Париж", "Рим", "Берлін", "Мадрид"], correct: [0] }]);

async function fakeWorker(page, calls, { status = 200, body } = {}) {
  await page.context().route(`${WORKER}/**`, async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    calls.push({ path, body: req.postData() ? JSON.parse(req.postData()) : null, auth: req.headers()["authorization"] });
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body || { ok: true, text: ANSWER, tokens: 120, provider: "groq" }) });
  });
}
const db = (viaWorker = true) => {
  const d = rich(Date.now());
  d.settings = { mail: { workerUrl: WORKER }, ai: { enabled: true, groqModel: "llama-3.3-70b-versatile", ...(viaWorker ? { viaWorker: true } : {}) } };
  return d;
};
async function generate(page, { verify = false } = {}) {
  await page.goto("/constructor?id=T2");
  await page.locator('.tb[data-act="ai"]').click();
  await page.locator("#ai-topic").fill("Столиці Європи");
  if (!verify) await page.locator(".ai-verify").click();        // перемикач за замовчуванням увімкнений
  await page.locator("#ai-go").click();
}
// Другий крок модалки: питання показано для перегляду, додаємо вибрані
const accept = async page => { await expect(page.locator("#ai-p2")).toBeVisible({ timeout: 8000 }); await page.locator("#ai-add").click(); };

test("конструктор: генерація питань іде через воркер з токеном викладача й без ключа", async ({ page, errors }) => {
  const calls = [];
  await fakeWorker(page, calls);
  await seed(page, db(), "t1");
  await generate(page);
  await accept(page);
  await expect(page.getByText("Додано 1 питання")).toBeVisible({ timeout: 8000 });
  expect(calls.length).toBe(1);
  expect(calls[0].path).toBe("/ai");
  expect(calls[0].auth).toBe("Bearer mock-token-t1");
  expect(calls[0].body.feature).toBe("generation");
  expect(calls[0].body.messages[0].content).toContain("Столиці Європи");
  expect(JSON.stringify(calls[0].body)).not.toMatch(/gsk_|AIza/);
  // облік веде воркер: браузер лічильник не пише
  const usage = (await readDb(page)).aiUsage || {};
  expect(JSON.stringify(usage)).not.toContain("generation");
  expect(errors).toEqual([]);
});

test("відмова воркера (ліміт) показується викладачу, браузер не рахує її помилкою AI", async ({ page }) => {
  const calls = [];
  await fakeWorker(page, calls, { status: 429, body: { ok: false, error: "Ліміт AI-запитів на цей місяць вичерпано (50). Зверніться до адміністратора.", code: "qf/ai-quota" } });
  await seed(page, db(), "t1");
  await generate(page);
  await expect(page.getByText("Ліміт AI-запитів на цей місяць вичерпано")).toBeVisible({ timeout: 8000 });
  expect(JSON.stringify((await readDb(page)).aiUsage || {})).not.toContain("errors");
});

test("без прапорця viaWorker запит у воркер не йде (старий режим напряму)", async ({ page }) => {
  const calls = [];
  await fakeWorker(page, calls);
  await seed(page, db(false), "t1");
  await page.goto("/constructor?id=T2");
  await page.locator('.tb[data-act="ai"]').click();
  await page.locator("#ai-topic").fill("Тема");
  await page.locator("#ai-go").click();
  await page.waitForTimeout(1200);
  expect(calls.length).toBe(0);
});

// ── Нова генерація: матеріал, типи, перевірка якості, перемішування варіантів ──
const TWO = JSON.stringify([
  { type: "single", text: "Столиця Франції?", options: ["Париж", "Рим", "Берлін", "Мадрид"], correct: [0] },
  { type: "single", text: "Столиця Італії?", options: ["Париж", "Рим", "Берлін", "Мадрид"], correct: [0] },
]);
async function scripted(page, calls, answers) {
  await page.context().route(`${WORKER}/**`, async route => {
    const req = route.request();
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    calls.push(JSON.parse(req.postData()));
    const text = answers[Math.min(calls.length - 1, answers.length - 1)];
    route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ ok: true, text, tokens: 50, provider: "groq" }) });
  });
}

test("генерація: матеріал, типи й кількість варіантів потрапляють у запит", async ({ page, errors }) => {
  const calls = [];
  await scripted(page, calls, [ANSWER]);
  await seed(page, db(), "t1");
  await page.goto("/constructor?id=T2");
  await page.locator('.tb[data-act="ai"]').click();
  await page.locator("#ai-topic").fill("Столиці");
  await page.locator('#ai-src [data-v="text"]').click();
  await page.locator("#ai-mat").fill("Париж є столицею Франції, а Рим столицею Італії. Берлін — столиця Німеччини, Мадрид — столиця Іспанії.");
  await page.locator("#ai-more-t").click();
  await page.locator("#ai-aud").fill("9 клас");
  await page.locator('#ai-types [data-v="number"]').click();
  await page.locator('#ai-types [data-v="multi"]').click();       // вимикаємо «Кілька»
  await page.locator('#ai-opts [data-v="5"]').click();
  await page.locator(".ai-verify").click();
  await page.locator("#ai-go").click();
  await accept(page);
  await expect(page.getByText("Додано 1 питання")).toBeVisible({ timeout: 8000 });
  const prompt = calls[0].messages[0].content;
  expect(prompt).toContain("МАТЕРІАЛ");
  expect(prompt).toContain("Париж є столицею Франції");
  expect(prompt).toContain("Аудиторія: 9 клас");
  expect(prompt).toContain("number —");
  expect(prompt).not.toContain("multi —");
  expect(prompt).toContain("рівно 5 варіанти");
  expect(errors).toEqual([]);
});

test("перевірка якості: сумнівне питання без виправлення прибирається, про це сказано", async ({ page, errors }) => {
  const calls = [];
  await scripted(page, calls, [TWO, JSON.stringify([{ i: 0, ok: true }, { i: 1, ok: false, reason: "Рим, а не Париж" }])]);
  await seed(page, db(), "t1");
  await generate(page, { verify: true });
  await expect(page.locator("#ai-note")).toContainText("виправлено 0, прибрано 1", { timeout: 8000 });
  await accept(page);
  await expect(page.getByText("Додано 1 питання")).toBeVisible();
  expect(calls.length).toBe(2);
  expect(calls[1].messages[0].content).toContain("суворий рецензент");
  expect(errors).toEqual([]);
});

test("перевірка якості: виправлене питання замінює хибне", async ({ page, errors }) => {
  const calls = [];
  const fix = { type: "single", text: "Столиця Італії?", options: ["Париж", "Рим", "Берлін", "Мадрид"], correct: [1] };
  await scripted(page, calls, [TWO, JSON.stringify([{ i: 0, ok: true }, { i: 1, ok: false, fix }])]);
  await seed(page, db(), "t1");
  await generate(page, { verify: true });
  await expect(page.locator("#ai-note")).toContainText("виправлено 1, прибрано 0", { timeout: 8000 });
  await accept(page);
  await expect(page.getByText("Додано 2 питання")).toBeVisible();
  expect(errors).toEqual([]);
});

test("перевірка якості: збій другого проходу не втрачає питання", async ({ page, errors }) => {
  const calls = [];
  await scripted(page, calls, [TWO, "це не JSON"]);
  await seed(page, db(), "t1");
  await generate(page, { verify: true });
  await expect(page.locator("#ai-note")).toContainText("перевірку якості виконати не вдалося", { timeout: 8000 });
  await accept(page);
  await expect(page.getByText("Додано 2 питання")).toBeVisible();
  expect(errors).toEqual([]);
});

test("правильна відповідь зберігається після перемішування варіантів", async ({ page, errors }) => {
  const calls = [];
  const C = [["Франції", "Париж"], ["Німеччини", "Берлін"], ["Іспанії", "Мадрид"], ["Польщі", "Варшава"], ["Австрії", "Відень"]];
  await scripted(page, calls, C.map(([c, cap]) => JSON.stringify([{ type: "single", text: `Яке місто є столицею ${c}?`, options: [cap, "Лісабон", "Прага", "Осло"], correct: [0] }])));
  await seed(page, db(), "t1");
  await page.goto("/constructor?id=T2");
  for (let i = 0; i < 5; i++) {              // кілька разів: перемішування випадкове
    await expect(page.locator("#m-ai")).toBeHidden();
    const before = await page.locator(".qi").count();
    await page.locator('.tb[data-act="ai"]').click();
    await page.locator("#ai-topic").fill("Столиці Європи");
    if (i === 0) await page.locator(".ai-verify").click();
    await page.locator("#ai-go").click();
    await accept(page);
    await expect(page.locator(".qi")).toHaveCount(before + 1, { timeout: 8000 });
    const right = await page.locator(".opt.ok input[data-f='opt']").first().inputValue();
    expect(right.trim()).toBe(C[i][1]);
    await page.waitForTimeout(150);
  }
  expect(errors).toEqual([]);
});

test("повтори питань, що вже є в тесті, відсіюються", async ({ page }) => {
  const calls = [];
  await scripted(page, calls, [JSON.stringify([{ type: "text", text: "Яка столиця Франції?", correct: "Париж" }, { type: "text", text: "Столиця Італії?", correct: "Рим" }])]);
  const d = db(); d.teachers.t1.tests.T2.questions = [{ id: "x1", type: "text", text: "Яка столиця Франції?", correct: "Париж" }];
  await seed(page, d, "t1");
  await generate(page);
  await accept(page);
  await expect(page.getByText("Додано 1 питання")).toBeVisible({ timeout: 8000 });
});

test("модалка: два кроки; результат можна переглянути, зняти зайві питання й повернутись до налаштувань", async ({ page, errors }) => {
  const calls = [];
  await scripted(page, calls, [TWO]);
  await seed(page, db(), "t1");
  await generate(page);
  await expect(page.locator("#ai-p2")).toBeVisible({ timeout: 8000 });
  await expect(page.locator("#ai-p1")).toBeHidden();
  await expect(page.locator(".ai-q")).toHaveCount(2);
  await expect(page.locator(".ai-qa li.ok").first()).toBeVisible();      // правильна відповідь виділена
  await page.locator(".ai-q").first().click();                           // зняли перше
  await expect(page.locator("#ai-add")).toHaveText("Додати в тест: 1");
  await page.locator("#ai-all").click();                                 // «Вибрати всі»
  await expect(page.locator("#ai-add")).toHaveText("Додати в тест: 2");
  await page.locator("#ai-all").click();                                 // «Зняти всі»
  await expect(page.locator("#ai-add")).toBeDisabled();
  await page.locator('[data-act="ai-back"]').click();                    // назад: налаштування збереглись
  await expect(page.locator("#ai-p1")).toBeVisible();
  await expect(page.locator("#ai-topic")).toHaveValue("Столиці Європи");
  expect(errors).toEqual([]);
});

test("модалка: додаткові налаштування сховані, режим «За текстом» вимагає текст", async ({ page, errors }) => {
  await seed(page, db(), "t1");
  await page.goto("/constructor?id=T2");
  await page.locator('.tb[data-act="ai"]').click();
  await expect(page.locator("#ai-more")).toBeHidden();
  await page.locator("#ai-more-t").click();
  await expect(page.locator("#ai-more")).toBeVisible();
  await expect(page.locator("#ai-mat")).toBeHidden();
  await page.locator('#ai-src [data-v="text"]').click();
  await expect(page.locator("#ai-mat")).toBeVisible();
  await page.locator("#ai-go").click();
  await expect(page.getByText("Вставте текст")).toBeVisible();
  expect(errors).toEqual([]);
});
