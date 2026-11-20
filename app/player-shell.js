import { icon } from "./icons.js";
import { genreColors, genreIcons, gameUrl } from "./catalog.js";
const $ = (s) => document.querySelector(s);
export function initPlayer({
  isFavorite,
  toggleFavorite,
  gameStarted,
  onClose,
  onSaveError,
}) {
  const dialog = $("#play-dialog"),
    stage = $("#stage"),
    layer = $("#pause-layer");
  let current,
    frame,
    trigger,
    mode = "";
  const win = () => frame?.contentWindow;
  function favorite() {
    const b = $("#playing-fav"),
      on = isFavorite(current.id);
    b.innerHTML = icon("heart", 17);
    b.classList.toggle("is-favorite", on);
    b.setAttribute("aria-pressed", on);
    b.setAttribute(
      "aria-label",
      on ? "Remove from favorites" : "Add to favorites",
    );
    b.title = b.getAttribute("aria-label");
  }
  function focusGame() {
    if (!frame) return;
    frame.focus({ preventScroll: true });
    const doc = frame.contentDocument;
    const target = doc?.querySelector(
      "#dlgform input, #dlgform select, #dlgform a",
    );
    (
      target ||
      doc?.querySelector("#overlay:not([hidden]) #start, #puzzlecanvas")
    )?.focus({ preventScroll: true });
  }
  function resume() {
    mode = "";
    layer.hidden = true;
    frame.inert = false;
    win()?.setGamePaused?.(false);
    focusGame();
    $("#pause").innerHTML = icon("pause", 16) + " Pause <kbd>Esc</kbd>";
  }
  function action(label, fn, primary = false) {
    const b = document.createElement("button");
    b.className = primary ? "primary" : "outline";
    b.textContent = label;
    b.onclick = fn;
    $("#pause-actions").append(b);
    return b;
  }
  function overlay(next) {
    mode = next;
    win()?.setGamePaused?.(true);
    frame.inert = true;
    layer.hidden = false;
    $("#pause-symbol").innerHTML = icon(
      next === "help"
        ? "circle-help"
        : next === "restart"
          ? "rotate-ccw"
          : "pause",
      26,
    );
    $("#pause-title").textContent =
      next === "help"
        ? "How to play"
        : next === "restart"
          ? "Start a new game?"
          : "Game paused";
    const copy = $("#pause-copy");
    copy.replaceChildren();
    const lines =
      next === "help"
        ? current.help
        : next === "restart"
          ? ["Your current round will be replaced."]
          : [current.name];
    for (const text of lines) {
      const p = document.createElement("p");
      p.textContent = text;
      copy.append(p);
    }
    if (next === "help") {
      const p = document.createElement("p");
      p.className = "credit";
      p.textContent = current.credit;
      copy.append(p);
    }
    $("#pause-actions").replaceChildren();
    const main = action(
      next === "restart" ? "Keep playing" : "Resume game",
      resume,
      true,
    );
    if (next === "restart") action("New game", restart);
    if (next === "paused") {
      action("How to play", () => overlay("help"));
      action("New game", () => overlay("restart"));
      action("Back to library", close);
    }
    $("#pause").innerHTML = icon("play", 16) + " Resume <kbd>Esc</kbd>";
    main.focus();
  }
  function restart() {
    if (current.engine === "puzzle") {
      const doc = frame.contentDocument;
      doc
        .querySelector(
          '#dlgform input[value="Cancel"], #dlgform:has(a[download]) input[value="OK"]',
        )
        ?.click();
      doc.querySelector("#new")?.click();
      resume();
      return;
    }
    if (current.engine === "original")
      localStorage.removeItem("pixelport.table." + current.id);
    mount(current);
    resume();
  }
  function close() {
    if (!dialog.open) return;
    win()?.savePixelportGame?.();
    win()?.setGamePaused?.(true);
    frame.inert = true;
    dialog.close();
    dialog.classList.remove("expanded");
    document.body.style.overflow = "";
    mode = "";
    layer.hidden = true;
    onClose(current, trigger);
  }
  function mount(game) {
    win()?.savePixelportGame?.();
    frame?.remove();
    frame = document.createElement("iframe");
    frame.title = game.name + " game";
    frame.src = gameUrl(game);
    frame.setAttribute("allow", "autoplay");
    frame.addEventListener("load", () => {
      if (!dialog.open || mode) {
        win()?.setGamePaused?.(true);
      } else focusGame();
    });
    stage.prepend(frame);
  }
  function hint(state) {
    let text = "";
    if (current?.engine === "crisp") {
      text =
        state === "title"
          ? "Click the playfield or press Space to start"
          : state === "gameOver"
            ? "Click the playfield to try again"
            : current.controls ||
              current.help
                .slice(2)
                .join("  ·  ")
                .replaceAll("[", "")
                .replaceAll("]", " —");
    }
    $("#control-hint").textContent = text;
  }
  function open(g, b) {
    const same = current?.id === g.id && frame;
    current = g;
    trigger = b;
    gameStarted(g);
    hint(same ? frame.contentDocument?.body?.dataset.gameState : "title");
    $("#playing-title").textContent = g.name;
    $("#playing-genre").textContent = g.genre;
    $("#player-genre-icon").innerHTML = icon(genreIcons[g.genre], 21);
    $("#player-genre-icon").style.color = genreColors[g.genre];
    favorite();
    dialog.showModal();
    document.body.style.overflow = "hidden";
    if (!same) mount(g);
    resume();
    $("#expand").setAttribute("aria-label", "Expand player");
    $("#expand").title = "Expand player";
    $("#expand").innerHTML = icon("expand", 16);
  }
  $("#playing-fav").onclick = () => {
    toggleFavorite(current.id);
    favorite();
  };
  $("#close-game").onclick = close;
  $("#pause").onclick = () => (mode ? resume() : overlay("paused"));
  $("#how").onclick = () => (mode === "help" ? resume() : overlay("help"));
  $("#expand").onclick = () => {
    const large = dialog.classList.toggle("expanded");
    const b = $("#expand");
    b.innerHTML = icon(large ? "minimize-2" : "expand", 16);
    b.setAttribute(
      "aria-label",
      large ? "Restore player size" : "Expand player",
    );
    b.title = b.getAttribute("aria-label");
    if (mode) $("#pause-actions button")?.focus();
    else focusGame();
  };
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    mode ? resume() : overlay("paused");
  });
  window.addEventListener("message", (e) => {
    if (e.source !== win() || e.origin !== location.origin) return;
    if (e.data?.type === "pixelport-save-error") onSaveError();
    if (!dialog.open) return;
    if (e.data?.type === "pixelport-state") hint(e.data.state);
    if (e.data?.type === "pixelport-pause") mode ? resume() : overlay("paused");
  });
  const suspend = () => {
    if (dialog.open && !mode) overlay("paused");
  };
  window.pixelportDesktop?.onWindowBlur(suspend);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) suspend();
  });
  return { open };
}
