const { contextBridge, ipcRenderer } = require("electron");
if (process.isMainFrame)
  contextBridge.exposeInMainWorld("pixelportDesktop", {
    mute: (value) => ipcRenderer.send("arcade:mute", Boolean(value)),
    onWindowBlur: (callback) => ipcRenderer.on("arcade:blur", () => callback()),
  });
