// Іконки й прев'ю посилань: свої для цієї частини сайту, файли існують і підключені на кожній сторінці
import { test, expect } from "./fixtures.mjs";
import fs from "node:fs";

const ROOT = new URL("../../../", import.meta.url);
const SETS = ["teacher", "game"];
const htmlFiles = () => [...fs.readdirSync(ROOT).filter(f => f.endsWith(".html")),
  ...(fs.existsSync(new URL("live/", ROOT)) ? fs.readdirSync(new URL("live/", ROOT)).filter(f => f.endsWith(".html")).map(f => "live/" + f) : [])];
const meta = (s, attr, key) => (s.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`)) || [])[1];
const groupOf = f => f.startsWith("live/") ? "game" : "teacher";

test("кожна сторінка підключає іконки своєї частини", () => {
  for (const f of htmlFiles()) {
    const s = fs.readFileSync(new URL(f, ROOT), "utf8");
    const hrefs = [...s.matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"/g)].map(m => m[1]);
    expect(hrefs, f).toHaveLength(4);
    const g = f === "404.html" ? SETS[0] : groupOf(f);
    for (const h of hrefs) expect(h, f).toMatch(new RegExp(`^/assets/icons/${g}/`));
    expect(s, f).not.toContain('rel="icon" href="data:');
  }
});

test("файли іконок і маніфестів віддаються сервером", async ({ request }) => {
  const files = ["/favicon.ico", "/apple-touch-icon.png"];
  for (const g of SETS) {
    const base = `/assets/icons/${g}/`;
    files.push(...["favicon.ico", "icon.svg", "apple-touch-icon.png"].map(f => base + f));
    const res = await request.get(base + "site.webmanifest");
    expect(res.status(), base + "site.webmanifest").toBe(200);
    const man = await res.json();
    expect(man.icons.length).toBeGreaterThan(0);
    files.push(...man.icons.map(i => base + i.src.split("?")[0]));
  }
  for (const f of files) {
    const r = await request.get(f);
    expect(r.status(), f).toBe(200);
    expect((await r.body()).length, f).toBeGreaterThan(100);
  }
});

test("прев'ю посилань (Open Graph) на цьому піддомені", async ({ request }) => {
for (const f of htmlFiles()) {
  const s = fs.readFileSync(new URL(f, ROOT), "utf8");
  if (f === "404.html") continue;
  const kind = {"page": "teacher", "live": "game"}[f.startsWith("live/") ? "live" : "page"] || {"page": "teacher", "live": "game"}.page;
  expect(meta(s, "property", "og:image"), f).toBe(`https://app.quizflow.space/assets/og/${kind}.jpg?v=1`);
  expect(meta(s, "name", "twitter:image"), f).toBe(meta(s, "property", "og:image"));
  expect(meta(s, "name", "twitter:card"), f).toBe("summary_large_image");
  for (const k of ["og:title", "og:description"]) expect((meta(s, "property", k) || "").length, `${f} ${k}`).toBeGreaterThan(10);
}

  for (const g of ["game", "teacher"]) {
    const r = await request.get(`/assets/og/${g}.jpg`);
    expect(r.status(), g).toBe(200);
    const b = await r.body();
    expect(b[0] === 0xFF && b[1] === 0xD8, `${g}: JPEG`).toBe(true);
    expect(b.length, g).toBeLessThan(300_000);   // месенджери не люблять важкі картинки
  }
});
