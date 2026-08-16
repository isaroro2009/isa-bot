import type { StudioKind } from "@/lib/studio.functions";

export const KIND_META: Record<
  StudioKind,
  { emoji: string; label: string; blurb: string; gradient: string }
> = {
  design: {
    emoji: "🎨",
    label: "Diseño",
    blurb: "Formas, texto e imágenes en un lienzo libre",
    gradient: "linear-gradient(135deg,#ffd6ec,#e0d5ff)",
  },
  paint: {
    emoji: "🖌️",
    label: "Pintura",
    blurb: "Pinceles, capas y color como en Procreate",
    gradient: "linear-gradient(135deg,#d8f0ff,#ffd6ec)",
  },
  pixel: {
    emoji: "👾",
    label: "Pixel Art",
    blurb: "Rejilla, lápiz y balde con paleta pastel",
    gradient: "linear-gradient(135deg,#e0d5ff,#c9f2ff)",
  },
  doc: {
    emoji: "📄",
    label: "Documento",
    blurb: "Texto con títulos y listas, exporta PDF",
    gradient: "linear-gradient(135deg,#fff0d6,#ffd6ec)",
  },
  slides: {
    emoji: "🎤",
    label: "Presentación",
    blurb: "Diapositivas 16:9 y modo presentar",
    gradient: "linear-gradient(135deg,#ffe6c7,#e0d5ff)",
  },
  sheet: {
    emoji: "📊",
    label: "Hoja de cálculo",
    blurb: "Celdas y fórmulas básicas, exporta CSV",
    gradient: "linear-gradient(135deg,#d6ffe9,#d8f0ff)",
  },
};

export const PASTEL = [
  "#ff85a2",
  "#ffb3c9",
  "#ffd6ec",
  "#c9a0e8",
  "#a58eff",
  "#7a3fbf",
  "#c9f2ff",
  "#8ed7ff",
  "#a8f0d0",
  "#ffe6a8",
  "#ffb997",
  "#ffffff",
  "#3d2450",
  "#000000",
];

export type DesignItem = {
  id: string;
  type: "rect" | "ellipse" | "text" | "image";
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  radius?: number;
  text?: string;
  size?: number;
  weight?: number;
  color?: string;
  align?: "left" | "center" | "right";
  src?: string;
};

export type DesignDoc = { w: number; h: number; bg: string; items: DesignItem[] };

export const DESIGN_TEMPLATES: Array<{ key: string; label: string; doc: DesignDoc }> = [
  {
    key: "post",
    label: "📱 Post cuadrado",
    doc: {
      w: 1080,
      h: 1080,
      bg: "#fff5fa",
      items: [
        { id: "t1", type: "rect", x: 0, y: 760, w: 1080, h: 320, fill: "#ffd6ec", radius: 0 },
        {
          id: "t2",
          type: "text",
          x: 90,
          y: 300,
          w: 900,
          h: 220,
          text: "Tu idea aquí ✨",
          size: 96,
          weight: 800,
          color: "#6b3fa0",
          align: "center",
        },
      ],
    },
  },
  {
    key: "story",
    label: "📖 Story vertical",
    doc: {
      w: 1080,
      h: 1920,
      bg: "#f6eefb",
      items: [
        { id: "s1", type: "ellipse", x: 140, y: 320, w: 800, h: 800, fill: "#e0d5ff" },
        {
          id: "s2",
          type: "text",
          x: 100,
          y: 1300,
          w: 880,
          h: 260,
          text: "Escribe tu mensaje",
          size: 88,
          weight: 800,
          color: "#7a3fbf",
          align: "center",
        },
      ],
    },
  },
  {
    key: "poster",
    label: "🖼️ Póster",
    doc: {
      w: 1240,
      h: 1754,
      bg: "#ffffff",
      items: [
        { id: "p1", type: "rect", x: 80, y: 80, w: 1080, h: 900, fill: "#ffd6ec", radius: 48 },
        {
          id: "p2",
          type: "text",
          x: 100,
          y: 1050,
          w: 1040,
          h: 300,
          text: "TÍTULO GRANDE",
          size: 120,
          weight: 800,
          color: "#3d2450",
          align: "left",
        },
      ],
    },
  },
  {
    key: "blank",
    label: "⬜ En blanco",
    doc: { w: 1080, h: 1080, bg: "#ffffff", items: [] },
  },
];

export function defaultContent(kind: StudioKind): unknown {
  switch (kind) {
    case "design":
      return DESIGN_TEMPLATES[3].doc;
    case "paint":
      return { w: 1000, h: 700, layers: [null, null, null], active: 0 };
    case "pixel":
      return { size: 32, pixels: Array(32 * 32).fill(""), color: "#ff85a2" };
    case "doc":
      return {
        html: "<h1>Mi documento</h1><p>Empieza a escribir tu idea aquí…</p>",
      };
    case "slides":
      return {
        slides: [
          { title: "Mi presentación", body: "Subtítulo o idea principal", bg: "#f6eefb", accent: "#7a3fbf" },
        ],
      };
    case "sheet":
      return { cols: 8, rows: 20, cells: {} as Record<string, string> };
  }
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
