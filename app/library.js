import { games, collections, genreColors, genreIcons } from "./catalog.js";
import { icon } from "./icons.js";
import { initPlayer } from "./player-shell.js";

const $ = (selector) => document.querySelector(selector);
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem("pixelport." + key)) ?? fallback;
  } catch {
    return fallback;
  }
};
function showSaveWarning() {
  for (const id of ["#library-save-warning", "#game-save-warning"]) {
    $(id).textContent =
      "Local storage is unavailable. Your latest changes may be lost when you quit.";
    $(id).hidden = false;
  }
}
function write(key, val) {
  try {
    localStorage.setItem("pixelport." + key, JSON.stringify(val));
  } catch (error) {
    if (error.name !== "QuotaExceededError" && error.name !== "SecurityError")
      throw error;
    showSaveWarning();
  }
}
const byId = new Map(games.map((g) => [g.id, g]));
function savedGames(key) {
  const saved = read(key, []);
  return new Set(
    Array.isArray(saved) ? saved.filter((id) => byId.has(id)) : [],
  );
}
const favorites = savedGames("favorites");
let recently = [...savedGames("recently")];
let view = "Discover",
  genre = "All games",
  query = "",
  page = 0,
  spotlight = 0;
let layout = read("layout", "grid") === "list" ? "list" : "grid",
  muted = read("muted", false) === true,
  sort = read("sort", "featured");
const pageSize = 16;
const featured = ["sunset", "snake", "star"];
const navItems = [
  ["Discover", "compass"],
  ["All games", "layout-grid"],
  ["Favorites", "heart"],
  ["Recently played", "history"],
];
const collectionItems = [
  ["Arcade classics", "joystick", "#d5afff", "#352a43"],
  ["Brain teasers", "brain", "#8bcfbd", "#233832"],
  ["Quick plays", "zap", "#f2bd84", "#392e25"],
];
const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
document
  .querySelectorAll("[data-icon]")
  .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
