/**
 * Testes do assistente por email (tools/assistente-email/Code.gs) em Node,
 * com Gmail, Firebase (REST), OpenRouter e serviços do Apps Script simulados.
 * Executar:  node tests/assistente-email.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import vm from "node:vm";
import { normalizeTerm, hashTerm } from "../assets/js/shared/banned.js";

const CODE = readFileSync(new URL("../tools/assistente-email/Code.gs", import.meta.url), "utf8");
const ICLOUD = "teste@icloud.com";
const DB_URL = "https://aniversario-francisco-default-rtdb.europe-west1.firebasedatabase.app";

const clock = { now: Date.now() };
const pendingAfterSleep = [];

function makeEnv({ gemini = [] } = {}) {
  const db = {};
  const props = new Map();
  const sent = [];
  const fetches = [];
  const inbox = [];
  const geminiQueue = [...gemini];
  const geminiCalls = [];

  const getPath = (path) => path.split("/").filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), db);
  const setPath = (path, value) => {
    const keys = path.split("/").filter(Boolean);
    if (!keys.length) throw new Error("root set");
    let o = db;
    for (const k of keys.slice(0, -1)) o = o[k] ??= {};
    const last = keys[keys.length - 1];
    if (value === null || value === undefined) delete o[last];
    else o[last] = value;
  };
  const resolveSv = (v) =>
    v && typeof v === "object"
      ? v[".sv"] === "timestamp"
        ? Date.now()
        : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveSv(x)]))
      : v;

  function firebase(url, opts) {
    const u = new URL(url);
    assert.equal(opts.headers.Authorization, "Bearer TOKEN", "pedido ao Firebase com token OAuth");
    const path = decodeURIComponent(u.pathname.replace(/\.json$/, "")).replace(/^\//, "");
    const method = (opts.method || "get").toUpperCase();
    const body = opts.payload ? JSON.parse(opts.payload) : undefined;
    fetches.push({ method, path, body });
    if (method === "GET") {
      let val = getPath(path);
      const orderBy = u.searchParams.get("orderBy");
      if (val && orderBy) {
        const key = JSON.parse(orderBy);
        let entries = Object.entries(val).sort((a, b) => (a[1][key] ?? 0) - (b[1][key] ?? 0));
        const startAt = u.searchParams.get("startAt");
        if (startAt) entries = entries.filter(([, v]) => (v[key] ?? 0) >= Number(startAt));
        const last = u.searchParams.get("limitToLast");
        if (last) entries = entries.slice(-Number(last));
        val = Object.fromEntries(entries);
      }
      return resp(200, JSON.stringify(val ?? null));
    }
    if (method === "PUT") setPath(path, resolveSv(body));
    else if (method === "DELETE") setPath(path, null);
    else if (method === "PATCH") {
      for (const [k, v] of Object.entries(body)) setPath(path ? `${path}/${k}` : k, v === null ? null : resolveSv(v));
    }
    return resp(200, JSON.stringify(body ?? null));
  }

  function resp(code, text) {
    return { getResponseCode: () => code, getContentText: () => text };
  }

  const sleeps = [];
  const Utilities = {
    sleep: (ms) => {
      sleeps.push(ms);
      clock.now += ms;
      if (sleeps.length === 1 && pendingAfterSleep.length) pendingAfterSleep.splice(0).forEach((f) => f());
    },
    DigestAlgorithm: { SHA_256: "sha256" },
    Charset: { UTF_8: "utf8" },
    computeDigest: (alg, text) => [...createHash("sha256").update(text, "utf8").digest()].map((b) => (b > 127 ? b - 256 : b)),
    getUuid: () => randomUUID(),
    formatDate: (date, tz, pattern) => {
      const p = Object.fromEntries(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
        }).formatToParts(date).map((x) => [x.type, x.value])
      );
      return pattern.replace("yyyy", p.year).replace("MM", p.month).replace("dd", p.day).replace("HH", p.hour).replace("mm", p.minute);
    },
  };

  const FakeDate = class extends Date {
    constructor(...a) {
      super(...(a.length ? a : [clock.now]));
    }
    static now() {
      return clock.now;
    }
  };
  const ctx = vm.createContext({
    console,
    Date: FakeDate,
    Logger: { log: () => {} },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => props.set(k, String(v)),
        deleteProperty: (k) => props.delete(k),
      }),
    },
    ScriptApp: {
      getOAuthToken: () => "TOKEN",
      getProjectTriggers: () => [],
      deleteTrigger: () => {},
      newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => {} }) }) }),
    },
    Utilities,
    UrlFetchApp: {
      fetch: (url, opts = {}) => {
        if (url.startsWith(DB_URL)) return firebase(url, opts);
        if (url === "https://openrouter.ai/api/v1/chat/completions") {
          geminiCalls.push(JSON.parse(opts.payload));
          assert.equal(opts.headers.Authorization, "Bearer CHAVE");
          const next = geminiQueue.shift();
          if (!next) throw new Error("OpenRouter: sem resposta preparada");
          if (next.status) return resp(next.status, JSON.stringify({ error: { message: next.error } }));
          return resp(200, JSON.stringify({ choices: [{ message: next }] }));
        }
        throw new Error("URL inesperado: " + url);
      },
    },
    GmailApp: {
      search: () => inbox.filter((t) => t.getMessages().some((m) => m.isUnread())),
      sendEmail: (to, subject, body) => sent.push({ to, subject, body }),
    },
  });
  vm.runInContext(
    CODE.replace('ICLOUD_EMAIL: "COLOCAR_O_TEU_EMAIL@icloud.com"', `ICLOUD_EMAIL: "${ICLOUD}"`) +
      "\n;globalThis.__api = { tratarMensagem_, verificar, instalar, hashNome_, normalizarNome_, extrairTexto_, hora_ };",
    ctx
  );

  function receive(text, { from = `Eu <${ICLOUD}>`, dkim = "dkim=pass header.i=@icloud.com" } = {}) {
    const replies = [];
    let unread = true;
    const msg = {
      isUnread: () => unread,
      markRead: () => (unread = false),
      getFrom: () => from,
      getHeader: (h) => (h === "Authentication-Results" ? `mx.google.com; ${dkim}; spf=pass` : ""),
      getPlainBody: () => text,
      reply: (b) => replies.push(b),
    };
    inbox.push({ getMessages: () => [msg] });
    return replies;
  }

  return { api: ctx.__api, db, props, sent, fetches, receive, geminiCalls, sleeps };
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(["✔", name]);
  } catch (e) {
    results.push(["✘", name, e.stack || e.message]);
  }
}

/* --------------------------------- testes -------------------------------- */

