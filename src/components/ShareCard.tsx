import { useEffect, useRef, useState } from "react";

// 🌸 Card Aesthetic: convierte una respuesta de IsaBot en una imagen bonita
// con los colores de la app y la marca de agua de IsaBot.

const WATERMARK = "Generado con IsaBot 🌸 - isabot.space";

type Style = "pastel" | "neon";

const STYLES: Record<Style, {
  bg: [string, string];
  card: string;
  text: string;
  soft: string;
  accent: string;
  glow: string;
}> = {
  pastel: {
    bg: ["#ffe6f2", "#e9defc"],
    card: "rgba(255,255,255,0.92)",
    text: "#4a2e6b",
    soft: "#8b6fb0",
    accent: "#ff85a2",
    glow: "rgba(255,133,162,0.35)",
  },
  neon: {
    bg: ["#0b0620", "#160b33"],
    card: "rgba(18,10,40,0.92)",
    text: "#eafcff",
    soft: "#8be9ff",
    accent: "#ff4ecd",
    glow: "rgba(255,78,205,0.45)",
  },
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Dibuja la card y devuelve el dataURL PNG. */
export function renderShareCard(text: string, style: Style): string | null {
  const W = 1080;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const s = STYLES[style];

  // Texto limpio (sin markdown pesado)
  const clean = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_`#>]/g, "")
    .trim()
    .slice(0, 900);

  const padding = 72;
  const cardPad = 56;
  const maxTextWidth = W - padding * 2 - cardPad * 2;
  ctx.font = "36px system-ui, -apple-system, 'Segoe UI', sans-serif";
  const lines = wrap(ctx, clean, maxTextWidth).slice(0, 20);
  const lineH = 52;
  const H = Math.max(
    720,
    padding * 2 + cardPad * 2 + 120 + lines.length * lineH + 90,
  );
  canvas.width = W;
  canvas.height = H;

  // Fondo degradado
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, s.bg[0]);
  g.addColorStop(1, s.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Corazoncitos / confeti suave
  ctx.globalAlpha = style === "neon" ? 0.35 : 0.5;
  const deco = style === "neon" ? ["✦", "◆", "✧"] : ["🌸", "💜", "✨"];
  for (let i = 0; i < 18; i++) {
    ctx.font = `${24 + ((i * 7) % 22)}px system-ui`;
    ctx.fillStyle = i % 2 ? s.accent : s.soft;
    ctx.fillText(deco[i % deco.length]!, (i * 137) % (W - 40), 60 + ((i * 211) % (H - 80)));
  }
  ctx.globalAlpha = 1;

  // Tarjeta
  ctx.shadowColor = s.glow;
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = s.card;
  roundRect(ctx, padding, padding, W - padding * 2, H - padding * 2, 56);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Encabezado
  let y = padding + cardPad + 44;
  ctx.fillStyle = s.accent;
  ctx.font = "bold 44px system-ui, -apple-system, sans-serif";
  ctx.fillText("IsaBot 🌸", padding + cardPad, y);
  ctx.fillStyle = s.soft;
  ctx.font = "26px system-ui, -apple-system, sans-serif";
  y += 42;
  ctx.fillText("tu co-piloto de IA creativa", padding + cardPad, y);

  // Cuerpo
  y += 68;
  ctx.fillStyle = s.text;
  ctx.font = "36px system-ui, -apple-system, 'Segoe UI', sans-serif";
  for (const line of lines) {
    ctx.fillText(line, padding + cardPad, y);
    y += lineH;
  }

  // Marca de agua
  ctx.fillStyle = s.soft;
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.fillText(WATERMARK, padding + cardPad, H - padding - cardPad + 18);

  return canvas.toDataURL("image/png");
}

export function ShareCardButton({ text, neon }: { text: string; neon?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!text || text.startsWith("data:image")) return null;
  return (
    <>
      <button
        type="button"
        className="share-card-btn"
        title="Compartir esta respuesta como imagen"
        onClick={() => setOpen(true)}
      >
        🌸 Compartir Card Aesthetic
      </button>
      {open && <ShareCardModal text={text} defaultNeon={!!neon} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareCardModal({
  text,
  defaultNeon,
  onClose,
}: {
  text: string;
  defaultNeon: boolean;
  onClose: () => void;
}) {
  const [style, setStyle] = useState<Style>(defaultNeon ? "neon" : "pastel");
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const out = renderShareCard(text, style);
    if (mounted.current) setUrl(out);
    return () => {
      mounted.current = false;
    };
  }, [text, style]);

  async function share() {
    if (!url) return;
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], "isabot-card.png", { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (d: { files: File[] }) => boolean;
        share?: (d: { files: File[]; text?: string }) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], text: WATERMARK });
        return;
      }
    } catch {
      /* seguimos con la descarga */
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = "isabot-card.png";
    a.click();
    setMsg("Imagen descargada ✨");
    setTimeout(() => setMsg(null), 1800);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-card share-card-modal" onClick={(e) => e.stopPropagation()}>
        <h3>🌸 Card Aesthetic</h3>
        <p className="habits-sub">
          Comparte esta respuesta con el estilo de IsaBot. Se guarda con la marca{" "}
          <b>{WATERMARK}</b>
        </p>
        <div className="share-card-styles">
          <button
            type="button"
            className={style === "pastel" ? "active" : ""}
            onClick={() => setStyle("pastel")}
          >
            💜 Pastel
          </button>
          <button
            type="button"
            className={style === "neon" ? "active" : ""}
            onClick={() => setStyle("neon")}
          >
            ⚡ Cyberpunk Neón
          </button>
        </div>
        {url && <img className="share-card-preview" src={url} alt="Card de IsaBot" />}
        {msg && <div className="reminder-item">{msg}</div>}
        <div className="settings-actions">
          <button className="kawaii-sidebar-btn" onClick={() => void share()}>
            📤 Compartir / Descargar
          </button>
          <button className="kawaii-sidebar-btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
