// Shared lifecycle for self-contained game frames.
window.pixelportPaused = false;
window.pixelportMuted = localStorage.getItem("pixelport.muted") === "true";
window.writeGameSave = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    if (error.name !== "QuotaExceededError" && error.name !== "SecurityError")
      throw error;
    parent.postMessage({ type: "pixelport-save-error" }, location.origin);
  }
};
const nativeFrame = window.requestAnimationFrame.bind(window);
const cancelNativeFrame = window.cancelAnimationFrame.bind(window);
const pendingFrames = new Map();
let frameId = 0;
window.requestAnimationFrame = (callback) => {
  const id = ++frameId;
  const task = { callback, nativeId: 0 };
  function schedule() {
    task.nativeId = nativeFrame((stamp) => {
      task.nativeId = 0;
      if (window.pixelportPaused) return;
      pendingFrames.delete(id);
      callback(stamp);
    });
  }
  task.schedule = schedule;
  pendingFrames.set(id, task);
  if (!window.pixelportPaused) schedule();
  return id;
};
window.cancelAnimationFrame = (id) => {
  const task = pendingFrames.get(id);
  if (task) cancelNativeFrame(task.nativeId);
  pendingFrames.delete(id);
};
function syncAudio() {
  if (window.sss && window.sss.setVolume) {
    window.sss.setVolume(
      window.pixelportMuted || window.pixelportPaused ? 0 : 0.065,
    );
  }
}
window.setGamePaused = (paused) => {
  window.pixelportPaused = paused;
  syncAudio();
  if (!paused)
    pendingFrames.forEach((task) => {
      if (!task.nativeId) task.schedule();
    });
  window.dispatchEvent(new CustomEvent("arcadepause", { detail: paused }));
};
window.setGameMuted = (muted) => {
  window.pixelportMuted = muted;
  syncAudio();
};
window.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape" && !document.querySelector("#dlgform")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      parent.postMessage({ type: "pixelport-pause" }, location.origin);
    }
  },
  true,
);
