import { originals } from "../../originals.js";
import { arcade } from "./realtime.js";
import { tables } from "./tables.js";

const game = originals.find(
  (item) => item.id === new URLSearchParams(location.search).get("game"),
);
document.title = game.name;
const surface = document.querySelector("#surface");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#start");
let audio;
function tone(frequency = 480, duration = 0.08) {
  if (
    window.pixelportMuted ||
    window.pixelportPaused ||
    !navigator.userActivation.hasBeenActive
  )
    return;
  audio ??= new AudioContext();
  if (audio.state === "suspended") audio.resume();
  const oscillator = audio.createOscillator();
  const volume = audio.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = frequency;
  volume.gain.setValueAtTime(0.075, audio.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  oscillator.connect(volume).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + duration);
}
function hud(primary, secondary = "") {
  document.querySelector("#metric").textContent = primary;
  document.querySelector("#secondary").textContent = secondary;
}
function prompt(title, message, label, action) {
  document.querySelector("#overlay-title").textContent = title;
  document.querySelector("#overlay-text").textContent = message;
  startButton.textContent = label;
  startButton.onclick = () => {
    overlay.hidden = true;
    surface.inert = false;
    surface.focus();
    action();
  };
  overlay.hidden = false;
  surface.inert = true;
  startButton.focus({ preventScroll: true });
}
surface.tabIndex = -1;
const api = { surface, hud, prompt, tone, game };
if (["snake", "blocks", "star", "sunset"].includes(game.id)) arcade(api);
else tables(api);
