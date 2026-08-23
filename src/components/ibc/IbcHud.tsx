import { useEffect, useState } from "react";
import { useIbc } from "./useIbc";
import { COIN_PACKS, IBC_COSTS, PRO_PLAN } from "@/lib/ibc";
import "./ibc.css";

const STREAK_GOAL = 7;

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Badges del header: saldo IBC + estado del plan. */
export function IbcHud() {
  const ibc = useIbc();
  const [bump, setBump] = useState(false);
  const [prev, setPrev] = useState(ibc.balance);

  useEffect(() => {
    if (ibc.balance !== prev) {
      setPrev(ibc.balance);
      setBump(true);
      const t = setTimeout(() => setBump(false), 450);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [ibc.balance, prev]);

  if (!ibc.enabled) return null;

  return (
    <div className="ibc-root ibc-hud">
      <button
        className={`ibc-badge${bump ? " bump" : ""}`}
        onClick={ibc.openVault}
        data-tour="coins"
        title="Tu bóveda de IsaBot Coins"
        aria-label={`${ibc.balance} IsaBot Coins`}
      >
        🪙 {ibc.balance}
      </button>
      <button
        className="ibc-streak-badge"
        data-tour="streak"
        onClick={ibc.openVault}
        title="Tu racha diaria — vuelve cada día para ganar coins"
      >
        🔥 {ibc.streakDays}
      </button>
      <button
        className={`ibc-plan${ibc.isPro ? " pro" : ""}`}
        onClick={ibc.openStore}
        title={ibc.isPro ? "Plan PRO activo" : "Mejorar a PRO"}
      >
        {ibc.isPro ? "👑 PRO" : "✨ FREE"}
      </button>
    </div>
  );
}

/** Bóveda: saldo, racha, check-in diario e historial. */
export function VaultDrawer() {
  const ibc = useIbc();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!ibc.vaultOpen) return null;

  const pct = Math.min(100, (ibc.streakDays / STREAK_GOAL) * 100);

  async function doCheckin() {
    setBusy(true);
    try {
      const res = await ibc.doCheckin();
      setMsg(
        res.milestone > 0
          ? `🔥 ¡${res.streakDays} días! +${res.delta} IBC (incluye bonus de racha) 💛`
          : res.delta > 0
            ? `+${res.delta} IBC por venir hoy 💛`
            : "Ya reclamaste tus coins de hoy ✨",
      );
    } catch {
      setMsg("No pude registrar el check-in, intenta de nuevo 💔");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ibc-root ibc-overlay right" onClick={ibc.closeVault}>
      <div className="ibc-panel ibc-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="ibc-head">
          <h3>🪙 Tu bóveda</h3>
          <button className="ibc-x" onClick={ibc.closeVault} aria-label="Cerrar">✕</button>
        </div>

        <div className="ibc-balance-card">
          <div className="ibc-balance-num">{ibc.balance}</div>
          <div className="ibc-balance-lbl">IsaBot Coins disponibles</div>
        </div>

        <div className="ibc-streak">
          <div className="ibc-row">
            <span>🔥 Racha: {ibc.streakDays} día{ibc.streakDays === 1 ? "" : "s"}</span>
            <span>Meta {STREAK_GOAL}</span>
          </div>
          <div className="ibc-streak-bar"><div className="ibc-streak-fill" style={{ width: `${pct}%` }} /></div>
        </div>

        <button className="ibc-btn" onClick={doCheckin} disabled={busy || ibc.checkedInToday}>
          {ibc.checkedInToday ? "✅ Check-in de hoy hecho" : busy ? "…" : "🎁 Reclamar +1 IBC de hoy"}
        </button>
        {msg && <p className="ibc-empty-note">{msg}</p>}

        <button className="ibc-btn ghost" onClick={ibc.openStore}>💎 Conseguir más coins</button>

        <h4 style={{ margin: "22px 0 0", fontSize: ".95rem" }}>Movimientos</h4>
        {ibc.transactions.length === 0 ? (
          <p className="ibc-empty-note">Aún no hay movimientos. ¡Usa a IsaBot y aparecerán aquí!</p>
        ) : (
          <ul className="ibc-tx-list">
            {ibc.transactions.map((t) => (
              <li key={t.id} className="ibc-tx">
                <span>
                  {t.description || t.type}
                  <span className="ibc-tx-date">{fmt(t.created_at)}</span>
                </span>
                <span className={`ibc-tx-amt ${t.amount >= 0 ? "plus" : "minus"}`}>
                  {t.amount >= 0 ? "+" : ""}{t.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Duo-Store: plan PRO y packs de coins. */
export function DuoStore() {
  const ibc = useIbc();
  const [tab, setTab] = useState<"pro" | "coins">("pro");
  const [note, setNote] = useState<string | null>(null);
  if (!ibc.storeOpen) return null;

  return (
    <div className="ibc-root ibc-overlay" onClick={ibc.closeStore}>
      <div className="ibc-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ibc-head">
          <h3>🛒 Tienda IsaBot</h3>
          <button className="ibc-x" onClick={ibc.closeStore} aria-label="Cerrar">✕</button>
        </div>

        <div className="ibc-tabs">
          <button className={`ibc-tab${tab === "pro" ? " active" : ""}`} onClick={() => setTab("pro")}>👑 Plan PRO</button>
          <button className={`ibc-tab${tab === "coins" ? " active" : ""}`} onClick={() => setTab("coins")}>🪙 Coins</button>
        </div>

        {tab === "pro" ? (
          <div className="ibc-pro-card">
            <div className="ibc-price">
              {PRO_PLAN.usd} <small>/ mes · {PRO_PLAN.cop}</small>
            </div>
            <ul className="ibc-perks">
              {PRO_PLAN.perks.map((p) => <li key={p}>{p}</li>)}
            </ul>
            <button className="ibc-btn" onClick={() => setNote("Pagos en camino: te avisaré apenas se activen 💜")}>
              {ibc.isPro ? "👑 Ya eres PRO" : "Hacerme PRO"}
            </button>
          </div>
        ) : (
          <div className="ibc-packs">
            {COIN_PACKS.map((p) => (
              <div key={p.id} className={`ibc-pack${p.highlight ? " high" : ""}`}>
                <span className="ibc-pack-emoji">{p.emoji}</span>
                <div className="ibc-pack-info">
                  <div className="ibc-pack-name">{p.name}</div>
                  <div className="ibc-pack-coins">
                    {p.coins} IBC {p.bonus > 0 && <span className="ibc-pack-bonus">+{p.bonus} bonus</span>}
                  </div>
                  <div className="ibc-pack-coins">{p.usd} · {p.cop}</div>
                </div>
                <button className="ibc-pack-buy" onClick={() => setNote("Pagos en camino: te avisaré apenas se activen 💜")}>
                  Comprar
                </button>
              </div>
            ))}
          </div>
        )}

        {note && <p className="ibc-soon">{note}</p>}

        <div className="ibc-soon">
          Costos actuales:{" "}
          {Object.entries(IBC_COSTS).map(([k, v]) => `${v.label} ${v.cost} IBC`).join(" · ")}
        </div>
      </div>
    </div>
  );
}

/** Modal cuando el saldo no alcanza. */
export function InsufficientFundsModal() {
  const ibc = useIbc();
  if (!ibc.emptyOpen) return null;
  return (
    <div className="ibc-root ibc-overlay" onClick={ibc.closeEmpty}>
      <div className="ibc-panel ibc-empty-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ibc-empty-emoji">🪙</div>
        <h3 style={{ margin: "8px 0" }}>Te quedaste sin coins</h3>
        <p className="ibc-empty-lbl" style={{ opacity: 0.8, fontSize: ".9rem" }}>
          Vuelve mañana por tu check-in gratis, o consigue más para seguir creando ahora mismo.
        </p>
        <button className="ibc-btn neon" onClick={ibc.openStore}>💎 Ver tienda</button>
        <button className="ibc-btn ghost" onClick={ibc.closeEmpty}>Ahora no</button>
      </div>
    </div>
  );
}

/** Todo el HUD de overlays en un solo montaje. */
/** Aviso flotante de racha / bonus. */
function StreakToast() {
  const ibc = useIbc();
  useEffect(() => {
    if (!ibc.streakToast) return undefined;
    const t = setTimeout(ibc.clearStreakToast, 4200);
    return () => clearTimeout(t);
  }, [ibc.streakToast, ibc.clearStreakToast]);
  if (!ibc.streakToast) return null;
  return (
    <div className="ibc-root ibc-streak-toast" onClick={ibc.clearStreakToast} role="status">
      {ibc.streakToast}
    </div>
  );
}

export function IbcOverlays() {
  return (
    <>
      <StreakToast />
      <VaultDrawer />
      <DuoStore />
      <InsufficientFundsModal />
    </>
  );
}
