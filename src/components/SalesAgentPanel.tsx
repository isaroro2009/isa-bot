import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listSalesCampaigns,
  listSalesMessages,
  listSalesProspects,
  markMessageSent,
  runSalesCampaignNow,
  saveSalesCampaign,
  setCampaignActive,
  deleteSalesCampaign,
  addManualProspects,
  type SalesCampaign,
  type SalesMessage,
  type SalesProspect,
} from "@/lib/sales.functions";

const CHANNELS = [
  { id: "email", label: "📧 Email" },
  { id: "whatsapp", label: "💬 WhatsApp" },
  { id: "form", label: "📝 Formulario web" },
];

export function SalesAgentPanel({ onClose }: { onClose: () => void }) {
  const loadCampaigns = useServerFn(listSalesCampaigns);
  const loadProspects = useServerFn(listSalesProspects);
  const loadMessages = useServerFn(listSalesMessages);
  const save = useServerFn(saveSalesCampaign);
  const toggle = useServerFn(setCampaignActive);
  const remove = useServerFn(deleteSalesCampaign);
  const runNow = useServerFn(runSalesCampaignNow);
  const mark = useServerFn(markMessageSent);
  const addManual = useServerFn(addManualProspects);

  const [tab, setTab] = useState<"campaigns" | "prospects" | "messages">("campaigns");
  const [campaigns, setCampaigns] = useState<SalesCampaign[]>([]);
  const [prospects, setProspects] = useState<SalesProspect[]>([]);
  const [messages, setMessages] = useState<SalesMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const [form, setForm] = useState({
    name: "",
    niche: "",
    city: "",
    offer: "",
    channels: ["email", "whatsapp"] as string[],
    daily_limit: 10,
    auto_send: false,
  });
  const [manual, setManual] = useState("");

  const refresh = () => {
    loadCampaigns().then(setCampaigns).catch(() => {});
    loadProspects().then(setProspects).catch(() => {});
    loadMessages().then(setMessages).catch(() => {});
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prospectById = (id: string) => prospects.find((p) => p.id === id);

  const create = async () => {
    if (form.name.trim().length < 2 || form.offer.trim().length < 10) {
      setStatus("Ponle un nombre y describe tu oferta (mínimo 10 caracteres) 🌸");
      return;
    }
    setBusy(true);
    try {
      await save({ data: { ...form, channels: form.channels } });
      setStatus("Campaña guardada ✨ IsaBot trabajará esta noche.");
      setForm({ ...form, name: "", niche: "", city: "", offer: "" });
      refresh();
    } catch (e) {
      setStatus(`No se pudo guardar: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const run = async (id: string) => {
    setBusy(true);
    setStatus("Buscando negocios reales y escribiendo mensajes… puede tardar un poco ⏳");
    try {
      const r = await runNow({ data: { id } });
      setStatus(
        `Listo: ${r.found} negocios vistos, ${r.newProspects} nuevos, ${r.messages} mensajes. ${r.note}`,
      );
      refresh();
    } catch (e) {
      setStatus(`Se cayó la búsqueda: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const waLink = (phone: string, body: string) =>
    `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(body)}`;
  const mailLink = (email: string, subject: string | null, body: string) =>
    `mailto:${email}?subject=${encodeURIComponent(subject ?? "Hola")}&body=${encodeURIComponent(body)}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-card sales-card" onClick={(e) => e.stopPropagation()}>
        <h3>🌙 Ventas Nocturnas</h3>
        <p className="habits-sub">
          IsaBot busca negocios reales de tu nicho en OpenStreetMap, encuentra su contacto público y
          te deja los mensajes escritos mientras duermes. Tú solo tocas enviar.
        </p>

        <div className="sales-tabs">
          <button className={tab === "campaigns" ? "on" : ""} onClick={() => setTab("campaigns")}>
            🎯 Campañas
          </button>
          <button className={tab === "prospects" ? "on" : ""} onClick={() => setTab("prospects")}>
            🏢 Negocios ({prospects.length})
          </button>
          <button className={tab === "messages" ? "on" : ""} onClick={() => setTab("messages")}>
            ✉️ Mensajes ({messages.length})
          </button>
        </div>

        {status && <div className="sales-status">{status}</div>}

        {tab === "campaigns" && (
          <>
            <div className="sales-form">
              <input
                placeholder="Nombre de la campaña (ej. Cafés de Bogotá)"
                value={form.name}
                maxLength={80}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <div className="sales-row">
                <input
                  placeholder="Nicho (ej. cafeterías)"
                  value={form.niche}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, niche: e.target.value })}
                />
                <input
                  placeholder="Ciudad (ej. Bogotá)"
                  value={form.city}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <textarea
                placeholder="Qué les ofreces (ej. una web con reservas automáticas en 3 días por X)"
                value={form.offer}
                maxLength={600}
                onChange={(e) => setForm({ ...form, offer: e.target.value })}
              />
              <div className="sales-chips">
                {CHANNELS.map((c) => (
                  <button
                    key={c.id}
                    className={form.channels.includes(c.id) ? "chip on" : "chip"}
                    onClick={() =>
                      setForm({
                        ...form,
                        channels: form.channels.includes(c.id)
                          ? form.channels.filter((x) => x !== c.id)
                          : [...form.channels, c.id],
                      })
                    }
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <label className="sales-limit">
                Negocios por noche: <b>{form.daily_limit}</b>
                <input
                  type="range"
                  min={1}
                  max={25}
                  value={form.daily_limit}
                  onChange={(e) => setForm({ ...form, daily_limit: Number(e.target.value) })}
                />
              </label>
              <button className="reminder-btn" disabled={busy} onClick={create}>
                {busy ? "Guardando…" : "✨ Crear campaña"}
              </button>
            </div>

            <div className="sales-list">
              {campaigns.length === 0 && <p className="habits-sub">Aún no tienes campañas.</p>}
              {campaigns.map((c) => (
                <div className="sales-item" key={c.id}>
                  <div>
                    <b>{c.name}</b>
                    <p>
                      {c.niche} · {c.city} · {c.daily_limit}/noche ·{" "}
                      {c.active ? "🟢 activa" : "⚪ pausada"}
                      {c.last_run_at && ` · última: ${new Date(c.last_run_at).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="sales-item-actions">
                    <button disabled={busy} onClick={() => void run(c.id)}>
                      ▶️ Correr ahora
                    </button>
                    <button
                      onClick={async () => {
                        await toggle({ data: { id: c.id, active: !c.active } });
                        refresh();
                      }}
                    >
                      {c.active ? "⏸️ Pausar" : "🟢 Activar"}
                    </button>
                    <button
                      onClick={async () => {
                        await remove({ data: { id: c.id } });
                        refresh();
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {campaigns[0] && (
              <div className="sales-form">
                <p className="habits-sub">
                  ¿Tienes tu propia lista? Una línea por negocio: <i>Nombre, email, teléfono, web</i>
                </p>
                <textarea
                  placeholder="Café Luna, hola@cafeluna.co, +573001112233, cafeluna.co"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                />
                <button
                  className="reminder-btn"
                  disabled={busy || manual.trim().length < 3}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await addManual({
                        data: { campaign_id: campaigns[0]!.id, raw: manual },
                      });
                      setStatus(`Agregué ${r.added ?? 0} negocios a "${campaigns[0]!.name}".`);
                      setManual("");
                      refresh();
                    } catch (e) {
                      setStatus(String(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  ➕ Sumar mi lista
                </button>
              </div>
            )}
          </>
        )}

        {tab === "prospects" && (
          <div className="sales-list">
            {prospects.length === 0 && (
              <p className="habits-sub">Todavía no hay negocios. Corre una campaña o sube tu lista.</p>
            )}
            {prospects.map((p) => (
              <div className="sales-item" key={p.id}>
                <div>
                  <b>{p.business_name}</b>
                  <p>
                    {p.email ?? "sin email público"} · {p.phone ?? "sin teléfono"}
                    {p.website && (
                      <>
                        {" · "}
                        <a href={p.website} target="_blank" rel="noreferrer">
                          web
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <span className="sales-badge">{p.status}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "messages" && (
          <div className="sales-list">
            {messages.length === 0 && <p className="habits-sub">Aún no hay mensajes escritos.</p>}
            {messages.map((m) => {
              const p = prospectById(m.prospect_id);
              return (
                <div className="sales-msg" key={m.id}>
                  <div className="sales-msg-head">
                    <b>{p?.business_name ?? "Negocio"}</b>
                    <span className="sales-badge">
                      {m.channel} · {m.status}
                    </span>
                  </div>
                  {m.subject && <p className="sales-subject">{m.subject}</p>}
                  <p className="sales-body">{m.body}</p>
                  <div className="sales-item-actions">
                    {m.channel === "whatsapp" && p?.phone && (
                      <a
                        className="sales-send"
                        href={waLink(p.phone, m.body)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={async () => {
                          await mark({ data: { id: m.id, status: "sent" } });
                          refresh();
                        }}
                      >
                        💬 Enviar por WhatsApp
                      </a>
                    )}
                    {m.channel === "email" && p?.email && (
                      <a
                        className="sales-send"
                        href={mailLink(p.email, m.subject, m.body)}
                        onClick={async () => {
                          await mark({ data: { id: m.id, status: "sent" } });
                          refresh();
                        }}
                      >
                        📧 Enviar por email
                      </a>
                    )}
                    {m.channel === "form" && p?.website && (
                      <a className="sales-send" href={p.website} target="_blank" rel="noreferrer">
                        📝 Abrir su web
                      </a>
                    )}
                    <button onClick={() => void navigator.clipboard.writeText(m.body)}>
                      📋 Copiar
                    </button>
                    <button
                      onClick={async () => {
                        await mark({ data: { id: m.id, status: "skipped" } });
                        refresh();
                      }}
                    >
                      🚫 Descartar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button className="close-settings" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
