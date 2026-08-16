import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyProfile,
  updateMyProfile,
  deleteMyAccount,
  type MyProfile,
} from "@/lib/profile.functions";
import { getMyMemory, forgetMemory, type UserMemory } from "@/lib/memory.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Mi perfil — IsaBot" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

async function resizeImageToDataUrl(file: File, size = 256): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("No se pudo leer la imagen"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Imagen inválida"));
    i.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const min = Math.min(img.width, img.height);
  const sx = (img.width - min) / 2;
  const sy = (img.height - min) / 2;
  ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function ProfilePage() {
  const navigate = useNavigate();
  const fetchMe = useServerFn(getMyProfile);
  const saveMe = useServerFn(updateMyProfile);
  const nukeMe = useServerFn(deleteMyAccount);
  const fetchMemory = useServerFn(getMyMemory);
  const nukeMemory = useServerFn(forgetMemory);

  const [me, setMe] = useState<MyProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delText, setDelText] = useState("");
  const [memory, setMemory] = useState<UserMemory | null>(null);
  const [forgetting, setForgetting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await fetchMe();
        setMe(p);
        setDisplayName(p.display_name ?? "");
        setPhone(p.phone ?? "");
        setAvatar(p.avatar_url);
        try {
          const m = await fetchMemory();
          setMemory(m);
        } catch {
          /* opcional */
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doForgetMemory() {
    if (!confirm("¿Seguro que quieres que IsaBot olvide todo lo que sabe de ti? Esto no se puede deshacer.")) return;
    setForgetting(true);
    try {
      await nukeMemory();
      const m = await fetchMemory();
      setMemory(m);
      setInfo("Listo, IsaBot olvidó todo 💭✨");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setForgetting(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    try {
      const url = await resizeImageToDataUrl(f, 256);
      setAvatar(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar imagen");
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await saveMe({
        data: {
          display_name: displayName.trim() || null,
          phone: phone.trim() || null,
          avatar_url: avatar,
        },
      });
      setInfo("¡Perfil actualizado! 💕");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function doDeleteAccount() {
    try {
      await nukeMe();
      try {
        localStorage.removeItem("chats");
        localStorage.removeItem("isabot_user");
      } catch {}
      await supabase.auth.signOut();
      navigate({ to: "/auth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const initial = (displayName || me?.email || "?")[0]?.toUpperCase() ?? "?";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#ffd6eb 0%,#e0c3ff 50%,#c9b6ff 100%)",
        fontFamily: "'Quicksand', system-ui, sans-serif",
        padding: "24px 16px",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, color: "#ff477e", margin: 0, fontWeight: 800 }}>💖 Mi perfil</h1>
          <Link
            to="/"
            style={{
              padding: "8px 14px",
              background: "white",
              borderRadius: 12,
              textDecoration: "none",
              color: "#ff477e",
              fontWeight: 600,
              fontSize: 13,
              boxShadow: "0 4px 12px rgba(255,133,162,0.2)",
            }}
          >
            ← Al chat
          </Link>
        </header>

        <div
          style={{
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(12px)",
            borderRadius: 24,
            padding: 22,
            boxShadow: "0 10px 40px rgba(255,133,162,0.2)",
          }}
        >
          {loading ? (
            <p style={{ color: "#a06b8a" }}>Cargando perfil...</p>
          ) : (
            <form onSubmit={onSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {avatar ? (
                  <img
                    src={avatar}
                    alt="avatar"
                    style={{
                      width: 92,
                      height: 92,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "3px solid #ff85a2",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 92,
                      height: 92,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg,#ffd6eb,#e0c3ff)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 40,
                      fontWeight: 800,
                      color: "#ff477e",
                      border: "3px solid #ff85a2",
                    }}
                  >
                    {initial}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "none",
                      background: "linear-gradient(135deg,#ff85a2,#ff477e)",
                      color: "white",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    📷 Cambiar foto
                  </button>
                  {avatar && (
                    <button
                      type="button"
                      onClick={() => setAvatar(null)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 12,
                        border: "1.5px solid #ffb3d1",
                        background: "white",
                        color: "#c92a5a",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      Quitar foto
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleFile}
                  />
                </div>
              </div>

              <label style={{ fontWeight: 600, color: "#a06b8a", fontSize: 13 }}>
                Nombre de usuario
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={60}
                  placeholder="Tu nombre"
                  style={inputStyle}
                />
              </label>

              <label style={{ fontWeight: 600, color: "#a06b8a", fontSize: 13 }}>
                Correo
                <input value={me?.email ?? ""} disabled style={{ ...inputStyle, opacity: 0.7 }} />
              </label>

              <label style={{ fontWeight: 600, color: "#a06b8a", fontSize: 13 }}>
                Teléfono (opcional)
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
              </label>

              {error && (
                <div style={{ background: "#ffe0ec", color: "#c92a5a", padding: 10, borderRadius: 12, fontSize: 13 }}>
                  {error}
                </div>
              )}
              {info && (
                <div style={{ background: "#e0ffd6", color: "#2a8a3f", padding: 10, borderRadius: 12, fontSize: 13 }}>
                  {info}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "13px",
                  borderRadius: 16,
                  border: "none",
                  background: "linear-gradient(135deg,#ff85a2,#ff477e)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(255,71,126,0.35)",
                }}
              >
                {saving ? "Guardando..." : "💾 Guardar cambios"}
              </button>
            </form>
          )}
        </div>

        {/* ── Memoria Emocional Persistente ── */}
        <div
          style={{
            marginTop: 20,
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(12px)",
            borderRadius: 24,
            padding: 22,
            boxShadow: "0 10px 40px rgba(224,195,255,0.35)",
            border: "1.5px solid rgba(224,195,255,0.6)",
          }}
        >
          <h3 style={{ margin: "0 0 4px", color: "#7a3fbf", fontSize: 18 }}>
            💭 Lo que IsaBot recuerda de ti
          </h3>
          <p style={{ margin: "0 0 14px", color: "#a06b8a", fontSize: 13 }}>
            IsaBot aprende de nuestras conversaciones y adapta su tono. Puedes revisar o borrar esta memoria cuando quieras.
          </p>

          {!memory || (!memory.mood && !memory.likes.length && !memory.goals.length && !memory.important.length && !memory.summary) ? (
            <p style={{ color: "#a06b8a", fontSize: 14, fontStyle: "italic", margin: 0 }}>
              Todavía no te conozco tan bien 🥺 conversemos un poquito más 💕
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {memory.mood && (
                <MemChip label="Ánimo reciente" value={memory.mood} color="#ff85a2" />
              )}
              {memory.tone && (
                <MemChip label="Tono preferido" value={memory.tone} color="#a58eff" />
              )}
              {memory.likes.length > 0 && (
                <MemList label="Le gusta" items={memory.likes} color="#ff85a2" />
              )}
              {memory.dislikes.length > 0 && (
                <MemList label="No le gusta" items={memory.dislikes} color="#c92a5a" />
              )}
              {memory.goals.length > 0 && (
                <MemList label="Metas" items={memory.goals} color="#7a3fbf" />
              )}
              {memory.important.length > 0 && (
                <MemList label="Importante" items={memory.important} color="#a58eff" />
              )}
              {memory.summary && (
                <div style={{ background: "#faf3ff", padding: 12, borderRadius: 12, color: "#5c3d80", fontSize: 13 }}>
                  <b>Resumen: </b>{memory.summary}
                </div>
              )}
            </div>
          )}

          <button
            onClick={doForgetMemory}
            disabled={forgetting}
            style={{
              marginTop: 14,
              padding: "9px 14px",
              borderRadius: 12,
              border: "1.5px solid #c92a5a",
              background: "white",
              color: "#c92a5a",
              fontWeight: 700,
              cursor: forgetting ? "wait" : "pointer",
              fontSize: 13,
            }}
          >
            {forgetting ? "Olvidando..." : "🧹 Que IsaBot olvide todo"}
          </button>
        </div>



        <div
          style={{
            marginTop: 20,
            background: "rgba(255,255,255,0.9)",
            borderRadius: 24,
            padding: 20,
            border: "2px dashed #ffb3d1",
          }}
        >
          <h3 style={{ margin: "0 0 6px", color: "#c92a5a" }}>⚠️ Zona peligrosa</h3>
          <p style={{ color: "#a06b8a", fontSize: 13, margin: "0 0 12px" }}>
            Eliminar tu cuenta es permanente. Se borrarán tu perfil y datos asociados.
          </p>
          {!confirmDel ? (
            <button
              onClick={() => setConfirmDel(true)}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: "1.5px solid #c92a5a",
                background: "white",
                color: "#c92a5a",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              🗑️ Eliminar mi cuenta
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ color: "#c92a5a", fontSize: 13, margin: 0 }}>
                Escribe <b>ELIMINAR</b> para confirmar:
              </p>
              <input
                value={delText}
                onChange={(e) => setDelText(e.target.value)}
                style={inputStyle}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={doDeleteAccount}
                  disabled={delText !== "ELIMINAR"}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 12,
                    border: "none",
                    background: delText === "ELIMINAR" ? "#c92a5a" : "#e0b0be",
                    color: "white",
                    fontWeight: 700,
                    cursor: delText === "ELIMINAR" ? "pointer" : "not-allowed",
                  }}
                >
                  Confirmar eliminación
                </button>
                <button
                  onClick={() => { setConfirmDel(false); setDelText(""); }}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 12,
                    border: "1.5px solid #ffb3d1",
                    background: "white",
                    color: "#a06b8a",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5c3d80" }}>
      <span style={{ color: "#a06b8a", fontWeight: 600, minWidth: 110 }}>{label}:</span>
      <span
        style={{
          padding: "3px 10px",
          borderRadius: 999,
          background: `${color}20`,
          color,
          fontWeight: 700,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function MemList({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ color: "#a06b8a", fontWeight: 600, marginBottom: 4 }}>{label}:</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((it, i) => (
          <span
            key={i}
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              background: `${color}18`,
              color,
              fontWeight: 600,
            }}
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}



const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: "11px 13px",
  borderRadius: 12,
  border: "1.5px solid #ffd6eb",
  background: "white",
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
