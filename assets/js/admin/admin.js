/**
 * Painel de administração.
 * 1) Autenticação Firebase com Google
 * 2) Autorização definida nas regras da RTDB (email do organizador verificado
 *    pelo Google, ou /admins/{uid} === true). O painel confirma-a tentando ler
 *    /admins, que só administradores podem ler.
 * 3) Leitura em tempo real de /rsvps, indicadores, pesquisa, filtro, ordenação e CSV.
 */
import { $, $$, esc, normalize } from "../shared/dom.js";
import { createScheduleAdmin } from "./schedule-admin.js";

const DB_CDN = "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
const EXPECTED_GUESTS = 6;

const views = ["viewLoading", "viewNotConfigured", "viewLoadError", "viewLogin", "viewUnauthorized", "viewDashboard"];

const state = {
  records: [],
  knownIds: new Set(),
  firstLoad: true,
  sort: { key: "createdAt", dir: "desc" },
  query: "",
  filter: "all",
  unsubscribe: null,
  lastUpdated: null,
  decoy: false,
};

// Painel fictício: nenhum botão tem efeito (intercetado antes de qualquer outro handler),
// exceto "Terminar sessão", que abre o jogo da cobrinha, e os controlos do próprio jogo.
for (const type of ["click", "submit", "keydown"]) {
  document.addEventListener(
    type,
    (event) => {
      if (!state.decoy) return;
      if (event.target.closest?.("#snakeDialog")) return;
      if (type === "click" && event.target.closest("#logoutBtn")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openDecoyGame();
        return;
      }
      if (type === "submit" || (type === "click" && event.target.closest("button")) || (type === "keydown" && event.target.closest(".a-tab"))) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
}

/** Jogo da cobrinha: só com 50 pontos a sessão termina. */
async function openDecoyGame() {
  const { openSnake } = await import("./snake.js");
  openSnake({
    onWin: async () => {
      state.decoy = false;
      clearData();
      await fb?.authModule.signOut(fb.auth);
    },
  });
}

let fb = null; // { db, auth, authModule, dbModule }
let scheduleAdmin = null;

/* ---------------- Separadores (Respostas / Horários) ---------------- */
function selectTab(tab) {
  $$(".a-tab").forEach((t) => {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    $(`#${t.getAttribute("aria-controls")}`).hidden = !on;
  });
}

function initTabs() {
  const tabs = $$(".a-tab");
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const next = tabs[(i + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(next);
      next.focus();
    });
  });
}

function show(id) {
  views.forEach((v) => {
    $(`#${v}`).hidden = v !== id;
  });
}

const dateFormat = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFormat = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatDate(ms) {
  return typeof ms === "number" ? dateFormat.format(new Date(ms)) : "—";
}
const statusLabel = (a) => (a === "yes" ? "Confirmado" : a === "no" ? "Não vai" : "—");

/* ---------------- Mensagens de erro ---------------- */
function authErrorMessage(error) {
  const code = error?.code || "";
  switch (code) {
    case "auth/invalid-email":
      return "O email não é válido.";
    case "auth/missing-password":
      return "Introduza a palavra-passe.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
      return "Email ou palavra-passe incorretos.";
    case "auth/too-many-requests":
      return "Demasiadas tentativas. Aguarde alguns minutos e tente novamente.";
    case "auth/network-request-failed":
      return "Sem ligação à internet. Verifique a ligação e tente novamente.";
    case "auth/user-disabled":
      return "Esta conta foi desativada.";
    case "auth/operation-not-allowed":
      return "O início de sessão com Google não está ativo no Firebase Authentication.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "A janela de início de sessão foi fechada antes de terminar.";
    case "auth/unauthorized-domain":
      return "Este domínio não está autorizado no Firebase Authentication (Settings → Authorized domains).";
    case "auth/account-exists-with-different-credential":
      return "Já existe uma conta com este email associada a outro método de início de sessão.";
    default:
      return "Não foi possível iniciar sessão. Tente novamente.";
  }
}

function isPermissionDenied(error) {
  return /permission[_ ]denied/i.test(`${error?.code} ${error?.message}`);
}

