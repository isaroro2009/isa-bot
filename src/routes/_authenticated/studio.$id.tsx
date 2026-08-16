import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getStudioProject, saveStudioProject, studioAiImage, studioAiText, type StudioProject } from "@/lib/studio.functions";
import { KIND_META, defaultContent, type DesignDoc } from "@/components/studio/studio-model";
import { DesignEditor } from "@/components/studio/DesignEditor";
import { PaintEditor, type PaintDoc } from "@/components/studio/PaintEditor";
import { PixelEditor, pixelToPng, type PixelDoc } from "@/components/studio/PixelEditor";
import { DocEditor, type DocDoc } from "@/components/studio/DocEditor";
import { SlidesEditor, slidesToPrintHtml, type SlidesDoc } from "@/components/studio/SlidesEditor";
import { SheetEditor, sheetToRows, type SheetDoc } from "@/components/studio/SheetEditor";
import { downloadDataUrl, downloadText, printHtml, renderDesignToPng, toCsv } from "@/components/studio/studio-export";

export const Route = createFileRoute("/_authenticated/studio/$id")({
  head: () => ({
    meta: [
      { title: "Editor de IsaStudio — crea y exporta tus ideas" },
      { name: "description", content: "Edita tu proyecto creativo en IsaStudio y expórtalo como PNG, PDF o CSV." },
      { property: "og:title", content: "Editor de IsaStudio" },
      { property: "og:description", content: "Edita tu proyecto creativo en IsaStudio y expórtalo cuando quieras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioEditorPage,
});

function StudioEditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchProject = useServerFn(getStudioProject);
  const save = useServerFn(saveStudioProject);
  const aiText = useServerFn(studioAiText);
  const aiImage = useServerFn(studioAiImage);

  const [project, setProject] = useState<StudioProject | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const dirty = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetchProject({ data: { id } });
        if (!alive) return;
        setProject(r.project);
        const empty = !r.content || Object.keys(r.content).length === 0;
        setContent(empty ? defaultContent(r.project.kind) : r.content);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const doSave = useCallback(
    async (thumbnail?: string | null) => {
      if (!project) return;
      setStatus("Guardando…");
      try {
        await save({ data: { id: project.id, content, ...(thumbnail !== undefined ? { thumbnail } : {}) } });
        dirty.current = false;
        setStatus("✅ Guardado");
        setTimeout(() => setStatus(""), 1800);
      } catch (e) {
        setStatus(`⚠️ ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [project, content, save],
  );

  // Autoguardado suave cada 12s si hay cambios.
  useEffect(() => {
    const t = setInterval(() => {
      if (dirty.current) void doSave();
    }, 12000);
    return () => clearInterval(t);
  }, [doSave]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function change(next: any) {
    dirty.current = true;
    setContent(next);
  }

  async function onAiText(prompt: string): Promise<string | null> {
    const r = await aiText({ data: { prompt } });
    if (r.error) {
      setStatus(`⚠️ ${r.error}`);
      return null;
    }
    return r.text || null;
  }

  async function onAiImage(prompt: string): Promise<string | null> {
    const r = await aiImage({ data: { prompt } });
    if (r.error) {
      setStatus(`⚠️ ${r.error}`);
      return null;
    }
    return r.image;
  }

  async function exportProject() {
    if (!project) return;
    const name = project.title.replace(/[^\w\s-]+/g, "").trim() || "isastudio";
    if (project.kind === "design") {
      const png = await renderDesignToPng(content as DesignDoc);
      downloadDataUrl(png, `${name}.png`);
      await doSave(png);
    } else if (project.kind === "pixel") {
      const png = pixelToPng(content as PixelDoc);
      downloadDataUrl(png, `${name}.png`);
      await doSave(png);
    } else if (project.kind === "paint") {
      const d = content as PaintDoc;
      const canvas = document.createElement("canvas");
      canvas.width = d.w;
      canvas.height = d.h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, d.w, d.h);
        for (const src of d.layers) {
          if (!src) continue;
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0, d.w, d.h);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = src;
          });
        }
      }
      const png = canvas.toDataURL("image/png");
      downloadDataUrl(png, `${name}.png`);
      await doSave(png);
    } else if (project.kind === "doc") {
      printHtml(project.title, (content as DocDoc).html);
    } else if (project.kind === "slides") {
      printHtml(project.title, slidesToPrintHtml(content as SlidesDoc), "body{padding:0;}");
    } else if (project.kind === "sheet") {
      downloadText(toCsv(sheetToRows(content as SheetDoc)), `${name}.csv`, "text/csv");
    }
  }

  if (loading) return <div className="studio-page"><p className="studio-hint">Abriendo tu proyecto…</p></div>;
  if (error || !project)
    return (
      <div className="studio-page">
        <p className="studio-error">{error ?? "Proyecto no encontrado"}</p>
        <button className="studio-back" onClick={() => navigate({ to: "/studio" })}>← Volver a IsaStudio</button>
      </div>
    );

  const meta = KIND_META[project.kind];

  return (
    <div className="studio-page editor">
      <header className="studio-editor-bar">
        <span className="studio-brand-badge">{meta.emoji}</span>
        <button className="studio-back" onClick={() => navigate({ to: "/studio" })}>← IsaStudio</button>

        <input
          className="studio-title-input"
          value={project.title}
          onChange={(e) => {
            setProject({ ...project, title: e.target.value });
            dirty.current = true;
          }}
          onBlur={() => void save({ data: { id: project.id, title: project.title } })}
        />
        <span className="studio-kind-tag">{meta.emoji} {meta.label}</span>
        <div className="studio-bar-actions">
          <span className="studio-status">{status}</span>
          <button className="studio-tool" onClick={() => void doSave()}>💾 Guardar</button>
          <button className="studio-tool ai" onClick={() => void exportProject()}>
            {project.kind === "doc" || project.kind === "slides" ? "🖨️ PDF" : project.kind === "sheet" ? "⬇️ CSV" : "⬇️ PNG"}
          </button>
        </div>
      </header>

      {project.kind === "design" && <DesignEditor doc={content as DesignDoc} onChange={change} onAiImage={onAiImage} />}
      {project.kind === "paint" && <PaintEditor doc={content as PaintDoc} onChange={change} />}
      {project.kind === "pixel" && <PixelEditor doc={content as PixelDoc} onChange={change} />}
      {project.kind === "doc" && <DocEditor doc={content as DocDoc} onChange={change} onAiText={onAiText} />}
      {project.kind === "slides" && <SlidesEditor doc={content as SlidesDoc} onChange={change} onAiText={onAiText} />}
      {project.kind === "sheet" && <SheetEditor doc={content as SheetDoc} onChange={change} />}
    </div>
  );
}
