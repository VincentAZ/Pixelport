const {
  app,
  BrowserWindow,
  Menu,
  protocol,
  net,
  ipcMain,
  session,
} = require("electron");
const { resolve, sep, join } = require("node:path");
const { pathToFileURL } = require("node:url");
const { readFileSync, writeFileSync } = require("node:fs");
const htmlPolicy = require("./resource-policy.cjs");

const origin = "pixelport://arcade";
const root = join(__dirname, "app");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "pixelport",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
app.setName("Pixelport");
if (process.env.PIXELPORT_TEST_PROFILE)
  app.setPath("userData", process.env.PIXELPORT_TEST_PROFILE);
let mainWindow;
function createWindow() {
  let bounds = { width: 1380, height: 890 };
  try {
    const saved = JSON.parse(
      readFileSync(join(app.getPath("userData"), "window.json"), "utf8"),
    );
    if (
      Number.isInteger(saved.width) &&
      saved.width > 0 &&
      Number.isInteger(saved.height) &&
      saved.height > 0
    )
      bounds = { width: saved.width, height: saved.height };
  } catch {}
  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 740,
    minHeight: 540,
    show: false,
    backgroundColor: "#111116",
    title: "Pixelport",
    icon: join(root, "assets/icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, "preload.cjs"),
      spellcheck: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("blur", () => mainWindow.webContents.send("arcade:blur"));
  mainWindow.on("close", () => {
    const { width, height } = mainWindow.getNormalBounds();
    try {
      writeFileSync(
        join(app.getPath("userData"), "window.json"),
        JSON.stringify({ width, height }),
      );
    } catch {}
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.loadURL(origin + "/index.html");
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    protocol.handle("pixelport", async (req) => {
      const url = new URL(req.url);
      if (url.hostname !== "arcade") return new Response(null, { status: 404 });
      let filename;
      try {
        filename = resolve(root, "." + decodeURIComponent(url.pathname));
      } catch {
        return new Response(null, { status: 400 });
      }
      if (!filename.startsWith(root + sep))
        return new Response(null, { status: 403 });
      try {
        const file = await net.fetch(pathToFileURL(filename).href);
        if (!filename.endsWith(".html")) return file;
        const headers = new Headers(file.headers);
        headers.set(
          "Content-Security-Policy",
          htmlPolicy(
            filename.startsWith(join(root, "vendor", "puzzles") + sep),
          ),
        );
        return new Response(file.body, { status: file.status, headers });
      } catch {
        return new Response(null, { status: 404 });
      }
    });
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, cb) => cb(false),
    );
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
      (_details, cb) => cb({ cancel: true }),
    );
    Menu.setApplicationMenu(null);
    ipcMain.on("arcade:mute", (event, value) => {
      if (
        event.senderFrame === mainWindow?.webContents.mainFrame &&
        event.senderFrame?.url.split("#")[0] === origin + "/index.html" &&
        typeof value === "boolean"
      )
        event.sender.setAudioMuted(value);
    });
    createWindow();
    app.on("activate", () => {
      if (!mainWindow) createWindow();
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
