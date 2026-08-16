// Puente para detectar si IsaBot corre dentro de la app de escritorio Electron.
// Si `window.isabotDesktop` existe, tenemos acceso a control real del PC.
// En web pura este objeto es `undefined` y todo cae al modo agente estándar.

export type IsaBotDesktopAPI = {
  isDesktop: true;
  info: () => Promise<{ platform: string; arch: string; version: string }>;
  screenshot: () => Promise<string>; // data URL base64
  getScreenSize: () => Promise<{ width: number; height: number }>;
  moveMouse: (x: number, y: number) => Promise<void>;
  click: (button?: "left" | "right" | "middle") => Promise<void>;
  doubleClick: () => Promise<void>;
  type: (text: string) => Promise<void>;
  keyTap: (key: string) => Promise<void>;
  openApp: (cmd: string) => Promise<boolean>;
  readFile: () => Promise<{ path: string; name: string; size: number; base64: string } | null>;
  writeFile: (suggestedName: string, contents: string) => Promise<string | null>;
};

declare global {
  interface Window {
    isabotDesktop?: IsaBotDesktopAPI;
  }
}

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && !!window.isabotDesktop?.isDesktop;
}

export function getDesktop(): IsaBotDesktopAPI | null {
  if (typeof window === "undefined") return null;
  return window.isabotDesktop ?? null;
}