$("#sort").value = sort;
if (!$("#sort").value) {
  sort = "featured";
  $("#sort").value = sort;
}
function navButton(name, image, badge = "") {
  return `<button class="nav-button ${view === name ? "active" : ""}" data-nav="${name}" ${view === name ? 'aria-current="page"' : ""}>${icon(image)}<span>${name}</span>${badge ? `<span class="badge">${badge}</span>` : ""}</button>`;
}
function updateNav() {
  $("#nav-main").innerHTML = navItems
    .map(([n, i]) =>
      navButton(
        n,
        i,
        n === "All games"
          ? games.length
          : n === "Favorites" && favorites.size
            ? favorites.size
            : "",
      ),
    )
    .join("");
  $("#nav-collections").innerHTML = collectionItems
    .map(
      ([n, i, color, bg]) =>
        `<button class="nav-button collection ${view === n ? "active" : ""}" data-nav="${n}" ${view === n ? 'aria-current="page"' : ""}><span class="collection-icon" style="background:${bg};color:${color}">${icon(i, 15)}</span><span>${n}</span></button>`,
    )
    .join("");
  $("#crumb").textContent = query ? "Search" : view;
}
const compactNav = matchMedia("(max-width: 850px)");
function setNav(open) {
  const wasOpen = document.body.classList.contains("nav-open");
  document.body.classList.toggle("nav-open", open);
  $("#sidebar").inert = compactNav.matches && !open;
  $(".workspace").inert = open;
  $("#scrim").hidden = !open;
  $("#sidebar-open").setAttribute("aria-expanded", String(open));
  if (open) $("#sidebar .nav-button.active")?.focus();
  else if (wasOpen && compactNav.matches) $("#sidebar-open").focus();
}
const closeNav = () => setNav(false);
compactNav.addEventListener("change", closeNav);
setNav(false);
function navigate(name) {
  view = name;
  query = "";
  $("#search").value = "";
  genre = "All games";
  page = 0;
  closeNav();
  window.scrollTo(0, 0);
  render();
}
function favLabel(g) {
  return (
    (favorites.has(g.id)
      ? "Remove " + g.name + " from"
      : "Add " + g.name + " to") + " favorites"
  );
}
function heart(g, cls) {
  return `<button class="${cls} ${favorites.has(g.id) ? "is-favorite" : ""}" data-fav="${g.id}" aria-label="${favLabel(g)}" aria-pressed="${favorites.has(g.id)}" title="${favLabel(g)}">${icon("heart", 17)}</button>`;
}
function renderHero() {
  const hero = $("#hero");
  hero.hidden = view !== "Discover" || !!query;
  if (hero.hidden) return;
  const g = byId.get(featured[spotlight]);
  hero.style.backgroundImage = `url("assets/covers/${g.id}.webp")`;
  hero.innerHTML = `<div class="hero-copy"><div class="eyebrow">${icon("sparkles", 15)} GAME SPOTLIGHT</div><h2 class="hero-title">${g.name}</h2><div class="hero-meta"><span class="genre-pill">${g.genre}</span><i></i><span>Single player</span></div><p>${g.id === "sunset" ? "Chase the sunset and weave through traffic on a winding mountain highway." : g.summary}</p><div class="hero-actions"><button class="primary play" data-play="${g.id}">${icon("play", 15)} Play now</button>${heart(g, "iconbtn hero-fav")}</div></div><div class="hero-pager" role="group" aria-label="Choose featured game">${featured.map((id, i) => `<button class="${i === spotlight ? "current" : ""}" data-feature="${i}" aria-label="Feature ${byId.get(id).name}" aria-pressed="${i === spotlight}"><i></i></button>`).join("")}</div>`;
}
function listForView() {
  if (query)
    return games.filter((g) =>
      (g.name + " " + g.genre).toLowerCase().includes(query.toLowerCase()),
    );
  if (view === "Recently played") return recently.map((id) => byId.get(id));
  if (view === "Favorites") return games.filter((g) => favorites.has(g.id));
  if (collections[view])
    return games.filter((g) => collections[view].includes(g.id));
  return games;
}
function renderCards() {
  const all = listForView();
  if (genre !== "All games" && !all.some((g) => g.genre === genre))
    genre = "All games";
  const filtered = all.filter(
    (g) => genre === "All games" || g.genre === genre,
  );
  if (sort === "az" || sort === "za")
    filtered.sort(
      (a, b) => a.name.localeCompare(b.name) * (sort === "az" ? 1 : -1),
    );
  else if (sort === "recent")
    filtered.sort(
      (a, b) =>
        (recently.includes(a.id) ? recently.indexOf(a.id) : 1e5) -
        (recently.includes(b.id) ? recently.indexOf(b.id) : 1e5),
    );
  page = Math.max(0, Math.min(page, Math.ceil(filtered.length / pageSize) - 1));
  const start = page * pageSize,
    visible = filtered.slice(start, start + pageSize);
  $("#library-title").textContent = query
    ? "Search results"
    : view === "Discover"
      ? "Game library"
      : view;
  $("#game-count").textContent =
    filtered.length + " " + (filtered.length === 1 ? "game" : "games");
  $("#sort").parentElement.dataset.value =
    $("#sort").selectedOptions[0].textContent;
  const available = [
    "All games",
    ...Object.keys(genreIcons).filter((n) => all.some((g) => g.genre === n)),
  ];
  $("#filters").innerHTML = available
    .map(
      (n) =>
        `<button aria-pressed="${n === genre}" data-genre="${n}">${icon(genreIcons[n] || "layout-grid", 14)}${n}</button>`,
    )
    .join("");
  $("#filters").hidden = !all.length;
  $("#games").classList.toggle("list-mode", layout === "list");
  $("#grid-view").setAttribute("aria-pressed", layout === "grid");
  $("#list-view").setAttribute("aria-pressed", layout === "list");
  $("#games").innerHTML = visible
    .map(
      (g, i) =>
        `<article class="game-card" style="--genre:${genreColors[g.genre]}"><button class="game-open" data-play="${g.id}" aria-label="Play ${g.name}"><div class="cover-wrap"><img src="assets/covers/${g.id}.webp" alt="" loading="${i < 8 ? "eager" : "lazy"}"><span class="cover-play">${icon("play", 17)}</span></div><div class="card-body"><h2>${g.name}</h2><span class="genre-label"><i></i>${g.genre}</span></div></button>${heart(g, "fav")}</article>`,
    )
    .join("");
  if (!visible.length) {
    const isQuery = !!query,
      fav = view === "Favorites" && !favorites.size,
      recent = view === "Recently played" && !recently.length;
    const heading = isQuery
      ? "No matching games"
      : fav
        ? "Your favorites live here"
        : recent
          ? "Your play history starts here"
          : "No games in this genre";
    const hint = isQuery
      ? `Try another title or genre for “${escape(query)}”.`
      : fav
        ? "Use the heart on a game to save it for later."
        : recent
          ? "Open a game and it will appear here."
          : "Choose a different genre to keep browsing.";
    $("#games").innerHTML =
      `<div class="empty">${icon(isQuery ? "search" : fav ? "heart" : "gamepad-2", 30)}<h2>${heading}</h2><p>${hint}</p><button class="outline" data-nav="All games">Browse all games</button></div>`;
  }
  $("#pagination").innerHTML =
    filtered.length > pageSize
      ? `<span>Showing ${start + 1}–${start + visible.length} of ${filtered.length} games</span><div><button class="iconbtn" data-page="-1" ${page === 0 ? "disabled" : ""} aria-label="Previous page">${icon("chevron-left", 16)}</button><span>${page + 1} / ${Math.ceil(filtered.length / pageSize)}</span><button class="iconbtn" data-page="1" ${start + pageSize >= filtered.length ? "disabled" : ""} aria-label="Next page">${icon("chevron-right", 16)}</button></div>`
      : "";
}
function render() {
  updateNav();
  renderHero();
  renderCards();
}
let toastTimer;
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 1700);
}
function toggleFavorite(id) {
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  write("favorites", [...favorites]);
  const active = document.activeElement,
    selector = active?.dataset.fav
      ? `[data-fav="${id}"].${active.classList.contains("fav") ? "fav" : "hero-fav"}`
      : null;
  updateNav();
  renderHero();
  renderCards();
  if (selector)
    (
      document.querySelector(selector) ||
      $("#games .fav") ||
      $("#games button")
    )?.focus({ preventScroll: true });
  toast(favorites.has(id) ? "Added to favorites" : "Removed from favorites");
}
function syncSound() {
  for (const id of ["#sound", "#player-sound"]) {
    const b = $(id);
    b.innerHTML = icon(muted ? "volume-x" : "volume-2", 17);
    b.setAttribute("aria-label", muted ? "Enable sound" : "Mute sound");
    b.title = muted ? "Enable sound" : "Mute sound";
    b.setAttribute("aria-pressed", muted);
  }
  $("#pref-sound").innerHTML =
    icon(muted ? "volume-x" : "volume-2") +
    "Game sound<strong>" +
    (muted ? "Off" : "On") +
    "</strong>";
  $("#pref-sound").setAttribute("aria-pressed", String(!muted));
  window.pixelportDesktop?.mute(muted);
  $("#stage iframe")?.contentWindow?.setGameMuted?.(muted);
}
function toggleMute() {
  muted = !muted;
  write("muted", muted);
  syncSound();
}
const player = initPlayer({
  isFavorite: (id) => favorites.has(id),
  toggleFavorite,
  onSaveError: showSaveWarning,
  gameStarted: (g) => {
    recently = [g.id, ...recently.filter((id) => id !== g.id)];
    write("recently", recently);
  },
  onClose: (g, trigger) => {
    render();
    const candidates = [...document.querySelectorAll(`[data-play="${g.id}"]`)];
    (trigger?.isConnected && !trigger.closest("[inert]")
      ? trigger
      : candidates.find((button) =>
          button.classList.contains(
            trigger?.classList.contains("play") ? "play" : "game-open",
          ),
        ) ||
        candidates[0] ||
        (compactNav.matches ? $("#sidebar-open") : $("#surprise"))
    ).focus({ preventScroll: true });
  },
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const d = b.dataset;
  if (d.nav) {
    navigate(d.nav);
    if (compactNav.matches || !b.closest("#sidebar"))
      $("#library").focus({ preventScroll: true });
    else $("#sidebar .nav-button.active")?.focus({ preventScroll: true });
  }
  if (d.play) player.open(byId.get(d.play), b);
  if (d.fav) toggleFavorite(d.fav);
  if (d.genre) {
    genre = d.genre;
    page = 0;
    renderCards();
    document
      .querySelector(`[data-genre="${genre}"]`)
      ?.focus({ preventScroll: true });
  }
  if (d.feature !== undefined) {
    spotlight = Number(d.feature);
    renderHero();
    document
      .querySelector(`[data-feature="${spotlight}"]`)
      .focus({ preventScroll: true });
  }
  if (d.page) {
    page += Number(d.page);
    renderCards();
    $("#library").scrollIntoView({ block: "start" });
    $("#games .game-open")?.focus({ preventScroll: true });
  }
});
$("#search").addEventListener("input", (e) => {
  query = e.target.value.trim();
  genre = "All games";
  page = 0;
  window.scrollTo(0, 0);
  render();
});
$("#sort").onchange = (e) => {
  sort = e.target.value;
  write("sort", sort);
  page = 0;
  renderCards();
};
for (const mode of ["grid", "list"])
  $("#" + mode + "-view").onclick = () => {
    layout = mode;
    write("layout", mode);
    renderCards();
  };
