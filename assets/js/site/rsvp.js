/**
 * Confirmação de presença (RSVP) → Firebase Realtime Database (/rsvps).
 * O sucesso só é mostrado depois de a RTDB confirmar a escrita.
 */
import { $, $$ } from "../shared/dom.js";
import { EVENT } from "./program.js";

const DB_CDN = "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

/**
 * O Firebase é carregado de forma dinâmica: se o CDN estiver inacessível,
 * o resto do site (programa, mapa) continua a funcionar.
 */
async function loadDatabase() {
  const [{ getFirebase }, dbModule] = await Promise.all([import("../shared/firebase.js"), import(DB_CDN)]);
  const { db } = await getFirebase();
  return { db, dbModule };
}

export const LIMITS = { nameMin: 2, nameMax: 80, messageMax: 500, allergiesMax: 300 };
const CONNECT_TIMEOUT_MS = 10000;
const WRITE_TIMEOUT_MS = 15000;

const MESSAGES = {
  yes: {
    title: "Contamos contigo.",
    text: "Presença confirmada! Mal podemos esperar por este dia contigo.",
  },
  no: {
    title: "Resposta recebida.",
    text: "Obrigado por responderes. Teremos pena de não te ter connosco!",
  },
};

class RsvpError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Valida e normaliza os dados do formulário. Exportado para testes. */
export function validateRsvp({ name, attending, message, website, noticesRead, noTransportCard, allergies }) {
  const errors = {};
  const cleanName = String(name ?? "").replace(/\s+/g, " ").trim();
  const cleanMessage = String(message ?? "").replace(/\r\n/g, "\n").trim();
  const cleanAllergies = String(allergies ?? "").replace(/\r\n/g, "\n").trim();

  if (!cleanName) errors.name = "Escreve o teu nome.";
  else if (cleanName.length < LIMITS.nameMin) errors.name = `O nome deve ter pelo menos ${LIMITS.nameMin} caracteres.`;
  else if (cleanName.length > LIMITS.nameMax) errors.name = `O nome pode ter no máximo ${LIMITS.nameMax} caracteres.`;
  else if (!/\p{L}/u.test(cleanName)) errors.name = "O nome deve conter letras.";

  if (attending !== "yes" && attending !== "no") errors.attending = "Escolhe uma resposta.";

  if (cleanMessage.length > LIMITS.messageMax) errors.message = `A mensagem pode ter no máximo ${LIMITS.messageMax} caracteres.`;

  // Os AVISOS só são obrigatórios para quem confirma presença.
  if (attending === "yes" && !noticesRead)
    errors.notices = "Tens de abrir e ler os AVISOS antes de confirmar. Sem isso a presença não é registada.";

  if (cleanAllergies.length > LIMITS.allergiesMax) errors.allergies = `As alergias podem ter no máximo ${LIMITS.allergiesMax} caracteres.`;

  if (website) errors.bot = "Não foi possível validar o envio.";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: {
      name: cleanName,
      attending,
      message: cleanMessage,
      noticesRead: Boolean(noticesRead),
      noTransportCard: attending === "yes" && Boolean(noTransportCard),
      allergies: attending === "yes" ? cleanAllergies : "",
    },
  };
}

function withTimeout(promise, ms, code, message) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new RsvpError(code, message)), ms);
    }),
  ]);
}

/** Espera pela ligação real ao servidor da RTDB (.info/connected). */
function waitForConnection(db, dbModule, ms) {
  return new Promise((resolve, reject) => {
    const connectedRef = dbModule.ref(db, ".info/connected");
    let settled = false;
    let unsubscribe = () => {};
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // o unsubscribe pode ainda não existir se o callback correr de forma síncrona
      queueMicrotask(() => unsubscribe());
      fn(arg);
    };
    const timer = setTimeout(
      () => finish(reject, new RsvpError("offline", "Sem ligação ao servidor.")),
      ms
    );
    unsubscribe = dbModule.onValue(connectedRef, (snap) => {
      if (snap.val() === true) finish(resolve);
    });
  });
}

