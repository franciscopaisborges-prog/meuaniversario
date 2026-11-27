/**
 * Programa secundário (minigames no Bowling City, Coimbra Shopping).
 * Dados dos níveis e do menu Continente, listas em HTML e a animação
 * ("trailer") em <canvas> com controlos de vídeo. Usado em citygames.html
 * e no modo GAMES do convite (index.html).
 */

const PINK = "#ff2bd6";
const CYAN = "#22f3ff";
const LIME = "#b6ff3b";
const YELLOW = "#ffe14d";
const ORANGE = "#ff8a1f";
const VIOLET = "#9b6bff";

/** Programa, nível a nível (sem horários: a confirmar). */
export const LEVELS = [
  {
    tag: "Nível 1 · Início",
    icon: "📍",
    color: CYAN,
    title: "Encontro no Coimbra Shopping",
    text: "Os 6 jogadores encontram-se à entrada do Coimbra Shopping, na Avenida Dr. Mendes Silva. Hora a confirmar.",
  },
  {
    tag: "Nível 2 · Missão",
    icon: "🛒",
    color: LIME,
    title: "Missão Continente",
    text: "Vamos juntos ao Continente do Coimbra Shopping buscar a comida e a bebida para o dia. Cada um ajuda a encher o carrinho.",
  },
  {
    tag: "Nível 3 · Energia",
    icon: "🍕",
    color: ORANGE,
    title: "Recarregar energia",
    text: "Refeição em grupo com o que comprámos no Continente, para ganhar energia antes dos jogos.",
  },
  {
    tag: "Nível 4 · Jogos",
    icon: "🕹️",
    color: PINK,
    title: "Minigames no Bowling City",
    text: "Minigames na zona de jogos do Bowling City (City Games), no Coimbra Shopping. Em equipa ou uns contra os outros. Não vamos jogar bowling.",
  },
  {
    tag: "Nível 5 · Boss final",
    icon: "🏆",
    color: YELLOW,
    title: "Torneio de minigames",
    text: "Um último desafio de minigames entre todos para decidir quem fica com o recorde do dia.",
  },
  {
    tag: "Nível 6 · Bónus",
    icon: "🎂",
    color: VIOLET,
    title: "Parabéns, Francisco",
    text: "Bolo do Continente, velas e parabéns. Fim de jogo… ou carregar em continuar.",
  },
];

/** Menu com produtos do Continente (lista final a confirmar). */
export const INVENTORY = [
  { emoji: "🍕", name: "Pizzas", desc: "Para aquecer e partilhar." },
  { emoji: "🥪", name: "Sandes e wraps", desc: "Mistas e de frango." },
  { emoji: "🍟", name: "Snacks salgados", desc: "Batatas fritas e pipocas." },
  { emoji: "🍎", name: "Fruta", desc: "Fresca, já lavada." },
  { emoji: "🥤", name: "Sumos e águas", desc: "Também sem açúcar." },
  { emoji: "🍫", name: "Doces", desc: "Bolachas e chocolates." },
  { emoji: "🎂", name: "Bolo de aniversário", desc: "Com velas para soprar." },
];

const DURATION = 30; // segundos
const SCENE = DURATION / LEVELS.length; // 5 s por nível
const W = 960;
const H = 540;

/* ------------------------------- Página ---------------------------------- */

export function renderLists(root = document) {
  const levels = root.querySelector(".cg-levels");
  if (levels) {
    levels.innerHTML = LEVELS.map(
      (l, i) => `
      <li class="cg-level" style="--c:${l.color}">
        <div class="cg-level__icon" aria-hidden="true">${l.icon}</div>
        <div>
          <p class="cg-level__tag">${l.tag}</p>
          <h3>${l.title}</h3>
          <p>${l.text}</p>
          <div class="cg-level__xp" aria-hidden="true">XP <span class="cg-level__bar"><i style="--xp:${Math.round(((i + 1) / LEVELS.length) * 100)}%"></i></span> ${i + 1}/${LEVELS.length}</div>
        </div>
      </li>`
    ).join("");
  }
  const inv = root.querySelector(".cg-inventory");
  if (inv) {
    inv.innerHTML = INVENTORY.map(
      (it, i) => `
      <li class="cg-item">
        <span class="cg-item__slot" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
        <div class="cg-item__emoji" aria-hidden="true">${it.emoji}</div>
        <p class="cg-item__name">${it.name}</p>
        <p class="cg-item__desc">${it.desc}</p>
      </li>`
    ).join("");
  }
  const ch = root.querySelector(".cg-chapters");
  if (ch) {
    ch.innerHTML = LEVELS.map(
      (l, i) => `<li><button class="cg-chapter" type="button" data-chapter="${i}" style="--c:${l.color}"><b>${fmt(i * SCENE)}</b>${l.title}</button></li>`
    ).join("");
  }
}