await test("Impressão digital de nomes igual à do site (sem acentos/maiúsculas)", async () => {
  const { api } = makeEnv();
  for (const nome of ["Mariana", "MARIÁNA", "Mary Ana", "João", "Zé-Maria"]) {
    const n = normalizeTerm(nome);
    assert.equal(api.normalizarNome_(nome), n);
    assert.equal(api.hashNome_(n), await hashTerm(n), nome);
  }
});

await test("Extrai só o texto novo (sem citação nem assinatura do Watch)", () => {
  const { api } = makeEnv();
  assert.equal(api.extrairTexto_("hora 7 16:00\n\nEnviado do meu Apple Watch\n\n> antigo"), "hora 7 16:00");
  assert.equal(api.extrairTexto_("sim\n\nNo dia 28/11, às 10:00, X escreveu:\n> texto"), "sim");
  assert.equal(api.hora_("16h"), "16:00");
  assert.equal(api.hora_("4:30"), "04:30");
  assert.equal(api.hora_("25:00"), "");
});

await test("Comando 'hora 7 16:00-18:00' pede confirmação e só grava com 'sim'", () => {
  const env = makeEnv();
  const r1 = env.api.tratarMensagem_("hora 7 16:00-18:00");
  assert.match(r1, /07 Golfe.*16:00 – 18:00[\s\S]*Confirmas\?/);
  assert.equal(env.db.schedule, undefined, "nada gravado antes do sim");
  const r2 = env.api.tratarMensagem_("Sim");
  assert.match(r2, /Feito/);
  assert.equal(env.db.schedule["07"].start, "16:00");
  assert.equal(env.db.schedule["07"].end, "18:00");
  assert.equal(typeof env.db.schedule["07"].updatedAt, "number");
});

await test("'não' cancela e horário inválido é recusado", () => {
  const env = makeEnv();
  env.api.tratarMensagem_("hora 3 13:00");
  assert.match(env.api.tratarMensagem_("não"), /Cancelado/);
  assert.equal(env.db.schedule, undefined);
  assert.match(env.api.tratarMensagem_("hora 3 15:00-14:00"), /depois do início/);
  assert.match(env.api.tratarMensagem_("hora 12 10:00"), /Atividade inválida/);
});

