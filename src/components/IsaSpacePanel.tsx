import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  addComment,
  createPost,
  deletePost,
  listPosts,
  toggleLike,
  type IsaPost,
} from "@/lib/isaspace.functions";

function timeAgo(iso: string) {
  const s = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

function Avatar({ name, url, size = 34 }: { name: string; url?: string | null; size?: number }) {
  return (
    <span className="ig-avatar" style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" /> : <b>{name[0]?.toUpperCase() ?? "?"}</b>}
    </span>
  );
}

export function IsaSpacePanel({ onClose, myUserId }: { onClose: () => void; myUserId: string | null }) {
  const fetchPosts = useServerFn(listPosts);
  const doCreate = useServerFn(createPost);
  const doDelete = useServerFn(deletePost);
  const doLike = useServerFn(toggleLike);
  const doComment = useServerFn(addComment);

  const [posts, setPosts] = useState<IsaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
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
  }, [load]);

  useEffect(() => {
    if (!file) { setFilePreview(null); return; }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const stories = useMemo(() => {
    const seen = new Map<string, { name: string; avatar: string | null }>();
    for (const p of posts) if (!seen.has(p.user_id)) seen.set(p.user_id, { name: p.author_name, avatar: p.author_avatar });
    return Array.from(seen.entries()).slice(0, 12);
  }, [posts]);

  async function publish() {
    setSending(true);
    try {
      let imageUrl: string | null = null;
      if (file && myUserId) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${myUserId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("isaspace").upload(path, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });
        if (upErr) throw upErr;
        imageUrl = path;
      }
      await doCreate({ data: { content: text.trim(), imageUrl } });
      setText("");
      setFile(null);
      setComposerOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo publicar");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-card isaspace-card ig" onClick={(e) => e.stopPropagation()}>
        <div className="ig-topbar">
          <span className="ig-brand">IsaSpace</span>
          <div className="ig-topbar-actions">
            <button className="ig-icon-btn" title="Crear publicación" onClick={() => setComposerOpen((v) => !v)}>＋</button>
            <button className="ig-icon-btn" title="Cerrar" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="ig-scroll">
          {stories.length > 0 && (
            <div className="ig-stories">
              {stories.map(([id, s]) => (
                <div className="ig-story" key={id}>
                  <span className="ig-story-ring"><Avatar name={s.name} url={s.avatar} size={54} /></span>
                  <small>{s.name}</small>
                </div>
              ))}
            </div>
          )}

          {composerOpen && (
            <div className="ig-composer">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 2000))}
                placeholder="Escribe un pie de foto… 💭"
                rows={3}
              />
              {filePreview && (
                <div className="ig-composer-preview">
                  <img src={filePreview} alt="vista previa" />
                  <button onClick={() => setFile(null)}>✕</button>
                </div>
              )}
              <div className="ig-composer-row">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <button className="ig-ghost-btn" onClick={() => fileRef.current?.click()}>🖼️ Foto</button>
                <small>{text.length}/2000</small>
                <button
                  className="ig-share-btn"
                  disabled={sending || (!text.trim() && !file)}
                  onClick={publish}
                >
                  {sending ? "Compartiendo…" : "Compartir"}
                </button>
              </div>
            </div>
          )}

          {error && <div className="isaspace-error">{error}</div>}
          {loading && <p className="isaspace-empty">Cargando la galaxia… ✨</p>}
          {!loading && posts.length === 0 && (
            <p className="isaspace-empty">Todavía no hay publicaciones. ¡Sé la primera! 🌸</p>
          )}

          <div className="ig-feed">
            {posts.map((p) => (
              <article key={p.id} className="ig-post">
                <header className="ig-post-head">
                  <Avatar name={p.author_name} url={p.author_avatar} />
                  <div className="ig-post-meta">
                    <strong>{p.author_name}</strong>
                    <small>{timeAgo(p.created_at)}</small>
                  </div>
                  {myUserId === p.user_id && (
                    <button
                      className="ig-icon-btn"
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

                {p.image_url && (
                  <div className="ig-media">
                    <img src={p.image_url} alt="" loading="lazy" />
                  </div>
                )}

                <div className="ig-actions">
                  <button
                    className={p.liked_by_me ? "liked" : ""}
                    title="Me gusta"
                    onClick={async () => {
                      setPosts((prev) =>
                        prev.map((x) =>
                          x.id === p.id
                            ? { ...x, liked_by_me: !x.liked_by_me, likes: x.likes + (x.liked_by_me ? -1 : 1) }
                            : x,
                        ),
                      );
                      await doLike({ data: { postId: p.id, liked: p.liked_by_me } });
                    }}
                  >
                    {p.liked_by_me ? "❤️" : "🤍"}
                  </button>
                  <button title="Comentar" onClick={() => setCommentText((c) => ({ ...c, [p.id]: c[p.id] ?? "" }))}>💬</button>
                  <button
                    title="Compartir"
                    onClick={() => {
                      void navigator.clipboard?.writeText(`${p.author_name}: ${p.content}`);
                    }}
                  >
                    ✈️
                  </button>
                </div>

                <div className="ig-body">
                  <strong className="ig-likes">{p.likes} me gusta</strong>
                  {p.content && (
                    <p className="ig-caption"><strong>{p.author_name}</strong> {p.content}</p>
                  )}
                  {p.comments.length > 0 && (
                    <ul className="ig-comments">
                      {p.comments.map((c) => (
                        <li key={c.id}><strong>{c.author_name}</strong> {c.content}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="ig-comment-row">
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
          </div>
        </div>
      </div>
    </div>
  );
}
