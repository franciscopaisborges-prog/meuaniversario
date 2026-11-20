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

for (const [mark, name, err] of results) console.log(`${mark} ${name}${err ? `\n    → ${err}` : ""}`);
const failed = results.filter((r) => r[0] === "✘").length;
console.log(`\nRegras RTDB: ${results.length - failed}/${results.length} testes passaram.`);
process.exit(failed ? 1 : 0);
