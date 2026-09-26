import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listMuseum, uploadCertificate, deleteCertificate } from "@/lib/haven.functions";
import "@/components/guide.css";

export const Route = createFileRoute("/_authenticated/museo")({
  head: () => ({
    meta: [
      { title: "IsaMuseum — Museo de Certificados | IsaHaven" },
      { name: "description", content: "Exhibe tus certificados de cursos en IsaMuseum, validados con IA, y gana IsaBot Coins." },
      { property: "og:title", content: "IsaMuseum — Museo de Certificados" },
      { property: "og:description", content: "La galería de logros de la comunidad IsaHaven." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Museum,
});

type Cert = Awaited<ReturnType<typeof listMuseum>>[number];

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1400;
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("No pude leer la imagen"));
    img.src = url;
  });
}

function Museum() {
  const list = useServerFn(listMuseum);
  const upload = useServerFn(uploadCertificate);
  const del = useServerFn(deleteCertificate);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Cert | null>(null);

  const refresh = () => list().then(setCerts).catch(() => undefined);
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Elige la imagen del certificado");
    setBusy(true);
    try {
      const image = await readImage(file);
      const r = await upload({ data: { title, issuer, image } });
      if (r.valid) toast.success(r.reward ? `🏆 ¡Certificado validado! +${r.reward} IsaBot Coins` : "🏆 Certificado validado (ya alcanzaste el bonus de hoy)");
      else toast.error(`No pudimos validarlo: ${r.reason}`);
      setTitle(""); setIssuer(""); setFile(null);
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir");
    } finally { setBusy(false); }
  };

  const shown = certs.filter((c) => (tab === "mine" ? c.mine : c.valid));

  return (
    <div className="parent-page">
      <div className="parent-wrap" style={{ maxWidth: 1080 }}>
        <div className="parent-card">
          <h1 style={{ margin: 0 }}>🏛️ IsaMuseum</h1>
          <p className="parent-note">El museo de logros de IsaHaven. Sube tus certificados: IsaBot los valida con IA y ganas <b>+50 IsaBot Coins</b> (hasta 3 por día).</p>
          <Link to="/" className="parent-note">← Volver a IsaHaven</Link>
        </div>

        <form className="parent-card" onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Exhibir un certificado</h3>
          <input className="parent-input haven-input" required placeholder="Nombre del curso" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="parent-input haven-input" placeholder="Emisor (Coursera, Platzi, universidad…)" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button className="guide-btn" disabled={busy} style={{ justifySelf: "start" }}>{busy ? "Validando con IA…" : "✨ Validar y exhibir"}</button>
        </form>

        <div className="parent-modes" style={{ marginBottom: 14 }}>
          <button className={`guide-btn ${tab === "all" ? "" : "ghost"}`} onClick={() => setTab("all")}>Galería de la comunidad</button>
          <button className={`guide-btn ${tab === "mine" ? "" : "ghost"}`} onClick={() => setTab("mine")}>Mis certificados</button>
        </div>

        {shown.length === 0 && <div className="parent-card parent-note">Aún no hay certificados aquí. ¡Sé la primera persona en exhibir uno! 🏆</div>}
        <div className="museum-grid">
          {shown.map((c) => (
            <figure key={c.id} className="museum-frame" onClick={() => setOpen(c)}>
              <img src={c.image_data} alt={c.title} loading="lazy" />
              <figcaption>
                <b>{c.title}</b>
                <span>{c.issuer || "—"}</span>
                <span className={c.valid ? "museum-ok" : "museum-no"}>{c.valid ? `✓ Validado${c.reward ? ` · +${c.reward} 🪙` : ""}` : `✗ ${c.ai_verdict}`}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      {open && (
        <div className="museum-lightbox" onClick={() => setOpen(null)}>
          <div onClick={(e) => e.stopPropagation()} className="parent-card" style={{ maxWidth: 900 }}>
            <img src={open.image_data} alt={open.title} style={{ width: "100%", borderRadius: 16 }} />
            <h3>{open.title}</h3>
            <p className="parent-note">{open.ai_verdict}</p>
            <div className="parent-modes">
              <button className="guide-btn ghost" onClick={() => setOpen(null)}>Cerrar</button>
              {open.mine && (
                <button className="guide-btn ghost" onClick={async () => { await del({ data: { id: open.id } }); setOpen(null); void refresh(); }}>🗑️ Retirar</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
