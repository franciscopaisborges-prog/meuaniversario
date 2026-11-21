/**
 * Testes end-to-end (Playwright + emuladores Firebase).
 * Executar com:  npm run test:e2e
 *
 * - O SDK Firebase (CDN gstatic) é servido a partir de node_modules/firebase
 *   para os testes funcionarem sem acesso ao CDN.
 * - firebase-config.js é substituído por uma configuração "demo" do emulador.
 * - As imagens do mapa (tiles OSM) são substituídas por uma imagem vazia.
 * - As páginas são servidas com a mesma Content-Security-Policy do firebase.json
 *   (acrescida das origens dos emuladores) para detetar violações de CSP.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { startServer } from "./server.mjs";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("Playwright não encontrado. Instale com:  npm i --no-save playwright && npx playwright install chromium");
  process.exit(1);
}

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT = join(ROOT, "tests", "output");
await mkdir(OUT, { recursive: true });

const PORT = 5179;
const BASE = `http://127.0.0.1:${PORT}`;
const PROJECT = "demo-fr-aniversario";
const NS = `${PROJECT}-default-rtdb`;
const DB = "127.0.0.1:9000";
const AUTH = "127.0.0.1:9099";

// --- CSP igual à de produção + emuladores ---
const hosting = JSON.parse(await readFile(join(ROOT, "firebase.json"), "utf8")).hosting;
let csp = hosting.headers[0].headers.find((h) => h.key === "Content-Security-Policy").value;
csp = csp
  .replace("connect-src 'self'", `connect-src 'self' http://${DB} ws://${DB} http://${AUTH}`)
  .replace("script-src 'self'", `script-src 'self' http://${DB}`);
const server = await startServer(PORT, { "Content-Security-Policy": csp });

const testConfig = (dbPort = 9000) => `
export const firebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "${PROJECT}.firebaseapp.com",
  databaseURL: "https://${NS}.firebaseio.com",
  projectId: "${PROJECT}",
  appId: "1:000000000000:web:demo",
};
export const appCheckSiteKey = "";
export const emulators = { enabled: true, host: "127.0.0.1", databasePort: ${dbPort}, authPort: 9099 };
`;

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

async function prepare(context, { config = "emulator", dbPort = 9000 } = {}) {
  await context.route("https://www.gstatic.com/firebasejs/12.19.0/*", async (route) => {
    const file = new URL(route.request().url()).pathname.split("/").pop();
    const body = await readFile(join(ROOT, "node_modules", "firebase", file));
    await route.fulfill({ body, contentType: "text/javascript", headers: { "Access-Control-Allow-Origin": "*" } });
  });
  await context.route("https://*.tile.openstreetmap.org/**", (r) => r.fulfill({ body: PNG_1x1, contentType: "image/png" }));
  await context.route("https://tile.openstreetmap.org/**", (r) => r.fulfill({ body: PNG_1x1, contentType: "image/png" }));
  if (config === "placeholder") {
    await context.route(`${BASE}/firebase-config.js`, (r) =>
      r.fulfill({
        contentType: "text/javascript",
        body: `export const firebaseConfig = { apiKey: "COLOCAR_API_KEY", authDomain: "COLOCAR_PROJECT_ID.firebaseapp.com", databaseURL: "COLOCAR_DATABASE_URL", projectId: "COLOCAR_PROJECT_ID", appId: "COLOCAR_APP_ID" };
export const appCheckSiteKey = "";
export const emulators = { enabled: false, host: "127.0.0.1", databasePort: 9000, authPort: 9099 };`,
      })
    );
  }
  if (config === "emulator") {
    await context.route(`${BASE}/firebase-config.js`, (r) =>
      r.fulfill({ body: testConfig(dbPort), contentType: "text/javascript" })
    );
  }
}

// --- Utilitários REST do emulador ---
async function ownerGet(path) {
  const res = await fetch(`http://${DB}/${path}.json?ns=${NS}`, { headers: { Authorization: "Bearer owner" } });
  return res.json();
}
async function ownerPut(path, value) {
  await fetch(`http://${DB}/${path}.json?ns=${NS}`, {
    method: "PUT",
    headers: { Authorization: "Bearer owner" },
    body: JSON.stringify(value),
  });
}
async function anonPush(value) {
  const res = await fetch(`http://${DB}/rsvps.json?ns=${NS}`, { method: "POST", body: JSON.stringify(value) });
  assert.equal(res.status, 200);
}
async function signUp(email, password) {
  const res = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  assert.ok(data.localId, JSON.stringify(data));
  return data.localId;
}

// --- Mini executor de testes ---
const results = [];
async function test(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push(["✔", name, null, Date.now() - t0]);
  } catch (error) {
    results.push(["✘", name, error.stack || error.message, Date.now() - t0]);
  }
}

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" && !/\[RSVP\]/.test(text) && !/favicon/.test(text)) errors.push(`console: ${text}`);
    if (/Content Security Policy|Refused to/i.test(text)) errors.push(`csp: ${text}`);
  });
  return errors;
}

const EXPECTED = [
  ["01", "Estação Coimbra-B"],
  ["02", "La Piccola Cucina Italiana"],
  ["03", "Passeio pela Baixa de Coimbra"],
  ["04", "Torre de Almedina"],
  ["05", "Largo da Portagem"],
  ["06", "Portagem → Arnado → Portagem"],
  ["07", "Quinta das Lágrimas Clube de Golfe"],
  ["08", "Apresentação privada de projetos"],
  ["09", "Lanche e momento de convívio"],
];

await ownerPut("", null);
const browser = await chromium.launch();

/* =========================== SITE PÚBLICO =========================== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await prepare(context);
  const page = await context.newPage();
  const errors = watchErrors(page);

  await test("Página inicial abre sem erros (inclui CSP)", async () => {
    await page.goto(`${BASE}/?emulators=1`);
    await page.waitForSelector(".step__link");
    assert.match(await page.title(), /Francisco Rodrigues/);
    assert.equal(await page.locator("#heroTitle").innerText().then((t) => t.replace(/\s+/g, " ").trim()), "Francisco Rodrigues");
    await page.waitForTimeout(300);
    assert.deepEqual(errors, []);
  });

  await test("Nove atividades pela ordem correta", async () => {
    const items = await page.$$eval(".step__link", (els) =>
      els.map((el) => [el.querySelector(".step__num").textContent.trim(), el.querySelector(".step__title").textContent.trim()])
    );
    assert.deepEqual(items, EXPECTED);
  });

  await test("Roteiro sem checkboxes, botões de conclusão ou progresso", async () => {
    const counts = await page.evaluate(() => ({
      checkbox: document.querySelectorAll('#home input[type="checkbox"], #home [role="checkbox"]').length,
      progress: document.querySelectorAll('#home progress, #home [role="progressbar"]').length,
      pressed: document.querySelectorAll("#roteiro [aria-pressed], #roteiro [aria-checked], #roteiro button").length,
      links: document.querySelectorAll("#roteiro a.step__link").length,
    }));
    assert.deepEqual(counts, { checkbox: 0, progress: 0, pressed: 0, links: 9 });
  });

  await test("Mapa geral carrega com marcadores clicáveis", async () => {
    await page.locator("#mapa").scrollIntoViewIfNeeded();
    await page.waitForSelector("#overviewMap .fr-pin");
    const markers = await page.locator("#overviewMap .fr-pin").count();
    assert.equal(markers, 8, "8 marcadores (09 sem local)");
    const paths = await page.locator("#overviewMap .leaflet-overlay-pane path").count();
    assert.ok(paths >= 10 + 3, `percursos (5 linhas + contornos) e 3 paragens desenhados: ${paths}`);
    const arrows = await page.locator("#overviewMap .route-arrow").count();
    assert.ok(arrows >= 10, `setas de direção: ${arrows}`);
    assert.match(await page.locator("#routesStatus").innerText(), /Metrobus — ida/);
    await page.locator("#overviewMap .leaflet-marker-icon:has(.fr-pin)", { hasText: "04" }).click();
    await page.waitForSelector(".leaflet-popup .popup__title");
    assert.equal(await page.locator(".leaflet-popup .popup__title").innerText(), "Torre de Almedina");
    await page.screenshot({ path: join(OUT, "home-map-popup.png") });
    await page.locator(".leaflet-popup .popup__link").click();
    await page.waitForSelector("#detail.is-open");
    assert.equal(await page.locator("#detailTitle").innerText(), "Torre de Almedina");
    assert.equal(new URL(page.url()).hash, "#/atividade/torre-de-almedina");
    await page.locator(".detail__bar [data-detail-back]").click();
    await page.waitForFunction(() => !document.querySelector("#detail").classList.contains("is-open"));
  });

  await test("Botões de foco do mapa (chips) abrem popups", async () => {
    await page.locator('#mapChips [data-focus="golfe"]').click();
    await page.waitForFunction(() => /Quinta das Lágrimas/.test(document.querySelector(".leaflet-popup")?.textContent || ""));
  });

  await test("Cada atividade abre a página correta, com mapa e navegação", async () => {
    await page.goto(`${BASE}/?emulators=1#programa`);
    await page.waitForSelector(".step__link");
    for (let i = 0; i < EXPECTED.length; i += 1) {
      const [id, title] = EXPECTED[i];
      await page.locator(".step__link").nth(i).click();
      await page.waitForSelector("#detail.is-open");
      assert.equal(await page.locator("#detailTitle").innerText(), title);
      assert.equal(await page.locator("#detailCount").innerText(), `${id} / 09`);
      await page.waitForSelector("#detailMap.leaflet-container", { timeout: 4000 });
      const gm = page.locator('#detailContent a:has-text("Abrir no Google Maps")');
      if (id === "09") {
        assert.equal(await gm.count(), 0, "09 não tem local definido");
      } else {
        const href = await gm.getAttribute("href");
        assert.ok(href.startsWith("https://www.google.com/maps/search/?api=1&query="), href);
        assert.equal(await gm.getAttribute("target"), "_blank");
      }
      const hasMarker = await page.locator("#detailMap .pin-blue").count();
      assert.equal(hasMarker, id === "09" ? 0 : 1, `marcador em ${id}`);
      // Não há checkboxes nem estados de conclusão no detalhe
      assert.equal(await page.locator('#detail input[type="checkbox"]').count(), 0);
      await page.locator(".detail__bar [data-detail-back]").click();
      await page.waitForFunction(() => !document.querySelector("#detail").classList.contains("is-open"));
      await page.waitForTimeout(750);
    }
  });

  await test("Botões Anterior / Seguinte percorrem o programa", async () => {
    await page.goto(`${BASE}/?emulators=1#/atividade/ponto-de-encontro`);
    await page.waitForSelector("#detail.is-open");
    assert.equal(await page.locator('.pager-link[rel="prev"]').count(), 0);
    for (let i = 1; i < EXPECTED.length; i += 1) {
      await page.locator('.pager-link[rel="next"]').click();
      await page.waitForFunction((t) => document.querySelector("#detailTitle")?.textContent === t, EXPECTED[i][1]);
    }
    assert.equal(await page.locator('.pager-link[rel="next"]').count(), 0);
    await page.locator('.pager-link[rel="prev"]').click();
    await page.waitForFunction((t) => document.querySelector("#detailTitle")?.textContent === t, EXPECTED[7][1]);
    // "Voltar ao programa" depois de navegar com Seguinte/Anterior fecha o detalhe
    await page.locator(".d-pager__home").click();
    await page.waitForFunction(() => !document.querySelector("#detail").classList.contains("is-open"));
  });

  await test("Ligação direta, histórico do navegador e tecla Escape", async () => {
    await page.goto(`${BASE}/?emulators=1`);
    await page.waitForSelector(".step__link");
    await page.locator(".step__link").nth(6).click();
    await page.waitForSelector("#detail.is-open");
    await page.goBack();
    await page.waitForFunction(() => !document.querySelector("#detail").classList.contains("is-open"));
    await page.goForward();
    await page.waitForSelector("#detail.is-open");
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("#detail").classList.contains("is-open"));
    // Foco regressa ao cartão da atividade
    assert.equal(await page.evaluate(() => document.activeElement?.dataset?.slug), "golfe");
  });

  await test("Página 06 explica a inversão de sentido em Arnado", async () => {
    await page.goto(`${BASE}/?emulators=1#/atividade/metrobus`);
    await page.waitForSelector("#detail.is-open");
    const text = await page.locator("#detailContent").innerText();
    for (const s of ["Portagem", "Aeminium", "Arnado", "Mudança de sentido"]) assert.ok(text.includes(s), s);
    assert.equal(await page.locator(".metro-h").count(), 1);
    await page.waitForSelector("#detailMap .leaflet-overlay-pane path");
    const strokes = await page.$$eval("#detailMap .leaflet-overlay-pane path", (els) => els.map((e) => e.getAttribute("stroke")));
    assert.ok(strokes.includes("#1d3f9e") && strokes.includes("#0b1d47"), "linhas de ida e regresso no mapa do 06");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(OUT, "detail-metrobus-desktop.png"), fullPage: false });
    await page.locator(".metro__figure").scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(OUT, "detail-metrobus-diagram.png") });
  });

  await test("Página 08 não revela projetos", async () => {
    await page.goto(`${BASE}/?emulators=1#/atividade/apresentacao-privada`);
    await page.waitForSelector("#detail.is-open");
    const text = await page.locator("#detailContent").innerText();
    assert.match(text, /PRIVATE PROJECT/i);
    assert.match(text, /Uma apresentação especial\. Alguns projetos, algumas ideias e algumas surpresas\./);
    assert.match(text, /Sala Smart/);
    assert.match(text, /Stay Hotel Coimbra Centro/);
    assert.doesNotMatch(text, /Fluxo/);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(OUT, "detail-private.png") });
  });

  await test("Página 07 tem contactos do clube e avisos de confirmação", async () => {
    await page.goto(`${BASE}/?emulators=1#/atividade/golfe`);
    await page.waitForSelector("#detail.is-open");
    assert.equal(await page.locator('#detailContent a[href="tel:+351923312226"]').count() >= 1, true);
    assert.equal(await page.locator('#detailContent a[href="https://www.quintadaslagrimasgolfe.pt/"]').count() >= 1, true);
    const text = await page.locator("#detailContent").innerText();
    assert.match(text, /Reserva ainda não confirmada/);
    assert.match(text, /cobertas/);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(OUT, "detail-golf.png") });
  });

  await page.goto(`${BASE}/?emulators=1`);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: join(OUT, "home-desktop.png") });
  await page.locator("#programa").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, "home-program-desktop.png") });

  /* ------------------------------ RSVP ------------------------------ */
  await test("RSVP: não envia sem nome e exige resposta", async () => {
    await page.locator(".hero__actions [data-open-rsvp]").click();
    await page.waitForSelector("#rsvpModal[open]");
    assert.equal(await page.locator("#rsvpTitle").innerText(), "Vais juntar-te a nós?");
    await page.locator("#rsvpSubmit").click();
    assert.equal(await page.locator("#rsvpNameError").innerText(), "Escreve o teu nome.");
    assert.equal(await page.locator("#rsvpChoiceError").innerText(), "Escolhe uma resposta.");
    assert.equal(await page.locator("#rsvpName").getAttribute("aria-invalid"), "true");
    await page.locator("#rsvpName").fill("Ana");
    await page.locator("#rsvpSubmit").click();
    assert.equal(await page.locator("#rsvpNameError").innerText(), "");
    assert.equal(await page.locator("#rsvpChoiceError").innerText(), "Escolhe uma resposta.");
    await page.waitForTimeout(500);
    assert.equal(await ownerGet("rsvps"), null, "nada foi gravado");
    await page.screenshot({ path: join(OUT, "rsvp-validation.png") });
  });

  await test("RSVP: resposta positiva grava na RTDB e só depois mostra sucesso", async () => {
    await page.locator("#rsvpName").fill("  João   Gonçalves  ");
    await page.locator('label.choice:has-text("Sim, vou estar presente!")').click();
    await page.locator("#rsvpMessage").fill("Parabéns! Lá estarei — com muita alegria.");
    const disabledDuringSend = await page.evaluate(() => {
      document.querySelector("#rsvpForm").requestSubmit();
      return document.querySelector("#rsvpSubmit").disabled;
    });
    assert.equal(disabledDuringSend, true, "botão desativado durante o envio");
    await page.waitForSelector("#rsvpResultView:not([hidden])");
    assert.equal(
      await page.locator("#rsvpResultText").innerText(),
      "Presença confirmada! Mal podemos esperar por este dia contigo."
    );
    const data = Object.values((await ownerGet("rsvps")) || {});
    assert.equal(data.length, 1);
    assert.equal(data[0].name, "João Gonçalves");
    assert.equal(data[0].attending, "yes");
    assert.equal(data[0].message, "Parabéns! Lá estarei — com muita alegria.");
    assert.equal(data[0].eventDate, "2026-11-29");
    assert.equal(typeof data[0].createdAt, "number");
    await page.screenshot({ path: join(OUT, "rsvp-success.png") });
  });

  await test("RSVP: resposta negativa sem mensagem (mensagem opcional)", async () => {
    await page.locator("#rsvpAnother").click();
    await page.locator("#rsvpName").fill("Inês Antunes");
    await page.locator('label.choice:has-text("Não vou conseguir ir")').click();
    await page.locator("#rsvpSubmit").click();
    await page.waitForSelector("#rsvpResultView:not([hidden])");
    assert.equal(
      await page.locator("#rsvpResultText").innerText(),
      "Obrigado por responderes. Teremos pena de não te ter connosco!"
    );
    const data = Object.values((await ownerGet("rsvps")) || {});
    const ines = data.find((r) => r.name === "Inês Antunes");
    assert.ok(ines);
    assert.equal(ines.attending, "no");
    assert.equal("message" in ines, false);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("#rsvpModal").open);
  });

  await test("Sem erros de consola/CSP durante a navegação", async () => {
    assert.deepEqual(errors, []);
  });

  await context.close();
}