await test("Proibir e permitir nome escreve nas duas listas (igual ao painel)", async () => {
  const env = makeEnv();
  env.api.tratarMensagem_("proibir Joana");
  env.api.tratarMensagem_("sim");
  const entries = Object.values(env.db.bannedNames);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].term, "Joana");
  const h = await hashTerm("joana");
  assert.equal(entries[0].hash, h);
  assert.equal(env.db.bannedHashes[h], true);
  env.api.tratarMensagem_("permitir JOANA");
  assert.match(env.api.tratarMensagem_("sim"), /já pode confirmar/);
  assert.deepEqual(env.db.bannedNames || {}, {});
  assert.equal(env.db.bannedHashes?.[h], undefined);
});

await test("Resumo das respostas com alergias e cartão Move C", () => {
  const env = makeEnv();
  env.db.rsvps = {
    a: { name: "Rita", attending: "yes", createdAt: 1, allergies: "Glúten", noTransportCard: true },
    b: { name: "Rui", attending: "no", createdAt: 2 },
  };
  const r = env.api.tratarMensagem_("respostas");
  assert.match(r, /1 vão · 1 não vão/);
  assert.match(r, /Alergias: Rita \(Glúten\)/);
  assert.match(r, /Sem cartão Move C: Rita/);
});

await test("Email: aceita só do iCloud com DKIM válido e responde no mesmo email", () => {
  const env = makeEnv();
  const ok = env.receive("horarios\n\nEnviado do meu Apple Watch");
  const falso = env.receive("horarios", { dkim: "dkim=fail" });
  const outro = env.receive("horarios", { from: "x@gmail.com" });
  env.api.verificar();
  assert.equal(ok.length, 1);
  assert.match(ok[0], /01 Largo da Portagem.*A confirmar/);
  assert.equal(falso.length, 0, "DKIM falhado é ignorado");
  assert.equal(outro.length, 0, "outro remetente é ignorado");
});

await test("Modo conversa: depois de uma mensagem verifica de 10 em 10 s (até ~50 s)", () => {
  const env = makeEnv();
  const r1 = env.receive("hora 7 16:00");
  let r2;
  pendingAfterSleep.push(() => (r2 = env.receive("sim")));
  env.api.verificar();
  assert.equal(r1.length, 1);
  assert.match(r1[0], /Confirmas/);
  assert.ok(r2 && r2.length === 1, "o 'sim' foi respondido na mesma execução, ~10 s depois");
  assert.match(r2[0], /Feito/);
  assert.ok(env.sleeps.length >= 4 && env.sleeps.length <= 5, `verificações: ${env.sleeps.length}`);
  assert.ok(env.sleeps.every((ms) => ms === 10000));
});

await test("Endereço iCloud pode vir das Propriedades do script", () => {
  const env = makeEnv();
  env.props.set("ICLOUD_EMAIL", "outro@icloud.com");
  const ok = env.receive("horarios", { from: "Eu <outro@icloud.com>" });
  env.api.verificar();
  assert.equal(ok.length, 1);
});

await test("Fora de conversa verifica só uma vez (poupa a quota do Google)", () => {
  const env = makeEnv();
  env.props.set("ULTIMA_ATIVIDADE", String(clock.now - 10 * 60000));
  env.api.verificar();
  assert.equal(env.sleeps.length, 0);
});

await test("Aviso por email de cada nova confirmação", () => {
  const env = makeEnv();
  env.props.set("ULTIMA_RESPOSTA", "1000");
  env.db.rsvps = {
    v: { name: "Velho", attending: "yes", createdAt: 900 },
    n: { name: "Inês", attending: "yes", createdAt: 2000, allergies: "Frutos secos", noTransportCard: false, message: "Até lá" },
  };
  env.api.verificar();
  assert.equal(env.sent.length, 1);
  assert.match(env.sent[0].subject, /Inês: SIM/);
  assert.match(env.sent[0].body, /Alergias: Frutos secos/);
  assert.equal(env.props.get("ULTIMA_RESPOSTA"), "2000");
  env.api.verificar();
  assert.equal(env.sent.length, 1, "não repete");
});

