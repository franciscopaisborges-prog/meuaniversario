/**
 * Testes das regras da Realtime Database contra o emulador.
 * Executar com:  npm run test:rules   (arranca e encerra os emuladores)
 */
import assert from "node:assert/strict";

const PROJECT = "demo-fr-aniversario";
const DB_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const NS = `${PROJECT}-default-rtdb`;
const db = (path, token) =>
  `http://${DB_HOST}/${path}.json?ns=${NS}${token ? `&auth=${encodeURIComponent(token)}` : ""}`;

const SERVER_TS = { ".sv": "timestamp" };
const valid = (extra = {}) => ({
  name: "Maria Silva",
  attending: "yes",
  message: "Até já! Coração ❤ e acentuação: ção, ã, é.",
  createdAt: SERVER_TS,
  eventDate: "2026-11-29",
  noticesRead: true,
  noTransportCard: false,
  ...extra,
});

async function req(method, path, body, token) {
  const res = await fetch(db(path, token), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function owner(method, path, body) {
  const res = await fetch(`http://${DB_HOST}/${path}.json?ns=${NS}`, {
    method,
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.json();
}

async function createUser(email) {
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "palavra-passe-teste", returnSecureToken: true }),
    }
  );
  const data = await res.json();
  assert.ok(data.idToken, `signUp falhou: ${JSON.stringify(data)}`);
  return { uid: data.localId, token: data.idToken };
}

async function signInGoogle(email, verified = true) {
  const idToken = JSON.stringify({ sub: `google-${email}`, email, email_verified: verified });
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestUri: "http://localhost",
        postBody: `id_token=${encodeURIComponent(idToken)}&providerId=google.com`,
        returnSecureToken: true,
        returnIdpCredential: true,
      }),
    }
  );
  const data = await res.json();
  assert.ok(data.idToken, `signInWithIdp falhou: ${JSON.stringify(data)}`);
  return { uid: data.localId, token: data.idToken };
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(["✔", name]);
  } catch (error) {
    results.push(["✘", name, error.message]);
  }
}

// Estado inicial limpo
await owner("PUT", "", null);

const admin = await createUser(`admin-${Date.now()}@teste.local`);
const user = await createUser(`user-${Date.now()}@teste.local`);
await owner("PUT", `admins/${admin.uid}`, true);
const organizer = await signInGoogle("franciscopaisborges@gmail.com");
const otherGoogle = await signInGoogle(`outro-${Date.now()}@gmail.com`);
const unverified = await signInGoogle("franciscopaisborges@gmail.com".replace("@", "+x@"), false);

let createdId;

await test("Anónimo cria resposta válida (push)", async () => {
  const r = await req("POST", "rsvps", valid());
  assert.equal(r.status, 200, JSON.stringify(r.json));
  createdId = r.json.name;
  const stored = await owner("GET", `rsvps/${createdId}`);
  assert.equal(stored.name, "Maria Silva");
  assert.equal(typeof stored.createdAt, "number");
  assert.equal(stored.eventDate, "2026-11-29");
});

await test("Anónimo cria resposta sem mensagem (opcional)", async () => {
  const r = await req("POST", "rsvps", valid({ message: undefined, attending: "no" }));
  assert.equal(r.status, 200, JSON.stringify(r.json));
});

await test("Anónimo cria resposta com cartão em falta e alergias", async () => {
  const r = await req("POST", "rsvps", valid({ noTransportCard: true, allergies: "Frutos secos" }));
  assert.equal(r.status, 200, JSON.stringify(r.json));
});

await test("Quem não vai pode responder sem abrir os avisos", async () => {
  const r = await req("POST", "rsvps", valid({ attending: "no", noticesRead: false }));
  assert.equal(r.status, 200, JSON.stringify(r.json));
});

