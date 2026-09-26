import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { listRewards, redeemReward } from "@/lib/haven.functions";
import { getWallet } from "@/lib/ibc.functions";
import "@/components/guide.css";

export const Route = createFileRoute("/_authenticated/recompensas")({
  head: () => ({
    meta: [
      { title: "Tienda de Recompensas | IsaHaven" },
      { name: "description", content: "Canjea tus IsaBot Coins por premios patrocinados y suscripciones reales en IsaHaven." },
      { property: "og:title", content: "Tienda de Recompensas — IsaHaven" },
      { property: "og:description", content: "Tus IsaBot Coins valen: canjéalas por suscripciones y herramientas digitales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Store,
});

type Data = Awaited<ReturnType<typeof listRewards>>;

function Store() {
  const list = useServerFn(listRewards);
  const redeem = useServerFn(redeemReward);
  const wallet = useServerFn(getWallet);
  const qc = useQueryClient();
  const [data, setData] = useState<Data | null>(null);
  const [balance, setBalance] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [won, setWon] = useState<{ title: string; code: string } | null>(null);

  const refresh = () => {
    list().then(setData).catch(() => undefined);
    wallet().then((w) => setBalance(w.balance)).catch(() => undefined);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const buy = async (id: string, title: string, cost: number) => {
    if (!window.confirm(`¿Canjear "${title}" por ${cost} IsaBot Coins?`)) return;
    setBusy(id);
    try {
      const r = await redeem({ data: { itemId: id } });
      setBalance(r.balance);
      setWon({ title, code: r.code });
      void qc.invalidateQueries({ queryKey: ["ibc-wallet"] });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo canjear");
    } finally { setBusy(null); }
  };

  const titleOf = (itemId: string) => data?.items.find((i) => i.id === itemId)?.title ?? "Premio";

  return (
    <div className="parent-page">
      <div className="parent-wrap" style={{ maxWidth: 1080 }}>
        <div className="parent-card" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0 }}>🎁 Tienda de Recompensas</h1>
            <p className="parent-note">Canjea tus IsaBot Coins por premios patrocinados y suscripciones reales.</p>
            <Link to="/" className="parent-note">← Volver a IsaHaven</Link>
          </div>
          <div className="haven-balance">🪙 {balance} IBC</div>
        </div>

        {data && data.items.filter((i) => i.active).length === 0 && (
          <div className="parent-card parent-note">Pronto llegarán los primeros premios. ¡Sigue acumulando coins completando tareas y exhibiendo certificados! ✨</div>
        )}
        <div className="reward-grid">
          {data?.items.filter((i) => i.active).map((i) => {
            const can = balance >= i.cost && i.stock > 0;
            return (
              <div key={i.id} className="parent-card reward-card">
                <div className="reward-emoji">{i.emoji}</div>
                <h3>{i.title}</h3>
                {i.sponsor && <span className="reward-sponsor">Patrocinado por {i.sponsor}</span>}
                <p className="parent-note">{i.description}</p>
                <div className="reward-foot">
                  <b className="reward-cost">🪙 {i.cost}</b>
                  <span className="parent-note">{i.stock > 0 ? `${i.stock} disponibles` : "Agotado"}</span>
                </div>
                <button className="guide-btn" disabled={!can || busy === i.id} onClick={() => buy(i.id, i.title, i.cost)}>
                  {i.stock === 0 ? "Agotado" : balance < i.cost ? `Te faltan ${i.cost - balance}` : busy === i.id ? "Canjeando…" : "Canjear"}
                </button>
              </div>
            );
          })}
        </div>

        {data && data.mine.length > 0 && (
          <div className="parent-card">
            <h3 style={{ marginTop: 0 }}>🔐 Mis premios canjeados</h3>
            {data.mine.map((m) => (
              <div key={m.id} className="parent-bar" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <span>{titleOf(m.item_id)}</span>
                <code className="reward-code">{m.code}</code>
              </div>
            ))}
          </div>
        )}
      </div>

      {won && (
        <div className="museum-lightbox" onClick={() => setWon(null)}>
          <div className="parent-card" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", maxWidth: 440 }}>
            <div className="reward-emoji">🎉</div>
            <h3>¡Canjeaste {won.title}!</h3>
            <p className="parent-note">Este es tu código. También queda guardado en “Mis premios canjeados”.</p>
            <code className="reward-code" style={{ fontSize: "1.2rem" }}>{won.code}</code>
            <div className="parent-modes" style={{ justifyContent: "center", marginTop: 14 }}>
              <button className="guide-btn" onClick={() => { navigator.clipboard?.writeText(won.code); toast.success("Código copiado"); }}>📋 Copiar</button>
              <button className="guide-btn ghost" onClick={() => setWon(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
