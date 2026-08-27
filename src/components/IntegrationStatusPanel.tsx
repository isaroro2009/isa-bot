import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getIntegrationStatus, type IntegrationStatus } from "@/lib/admin.functions";

/** Tarjeta de estado de integraciones externas (WhatsApp, etc.). */
export function IntegrationStatusPanel() {
  const fetchStatus = useServerFn(getIntegrationStatus);
  const [rows, setRows] = useState<IntegrationStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus()
      .then((r) => setRows(r))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return null;

  return (
    <div
      style={{
        marginBottom: 16,
        background: "rgba(255,255,255,.7)",
        borderRadius: 16,
        padding: 16,
        border: "1px solid rgba(201,167,255,.4)",
      }}
    >
      <h3 style={{ margin: "0 0 10px", color: "#4a2b8a" }}>🔌 Integraciones</h3>
      {rows.length === 0 && <p style={{ fontSize: 13, opacity: 0.7 }}>Cargando…</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 12,
              background: r.status === "active" ? "rgba(120,220,170,.18)" : "rgba(255,196,120,.2)",
            }}
          >
            <strong style={{ color: "#3b2a63" }}>{r.label}</strong>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 999,
                background: r.status === "active" ? "#1f9d63" : "#b5651d",
                color: "#fff",
              }}
            >
              {r.status === "active" ? "Activo" : "Pending Credentials"}
            </span>
            <small style={{ width: "100%", opacity: 0.8 }}>{r.hint}</small>
            {r.missing.length > 0 && (
              <small style={{ width: "100%", opacity: 0.75 }}>
                Faltan: {r.missing.join(", ")}
              </small>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
