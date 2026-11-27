/**
 * Tira os prints do site usados em ia.html (explicação para IAs).
 * Serve a pasta do projeto localmente e fotografa com o Playwright.
 * As visitas não são contadas (navegador marcado como "não contar").
 *
 * Uso:  node tools/capture-prints.mjs      → assets/img/prints/*.jpg
 */
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "assets", "img", "prints");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^\/+/, "") || "index.html";
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const noTrack = () => {
  try {
    localStorage.setItem("fr-aniversario:no-track", "1");
  } catch {}
};
const shot = (page, name, opts = {}) => page.screenshot({ path: join(OUT, `${name}.jpg`), type: "jpeg", quality: 82, ...opts });
const calm = (page) => page.addStyleTag({ content: ".mode-switch{animation:none!important} .reveal{opacity:1!important;transform:none!important}" });

async function desktop(mode = "classic") {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(noTrack);
  if (mode === "games") await ctx.addInitScript(() => localStorage.setItem("fr-aniversario:mode", "games"));
  return ctx;
}

/* ---- Modo CLASSIC (computador) ---- */
{
  const ctx = await desktop();
  const p = await ctx.newPage();
  await p.goto(`${BASE}/index.html`);
  await calm(p);
  await p.waitForTimeout(1500);
  await shot(p, "01-inicio-classic");
  await p.evaluate(() => document.getElementById("programa").scrollIntoView());
  await p.waitForTimeout(800);
  await shot(p, "02-programa-principal");
  await p.evaluate(() => document.getElementById("mapa").scrollIntoView());
  await p.waitForTimeout(4000);
  await shot(p, "03-mapa");
  await p.goto(`${BASE}/index.html#/atividade/golfe`);
  await p.waitForSelector("#detail.is-open");
  await p.waitForTimeout(2500);
  await shot(p, "04-pagina-atividade");
  await p.goto(`${BASE}/index.html`);
  await calm(p);
  await p.waitForTimeout(600);
  await p.locator(".hero [data-open-rsvp]").click();
  await p.waitForSelector("#rsvpModal[open]");
  await p.locator('#rsvpModal input[name="attending"][value="yes"]').check({ force: true });
  await p.waitForTimeout(500);
  await shot(p, "05-confirmar-presenca");
  await ctx.close();
}

/* ---- Switch e comando /games_on ---- */
{
  const ctx = await desktop();
  const p = await ctx.newPage();
  await p.goto(`${BASE}/index.html`);
  await calm(p);
  await p.waitForTimeout(6000); // a dica "desliza para jogar" aparece aos 5 s
  const sw = p.locator("#modeSwitchHero");
  await sw.scrollIntoViewIfNeeded();
  const bb = await sw.boundingBox();
  await shot(p, "06-switch-classic", { clip: { x: bb.x - 160, y: bb.y - 40, width: bb.width + 320, height: bb.height + 110 } });
  await p.mouse.move(bb.x + 40, bb.y + bb.height / 2);
  await p.mouse.down();
  await p.mouse.move(bb.x + bb.width - 30, bb.y + bb.height / 2, { steps: 12 });
  await p.waitForTimeout(500);
  await shot(p, "07-arrastar-games-on");
  await p.mouse.up();
  await ctx.close();
}

/* ---- Modo GAMES (computador) ---- */
{
  const ctx = await desktop("games");
  const p = await ctx.newPage();
  await p.goto(`${BASE}/index.html`);
  await calm(p);
  await p.waitForTimeout(1500);
  await shot(p, "08-inicio-games");
  await p.evaluate(() => document.getElementById("programa").scrollIntoView());
  await p.waitForTimeout(1500);
  await shot(p, "09-programa-secundario");
  await p.evaluate(() => document.querySelector("#gamesProgram .cg-levels").scrollIntoView({ block: "start" }));
  await p.waitForTimeout(500);
  await shot(p, "10-niveis-games");
  await p.goto(`${BASE}/citygames.html`);
  await p.waitForTimeout(1200);
  await shot(p, "11-pagina-citygames");
  await p.goto(`${BASE}/promax.html`);
  await p.waitForTimeout(1200);
  await shot(p, "12-pagina-promax");
  await ctx.close();
}

/* ---- Telemóvel ---- */
for (const mode of ["classic", "games"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(noTrack);
  if (mode === "games") await ctx.addInitScript(() => localStorage.setItem("fr-aniversario:mode", "games"));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/index.html`);
  await calm(p);
  await p.waitForTimeout(1500);
  await shot(p, mode === "classic" ? "13-telemovel-classic" : "14-telemovel-games");
  await ctx.close();
}

await browser.close();
server.close();
console.log(`Prints guardados em ${OUT}`);