/* --------------------- RSVP: falhas de ligação --------------------- */
await test("RSVP: sem internet mostra erro e não mostra sucesso", async () => {
  const context = await browser.newContext();
  await prepare(context);
  const page = await context.newPage();
  await page.goto(`${BASE}/?emulators=1`);
  await page.waitForSelector(".step__link");
  await context.setOffline(true);
  await page.locator(".hero__actions [data-open-rsvp]").click();
  await page.locator("#rsvpName").fill("Pedro Offline");
  await page.locator('label.choice:has-text("Sim")').click();
  await page.locator("#rsvpSubmit").click();
  await page.waitForSelector("#rsvpStatus .alert--error");
  assert.match(await page.locator("#rsvpStatus").innerText(), /sem ligação/i);
  assert.equal(await page.locator("#rsvpResultView").isHidden(), true);
  assert.equal(await page.locator("#rsvpSubmit").isDisabled(), false, "botão reativado após o erro");
  await page.screenshot({ path: join(OUT, "rsvp-error-offline.png") });
  await context.close();
  const data = Object.values((await ownerGet("rsvps")) || {});
  assert.equal(data.some((r) => r.name === "Pedro Offline"), false);
});

await test("RSVP: servidor inacessível mostra erro (timeout de ligação)", async () => {
  const context = await browser.newContext();
  await prepare(context, { dbPort: 9599 });
  const page = await context.newPage();
  await page.goto(`${BASE}/?emulators=1`);
  await page.waitForSelector(".step__link");
  await page.locator(".hero__actions [data-open-rsvp]").click();
  await page.locator("#rsvpName").fill("Servidor Em Baixo");
  await page.locator('label.choice:has-text("Sim")').click();
  await page.locator("#rsvpSubmit").click();
  await page.waitForSelector("#rsvpStatus .alert--error", { timeout: 20000 });
  assert.equal(await page.locator("#rsvpResultView").isHidden(), true);
  await context.close();
});