/* ------------------------------ Desenho ---------------------------------- */

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Pseudoaleatório estável (para confetes/estrelas sem "saltar" ao pausar). */
function rand(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function text(ctx, str, x, y, { size = 32, color = "#fff", align = "center", weight = 800, blur = 18, font = "mono" } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font === "mono" ? 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace' : "Manrope, system-ui, sans-serif"}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  glow(ctx, color, blur);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.shadowBlur = blur / 3;
  ctx.fillStyle = "#fff";
  ctx.globalAlpha = 0.55;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function neonRect(ctx, x, y, w, h, color, { r = 10, lw = 3, blur = 16, fill = null } = {}) {
  ctx.save();
  glow(ctx, color, blur);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}

function background(ctx, t) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  // estrelas
  for (let i = 0; i < 60; i += 1) {
    const a = 0.25 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
    ctx.fillStyle = `rgba(255,255,255,${a * 0.6})`;
    ctx.fillRect(rand(i) * W, rand(i + 99) * H * 0.55, 2, 2);
  }
  // chão em perspetiva
  const horizon = H * 0.62;
  ctx.save();
  glow(ctx, PINK, 8);
  ctx.strokeStyle = "rgba(255,43,214,.55)";
  ctx.lineWidth = 1.5;
  for (let i = -12; i <= 12; i += 1) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 18, horizon);
    ctx.lineTo(W / 2 + i * 150, H);
    ctx.stroke();
  }
  const off = (t * 0.8) % 1;
  for (let k = 0; k < 9; k += 1) {
    const z = (k + off) / 9;
    const y = horizon + (H - horizon) * z * z;
    ctx.globalAlpha = z;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "rgba(34,243,255,.5)";
  ctx.fillRect(0, horizon - 1, W, 2);
}

const PLAYER_COLORS = [CYAN, PINK, LIME, YELLOW, ORANGE, VIOLET];

/** Bonequinho néon. */
function player(ctx, x, y, color, t, { walk = false, s = 1, jump = 0 } = {}) {
  const bob = walk ? Math.abs(Math.sin(t * 10)) * 6 : Math.sin(t * 3) * 2;
  const yy = y - bob - jump;
  ctx.save();
  ctx.translate(x, yy);
  ctx.scale(s, s);
  glow(ctx, color, 14);
  ctx.strokeStyle = color;
  ctx.fillStyle = "#000";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -52, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-13, -38, 26, 30, 7);
  ctx.fill();
  ctx.stroke();
  const leg = walk ? Math.sin(t * 10) * 8 : 0;
  ctx.beginPath();
  ctx.moveTo(-6, -8);
  ctx.lineTo(-6 - leg, 8);
  ctx.moveTo(6, -8);
  ctx.lineTo(6 + leg, 8);
  ctx.stroke();
  ctx.restore();
}

