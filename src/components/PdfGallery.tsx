import { useCallback, useEffect, useState } from "react";
import {
  PDF_GALLERY_EVENT,
  deletePdf,
  listPdfs,
  pdfDataUrl,
  type PdfDoc,
} from "@/lib/pdf-gallery";
import "@/components/ibc/ibc.css";

/** 📚 Galería de PDFs generados: ver, previsualizar y volver a descargar. */
export default function PdfGallery() {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<PdfDoc[]>([]);
  const [preview, setPreview] = useState<PdfDoc | null>(null);

  const refresh = useCallback(() => {
    void listPdfs().then(setDocs);
  }, []);

  useEffect(() => {
    const handler = () => {
      setOpen(true);
      refresh();
    };
    window.addEventListener(PDF_GALLERY_EVENT, handler);
    return () => window.removeEventListener(PDF_GALLERY_EVENT, handler);
  }, [refresh]);

  if (!open) return null;

  return (
    <div className="ibc-root ibc-overlay right" onClick={() => setOpen(false)}>
      <div className="ibc-panel ibc-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="ibc-head">
          <h3>📚 Galería de PDFs</h3>
          <button className="ibc-x" onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
        </div>

        {docs.length === 0 ? (
          <p className="ibc-empty-note">
            Todavía no has creado documentos. Pídeme en el chat algo como
            <b> «hazme un PDF con un plan de contenido»</b> y aparecerá aquí ✨
          </p>
        ) : (
          <ul className="ibc-tx-list">
            {docs.map((d) => (
              <li key={d.id} className="ibc-tx" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                <span>
                  📄 {d.title}
                  <span className="ibc-tx-date">
                    {new Date(d.createdAt).toLocaleDateString("es", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
                <div className="doc-preview-actions">
                  <button className="action-card-btn ghost" onClick={() => setPreview(d)}>👁️ Ver</button>
                  <a className="action-card-btn" href={pdfDataUrl(d.base64)} download={d.filename}>⬇️ Descargar</a>
                  <button
                    className="action-card-btn ghost"
                    onClick={async () => {
                      await deletePdf(d.id);
                      refresh();
                    }}
                  >
                    🗑️ Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {preview && (
        <div className="ibc-confirm-back" onClick={() => setPreview(null)}>
          <div className="ibc-confirm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 780, width: "94vw" }}>
            <h3>👁️ {preview.title}</h3>
            <iframe
              title="Previsualización del PDF"
              src={pdfDataUrl(preview.base64)}
              style={{ width: "100%", height: "60dvh", border: "1.5px solid #ffd6eb", borderRadius: 12 }}
            />
            <div className="ibc-confirm-row">
              <button className="cancel" onClick={() => setPreview(null)}>Cerrar</button>
              <a className="action-card-btn" href={pdfDataUrl(preview.base64)} download={preview.filename}>
                ⬇️ Descargar PDF
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
