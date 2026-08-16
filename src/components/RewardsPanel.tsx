import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyPoints,
  listRewards,
  redeemReward,
  type PointsSnapshot,
  type RewardItem,
} from "@/lib/points.functions";
import { emitPointsToast } from "./PointsToast";

export function RewardsPanel({
  onClose,
  onPointsChanged,
}: {
  onClose: () => void;
  onPointsChanged: (p: number) => void;
}) {
  const fetchPoints = useServerFn(getMyPoints);
  const fetchList = useServerFn(listRewards);
  const doRedeem = useServerFn(redeemReward);

  const [snap, setSnap] = useState<PointsSnapshot | null>(null);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const [s, r] = await Promise.all([fetchPoints(), fetchList()]);
      setSnap(s);
      setRewards(r);
      onPointsChanged(s.points);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRedeem(code: string, cost: number, title: string) {
    setBusy(code);
    setError(null);
    try {
      const res = await doRedeem({ data: { code } });
      emitPointsToast(-cost, `¡Recompensa desbloqueada! ${title} 🎁`);
      onPointsChanged(res.points);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="rewards-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rewards-header">
          <div>
            <div className="rewards-title">🎁 IsaPuntos & Recompensas</div>
            <div className="rewards-sub">Gana puntos usando IsaBot y desbloquea productos digitales de IsaRoRo Studio.</div>
          </div>
          <button className="rewards-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {loading ? (
          <p style={{ padding: 16, color: "#8b6bb0" }}>Cargando…</p>
        ) : (
          <>
            <div className="rewards-balance">
              <div className="rewards-balance-num">
                <span className="pts-chip-star">🌟</span>
                <span>{snap?.points ?? 0}</span>
                <span className="rewards-balance-label">IsaPuntos</span>
              </div>
              {snap?.nextRewardTitle ? (
                <div className="rewards-progress-wrap">
                  <div className="rewards-progress-txt">
                    Te faltan <b>{Math.max(0, (snap.nextRewardCost ?? 0) - (snap.points ?? 0))}</b> pts
                    para <i>{snap.nextRewardTitle}</i>
                  </div>
                  <div className="rewards-progress-bar">
                    <div className="rewards-progress-fill" style={{ width: `${snap.progressPct}%` }} />
                  </div>
                </div>
              ) : (
                <div className="rewards-progress-txt">🎉 ¡Desbloqueaste todo el catálogo!</div>
              )}
            </div>

            <div className="rewards-earn">
              <b>Cómo ganar puntos:</b>
              <span> +10 al registrarte · +2 por día chateando · +5 por usar Modo Crack (máx 3/día)</span>
            </div>

            {error && <div className="rewards-error">{error}</div>}

            <div className="rewards-list">
              {rewards.map((r) => {
                const affordable = (snap?.points ?? 0) >= r.cost;
                const unlocked = r.redeemed;
                return (
                  <div key={r.code} className={`reward-card ${unlocked ? "unlocked" : ""}`}>
                    <div className="reward-card-img">
                      {r.asset_url ? (
                        <img src={r.asset_url} alt={r.title} />
                      ) : (
                        <div style={{ padding: 20 }}>🎁</div>
                      )}
                      {unlocked && <div className="reward-card-badge">✓ Desbloqueado</div>}
                    </div>
                    <div className="reward-card-body">
                      <div className="reward-card-title">{r.title}</div>
                      <div className="reward-card-desc">{r.description}</div>
                      <div className="reward-card-cost">
                        <span className="pts-chip-star">🌟</span> {r.cost} IsaPuntos
                      </div>
                      {unlocked ? (
                        <a
                          className="reward-card-btn download"
                          href={r.asset_url ?? "#"}
                          download
                          target="_blank"
                          rel="noreferrer"
                        >
                          ⬇️ Descargar
                        </a>
                      ) : (
                        <button
                          className="reward-card-btn"
                          disabled={!affordable || busy === r.code}
                          onClick={() => handleRedeem(r.code, r.cost, r.title)}
                        >
                          {busy === r.code
                            ? "Canjeando…"
                            : affordable
                              ? "🎀 Canjear"
                              : `Faltan ${r.cost - (snap?.points ?? 0)} pts`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