await test("IA (OpenRouter): pedido em linguagem natural → consulta → alteração com confirmação", () => {
  const env = makeEnv({
    gemini: [
      { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "ver_horarios", arguments: "{}" } }] },
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "c2", type: "function", function: { name: "definir_horario", arguments: '{"atividade":"7","inicio":"16:30","fim":"18:00"}' } }],
      },
    ],
  });
  env.props.set("OPENROUTER_API_KEY", "CHAVE");
  const r = env.api.tratarMensagem_("põe o golfe às quatro e meia até às seis");
  assert.match(r, /07 Golfe.*16:30 – 18:00[\s\S]*Confirmas\?/);
  assert.equal(env.db.schedule, undefined);
  assert.equal(env.geminiCalls.length, 2);
  const second = env.geminiCalls[1].messages;
  assert.ok(second.some((m) => m.role === "tool" && m.tool_call_id === "c1" && /01 Largo/.test(m.content)), "resultado da consulta enviado à IA");
  assert.ok(env.geminiCalls[0].tools.some((t) => t.type === "function" && t.function.name === "proibir_nome"));
  assert.equal(env.geminiCalls[0].tools.find((t) => t.function.name === "definir_horario").function.parameters.properties.inicio.type, "string");
  assert.equal(env.geminiCalls[0].model, "openrouter/free");
  assert.match(env.api.tratarMensagem_("sim"), /Feito/);
  assert.equal(env.db.schedule["07"].start, "16:30");
});

await test("IA (OpenRouter): pergunta de consulta responde com texto, sem alterar", () => {
  const env = makeEnv({
    gemini: [
      { role: "assistant", content: null, tool_calls: [{ id: "r1", type: "function", function: { name: "ver_resumo", arguments: "" } }] },
      { role: "assistant", content: "Vão 2 pessoas. A Rita tem alergia ao glúten." },
    ],
  });
  env.props.set("OPENROUTER_API_KEY", "CHAVE");
  env.db.rsvps = { a: { name: "Rita", attending: "yes", createdAt: 1, allergies: "Glúten" } };
  const r = env.api.tratarMensagem_("quem tem alergias?");
  assert.equal(r, "Vão 2 pessoas. A Rita tem alergia ao glúten.");
  assert.ok(!env.fetches.some((f) => f.method !== "GET"), "nenhuma escrita");
});

await test("IA: erro do OpenRouter não bloqueia (mostra o erro e a ajuda); modelo configurável", () => {
  const env = makeEnv({ gemini: [{ status: 429, error: "Rate limit exceeded: free-models-per-day" }] });
  env.props.set("OPENROUTER_API_KEY", "CHAVE");
  env.props.set("OPENROUTER_MODEL", "outro/modelo:free");
  const r = env.api.tratarMensagem_("como está o dia?");
  assert.match(r, /OpenRouter HTTP 429: Rate limit/);
  assert.match(r, /hora 7 16:00/);
  assert.equal(env.geminiCalls[0].model, "outro/modelo:free");
});

await test("Sem chave da IA, comandos simples funcionam e o resto mostra a ajuda", () => {
  const env = makeEnv();
  assert.match(env.api.tratarMensagem_("põe o golfe às 4"), /Não percebi[\s\S]*hora 7 16:00/);
  assert.match(env.api.tratarMensagem_("visitas"), /Ainda não há visitas/);
});

await test("emails desligar / atualizar", () => {
  const env = makeEnv();
  env.db.settings = { emailjs: { enabled: true, serviceId: "s", templateId: "t", publicKey: "k" } };
  env.api.tratarMensagem_("emails desligar");
  env.api.tratarMensagem_("sim");
  assert.equal(env.db.settings.emailjs.enabled, false);
  assert.equal(env.db.settings.emailjs.serviceId, "s");
  env.api.tratarMensagem_("atualizar");
  env.api.tratarMensagem_("sim");
  assert.match(env.db.meta.version, /^\d+$/);
});

await test("Apagar todas as respostas (convites de teste) pede confirmação", () => {
  const env = makeEnv();
  env.db.rsvps = { a: { name: "Teste 1", attending: "yes", createdAt: 1 }, b: { name: "Teste 2", attending: "no", createdAt: 2 } };
  const r = env.api.tratarMensagem_("Apaga todos os convites");
  assert.match(r, /Apagar 2 respostas: Teste 1, Teste 2[\s\S]*Confirmas/);
  assert.equal(Object.keys(env.db.rsvps).length, 2);
  assert.match(env.api.tratarMensagem_("sim"), /Apagadas/);
  assert.deepEqual(env.db.rsvps || {}, {});
});

