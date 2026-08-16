import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  MARKET_CATEGORIES,
  applyToJob,
  deleteJob,
  deleteService,
  listJobs,
  listMyApplications,
  listServices,
  saveJob,
  saveService,
  setApplicationStatus,
  withdrawApplication,
  type MarketApplication,
  type MarketJob,
  type MarketService,
} from "@/lib/market.functions";

export const Route = createFileRoute("/_authenticated/market")({
  head: () => ({
    meta: [
      { title: "IsaMarket — marketplace de freelancers creativos" },
      {
        name: "description",
        content:
          "Publica tus servicios como freelancer o encuentra talento creativo: diseño, desarrollo, video, redes y más en IsaMarket.",
      },
      { property: "og:title", content: "IsaMarket — marketplace de freelancers" },
      {
        property: "og:description",
        content: "Ofrece tus servicios, publica proyectos y postúlate. Gratis dentro de IsaBot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketPage,
});

type Tab = "services" | "jobs" | "mine";

const CURRENCIES = ["USD", "COP", "EUR", "MXN"];

function MarketPage() {
  const [tab, setTab] = useState<Tab>("services");

  return (
    <div className="market-page">
      <header className="market-top">
        <a className="market-back" href="/">
          ← IsaBot
        </a>
        <div className="market-brand">
          <span className="market-logo">🧺</span>
          <div>
            <strong>IsaMarket</strong>
            <small>Marketplace de freelancers creativos</small>
          </div>
        </div>
      </header>

      <nav className="market-tabs">
        <button className={tab === "services" ? "active" : ""} onClick={() => setTab("services")}>
          💼 Servicios
        </button>
        <button className={tab === "jobs" ? "active" : ""} onClick={() => setTab("jobs")}>
          📌 Proyectos
        </button>
        <button className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")}>
          ⭐ Lo mío
        </button>
      </nav>

      {tab === "services" && <ServicesTab />}
      {tab === "jobs" && <JobsTab />}
      {tab === "mine" && <MineTab />}
    </div>
  );
}

function Filters({
  search,
  setSearch,
  cat,
  setCat,
  onSearch,
}: {
  search: string;
  setSearch: (v: string) => void;
  cat: string;
  setCat: (v: string) => void;
  onSearch: () => void;
}) {
  return (
    <div className="market-filters">
      <input
        placeholder="Buscar…"
        value={search}
        maxLength={80}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSearch();
        }}
      />
      <select value={cat} onChange={(e) => setCat(e.target.value)}>
        <option value="todas">Todas las categorías</option>
        {MARKET_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button onClick={onSearch}>🔍 Buscar</button>
    </div>
  );
}

/* ───────────────── Servicios ───────────────── */

function ServicesTab() {
  const fetchServices = useServerFn(listServices);
  const save = useServerFn(saveService);
  const [items, setItems] = useState<MarketService[]>([]);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchServices({ data: { search, category: cat } });
      setItems(r.services);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [fetchServices, search, cat]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  return (
    <section className="market-section">
      <div className="market-headrow">
        <h2>💼 Servicios de freelancers</h2>
        <button className="market-cta" onClick={() => setForm((v) => !v)}>
          {form ? "Cerrar" : "＋ Ofrecer mi servicio"}
        </button>
      </div>

      {form && (
        <ServiceForm
          onDone={async () => {
            setForm(false);
            await load();
          }}
          save={save}
        />
      )}

      <Filters search={search} setSearch={setSearch} cat={cat} setCat={setCat} onSearch={load} />

      {error && <p className="market-error">{error}</p>}
      {loading ? (
        <p className="market-empty">Cargando servicios…</p>
      ) : items.length === 0 ? (
        <p className="market-empty">Aún no hay servicios aquí. ¡Sé la primera en publicar! ✨</p>
      ) : (
        <div className="market-grid">
          {items.map((s) => (
            <article key={s.id} className="market-card">
              <div className="market-card-top">
                <span className="market-chip">{s.category}</span>
                <span className="market-price">
                  desde {s.price_from} {s.currency}
                </span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.description || "Sin descripción."}</p>
              <div className="market-meta">
                <span>👩‍🎨 {s.owner_name || "Freelancer"}</span>
                <span>⏱️ {s.delivery_days} días</span>
              </div>
              {s.contact && <div className="market-contact">📩 {s.contact}</div>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ServiceForm({
  initial,
  save,
  onDone,
}: {
  initial?: MarketService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  save: (args: any) => Promise<any>;
  onDone: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [cat, setCat] = useState(initial?.category ?? "diseño");
  const [price, setPrice] = useState(String(initial?.price_from ?? 0));
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [days, setDays] = useState(String(initial?.delivery_days ?? 3));
  const [contact, setContact] = useState(initial?.contact ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) {
      setErr("Ponle un título a tu servicio");
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          id: initial?.id,
          title,
          description,
          category: cat,
          price_from: Number(price) || 0,
          currency,
          delivery_days: Number(days) || 1,
          contact,
          published: true,
        },
      });
      setErr(null);
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="market-form">
      <input placeholder="Título (ej: Diseño de logo kawaii)" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        placeholder="¿Qué incluye tu servicio?"
        maxLength={2000}
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="market-form-row">
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          {MARKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input type="number" min={0} placeholder="Precio desde" value={price} onChange={(e) => setPrice(e.target.value)} />
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input type="number" min={1} placeholder="Días de entrega" value={days} onChange={(e) => setDays(e.target.value)} />
      </div>
      <input
        placeholder="Contacto (correo, WhatsApp o @usuario)"
        maxLength={200}
        value={contact}
        onChange={(e) => setContact(e.target.value)}
      />
      {err && <p className="market-error">{err}</p>}
      <button className="market-cta" disabled={busy} onClick={submit}>
        {busy ? "Guardando…" : initial ? "Guardar cambios" : "Publicar servicio ✨"}
      </button>
    </div>
  );
}

/* ───────────────── Proyectos ───────────────── */

function JobsTab() {
  const fetchJobs = useServerFn(listJobs);
  const save = useServerFn(saveJob);
  const apply = useServerFn(applyToJob);
  const withdraw = useServerFn(withdrawApplication);

  const [items, setItems] = useState<MarketJob[]>([]);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [applyFor, setApplyFor] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [contact, setContact] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchJobs({ data: { search, category: cat } });
      setItems(r.jobs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [fetchJobs, search, cat]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  return (
    <section className="market-section">
      <div className="market-headrow">
        <h2>📌 Proyectos abiertos</h2>
        <button className="market-cta" onClick={() => setForm((v) => !v)}>
          {form ? "Cerrar" : "＋ Publicar proyecto"}
        </button>
      </div>

      {form && (
        <JobForm
          save={save}
          onDone={async () => {
            setForm(false);
            await load();
          }}
        />
      )}

      <Filters search={search} setSearch={setSearch} cat={cat} setCat={setCat} onSearch={load} />

      {error && <p className="market-error">{error}</p>}
      {loading ? (
        <p className="market-empty">Cargando proyectos…</p>
      ) : items.length === 0 ? (
        <p className="market-empty">No hay proyectos abiertos por ahora 🌷</p>
      ) : (
        <div className="market-grid">
          {items.map((j) => (
            <article key={j.id} className="market-card">
              <div className="market-card-top">
                <span className="market-chip">{j.category}</span>
                <span className="market-price">
                  {j.budget} {j.currency}
                </span>
              </div>
              <h3>{j.title}</h3>
              <p>{j.description || "Sin descripción."}</p>
              <div className="market-meta">
                <span>🙋 {j.owner_name || "Cliente"}</span>
                <span>📨 {j.applications_count ?? 0} postulaciones</span>
              </div>
              {j.contact && <div className="market-contact">📩 {j.contact}</div>}

              {j.applied ? (
                <button
                  className="market-ghost"
                  onClick={async () => {
                    await withdraw({ data: { job_id: j.id } });
                    await load();
                  }}
                >
                  Retirar mi postulación
                </button>
              ) : applyFor === j.id ? (
                <div className="market-form">
                  <textarea
                    rows={3}
                    maxLength={1000}
                    placeholder="Cuéntale por qué eres ideal para el proyecto"
                    value={msg}
                    onChange={(e) => setMsg(e.target.value)}
                  />
                  <input
                    placeholder="Tu contacto (correo o WhatsApp)"
                    maxLength={200}
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                  />
                  <button
                    className="market-cta"
                    onClick={async () => {
                      try {
                        await apply({ data: { job_id: j.id, message: msg, contact } });
                        setApplyFor(null);
                        setMsg("");
                        setContact("");
                        await load();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                      }
                    }}
                  >
                    Enviar postulación 💌
                  </button>
                </div>
              ) : (
                <button className="market-cta" onClick={() => setApplyFor(j.id)}>
                  Postularme
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function JobForm({
  save,
  onDone,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  save: (args: any) => Promise<any>;
  onDone: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cat, setCat] = useState("diseño");
  const [budget, setBudget] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="market-form">
      <input placeholder="Título del proyecto" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        rows={3}
        maxLength={2000}
        placeholder="¿Qué necesitas? Objetivos, plazos, referencias…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="market-form-row">
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          {MARKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input type="number" min={0} placeholder="Presupuesto" value={budget} onChange={(e) => setBudget(e.target.value)} />
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <input
        placeholder="Contacto (correo o WhatsApp)"
        maxLength={200}
        value={contact}
        onChange={(e) => setContact(e.target.value)}
      />
      {err && <p className="market-error">{err}</p>}
      <button
        className="market-cta"
        disabled={busy}
        onClick={async () => {
          if (!title.trim()) {
            setErr("Ponle un título al proyecto");
            return;
          }
          setBusy(true);
          try {
            await save({
              data: { title, description, category: cat, budget: Number(budget) || 0, currency, contact },
            });
            setErr(null);
            await onDone();
          } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Publicando…" : "Publicar proyecto 🌸"}
      </button>
    </div>
  );
}

/* ───────────────── Lo mío ───────────────── */

function MineTab() {
  const fetchServices = useServerFn(listServices);
  const fetchJobs = useServerFn(listJobs);
  const fetchApps = useServerFn(listMyApplications);
  const save = useServerFn(saveService);
  const removeService = useServerFn(deleteService);
  const removeJob = useServerFn(deleteJob);
  const setStatus = useServerFn(setApplicationStatus);

  const [services, setServices] = useState<MarketService[]>([]);
  const [jobs, setJobs] = useState<MarketJob[]>([]);
  const [received, setReceived] = useState<MarketApplication[]>([]);
  const [sent, setSent] = useState<MarketApplication[]>([]);
  const [editing, setEditing] = useState<MarketService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, j, a] = await Promise.all([
        fetchServices({ data: { mine: true } }),
        fetchJobs({ data: { mine: true } }),
        fetchApps(),
      ]);
      setServices(s.services);
      setJobs(j.jobs);
      setReceived(a.received);
      setSent(a.sent);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [fetchServices, fetchJobs, fetchApps]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className="market-empty">Cargando tu actividad…</p>;

  return (
    <section className="market-section">
      {error && <p className="market-error">{error}</p>}

      <h2>💼 Mis servicios</h2>
      {editing && (
        <ServiceForm
          initial={editing}
          save={save}
          onDone={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
      {services.length === 0 ? (
        <p className="market-empty">Todavía no ofreces servicios.</p>
      ) : (
        <div className="market-grid">
          {services.map((s) => (
            <article key={s.id} className="market-card">
              <div className="market-card-top">
                <span className="market-chip">{s.category}</span>
                <span className="market-price">
                  {s.price_from} {s.currency}
                </span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.description}</p>
              <div className="market-row-actions">
                <button className="market-ghost" onClick={() => setEditing(s)}>
                  ✏️ Editar
                </button>
                <button
                  className="market-ghost"
                  onClick={async () => {
                    await removeService({ data: { id: s.id } });
                    await load();
                  }}
                >
                  🗑️ Borrar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <h2>📌 Mis proyectos</h2>
      {jobs.length === 0 ? (
        <p className="market-empty">No has publicado proyectos.</p>
      ) : (
        <div className="market-grid">
          {jobs.map((j) => (
            <article key={j.id} className="market-card">
              <div className="market-card-top">
                <span className="market-chip">{j.category}</span>
                <span className="market-price">
                  {j.budget} {j.currency}
                </span>
              </div>
              <h3>{j.title}</h3>
              <p>{j.description}</p>
              <div className="market-meta">
                <span>{j.status === "open" ? "🟢 abierto" : "⚪ cerrado"}</span>
                <span>📨 {j.applications_count ?? 0}</span>
              </div>
              <div className="market-row-actions">
                <button
                  className="market-ghost"
                  onClick={async () => {
                    await removeJob({ data: { id: j.id } });
                    await load();
                  }}
                >
                  🗑️ Borrar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <h2>📨 Postulaciones recibidas</h2>
      {received.length === 0 ? (
        <p className="market-empty">Nadie se ha postulado aún.</p>
      ) : (
        <div className="market-list">
          {received.map((a) => (
            <div key={a.id} className="market-app">
              <strong>{a.applicant_name || "Freelancer"}</strong>
              <small>{a.job_title}</small>
              <p>{a.message || "Sin mensaje."}</p>
              {a.contact && <div className="market-contact">📩 {a.contact}</div>}
              <div className="market-row-actions">
                <span className="market-chip">{a.status}</span>
                <button
                  className="market-ghost"
                  onClick={async () => {
                    await setStatus({ data: { id: a.id, status: "accepted" } });
                    await load();
                  }}
                >
                  ✅ Aceptar
                </button>
                <button
                  className="market-ghost"
                  onClick={async () => {
                    await setStatus({ data: { id: a.id, status: "rejected" } });
                    await load();
                  }}
                >
                  ❌ Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>💌 Mis postulaciones</h2>
      {sent.length === 0 ? (
        <p className="market-empty">Aún no te has postulado a nada.</p>
      ) : (
        <div className="market-list">
          {sent.map((a) => (
            <div key={a.id} className="market-app">
              <strong>{a.job_title || "Proyecto"}</strong>
              <p>{a.message || "Sin mensaje."}</p>
              <span className="market-chip">{a.status}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