function hud(ctx, t, idx) {
  const lvl = LEVELS[idx];
  text(ctx, lvl.tag.toUpperCase(), 28, 34, { size: 18, color: lvl.color, align: "left", blur: 12 });
  text(ctx, lvl.title.toUpperCase(), 28, 64, { size: 26, color: "#fff", align: "left", blur: 10 });
  const score = Math.floor(t * 333);
  text(ctx, `SCORE ${String(score).padStart(5, "0")}`, W - 28, 34, { size: 18, color: YELLOW, align: "right", blur: 10 });
  // vidas = 6 jogadores
  for (let i = 0; i < 6; i += 1) {
    ctx.save();
    glow(ctx, PINK, 8);
    ctx.fillStyle = PINK;
    ctx.beginPath();
    const x = W - 40 - i * 22;
    ctx.arc(x - 4, 60, 5, Math.PI, 0);
    ctx.arc(x + 4, 60, 5, Math.PI, 0);
    ctx.lineTo(x, 72);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/* --- Cenas (p = progresso 0..1 dentro da cena; t = tempo total) --- */

function sceneMeet(ctx, p, t) {
  // edifício com letreiro
  const on = p > 0.15 || Math.sin(t * 40) > 0.6;
  neonRect(ctx, 300, 130, 360, 200, CYAN, { r: 6, lw: 3, fill: "rgba(34,243,255,.04)" });
  neonRect(ctx, 440, 230, 80, 100, CYAN, { r: 4, lw: 2 });
  if (on) text(ctx, "COIMBRA SHOPPING", W / 2, 170, { size: 30, color: PINK, blur: 22 });
  for (let i = 0; i < 4; i += 1) neonRect(ctx, 320 + i * 80 + (i > 1 ? 80 : 0), 210, 40, 30, "rgba(34,243,255,.6)", { r: 3, lw: 1.5, blur: 6 });
  // jogadores a chegar
  PLAYER_COLORS.forEach((c, i) => {
    const target = 330 + i * 60;
    const x = lerp(-60 - i * 70, target, ease(clamp(p * 1.4 - i * 0.05)));
    player(ctx, x, 420, c, t + i, { walk: p < 0.75 });
  });
  if (p > 0.75) text(ctx, "6 JOGADORES PRONTOS", W / 2, 480, { size: 22, color: LIME, blur: 14 });
}

function sceneShop(ctx, p, t) {
  // prateleiras a passar
  const off = (t * 120) % 240;
  for (let row = 0; row < 3; row += 1) {
    for (let k = -1; k < 6; k += 1) {
      const x = k * 240 - off;
      neonRect(ctx, x + 20, 120 + row * 70, 200, 8, "rgba(182,255,59,.7)", { r: 2, lw: 2, blur: 8 });
      for (let j = 0; j < 5; j += 1) {
        ctx.fillStyle = [PINK, CYAN, YELLOW, ORANGE, LIME][(j + k + row + 10) % 5];
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x + 32 + j * 38, 96 + row * 70, 22, 24);
        ctx.globalAlpha = 1;
      }
    }
  }
  text(ctx, "CONTINENTE", W / 2, 100, { size: 20, color: LIME, blur: 14 });
  // carrinho
  const cx = W / 2 - 70;
  const cy = 360;
  ctx.save();
  glow(ctx, CYAN, 14);
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 40, cy - 40);
  ctx.lineTo(cx, cy - 40);
  ctx.lineTo(cx + 20, cy + 40);
  ctx.lineTo(cx + 140, cy + 40);
  ctx.lineTo(cx + 160, cy - 20);
  ctx.lineTo(cx + 8, cy - 20);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 40, cy + 62, 10, 0, Math.PI * 2);
  ctx.arc(cx + 125, cy + 62, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // itens a cair no carrinho
  const n = INVENTORY.length;
  ctx.save();
  ctx.font = "34px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let inCart = 0;
  for (let i = 0; i < n; i += 1) {
    const start = 0.05 + i * 0.12;
    const q = clamp((p - start) / 0.14);
    if (q <= 0) continue;
    if (q >= 1) inCart += 1;
    const x = cx + 30 + (i % 4) * 30;
    const y = lerp(-30, cy + 10 - Math.floor(i / 4) * 22, q * q);
    ctx.fillText(INVENTORY[i].emoji, x, y);
  }
  ctx.restore();
  text(ctx, `ITENS ${inCart}/${n}`, W / 2 + 200, 360, { size: 26, color: YELLOW, blur: 14 });
  if (inCart === n) text(ctx, "MISSÃO CUMPRIDA", W / 2 + 200, 400, { size: 18, color: LIME, blur: 12 });
}

