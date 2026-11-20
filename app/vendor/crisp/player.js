const name = new URLSearchParams(location.search).get("game");
window.pixelportState = (state) => {
  document.body.dataset.gameState = state;
  if (state === "gameOver" && !window.isReplaying) {
    const bestKey = "pixelport.best." + name;
    const best = Math.max(
      Number(localStorage.getItem(bestKey)) || 0,
      Math.floor(window.score || 0),
    );
    window.writeGameSave(bestKey, best);
  }
  parent.postMessage({ type: "pixelport-state", state }, location.origin);
};
if (/^[a-z0-9]+$/.test(name)) {
  const script = document.createElement("script");
  script.src = name + ".js";
  script.onload = () => {
    // Use the canvas renderer for consistent offline and software-GPU playback.
    window.options = window.options || {};
    window.options.theme = ["dark", "pixel", "shapeDark", "crt"].includes(
      window.options.theme,
    )
      ? "dark"
      : "simple";
    window.options.isCapturing = false;
    window.options.isMinifying = false;
    window.options.highScore = Math.max(
      0,
      Number(localStorage.getItem("pixelport.best." + name)) || 0,
    );
    window.onLoad();
    window.setGameMuted(window.pixelportMuted);
  };
  document.head.append(script);
}