await test("Anónimo NÃO lê /rsvps", async () => {
  assert.equal((await req("GET", "rsvps")).status, 401);
});
await test("Anónimo NÃO lê uma resposta individual", async () => {
  assert.equal((await req("GET", `rsvps/${createdId}`)).status, 401);
});
await test("Anónimo NÃO lê a raiz da base de dados", async () => {
  assert.equal((await req("GET", "")).status, 401);
});
await test("Anónimo NÃO lê /admins", async () => {
  assert.equal((await req("GET", "admins")).status, 401);
});
await test("Anónimo NÃO altera resposta existente (PUT)", async () => {
  assert.equal((await req("PUT", `rsvps/${createdId}`, valid({ name: "Outro Nome" }))).status, 401);
});
await test("Anónimo NÃO altera um campo existente (PATCH)", async () => {
  assert.equal((await req("PATCH", `rsvps/${createdId}`, { attending: "no" })).status, 401);
});
await test("Anónimo NÃO apaga resposta existente", async () => {
  assert.equal((await req("DELETE", `rsvps/${createdId}`)).status, 401);
});
await test("Anónimo NÃO substitui toda a lista /rsvps", async () => {
  assert.equal((await req("PUT", "rsvps", { x: valid() })).status, 401);
});
await test("Anónimo NÃO escreve em /admins", async () => {
  assert.equal((await req("PUT", `admins/qualquer`, true)).status, 401);
});
await test("Anónimo NÃO escreve fora de /rsvps", async () => {
  assert.equal((await req("PUT", "outra", { a: 1 })).status, 401);
});

const invalidCases = [
  ["sem nome", { name: undefined }],
  ["nome vazio", { name: "" }],
  ["nome com 1 carácter", { name: "A" }],
  ["nome com espaços nas pontas", { name: " Maria " }],
  ["nome > 80", { name: "a".repeat(81) }],
  ["nome não-string", { name: 123 }],
  ["attending inválido", { attending: "talvez" }],
  ["attending booleano", { attending: true }],
  ["mensagem > 500", { message: "x".repeat(501) }],
  ["mensagem vazia", { message: "" }],
  ["createdAt do cliente", { createdAt: 1700000000000 }],
  ["eventDate errada", { eventDate: "2026-11-30" }],
  ["sem eventDate", { eventDate: undefined }],
  ["campo inesperado", { email: "x@y.z" }],
  ["sem avisos lidos", { noticesRead: undefined }],
  ["confirma presença sem avisos lidos (false)", { noticesRead: false }],
  ["avisos não-booleano", { noticesRead: "sim" }],
  ["sem campo do cartão", { noTransportCard: undefined }],
  ["cartão não-booleano", { noTransportCard: "sim" }],
  ["alergias vazias", { allergies: "" }],
  ["alergias > 300", { allergies: "x".repeat(301) }],
];
for (const [label, patch] of invalidCases) {
  await test(`Rejeita resposta inválida: ${label}`, async () => {
    const body = valid(patch);
    Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
    const r = await req("POST", "rsvps", body);
    assert.equal(r.status, 401, `esperado 401, recebido ${r.status}`);
  });
}

await test("Autenticado NÃO-admin NÃO lê /rsvps", async () => {
  assert.equal((await req("GET", "rsvps", undefined, user.token)).status, 401);
});
await test("Autenticado NÃO-admin NÃO lê a lista /admins", async () => {
  assert.equal((await req("GET", "admins", undefined, user.token)).status, 401);
});
await test("Autenticado NÃO-admin lê apenas o próprio /admins/{uid} (null)", async () => {
  const r = await req("GET", `admins/${user.uid}`, undefined, user.token);
  assert.equal(r.status, 200);
  assert.equal(r.json, null);
});
await test("Autenticado NÃO-admin NÃO se promove a admin", async () => {
  assert.equal((await req("PUT", `admins/${user.uid}`, true, user.token)).status, 401);
});
await test("Admin lê /rsvps", async () => {
  const r = await req("GET", "rsvps", undefined, admin.token);
  assert.equal(r.status, 200);
  assert.ok(Object.keys(r.json).length >= 2);
});
await test("Admin lê /admins", async () => {
  const r = await req("GET", "admins", undefined, admin.token);
  assert.equal(r.status, 200);
  assert.equal(r.json[admin.uid], true);
});
await test("Admin lê o próprio /admins/{uid} (true)", async () => {
  const r = await req("GET", `admins/${admin.uid}`, undefined, admin.token);
  assert.equal(r.json, true);
});