$("#sound").onclick = toggleMute;
$("#player-sound").onclick = toggleMute;
$("#pref-sound").onclick = toggleMute;
$("#surprise").onclick = (e) => {
  closeNav();
  const pool = games.filter((g) => g.id !== recently[0]);
  player.open(pool[Math.floor(Math.random() * pool.length)], e.currentTarget);
};
$("#sidebar-open").onclick = () => {
  setNav(!document.body.classList.contains("nav-open"));
};
$("#scrim").onclick = closeNav;
const settings = $("#settings-dialog");
$("#player-name").textContent = read("name", "Player One");
$("#profile").onclick = () => {
  closeNav();
  $("#name-field").value = read("name", "Player One");
  settings.showModal();
};
$("#close-settings").onclick = () => settings.close();
function saveProfile() {
  const name = $("#name-field").value.trim() || "Player One";
  write("name", name);
  $("#player-name").textContent = name;
  settings.close();
  toast("Settings saved");
}
$("#save-profile").onclick = saveProfile;
$("#name-field").onkeydown = (e) => {
  if (e.key === "Enter") saveProfile();
};
const licenses = [
  ["Portable Puzzle Collection", "puzzles"],
  ["ABA Games", "aba-games"],
  ["crisp-game-lib", "crisp"],
  ["sounds-some-sounds", "sounds"],
  ["jsfx", "jsfx"],
  ["mml-iterator", "mml-iterator"],
  ["Lodash", "lodash"],
  ["Lucide icons", "lucide"],
  ["DM Sans", "dm-sans"],
  ["Silkscreen", "silkscreen"],
  ["Space Mono", "space-mono"],
];
$("#credits").addEventListener("toggle", () => {
  if (!$("#credits").open || $("#credits-body").childElementCount) return;
  $("#credits-body").innerHTML =
    "<p>10 Pixelport originals, 50 games by Kenta Cho / ABA Games, and 40 from Simon Tatham’s Portable Puzzle Collection.</p>";
  for (const [name, file] of licenses) {
    const entry = document.createElement("details"),
      summary = document.createElement("summary"),
      pre = document.createElement("pre");
    summary.textContent = name;
    entry.append(summary, pre);
    entry.ontoggle = async () => {
      if (entry.open && !pre.textContent)
        pre.textContent = await (await fetch(`licenses/${file}.txt`)).text();
    };
    $("#credits-body").append(entry);
  }
});
addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]")) return;
  if (
    (e.key === "/" &&
      !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) ||
    ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")
  ) {
    e.preventDefault();
    closeNav();
    $("#search").focus();
    $("#search").select();
  }
  if (e.key === "Escape") {
    if (document.activeElement === $("#search")) {
      $("#search").value = "";
      query = "";
      $("#search").blur();
      render();
    }
    closeNav();
  }
});
syncSound();
render();
