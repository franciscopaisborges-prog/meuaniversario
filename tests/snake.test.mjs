/** Testes da lógica do jogo da cobrinha (sem navegador). */
import assert from "node:assert/strict";
import { SnakeGame } from "../assets/js/admin/snake-logic.js";

const results = [];
const test = (name, fn) => {
  try {
    fn();
    results.push(["✔", name]);
  } catch (e) {
    results.push(["✘", name, e.message]);
  }
};

test("Comer aumenta a pontuação e a cobra cresce", () => {
  const g = new SnakeGame({ size: 10 });
  const head = g.snake[0];
  g.food = { x: head.x + 1, y: head.y };
  g.state = "running";
  assert.equal(g.step(), "eat");
  assert.equal(g.score, 1);
  assert.equal(g.snake.length, 4);
});

test("Bater na parede termina o jogo", () => {
  const g = new SnakeGame({ size: 6 });
  g.food = null;
  g.state = "running";
  let r;
  for (let i = 0; i < 10 && r !== "over"; i += 1) r = g.step();
  assert.equal(r, "over");
});

test("Não é possível inverter o sentido", () => {
  const g = new SnakeGame({ size: 10 });
  g.turn("left"); // sentido atual: direita
  assert.deepEqual(g.queue, []);
});

test("Um jogador perfeito chega aos 50 pontos e ganha", () => {
  const size = 18;
  const g = new SnakeGame({ size, target: 50 });
  // Circuito hamiltoniano: linha 0 para a direita; linhas seguintes em zigue-zague
  // entre as colunas 1 e size-1; a última linha volta à coluna 0, que sobe até ao início.
  const dirAt = (x, y) => {
    if (x === 0) return y === 0 ? "right" : "up";
    if (y === size - 1) return "left";
    if (y % 2 === 0) return x === size - 1 ? "down" : "right";
    return x === 1 ? "down" : "left";
  };
  g.snake = [
    { x: 3, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 0 },
  ];
  g.dir = "right";
  g.food = g.placeFood();
  g.state = "running";
  let r;
  for (let i = 0; i < 200000 && r !== "won" && r !== "over"; i += 1) {
    const h = g.snake[0];
    const d = dirAt(h.x, h.y);
    g.queue = [];
    if (d !== g.dir) g.turn(d);
    r = g.step();
  }
  assert.equal(r, "won", `resultado: ${r}, pontos: ${g.score}`);
  assert.equal(g.score, 50);
  assert.equal(g.step(), "won", "depois de ganhar o jogo não continua");
});

test("Com 49 pontos ainda não ganha", () => {
  const g = new SnakeGame({ size: 10, target: 50 });
  g.score = 48;
  const head = g.snake[0];
  g.food = { x: head.x + 1, y: head.y };
  g.state = "running";
  assert.equal(g.step(), "eat");
  assert.equal(g.score, 49);
  assert.equal(g.state, "running");
});

for (const [m, n, e] of results) console.log(`${m} ${n}${e ? `\n    → ${e}` : ""}`);
const failed = results.filter((r) => r[0] === "✘").length;
console.log(`\nJogo: ${results.length - failed}/${results.length} testes passaram.`);
process.exit(failed ? 1 : 0);