function sceneEat(ctx, p, t) {
  // mesa
  neonRect(ctx, 200, 300, 560, 20, ORANGE, { r: 8, lw: 3 });
  // pizza a desaparecer fatia a fatia
  const slices = 8;
  const left = Math.ceil(slices * (1 - clamp(p * 1.15)));
  ctx.save();
  glow(ctx, ORANGE, 16);
  for (let i = 0; i < left; i += 1) {
    const a0 = (i / slices) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / slices) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = i % 2 ? "#ffb347" : "#ffa31a";
    ctx.strokeStyle = YELLOW;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, 250);
    ctx.arc(W / 2, 250, 60, a0, a1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e0302e";
    const am = (a0 + a1) / 2;
    ctx.beginPath();
    ctx.arc(W / 2 + Math.cos(am) * 36, 250 + Math.sin(am) * 36, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // bebidas
  [300, 660].forEach((x, k) => neonRect(ctx, x, 252 - k * 4, 26, 46, k ? CYAN : LIME, { r: 5, lw: 2 }));
  PLAYER_COLORS.forEach((c, i) => player(ctx, 250 + i * 92, 420, c, t + i * 0.7, { s: 0.9 }));
  // barra de energia
  const e = clamp(p * 1.1);
  text(ctx, "ENERGIA", 230, 490, { size: 18, color: ORANGE, align: "left", blur: 10 });
  neonRect(ctx, 340, 478, 380, 24, ORANGE, { r: 6, lw: 2, blur: 8 });
  ctx.save();
  glow(ctx, LIME, 14);
  ctx.fillStyle = e > 0.95 ? LIME : ORANGE;
  ctx.fillRect(344, 482, 372 * e, 16);
  ctx.restore();
  if (e > 0.95) text(ctx, "100%", 760, 490, { size: 18, color: LIME, align: "left", blur: 12 });
}

function cabinet(ctx, x, y, color, draw) {
  neonRect(ctx, x, y, 170, 250, color, { r: 12, lw: 3, fill: "rgba(0,0,0,.6)" });
  neonRect(ctx, x + 18, y + 24, 134, 100, color, { r: 6, lw: 2, blur: 8, fill: "#020208" });
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 20, y + 26, 130, 96);
  ctx.clip();
  draw(x + 20, y + 26, 130, 96);
  ctx.restore();
  neonRect(ctx, x + 18, y + 150, 134, 40, color, { r: 6, lw: 2, blur: 8 });
}

function sceneArcade(ctx, p, t) {
  // 1: "pong"
  cabinet(ctx, 130, 150, CYAN, (x, y, w, h) => {
    const bx = x + (Math.abs(((t * 160) % (2 * (w - 10))) - (w - 10))) + 5;
    const by = y + (Math.abs(((t * 110) % (2 * (h - 10))) - (h - 10))) + 5;
    ctx.fillStyle = CYAN;
    ctx.fillRect(x + 6, by - 14, 5, 28);
    ctx.fillRect(x + w - 11, by - 14, 5, 28);
    ctx.fillRect(bx - 4, by - 4, 8, 8);
  });
  // 2: corrida
  cabinet(ctx, 395, 150, PINK, (x, y, w, h) => {
    ctx.strokeStyle = PINK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 10, y);
    ctx.lineTo(x + 10, y + h);
    ctx.moveTo(x + w / 2 + 10, y);
    ctx.lineTo(x + w - 10, y + h);
    ctx.stroke();
    for (let k = 0; k < 5; k += 1) {
      const z = ((k / 5 + t * 1.2) % 1);
      ctx.fillStyle = YELLOW;
      ctx.fillRect(x + w / 2 - 1.5, y + z * h, 3, 6 + z * 10);
    }
    ctx.fillStyle = CYAN;
    ctx.fillRect(x + w / 2 - 12 + Math.sin(t * 3) * 25, y + h - 22, 24, 14);
  });
  // 3: blocos
  cabinet(ctx, 660, 150, LIME, (x, y, w, h) => {
    const cols = 8;
    const cw = w / cols;
    for (let c = 0; c < cols; c += 1) {
      const hgt = 1 + Math.floor(rand(c + 3) * 3);
      for (let r = 0; r < hgt; r += 1) {
        ctx.fillStyle = [LIME, YELLOW, PINK, CYAN][(c + r) % 4];
        ctx.fillRect(x + c * cw + 1, y + h - (r + 1) * cw + 1, cw - 2, cw - 2);
      }
    }
    const fy = y + ((t * 60) % (h - 30));
    ctx.fillStyle = PINK;
    ctx.fillRect(x + 3 * cw + 1, fy, cw * 2 - 2, cw - 2);
  });
  text(ctx, "MINIGAMES · BOWLING CITY", W / 2, 118, { size: 30, color: PINK, blur: 24 });
  PLAYER_COLORS.forEach((c, i) => player(ctx, 190 + (i % 3) * 265 + (i > 2 ? 50 : 0), 470, c, t * 1.4 + i, { s: 0.8, jump: Math.max(0, Math.sin(t * 6 + i)) * 10 }));
  if (Math.sin(t * 8) > 0) text(ctx, "INSERT COIN", W / 2, 432, { size: 16, color: YELLOW, blur: 10 });
}