await test("Apagar e ver um convidado por nome (sem acentos)", () => {
  const env = makeEnv();
  env.db.rsvps = { a: { name: "Inês Rodrigues", attending: "yes", createdAt: 1, allergies: "Glúten" }, b: { name: "Rui", attending: "no", createdAt: 2 } };
  assert.match(env.api.tratarMensagem_("ver ines"), /Inês Rodrigues — VAI[\s\S]*Alergias: Glúten/);
  env.api.tratarMensagem_("apagar a resposta da ines");
  env.api.tratarMensagem_("sim");
  assert.deepEqual(Object.keys(env.db.rsvps), ["b"]);
  assert.match(env.api.tratarMensagem_("apagar Zé"), /Não encontrei/);
});

await test("IA: várias alterações numa só confirmação (alterar, adicionar, horário)", () => {
  const env = makeEnv({
    gemini: [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          { id: "a", type: "function", function: { name: "alterar_resposta", arguments: '{"nome":"rui","vai":true,"alergias":"marisco"}' } },
          { id: "b", type: "function", function: { name: "adicionar_resposta", arguments: '{"nome":"Ana Costa","vai":true,"sem_cartao":true}' } },
          { id: "c", type: "function", function: { name: "definir_horario", arguments: '{"atividade":"9","inicio":"18h"}' } },
        ],
      },
    ],
  });
  env.props.set("OPENROUTER_API_KEY", "CHAVE");
  env.db.rsvps = { b: { name: "Rui", attending: "no", createdAt: 2, noticesRead: false, noTransportCard: false } };
  const r = env.api.tratarMensagem_("o rui afinal vem e é alérgico a marisco, mete a ana costa a vir sem cartão e o lanche às 6");
  assert.match(r, /1\. Alterar Rui: vai → sim, alergias → marisco[\s\S]*2\. Registar Ana Costa — VAI[\s\S]*3\. 09 Lanche[\s\S]*Confirmas/);
  assert.equal(Object.keys(env.db.rsvps).length, 1, "nada gravado antes do sim");
  env.api.tratarMensagem_("sim");
  assert.equal(env.db.rsvps.b.attending, "yes");
  assert.equal(env.db.rsvps.b.allergies, "marisco");
  assert.equal(env.db.rsvps.b.noticesRead, true);
  const ana = Object.values(env.db.rsvps).find((x) => x.name === "Ana Costa");
  assert.equal(ana.noTransportCard, true);
  assert.equal(ana.eventDate, "2026-11-29");
  assert.equal(typeof ana.createdAt, "number");
  assert.equal(env.db.schedule["09"].start, "18:00");
});

await test("IA: memória da conversa e alterar_dados nunca mexe em admins", () => {
  const env = makeEnv({
    gemini: [
      { role: "assistant", content: "Vai a Rita." },
      { role: "assistant", content: null, tool_calls: [{ id: "x", type: "function", function: { name: "alterar_dados", arguments: '{"caminho":"admins/abc","valor_json":"true"}' } }] },
      { role: "assistant", content: null, tool_calls: [{ id: "y", type: "function", function: { name: "alterar_dados", arguments: '{"caminho":"settings/emailjs/enabled","valor_json":"false"}' } }] },
    ],
  });
  env.props.set("OPENROUTER_API_KEY", "CHAVE");
  env.api.tratarMensagem_("quem vai?");
  assert.match(env.api.tratarMensagem_("torna-me admin"), /só se mudam no painel/);
  const hist = env.geminiCalls[1].messages;
  assert.ok(hist.some((m) => m.role === "user" && m.content === "quem vai?") && hist.some((m) => m.content === "Vai a Rita."), "histórico enviado");
  assert.match(env.api.tratarMensagem_("desliga os emails"), /Gravar em \/settings\/emailjs\/enabled: false[\s\S]*Confirmas/);
  env.api.tratarMensagem_("sim");
  assert.equal(env.db.settings.emailjs.enabled, false);
  assert.equal(env.db.admins, undefined);
});

for (const [m, n, e] of results) console.log(`${m} ${n}${e ? `\n    → ${e}` : ""}`);
const failed = results.filter((r) => r[0] === "✘").length;
console.log(`\nAssistente por email: ${results.length - failed}/${results.length} testes passaram.`);
process.exit(failed ? 1 : 0);