/* ---------------- Dados ---------------- */
function snapshotToRecords(snapshot) {
  const list = [];
  snapshot.forEach((child) => {
    const v = child.val() || {};
    list.push({
      id: child.key,
      name: typeof v.name === "string" ? v.name : "",
      attending: v.attending === "yes" || v.attending === "no" ? v.attending : "",
      message: typeof v.message === "string" ? v.message : "",
      createdAt: typeof v.createdAt === "number" ? v.createdAt : null,
    });
  });
  return list;
}

export function computeStats(records) {
  const yes = records.filter((r) => r.attending === "yes").length;
  const no = records.filter((r) => r.attending === "no").length;
  return { total: records.length, yes, no };
}

function visibleRecords() {
  const q = normalize(state.query);
  const { key, dir } = state.sort;
  const factor = dir === "asc" ? 1 : -1;
  return state.records
    .filter((r) => (state.filter === "all" ? true : r.attending === state.filter))
    .filter((r) => (q ? normalize(r.name).includes(q) : true))
    .sort((a, b) => {
      let cmp;
      if (key === "createdAt") cmp = (a.createdAt ?? 0) - (b.createdAt ?? 0);
      else cmp = String(a[key]).localeCompare(String(b[key]), "pt", { sensitivity: "base" });
      if (cmp === 0) cmp = (a.createdAt ?? 0) - (b.createdAt ?? 0);
      return cmp * factor;
    });
}

/* ---------------- Render ---------------- */
function render() {
  const stats = computeStats(state.records);
  $("#statTotal").textContent = stats.total;
  $("#statYes").textContent = stats.yes;
  $("#statNo").textContent = stats.no;
  $("#statYesHint").textContent = `de ${EXPECTED_GUESTS} convidados previstos`;

  const rows = visibleRecords();
  $("#rsvpRows").innerHTML = rows
    .map(
      (r) => `
      <tr class="${!state.firstLoad && !state.knownIds.has(r.id) ? "is-new" : ""}">
        <td class="a-name">${esc(r.name)}</td>
        <td><span class="badge badge--${r.attending === "yes" ? "yes" : "no"}">${esc(statusLabel(r.attending))}</span></td>
        <td class="a-msg">${r.message ? esc(r.message) : '<span class="a-muted">—</span>'}</td>
        <td class="a-date">${esc(formatDate(r.createdAt))}</td>
      </tr>`
    )
    .join("");

  const empty = $("#emptyState");
  if (state.records.length === 0) {
    empty.hidden = false;
    empty.textContent = "Ainda não há respostas.";
  } else if (rows.length === 0) {
    empty.hidden = false;
    empty.textContent = "Nenhuma resposta corresponde à pesquisa ou ao filtro.";
  } else {
    empty.hidden = true;
  }

  $("#tableFoot").textContent = `${rows.length} de ${state.records.length} resposta(s) visíveis${
    state.lastUpdated ? ` · atualizado às ${timeFormat.format(state.lastUpdated)}` : ""
  }`;

  $$("#rsvpTable th[aria-sort]").forEach((th) => {
    const key = th.querySelector("[data-sort]")?.dataset.sort;
    const active = key === state.sort.key;
    th.setAttribute("aria-sort", active ? (state.sort.dir === "asc" ? "ascending" : "descending") : "none");
    th.querySelector(".sort-ind").textContent = active ? (state.sort.dir === "asc" ? "↑" : "↓") : "";
  });

  state.knownIds = new Set(state.records.map((r) => r.id));
  state.firstLoad = false;
}

function setLive(mode, text) {
  const el = $("#liveStatus");
  el.classList.toggle("is-live", mode === "live");
  el.classList.toggle("is-error", mode === "error");
  $("#liveText").textContent = text;
}

function setDataStatus(message) {
  $("#dataStatus").innerHTML = message ? `<div class="alert alert--error">${esc(message)}</div>` : "";
}