/** Duelo de minigame (P1 vs P2) antes do placar final. */
function duel(ctx, q, t) {
  const top = 130;
  const bottom = 470;
  neonRect(ctx, 140, top, 680, bottom - top, VIOLET, { r: 14, lw: 3, fill: "rgba(155,107,255,.05)" });
  ctx.save();
  ctx.setLineDash([10, 12]);
  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, top + 10);
  ctx.lineTo(W / 2, bottom - 10);
  ctx.stroke();
  ctx.restore();
  const span = bottom - top - 40;
  const bx = 170 + Math.abs(((t * 420) % 1240) - 620);
  const by = top + 20 + Math.abs(((t * 260) % (2 * span)) - span);
  const p1 = clamp(by - 45, top + 10, bottom - 100);
  const p2 = clamp(by - 45 + Math.sin(t * 5) * 30, top + 10, bottom - 100);
  [[160, p1, CYAN], [785, p2, PINK]].forEach(([x, y, c]) => {
    ctx.save();
    glow(ctx, c, 18);
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 14, 90);
    ctx.restore();
  });
  ctx.save();
  glow(ctx, YELLOW, 22);
  ctx.fillStyle = YELLOW;
  ctx.fillRect(bx - 8, by - 8, 16, 16);
  ctx.restore();
  text(ctx, String(Math.floor(q * 7)), W / 2 - 70, top + 45, { size: 44, color: CYAN });
  text(ctx, String(Math.floor(q * 6)), W / 2 + 70, top + 45, { size: 44, color: PINK });
  text(ctx, "VS", W / 2, 100, { size: 30, color: YELLOW, blur: 20 });
  text(ctx, "P1", 200, 100, { size: 20, color: CYAN });
  text(ctx, "P2", 760, 100, { size: 20, color: PINK });
}

function sceneTournament(ctx, p, t) {
  if (p < 0.5) {
    duel(ctx, p / 0.5, t);
    return;
  }
  const q = ease(clamp((p - 0.5) / 0.4));
  text(ctx, "QUEM FICA COM O RECORDE?", W / 2, 120, { size: 26, color: YELLOW, blur: 18 });
  const finals = [0.82, 0.64, 0.95, 0.71, 0.58, 0.88];
  PLAYER_COLORS.forEach((c, i) => {
    const y = 170 + i * 50;
    const w = 520 * finals[i] * q * (0.85 + 0.15 * Math.abs(Math.sin(t * 4 + i)));
    player(ctx, 210, y + 30, c, t + i, { s: 0.45 });
    ctx.save();
    glow(ctx, c, 14);
    ctx.fillStyle = c;
    ctx.fillRect(250, y + 2, w, 22);
    ctx.restore();
  });
}

