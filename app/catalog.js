import { originals } from "./originals.js";
const read = (file) =>
  fetch(new URL(file, import.meta.url)).then((r) => {
    if (!r.ok) throw Error("Could not load game catalog");
    return r.json();
  });
const [puzzles, arcades] = await Promise.all([
  read("puzzles.json"),
  read("arcades.json"),
]);
export const genreIcons = {
  Arcade: "joystick",
  Puzzle: "puzzle",
  Action: "zap",
  Strategy: "crown",
  Cards: "spade",
  Sports: "trophy",
  Racing: "car",
};
export const genreColors = {
  Arcade: "#ad9aff",
  Puzzle: "#f7b570",
  Action: "#ee91b5",
  Strategy: "#71becf",
  Cards: "#83cfaf",
  Sports: "#a9d476",
  Racing: "#ed9d81",
};
const ordered = [
  "snake",
  "blocks",
  "star",
  "cards",
  "mines",
  "sunset",
  "net",
  "golfme",
  "four",
  "pairs",
  "reversi",
  "blackjack",
  "merge",
  "ctower",
  "solo",
  "slalom",
];
const library = [...originals, ...puzzles, ...arcades];
const rank = (id) => (ordered.includes(id) ? ordered.indexOf(id) : 100);
export const games = library.sort(
  (a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name),
);
export const collections = {
  "Arcade classics": [
    "snake",
    "blocks",
    "star",
    "cards",
    "mines",
    "four",
    "reversi",
    "merge",
    "blackjack",
    "solo",
    "fifteen",
    "pegs",
  ],
  "Brain teasers": games
    .filter((g) => ["Puzzle", "Strategy"].includes(g.genre))
    .map((g) => g.id),
  "Quick plays": games
    .filter(
      (g) =>
        g.engine === "crisp" ||
        ["snake", "star", "blackjack", "pairs"].includes(g.id),
    )
    .map((g) => g.id),
};
export const gameUrl = (g) =>
  g.engine === "puzzle"
    ? `vendor/puzzles/${g.id}.html`
    : g.engine === "crisp"
      ? `vendor/crisp/player.html?game=${g.id}`
      : `games/original/player.html?game=${g.id}`;
