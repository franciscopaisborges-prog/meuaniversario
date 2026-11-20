/**
 * Horários do programa — partilhado pelo site público e pela administração.
 *
 * Estrutura na Realtime Database:
 *   /schedule/{id}  →  { start: "HH:MM", end?: "HH:MM", updatedAt: <serverTimestamp> }
 *   (sem nó = atividade sem horário definido → "A confirmar")
 */

export const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
export const PENDING_LABEL = "A confirmar";

/** Normaliza o objeto vindo da RTDB, ignorando entradas inválidas. */
export function sanitizeSchedule(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, entry] of Object.entries(raw)) {
    if (!entry || typeof entry.start !== "string" || !TIME_RE.test(entry.start)) continue;
    const clean = { start: entry.start };
    if (typeof entry.end === "string" && TIME_RE.test(entry.end) && entry.end > entry.start) clean.end = entry.end;
    out[id] = clean;
  }
  return out;
}

/** "10:30 – 12:00", "10:30" ou "A confirmar". */
export function formatSchedule(entry) {
  if (!entry || !entry.start) return PENDING_LABEL;
  return entry.end ? `${entry.start} – ${entry.end}` : entry.start;
}

/** Valida o par início/fim introduzido pelo administrador. */
export function validateTimes(start, end) {
  if (!start && !end) return { ok: true, empty: true };
  if (!start) return { ok: false, error: "Indique a hora de início (a hora de fim é opcional)." };
  if (!TIME_RE.test(start)) return { ok: false, error: "Hora de início inválida (formato HH:MM)." };
  if (end && !TIME_RE.test(end)) return { ok: false, error: "Hora de fim inválida (formato HH:MM)." };
  if (end && end <= start) return { ok: false, error: "A hora de fim tem de ser posterior à hora de início." };
  return { ok: true, empty: false };
}

/**
 * Ordem cronológica: as atividades com horário ordenam-se por hora de início
 * (desempate pela ordem prevista) e ocupam as posições das atividades com
 * horário; as atividades sem horário mantêm a sua posição prevista.
 */
export function orderProgram(program, schedule) {
  const timedSlots = [];
  const timed = [];
  program.forEach((activity, index) => {
    if (schedule[activity.id]?.start) {
      timedSlots.push(index);
      timed.push({ activity, index });
    }
  });
  timed.sort((a, b) => schedule[a.activity.id].start.localeCompare(schedule[b.activity.id].start) || a.index - b.index);
  const result = program.slice();
  timedSlots.forEach((slot, i) => {
    result[slot] = timed[i].activity;
  });
  return result;
}

/** Número de etapa apresentado (posição na ordem atual, "01".."09"). */
export function stepNumber(order, activity) {
  return String(order.indexOf(activity) + 1).padStart(2, "0");
}