await test("Organizador (Google, email verificado) lê /rsvps", async () => {
  const r = await req("GET", "rsvps", undefined, organizer.token);
  assert.equal(r.status, 200);
  assert.ok(Object.keys(r.json).length >= 2);
});
await test("Organizador (Google) lê /admins (verificação de autorização do painel)", async () => {
  assert.equal((await req("GET", "admins", undefined, organizer.token)).status, 200);
});
await test("Organizador NÃO altera respostas existentes", async () => {
  assert.equal((await req("PUT", `rsvps/${createdId}`, valid({ name: "Mudado" }), organizer.token)).status, 401);
});
await test("Outra conta Google NÃO lê /rsvps nem /admins", async () => {
  assert.equal((await req("GET", "rsvps", undefined, otherGoogle.token)).status, 401);
  assert.equal((await req("GET", "admins", undefined, otherGoogle.token)).status, 401);
});
await test("Conta Google com email não verificado NÃO é admin", async () => {
  assert.equal((await req("GET", "rsvps", undefined, unverified.token)).status, 401);
});

/* ---------- Horários (/schedule) ---------- */
const TS = { ".sv": "timestamp" };
await test("Anónimo lê /schedule (público)", async () => {
  assert.equal((await req("GET", "schedule")).status, 200);
});
await test("Anónimo NÃO escreve horários", async () => {
  assert.equal((await req("PUT", "schedule/01", { start: "10:00", updatedAt: TS })).status, 401);
});
await test("Autenticado não-admin NÃO escreve horários", async () => {
  assert.equal((await req("PUT", "schedule/01", { start: "10:00", updatedAt: TS }, otherGoogle.token)).status, 401);
});
await test("Organizador define início e fim", async () => {
  const r = await req("PUT", "schedule/01", { start: "10:00", end: "10:30", updatedAt: TS }, organizer.token);
  assert.equal(r.status, 200, JSON.stringify(r.json));
});
await test("Organizador define só início (fim opcional)", async () => {
  assert.equal((await req("PUT", "schedule/02", { start: "12:30", updatedAt: TS }, organizer.token)).status, 200);
});
await test("Admin por UID também define horários", async () => {
  assert.equal((await req("PUT", "schedule/03", { start: "14:00", end: "15:00", updatedAt: TS }, admin.token)).status, 200);
});
await test("Organizador remove horário (fica sem horário)", async () => {
  assert.equal((await req("DELETE", "schedule/03", undefined, organizer.token)).status, 200);
  assert.equal(await owner("GET", "schedule/03"), null);
});
await test("Anónimo NÃO apaga horários", async () => {
  assert.equal((await req("DELETE", "schedule/01")).status, 401);
});
const badSchedules = [
  ["fim anterior ao início", "04", { start: "15:00", end: "14:00" }],
  ["fim igual ao início", "04", { start: "15:00", end: "15:00" }],
  ["hora inválida 24:00", "04", { start: "24:00" }],
  ["formato sem zero", "04", { start: "9:00" }],
  ["sem início", "04", { end: "10:00" }],
  ["atividade inexistente", "10", { start: "10:00" }],
  ["campo inesperado", "04", { start: "10:00", nota: "x" }],
];
for (const [label, id, body] of badSchedules) {
  await test(`Rejeita horário inválido: ${label}`, async () => {
    const r = await req("PUT", `schedule/${id}`, { ...body, updatedAt: TS }, organizer.token);
    assert.equal(r.status, 401, `esperado 401, recebido ${r.status}`);
  });
}
await test("Rejeita updatedAt definido pelo cliente", async () => {
  assert.equal((await req("PUT", "schedule/05", { start: "10:00", updatedAt: 1 }, organizer.token)).status, 401);
});