await test("RSVP: Firebase por configurar mostra erro claro (sem simular gravação)", async () => {
  const context = await browser.newContext();
  await prepare(context, { config: "placeholder" });
  const page = await context.newPage();
  await page.goto(`${BASE}/`);
  await page.waitForSelector(".step__link");
  await page.locator(".hero__actions [data-open-rsvp]").click();
  await page.locator("#rsvpName").fill("Teste Config");
  await page.locator('label.choice:has-text("Sim")').click();
  await page.locator("#rsvpSubmit").click();
  await page.waitForSelector("#rsvpStatus .alert--error");
  assert.match(await page.locator("#rsvpStatus").innerText(), /configuração do Firebase em falta/);
  await context.close();
});

/* ------------------------------ MOBILE ------------------------------ */
await test("Telemóvel: sem scroll horizontal, roteiro e detalhe utilizáveis", async () => {
  const iPhone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  const context = await browser.newContext(iPhone);
  await prepare(context);
  const page = await context.newPage();
  const errors = watchErrors(page);
  await page.goto(`${BASE}/?emulators=1`);
  await page.waitForSelector(".step__link");
  await page.waitForTimeout(3300);
  await page.screenshot({ path: join(OUT, "mobile-home.png") });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok((await overflow()) <= 0, `overflow home: ${await overflow()}`);
  await page.locator("#programa").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, "mobile-program.png") });
  // alvos de toque ≥ 44px
  const small = await page.$$eval(".step__link, [data-open-rsvp], .chip", (els) =>
    els.filter((el) => el.getBoundingClientRect().height < 40).length
  );
  assert.equal(small, 0, "alvos de toque demasiado pequenos");
  await page.locator("#mapa").scrollIntoViewIfNeeded();
  await page.waitForSelector("#overviewMap .fr-pin");
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, "mobile-map.png") });

  for (const slug of ["ponto-de-encontro", "metrobus", "golfe", "apresentacao-privada"]) {
    await page.evaluate((s) => (location.hash = `#/atividade/${s}`), slug);
    await page.waitForSelector("#detail.is-open");
    await page.waitForTimeout(1100);
    const ow = await page.evaluate(() => {
      const d = document.querySelector("#detail");
      return d.scrollWidth - d.clientWidth;
    });
    assert.ok(ow <= 0, `overflow detalhe ${slug}: ${ow}`);
    await page.screenshot({ path: join(OUT, `mobile-detail-${slug}.png`) });
    if (slug === "metrobus") {
      assert.equal(await page.locator(".metro-v").isVisible(), true, "esquema vertical no telemóvel");
      await page.locator(".metro__figure").scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(OUT, "mobile-metrobus-diagram.png") });
    }
  }
  await page.evaluate(() => (location.hash = ""));
  await page.waitForTimeout(800);
  await page.locator(".hero__actions [data-open-rsvp]").click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, "mobile-rsvp.png") });
  assert.deepEqual(errors, []);
  await context.close();
});

