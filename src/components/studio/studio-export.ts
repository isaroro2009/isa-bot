import type { DesignDoc } from "./studio-model";

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("no se pudo cargar la imagen"));
    img.src = src;
  });
}

/** Dibuja un documento de diseño en un canvas y devuelve el PNG. */
export async function renderDesignToPng(doc: DesignDoc, maxSide = 1600): Promise<string> {
  const scale = Math.min(1, maxSide / Math.max(doc.w, doc.h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(doc.w * scale);
  canvas.height = Math.round(doc.h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.scale(scale, scale);
  ctx.fillStyle = doc.bg || "#ffffff";
  ctx.fillRect(0, 0, doc.w, doc.h);

  for (const it of doc.items) {
    if (it.type === "rect") {
      ctx.fillStyle = it.fill || "#ffd6ec";
      roundRect(ctx, it.x, it.y, it.w, it.h, it.radius ?? 0);
      ctx.fill();
    } else if (it.type === "ellipse") {
      ctx.fillStyle = it.fill || "#e0d5ff";
      ctx.beginPath();
      ctx.ellipse(it.x + it.w / 2, it.y + it.h / 2, it.w / 2, it.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (it.type === "text") {
      const size = it.size ?? 48;
      ctx.fillStyle = it.color || "#3d2450";
      ctx.font = `${it.weight ?? 700} ${size}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
      ctx.textBaseline = "top";
      ctx.textAlign = it.align === "center" ? "center" : it.align === "right" ? "right" : "left";
      const originX = it.align === "center" ? it.x + it.w / 2 : it.align === "right" ? it.x + it.w : it.x;
      const words = (it.text || "").split(/\s+/);
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > it.w && line) {
          lines.push(line);
          line = word;
        } else line = test;
      }
      if (line) lines.push(line);
      lines.forEach((l, i) => ctx.fillText(l, originX, it.y + i * size * 1.2));
    } else if (it.type === "image" && it.src) {
      try {
        const img = await loadImage(it.src);
        ctx.drawImage(img, it.x, it.y, it.w, it.h);
      } catch {
        /* imagen no disponible */
      }
    }
  }
  return canvas.toDataURL("image/png");
}

/** Imprime HTML en una ventana nueva para guardarlo como PDF. */
export function printHtml(title: string, bodyHtml: string, extraCss = "") {
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) {
    alert("Tu navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e intenta de nuevo.");
    return;
  }
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#3d2450;padding:48px;line-height:1.6;}
  h1,h2,h3{color:#6b3fa0;}
  img{max-width:100%;}
  @page{margin:16mm;}
  ${extraCss}
</style></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export function toCsv(rows: string[][]): string {
  return rows
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
    .join("\n");
}

export function downloadText(text: string, filename: string, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("no se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}
