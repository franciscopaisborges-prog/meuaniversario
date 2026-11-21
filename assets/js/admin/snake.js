/**
 * Jogo da cobrinha (preto & dourado) apresentado no painel fictício.
 * Só ao atingir a pontuação-alvo é chamado `onWin` (terminar sessão).
 * Controlos: setas / WASD, deslizar no ecrã ou botões direcionais.
 */
import { SnakeGame } from "./snake-logic.js";

const TARGET = 50;

const ARROW = {
  up: '<path d="M6 14l6-6 6 6" />',
  down: '<path d="M6 10l6 6 6-6" />',
  left: '<path d="M14 6l-6 6 6 6" />',
  right: '<path d="M10 6l6 6-6 6" />',
};

function buildDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "snake";
  dialog.id = "snakeDialog";
  dialog.setAttribute("aria-labelledby", "snakeTitle");
  dialog.innerHTML = `
    <div class="snake__frame">
      <button class="snake__close" type="button" data-snake="close" aria-label="Fechar">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
      <p class="eyebrow snake__eyebrow">Para terminar sessão</p>
      <h2 class="snake__title" id="snakeTitle">Faz <em>${TARGET} pontos</em></h2>
      <div class="snake__hud">
        <span>Pontos <b id="snakeScore">0</b> / ${TARGET}</span>
        <span class="snake__bar" aria-hidden="true"><i id="snakeBar"></i></span>
      </div>
      <div class="snake__stage">
        <canvas id="snakeCanvas" role="img" aria-label="Jogo da cobrinha"></canvas>
        <div class="snake__overlay" id="snakeOverlay">
          <p class="snake__msg" id="snakeMsg">Setas, WASD ou deslizar para jogar.</p>
          <button class="btn btn--solid" type="button" data-snake="start" id="snakeStart">Começar</button>
        </div>
      </div>
      <div class="snake__pad" aria-label="Controlos">
        ${["up", "left", "down", "right"]
          .map(
            (d) =>
              `<button type="button" class="snake__key snake__key--${d}" data-dir="${d}" aria-label="${
                { up: "Cima", down: "Baixo", left: "Esquerda", right: "Direita" }[d]
              }"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ARROW[d]}</svg></button>`
          )
          .join("")}
      </div>
    </div>`;
  document.body.appendChild(dialog);
  return dialog;
}

export function openSnake({ onWin }) {
  const dialog = document.getElementById("snakeDialog") || buildDialog();
  const canvas = dialog.querySelector("#snakeCanvas");
  const ctx = canvas.getContext("2d");
  const overlay = dialog.querySelector("#snakeOverlay");
  const msg = dialog.querySelector("#snakeMsg");
  const startBtn = dialog.querySelector("#snakeStart");
  const scoreEl = dialog.querySelector("#snakeScore");
  const bar = dialog.querySelector("#snakeBar");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const game = new SnakeGame({ size: 18, target: TARGET });
  let timer = null;
  let raf = null;
  let cell = 20;

  function resize() {
    const px = Math.min(420, Math.floor(dialog.querySelector(".snake__stage").clientWidth));
    const dpr = window.devicePixelRatio || 1;
    cell = px / game.size;
    canvas.style.width = `${px}px`;
    canvas.style.height = `${px}px`;
    canvas.width = Math.round(px * dpr);
    canvas.height = Math.round(px * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw(t = 0) {
    const s = cell * game.size;
    ctx.fillStyle = "#070707";
    ctx.fillRect(0, 0, s, s);
    // grelha muito subtil
    ctx.strokeStyle = "rgba(201,169,97,0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i < game.size; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * cell + 0.5, 0);
      ctx.lineTo(i * cell + 0.5, s);
      ctx.moveTo(0, i * cell + 0.5);
      ctx.lineTo(s, i * cell + 0.5);
      ctx.stroke();
    }
    // comida: anel dourado a pulsar
    if (game.food) {
      const pulse = reduced ? 0 : Math.sin(t / 220) * 0.08;
      const cx = (game.food.x + 0.5) * cell;
      const cy = (game.food.y + 0.5) * cell;
      ctx.strokeStyle = "#e8d39c";
      ctx.lineWidth = Math.max(1.5, cell * 0.1);
      ctx.beginPath();
      ctx.arc(cx, cy, cell * (0.28 + pulse), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#c9a961";
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // cobra: segmentos arredondados em degradê dourado
    const n = game.snake.length;
    game.snake.forEach((p, i) => {
      const k = 1 - i / Math.max(n, 8);
      ctx.fillStyle = i === 0 ? "#f3e3b6" : `rgba(201,169,97,${0.45 + 0.55 * k})`;
      const pad = i === 0 ? cell * 0.08 : cell * 0.14;
      const r = cell * 0.28;
      const x = p.x * cell + pad;
      const y = p.y * cell + pad;
      const w = cell - pad * 2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, w, w, r) : ctx.rect(x, y, w, w);
      ctx.fill();
    });
  }

  function animate(t) {
    draw(t);
    raf = requestAnimationFrame(animate);
  }

  function updateHud() {
    scoreEl.textContent = game.score;
    bar.style.width = `${(game.score / TARGET) * 100}%`;
  }

  function showOverlay(text, button) {
    msg.textContent = text;
    startBtn.textContent = button;
    startBtn.hidden = !button;
    overlay.hidden = false;
  }

  function tick() {
    const result = game.step();
    updateHud();
    if (result === "over") {
      stopLoop();
      showOverlay(`Fim de jogo com ${game.score} pontos. Precisas de ${TARGET}.`, "Tentar outra vez");
      startBtn.focus();
      return;
    }
    if (result === "won") {
      stopLoop();
      showOverlay("Conseguiste! A terminar sessão…", "");
      setTimeout(() => {
        close();
        onWin();
      }, 1200);
      return;
    }
    timer = setTimeout(tick, game.interval);
  }

  function startLoop() {
    stopLoop();
    timer = setTimeout(tick, game.interval);
  }

  function stopLoop() {
    clearTimeout(timer);
    timer = null;
  }

  function start() {
    if (game.state === "over" || game.state === "won") game.reset();
    updateHud();
    overlay.hidden = true;
    if (game.state === "ready") game.state = "running";
    startLoop();
    canvas.focus?.();
  }

  function turn(dir) {
    if (game.state === "over" || game.state === "won") return;
    const wasReady = game.state === "ready";
    game.turn(dir);
    if (wasReady && game.state === "running") {
      overlay.hidden = true;
      startLoop();
    }
  }

  function close() {
    stopLoop();
    cancelAnimationFrame(raf);
    dialog.removeEventListener("keydown", onKey);
    dialog.removeEventListener("click", onClick);
    window.removeEventListener("resize", resize);
    if (dialog.open) dialog.close();
  }

  const KEYS = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right",
    W: "up",
    S: "down",
    A: "left",
    D: "right",
  };
  function onKey(event) {
    const dir = KEYS[event.key];
    if (dir) {
      event.preventDefault();
      turn(dir);
    }
  }
  function onClick(event) {
    const el = event.target.closest("[data-dir], [data-snake]");
    if (!el) return;
    if (el.dataset.dir) turn(el.dataset.dir);
    else if (el.dataset.snake === "start") start();
    else if (el.dataset.snake === "close") close();
  }

  // deslizar no ecrã
  let touch = null;
  canvas.ontouchstart = (e) => {
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  canvas.ontouchmove = (e) => e.preventDefault();
  canvas.ontouchend = (e) => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.x;
    const dy = e.changedTouches[0].clientY - touch.y;
    touch = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };

  dialog.addEventListener("keydown", onKey);
  dialog.addEventListener("click", onClick);
  dialog.addEventListener("close", () => close(), { once: true });
  window.addEventListener("resize", resize);

  updateHud();
  showOverlay("Setas, WASD ou deslizar para jogar.", "Começar");
  dialog.showModal();
  resize();
  raf = requestAnimationFrame(animate);
  startBtn.focus();
  return { close, game };
}
