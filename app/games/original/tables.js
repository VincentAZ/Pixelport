import {
  solitaire,
  twentyOne,
  validSolitaire,
  validBlackjack,
} from "./cards.js";

const directions = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
];
export function shuffled(array) {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
// Only time spent in the active game counts toward a pending turn.
function afterPlayDelay(callback, remaining) {
  let timer = null,
    started;
  function sync() {
    if (window.pixelportPaused) {
      if (timer !== null) {
        clearTimeout(timer);
        remaining = Math.max(0, remaining - (performance.now() - started));
        timer = null;
      }
    } else if (timer === null) {
      started = performance.now();
      timer = setTimeout(() => {
        window.removeEventListener("arcadepause", sync);
        callback();
      }, remaining);
    }
  }
  window.addEventListener("arcadepause", sync);
  sync();
}
const natural = (n) => Number.isSafeInteger(n) && n >= 0;
const memorySymbols = ["✿", "☼", "♧", "❖", "✦", "☘", "❀", "☾"];
function validMemory(state) {
  const { deck, matched, moves, open = [] } = state;
  if (
    !Array.isArray(deck) ||
    deck.length !== 16 ||
    !natural(moves) ||
    !Array.isArray(matched) ||
    !Array.isArray(open) ||
    open.length > 2
  )
    return false;
  const revealed = [...matched, ...open];
  return (
    revealed.every((i) => natural(i) && i < 16) &&
    new Set(revealed).size === revealed.length &&
    memorySymbols.every(
      (s) =>
        deck.filter((v) => v === s).length === 2 &&
        matched.filter((i) => deck[i] === s).length % 2 === 0,
    )
  );
}
function validSave(id, state) {
  if (!state || typeof state !== "object") return false;
  if (id === "cards") return validSolitaire(state.state);
  if (id === "blackjack") return validBlackjack(state);
  if (id === "pairs") return validMemory(state);
  const board = state.board;
  if (!Array.isArray(board)) return false;
  if (id === "merge")
    return (
      board.length === 16 &&
      board.some(Boolean) &&
      natural(state.score) &&
      board.every(
        (n) =>
          natural(n) && (n === 0 || (n >= 2 && Number.isInteger(Math.log2(n)))),
      )
    );
  return (
    board.length === (id === "four" ? 42 : 64) &&
    [1, 2].includes(state.turn) &&
    board.every((cell) => [0, 1, 2].includes(cell)) &&
    (id !== "reversi" || board.filter(Boolean).length >= 4)
  );
}
export function tables(api) {
  const id = api.game.id,
    table = document.createElement("div");
  table.className = "table-game " + id;
  api.surface.append(table);
  // Keep keyboard players at the same control when a turn redraws the table.
  let lastControl;
  table.addEventListener("focusin", ({ target }) => {
    lastControl = target.matches("button:focus-visible") ? target : null;
  });
  new MutationObserver(() => {
    if (
      !lastControl ||
      lastControl.isConnected ||
      !document.hasFocus() ||
      document.activeElement !== document.body ||
      api.surface.inert
    )
      return;
    const choices = [
      ...table.querySelectorAll('button:enabled:not([tabindex="-1"])'),
    ];
    const label = lastControl.getAttribute("aria-label");
    const match = choices.find((b) => {
      if (lastControl.dataset.column)
        return b.dataset.column === lastControl.dataset.column;
      return label
        ? b.getAttribute("aria-label") === label
        : b.textContent === lastControl.textContent;
    });
    (match || choices[0])?.focus({ preventScroll: true });
  }).observe(table, { childList: true });
  const slot = "pixelport.table." + id;
  let previous;
  try {
    const state = JSON.parse(localStorage.getItem(slot));
    if (validSave(id, state)) previous = state;
  } catch {}
  const save = (state) => window.writeGameSave(slot, JSON.stringify(state));
  function grid(cols, rows, renderCell) {
    const board = document.createElement("div");
    board.className = "board";
    board.style.gridTemplateColumns = `repeat(${cols},1fr)`;
    board.style.width = `min(${cols * 56}px,calc((100vh - 125px) * ${cols / rows}),92vw)`;
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) board.append(renderCell(col, row));
    table.append(board);
    return board;
  }
  function message(text) {
    const p = document.createElement("p");
    p.className = "turn";
    p.textContent = text;
    table.append(p);
  }
  function button(label, fn, className = "action") {
    const b = document.createElement("button");
    b.className = className;
    b.textContent = label;
    b.onclick = fn;
    return b;
  }
  function finish(title, description) {
    localStorage.removeItem(slot);
    api.prompt(title, description, "Play again", () => location.reload());
  }
  const ctx = { ...api, table, grid, message, button, finish, save, previous };
  ({
    four: connect,
    reversi,
    pairs: memory,
    merge,
    blackjack: twentyOne,
    cards: solitaire,
  })[id](ctx);
}
function connect({ table, grid, message, hud, tone, finish, save, previous }) {
  const w = 7,
    h = 6;
  let board = previous?.board || Array(w * h).fill(0),
    turn = previous?.turn || 1,
    ended = false;
  function drop(b, col, player) {
    for (let r = h - 1; r >= 0; r--) {
      if (!b[r * w + col]) {
        b[r * w + col] = player;
        return r;
      }
    }
    return -1;
  }
  function won(b, player) {
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++) {
        if (b[r * w + c] !== player) continue;
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
          [1, 1],
          [-1, 1],
        ]) {
          const endX = c + 3 * dx,
            endY = r + 3 * dy;
          if (endX < 0 || endX >= w || endY >= h) continue;
          if (
            [1, 2, 3].every((n) => b[(r + n * dy) * w + c + n * dx] === player)
          )
            return true;
        }
      }
    return false;
  }
  function potential(b) {
    let value = 0;
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++)
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
          [1, 1],
          [-1, 1],
        ]) {
          if (c + 3 * dx < 0 || c + 3 * dx >= w || r + 3 * dy >= h) continue;
          const line = [0, 1, 2, 3].map(
            (n) => b[(r + n * dy) * w + c + n * dx],
          );
          const us = line.filter((v) => v === 2).length,
            them = line.filter((v) => v === 1).length;
          if (!them) value += [0, 1, 5, 28, 500][us];
          if (!us) value -= [0, 1, 5, 32, 500][them];
        }
    return value;
  }
  const order = [3, 2, 4, 1, 5, 0, 6];
  function search(b, depth, computer, alpha, beta) {
    if (won(b, 2)) return 10000 + depth;
    if (won(b, 1)) return -10000 - depth;
    if (!depth) return potential(b);
    let best = computer ? -Infinity : Infinity;
    for (const col of order) {
      if (b[col]) continue;
      const next = b.slice();
      drop(next, col, computer ? 2 : 1);
      const v = search(next, depth - 1, !computer, alpha, beta);
      best = computer ? Math.max(best, v) : Math.min(best, v);
      if (computer) alpha = Math.max(alpha, best);
      else beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return Number.isFinite(best) ? best : 0;
  }
  function move(col) {
    if (ended || drop(board, col, turn) < 0) return;
    tone(turn === 1 ? 450 : 300);
    const player = turn;
    turn = 3 - turn;
    draw();
    if (won(board, player) || board.every(Boolean)) {
      ended = true;
      finish(
        won(board, player)
          ? player === 1
            ? "Four in a row!"
            : "Computer wins"
          : "Draw",
        "A line of four in any direction wins the board.",
      );
      return;
    }
    save({ board, turn });
    if (turn === 2) afterPlayDelay(bot, 240);
  }
  function bot() {
    if (ended || turn !== 2) return;
    let best = -Infinity,
      pick;
    for (const col of order) {
      if (board[col]) continue;
      const next = board.slice();
      drop(next, col, 2);
      const v = search(next, 3, false, -Infinity, Infinity);
      if (v > best) {
        best = v;
        pick = col;
      }
    }
    move(pick);
  }
  function draw() {
    table.replaceChildren();
    hud("You · Lilac", "Computer · Amber");
    grid(w, h, (c, r) => {
      const b = document.createElement("button");
      const piece = board[r * w + c];
      b.dataset.column = String(c + 1);
      b.setAttribute(
        "aria-label",
        `Column ${c + 1}, row ${r + 1}: ${piece === 1 ? "your disc" : piece === 2 ? "computer disc" : "empty"}. Drop in column ${c + 1}.`,
      );
      b.tabIndex = !piece && (r === h - 1 || board[(r + 1) * w + c]) ? 0 : -1;
      b.disabled = turn !== 1 || !!board[c];
      b.onclick = () => move(c);
      if (piece)
        b.innerHTML =
          '<span class="disc ' + (piece === 1 ? "light" : "dark") + '"></span>';
      return b;
    });
    message(
      turn === 1
        ? "Choose a column to drop your disc."
        : "Computer is choosing a column…",
    );
  }
  draw();
  if (turn === 2) afterPlayDelay(bot, 240);
}
function reversi({ table, grid, message, hud, tone, finish, save, previous }) {
  let board = previous?.board || Array(64).fill(0),
    turn = previous?.turn || 1,
    notice = "",
    ended = false;
  if (!previous) {
    board[27] = board[36] = 2;
    board[28] = board[35] = 1;
  }
  function flips(at, player, b = board) {
    if (b[at]) return [];
    const changed = [];
    for (const [dx, dy] of directions) {
      let x = (at % 8) + dx,
        y = Math.floor(at / 8) + dy;
      const line = [];
      while (
        x >= 0 &&
        x < 8 &&
        y >= 0 &&
        y < 8 &&
        b[y * 8 + x] === 3 - player
      ) {
        line.push(y * 8 + x);
        x += dx;
        y += dy;
      }
      if (x >= 0 && x < 8 && y >= 0 && y < 8 && b[y * 8 + x] === player)
        changed.push(...line);
    }
    return changed;
  }
  const moves = (player, b = board) =>
    b.map((_, i) => i).filter((i) => flips(i, player, b).length);
  function move(i) {
    const change = flips(i, turn);
    if (!change.length || ended) return;
    for (const p of [i, ...change]) board[p] = turn;
    tone(380);
    turn = 3 - turn;
    notice = "";
    if (!moves(turn).length) {
      notice = turn === 1 ? "Your turn was passed. " : "Computer passed. ";
      turn = 3 - turn;
      if (!moves(turn).length) ended = true;
    }
    draw();
    if (ended) {
      const a = board.filter((v) => v === 1).length,
        b = board.filter((v) => v === 2).length;
      finish(
        a === b ? "Draw" : a > b ? "You win!" : "Computer wins",
        `Final count · You ${a}, computer ${b}.`,
      );
      return;
    }
    save({ board, turn });
    if (turn === 2) afterPlayDelay(bot, 300);
  }
  function bot() {
    const choices = moves(2);
    let best = -Infinity,
      pick;
    for (const i of choices) {
      const changed = flips(i, 2),
        next = board.slice();
      for (const j of [i, ...changed]) next[j] = 2;
      const score =
        ([0, 7, 56, 63].includes(i) ? 90 : 0) +
        changed.length -
        moves(1, next).length * 2 -
        ([1, 6, 8, 9, 14, 15, 48, 49, 54, 55, 57, 62].includes(i) ? 12 : 0);
      if (score > best) {
        pick = i;
        best = score;
      }
    }
    if (pick !== undefined) move(pick);
  }
  function draw() {
    table.replaceChildren();
    hud(
      "Light  " + board.filter((v) => v === 1).length,
      "Dark  " + board.filter((v) => v === 2).length,
    );
    grid(8, 8, (x, y) => {
      const i = y * 8 + x,
        b = document.createElement("button"),
        legal = turn === 1 && flips(i, 1).length;
      b.disabled = !legal;
      b.setAttribute(
        "aria-label",
        `${String.fromCharCode(65 + x)}${y + 1} · ${board[i] === 1 ? "Light" : board[i] === 2 ? "Dark" : legal ? "Legal move" : "Empty"}`,
      );
      b.onclick = () => move(i);
      if (board[i])
        b.innerHTML =
          '<span class="disc ' +
          (board[i] === 1 ? "light" : "dark") +
          '"></span>';
      else if (legal) b.innerHTML = '<span class="legal"></span>';
      return b;
    });
    message(
      notice +
        (turn === 1
          ? "Place a light disc on a marked square."
          : "Computer is choosing a move…"),
    );
  }
  draw();
  if (turn === 2) afterPlayDelay(bot, 300);
}
function memory({ table, grid, message, hud, tone, finish, save, previous }) {
  const deck = previous?.deck || shuffled(memorySymbols.flatMap((s) => [s, s]));
  let matched = previous?.matched || [],
    moves = previous?.moves || 0,
    open = previous?.open || [];
  const persist = () => save({ deck, matched, moves, open });
  function concealPair() {
    afterPlayDelay(() => {
      open = [];
      persist();
      draw();
    }, 850);
  }
  function pick(i) {
    if (open.length === 2 || matched.includes(i) || open.includes(i)) return;
    open.push(i);
    tone(420);
    if (open.length === 2) {
      moves++;
      if (deck[open[0]] === deck[open[1]]) {
        matched.push(...open);
        open = [];
        tone(670);
      } else concealPair();
    }
    persist();
    draw();
    if (matched.length === 16)
      finish("Garden complete!", `All eight pairs found in ${moves} moves.`);
  }
  function draw() {
    table.replaceChildren();
    hud("Moves  " + moves, "Pairs  " + matched.length / 2 + " / 8");
    grid(4, 4, (x, y) => {
      const i = y * 4 + x,
        b = document.createElement("button"),
        show = matched.includes(i) || open.includes(i);
      b.className = matched.includes(i) ? "matched" : show ? "open" : "";
      b.textContent = show ? deck[i] : "✧";
      b.setAttribute(
        "aria-label",
        show ? "Symbol " + deck[i] : "Reveal tile " + (i + 1),
      );
      b.disabled = show;
      b.onclick = () => pick(i);
      return b;
    });
    message("Turn two tiles to find a pair.");
  }
  if (open.length === 2) concealPair();
  persist();
  draw();
}
function merge({
  table,
  grid,
  message,
  hud,
  tone,
  finish,
  save,
  previous,
  prompt,
}) {
  let board = previous?.board || Array(16).fill(0),
    score = previous?.score || 0,
    reached = previous?.reached || false;
  function add() {
    const empty = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    if (empty.length)
      board[empty[Math.floor(Math.random() * empty.length)]] =
        Math.random() < 0.9 ? 2 : 4;
  }
  if (!previous) {
    add();
    add();
    save({ board, score, reached });
  }
  function move(key) {
    const before = board.join(),
      vertical = ["ArrowUp", "ArrowDown"].includes(key),
      reverse = ["ArrowDown", "ArrowRight"].includes(key);
    for (let i = 0; i < 4; i++) {
      const ids = Array.from({ length: 4 }, (_, j) =>
        vertical ? j * 4 + i : i * 4 + j,
      );
      if (reverse) ids.reverse();
      const line = ids.map((j) => board[j]).filter(Boolean),
        out = [];
      for (let j = 0; j < line.length; j++) {
        let v = line[j];
        if (line[j + 1] === v) {
          v *= 2;
          score += v;
          j++;
        }
        out.push(v);
      }
      ids.forEach((idx, j) => (board[idx] = out[j] || 0));
    }
    if (before === board.join()) return;
    add();
    tone(290);
    draw();
    if (board.includes(2048) && !reached) {
      reached = true;
      prompt(
        "2048!",
        "You reached the target. Keep going for a higher score.",
        "Keep playing",
        () => {},
      );
    }
    save({ board, score, reached });
    if (
      board.every(
        (v, i) =>
          v &&
          (i % 4 === 3 || v !== board[i + 1]) &&
          (i >= 12 || v !== board[i + 4]),
      )
    )
      finish(
        "Board complete",
        `Final score ${score}. Your largest tile was ${Math.max(...board)}.`,
      );
  }
  function draw() {
    table.replaceChildren();
    hud("Score  " + score, "Target  2048");
    const palette = [
      "#343143",
      "#d0c5eb",
      "#bea4e7",
      "#e2a4bc",
      "#f4988d",
      "#efaa60",
      "#dbba53",
      "#9aca7a",
      "#71c6ad",
      "#61bed3",
      "#83a8ed",
      "#baa1ff",
    ];
    grid(4, 4, (x, y) => {
      const v = board[y * 4 + x],
        tile = document.createElement("span");
      tile.className = "tile";
      tile.textContent = v || "";
      tile.style.background = palette[Math.min(11, Math.log2(v || 1))];
      return tile;
    });
    message("Use arrow keys or swipe to merge tiles.");
  }
  addEventListener("keydown", (e) => {
    const k =
      { w: "ArrowUp", s: "ArrowDown", a: "ArrowLeft", d: "ArrowRight" }[
        e.key.toLowerCase()
      ] || e.key;
    if (
      k.startsWith("Arrow") &&
      !window.pixelportPaused &&
      document.querySelector("#overlay").hidden
    ) {
      e.preventDefault();
      move(k);
    }
  });
  let down;
  table.onpointerdown = (e) => {
    if (!e.isPrimary || !e.target.closest(".board")) return;
    down = [e.clientX, e.clientY];
    table.setPointerCapture(e.pointerId);
  };
  table.onpointercancel = () => {
    down = null;
  };
  addEventListener("arcadepause", () => {
    down = null;
  });
  table.onpointerup = (e) => {
    if (!down || !e.isPrimary) return;
    const x = e.clientX - down[0],
      y = e.clientY - down[1];
    down = null;
    if (Math.max(Math.abs(x), Math.abs(y)) > 8)
      move(
        Math.abs(x) > Math.abs(y)
          ? x > 0
            ? "ArrowRight"
            : "ArrowLeft"
          : y > 0
            ? "ArrowDown"
            : "ArrowUp",
      );
  };
  draw();
}
