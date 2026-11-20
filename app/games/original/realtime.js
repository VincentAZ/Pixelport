import { racer } from "./road.js";
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function rect(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}
function label(c, text, x, y, color = "#e6dcfa", size = 10) {
  c.fillStyle = color;
  c.font = `bold ${size}px monospace`;
  c.fillText(text, x, y);
}
function snake({ hud, tone, end }, c) {
  const cols = 24,
    rows = 16,
    cell = 12,
    ox = 48,
    oy = 12;
  let body = [
      { x: 10, y: 8 },
      { x: 9, y: 8 },
      { x: 8, y: 8 },
    ],
    dir = [1, 0],
    next = dir,
    food = { x: 16, y: 8 },
    elapsed = 0,
    score = 0;
  function placeFood() {
    const empty = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        if (!body.some((p) => p.x === x && p.y === y)) empty.push({ x, y });
    food = empty[Math.floor(Math.random() * empty.length)];
  }
  hud("Apples  0", "Neon grid");
  return {
    key(k) {
      const d = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }[k];
      if (d && (d[0] !== -dir[0] || d[1] !== -dir[1])) next = d;
    },
    update(dt) {
      elapsed += dt;
      if (elapsed < Math.max(0.071, 0.16 - score * 0.004)) return;
      elapsed = 0;
      dir = next;
      const head = { x: body[0].x + dir[0], y: body[0].y + dir[1] };
      const eat = head.x === food.x && head.y === food.y;
      if (
        head.x < 0 ||
        head.y < 0 ||
        head.x >= cols ||
        head.y >= rows ||
        body
          .slice(0, eat ? body.length : -1)
          .some((p) => p.x === head.x && p.y === head.y)
      ) {
        end("Run complete", score, "apples");
        return;
      }
      body.unshift(head);
      if (!eat) {
        body.pop();
        return;
      }
      score++;
      tone(560);
      hud("Apples  " + score, "Neon grid");
      placeFood();
      if (!food) end("Grid cleared!", score, "apples");
    },
    draw() {
      rect(c, 0, 0, 384, 216, "#0a201e");
      rect(c, ox - 3, oy - 3, cols * cell + 6, rows * cell + 6, "#387448");
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++)
          rect(
            c,
            ox + x * cell,
            oy + y * cell,
            cell,
            cell,
            (x + y) % 2 ? "#16352a" : "#17392c",
          );
      body.forEach(({ x, y }, i) => {
        rect(
          c,
          ox + x * cell + 1,
          oy + y * cell + 1,
          10,
          10,
          i ? "#7dcc39" : "#b4ef55",
        );
        rect(c, ox + x * cell + 2, oy + y * cell + 2, 7, 2, "#c6f677");
      });
      const h = body[0];
      rect(
        c,
        ox + h.x * cell + (dir[0] < 0 ? 2 : 7),
        oy + h.y * cell + (dir[1] > 0 ? 7 : 3),
        2,
        2,
        "#14291b",
      );
      if (food) {
        rect(
          c,
          ox + food.x * cell + 2,
          oy + food.y * cell + 3,
          8,
          8,
          "#fa5e64",
        );
        rect(
          c,
          ox + food.x * cell + 6,
          oy + food.y * cell + 1,
          3,
          2,
          "#96df70",
        );
      }
    },
  };
}
const shapes = [
  [[1, 1, 1, 1]],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
];
const colors = [
  "#71cfd3",
  "#efc459",
  "#a682d9",
  "#668bdc",
  "#e89b51",
  "#89ca76",
  "#e27686",
];
function blocks({ hud, tone, end }, c) {
  const board = Array.from({ length: 20 }, () => Array(10).fill(0));
  let bag = [],
    shape,
    x,
    y,
    kind,
    nextKind,
    lines = 0,
    score = 0,
    fall = 0;
  function take() {
    if (!bag.length) {
      bag = [0, 1, 2, 3, 4, 5, 6];
      for (let i = 6; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }
  function fits(s, px, py) {
    return s.every((r, j) =>
      r.every(
        (v, i) =>
          !v ||
          (px + i >= 0 &&
            px + i < 10 &&
            py + j >= 0 &&
            py + j < 20 &&
            !board[py + j][px + i]),
      ),
    );
  }
  function spawn() {
    kind = nextKind;
    nextKind = take();
    shape = shapes[kind];
    x = Math.floor((10 - shape[0].length) / 2);
    y = 0;
    if (!fits(shape, x, y)) end("Stack complete", score, "points");
  }
  function lock() {
    shape.forEach((r, j) =>
      r.forEach((v, i) => {
        if (v) board[y + j][x + i] = kind + 1;
      }),
    );
    const left = board.filter((row) => row.some((n) => !n)),
      removed = 20 - left.length;
    board.splice(
      0,
      20,
      ...Array.from({ length: removed }, () => Array(10).fill(0)),
      ...left,
    );
    score += 10 + [0, 100, 300, 500, 800][removed];
    lines += removed;
    tone(removed ? 700 : 220);
    hud("Score  " + score, "Lines  " + lines);
    spawn();
    fall = 0;
  }
  function step() {
    if (fits(shape, x, y + 1)) y++;
    else lock();
  }
  function tile(px, py, col) {
    rect(c, px, py, 9, 9, col);
    rect(c, px, py, 9, 1, "#ffffff77");
    rect(c, px, py, 1, 9, "#ffffff55");
    rect(c, px + 1, py + 8, 8, 1, "#11112277");
  }
  nextKind = take();
  spawn();
  hud("Score  0", "Lines  0");
  return {
    key(k) {
      if (k === "ArrowLeft" && fits(shape, x - 1, y)) x--;
      if (k === "ArrowRight" && fits(shape, x + 1, y)) x++;
      if (k === "ArrowUp") {
        const rotated = shape[0].map((_, i) =>
          shape.map((row) => row[i]).reverse(),
        );
        for (const n of [0, -1, 1, -2, 2])
          if (fits(rotated, x + n, y)) {
            shape = rotated;
            x += n;
            break;
          }
      }
      if (k === "ArrowDown") step();
      if (k === " ") {
        while (fits(shape, x, y + 1)) y++;
        lock();
      }
    },
    update(dt) {
      fall += dt;
      if (fall > Math.max(0.12, 0.65 - lines * 0.024)) {
        step();
        fall = 0;
      }
    },
    draw() {
      rect(c, 0, 0, 384, 216, "#232034");
      rect(c, 128, 5, 104, 206, "#54475d");
      for (let j = 0; j < 20; j++)
        for (let i = 0; i < 10; i++) {
          rect(c, 130 + i * 10, 8 + j * 10, 10, 10, "#1b1826");
          rect(c, 130 + i * 10, 8 + j * 10, 1, 1, "#53415a");
          if (board[j][i])
            tile(130 + i * 10, 8 + j * 10, colors[board[j][i] - 1]);
        }
      let ghost = y;
      while (fits(shape, x, ghost + 1)) ghost++;
      shape.forEach((r, j) =>
        r.forEach((v, i) => {
          if (v) {
            rect(c, 130 + (x + i) * 10, 8 + (ghost + j) * 10, 9, 9, "#51445a");
            tile(130 + (x + i) * 10, 8 + (y + j) * 10, colors[kind]);
          }
        }),
      );
      label(c, "NEXT", 248, 29, "#c9b7d4");
      shapes[nextKind].forEach((r, j) =>
        r.forEach((v, i) => {
          if (v) tile(248 + i * 10, 38 + j * 10, colors[nextKind]);
        }),
      );
    },
  };
}
function star({ hud, tone, end, keys }, c) {
  let player = 192,
    shots = [],
    rays = [],
    enemies = [],
    dir = 1,
    wave = 0,
    score = 0,
    lives = 3,
    invincible = 0,
    reload = 0,
    enemyTimer = 1.4;
  function newWave() {
    wave++;
    dir = 1;
    enemies = [];
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 8; x++)
        enemies.push({
          x: 71 + x * 29,
          y: 23 + y * 19,
          color: ["#d98ff2", "#a5a5ed", "#7bd6dc"][y],
        });
  }
  function metrics() {
    hud("Score  " + score, "Wave " + wave + "  ·  Lives " + lives);
  }
  function hit() {
    if (invincible > 0) return;
    lives--;
    tone(100, 0.2);
    invincible = 1.4;
    metrics();
    if (!lives) end("Patrol complete", score, "points");
  }
  newWave();
  metrics();
  return {
    pointer(x) {
      player = clamp(x, 10, 374);
    },
    update(dt) {
      player = clamp(
        player +
          ((keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0)) *
            190 *
            dt,
        10,
        374,
      );
      reload -= dt;
      invincible -= dt;
      enemyTimer -= dt;
      if ((keys.has(" ") || keys.has("pointer")) && reload <= 0) {
        shots.push({ x: player, y: 190 });
        reload = 0.16;
        tone(470, 0.025);
      }
      const speed = 17 + wave * 6 + (24 - enemies.length) * 0.5;
      for (const e of enemies) e.x += dir * speed * dt;
      if (enemies.some((e) => e.x < 11 || e.x > 373)) {
        dir *= -1;
        for (const e of enemies) {
          e.y += 7;
          e.x = clamp(e.x, 11, 373);
        }
      }
      if (enemyTimer < 0) {
        const e = enemies[Math.floor(Math.random() * enemies.length)];
        if (e) rays.push({ x: e.x, y: e.y + 4 });
        enemyTimer = Math.max(0.32, 1.25 - wave * 0.065);
      }
      shots = shots.filter((s) => {
        s.y -= dt * 210;
        const idx = enemies.findIndex(
          (e) => Math.abs(e.x - s.x) < 9 && Math.abs(e.y - s.y) < 7,
        );
        if (idx >= 0) {
          enemies.splice(idx, 1);
          score += 25;
          metrics();
          tone(700, 0.035);
          return false;
        }
        return s.y > 0;
      });
      rays = rays.filter((r) => {
        r.y += (86 + wave * 5) * dt;
        if (Math.abs(r.x - player) < 9 && Math.abs(r.y - 193) < 7) {
          hit();
          return false;
        }
        return r.y < 216;
      });
      if (enemies.some((e) => e.y >= 184)) {
        end("Defense line reached", score, "points");
        return;
      }
      if (!enemies.length) {
        newWave();
        rays = [];
        metrics();
      }
    },
    draw() {
      rect(c, 0, 0, 384, 216, "#15132d");
      for (let i = 0; i < 100; i++)
        rect(
          c,
          (i * 137) % 384,
          (i * i * 13 + 7 * i) % 216,
          i % 7 === 0 ? 2 : 1,
          1,
          i % 3 ? "#5d527f" : "#b7a7d0",
        );
      enemies.forEach((e) => {
        rect(c, e.x - 5, e.y - 4, 10, 8, e.color);
        rect(c, e.x - 9, e.y, 18, 3, e.color);
        rect(c, e.x - 5, e.y + 4, 2, 2, e.color);
        rect(c, e.x + 3, e.y + 4, 2, 2, e.color);
        rect(c, e.x - 3, e.y - 1, 2, 2, "#201b36");
        rect(c, e.x + 2, e.y - 1, 2, 2, "#201b36");
      });
      shots.forEach((s) => rect(c, s.x, s.y, 2, 6, "#a7f5e9"));
      rays.forEach((r) => rect(c, r.x, r.y, 2, 5, "#ff9b73"));
      if (invincible <= 0 || Math.floor(invincible * 10) % 2) {
        rect(c, player - 3, 184, 6, 17, "#e2d8e9");
        rect(c, player - 9, 194, 18, 5, "#a594d4");
        rect(c, player - 2, 190, 4, 5, "#64d3eb");
        rect(c, player - 2, 201, 4, 4, "#f99b53");
      }
    },
  };
}
export function arcade(api) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 216;
  canvas.setAttribute("aria-label", api.game.name + " playfield");
  api.surface.append(canvas);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  let running = false,
    model,
    last = 0;
  const keys = new Set();
  const aliases = {
    a: "ArrowLeft",
    d: "ArrowRight",
    w: "ArrowUp",
    s: "ArrowDown",
  };
  const bestKey = "pixelport.best." + api.game.id;
  function end(title, value, unit) {
    if (!running) return;
    running = false;
    keys.clear();
    const best = Math.max(
      Number(localStorage.getItem(bestKey)) || 0,
      Math.floor(value),
    );
    window.writeGameSave(bestKey, best);
    api.prompt(
      title,
      `${Math.floor(value)} ${unit} · Personal best ${best}`,
      "Play again",
      () => {
        reset();
        running = true;
      },
    );
  }
  function reset() {
    model = { snake, blocks, star, sunset: racer }[api.game.id](
      { ...api, end, keys },
      ctx,
    );
    model.draw();
  }
  reset();
  api.prompt(api.game.name, api.game.help[1], "Start game", () => {
    running = true;
    last = performance.now();
  });
  addEventListener("keydown", (e) => {
    const k = aliases[e.key.toLowerCase()] || e.key;
    if (!running || window.pixelportPaused) return;
    if (["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", " "].includes(k)) {
      e.preventDefault();
      keys.add(k);
      if (
        !e.repeat ||
        (api.game.id === "blocks" && k !== " " && k !== "ArrowUp")
      )
        model.key?.(k);
    }
  });
  addEventListener("keyup", (e) =>
    keys.delete(aliases[e.key.toLowerCase()] || e.key),
  );
  addEventListener("blur", () => keys.clear());
  addEventListener("arcadepause", () => keys.clear());
  let down;
  function point(e) {
    const b = canvas.getBoundingClientRect();
    const scale = Math.min(b.width / 384, b.height / 216);
    return [
      (e.clientX - b.left - (b.width - 384 * scale) / 2) / scale,
      (e.clientY - b.top - (b.height - 216 * scale) / 2) / scale,
    ];
  }
  canvas.onpointerdown = (e) => {
    down = point(e);
    keys.add("pointer");
    model.pointer?.(...down);
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = (e) => {
    if (down) model.pointer?.(...point(e));
  };
  canvas.onpointerup = (e) => {
    keys.delete("pointer");
    if (down) {
      const [x, y] = point(e),
        dx = x - down[0],
        dy = y - down[1];
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 5)
        model.key?.(
          Math.abs(dx) > Math.abs(dy)
            ? dx > 0
              ? "ArrowRight"
              : "ArrowLeft"
            : dy > 0
              ? "ArrowDown"
              : "ArrowUp",
        );
      else if (api.game.id === "blocks") model.key("ArrowUp");
    }
    down = null;
  };
  canvas.onpointercancel = () => {
    down = null;
    keys.delete("pointer");
  };
  function tick(now) {
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (running) {
      model.update(dt);
      model.draw();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