/* ---------- Painel fictício (/decoys) ---------- */
await owner("PUT", `decoys/${otherGoogle.uid}`, true);
await test("Conta fictícia lê só a sua entrada em /decoys", async () => {
  const r = await req("GET", `decoys/${otherGoogle.uid}`, undefined, otherGoogle.token);
  assert.equal(r.status, 200);
  assert.equal(r.json, true);
});
await test("Ninguém lista /decoys (nem admin) nem lê a entrada de outra conta", async () => {
  assert.equal((await req("GET", "decoys", undefined, organizer.token)).status, 401);
  assert.equal((await req("GET", `decoys/${otherGoogle.uid}`)).status, 401);
  assert.equal((await req("GET", `decoys/${otherGoogle.uid}`, undefined, user.token)).status, 401);
});
await test("Ninguém escreve /decoys pelo cliente", async () => {
  assert.equal((await req("PUT", `decoys/${user.uid}`, true, user.token)).status, 401);
});
await test("Conta fictícia continua sem ler /rsvps", async () => {
  assert.equal((await req("GET", "rsvps", undefined, otherGoogle.token)).status, 401);
});

/* ---------- Nomes proibidos ---------- */
const H = "a".repeat(64);
const H2 = "b".repeat(64);
await test("Admin adiciona nome proibido (nome + impressão digital)", async () => {
  const r = await req("PATCH", "", { "bannedNames/t1": { term: "Mariana", hash: H, createdAt: { ".sv": "timestamp" } }, [`bannedHashes/${H}`]: true }, organizer.token);
  assert.equal(r.status, 200, JSON.stringify(r.json));
});
await test("Público verifica UMA impressão digital, mas não lista", async () => {
  const one = await req("GET", `bannedHashes/${H}`);
  assert.equal(one.status, 200);
  assert.equal(one.json, true);
  assert.equal((await req("GET", `bannedHashes/${H2}`)).json, null);
  assert.equal((await req("GET", "bannedHashes")).status, 401);
});
await test("Público e não-admins NÃO leem a lista de nomes", async () => {
  assert.equal((await req("GET", "bannedNames")).status, 401);
  assert.equal((await req("GET", "bannedNames", undefined, otherGoogle.token)).status, 401);
  assert.equal((await req("GET", "bannedNames", undefined, organizer.token)).status, 200);
});
await test("Público NÃO escreve nem apaga nomes proibidos", async () => {
  assert.equal((await req("PUT", `bannedHashes/${H2}`, true)).status, 401);
  assert.equal((await req("DELETE", `bannedHashes/${H}`)).status, 401);
  assert.equal((await req("PUT", "bannedNames/x", { term: "x", hash: H2, createdAt: { ".sv": "timestamp" } }, otherGoogle.token)).status, 401);
});
await test("Rejeita impressão digital inválida", async () => {
  assert.equal((await req("PUT", "bannedHashes/naohex", true, organizer.token)).status, 401);
  assert.equal((await req("PUT", `bannedNames/t2`, { term: "x", hash: "zz", createdAt: { ".sv": "timestamp" } }, organizer.token)).status, 401);
});
await test("Admin remove nome proibido", async () => {
  const r = await req("PATCH", "", { "bannedNames/t1": null, [`bannedHashes/${H}`]: null }, organizer.token);
  assert.equal(r.status, 200);
  assert.equal((await req("GET", `bannedHashes/${H}`)).json, null);
});

/* ---------- Mensagem para nomes proibidos ---------- */
await test("Admin define a mensagem; público lê-a mas não a altera", async () => {
  assert.equal((await req("PUT", "settings/bannedMessage", "Mensagem X", organizer.token)).status, 200);
  assert.equal((await req("GET", "settings/bannedMessage")).json, "Mensagem X");
  assert.equal((await req("PUT", "settings/bannedMessage", "hack")).status, 401);
  assert.equal((await req("PUT", "settings/bannedMessage", "hack", otherGoogle.token)).status, 401);
  assert.equal((await req("GET", "settings")).status, 401);
});
await test("Mensagem vazia ou > 300 caracteres é recusada", async () => {
  assert.equal((await req("PUT", "settings/bannedMessage", "", organizer.token)).status, 401);
  assert.equal((await req("PUT", "settings/bannedMessage", "x".repeat(301), organizer.token)).status, 401);
});