/* =========================== ADMINISTRAÇÃO =========================== */
const ADMIN_EMAIL = "franciscopaisborges@gmail.com"; // autorizado nas regras
const USER_EMAIL = `convidado-${Date.now()}@gmail.com`;

/**
 * Início de sessão Google no emulador: a janela de popup precisa de
 * apis.google.com (indisponível no ambiente de testes), por isso usamos
 * signInWithCredential com um id_token do emulador — o mesmo caminho de
 * autenticação Google do Firebase, sem a janela.
 */
async function googleLogin(page, email, verified = true) {
  await page.evaluate(
    async ({ email, verified }) => {
      const { getFirebaseAuth } = await import("/assets/js/shared/firebase.js");
      const { auth, authModule } = await getFirebaseAuth();
      const idToken = JSON.stringify({ sub: `google-${email}`, email, email_verified: verified });
      await authModule.signInWithCredential(auth, authModule.GoogleAuthProvider.credential(idToken));
    },
    { email, verified }
  );
}
await anonPush({ name: "Zé Ninguém", attending: "no", createdAt: { ".sv": "timestamp" }, eventDate: "2026-11-29" });
await anonPush({ name: '=HYPERLINK("x")', attending: "yes", message: 'Linha 1\nAspas "duplas"; ponto-e-vírgula', createdAt: { ".sv": "timestamp" }, eventDate: "2026-11-29" });

