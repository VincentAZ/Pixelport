import { shuffled } from "./tables.js";

const suits = ["♠", "♥", "♣", "♦"],
  ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const deck = () =>
  shuffled(
    suits.flatMap((s, suit) =>
      ranks.map((r, rank) => ({ suit, rank: rank + 1, up: true })),
    ),
  );
const red = (card) => card.suit % 2 === 1;
function completeDeck(piles) {
  if (!piles.every(Array.isArray)) return false;
  const cards = piles.flat();
  return (
    cards.length === 52 &&
    cards.every(
      (c) =>
        c &&
        Number.isInteger(c.suit) &&
        c.suit >= 0 &&
        c.suit < 4 &&
        Number.isInteger(c.rank) &&
        c.rank >= 1 &&
        c.rank <= 13,
    ) &&
    new Set(cards.map((c) => c.suit * 13 + c.rank)).size === 52
  );
}
export function validSolitaire(state) {
  return (
    state &&
    Number.isSafeInteger(state.moves) &&
    state.moves >= 0 &&
    Array.isArray(state.piles) &&
    state.piles.length === 7 &&
    Array.isArray(state.foundations) &&
    state.foundations.length === 4 &&
    completeDeck([
      state.stock,
      state.waste,
      ...state.piles,
      ...state.foundations,
    ])
  );
}
export function validBlackjack(state) {
  return (
    Array.isArray(state.you) &&
    state.you.length >= 2 &&
    Array.isArray(state.dealer) &&
    state.dealer.length >= 2 &&
    Number.isSafeInteger(state.hands) &&
    state.hands >= 0 &&
    Number.isSafeInteger(state.wins) &&
    state.wins >= 0 &&
    state.wins <= state.hands &&
    typeof state.result === "string" &&
    completeDeck([state.pack, state.you, state.dealer])
  );
}
function cardView(card, hidden = false) {
  const b = document.createElement("button");
  b.className = "playing-card " + (hidden ? "back" : red(card) ? "red" : "");
  b.textContent = hidden ? "" : ranks[card.rank - 1] + suits[card.suit];
  b.setAttribute(
    "aria-label",
    hidden
      ? "Face-down card"
      : ranks[card.rank - 1] +
          " of " +
          ["spades", "hearts", "clubs", "diamonds"][card.suit],
  );
  return b;
}
function space(text, label) {
  const b = document.createElement("button");
  b.className = "slot";
  b.textContent = text;
  b.setAttribute("aria-label", label);
  return b;
}
export function solitaire({
  table,
  hud,
  tone,
  message,
  button,
  finish,
  save,
  previous,
}) {
  let state = previous?.state,
    history = Array.isArray(previous?.history)
      ? previous.history.slice(-60).filter((entry) => {
          try {
            return validSolitaire(JSON.parse(entry));
          } catch {
            return false;
          }
        })
      : [],
    selected = null,
    tip = "";
  if (!state) {
    const stock = deck();
    const piles = Array.from({ length: 7 }, (_, col) =>
      Array.from({ length: col + 1 }, (_, i) => ({
        ...stock.pop(),
        up: i === col,
      })),
    );
    state = {
      stock,
      waste: [],
      piles,
      foundations: [[], [], [], []],
      moves: 0,
    };
  }
  function source(ref) {
    if (ref.type === "pile") return state.piles[ref.col];
    if (ref.type === "foundation") return state.foundations[ref.col];
    return state.waste;
  }
  const allowedRun = (cards) =>
    cards.length &&
    cards.every(
      (c, i) =>
        c.up &&
        (!i ||
          (c.rank === cards[i - 1].rank - 1 && red(c) !== red(cards[i - 1]))),
    );
  function remember() {
    history.push(JSON.stringify(state));
    if (history.length > 60) history.shift();
  }
  function persist() {
    save({ state, history });
  }
  function legal(ref, type, col) {
    if (!ref || (ref.type === type && ref.col === col)) return false;
    const moving = source(ref).slice(ref.index),
      c = moving[0];
    if (!allowedRun(moving)) return false;
    const dest = (type === "foundation" ? state.foundations : state.piles)[col],
      last = dest.at(-1);
    if (type === "foundation")
      return (
        moving.length === 1 &&
        c.suit === col &&
        c.rank === (last?.rank || 0) + 1
      );
    return last
      ? last.up && red(last) !== red(c) && last.rank === c.rank + 1
      : c.rank === 13;
  }
  function move(type, col) {
    if (!legal(selected, type, col)) return false;
    remember();
    const src = source(selected),
      cards = src.splice(selected.index);
    (type === "foundation" ? state.foundations : state.piles)[col].push(
      ...cards,
    );
    if (src.length) src.at(-1).up = true;
    state.moves++;
    selected = null;
    tip = "";
    tone(500);
    persist();
    draw();
    if (state.foundations.every((p) => p.length === 13))
      finish(
        "Solitaire complete!",
        `All four foundations completed in ${state.moves} moves.`,
      );
    return true;
  }
  function activate(ref) {
    if (selected && ref.type !== "waste" && move(ref.type, ref.col)) return;
    const list = source(ref).slice(ref.index);
    if (!allowedRun(list)) {
      tip = "Select a descending run of alternating colors.";
      selected = null;
      draw();
      return;
    }
    selected =
      selected?.type === ref.type &&
      selected.col === ref.col &&
      selected.index === ref.index
        ? null
        : ref;
    tip = selected ? "Choose a destination for the selected card or run." : "";
    draw();
  }
  function bind(b, ref) {
    b.onclick = () => activate(ref);
    if (
      selected?.type === ref.type &&
      selected.col === ref.col &&
      ref.index >= selected.index
    )
      b.classList.add("selected");
    b.draggable = true;
    b.ondragstart = (e) => {
      selected = ref;
      e.dataTransfer.setData("text/plain", "card");
    };
    if (ref.type !== "waste") dropTarget(b, ref.type, ref.col);
  }
  function dropTarget(b, type, col) {
    b.ondragover = (e) => {
      if (legal(selected, type, col)) e.preventDefault();
    };
    b.ondrop = (e) => {
      e.preventDefault();
      move(type, col);
    };
  }
  function stockDraw() {
    if (!state.stock.length && !state.waste.length) return;
    remember();
    selected = null;
    if (state.stock.length) state.waste.push(state.stock.pop());
    else {
      state.stock = state.waste.reverse();
      state.waste = [];
    }
    state.moves++;
    tip = "";
    tone(280);
    persist();
    draw();
  }
  function hint() {
    const refs = [];
    if (state.waste.length)
      refs.push({ type: "waste", col: 0, index: state.waste.length - 1 });
    state.piles.forEach((p, col) =>
      p.forEach((c, index) => {
        if (c.up) refs.push({ type: "pile", col, index });
      }),
    );
    for (const type of ["foundation", "pile"])
      for (const ref of refs)
        for (let col = 0; col < (type === "pile" ? 7 : 4); col++) {
          if (!legal(ref, type, col)) continue;
          if (
            type === "pile" &&
            !state.piles[col].length &&
            ref.type === "pile" &&
            ref.index === 0
          )
            continue;
          selected = ref;
          tip =
            type === "pile"
              ? "Move the selected run to column " + (col + 1) + "."
              : "Move the selected card to the " + suits[col] + " foundation.";
          draw();
          return;
        }
    selected = null;
    tip = state.stock.length
      ? "Draw the next stock card."
      : state.waste.length
        ? "Recycle the waste pile to return cards to the stock."
        : "No available moves. Undo a move or start a new deal.";
    draw();
  }
  function draw() {
    table.replaceChildren();
    hud(
      "Moves  " + state.moves,
      "Foundations  " +
        state.foundations.reduce((s, p) => s + p.length, 0) +
        " / 52",
    );
    const top = document.createElement("div");
    top.className = "card-top";
    const stock = state.stock.length
      ? cardView(state.stock.at(-1), true)
      : space("↻", "Recycle waste");
    stock.setAttribute(
      "aria-label",
      state.stock.length
        ? "Draw from stock, " + state.stock.length + " cards"
        : "Recycle waste",
    );
    stock.onclick = stockDraw;
    top.append(stock);
    const waste = state.waste.length
      ? cardView(state.waste.at(-1))
      : space("·", "Empty waste");
    if (state.waste.length)
      bind(waste, { type: "waste", col: 0, index: state.waste.length - 1 });
    else waste.disabled = true;
    top.append(waste, document.createElement("div"));
    state.foundations.forEach((f, col) => {
      const b = f.length
        ? cardView(f.at(-1))
        : space(suits[col], "Empty " + suits[col] + " foundation");
      if (f.length) bind(b, { type: "foundation", col, index: f.length - 1 });
      else
        b.onclick = () => {
          if (!move("foundation", col)) {
            tip = "Foundations start with the ace of each suit.";
            draw();
          }
        };
      dropTarget(b, "foundation", col);
      top.append(b);
    });
    table.append(top);
    const tableau = document.createElement("div");
    tableau.className = "tableau";
    state.piles.forEach((pile, col) => {
      const p = document.createElement("div");
      p.className = "pile";
      let offset = 0;
      if (!pile.length) {
        const blank = space("K", "Empty column " + (col + 1));
        blank.onclick = () => {
          if (!move("pile", col)) {
            tip = "Only a king can start an empty column.";
            draw();
          }
        };
        dropTarget(blank, "pile", col);
        p.append(blank);
      }
      pile.forEach((c, index) => {
        const b = cardView(c, !c.up);
        b.style.top = offset + "px";
        offset += c.up ? Math.max(16, Math.min(25, innerHeight * 0.045)) : 9;
        if (c.up) bind(b, { type: "pile", col, index });
        else b.disabled = true;
        p.append(b);
      });
      p.style.minHeight = offset + Math.min(100, innerHeight * 0.14) + "px";
      tableau.append(p);
    });
    table.append(tableau);
    message(
      tip || "Select a card, then its destination. You can also drag cards.",
    );
    const actions = document.createElement("div");
    actions.className = "actions";
    const undo = button(
      "Undo",
      () => {
        state = JSON.parse(history.pop());
        selected = null;
        tip = "";
        persist();
        draw();
      },
      "action secondary",
    );
    undo.disabled = !history.length;
    actions.append(undo, button("Hint", hint, "action secondary"));
    table.append(actions);
  }
  draw();
  persist();
}
function total(hand) {
  let sum = hand.reduce((s, c) => s + Math.min(c.rank, 10), 0);
  if (hand.some((c) => c.rank === 1) && sum + 10 <= 21) sum += 10;
  return sum;
}
export function twentyOne({
  table,
  hud,
  tone,
  button,
  message,
  save,
  previous,
}) {
  let state = previous?.pack ? previous : null;
  function deal(wins = 0, hands = 0) {
    const pack = deck();
    state = {
      pack,
      you: [pack.pop(), pack.pop()],
      dealer: [pack.pop(), pack.pop()],
      result: "",
      wins,
      hands,
    };
    if (total(state.you) === 21 || total(state.dealer) === 21) settle();
    else draw();
  }
  function settle() {
    const y = total(state.you),
      d = total(state.dealer);
    if (y > 21) state.result = "Bust. Dealer wins.";
    else if (y === d) state.result = "Push. The hand is tied.";
    else if (d > 21 || y > d) {
      state.result =
        y === 21 && state.you.length === 2
          ? "Blackjack! You win."
          : "You win the hand!";
      state.wins++;
    } else state.result = "Dealer wins the hand.";
    state.hands++;
    tone(y <= 21 && (d > 21 || y > d) ? 640 : 300);
    draw();
  }
  function stand() {
    while (total(state.dealer) < 17) state.dealer.push(state.pack.pop());
    settle();
  }
  function draw() {
    table.replaceChildren();
    hud("Hands  " + state.hands, "Wins  " + state.wins);
    for (const side of ["dealer", "you"]) {
      const group = document.createElement("div");
      group.className = "hand-group";
      const label = document.createElement("p");
      label.className = "hand-label";
      label.textContent =
        (side === "you" ? "You" : "Dealer") +
        " · " +
        (side === "dealer" && !state.result
          ? Math.min(10, state.dealer[0].rank) + " + ?"
          : total(state[side]));
      const hand = document.createElement("div");
      hand.className = "hand";
      state[side].forEach((c, i) => {
        const b = cardView(c, side === "dealer" && !state.result && i === 1);
        b.disabled = true;
        hand.append(b);
      });
      group.append(label, hand);
      table.append(group);
    }
    message(state.result || "Draw another card or keep your current hand.");
    const actions = document.createElement("div");
    actions.className = "actions";
    if (state.result)
      actions.append(button("Deal again", () => deal(state.wins, state.hands)));
    else
      actions.append(
        button("Hit", () => {
          state.you.push(state.pack.pop());
          tone(440);
          if (total(state.you) > 21) settle();
          else if (total(state.you) === 21) stand();
          else draw();
        }),
        button("Stand", stand, "action secondary"),
      );
    table.append(actions);
    save(state);
  }
  if (state) draw();
  else deal();
}
