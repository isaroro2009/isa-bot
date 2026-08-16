import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyReferralInfo,
  updatePublicProfileSettings,
  type ReferralInfo,
} from "@/lib/referrals.functions";

export function InvitePanel({ onClose }: { onClose: () => void }) {
  const load = useServerFn(getMyReferralInfo);
  const saveSettings = useServerFn(updatePublicProfileSettings);

  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const i = await load();
      setInfo(i);
      setUsername(i.username ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = info?.code ? `${origin}/i/${info.code}` : "";
  const publicUrl = info?.username ? `${origin}/u/${info.username}` : "";

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  }

  const shareText = `Estoy usando IsaBot para organizar mi día y crear sin bloqueo ✨ Entra con mi link y las dos ganamos puntos: ${inviteUrl}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-card" onClick={(e) => e.stopPropagation()}>
        <h3>💌 Invita y gana</h3>
        <p className="habits-sub">
          Comparte tu link mágico. Cuando alguien se registra y usa IsaBot, tú ganas <b>25 IsaPuntos</b> y
          ella <b>15</b>. Cada <b>3 invitadas activas</b> te damos <b>7 días Premium</b> 👑
        </p>

        {error && <div className="rewards-error">{error}</div>}
        {loading && <div className="reminder-item">Cargando…</div>}

        {!loading && info && (
          <>
            <div className="invite-stats">
              <div><b>{info.invited}</b><span>invitadas</span></div>
              <div><b>{info.activated}</b><span>activas</span></div>
              <div><b>{info.pointsEarned}</b><span>puntos</span></div>
              <div><b>{info.premiumDaysEarned}</b><span>días premium</span></div>
            </div>
            <div className="invite-next">
              Te faltan <b>{info.nextPremiumIn}</b> invitada{info.nextPremiumIn === 1 ? "" : "s"} activa
              {info.nextPremiumIn === 1 ? "" : "s"} para tus próximos 7 días Premium 👑
            </div>

            <div className="invite-link">
              <input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} />
              <button className="reminder-btn" onClick={() => copy(inviteUrl, "link")}>
                {copied === "link" ? "¡Copiado! 💕" : "📋 Copiar"}
              </button>
            </div>

            <div className="invite-share">
              <a
                className="invite-share-btn wa"
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                💚 WhatsApp
              </a>
              <button className="invite-share-btn" onClick={() => copy(shareText, "text")}>
                {copied === "text" ? "¡Copiado!" : "✍️ Copiar mensaje"}
              </button>
            </div>

            <div className="invite-public">
              <h4>🪐 Tu perfil público</h4>
              <p className="habits-sub">
                Una página compartible con tu presentación y tus creaciones de IsaSpace, con tu link de invitación.
              </p>
              <div className="invite-link">
                <span className="invite-prefix">{origin}/u/</span>
                <input
                  value={username}
                  placeholder="tu-usuario"
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                  maxLength={24}
                />
              </div>
              <label className="reminder-mail-toggle">
                <input
                  type="checkbox"
                  checked={info.publicProfileEnabled}
                  onChange={async (e) => {
                    const enabled = e.target.checked;
                    setInfo({ ...info, publicProfileEnabled: enabled });
                    try {
                      await saveSettings({ data: { enabled } });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err));
                    }
                  }}
                />
                <span>Hacer público mi perfil</span>
              </label>
              <div className="myday-footer">
                <button
                  className="reminder-btn"
                  disabled={busy || username.length < 3}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await saveSettings({ data: { username } });
                      await refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Guardando…" : "💾 Guardar usuario"}
                </button>
                {publicUrl && info.publicProfileEnabled && (
                  <button className="chat-item-btn" onClick={() => copy(publicUrl, "public")}>
                    {copied === "public" ? "¡Copiado!" : "🔗 Copiar perfil"}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        <button className="close-settings" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
