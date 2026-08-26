import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  createStudioProject,
  deleteStudioProject,
  duplicateStudioProject,
  listStudioProjects,
  renameStudioProject,
  type StudioKind,
  type StudioProject,
} from "@/lib/studio.functions";
import { KIND_META, defaultContent } from "@/components/studio/studio-model";
import { downloadDataUrl } from "@/components/studio/studio-export";

export const Route = createFileRoute("/_authenticated/studio/")({
  head: () => ({
    meta: [
      { title: "IsaStudio — suite creativa tipo Canva con IA" },
      {
        name: "description",
        content:
          "Plantillas, lienzo editable, arrastrar y soltar y exportación instantánea a PDF o imagen. La suite creativa de IsaBot, gratis.",
      },
      { property: "og:title", content: "IsaStudio — la suite creativa de IsaBot" },
      {
        property: "og:description",
        content: "Elige una plantilla, edita en el lienzo y exporta a PDF o imagen en un clic.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioGallery,
});

const ORDER: StudioKind[] = ["design", "paint", "pixel", "doc", "slides", "sheet"];

function StudioGallery() {
  const navigate = useNavigate();
  const fetchProjects = useServerFn(listStudioProjects);
  const create = useServerFn(createStudioProject);
  const remove = useServerFn(deleteStudioProject);
  const copy = useServerFn(duplicateStudioProject);
  const rename = useServerFn(renameStudioProject);

  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<StudioKind>("design");
  const [dragOver, setDragOver] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetchProjects();
      setProjects(r.projects);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const q = new URLSearchParams(window.location.search).get("new");
    if (q && (ORDER as string[]).includes(q)) {
      setKind(q as StudioKind);
      void newProject(q as StudioKind);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function newProject(k: StudioKind) {
    setBusy(true);
    try {
      const r = await create({
        data: { kind: k, title: `${KIND_META[k].label} sin título`, content: defaultContent(k) },
      });
      void navigate({ to: "/studio/$id", params: { id: r.project.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const meta = KIND_META[kind];
  const last = projects[0];

  return (
    <div className="studio-page">
      <div className="studio-appbar">
        <div className="studio-brand">
          <span className="studio-brand-badge">🎨</span>
          <strong>IsaStudio</strong>
        </div>
        <nav className="studio-tabs" aria-label="Herramientas de IsaStudio">
          {ORDER.map((k) => (
            <button key={k} className="studio-tab" disabled={busy} onClick={() => setKind(k)} title={KIND_META[k].blurb}>
              <span>{KIND_META[k].emoji}</span>
              {KIND_META[k].label}
            </button>
          ))}
        </nav>
      </div>

      <header className="studio-head">
        <button className="studio-back" onClick={() => navigate({ to: "/" })}>← Volver a IsaBot</button>
        <h1>🎨 IsaStudio</h1>
        <p>Elige una plantilla, edita en el lienzo y exporta a PDF o imagen al instante. Todo gratis y guardado en tu cuenta.</p>
      </header>

      {/* ── Espacio de trabajo tipo Canva ── */}
      <div className="canva-shell">
        <aside className="canva-side">
          <h3>Plantillas</h3>
          <div className="canva-templates">
            {ORDER.map((k) => (
              <button
                key={k}
                className={`canva-template${k === kind ? " active" : ""}`}
                onClick={() => setKind(k)}
              >
                <span className="emoji">{KIND_META[k].emoji}</span>
                <span>
                  <b>{KIND_META[k].label}</b>
                  <small>{KIND_META[k].blurb}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="canva-stage">
          <div className="canva-toolbar">
            <strong style={{ color: "#4a2b8a" }}>{meta.emoji} {meta.label}</strong>
            <button className="primary" disabled={busy} onClick={() => void newProject(kind)}>
              ✨ Crear con esta plantilla
            </button>
            {last && (
              <button onClick={() => navigate({ to: "/studio/$id", params: { id: last.id } })}>
                ↩️ Seguir con “{last.title}”
              </button>
            )}
            <button
              onClick={() => {
                if (last?.thumbnail) downloadDataUrl(last.thumbnail, `${last.title || "isastudio"}.png`);
                else if (last) navigate({ to: "/studio/$id", params: { id: last.id } });
              }}
            >
              🖼️ Exportar imagen
            </button>
            <button
              onClick={() => {
                if (last) navigate({ to: "/studio/$id", params: { id: last.id } });
              }}
            >
              🖨️ Exportar PDF
            </button>
          </div>

          <div
            className={`canva-canvas${dragOver ? " drag" : ""}`}
            style={{ background: meta.gradient }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void newProject(kind);
            }}
          >
            {last?.thumbnail ? (
              <img src={last.thumbnail} alt={last.title} style={{ maxHeight: 260, borderRadius: 14 }} />
            ) : (
              <div>
                <div className="big">{meta.emoji}</div>
                <strong>Lienzo de {meta.label}</strong>
                <p style={{ fontSize: 13, margin: "6px 0 0" }}>
                  Arrastra una imagen aquí o pulsa “Crear con esta plantilla” para abrir el editor.
                </p>
              </div>
            )}
          </div>

          <div className="canva-drops">
            <div className="canva-drop">🖼️ Suelta imágenes</div>
            <div className="canva-drop">🔤 Añade texto</div>
            <div className="canva-drop">🎨 Formas y colores</div>
            <div className="canva-drop">🤖 Genera con IA</div>
          </div>
        </section>
      </div>

      <section className="studio-list">
        <h2>Mis proyectos {projects.length > 0 && <span>({projects.length})</span>}</h2>
        {loading && <p className="studio-hint">Cargando tus creaciones…</p>}
        {error && <p className="studio-error">{error}</p>}
        {!loading && projects.length === 0 && (
          <p className="studio-hint">Todavía no tienes proyectos. Elige una plantilla a la izquierda 🌸</p>
        )}
        <div className="studio-grid">
          {projects.map((p) => (
            <article key={p.id} className="studio-card">
              <div className="studio-window">
                <i /><i /><i />
                <b>{KIND_META[p.kind]?.emoji} {KIND_META[p.kind]?.label}</b>
              </div>
              <button
                className="studio-card-preview"
                style={{ background: KIND_META[p.kind]?.gradient }}
                onClick={() => navigate({ to: "/studio/$id", params: { id: p.id } })}
              >
                {p.thumbnail ? <img src={p.thumbnail} alt={p.title} /> : <span>{KIND_META[p.kind]?.emoji}</span>}
              </button>
              <div className="studio-card-body">
                <strong>{p.title}</strong>
                <small>
                  {KIND_META[p.kind]?.label} · {new Date(p.updated_at).toLocaleDateString("es")}
                </small>
                <div className="studio-card-actions">
                  <button
                    onClick={async () => {
                      const title = window.prompt("Nuevo nombre", p.title);
                      if (!title) return;
                      await rename({ data: { id: p.id, title } });
                      void load();
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={async () => {
                      await copy({ data: { id: p.id } });
                      void load();
                    }}
                  >
                    ⧉
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`¿Borrar "${p.title}"?`)) return;
                      await remove({ data: { id: p.id } });
                      void load();
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