{
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  await prepare(context);
  const page = await context.newPage();
  const errors = watchErrors(page);

  await test("Admin: sem sessão não mostra dados", async () => {
    await page.goto(`${BASE}/admin.html?emulators=1`);
    await page.waitForSelector("#viewLogin:not([hidden])");
    assert.equal(await page.locator("#viewDashboard").isHidden(), true);
    assert.equal(await page.locator("#rsvpRows tr").count(), 0);
    const html = await page.content();
    assert.equal(html.includes("Gonçalves"), false);
    await page.screenshot({ path: join(OUT, "admin-login.png") });
  });

  await test("Admin: ecrã de login só com Google (sem palavra-passe)", async () => {
    assert.equal(await page.locator("#loginGoogle").isVisible(), true);
    assert.match(await page.locator("#loginGoogle").innerText(), /Entrar com Google/i);
    assert.equal(await page.locator('#viewLogin input[type="password"]').count(), 0);
  });

  await test("Admin: conta Google não autorizada não vê respostas", async () => {
    await googleLogin(page, USER_EMAIL);
    await page.waitForSelector("#viewUnauthorized:not([hidden])");
    assert.equal(await page.locator("#viewDashboard").isHidden(), true);
    assert.equal(await page.locator("#rsvpRows tr").count(), 0);
    assert.match(await page.locator("#unauthPath").innerText(), /^\/admins\/.+: true$/);
    // Mesmo tentando ler diretamente pelo SDK, as regras recusam.
    const denied = await page.evaluate(async () => {
      const { getFirebase } = await import("/assets/js/shared/firebase.js");
      const { ref, get } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js");
      const { db } = await getFirebase();
      try {
        await get(ref(db, "rsvps"));
        return false;
      } catch (e) {
        return /permission/i.test(String(e));
      }
    });
    assert.equal(denied, true);
    await page.screenshot({ path: join(OUT, "admin-unauthorized.png") });
    await page.locator("#logoutBtn").click();
    await page.waitForSelector("#viewLogin:not([hidden])");
  });

  await test("Admin: franciscopaisborges@gmail.com (Google) vê totais corretos e tabela", async () => {
    await googleLogin(page, ADMIN_EMAIL);
    assert.equal(await page.locator("#sessionEmail").innerText(), ADMIN_EMAIL);
    await page.waitForSelector("#viewDashboard:not([hidden])");
    await page.waitForFunction(() => document.querySelectorAll("#rsvpRows tr").length > 0);
    const all = Object.values(await ownerGet("rsvps"));
    const yes = all.filter((r) => r.attending === "yes").length;
    const no = all.filter((r) => r.attending === "no").length;
    assert.equal(await page.locator("#statTotal").innerText(), String(all.length));
    assert.equal(await page.locator("#statYes").innerText(), String(yes));
    assert.equal(await page.locator("#statNo").innerText(), String(no));
    assert.equal(await page.locator("#rsvpRows tr").count(), all.length);
    assert.match(await page.locator("#liveText").innerText(), /tempo real/);
  });

  await test("Admin: atualização em tempo real", async () => {
    const before = Number(await page.locator("#statTotal").innerText());
    await anonPush({ name: "Chegou Agora", attending: "yes", createdAt: { ".sv": "timestamp" }, eventDate: "2026-11-29" });
    await page.waitForFunction((n) => Number(document.querySelector("#statTotal").textContent) === n + 1, before);
    assert.equal(await page.locator("#rsvpRows tr").first().locator("td").first().innerText(), "Chegou Agora");
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, "admin-dashboard.png"), fullPage: true });
  });

  await test("Admin: pesquisa, filtro e ordenação", async () => {
    await page.locator("#searchInput").fill("goncalves");
    assert.equal(await page.locator("#rsvpRows tr").count(), 1);
    assert.equal(await page.locator("#rsvpRows td.a-name").innerText(), "João Gonçalves");
    await page.locator("#searchInput").fill("");
    await page.locator("#filterSelect").selectOption("no");
    const noNames = await page.$$eval("#rsvpRows td.a-name", (els) => els.map((e) => e.textContent));
    assert.deepEqual(noNames.sort(), ["Inês Antunes", "Zé Ninguém"]);
    await page.locator("#filterSelect").selectOption("all");
    await page.locator('[data-sort="name"]').click();
    const names = await page.$$eval("#rsvpRows td.a-name", (els) => els.map((e) => e.textContent));
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" }));
    assert.deepEqual(names, sorted);
    assert.equal(await page.locator('th:has([data-sort="name"])').getAttribute("aria-sort"), "ascending");
    await page.locator('[data-sort="name"]').click();
    assert.equal(await page.locator('th:has([data-sort="name"])').getAttribute("aria-sort"), "descending");
  });

  await test("Admin: botão Atualizar", async () => {
    await page.locator("#refreshBtn").click();
    await page.waitForFunction(() => document.querySelector("#refreshBtn").textContent === "Atualizar");
    assert.match(await page.locator("#tableFoot").innerText(), /atualizado às/);
  });

  await test("Admin: exportação CSV em UTF-8 com caracteres portugueses", async () => {
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#exportBtn").click()]);
    assert.match(download.suggestedFilename(), /^respostas-aniversario-FR-\d{8}-\d{4}\.csv$/);
    const path = join(OUT, "export.csv");
    await download.saveAs(path);
    const buf = await readFile(path);
    assert.deepEqual([...buf.subarray(0, 3)], [0xef, 0xbb, 0xbf], "BOM UTF-8");
    const text = buf.toString("utf8").slice(1);
    assert.ok(text.startsWith('"Nome";"Estado";"Mensagem";"Data e hora"'));
    assert.ok(text.includes('"João Gonçalves";"Confirmado";"Parabéns! Lá estarei — com muita alegria."'));
    assert.ok(text.includes('"Inês Antunes";"Não vai";""'));
    assert.ok(text.includes(`"'=HYPERLINK(""x"")"`), "proteção contra fórmulas e aspas escapadas");
    assert.ok(text.includes('"Linha 1\nAspas ""duplas""; ponto-e-vírgula"'));
  });

  await test("Admin: terminar sessão limpa os dados", async () => {
    await page.locator("#logoutBtn").click();
    await page.waitForSelector("#viewLogin:not([hidden])");
    assert.equal(await page.locator("#viewDashboard").isHidden(), true);
    assert.equal(await page.locator("#rsvpRows tr").count(), 0);
    await page.reload();
    await page.waitForSelector("#viewLogin:not([hidden])");
  });

  await test("Admin: sem erros de consola/CSP", async () => {
    assert.deepEqual(errors, []);
  });

  await context.close();
}

