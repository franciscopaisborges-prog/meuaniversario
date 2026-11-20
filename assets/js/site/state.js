/**
 * Estado partilhado do site público: horários (RTDB) e ordem cronológica.
 * A identidade de cada atividade (`id`) nunca muda; o número apresentado
 * ("01".."09") é a posição na ordem atual.
 */
import { PROGRAM } from "./program.js";
import { sanitizeSchedule, orderProgram, formatSchedule, stepNumber } from "../shared/schedule.js";

export const state = {
  schedule: {},
  order: PROGRAM.slice(),
};

const listeners = new Set();

export function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setSchedule(raw) {
  const next = sanitizeSchedule(raw);
  if (JSON.stringify(next) === JSON.stringify(state.schedule)) return;
  const prevOrder = state.order.map((a) => a.id).join();
  state.schedule = next;
  state.order = orderProgram(PROGRAM, next);
  const orderChanged = prevOrder !== state.order.map((a) => a.id).join();
  listeners.forEach((fn) => fn({ orderChanged }));
}

/** Número de etapa apresentado. */
export const num = (activity) => stepNumber(state.order, activity);
/** Horário formatado ("10:30 – 12:00", "10:30" ou "A confirmar"). */
export const timeOf = (activity) => formatSchedule(state.schedule[activity.id]);
export const hasTime = (activity) => Boolean(state.schedule[activity.id]?.start);
export const total = () => String(state.order.length).padStart(2, "0");
