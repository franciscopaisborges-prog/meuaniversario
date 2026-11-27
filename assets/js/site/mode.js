/**
 * Switch CLASSIC ↔ GAMES (inspirado no interruptor da Apple, em "liquid glass").
 *  - CLASSIC: estilo preto e dourado e o programa principal (9 momentos).
 *  - GAMES: estilo preto e néon e o programa secundário (6 níveis).
 * Não muda de página: só o estilo e o programa. Em CLASSIC o switch "vibra"
 * de vez em quando, para convidar a arrastar. Ao arrastar aparece um comando
 * em estilo chat de jogo: /games_on ou /games_off.
 */
import { renderLists, mountTrailer } from "./games.js";

const KEY = "fr-aniversario:mode";
const root = document.documentElement;

let gamesReady = false;
let chatTimer = 0;
let typeTimer = 0;

export const currentMode = () => (root.dataset.mode === "games" ? "games" : "classic");

function save(mode) {
  try {
    if (mode === "games") localStorage.setItem(KEY, "games");
    else localStorage.removeItem(KEY);
  } catch {
    /* sem armazenamento: o modo vale só nesta visita */
  }
}

/* ------------------------- Chat estilo jogo ------------------------- */

function chatEl() {
  let el = document.getElementById("gameChat");
  if (!el) {
    el = document.createElement("div");
    el.id = "gameChat";
    el.className = "game-chat";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = '<ol class="game-chat__log"></ol><div class="game-chat__input"><span class="game-chat__typed"></span><span class="game-chat__caret">_</span></div>';
    document.body.append(el);
  }
  return el;
}

/** Mostra a linha de comando a ser escrita (durante o arrasto). */
function typeCommand(cmd) {
  const el = chatEl();
  const typed = el.querySelector(".game-chat__typed");
  if (el.dataset.cmd === cmd && el.classList.contains("is-typing")) return;
  clearTimeout(chatTimer);
  clearInterval(typeTimer);
  el.dataset.cmd = cmd;
  el.classList.add("is-open", "is-typing");
  let i = 0;
  typed.textContent = "";
  typeTimer = setInterval(() => {
    i += 1;
    typed.textContent = cmd.slice(0, i);
    if (i >= cmd.length) clearInterval(typeTimer);
  }, 28);
}

/** Envia o comando: fica no histórico com a resposta, e desaparece. */
function sendCommand(cmd, reply, kind) {
  const el = chatEl();
  clearInterval(typeTimer);
  const log = el.querySelector(".game-chat__log");
  const a = document.createElement("li");
  a.textContent = cmd;
  const b = document.createElement("li");
  b.className = `game-chat__reply game-chat__reply--${kind}`;
  b.textContent = reply;
  log.append(a, b);
  while (log.children.length > 6) log.firstElementChild.remove();
  el.querySelector(".game-chat__typed").textContent = "";
  el.classList.remove("is-typing");
  el.classList.add("is-open");
  clearTimeout(chatTimer);
  chatTimer = setTimeout(() => el.classList.remove("is-open"), 4200);
}

function cancelCommand() {
  const el = document.getElementById("gameChat");
  if (!el) return;
  clearInterval(typeTimer);
  el.classList.remove("is-typing");
  el.querySelector(".game-chat__typed").textContent = "";
  if (!el.querySelector(".game-chat__log").children.length) el.classList.remove("is-open");
}

/* ----------------------------- Modo -------------------------------- */

function ensureGames() {
  const box = document.getElementById("gamesProgram");
  if (!box || gamesReady) return;
  gamesReady = true;
  renderLists(box);
  mountTrailer(box.querySelector(".cg-player"), { autoplay: true });
}