/* ---------------- CSV ---------------- */
function csvCell(value) {
  let text = String(value ?? "");
  // Evita injeção de fórmulas ao abrir no Excel/Sheets.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(records) {
  const header = ["Nome", "Estado", "Mensagem", "Data e hora"];
  const lines = [header, ...records.map((r) => [r.name, statusLabel(r.attending), r.message, formatDate(r.createdAt)])];
  // BOM UTF-8 + separador ";" (abre corretamente no Excel em português) + CRLF.
  return "﻿" + lines.map((cols) => cols.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

function exportCsv() {
  const rows = visibleRecords();
  const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(
    now.getHours()
  ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = `respostas-aniversario-FR-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- Ligação em tempo real ---------------- */
/** Remove os dados do ecrã e mostra "sem autorização" (acesso retirado). */
function revokeAccess() {
  const user = fb?.auth?.currentUser;
  clearData();
  $("#unauthPath").textContent = user ? `/admins/${user.uid}: true` : "";
  show("viewUnauthorized");
}

function startListening() {
  stopListening();
  const { db, dbModule } = fb;
  const rsvpsRef = dbModule.ref(db, "rsvps");
  setLive("idle", "A ligar…");
  state.unsubscribe = dbModule.onValue(
    rsvpsRef,
    (snapshot) => {
      state.records = snapshotToRecords(snapshot);
      state.lastUpdated = new Date();
      setDataStatus("");
      setLive("live", "Em tempo real");
      render();
    },
    (error) => {
      console.error("[admin] onValue", error);
      if (isPermissionDenied(error)) {
        // Acesso retirado enquanto o painel estava aberto: apagar os dados do ecrã.
        revokeAccess();
        return;
      }
      setLive("error", "Ligação interrompida");
      setDataStatus(
        isPermissionDenied(error)
          ? "Acesso negado pelas regras da base de dados. Confirme que o seu UID está em /admins e que as regras foram publicadas."
          : "Não foi possível ler as respostas. Verifique a ligação e use “Atualizar”."
      );
    }
  );
}

function stopListening() {
  if (state.unsubscribe) {
    state.unsubscribe();
    state.unsubscribe = null;
  }
}

async function manualRefresh() {
  const btn = $("#refreshBtn");
  btn.disabled = true;
  btn.textContent = "A atualizar…";
  try {
    const { db, dbModule } = fb;
    const snapshot = await dbModule.get(dbModule.ref(db, "rsvps"));
    state.records = snapshotToRecords(snapshot);
    state.lastUpdated = new Date();
    setDataStatus("");
    render();
    if (!state.unsubscribe) startListening();
  } catch (error) {
    console.error("[admin] refresh", error);
    setDataStatus(
      isPermissionDenied(error)
        ? "Acesso negado pelas regras da base de dados."
        : "Não foi possível atualizar. Verifique a ligação à internet."
    );
  } finally {
    btn.disabled = false;
    btn.textContent = "Atualizar";
  }
}

/* ---------------- Painel fictício (contas em /decoys) ----------------
 * Contas listadas em /decoys/{uid} veem um painel de demonstração com dados
 * fictícios. Nada é lido de /rsvps (as regras recusariam) e nenhum botão
 * tem efeito. A lista só pode ser alterada na consola/CLI e cada conta só
 * consegue ler a sua própria entrada.
 */
const DECOY_RECORDS = [
  {
    id: "demo-andre",
    name: "André",
    attending: "yes",
    message: "Conta comigo! Até dia 29.",
    createdAt: Date.UTC(2026, 10, 18, 19, 42),
  },
  {
    id: "demo-maria",
    name: "Maria",
    attending: "yes",
    message: "Lá estarei. Parabéns!",
    createdAt: Date.UTC(2026, 10, 19, 10, 15),
  },
];

async function isDecoy(user) {
  const { db, dbModule } = fb;
  try {
    const snap = await dbModule.get(dbModule.ref(db, `decoys/${user.uid}`));
    return snap.val() === true;
  } catch {
    return false;
  }
}

function showDecoy() {
  state.decoy = true;
  state.records = DECOY_RECORDS.map((r) => ({ ...r }));
  state.lastUpdated = new Date();
  show("viewDashboard");
  setLive("live", "Em tempo real");
  render();
}

function clearData() {
  state.decoy = false;
  stopListening();
  scheduleAdmin?.stop();
  state.records = [];
  state.knownIds = new Set();
  state.firstLoad = true;
  state.lastUpdated = null;
  $("#rsvpRows").innerHTML = "";
  ["#statTotal", "#statYes", "#statNo"].forEach((s) => ($(s).textContent = "0"));
}

/* ---------------- Autorização ---------------- */
async function checkAdmin() {
  // /admins só pode ser lido por administradores (ver firebase-rtdb-rules.json).
  const { db, dbModule } = fb;
  try {
    await dbModule.get(dbModule.ref(db, "admins"));
    return true;
  } catch (error) {
    if (isPermissionDenied(error)) return false;
    throw error;
  }
}

async function onUser(user) {
  clearData();
  if (!user) {
    $("#sessionBox").hidden = true;
    show("viewLogin");
    return;
  }

  $("#sessionBox").hidden = false;
  $("#sessionEmail").textContent = user.email || "";
  show("viewLoading");

  let authorized = false;
  try {
    authorized = await checkAdmin();
  } catch (error) {
    console.error("[admin] checkAdmin", error);
    $("#loadErrorText").textContent = "Não foi possível verificar a autorização. Verifique a ligação e recarregue a página.";
    show("viewLoadError");
    return;
  }

  // Pode ter terminado a sessão entretanto.
  if (fb.auth.currentUser?.uid !== user.uid) return;

  if (!authorized) {
    if (await isDecoy(user)) {
      if (fb.auth.currentUser?.uid !== user.uid) return;
      showDecoy();
      return;
    }
    $("#unauthPath").textContent = `/admins/${user.uid}: true`;
    show("viewUnauthorized");
    return;
  }

  show("viewDashboard");
  render();
  startListening();
  scheduleAdmin.start();
}

/* ---------------- Arranque ---------------- */
async function boot() {
  let firebaseShared;
  try {
    firebaseShared = await import("../shared/firebase.js");
  } catch (error) {
    console.error(error);
    show("viewLoadError");
    return;
  }

  if (!firebaseShared.isFirebaseConfigured()) {
    show("viewNotConfigured");
    return;
  }

  try {
    const [{ db }, { auth, authModule }, dbModule] = await Promise.all([
      firebaseShared.getFirebase(),
      firebaseShared.getFirebaseAuth(),
      import(DB_CDN),
    ]);
    fb = { db, auth, authModule, dbModule };
    // Sessão limitada ao separador: fecha ao fechar o navegador.
    await authModule.setPersistence(auth, authModule.browserSessionPersistence);
  } catch (error) {
    console.error(error);
    show("viewLoadError");
    return;
  }

  const { auth, authModule } = fb;
  scheduleAdmin = createScheduleAdmin(fb);
  initTabs();
  const { watchVersion } = await import("../shared/version-watch.js");
  watchVersion(fb.db, fb.dbModule, { onBeforeReload: clearData });

  $("#loginGoogle").addEventListener("click", async () => {
    const status = $("#loginStatus");
    const button = $("#loginGoogle");
    status.innerHTML = "";
    button.disabled = true;
    const provider = new authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await authModule.signInWithPopup(auth, provider);
    } catch (error) {
      if (error?.code === "auth/popup-blocked") {
        // Navegadores que bloqueiam janelas: usar redirecionamento.
        await authModule.signInWithRedirect(auth, provider);
        return;
      }
      status.innerHTML = `<div class="alert alert--error">${esc(authErrorMessage(error))}</div>`;
    } finally {
      button.disabled = false;
    }
  });

  // Resultado de um eventual signInWithRedirect.
  authModule.getRedirectResult(auth).catch((error) => {
    $("#loginStatus").innerHTML = `<div class="alert alert--error">${esc(authErrorMessage(error))}</div>`;
  });

  $("#logoutBtn").addEventListener("click", async () => {
    clearData();
    await authModule.signOut(auth);
  });

  $("#refreshBtn").addEventListener("click", manualRefresh);
  $("#exportBtn").addEventListener("click", exportCsv);
  $("#searchInput").addEventListener("input", (e) => {
    state.query = e.target.value;
    render();
  });
  $("#filterSelect").addEventListener("change", (e) => {
    state.filter = e.target.value;
    render();
  });
  $$("#rsvpTable [data-sort]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const key = btn.dataset.sort;
      state.sort =
        state.sort.key === key
          ? { key, dir: state.sort.dir === "asc" ? "desc" : "asc" }
          : { key, dir: key === "createdAt" ? "desc" : "asc" };
      render();
    })
  );

  authModule.onAuthStateChanged(auth, (user) => {
    onUser(user);
  });
}

boot();
