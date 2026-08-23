/**
 * 📄 Motor de PDF profesional de IsaBot (cliente).
 * Cabecera con degradado rosa/slate, emblema, bloque de metadatos y secciones.
 */

export type IsaPdfResult = {
  blob: Blob;
  dataUrl: string;
  base64: string;
  filename: string;
  /** Texto original (markdown) usado para generar el PDF. */
  text: string;
};

type Section = { heading?: string; lines: string[] };

function parseSections(markdown: string): Section[] {
  const out: Section[] = [];
  let current: Section = { lines: [] };
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.replace(/[*`]/g, "").trimEnd();
    const h = line.match(/^\s*#{1,4}\s*(.+)$/);
    if (h) {
      if (current.heading || current.lines.length) out.push(current);
      current = { heading: h[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.heading || current.lines.length) out.push(current);
  return out;
}

export async function buildIsaBotPdf(title: string, content: string, meta?: Record<string, string>): Promise<IsaPdfResult> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 52;
  const width = W - M * 2;

  const drawHeader = () => {
    // Degradado rosa → slate simulado con franjas.
    const hH = 108;
    const from = [232, 121, 176];
    const to = [61, 68, 94];
    const steps = 60;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      doc.setFillColor(
        Math.round(from[0] + (to[0] - from[0]) * t),
        Math.round(from[1] + (to[1] - from[1]) * t),
        Math.round(from[2] + (to[2] - from[2]) * t),
      );
      doc.rect((W / steps) * i, 0, W / steps + 1, hH, "F");
    }
    // Emblema
    doc.setFillColor(255, 255, 255);
    doc.circle(M + 18, 54, 18, "F");
    doc.setTextColor(214, 96, 160);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("IB", M + 18, 60, { align: "center" });

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    const t = doc.splitTextToSize(title, width - 60) as string[];
    doc.text(t[0] ?? title, M + 46, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("IsaBot ✨ · Documento generado con IA", M + 46, 68);
  };

  const drawFooter = (page: number) => {
    doc.setDrawColor(232, 121, 176);
    doc.setLineWidth(1);
    doc.line(M, H - 44, W - M, H - 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(140, 130, 150);
    doc.text("Generado por IsaBot — isa-bot.lovable.app", M, H - 30);
    doc.text(`Página ${page}`, W - M, H - 30, { align: "right" });
  };

  drawHeader();
  let page = 1;
  let y = 140;

  // Bloque de metadatos
  const rows: [string, string][] = Object.entries({
    Fecha: new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }),
    Documento: title.slice(0, 60),
    ...(meta ?? {}),
  }) as [string, string][];

  doc.setFillColor(248, 243, 250);
  doc.roundedRect(M, y - 18, width, rows.length * 18 + 16, 10, 10, "F");
  doc.setFontSize(9.5);
  for (const [k, v] of rows) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(160, 107, 138);
    doc.text(`${k}`, M + 12, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 58, 84);
    doc.text(doc.splitTextToSize(v, width - 130)[0] as string, M + 110, y);
    y += 18;
  }
  y += 26;

  const ensure = (need: number) => {
    if (y + need > H - 60) {
      drawFooter(page);
      doc.addPage();
      page += 1;
      y = M + 10;
    }
  };

  for (const section of parseSections(content)) {
    if (section.heading) {
      ensure(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(107, 63, 160);
      doc.text(section.heading, M, y);
      doc.setDrawColor(240, 210, 232);
      doc.line(M, y + 6, M + width, y + 6);
      y += 24;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(52, 44, 62);
    for (const para of section.lines) {
      if (!para.trim()) {
        y += 8;
        continue;
      }
      const bullet = /^\s*[-•]\s+/.test(para);
      const text = para.replace(/^\s*[-•]\s+/, "");
      const lines = doc.splitTextToSize(text, width - (bullet ? 16 : 0)) as string[];
      for (let i = 0; i < lines.length; i++) {
        ensure(18);
        if (bullet && i === 0) {
          doc.setTextColor(214, 96, 160);
          doc.text("•", M, y);
          doc.setTextColor(52, 44, 62);
        }
        doc.text(lines[i], M + (bullet ? 16 : 0), y);
        y += 15;
      }
      y += 4;
    }
  }
  drawFooter(page);

  const blob = doc.output("blob") as Blob;
  const dataUrl = doc.output("datauristring") as string;
  const base64 = dataUrl.split(",")[1] ?? "";
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").slice(0, 40) || "isabot"}.pdf`;
  return { blob, dataUrl, base64, filename, text: content };
}
