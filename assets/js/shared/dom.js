/** Utilitários DOM partilhados. */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapa texto para inserção segura em HTML. */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Ícone do sprite SVG definido no HTML. */
export function icon(id, size = 16) {
  return `<svg width="${size}" height="${size}" aria-hidden="true" focusable="false"><use href="#${id}"></use></svg>`;
}

/** Normaliza texto para pesquisa (minúsculas, sem acentos). */
export function normalize(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