function sceneCake(ctx, p, t) {
  // confetes
  for (let i = 0; i < 90; i += 1) {
    const x = rand(i) * W;
    const y = ((rand(i + 50) * H + t * (60 + rand(i + 7) * 90)) % (H + 20)) - 10;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 3 + i);
    ctx.fillStyle = PLAYER_COLORS[i % 6];
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }
  // bolo
  neonRect(ctx, 370, 280, 220, 80, VIOLET, { r: 10, lw: 3, fill: "rgba(155,107,255,.12)" });
  neonRect(ctx, 400, 230, 160, 50, PINK, { r: 8, lw: 3, fill: "rgba(255,43,214,.1)" });
  for (let i = 0; i < 5; i += 1) {
    const x = 420 + i * 30;
    neonRect(ctx, x - 3, 200, 6, 30, CYAN, { r: 2, lw: 2, blur: 6 });
    const f = 1 + Math.sin(t * 20 + i) * 0.2;
    ctx.save();
    glow(ctx, YELLOW, 20);
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.ellipse(x, 190, 5 * f, 9 * f, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const a = clamp(p * 3);
  ctx.save();
  ctx.globalAlpha = a;
  text(ctx, "PARABÉNS", W / 2, 110, { size: 64, color: PINK, blur: 30 });
  text(ctx, "FRANCISCO", W / 2, 420, { size: 52, color: CYAN, blur: 26 });
  ctx.restore();
  if (p > 0.55 && Math.sin(t * 6) > -0.3) text(ctx, "CONTINUAR? ▶ SIM", W / 2, 480, { size: 20, color: LIME, blur: 12 });
}

const SCENES = [sceneMeet, sceneShop, sceneEat, sceneArcade, sceneTournament, sceneCake];

export function drawFrame(ctx, time) {
  const t = ((time % DURATION) + DURATION) % DURATION;
  const idx = Math.min(SCENES.length - 1, Math.floor(t / SCENE));
  const p = (t - idx * SCENE) / SCENE;
  ctx.save();
  background(ctx, t);
  SCENES[idx](ctx, p, t);
  hud(ctx, t, idx);
  // transição: fade a preto nas mudanças de cena
  const edge = Math.min(p, 1 - p) * SCENE;
  if (edge < 0.3) {
    ctx.fillStyle = `rgba(0,0,0,${1 - edge / 0.3})`;
    ctx.fillRect(0, 0, W, H);
  }
  // linhas de varrimento
  ctx.fillStyle = "rgba(0,0,0,.18)";
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  ctx.restore();
  return idx;
}

/* ------------------------------- Leitor ---------------------------------- */

/** Liga o leitor dentro de `root` (figure.cg-player). `autoplay` = começa a tocar. */
export function mountTrailer(root, { autoplay = true } = {}) {
  const canvas = root?.querySelector("canvas");
  if (!canvas || !canvas.getContext || root.dataset.mounted) return;
  root.dataset.mounted = "1";
  const ctx = canvas.getContext("2d");
  const playBtn = root.querySelector(".cg-play");
  const bigPlay = root.querySelector(".cg-bigplay");
  const seek = root.querySelector(".cg-seek");
  const timeOut = root.querySelector(".cg-time");
  const chapters = [...root.querySelectorAll(".cg-chapter")];

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let time = 0;
  let playing = autoplay && !reduce;
  let visible = true;
  let last = null;
  let raf = 0;
  let seeking = false;

  function render() {
    const idx = drawFrame(ctx, time);
    if (!seeking) seek.value = String(Math.round((time / DURATION) * 1000));
    timeOut.textContent = `${fmt(time)} / ${fmt(DURATION)}`;
    chapters.forEach((b, i) => {
      b.classList.toggle("is-active", i === idx);
      if (i === idx) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    canvas.dataset.scene = String(idx);
  }

  function loop(now) {
    raf = 0;
    if (last != null) time = (time + (now - last) / 1000) % DURATION;
    last = now;
    render();
    if (playing && visible) raf = requestAnimationFrame(loop);
  }

  function setPlaying(v) {
    playing = v;
    playBtn.classList.toggle("is-paused", !v);
    playBtn.setAttribute("aria-label", v ? "Pausar" : "Reproduzir");
    bigPlay.hidden = v;
    last = null;
    if (v && visible && !raf) raf = requestAnimationFrame(loop);
    if (!v && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function seekTo(s) {
    time = clamp(s, 0, DURATION - 0.001);
    last = null;
    render();
  }

  playBtn.addEventListener("click", () => setPlaying(!playing));
  bigPlay.addEventListener("click", () => setPlaying(true));
  canvas.addEventListener("click", () => setPlaying(!playing));
  seek.addEventListener("input", () => {
    seeking = true;
    seekTo((Number(seek.value) / 1000) * DURATION);
    seeking = false;
  });
  chapters.forEach((b) => b.addEventListener("click", () => seekTo(Number(b.dataset.chapter) * SCENE + 0.6)));

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible && playing && !raf) {
        last = null;
        raf = requestAnimationFrame(loop);
      }
    }).observe(canvas);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!document.hidden && playing && visible && !raf) {
      last = null;
      raf = requestAnimationFrame(loop);
    }
  });

  render();
  setPlaying(playing);
}