function applyMode(mode, { animate = false } = {}) {
  const games = mode === "games";
  if (animate) {
    root.classList.add("mode-anim");
    setTimeout(() => root.classList.remove("mode-anim"), 700);
  }
  if (games) root.dataset.mode = "games";
  else delete root.dataset.mode;
  const classic = document.getElementById("classicProgram");
  const gamesBox = document.getElementById("gamesProgram");
  if (classic) classic.hidden = games;
  if (gamesBox) gamesBox.hidden = !games;
  if (games) ensureGames();
  document.querySelectorAll(".mode-switch").forEach((sw) => {
    sw.setAttribute("aria-checked", String(games));
    sw.style.setProperty("--x", games ? "1" : "0");
    sw.title = games ? "Arrasta para voltar ao modo CLASSIC" : "Arrasta para o modo GAMES";
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = games ? "#000000" : "#060606";
  document.dispatchEvent(new CustomEvent("modechange", { detail: { mode } }));
}

function setMode(mode) {
  const changed = mode !== currentMode();
  applyMode(mode, { animate: changed });
  save(mode);
  if (!changed) return;
  try {
    navigator.vibrate?.(mode === "games" ? [12, 40, 18] : 12);
  } catch {
    /* sem vibração */
  }
  const cmd = mode === "games" ? "/games_on" : "/games_off";
  sendCommand(cmd, mode === "games" ? "Modo GAMES ativado: programa secundário." : "Modo CLASSIC ativado: programa principal.", mode);
}

/* ---------------------------- Switch ------------------------------- */

function initSwitch(sw) {
  let start = null;
  let moved = false;
  let x = currentMode() === "games" ? 1 : 0;

  const half = () => sw.getBoundingClientRect().width / 2;

  sw.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    start = { px: e.clientX, x: currentMode() === "games" ? 1 : 0 };
    moved = false;
    x = start.x;
    sw.setPointerCapture?.(e.pointerId);
  });

  sw.addEventListener("pointermove", (e) => {
    if (!start) return;
    const dx = e.clientX - start.px;
    if (!moved && Math.abs(dx) < 4) return;
    if (!moved) {
      moved = true;
      sw.classList.add("is-dragging");
    }
    x = Math.min(1, Math.max(0, start.x + dx / half()));
    sw.style.setProperty("--x", x.toFixed(3));
    const target = x > 0.5 ? "games" : "classic";
    if (target !== currentMode()) typeCommand(target === "games" ? "/games_on" : "/games_off");
    else cancelCommand();
  });

  const end = () => {
    if (!start) return;
    const wasMoved = moved;
    start = null;
    sw.classList.remove("is-dragging");
    if (wasMoved) {
      const target = x > 0.5 ? "games" : "classic";
      if (target === currentMode()) {
        cancelCommand();
        applyMode(target);
      } else setMode(target);
    }
  };
  sw.addEventListener("pointerup", end);
  sw.addEventListener("pointercancel", () => {
    start = null;
    sw.classList.remove("is-dragging");
    cancelCommand();
    applyMode(currentMode());
  });

  // Clique / teclado (Enter, Espaço). Depois de arrastar, o clique é ignorado.
  sw.addEventListener("click", (e) => {
    if (moved) {
      moved = false;
      e.preventDefault();
      return;
    }
    setMode(currentMode() === "games" ? "classic" : "games");
  });
  sw.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" && currentMode() !== "games") setMode("games");
    if (e.key === "ArrowLeft" && currentMode() !== "classic") setMode("classic");
  });
}

/* Dica "desliza para jogar": só depois de 5 s em CLASSIC sem mexer no switch. */
const HINT_DELAY = 5000;
let hintTimer = 0;

function scheduleHint() {
  const hint = document.getElementById("switchHint");
  if (!hint) return;
  clearTimeout(hintTimer);
  hint.classList.remove("is-visible");
  if (currentMode() !== "classic") return;
  hintTimer = setTimeout(() => {
    if (currentMode() === "classic") hint.classList.add("is-visible");
  }, HINT_DELAY);
}

export function initMode() {
  applyMode(currentMode());
  document.querySelectorAll(".mode-switch").forEach((sw) => {
    initSwitch(sw);
    sw.addEventListener("pointerdown", scheduleHint);
  });
  document.addEventListener("modechange", scheduleHint);
  scheduleHint();
}
