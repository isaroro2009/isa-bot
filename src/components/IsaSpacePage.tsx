import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import {
  addComment,
  createPost,
  deletePost,
  listPosts,
  toggleLike,
  listMembers,
  type IsaMember,
  type IsaPost,
} from "@/lib/isaspace.functions";
import { listImported, importSocialFeed, type ImportedPost } from "@/lib/isaspaceImport.functions";
import { applyAsMentor, getMyMentorApplication, type MentorApplication } from "@/lib/mentors.functions";

function timeAgo(iso: string) {
  const s = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

function Avatar({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  return (
    <span className="isp-avatar" style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" /> : <b>{(name || "?")[0]?.toUpperCase()}</b>}
    </span>
  );
}

const TAG_OPTIONS = ["diseño", "IA", "estudio", "emprender", "arte", "música"];

const SIDE_LINKS = [
  { icon: "☺", label: "Current Vibe" },
  { icon: "✎", label: "Inspiration" },
  { icon: "◎", label: "My Creations" },
  { icon: "♡", label: "My Categories" },
  { icon: "⚉", label: "My Videos" },
];

export function IsaSpacePage() {
  const fetchPosts = useServerFn(listPosts);
  const doCreate = useServerFn(createPost);
  const doDelete = useServerFn(deletePost);
  const doLike = useServerFn(toggleLike);
  const doComment = useServerFn(addComment);
  const loadProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);
  const fetchMembers = useServerFn(listMembers);

  const [posts, setPosts] = useState<IsaPost[]>([]);
  const [me, setMe] = useState<{
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    headline: string | null;
    bio: string | null;
    location: string | null;
    interests: string[];
  } | null>(null);
  const [members, setMembers] = useState<IsaMember[]>([]);
  const [editAbout, setEditAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState({ headline: "", bio: "", location: "", interests: "" });
  const [savingAbout, setSavingAbout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [tab, setTab] = useState<"home" | "mine" | "about" | "mentors">("home");
  const [imported, setImported] = useState<ImportedPost[]>([]);
  const [importing, setImporting] = useState(false);
  const [mentorApp, setMentorApp] = useState<MentorApplication | null>(null);
  const [mentorForm, setMentorForm] = useState({
    full_name: "",
    expertise: "",
    experience: "",
    links: "",
    contact: "",
  });
  const [mentorSending, setMentorSending] = useState(false);
  const fetchImported = useServerFn(listImported);
  const doImport = useServerFn(importSocialFeed);
  const doApplyMentor = useServerFn(applyAsMentor);
  const fetchMentorApp = useServerFn(getMyMentorApplication);
  const [tags, setTags] = useState<string[]>([]);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setPosts(await fetchPosts());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar IsaSpace");
    } finally {
      setLoading(false);
    }
  }, [fetchPosts]);

  useEffect(() => {
    void load();
    void loadProfile()
      .then((p) => {
        const prof = p as never as {
          id: string; display_name: string | null; avatar_url: string | null;
          headline: string | null; bio: string | null; location: string | null; interests: string[] | null;
        };
        setMe({ ...prof, interests: prof.interests ?? [] });
        setAboutDraft({
          headline: prof.headline ?? "",
          bio: prof.bio ?? "",
          location: prof.location ?? "",
          interests: (prof.interests ?? []).join(", "),
        });
      })
      .catch(() => undefined);
    void fetchMembers()
      .then((m) => setMembers(m))
      .catch(() => undefined);
    void fetchImported()
      .then((r) => setImported(r))
      .catch(() => undefined);
    void fetchMentorApp()
      .then((a) => setMentorApp(a))
      .catch(() => undefined);
  }, [load, loadProfile, fetchMembers, fetchImported, fetchMentorApp]);

  async function runImport() {
    setImporting(true);
    try {
      await doImport({ data: undefined as never });
      setImported(await fetchImported());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo importar");
    } finally {
      setImporting(false);
    }
  }

  async function sendMentorApplication(e: React.FormEvent) {
    e.preventDefault();
    setMentorSending(true);
    try {
      await doApplyMentor({ data: mentorForm });
      setMentorApp(await fetchMentorApp());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la postulación");
    } finally {
      setMentorSending(false);
    }
  }

  async function saveAbout() {
    setSavingAbout(true);
    try {
      const interests = aboutDraft.interests
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12);
      await saveProfile({
        data: {
          headline: aboutDraft.headline.trim().slice(0, 80) || null,
          bio: aboutDraft.bio.trim().slice(0, 600) || null,
          location: aboutDraft.location.trim().slice(0, 60) || null,
          interests,
        },
      });
      setMe((prev) =>
        prev
          ? {
              ...prev,
              headline: aboutDraft.headline.trim() || null,
              bio: aboutDraft.bio.trim() || null,
              location: aboutDraft.location.trim() || null,
              interests,
            }
          : prev,
      );
      setEditAbout(false);
      setMembers(await fetchMembers());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar tu presentación");
    } finally {
      setSavingAbout(false);
    }
  }

  useEffect(() => {
    if (!file) { setFilePreview(null); return; }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const moodboards = useMemo(
    () => posts.filter((p) => p.image_url).slice(0, 4),
    [posts],
  );

  const vibeCheck = useMemo(() => {
    const states = ["está en modo flow ✨", "busca inspiración", "está creando 🎨", "está en modo estudio"];
    const seen = new Map<string, { name: string; avatar: string | null }>();
    for (const p of posts) if (!seen.has(p.user_id)) seen.set(p.user_id, { name: p.author_name, avatar: p.author_avatar });
    return Array.from(seen.values()).slice(0, 4).map((u, i) => ({ ...u, state: states[i % states.length] }));
  }, [posts]);

  const isFeedTab = tab === "home" || tab === "mine";
  const feed = useMemo(
    () => (tab === "mine" ? posts.filter((p) => p.user_id === me?.id) : tab === "home" ? posts : []),
    [posts, tab, me?.id],
  );

  function returnToIsaBot() {
    if (typeof window === "undefined") return;
    const opener = window.opener as Window | null;
    if (opener && !opener.closed) {
      try {
        opener.focus();
      } catch {
        // opener de otro origen: ignoramos
      }
      window.close();
      // Si el navegador bloquea el cierre, al menos volvemos a IsaBot.
      window.setTimeout(() => {
        if (!window.closed) window.location.href = "/";
      }, 150);
      return;
    }
    window.location.href = "/";
  }

  async function publish() {
    setSending(true);
    try {
      let imageUrl: string | null = null;
      if (file && me?.id) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("isaspace").upload(path, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });
        if (upErr) throw upErr;
        imageUrl = path;
      }
      const tagLine = tags.length ? `\n\n${tags.map((t) => `#${t}`).join(" ")}` : "";
      await doCreate({ data: { content: `${text.trim()}${tagLine}`.trim(), imageUrl } });
      setText("");
      setFile(null);
      setTags([]);
      setComposerOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo publicar");
    } finally {
      setSending(false);
    }
  }

  const myName = me?.display_name || "IsaRoRo Studio";

  return (
    <div className="isp-app">
      <header className="isp-topbar">
        <nav className="isp-nav">
          <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}>✨ Para ti</button>
          <button className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")}>👤 Mis publicaciones</button>
          <button className={tab === "about" ? "active" : ""} onClick={() => setTab("about")}>💜 Quiénes somos</button>
          <button className={tab === "mentors" ? "active" : ""} onClick={() => setTab("mentors")}>🎓 Mentores</button>
        </nav>
        <button className="isp-return" onClick={returnToIsaBot}>
          <span className="isp-return-badge">🏠</span>
          RETURN TO IsaBot
        </button>
        <div className="isp-logos">
          <span className="isp-logo-space">IsaSpace</span>
          <span className="isp-logo-bot">IsaBot</span>
        </div>
        <div className="isp-topbar-right">
          <button className="isp-round" title="Mensajes">💬</button>
          <button className="isp-round" title="Notificaciones">🔔</button>
          <button className="isp-round isp-me" title="Crear publicación" onClick={() => setComposerOpen((v) => !v)}>
            <Avatar name={myName} url={me?.avatar_url} size={34} />
          </button>
        </div>
      </header>

      <div className="isp-grid">
        <aside className="isp-profile-card">
          <div className="isp-profile-cover" />
          <div className="isp-profile-body">
            <span className="isp-profile-pic"><Avatar name={myName} url={me?.avatar_url} size={84} /></span>
            <h2>{myName}</h2>
            <small>{me?.headline || "Añade tu titular ✨"}</small>
            {editAbout ? (
              <div className="isp-about-form">
                <input
                  value={aboutDraft.headline}
                  maxLength={80}
                  placeholder="Titular (ej: Founder & diseñadora)"
                  onChange={(e) => setAboutDraft((d) => ({ ...d, headline: e.target.value }))}
                />
                <input
                  value={aboutDraft.location}
                  maxLength={60}
                  placeholder="Ciudad (ej: Cali, Colombia)"
                  onChange={(e) => setAboutDraft((d) => ({ ...d, location: e.target.value }))}
                />
                <textarea
                  value={aboutDraft.bio}
                  maxLength={600}
                  rows={4}
                  placeholder="¿Quién eres? Cuéntanos qué haces, qué te inspira y qué estás creando…"
                  onChange={(e) => setAboutDraft((d) => ({ ...d, bio: e.target.value }))}
                />
                <input
                  value={aboutDraft.interests}
                  placeholder="Intereses separados por coma: diseño, IA, música"
                  onChange={(e) => setAboutDraft((d) => ({ ...d, interests: e.target.value }))}
                />
                <div className="isp-about-actions">
                  <button className="isp-share" disabled={savingAbout} onClick={saveAbout}>
                    {savingAbout ? "Guardando…" : "Guardar"}
                  </button>
                  <button className="isp-ghost" onClick={() => setEditAbout(false)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <p>
                  {me?.bio || "Aún no has escrito quién eres. Cuéntale a la comunidad (y a IsaBot) sobre ti 💜"}
                </p>
                {me?.location && <small className="isp-about-loc">📍 {me.location}</small>}
                {!!me?.interests?.length && (
                  <div className="isp-tags">
                    {me.interests.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                )}
                <button className="isp-ghost isp-about-edit" onClick={() => setEditAbout(true)}>
                  ✎ Editar mi presentación
                </button>
              </>
            )}
            <ul className="isp-links">
              {SIDE_LINKS.map((l, i) => (
                <li key={l.label} className={i === 0 ? "active" : ""}>
                  <span>{l.icon}</span> {l.label}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="isp-feed">
          {isFeedTab && (
            <button className="isp-open-composer" onClick={() => setComposerOpen(true)}>
              <Avatar name={myName} url={me?.avatar_url} size={38} />
              <span>Comparte tu vibe de hoy… 💭</span>
              <b>Crear publicación</b>
            </button>
          )}

          {composerOpen && (
            <div className="isp-modal-back" onClick={() => setComposerOpen(false)}>
              <section className="isp-card isp-composer isp-modal" onClick={(e) => e.stopPropagation()}>
                <header className="isp-composer-head">
                  <strong>Crear publicación</strong>
                  <button className="isp-ghost" onClick={() => setComposerOpen(false)}>✕</button>
                </header>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 2000))}
                  placeholder="¿Qué estás creando hoy? ✨"
                  rows={4}
                />
                {filePreview && (
                  <div className="isp-composer-preview">
                    <img src={filePreview} alt="vista previa" />
                    <button onClick={() => setFile(null)}>✕</button>
                  </div>
                )}
                <div className="isp-tag-picker">
                  {TAG_OPTIONS.map((t) => (
                    <button
                      key={t}
                      className={tags.includes(t) ? "active" : ""}
                      onClick={() =>
                        setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(0, 3)))
                      }
                    >
                      #{t}
                    </button>
                  ))}
                </div>
                <div className="isp-composer-row">
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <button className="isp-ghost" onClick={() => fileRef.current?.click()}>🖼️ Foto</button>
                  <small>{text.length}/2000</small>
                  <button className="isp-share" disabled={sending || (!text.trim() && !file)} onClick={publish}>
                    {sending ? "Compartiendo…" : "Compartir"}
                  </button>
                </div>
              </section>
            </div>
          )}

          {error && <div className="isp-error">{error}</div>}

          {tab === "about" && (
            <section className="isp-card isp-about-dir">
              <h3>✨ Quiénes somos</h3>
              <p className="isp-about-intro">
                Presentaciones de la comunidad. IsaBot también lee tu presentación para conocerte mejor 💜
              </p>
              {members.length === 0 && <p className="isp-empty small">Nadie se ha presentado todavía. ¡Empieza tú!</p>}
              <ul className="isp-members">
                {members.map((m) => (
                  <li key={m.id}>
                    <Avatar name={m.name} url={m.avatar_url} size={44} />
                    <div>
                      <strong>{m.name}</strong>
                      {m.headline && <em>{m.headline}</em>}
                      {m.location && <small>📍 {m.location}</small>}
                      {m.bio && <p>{m.bio}</p>}
                      {!!m.interests.length && (
                        <div className="isp-tags">
                          {m.interests.map((t) => (
                            <span key={t}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {tab === "mentors" && (
            <section className="isp-card isp-about-dir">
              <h3>🎓 Mentores</h3>
              <p className="isp-about-intro">
                <strong>Contactar mentores — próximamente 🚧</strong>
                <br />
                Estamos armando la red de mentores verificados de IsaBot. Muy pronto podrás agendar
                sesiones 1:1 con creativas, diseñadoras y emprendedoras de la comunidad.
              </p>

              {mentorApp ? (
                <div className="isp-empty small">
                  ✅ Ya enviaste tu postulación como mentor verificado ({mentorApp.expertise}).
                  <br />
                  Estado: <strong>{mentorApp.status === "pending" ? "en revisión" : mentorApp.status}</strong>
                </div>
              ) : (
                <form className="isp-mentor-form" onSubmit={sendMentorApplication}>
                  <h4 style={{ margin: "14px 0 6px" }}>✨ Postúlate como mentor verificado</h4>
                  <input
                    placeholder="Tu nombre completo *"
                    value={mentorForm.full_name}
                    onChange={(e) => setMentorForm({ ...mentorForm, full_name: e.target.value })}
                  />
                  <input
                    placeholder="Especialidad (diseño, IA, marketing…) *"
                    value={mentorForm.expertise}
                    onChange={(e) => setMentorForm({ ...mentorForm, expertise: e.target.value })}
                  />
                  <textarea
                    rows={4}
                    placeholder="Cuéntanos tu experiencia y cómo puedes ayudar *"
                    value={mentorForm.experience}
                    onChange={(e) => setMentorForm({ ...mentorForm, experience: e.target.value })}
                  />
                  <input
                    placeholder="Portafolio / LinkedIn / Instagram"
                    value={mentorForm.links}
                    onChange={(e) => setMentorForm({ ...mentorForm, links: e.target.value })}
                  />
                  <input
                    placeholder="Correo o WhatsApp de contacto *"
                    value={mentorForm.contact}
                    onChange={(e) => setMentorForm({ ...mentorForm, contact: e.target.value })}
                  />
                  <button className="isp-publish" type="submit" disabled={mentorSending}>
                    {mentorSending ? "Enviando…" : "Enviar postulación 💜"}
                  </button>
                </form>
              )}
            </section>
          )}

          {loading && isFeedTab && <p className="isp-empty">Cargando la galaxia… ✨</p>}
          {!loading && isFeedTab && feed.length === 0 && imported.length === 0 && (
            <p className="isp-empty">Todavía no hay publicaciones. ¡Sé la primera! 🌸</p>
          )}


          {feed.map((p) => (
            <article key={p.id} className="isp-card isp-post">
              <header className="isp-post-head">
                <Avatar name={p.author_name} url={p.author_avatar} />
                <strong>{p.author_name}</strong>
                <small>{timeAgo(p.created_at)}</small>
                {me?.id === p.user_id && (
                  <button
                    className="isp-more"
                    title="Eliminar"
                    onClick={async () => {
                      if (!confirm("¿Eliminar esta publicación?")) return;
                      await doDelete({ data: { id: p.id } });
                      await load();
                    }}
                  >
                    🗑️
                  </button>
                )}
              </header>

              {p.content && <p className="isp-post-text">{p.content}</p>}
              {p.image_url && (
                <div className="isp-post-media">
                  <img src={p.image_url} alt="" loading="lazy" />
                </div>
              )}

              <div className="isp-post-actions">
                <button
                  className={p.liked_by_me ? "liked" : ""}
                  onClick={async () => {
                    setPosts((prev) =>
                      prev.map((x) =>
                        x.id === p.id ? { ...x, liked_by_me: !x.liked_by_me, likes: x.likes + (x.liked_by_me ? -1 : 1) } : x,
                      ),
                    );
                    await doLike({ data: { postId: p.id, liked: p.liked_by_me } });
                  }}
                >
                  {p.liked_by_me ? "❤️" : "🤍"} Like {p.likes > 0 ? p.likes : ""}
                </button>
                <button onClick={() => setCommentText((c) => ({ ...c, [p.id]: c[p.id] ?? "" }))}>💬 Comment</button>
                <button onClick={() => void navigator.clipboard?.writeText(`${p.author_name}: ${p.content}`)}>↗ Share</button>
                <button>✧ Vibe Check</button>
              </div>

              {p.comments.length > 0 && (
                <ul className="isp-comments">
                  {p.comments.map((c) => (
                    <li key={c.id}><strong>{c.author_name}</strong> {c.content}</li>
                  ))}
                </ul>
              )}

              <div className="isp-comment-row">
                <input
                  value={commentText[p.id] ?? ""}
                  onChange={(e) => setCommentText((c) => ({ ...c, [p.id]: e.target.value.slice(0, 800) }))}
                  placeholder="Añade un comentario…"
                  onKeyDown={async (e) => {
                    if (e.key !== "Enter" || !(commentText[p.id] ?? "").trim()) return;
                    const v = (commentText[p.id] ?? "").trim();
                    setCommentText((c) => ({ ...c, [p.id]: "" }));
                    await doComment({ data: { postId: p.id, content: v } });
                    await load();
                  }}
                />
                <button
                  disabled={!(commentText[p.id] ?? "").trim()}
                  onClick={async () => {
                    const v = (commentText[p.id] ?? "").trim();
                    setCommentText((c) => ({ ...c, [p.id]: "" }));
                    await doComment({ data: { postId: p.id, content: v } });
                    await load();
                  }}
                >
                  Publicar
                </button>
              </div>
            </article>
          ))}
        </main>

        <aside className="isp-rail">
          <section className="isp-card isp-rail-card">
            <h3>Top Moodboards This Week</h3>
            <div className="isp-mood-grid">
              {moodboards.length === 0 && <p className="isp-empty small">Aún no hay moodboards 🌷</p>}
              {moodboards.map((m) => (
                <div key={m.id} className="isp-mood"><img src={m.image_url!} alt="" loading="lazy" /></div>
              ))}
            </div>
          </section>

          <section className="isp-card isp-rail-card">
            <h3>IsaVibe Check</h3>
            <ul className="isp-vibe">
              {vibeCheck.length === 0 && <li className="isp-empty small">Sin actividad todavía</li>}
              {vibeCheck.map((v, i) => (
                <li key={`${v.name}-${i}`}>
                  <Avatar name={v.name} url={v.avatar} size={28} />
                  <span><strong>{v.name}</strong> {v.state}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {isFeedTab && !composerOpen && (
        <button className="isp-fab" onClick={() => setComposerOpen(true)} aria-label="Crear publicación">
          ✎ <span>Crear publicación</span>
        </button>
      )}
    </div>
  );
}
