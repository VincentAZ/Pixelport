// Reuse the collection's own portable save format to resume each board.
(() => {
  const slot = "pixelport.board." + location.pathname;
  function save() {
    if (!window.calledRun || !window.Module?._get_save_file) return;
    const ptr = Module._get_save_file();
    if (!ptr) return;
    try {
      window.writeGameSave(slot, UTF8ToString(ptr));
    } finally {
      Module._free_save_file(ptr);
    }
  }
  function restore() {
    if (!window.calledRun || !document.querySelector("#puzzlecanvas")?.width) {
      setTimeout(restore, 35);
      return;
    }
    const text = localStorage.getItem(slot);
    if (text) {
      const bytes = new TextEncoder().encode(text);
      let position = 0;
      savefile_read_callback = (buffer, count) => {
        if (position + count > bytes.length) return false;
        writeArrayToMemory(bytes.subarray(position, position + count), buffer);
        position += count;
        return true;
      };
      try {
        Module._load_game();
      } finally {
        savefile_read_callback = null;
      }
    }
    function fitBoard() {
      const area = document.querySelector("#board-area");
      if (!area.clientWidth || !area.clientHeight) return;
      const scale = window.devicePixelRatio || 1;
      Module._resize_puzzle(
        Math.floor((area.clientWidth - 8) * scale),
        Math.floor((area.clientHeight - 8) * scale),
      );
    }
    fitBoard();
    new ResizeObserver(fitBoard).observe(document.querySelector("#board-area"));
    window.savePixelportGame = save;
    window.addEventListener("pagehide", save);
    let pendingSave;
    for (const event of ["pointerup", "keyup", "click", "change"])
      document.addEventListener(event, () => {
        clearTimeout(pendingSave);
        pendingSave = setTimeout(save, 80);
      });
  }
  window.addEventListener("load", restore);
})();
// The download dialog is built by JavaScript and has no native puzzle
// configuration to cancel or submit. Use its own dismissal callback.
window.addEventListener(
  "keydown",
  (event) => {
    const form = document.querySelector("#dlgform");
    if (!form?.querySelector("a[download]")) return;
    if (event.key === "Escape" || event.key === "Enter") {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === "Enter" && event.target.matches("a[download]"))
        event.target.click();
      else form.querySelector('input[value="OK"]').click();
    }
  },
  true,
);
window.addEventListener("arcadepause", (event) => {
  if (!event.detail && typeof timer_reference === "number")
    timer_reference = performance.now();
});
