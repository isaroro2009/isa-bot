// IsaBot Desktop — proceso principal.
// Abre la web publicada (isa-bot.lovable.app) dentro de una ventana nativa
// y expone control real del PC (mouse/teclado/screenshot/archivos) vía IPC.
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const WEB_URL = process.env.ISABOT_URL || "https://isa-bot.lovable.app";
const ALLOWED_ORIGIN = new URL(WEB_URL).origin;

// Cargamos módulos nativos de forma perezosa para que la app siga arrancando
// aunque no estén compilados en la plataforma actual.
let nut = null;
function getNut() {
  if (nut) return nut;
  try {
    nut = require("@nut-tree-fork/nut-js");
    nut.mouse.config.mouseSpeed = 800;
    nut.keyboard.config.autoDelayMs = 30;
  } catch (e) {
    console.warn("[isabot] @nut-tree-fork/nut-js no disponible:", e.message);
    nut = null;
  }
  return nut;
}
let screenshot = null;
function getScreenshot() {
  if (screenshot) return screenshot;
  try { screenshot = require("screenshot-desktop"); } catch { screenshot = null; }
  return screenshot;
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    title: "IsaBot — Co-piloto de IA",
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#fdf5ff",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload necesita require
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(WEB_URL);

  // Abrir enlaces externos en el navegador del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ─── Whitelist: sólo el origin de IsaBot puede usar las APIs nativas ───
function assertAllowed(event) {
  const origin = new URL(event.senderFrame.url).origin;
  if (origin !== ALLOWED_ORIGIN && origin !== "http://localhost:8080") {
    throw new Error(`Origen no autorizado: ${origin}`);
  }
}

// ─── IPC handlers ───
ipcMain.handle("isabot:screenshot", async (e) => {
  assertAllowed(e);
  const sc = getScreenshot();
  if (!sc) throw new Error("screenshot-desktop no instalado");
  const buf = await sc({ format: "png" });
  return "data:image/png;base64," + buf.toString("base64");
});

ipcMain.handle("isabot:screen-size", async (e) => {
  assertAllowed(e);
  const n = getNut();
  if (!n) return { width: 1920, height: 1080 };
  return { width: await n.screen.width(), height: await n.screen.height() };
});

ipcMain.handle("isabot:mouse-move", async (e, x, y) => {
  assertAllowed(e);
  const n = getNut(); if (!n) throw new Error("nut-js no disponible");
  await n.mouse.setPosition(new n.Point(x, y));
});
ipcMain.handle("isabot:click", async (e, button = "left") => {
  assertAllowed(e);
  const n = getNut(); if (!n) throw new Error("nut-js no disponible");
  const b = button === "right" ? n.Button.RIGHT : button === "middle" ? n.Button.MIDDLE : n.Button.LEFT;
  await n.mouse.click(b);
});
ipcMain.handle("isabot:double-click", async (e) => {
  assertAllowed(e);
  const n = getNut(); if (!n) throw new Error("nut-js no disponible");
  await n.mouse.doubleClick(n.Button.LEFT);
});
ipcMain.handle("isabot:type", async (e, text) => {
  assertAllowed(e);
  const n = getNut(); if (!n) throw new Error("nut-js no disponible");
  await n.keyboard.type(String(text));
});
ipcMain.handle("isabot:key-tap", async (e, key) => {
  assertAllowed(e);
  const n = getNut(); if (!n) throw new Error("nut-js no disponible");
  const K = n.Key[String(key).toUpperCase()];
  if (!K) throw new Error("Tecla desconocida: " + key);
  await n.keyboard.pressKey(K);
  await n.keyboard.releaseKey(K);
});

ipcMain.handle("isabot:open-app", async (e, cmd) => {
  assertAllowed(e);
  const ok = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Cancelar", "Abrir"],
    defaultId: 1,
    cancelId: 0,
    title: "IsaBot quiere abrir una app",
    message: `¿Permitir a IsaBot abrir?\n\n${cmd}`,
  });
  if (ok.response !== 1) throw new Error("Cancelado por el usuario");
  spawn(cmd, { detached: true, stdio: "ignore", shell: true }).unref();
  return true;
});

ipcMain.handle("isabot:read-file", async (e) => {
  assertAllowed(e);
  const r = await dialog.showOpenDialog(mainWindow, { properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  const buf = fs.readFileSync(p);
  return { path: p, name: path.basename(p), size: buf.length, base64: buf.toString("base64") };
});

ipcMain.handle("isabot:write-file", async (e, suggestedName, contents) => {
  assertAllowed(e);
  const r = await dialog.showSaveDialog(mainWindow, { defaultPath: suggestedName ?? "isabot-output.txt" });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, contents, "utf8");
  return r.filePath;
});

ipcMain.handle("isabot:info", async (e) => {
  assertAllowed(e);
  return { platform: process.platform, arch: process.arch, version: app.getVersion() };
});
