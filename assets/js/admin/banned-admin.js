/**
 * Administração dos nomes proibidos.
 * Cada termo é guardado em /bannedNames/{id} = { term, hash, createdAt } e a
 * respetiva impressão digital em /bannedHashes/{hash} = true (gravados juntos).
 */
import { $, esc } from "../shared/dom.js";
import { normalizeTerm, hashTerm } from "../shared/banned.js";

export const DEFAULT_BANNED_MESSAGE =
  "Não foi possível registar a resposta com este nome. Fala diretamente com o organizador.";

export function createBannedAdmin({ db, dbModule }, { onChange } = {}) {
  const list = $("#bannedList");
  const form = $("#bannedForm");
  const input = $("#bannedInput");
  const status = $("#bannedStatus");
  let entries = []; // { id, term, hash, createdAt }
  let unsubscribe = null;
  let unsubscribeMsg = null;

  /* ---- Mensagem personalizada ---- */
  const msgForm = $("#bannedMsgForm");
  const msgInput = $("#bannedMsgInput");
  const msgCounter = $("#bannedMsgCounter");
  const msgStatus = $("#bannedMsgStatus");
  const msgRef = () => dbModule.ref(db, "settings/bannedMessage");
  let msgDirty = false;

  function setMsgStatus(text, kind) {
    msgStatus.textContent = text || "";
    msgStatus.className = `a-banned-status${kind ? ` is-${kind}` : ""}`;
  }
  const updateCounter = () => (msgCounter.textContent = `${msgInput.value.length} / 300`);

  msgInput.addEventListener("input", () => {
    msgDirty = true;
    updateCounter();
    setMsgStatus("");
  });

  async function saveMessage(value) {
    const buttons = msgForm.querySelectorAll("button");
    buttons.forEach((b) => (b.disabled = true));
    try {
      if (value) await dbModule.set(msgRef(), value);
      else await dbModule.remove(msgRef());
      msgDirty = false;
      setMsgStatus(value ? "Mensagem guardada. Já está ativa no site." : "Mensagem reposta para a predefinida.", "ok");
    } catch (error) {
      console.error("[mensagem]", error);
      setMsgStatus(errorText(error), "error");
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  }

  msgForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = msgInput.value.replace(/\s+/g, " ").trim();
    if (!value) {
      setMsgStatus("Escreva uma mensagem (ou use “Repor padrão”).", "error");
      return;
    }
    saveMessage(value === DEFAULT_BANNED_MESSAGE ? "" : value);
  });
  $("#bannedMsgReset").addEventListener("click", () => {
    msgInput.value = DEFAULT_BANNED_MESSAGE;
    updateCounter();
    saveMessage("");
  });

  function setLive(mode, text) {
    const el = $("#bannedLive");
    el.classList.toggle("is-live", mode === "live");
    el.classList.toggle("is-error", mode === "error");
    $("#bannedLiveText").textContent = text;
  }

  function setStatus(text, kind) {
    status.textContent = text || "";
    status.className = `a-banned-status${kind ? ` is-${kind}` : ""}`;
  }

  function render() {
    if (!entries.length) {
      list.innerHTML = '<li class="a-banned-empty" style="border:0;background:none">Nenhum nome proibido.</li>';
      return;
    }
    list.innerHTML = entries
      .slice()
      .sort((a, b) => a.term.localeCompare(b.term, "pt", { sensitivity: "base" }))
      .map(
        (e) => `
        <li data-id="${esc(e.id)}">
          <span class="a-banned__term">${esc(e.term)}</span>
          <button class="a-banned__remove" type="button" data-remove="${esc(e.id)}" aria-label="Remover ${esc(e.term)}">Remover</button>
        </li>`
      )
      .join("");
  }

  /** Conjunto de termos normalizados (para marcar respostas no painel). */
  function normalizedSet() {
    return new Set(entries.map((e) => normalizeTerm(e.term)));
  }

  function errorText(error) {
    return /permission[_ ]denied/i.test(`${error?.code} ${error?.message}`)
      ? "Sem permissão para alterar a lista."
      : "Não foi possível guardar. Verifique a ligação e tente novamente.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const term = input.value.replace(/\s+/g, " ").trim();
    const normalized = normalizeTerm(term);
    if (!normalized) {
      setStatus("Escreva um nome ou palavra.", "error");
      input.focus();
      return;
    }
    if (entries.some((e) => normalizeTerm(e.term) === normalized)) {
      setStatus(`“${term}” já está na lista.`, "error");
      return;
    }
    const button = $("#bannedAdd");
    button.disabled = true;
    input.value = ""; // limpar já (repõe-se em caso de erro)
    try {
      const hash = await hashTerm(normalized);
      const id = dbModule.push(dbModule.ref(db, "bannedNames")).key;
      await dbModule.update(dbModule.ref(db), {
        [`bannedNames/${id}`]: { term, hash, createdAt: dbModule.serverTimestamp() },
        [`bannedHashes/${hash}`]: true,
      });
      setStatus(`“${term}” adicionado.`, "ok");
    } catch (error) {
      console.error("[nomes proibidos]", error);
      if (!input.value) input.value = term;
      setStatus(errorText(error), "error");
    } finally {
      button.disabled = false;
    }
  });

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    const entry = entries.find((e) => e.id === button.dataset.remove);
    if (!entry) return;
    button.disabled = true;
    try {
      const updates = { [`bannedNames/${entry.id}`]: null };
      // Só apagar a impressão digital se nenhum outro termo a usar.
      if (!entries.some((e) => e.id !== entry.id && e.hash === entry.hash)) updates[`bannedHashes/${entry.hash}`] = null;
      await dbModule.update(dbModule.ref(db), updates);
      setStatus(`“${entry.term}” removido.`, "ok");
    } catch (error) {
      console.error("[nomes proibidos]", error);
      setStatus(errorText(error), "error");
      button.disabled = false;
    }
  });

  return {
    normalizedSet,
    start() {
      this.stop();
      setLive("idle", "A ligar…");
      unsubscribeMsg = dbModule.onValue(msgRef(), (snap) => {
        if (msgDirty) return; // não apagar o que está a ser escrito
        const v = snap.val();
        msgInput.value = typeof v === "string" && v ? v : DEFAULT_BANNED_MESSAGE;
        updateCounter();
      });
      unsubscribe = dbModule.onValue(
        dbModule.ref(db, "bannedNames"),
        (snapshot) => {
          entries = [];
          snapshot.forEach((child) => {
            const v = child.val() || {};
            if (typeof v.term === "string") entries.push({ id: child.key, term: v.term, hash: v.hash, createdAt: v.createdAt });
          });
          setLive("live", `${entries.length} nome(s) na lista`);
          render();
          onChange?.();
        },
        (error) => {
          console.error("[nomes proibidos] onValue", error);
          setLive("error", "Ligação interrompida");
        }
      );
    },
    stop() {
      if (unsubscribe) unsubscribe();
      if (unsubscribeMsg) unsubscribeMsg();
      unsubscribe = null;
      unsubscribeMsg = null;
      msgDirty = false;
      msgInput.value = "";
      setMsgStatus("");
      entries = [];
      list.innerHTML = "";
      setStatus("");
      onChange?.();
    },
  };
}
