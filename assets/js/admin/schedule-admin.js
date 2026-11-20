/**
 * Administração dos horários do programa (/schedule na Realtime Database).
 * Cada atividade tem hora de início (obrigatória para ter horário) e hora de
 * fim (opcional). Sem horário → o site mostra "A confirmar".
 */
import { PROGRAM } from "../site/program.js";
import { $, esc } from "../shared/dom.js";
import { sanitizeSchedule, orderProgram, formatSchedule, validateTimes, stepNumber } from "../shared/schedule.js";

export function createScheduleAdmin({ db, dbModule }) {
  const list = $("#scheduleList");
  let schedule = {};
  let unsubscribe = null;
  const dirty = new Set();
  const messages = new Map(); // id → { text, kind }

  function setLive(mode, text) {
    const el = $("#scheduleLive");
    el.classList.toggle("is-live", mode === "live");
    el.classList.toggle("is-error", mode === "error");
    $("#scheduleLiveText").textContent = text;
  }

  function render() {
    // Preservar o que está a ser editado e o foco.
    const pending = {};
    list.querySelectorAll(".a-srow").forEach((row) => {
      if (dirty.has(row.dataset.id)) {
        pending[row.dataset.id] = { start: row.querySelector('[name="start"]').value, end: row.querySelector('[name="end"]').value };
      }
    });
    const active = document.activeElement;
    const focusKey = active && list.contains(active) ? `${active.closest(".a-srow")?.dataset.id}|${active.name || active.dataset.action}` : null;

    const order = orderProgram(PROGRAM, schedule);
    list.innerHTML = order
      .map((a) => {
        const saved = schedule[a.id] || {};
        const values = pending[a.id] || { start: saved.start || "", end: saved.end || "" };
        const msg = messages.get(a.id);
        return `
        <li class="a-srow${dirty.has(a.id) ? " is-dirty" : ""}" data-id="${esc(a.id)}">
          <span class="a-srow__num" aria-hidden="true">${esc(stepNumber(order, a))}</span>
          <div>
            <p class="a-srow__title">${esc(a.title)}</p>
            <p class="a-srow__meta">${esc(a.kicker)} · No site: <span class="a-srow__current">${esc(formatSchedule(schedule[a.id]))}</span></p>
          </div>
          <form class="a-srow__form" novalidate aria-label="Horário de ${esc(a.title)}">
            <div class="field">
              <label class="field__label" for="s-${esc(a.id)}-start">Início</label>
              <input class="input" type="time" id="s-${esc(a.id)}-start" name="start" value="${esc(values.start)}" />
            </div>
            <div class="field">
              <label class="field__label" for="s-${esc(a.id)}-end">Fim <span class="a-muted" style="letter-spacing:0;text-transform:none">(opcional)</span></label>
              <input class="input" type="time" id="s-${esc(a.id)}-end" name="end" value="${esc(values.end)}" />
            </div>
            <div class="a-srow__actions">
              <button class="btn btn--solid btn--sm" type="submit" data-action="save">Guardar</button>
              <button class="btn btn--ghost btn--sm" type="button" data-action="clear" ${schedule[a.id] ? "" : "disabled"}>Remover</button>
            </div>
          </form>
          <p class="a-srow__msg${msg ? ` is-${msg.kind}` : ""}" role="status">${msg ? esc(msg.text) : ""}</p>
        </li>`;
      })
      .join("");

    if (focusKey) {
      const [id, key] = focusKey.split("|");
      const row = list.querySelector(`.a-srow[data-id="${id}"]`);
      row?.querySelector(`[name="${key}"], [data-action="${key}"]`)?.focus();
    }
  }

  function flash(id, text, kind) {
    messages.set(id, { text, kind });
    const row = list.querySelector(`.a-srow[data-id="${id}"] .a-srow__msg`);
    if (row) {
      row.textContent = text;
      row.className = `a-srow__msg is-${kind}`;
    }
    if (kind === "ok") {
      setTimeout(() => {
        if (messages.get(id)?.text === text) {
          messages.delete(id);
          const el = list.querySelector(`.a-srow[data-id="${id}"] .a-srow__msg`);
          if (el) el.textContent = "";
        }
      }, 4000);
    }
  }

  function errorText(error) {
    return /permission[_ ]denied/i.test(`${error?.code} ${error?.message}`)
      ? "Sem permissão para alterar horários (confirme que a conta é administradora)."
      : "Não foi possível guardar. Verifique a ligação e tente novamente.";
  }

  async function save(id, start, end, buttons) {
    const check = validateTimes(start, end);
    if (!check.ok) {
      flash(id, check.error, "error");
      return;
    }
    buttons.forEach((b) => (b.disabled = true));
    try {
      const target = dbModule.ref(db, `schedule/${id}`);
      if (check.empty) {
        await dbModule.remove(target);
      } else {
        const value = { start, updatedAt: dbModule.serverTimestamp() };
        if (end) value.end = end;
        await dbModule.set(target, value);
      }
      dirty.delete(id);
      flash(id, check.empty ? "Horário removido — o site mostra “A confirmar”." : "Guardado. Já está visível no site.", "ok");
      render();
    } catch (error) {
      console.error("[horários]", error);
      flash(id, errorText(error), "error");
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  }

  list.addEventListener("input", (event) => {
    const row = event.target.closest(".a-srow");
    if (!row) return;
    dirty.add(row.dataset.id);
    row.classList.add("is-dirty");
    messages.delete(row.dataset.id);
    row.querySelector(".a-srow__msg").textContent = "";
  });

  list.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const row = form.closest(".a-srow");
    save(row.dataset.id, form.start.value, form.end.value, [...form.querySelectorAll("button")]);
  });

  list.addEventListener("click", (event) => {
    const btn = event.target.closest('[data-action="clear"]');
    if (!btn) return;
    const form = btn.closest("form");
    form.start.value = "";
    form.end.value = "";
    save(btn.closest(".a-srow").dataset.id, "", "", [...form.querySelectorAll("button")]);
  });

  return {
    start() {
      this.stop();
      setLive("idle", "A ligar…");
      unsubscribe = dbModule.onValue(
        dbModule.ref(db, "schedule"),
        (snapshot) => {
          schedule = sanitizeSchedule(snapshot.val());
          setLive("live", "Sincronizado com o site");
          render();
        },
        (error) => {
          console.error("[horários] onValue", error);
          setLive("error", "Ligação interrompida");
        }
      );
      render();
    },
    stop() {
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      schedule = {};
      dirty.clear();
      messages.clear();
      list.innerHTML = "";
    },
  };
}
