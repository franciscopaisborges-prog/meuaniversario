/**
 * Lógica pura do jogo da cobrinha (sem DOM), para poder ser testada.
 */
export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

export class SnakeGame {
  constructor({ size = 18, target = 50, rng = Math.random } = {}) {
    this.size = size;
    this.target = target;
    this.rng = rng;
    this.reset();
  }

  reset() {
    const mid = Math.floor(this.size / 2);
    this.snake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    this.dir = "right";
    this.queue = [];
    this.score = 0;
    this.state = "ready"; // ready | running | over | won
    this.food = this.placeFood();
  }

  placeFood() {
    const free = [];
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (!this.snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    return free[Math.floor(this.rng() * free.length)] || null;
  }

  /** Guarda a mudança de direção (no máximo 2 em fila, sem inversões). */
  turn(dir) {
    if (!DIRS[dir]) return;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (dir === last || dir === OPPOSITE[last] || this.queue.length >= 2) return;
    this.queue.push(dir);
    if (this.state === "ready") this.state = "running";
  }

  /** Avança uma casa. Devolve "move" | "eat" | "over" | "won". */
  step() {
    if (this.state !== "running") return this.state;
    if (this.queue.length) this.dir = this.queue.shift();
    const d = DIRS[this.dir];
    const head = { x: this.snake[0].x + d.x, y: this.snake[0].y + d.y };
    const eating = this.food && head.x === this.food.x && head.y === this.food.y;
    const body = eating ? this.snake : this.snake.slice(0, -1);
    const hitWall = head.x < 0 || head.y < 0 || head.x >= this.size || head.y >= this.size;
    const hitSelf = body.some((s) => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) {
      this.state = "over";
      return "over";
    }
    this.snake.unshift(head);
    if (!eating) {
      this.snake.pop();
      return "move";
    }
    this.score += 1;
    if (this.score >= this.target) {
      this.state = "won";
      return "won";
    }
    this.food = this.placeFood();
    return "eat";
  }

  /** Intervalo entre passos (ms): acelera ligeiramente com a pontuação. */
  get interval() {
    return Math.max(70, 150 - this.score * 1.6);
  }
}