function friendlyError(error) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "");
  if (code === "not-configured") {
    return "O formulário ainda não está ligado à base de dados (configuração do Firebase em falta). A tua resposta não foi enviada — avisa o organizador.";
  }
  if (/dynamically imported module|importing a module script failed|error loading dynamically/i.test(msg)) {
    return "Não foi possível carregar o serviço de envio (problema de rede). A tua resposta não foi enviada — verifica a ligação e tenta novamente.";
  }
  if (code === "offline") {
    return "Parece que estás sem ligação à internet. A tua resposta não foi enviada — verifica a ligação e tenta novamente.";
  }
  if (code === "timeout") {
    return "A ligação está muito lenta e não recebemos a confirmação de que a resposta foi gravada. Verifica a ligação e tenta novamente.";
  }
  if (/permission[_ ]denied/i.test(code) || /permission[_ ]denied/i.test(msg)) {
    return "O servidor recusou a resposta. Verifica os dados (nome com 2 a 80 caracteres, mensagem até 500) e tenta novamente.";
  }
  if (code === "bot") {
    return "Não foi possível validar o envio. Recarrega a página e tenta novamente.";
  }
  return "Ocorreu um erro inesperado e a resposta não foi enviada. Tenta novamente dentro de instantes.";
}

export function initRsvp() {
  const modal = $("#rsvpModal");
  const form = $("#rsvpForm");
  const nameInput = $("#rsvpName");
  const messageInput = $("#rsvpMessage");
  const counter = $("#rsvpCounter");
  const choiceGroup = $("#rsvpChoice");
  const status = $("#rsvpStatus");
  const submit = $("#rsvpSubmit");
  const formView = $("#rsvpFormView");
  const resultView = $("#rsvpResultView");
  let sending = false;
  let lastOpener = null;
  let noticesRead = false;

  // Avisos: só depois de abertos é que a resposta pode ser registada.
  const notices = $("#rsvpNotices");
  const noticesToggle = $("#noticesToggle");
  const noticesPanel = $("#noticesPanel");
  const noticesError = $("#noticesError");

  function setNoticesError(message) {
    noticesError.textContent = message || "";
    notices.classList.toggle("is-invalid", Boolean(message));
    if (message) {
      // reiniciar a animação de "abanar"
      void noticesToggle.offsetWidth;
    }
  }

  function setNoticesOpen(open) {
    noticesToggle.setAttribute("aria-expanded", String(open));
    noticesPanel.hidden = !open;
  }

  noticesToggle.addEventListener("click", () => {
    const open = noticesToggle.getAttribute("aria-expanded") !== "true";
    setNoticesOpen(open);
    if (open) {
      noticesRead = true;
      setNoticesError("");
    }
  });

  const errorEls = {
    name: $("#rsvpNameError"),
    attending: $("#rsvpChoiceError"),
    message: $("#rsvpMessageError"),
  };

  // Pré-aquecer a ligação ao abrir o modal (não bloqueia nada).
  async function warmUp() {
    try {
      const { db, dbModule } = await loadDatabase();
      waitForConnection(db, dbModule, CONNECT_TIMEOUT_MS).catch(() => {});
    } catch {
      /* o erro será mostrado no envio */
    }
  }

  function open(opener) {
    lastOpener = opener || document.activeElement;
    if (!resultView.hidden) resetForm();
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
    setTimeout(() => nameInput.focus(), 50);
    warmUp();
  }

  function close() {
    if (typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
  }

  modal.addEventListener("close", () => {
    if (lastOpener && document.contains(lastOpener)) lastOpener.focus();
  });
  // Clique fora do conteúdo fecha o modal.
  modal.addEventListener("click", (event) => {
    if (event.target === modal && !sending) close();
  });
  modal.addEventListener("cancel", (event) => {
    if (sending) event.preventDefault();
  });

  $$("[data-open-rsvp]").forEach((btn) => btn.addEventListener("click", () => open(btn)));
  $$("[data-close-rsvp]", modal).forEach((btn) => btn.addEventListener("click", () => !sending && close()));
  $("#rsvpAnother").addEventListener("click", () => {
    resetForm();
    nameInput.focus();
  });

  messageInput.addEventListener("input", () => {
    counter.textContent = `${messageInput.value.length} / ${LIMITS.messageMax}`;
  });
  nameInput.addEventListener("input", () => setFieldError("name", ""));
  form.addEventListener("change", (event) => {
    if (event.target.name === "attending") {
      setFieldError("attending", "");
      if (event.target.value === "no") setNoticesError("");
    }
  });

  function setFieldError(field, message) {
    errorEls[field].textContent = message || "";
    const target = field === "attending" ? choiceGroup : field === "name" ? nameInput : messageInput;
    if (message) target.setAttribute("aria-invalid", "true");
    else target.removeAttribute("aria-invalid");
  }

  function setStatus(message) {
    status.innerHTML = message ? `<div class="alert alert--error">${message}</div>` : "";
  }

  function setSending(value) {
    sending = value;
    submit.disabled = value;
    submit.setAttribute("aria-busy", String(value));
    submit.innerHTML = value
      ? '<span class="spinner" aria-hidden="true"></span><span class="btn__label">A enviar…</span>'
      : '<span class="btn__label">Enviar resposta</span>';
    form.querySelectorAll("input, textarea").forEach((el) => {
      el.readOnly = value;
    });
  }

  function resetForm() {
    form.reset();
    noticesRead = false;
    setNoticesOpen(false);
    setNoticesError("");
    counter.textContent = `0 / ${LIMITS.messageMax}`;
    Object.keys(errorEls).forEach((f) => setFieldError(f, ""));
    setStatus("");
    resultView.hidden = true;
    formView.hidden = false;
  }

  function showResult(attending) {
    const copy = MESSAGES[attending];
    $("#rsvpResultTitle").textContent = copy.title;
    $("#rsvpResultText").textContent = copy.text;
    // Ícone: visto para "sim", arco suave para "não".
    $("#rsvpResultIcon").setAttribute("d", attending === "yes" ? "M30 49l12 12 25-27" : "M32 56c6-8 26-8 32 0");
    formView.hidden = true;
    resultView.hidden = false;
    resultView.focus();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    setStatus("");

    const formData = new FormData(form);
    const { valid, errors, data } = validateRsvp({
      name: formData.get("name"),
      attending: formData.get("attending"),
      message: formData.get("message"),
      website: formData.get("website"),
      noticesRead,
      noTransportCard: formData.get("noTransportCard") === "on",
      allergies: formData.get("allergies"),
    });

    setFieldError("name", errors.name);
    setFieldError("attending", errors.attending);
    setFieldError("message", errors.message);
    setNoticesError(errors.notices || errors.allergies);

    if (!valid) {
      if (errors.bot) setStatus(friendlyError({ code: "bot" }));
      if (errors.name) nameInput.focus();
      else if (errors.attending) choiceGroup.querySelector("input").focus();
      else if (errors.message) messageInput.focus();
      else if (errors.notices) {
        noticesToggle.scrollIntoView({ block: "center", behavior: "smooth" });
        noticesToggle.focus({ preventScroll: true });
      } else if (errors.allergies) $("#rsvpAllergies").focus();
      return;
    }

    setSending(true);
    try {
      if (navigator.onLine === false) throw new RsvpError("offline", "offline");
      const { db, dbModule } = await loadDatabase();
      await waitForConnection(db, dbModule, CONNECT_TIMEOUT_MS);

      const payload = {
        name: data.name,
        attending: data.attending,
        createdAt: dbModule.serverTimestamp(),
        eventDate: EVENT.dateISO,
      };
      if (data.message) payload.message = data.message;
      payload.noticesRead = data.noticesRead;
      payload.noTransportCard = data.noTransportCard;
      if (data.allergies) payload.allergies = data.allergies;

      // push() só resolve quando o servidor confirma a escrita.
      const writeRef = dbModule.push(dbModule.ref(db, "rsvps"));
      await withTimeout(dbModule.set(writeRef, payload), WRITE_TIMEOUT_MS, "timeout", "timeout");

      showResult(data.attending);
    } catch (error) {
      console.error("[RSVP]", error);
      setStatus(friendlyError(error));
    } finally {
      setSending(false);
    }
  });

  return { open, close };
}