await test("Admin (telemóvel): painel sem scroll horizontal", async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  await prepare(context);
  const page = await context.newPage();
  await page.goto(`${BASE}/admin.html?emulators=1`);
  await page.waitForSelector("#viewLogin:not([hidden])");
  await googleLogin(page, ADMIN_EMAIL);
  await page.waitForSelector("#viewDashboard:not([hidden])");
  await page.waitForFunction(() => document.querySelectorAll("#rsvpRows tr").length > 0);
  const ow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(ow <= 0, `overflow ${ow}`);
  await page.screenshot({ path: join(OUT, "admin-mobile.png"), fullPage: true });
  await context.close();
});

await test("Admin: Firebase por configurar mostra aviso", async () => {
  const context = await browser.newContext();
  await prepare(context, { config: "placeholder" });
  const page = await context.newPage();
  await page.goto(`${BASE}/admin.html`);
  await page.waitForSelector("#viewNotConfigured:not([hidden])");
  await context.close();
});

/* ============================= HORÁRIOS ============================= */
await ownerPut("schedule", null);
{
  const admCtx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await prepare(admCtx);
  const adm = await admCtx.newPage();
  const admErrors = watchErrors(adm);
  const pubCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await prepare(pubCtx);
  const pub = await pubCtx.newPage();
  const pubErrors = watchErrors(pub);

  const stepOrder = () => pub.$$eval(".step__link", (els) => els.map((e) => e.dataset.slug));
  const stepTime = (slug) => pub.locator(`.step__link[data-slug="${slug}"] .step__time`).innerText();
  const saveRow = async (id, start, end) => {
    const row = adm.locator(`.a-srow[data-id="${id}"]`);
    await row.locator('[name="start"]').fill(start);
    await row.locator('[name="end"]').fill(end);
    await row.locator('[data-action="save"]').click();
  };

  await test("Horários: sem horário o site mostra “A confirmar” (sem valores fictícios)", async () => {
    await pub.goto(`${BASE}/?emulators=1`);
    await pub.waitForSelector(".step__link");
    const times = await pub.$$eval(".step__time", (els) => els.map((e) => e.textContent.trim()));
    assert.equal(times.length, 9);
    assert.ok(times.every((t) => t === "Horário: A confirmar"), times.join(" | "));
  });

  await test("Horários: separador no painel com as 9 atividades", async () => {
    await adm.goto(`${BASE}/admin.html?emulators=1`);
    await adm.waitForSelector("#viewLogin:not([hidden])");
    await googleLogin(adm, ADMIN_EMAIL);
    await adm.waitForSelector("#viewDashboard:not([hidden])");
    await adm.locator("#tabSchedule").click();
    await adm.waitForSelector("#panelSchedule:not([hidden]) .a-srow");
    assert.equal(await adm.locator(".a-srow").count(), 9);
    assert.equal(await adm.locator("#panelRsvps").isHidden(), true);
  });

  await test("Horários: guardar início e fim atualiza o site em tempo real", async () => {
    await saveRow("01", "10:00", "10:45");
    await adm.waitForSelector('.a-srow[data-id="01"] .a-srow__msg.is-ok');
    const stored = await ownerGet("schedule/01");
    assert.equal(stored.start, "10:00");
    assert.equal(stored.end, "10:45");
    assert.equal(typeof stored.updatedAt, "number");
    await pub.waitForFunction(
      () => document.querySelector('.step__link[data-slug="ponto-de-encontro"] .step__time')?.textContent === "Horário: 10:00 – 10:45"
    );
  });

  await test("Horários: só hora de início também é válido", async () => {
    await saveRow("07", "16:00", "");
    await pub.waitForFunction(() => document.querySelector('.step__link[data-slug="golfe"] .step__time')?.textContent === "Horário: 16:00");
    assert.equal("end" in (await ownerGet("schedule/07")), false);
  });

  await test("Horários: ordem cronológica atualiza-se sozinha", async () => {
    await saveRow("02", "09:00", "09:40"); // almoço antes do encontro → passa para primeiro
    await pub.waitForFunction(() => document.querySelector(".step__link")?.dataset.slug === "almoco");
    const order = await stepOrder();
    assert.deepEqual(order.slice(0, 2), ["almoco", "ponto-de-encontro"]);
    // numeração acompanha a ordem
    assert.equal(await pub.locator(".step__link").first().locator(".step__num").innerText(), "01");
    // atividades sem horário mantêm a sua posição
    assert.equal(order[2], "passeio-baixa");
    // o painel também mostra a nova ordem
    assert.equal(await adm.locator(".a-srow").first().getAttribute("data-id"), "02");
    await pub.screenshot({ path: join(OUT, "schedule-public.png") });
    await adm.screenshot({ path: join(OUT, "admin-schedule.png"), fullPage: true });
  });

  await test("Horários: fim antes do início é recusado e não grava", async () => {
    await saveRow("03", "15:00", "14:00");
    await adm.waitForSelector('.a-srow[data-id="03"] .a-srow__msg.is-error');
    assert.match(await adm.locator('.a-srow[data-id="03"] .a-srow__msg').innerText(), /posterior/);
    assert.equal(await ownerGet("schedule/03"), null);
  });

  await test("Horários: só hora de fim é recusado", async () => {
    await saveRow("04", "", "11:00");
    await adm.waitForSelector('.a-srow[data-id="04"] .a-srow__msg.is-error');
    assert.equal(await ownerGet("schedule/04"), null);
  });

  await test("Horários: página da atividade aberta atualiza o horário sem recarregar", async () => {
    await pub.locator('.step__link[data-slug="golfe"]').click();
    await pub.waitForSelector("#detail.is-open #detailMap.leaflet-container");
    assert.equal(await pub.locator('[data-schedule="07"]').innerText(), "16:00");
    await saveRow("07", "16:30", "18:00");
    await pub.waitForFunction(() => document.querySelector('[data-schedule="07"]')?.textContent === "16:30 – 18:00");
    assert.equal(await pub.locator("#detailMap.leaflet-container").count(), 1, "mapa mantém-se");
    await pub.keyboard.press("Escape");
    await pub.waitForFunction(() => !document.querySelector("#detail").classList.contains("is-open"));
  });

  await test("Horários: remover volta a “A confirmar” e repõe a ordem", async () => {
    await adm.locator('.a-srow[data-id="02"] [data-action="clear"]').click();
    await adm.waitForSelector('.a-srow[data-id="02"] .a-srow__msg.is-ok');
    assert.equal(await ownerGet("schedule/02"), null);
    await pub.waitForFunction(() => document.querySelector(".step__link")?.dataset.slug === "ponto-de-encontro");
    assert.equal(await stepTime("almoco"), "Horário: A confirmar");
  });

  await test("Horários: visitante sem ligação ao Firebase vê “A confirmar”", async () => {
    const ctx = await browser.newContext();
    await prepare(ctx, { config: "placeholder" });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/`);
    await p.waitForSelector(".step__link");
    const times = await p.$$eval(".step__time", (els) => els.map((e) => e.textContent.trim()));
    assert.ok(times.every((t) => t === "Horário: A confirmar"));
    await ctx.close();
  });

  await test("Horários: sem erros de consola", async () => {
    assert.deepEqual([...admErrors, ...pubErrors], []);
  });

  await admCtx.close();
  await pubCtx.close();
}

await test("Horários (telemóvel): painel utilizável e sem scroll horizontal", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await prepare(ctx);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin.html?emulators=1`);
  await page.waitForSelector("#viewLogin:not([hidden])");
  await googleLogin(page, ADMIN_EMAIL);
  await page.waitForSelector("#viewDashboard:not([hidden])");
  await page.locator("#tabSchedule").tap();
  await page.waitForSelector("#panelSchedule:not([hidden]) .a-srow");
  const ow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(ow <= 0, `overflow ${ow}`);
  const small = await page.$$eval(".a-srow input, .a-srow button", (els) => els.filter((e) => e.getBoundingClientRect().height < 40).length);
  assert.equal(small, 0);
  await page.screenshot({ path: join(OUT, "admin-schedule-mobile.png"), fullPage: true });
  await ctx.close();
});
await ownerPut("schedule", null);

