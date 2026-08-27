import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getIntegrationStatus,
  getWhatsAppConfig,
  saveWhatsAppConfig,
  connectWhatsAppQr,
  type IntegrationStatus,
  type WhatsAppConfig,
} from "@/lib/admin.functions";

/** Tarjeta de estado de integraciones externas (WhatsApp vía Evolution API / QR). */
export function IntegrationStatusPanel() {
  const fetchStatus = useServerFn(getIntegrationStatus);
  const fetchConfig = useServerFn(getWhatsAppConfig);
  const saveConfig = useServerFn(saveWhatsAppConfig);
  const connectQr = useServerFn(connectWhatsAppQr);

  const [rows, setRows] = useState<IntegrationStatus[]>([]);
  const [cfg, setCfg] = useState<WhatsAppConfig | null>(null);
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instance, setInstance] = useState("");
  const [greenId, setGreenId] = useState("");
  const [greenToken, setGreenToken] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [s, c] = await Promise.all([fetchStatus(), fetchConfig()]);
    setRows(s);
    setCfg(c);
    setUrl(c.url);
    setInstance(c.instance);
    setGreenId(c.greenId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [reload]);

  if (error) return null;

  const onSave = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await saveConfig({
        data: {
          url,
          key: apiKey || undefined,
          instance: instance || undefined,
          greenId: greenId || undefined,
          greenToken: greenToken || undefined,
        },
      });
      setApiKey("");
      setGreenToken("");
      await reload();
      setMsg("Credenciales guardadas ✅");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  const onConnect = async () => {
    setBusy(true);
    setMsg(null);
    setQr(null);
    try {
      const r = await connectQr();
      setQr(r.qr);
      if (!r.qr) setMsg(r.error ? `Sin QR (${r.error})` : `Estado: ${r.state ?? "desconocido"}`);
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo conectar");
    } finally {
      setBusy(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(120,80,200,.35)",
    background: "rgba(255,255,255,.85)",
    fontSize: 14,
  };
  const btnStyle: React.CSSProperties = {
    minHeight: 44,
    padding: "10px 16px",
    borderRadius: 999,
    border: "none",
    fontWeight: 700,
    cursor: "pointer",
    color: "#fff",
  };

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
              <small style={{ width: "100%", opacity: 0.75 }}>Faltan: {r.missing.join(", ")}</small>
            )}
          </div>
        ))}
      </div>

      {/* 🟢 Green API */}
      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 14,
          background: "rgba(60,200,140,.10)",
          border: "1px dashed rgba(40,170,110,.45)",
          display: "grid",
          gap: 10,
        }}
      >
        <strong style={{ color: "#1f6b4a" }}>🟢 WhatsApp con Green API (recomendado)</strong>
        <small style={{ opacity: 0.8 }}>
          Crea una instancia en Green API, escanea el QR desde su panel y pega aquí las credenciales.
          Luego configura el webhook hacia <code>/api/public/whatsapp</code>.
        </small>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          GREEN_API_ID_INSTANCE
          <input
            style={inputStyle}
            value={greenId}
            onChange={(e) => setGreenId(e.target.value)}
            placeholder="1101234567"
            inputMode="numeric"
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          GREEN_API_TOKEN_INSTANCE {cfg?.hasGreenToken && <em style={{ opacity: 0.7 }}>(guardado ✅)</em>}
          <input
            style={inputStyle}
            value={greenToken}
            onChange={(e) => setGreenToken(e.target.value)}
            placeholder={cfg?.hasGreenToken ? "•••••••• (deja vacío para conservarlo)" : "tu token de instancia"}
            type="password"
            autoComplete="off"
          />
        </label>

        <button style={{ ...btnStyle, background: "#1f9d63", justifySelf: "start" }} onClick={onSave} disabled={busy}>
          Guardar credenciales Green API
        </button>

        <small style={{ opacity: 0.85 }}>
          Estado:{" "}
          <strong style={{ color: cfg?.greenConnected ? "#1f9d63" : "#b5651d" }}>
            {cfg?.greenConnected ? "Activo (autorizado)" : (cfg?.greenState ?? "sin credenciales")}
          </strong>
        </small>
      </div>

      {/* 📱 Conectar WhatsApp vía QR */}
      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 14,
          background: "rgba(140,90,240,.08)",
          border: "1px dashed rgba(140,90,240,.35)",
          display: "grid",
          gap: 10,
        }}
      >
        <strong style={{ color: "#3b2a63" }}>📱 Conectar WhatsApp vía QR</strong>
        <small style={{ opacity: 0.8 }}>
          Sin cuenta de Meta Developers: usa tu servidor Evolution API y escanea el QR con WhatsApp →
          Dispositivos vinculados.
        </small>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          EVOLUTION_API_URL
          <input
            style={inputStyle}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://mi-evolution.servidor.com"
            inputMode="url"
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          EVOLUTION_API_KEY {cfg?.hasKey && <em style={{ opacity: 0.7 }}>(guardada ✅)</em>}
          <input
            style={inputStyle}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={cfg?.hasKey ? "•••••••• (deja vacío para conservarla)" : "tu API key"}
            type="password"
            autoComplete="off"
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Nombre de la sesión
          <input
            style={inputStyle}
            value={instance}
            onChange={(e) => setInstance(e.target.value)}
            placeholder="isabot"
          />
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button style={{ ...btnStyle, background: "#6b46c1" }} onClick={onSave} disabled={busy}>
            Guardar credenciales
          </button>
          <button
            style={{ ...btnStyle, background: "#1f9d63", opacity: cfg?.hasKey && cfg.url ? 1 : 0.6 }}
            onClick={onConnect}
            disabled={busy || !cfg?.hasKey || !cfg?.url}
          >
            {busy ? "Conectando…" : "Conectar WhatsApp vía QR"}
          </button>
        </div>

        <small style={{ opacity: 0.85 }}>
          Estado de la sesión:{" "}
          <strong style={{ color: cfg?.connected ? "#1f9d63" : "#b5651d" }}>
            {cfg?.connected ? "conectada" : (cfg?.state ?? "desconectada")}
          </strong>
        </small>
        {msg && <small style={{ opacity: 0.9 }}>{msg}</small>}
        {qr && (
          <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
            <img
              src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
              alt="Código QR para vincular WhatsApp con IsaBot"
              style={{ width: 240, maxWidth: "100%", borderRadius: 12, background: "#fff", padding: 8 }}
            />
            <small style={{ opacity: 0.8 }}>Escanea desde WhatsApp → Dispositivos vinculados</small>
          </div>
        )}
      </div>
    </div>
  );
}
