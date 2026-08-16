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

export const Route = createFileRoute("/_authenticated/studio/")({
  head: () => ({
    meta: [
      { title: "IsaStudio — crea diseños, documentos y presentaciones" },
      {
        name: "description",
        content:
          "La suite creativa de IsaBot: diseño, pintura, pixel art, documentos, presentaciones y hojas de cálculo con IA, gratis.",
      },
      { property: "og:title", content: "IsaStudio — la suite creativa de IsaBot" },
      {
        property: "og:description",
        content: "Crea tus ideas: diseño, pintura, pixel art, documentos, presentaciones y hojas de cálculo con IA.",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function newProject(kind: StudioKind) {
    setBusy(true);
    try {
      const r = await create({
        data: { kind, title: `${KIND_META[kind].label} sin título`, content: defaultContent(kind) },
      });
      void navigate({ to: "/studio/$id", params: { id: r.project.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio-page">
      <div className="studio-appbar">
        <div className="studio-brand">
          <span className="studio-brand-badge">🤖</span>
          <strong>IsaStudio</strong>
        </div>
        <nav className="studio-tabs" aria-label="Herramientas de IsaStudio">
          {ORDER.map((k) => (
            <button key={k} className="studio-tab" disabled={busy} onClick={() => newProject(k)} title={KIND_META[k].blurb}>
              <span>{KIND_META[k].emoji}</span>
              {KIND_META[k].label}
            </button>
          ))}
        </nav>
      </div>

      <header className="studio-head">
        <button className="studio-back" onClick={() => navigate({ to: "/" })}>← Volver a IsaBot</button>
        <h1>🎨 IsaStudio</h1>
        <p>Tu suite creativa completa: diseña, pinta, escribe, presenta y calcula. Todo gratis y guardado en la nube.</p>
      </header>

      <section className="studio-kinds">
        {ORDER.map((k) => (
          <button
            key={k}
            className="studio-kind"
            style={{ background: KIND_META[k].gradient }}
            disabled={busy}
            onClick={() => newProject(k)}
          >
            <span className="studio-kind-emoji">{KIND_META[k].emoji}</span>
            <strong>{KIND_META[k].label}</strong>
            <small>{KIND_META[k].blurb}</small>
          </button>
        ))}
      </section>

      <section className="studio-list">
        <h2>Mis proyectos {projects.length > 0 && <span>({projects.length})</span>}</h2>
        {loading && <p className="studio-hint">Cargando tus creaciones…</p>}
        {error && <p className="studio-error">{error}</p>}
        {!loading && projects.length === 0 && (
          <p className="studio-hint">Todavía no tienes proyectos. Elige arriba qué quieres crear 🌸</p>
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