/* ===================== ATUALIZAÇÃO FORÇADA / REVOGAÇÃO ===================== */
await test("Atualização forçada: páginas abertas recarregam quando /meta/version muda", async () => {
  await ownerPut("meta/version", "v1");
  const ctx = await browser.newContext();
  await prepare(ctx);
  const pub = await ctx.newPage();
  const adm = await ctx.newPage();
  await pub.goto(`${BASE}/?emulators=1`);
  await pub.waitForSelector(".step__link");
  await adm.goto(`${BASE}/admin.html?emulators=1`);
  await adm.waitForSelector("#viewLogin:not([hidden])");
  await pub.waitForTimeout(1500); // ligação estabelecida e versão inicial lida
  const marks = await Promise.all([pub, adm].map((p) => p.evaluate(() => (window.__mark = Math.random()))));
  const reloads = [pub, adm].map((p) => p.waitForEvent("load", { timeout: 15000 }));
  await ownerPut("meta/version", "v2");
  await Promise.all(reloads);
  const after = await Promise.all([pub, adm].map((p) => p.evaluate(() => window.__mark)));
  assert.deepEqual(after, [undefined, undefined], `marcas antes: ${marks}`);
  await ctx.close();
});

await test("Revogação: administrador removido de /admins perde os dados de imediato", async () => {
  const ctx = await browser.newContext();
  await prepare(ctx);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin.html?emulators=1`);
  await page.waitForSelector("#viewLogin:not([hidden])");
  const email = `temporario-${Date.now()}@gmail.com`;
  await googleLogin(page, email);
  await page.waitForSelector("#viewUnauthorized:not([hidden])");
  const uid = await page.evaluate(async () => {
    const { getFirebaseAuth } = await import("/assets/js/shared/firebase.js");
    return (await getFirebaseAuth()).auth.currentUser.uid;
  });
  await ownerPut(`admins/${uid}`, true);
  await page.reload();
  await page.waitForSelector("#viewLogin:not([hidden]), #viewDashboard:not([hidden])");
  if (await page.locator("#viewLogin").isVisible()) await googleLogin(page, email);
  await page.waitForSelector("#viewDashboard:not([hidden])");
  await page.waitForFunction(() => document.querySelectorAll("#rsvpRows tr").length > 0);
  await ownerPut(`admins/${uid}`, null);
  await page.waitForSelector("#viewUnauthorized:not([hidden])", { timeout: 10000 });
  assert.equal(await page.locator("#rsvpRows tr").count(), 0);
  assert.equal(await page.locator("#viewDashboard").isHidden(), true);
  await ctx.close();
});

await test("Painel fictício: conta em /decoys vê só André e Maria e nenhum botão funciona", async () => {
  const ctx = await browser.newContext({ acceptDownloads: true });
  await prepare(ctx);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto(`${BASE}/admin.html?emulators=1`);
  await page.waitForSelector("#viewLogin:not([hidden])");
  const email = `ficticio-${Date.now()}@gmail.com`;
  await googleLogin(page, email);
  await page.waitForSelector("#viewUnauthorized:not([hidden])");
  const uid = await page.evaluate(async () => {
    const { getFirebaseAuth } = await import("/assets/js/shared/firebase.js");
    return (await getFirebaseAuth()).auth.currentUser.uid;
  });
  await ownerPut(`decoys/${uid}`, true);
  await page.reload();
  await page.waitForSelector("#viewLogin:not([hidden]), #viewDashboard:not([hidden])");
  if (await page.locator("#viewLogin").isVisible()) await googleLogin(page, email);
  await page.waitForSelector("#viewDashboard:not([hidden])");
  const names = await page.$$eval("#rsvpRows td.a-name", (els) => els.map((e) => e.textContent).sort());
  assert.deepEqual(names, ["André", "Maria"]);
  assert.equal(await page.locator("#statTotal").innerText(), "2");
  // nenhum dado real no ecrã
  assert.equal((await page.content()).includes("Gonçalves"), false);
  // botões sem efeito
  let downloaded = false;
  page.on("download", () => (downloaded = true));
  await page.locator("#exportBtn").click();
  await page.locator("#refreshBtn").click();
  await page.locator('[data-sort="name"]').click();
  await page.locator("#tabSchedule").click();
  await page.waitForTimeout(500);
  assert.equal(downloaded, false, "CSV não descarregado");
  assert.equal(await page.locator("#panelSchedule").isHidden(), true, "separador não muda");
  assert.equal(await page.locator('th:has([data-sort="name"])').getAttribute("aria-sort"), "none");
  await page.screenshot({ path: join(OUT, "admin-decoy.png") });

  // "Terminar sessão" abre o jogo da cobrinha em vez de terminar a sessão
  await page.locator("#logoutBtn").click();
  await page.waitForSelector("#snakeDialog[open]");
  assert.match(await page.locator("#snakeTitle").innerText(), /50 pontos/);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, "admin-decoy-snake.png") });
  await page.locator("#snakeStart").click();
  // sem mudar de direção, a cobra bate na parede → fim de jogo, sessão continua
  await page.waitForFunction(() => /Fim de jogo/.test(document.querySelector("#snakeMsg")?.textContent || ""), null, { timeout: 8000 });
  assert.equal(await page.locator("#snakeStart").innerText(), "TENTAR OUTRA VEZ");
  await page.screenshot({ path: join(OUT, "admin-decoy-snake-over.png") });
  // controlos funcionam (os botões do jogo não são bloqueados)
  await page.locator("#snakeStart").click();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#snakeOverlay").isHidden(), true);
  await page.locator('[data-snake="close"]').click();
  await page.waitForFunction(() => !document.querySelector("#snakeDialog").open);
  assert.equal(await page.locator("#viewDashboard").isVisible(), true, "sessão não termina sem 50 pontos");
  const signedIn = await page.evaluate(async () => {
    const { getFirebaseAuth } = await import("/assets/js/shared/firebase.js");
    return Boolean((await getFirebaseAuth()).auth.currentUser);
  });
  assert.equal(signedIn, true);
  assert.deepEqual(errors, []);
  await ownerPut(`decoys/${uid}`, null);
  await ctx.close();
});

await browser.close();
server.close();

for (const [mark, name, err, ms] of results) console.log(`${mark} ${name} (${ms} ms)${err ? `\n    → ${err}` : ""}`);
const failed = results.filter((r) => r[0] === "✘").length;
console.log(`\nE2E: ${results.length - failed}/${results.length} testes passaram. Capturas em tests/output/`);
process.exit(failed ? 1 : 0);
