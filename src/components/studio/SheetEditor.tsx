import { useState } from "react";

export type SheetDoc = { cols: number; rows: number; cells: Record<string, string> };

type Props = { doc: SheetDoc; onChange: (doc: SheetDoc) => void };

const COL_NAMES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function colName(i: number): string {
  return COL_NAMES[i] ?? `C${i + 1}`;
}

function parseRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.trim().toUpperCase());
  if (!m) return null;
  const col = COL_NAMES.indexOf(m[1]);
  if (col < 0) return null;
  return { col, row: Number(m[2]) - 1 };
}

function expandRange(range: string): string[] {
  const [a, b] = range.split(":");
  const from = parseRef(a);
  const to = parseRef(b ?? a);
  if (!from || !to) return [];
  const refs: string[] = [];
  for (let c = Math.min(from.col, to.col); c <= Math.max(from.col, to.col); c++)
    for (let r = Math.min(from.row, to.row); r <= Math.max(from.row, to.row); r++)
      refs.push(`${colName(c)}${r + 1}`);
  return refs;
}

/** Evalúa el valor de una celda: número, texto o fórmula básica. */
export function evalCell(cells: Record<string, string>, ref: string, depth = 0): string {
  const raw = cells[ref] ?? "";
  if (depth > 12) return "#CICLO";
  if (!raw.startsWith("=")) return raw;

  const expr = raw.slice(1).trim();
  const fn = /^(SUMA|SUM|PROMEDIO|AVERAGE|MAX|MIN|CONTAR|COUNT)\(([^)]*)\)$/i.exec(expr);
  if (fn) {
    const name = fn[1].toUpperCase();
    const nums = fn[2]
      .split(/[;,]/)
      .flatMap((part) => (part.includes(":") ? expandRange(part) : [part.trim()]))
      .map((token) => {
        if (parseRef(token)) return Number(evalCell(cells, token.toUpperCase(), depth + 1));
        return Number(token);
      })
      .filter((n) => Number.isFinite(n));
    if (nums.length === 0) return "0";
    if (name === "SUMA" || name === "SUM") return String(nums.reduce((a, b) => a + b, 0));
    if (name === "PROMEDIO" || name === "AVERAGE")
      return String(Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100);
    if (name === "MAX") return String(Math.max(...nums));
    if (name === "MIN") return String(Math.min(...nums));
    return String(nums.length);
  }

  // Aritmética simple con referencias: =A1+B2*2
  const replaced = expr.replace(/[A-Z]+\d+/g, (ref2) => {
    const v = Number(evalCell(cells, ref2, depth + 1));
    return Number.isFinite(v) ? String(v) : "0";
  });
  if (!/^[-+*/().\d\s]+$/.test(replaced)) return "#ERROR";
  try {
    // eslint-disable-next-line no-new-func
    const out = Function(`"use strict";return (${replaced})`)() as number;
    return Number.isFinite(out) ? String(Math.round(out * 1e6) / 1e6) : "#ERROR";
  } catch {
    return "#ERROR";
  }
}

export function SheetEditor({ doc, onChange }: Props) {
  const [editing, setEditing] = useState<string | null>(null);

  function setCell(ref: string, value: string) {
    const cells = { ...doc.cells };
    if (value === "") delete cells[ref];
    else cells[ref] = value;
    onChange({ ...doc, cells });
  }

  return (
    <div className="studio-editor">
      <div className="studio-toolbar">
        <span className="studio-hint" style={{ margin: 0 }}>
          Fórmulas: <strong>=SUMA(A1:A5)</strong> · <strong>=PROMEDIO(B1:B4)</strong> · <strong>=A1+B2*2</strong> · MAX · MIN · CONTAR
        </span>
        <button className="studio-tool" onClick={() => onChange({ ...doc, rows: doc.rows + 5 })}>➕ Filas</button>
        <button className="studio-tool" onClick={() => onChange({ ...doc, cols: Math.min(20, doc.cols + 1) })}>➕ Columna</button>
        <button className="studio-tool danger" onClick={() => onChange({ ...doc, cells: {} })}>🧹 Vaciar</button>
      </div>

      <div className="studio-sheet-wrap">
        <table className="studio-sheet">
          <thead>
            <tr>
              <th />
              {Array.from({ length: doc.cols }, (_, c) => (
                <th key={c}>{colName(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: doc.rows }, (_, r) => (
              <tr key={r}>
                <th>{r + 1}</th>
                {Array.from({ length: doc.cols }, (_, c) => {
                  const ref = `${colName(c)}${r + 1}`;
                  const isEditing = editing === ref;
                  return (
                    <td key={c} onClick={() => setEditing(ref)}>
                      {isEditing ? (
                        <input
                          autoFocus
                          value={doc.cells[ref] ?? ""}
                          onChange={(e) => setCell(ref, e.target.value)}
                          onBlur={() => setEditing(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Escape") setEditing(null);
                          }}
                        />
                      ) : (
                        <span>{evalCell(doc.cells, ref)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function sheetToRows(doc: SheetDoc): string[][] {
  return Array.from({ length: doc.rows }, (_, r) =>
    Array.from({ length: doc.cols }, (_, c) => evalCell(doc.cells, `${colName(c)}${r + 1}`)),
  );
}
