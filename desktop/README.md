# IsaBot Desktop 🖥️

App nativa que envuelve **isa-bot.lovable.app** y le da a IsaBot control real del PC:
screenshot de pantalla, mover el mouse, escribir, abrir apps, leer/escribir archivos.

La web (carpeta `src/` en la raíz del proyecto) **no depende de esto** — sigue funcionando
100% en el navegador. Este `desktop/` es un envoltorio aparte con su propio `package.json`.

## Cómo correrlo en tu PC

Necesitas Node 18+ y las herramientas de compilación de tu sistema (para el módulo nativo
`@nut-tree-fork/nut-js`):

- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Windows:** `npm i -g windows-build-tools` o instalar Visual Studio Build Tools
- **Linux:** `sudo apt install build-essential libxtst-dev libpng++-dev`

Luego:

```bash
cd desktop
npm install
npm start                 # abre la ventana con IsaBot
```

## Empaquetar para distribuir

```bash
npm run pack:linux        # → desktop/electron-release/IsaBot-linux-x64/
npm run pack:mac          # → desktop/electron-release/IsaBot-darwin-x64/
npm run pack:win          # → desktop/electron-release/IsaBot-win32-x64/
```

Comprime la carpeta resultante (`.tar.gz` o `.zip`) y súbela a `public/` para descarga
desde la web.

> Cross-compile funciona desde Linux, pero los módulos nativos deben compilarse
> **en la plataforma final**. Recomendación: correr cada `pack:*` en su propio SO
> (o usar GitHub Actions con matrix `linux/mac/win`).

## Qué expone al renderer

Todo pasa por `window.isabotDesktop` (definido en `preload.cjs`, aislado):

| Método | Uso |
|---|---|
| `screenshot()` | PNG base64 de la pantalla |
| `getScreenSize()` | `{width, height}` |
| `moveMouse(x, y)` / `click()` / `doubleClick()` | Control del mouse |
| `type(text)` / `keyTap("enter")` | Teclado |
| `openApp(cmd)` | Ejecuta un comando (pide confirmación) |
| `readFile()` / `writeFile(name, txt)` | Abre diálogos nativos |

## Seguridad

- `contextIsolation: true`, `nodeIntegration: false`.
- Sólo el origin `https://isa-bot.lovable.app` (y `localhost:8080` en dev) puede llamar
  las APIs — cualquier iframe/anuncio queda bloqueado.
- `openApp` y `writeFile` piden confirmación con diálogo del sistema.

## Cambiar la URL en desarrollo

```bash
ISABOT_URL=http://localhost:8080 npm start
```