/* ---------- Visitas ---------- */
const visit = (extra = {}) => ({ at: { ".sv": "timestamp" }, page: "convite", visitor: "0123456789abcdef", device: "telemovel", ...extra });
await test("Anónimo regista uma visita válida", async () => {
  assert.equal((await req("POST", "visits", visit())).status, 200);
  assert.equal((await req("POST", "visits", visit({ page: "promax", device: "computador" }))).status, 200);
  assert.equal((await req("POST", "visits", visit({ page: "citygames", device: "telemovel" }))).status, 200);
});
for (const [label, extra] of [
  ["página inválida", { page: "admin" }],
  ["visitante inválido", { visitor: "x" }],
  ["dispositivo inválido", { device: "tv" }],
  ["hora do cliente", { at: 1 }],
  ["campo extra", { ip: "1.2.3.4" }],
]) {
  await test(`Rejeita visita inválida: ${label}`, async () => {
    assert.equal((await req("POST", "visits", visit(extra))).status, 401);
  });
}
await test("Só admins leem e apagam visitas", async () => {
  assert.equal((await req("GET", "visits")).status, 401);
  assert.equal((await req("GET", "visits", undefined, otherGoogle.token)).status, 401);
  assert.equal((await req("GET", "visits", undefined, organizer.token)).status, 200);
  assert.equal((await req("DELETE", "visits")).status, 401);
  assert.equal((await req("DELETE", "visits", undefined, otherGoogle.token)).status, 401);
  assert.equal((await req("PUT", "visits", { x: visit() }, organizer.token)).status, 401, "admin só pode apagar, não reescrever");
  assert.equal((await req("DELETE", "visits", undefined, organizer.token)).status, 200);
});

/* ---------- EmailJS ---------- */
const ejs = (extra = {}) => ({ enabled: true, serviceId: "service_abc123", templateId: "template_x9", publicKey: "AbC-123_xyz", ...extra });
await test("Admin guarda configuração EmailJS; público lê, não altera", async () => {
  assert.equal((await req("PUT", "settings/emailjs", ejs(), organizer.token)).status, 200);
  assert.equal((await req("GET", "settings/emailjs")).json.serviceId, "service_abc123");
  assert.equal((await req("PUT", "settings/emailjs", ejs({ serviceId: "service_mau" }))).status, 401);
  assert.equal((await req("PUT", "settings/emailjs", ejs(), otherGoogle.token)).status, 401);
});
await test("Rejeita configuração EmailJS inválida", async () => {
  assert.equal((await req("PUT", "settings/emailjs", ejs({ serviceId: "com espaços" }), organizer.token)).status, 401);
  assert.equal((await req("PUT", "settings/emailjs", ejs({ enabled: "sim" }), organizer.token)).status, 401);
  assert.equal((await req("PUT", "settings/emailjs", ejs({ toEmail: "x@y.z" }), organizer.token)).status, 401);
  assert.equal((await req("PUT", "settings/emailjs", { enabled: true }, organizer.token)).status, 401);
});

/* ---------- Versão (/meta) ---------- */
await test("Anónimo lê /meta/version", async () => {
  assert.equal((await req("GET", "meta/version")).status, 200);
});
await test("Ninguém escreve /meta pelo cliente (nem admin)", async () => {
  assert.equal((await req("PUT", "meta/version", "x")).status, 401);
  assert.equal((await req("PUT", "meta/version", "x", organizer.token)).status, 401);
});

for (const [mark, name, err] of results) console.log(`${mark} ${name}${err ? `\n    → ${err}` : ""}`);
const failed = results.filter((r) => r[0] === "✘").length;
console.log(`\nRegras RTDB: ${results.length - failed}/${results.length} testes passaram.`);
process.exit(failed ? 1 : 0);
