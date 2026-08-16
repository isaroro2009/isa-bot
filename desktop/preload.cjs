// Puente seguro entre la web de IsaBot y el proceso principal de Electron.
// Sólo expone la superficie declarada aquí — nada de `require` en el renderer.
const { contextBridge, ipcRenderer } = require("electron");

const api = {
  isDesktop: true,
  info: () => ipcRenderer.invoke("isabot:info"),

  // Visión
  screenshot: () => ipcRenderer.invoke("isabot:screenshot"),
  getScreenSize: () => ipcRenderer.invoke("isabot:screen-size"),

  // Control
  moveMouse: (x, y) => ipcRenderer.invoke("isabot:mouse-move", x, y),
  click: (button = "left") => ipcRenderer.invoke("isabot:click", button),
  doubleClick: () => ipcRenderer.invoke("isabot:double-click"),
  type: (text) => ipcRenderer.invoke("isabot:type", text),
  keyTap: (key) => ipcRenderer.invoke("isabot:key-tap", key),

  // Sistema
  openApp: (cmd) => ipcRenderer.invoke("isabot:open-app", cmd),
  readFile: () => ipcRenderer.invoke("isabot:read-file"),
  writeFile: (suggestedName, contents) => ipcRenderer.invoke("isabot:write-file", suggestedName, contents),
};

contextBridge.exposeInMainWorld("isabotDesktop", api);
