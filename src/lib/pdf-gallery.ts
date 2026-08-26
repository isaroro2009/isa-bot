// 📚 Galería de PDFs — guarda los documentos generados en el navegador (IndexedDB).
// Cero servidor, cero tokens: todo se queda en el dispositivo de la usuaria.

export type PdfDoc = {
  id: string;
  title: string;
  filename: string;
  /** PDF en base64 (sin prefijo data:) */
  base64: string;
  createdAt: string;
};

const DB = "isabot-pdfs";
const STORE = "docs";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePdf(doc: Omit<PdfDoc, "id" | "createdAt">): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      ...doc,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listPdfs(): Promise<PdfDoc[]> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return [];
  const db = await open();
  const rows = await new Promise<PdfDoc[]>((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result ?? []) as PdfDoc[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deletePdf(id: string): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function pdfDataUrl(base64: string): string {
  return `data:application/pdf;base64,${base64}`;
}

export const PDF_GALLERY_EVENT = "isabot:open-pdf-gallery";

export function openPdfGallery() {
  window.dispatchEvent(new CustomEvent(PDF_GALLERY_EVENT));
}
