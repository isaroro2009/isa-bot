// 🎨 Tienda de temas de interfaz comprables con IsaBot Coins (IBC).
// Todo vive en el cliente: cero llamadas extra al servidor, cero tokens.

export type IsaTheme = {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  /** 0 = gratis para todas */
  price: number;
  swatch: [string, string, string];
};

export const ISA_THEMES: IsaTheme[] = [
  { id: "default", name: "Classic", emoji: "💜", tagline: "El rosa y morado de siempre", price: 0, swatch: ["#ff8fba", "#b06cf0", "#fff0f7"] },
  { id: "pastel", name: "Pastel Dream", emoji: "🍬", tagline: "Menta, lila y durazno suave", price: 20, swatch: ["#ffd6ec", "#c7f0ea", "#fff6e5"] },
  { id: "neon", name: "Dark Neon", emoji: "⚡", tagline: "Modo oscuro cyber con neón cian", price: 20, swatch: ["#0b0f1e", "#00e5ff", "#ff3ea5"] },
  { id: "sakura", name: "Sakura Blossom", emoji: "🌸", tagline: "Pétalos rosados y verde jade", price: 20, swatch: ["#ffc2d4", "#f7f0ff", "#8ac6a4"] },
  { id: "golden", name: "Golden Luxe", emoji: "👑", tagline: "Oro pulido sobre carbón", price: 20, swatch: ["#1a1508", "#e3bc6d", "#fff3cf"] },
  { id: "ocean", name: "Ocean Mint", emoji: "🌊", tagline: "Azules profundos y menta fresca", price: 20, swatch: ["#0d3b53", "#4fd3c4", "#eafcff"] },
];

const OWNED_KEY = "isabot.themes.owned";
const ACTIVE_KEY = "isabot.themes.active";

export function ownedThemes(): string[] {
  if (typeof window === "undefined") return ["default"];
  try {
    const raw = window.localStorage.getItem(OWNED_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.from(new Set(["default", ...arr]));
  } catch {
    return ["default"];
  }
}

export function ownTheme(id: string) {
  if (typeof window === "undefined") return;
  const next = Array.from(new Set([...ownedThemes(), id]));
  window.localStorage.setItem(OWNED_KEY, JSON.stringify(next));
}

export function activeTheme(): string {
  if (typeof window === "undefined") return "default";
  return window.localStorage.getItem(ACTIVE_KEY) ?? "default";
}

export function applyTheme(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_KEY, id);
  document.documentElement.setAttribute("data-isa-theme", id);
}

/** Se llama una vez al montar la app para restaurar el tema elegido. */
export function restoreTheme() {
  applyTheme(activeTheme());
}
