import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWallet, getTransactions, checkin, spend, refund } from "@/lib/ibc.functions";
import { effectiveCost, type IbcActionKey } from "@/lib/ibc";

type IbcCtx = {
  enabled: boolean;
  balance: number;
  isPro: boolean;
  unlimited: boolean;
  streakDays: number;
  checkedInToday: boolean;
  transactions: Array<{ id: string; amount: number; type: string; description: string; created_at: string }>;
  vaultOpen: boolean;
  storeOpen: boolean;
  emptyOpen: boolean;
  openVault: () => void;
  closeVault: () => void;
  openStore: () => void;
  closeStore: () => void;
  closeEmpty: () => void;
  doCheckin: () => Promise<{ delta: number; milestone: number; streakDays: number }>;
  streakToast: string | null;
  clearStreakToast: () => void;
  /** Cobra la acción. Devuelve false (y abre el modal de saldo) si no alcanza. */
  charge: (action: IbcActionKey, note?: string) => Promise<boolean>;
  /** Pide confirmación explícita antes de descontar coins. */
  confirmCharge: (action: IbcActionKey, note?: string) => Promise<boolean>;
  /** Devuelve el último cobro (o el indicado). No acepta importes libres. */
  giveBack: (txId?: string | null) => Promise<void>;
  costOf: (action: IbcActionKey) => number;
};

const Ctx = createContext<IbcCtx | null>(null);

export function IbcProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const qc = useQueryClient();
  const walletFn = useServerFn(getWallet);
  const txFn = useServerFn(getTransactions);
  const checkinFn = useServerFn(checkin);
  const spendFn = useServerFn(spend);
  const refundFn = useServerFn(refund);

  const [vaultOpen, setVaultOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [emptyOpen, setEmptyOpen] = useState(false);

  const enabled = Boolean(userId);

  const wallet = useQuery({
    queryKey: ["ibc-wallet", userId],
    queryFn: () => walletFn(),
    enabled,
    staleTime: 15_000,
  });

  const tx = useQuery({
    queryKey: ["ibc-tx", userId],
    queryFn: () => txFn(),
    enabled: enabled && vaultOpen,
    staleTime: 10_000,
  });

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["ibc-wallet", userId] });
    void qc.invalidateQueries({ queryKey: ["ibc-tx", userId] });
  }, [qc, userId]);

  const balance = wallet.data?.balance ?? 0;
  const isPro = wallet.data?.planStatus === "pro";
  const unlimited = wallet.data?.unlimited ?? false;


  const [streakToast, setStreakToast] = useState<string | null>(null);
  // Último cobro realizado: única transacción reembolsable desde el cliente.
  const lastTxRef = useRef<string | null>(null);

  const doCheckin = useCallback(async () => {
    const res = await checkinFn();
    invalidate();
    if (res.milestone > 0) {
      setStreakToast(`🔥 ¡${res.streakDays} días de racha! +${res.milestone} coins de bonus 🪙`);
    } else if (res.delta > 0) {
      setStreakToast(`🔥 Racha de ${res.streakDays} día(s) · +${res.delta} coin`);
    }
    return res;
  }, [checkinFn, invalidate]);

  // Check-in automático una vez al día para que la racha nunca se pierda.
  const autoDone = useRef(false);
  useEffect(() => {
    if (!enabled || autoDone.current) return;
    if (!wallet.data || wallet.data.checkedInToday) return;
    autoDone.current = true;
    void doCheckin().catch(() => undefined);
  }, [enabled, wallet.data, doCheckin]);

  const charge = useCallback(
    async (action: IbcActionKey, note?: string) => {
      if (!enabled) return true; // invitados: sin economía hasta iniciar sesión
      if (unlimited) return true; // ♾️ cuentas con coins infinitas nunca gastan

      const cost = effectiveCost(action, isPro);
      if (cost > 0 && balance < cost) {
        setEmptyOpen(true);
        return false;
      }
      try {
        const res = await spendFn({ data: { action, note: note ?? undefined } });
        lastTxRef.current = res?.txId ?? null;
        invalidate();
        return true;
      } catch (e) {
        if (e instanceof Error && e.message.includes("insufficient_funds")) {
          setEmptyOpen(true);
          return false;
        }
        // Un fallo de red no debe bloquear a la persona.
        return true;
      }
    },
    [enabled, isPro, balance, unlimited, spendFn, invalidate],
  );

  // 🪙 Confirmación manual: nunca se descuentan coins sin un "sí" explícito.
  const [pending, setPending] = useState<{
    action: IbcActionKey;
    note?: string;
    cost: number;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const confirmCharge = useCallback(
    async (action: IbcActionKey, note?: string) => {
      if (!enabled) return true;
      if (unlimited) return true;
      const cost = effectiveCost(action, isPro);
      if (cost <= 0) return charge(action, note);
      if (balance < cost) {
        setEmptyOpen(true);
        return false;
      }
      const ok = await new Promise<boolean>((resolve) => setPending({ action, note, cost, resolve }));
      if (!ok) return false;
      return charge(action, note);
    },
    [enabled, isPro, balance, unlimited, charge],
  );


  const giveBack = useCallback(
    async (txId?: string | null) => {
      const id = txId ?? lastTxRef.current;
      if (!enabled || !id) return;
      try {
        await refundFn({ data: { txId: id } });
        lastTxRef.current = null;
        invalidate();
      } catch {
        /* silencioso */
      }
    },
    [enabled, refundFn, invalidate],
  );

  const value = useMemo<IbcCtx>(
    () => ({
      enabled,
      balance,
      isPro,
      unlimited,
      streakDays: wallet.data?.streakDays ?? 0,
      checkedInToday: wallet.data?.checkedInToday ?? false,
      transactions: tx.data ?? [],
      vaultOpen,
      storeOpen,
      emptyOpen,
      openVault: () => setVaultOpen(true),
      closeVault: () => setVaultOpen(false),
      openStore: () => {
        setEmptyOpen(false);
        setStoreOpen(true);
      },
      closeStore: () => setStoreOpen(false),
      closeEmpty: () => setEmptyOpen(false),
      doCheckin,
      streakToast,
      clearStreakToast: () => setStreakToast(null),
      charge,
      confirmCharge,
      giveBack,
      costOf: (action: IbcActionKey) => (unlimited ? 0 : effectiveCost(action, isPro)),
    }),
    [enabled, balance, isPro, unlimited, wallet.data, tx.data, vaultOpen, storeOpen, emptyOpen, doCheckin, charge, confirmCharge, giveBack, streakToast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {pending && (
        <div
          className="ibc-confirm-back"
          onClick={() => {
            pending.resolve(false);
            setPending(null);
          }}
        >
          <div className="ibc-confirm" onClick={(e) => e.stopPropagation()}>
            <h3>🪙 Confirmar uso de coins</h3>
            <p>
              Esta acción utilizará <b>{pending.cost} IsaBot Coins (IBC)</b>
              {pending.note ? ` · ${pending.note}` : ""}.
            </p>
            <p className="ibc-confirm-bal">Tu saldo actual es {balance} IBC.</p>
            <div className="ibc-confirm-row">
              <button
                className="cancel"
                onClick={() => {
                  pending.resolve(false);
                  setPending(null);
                }}
              >
                Cancelar
              </button>
              <button
                className="ok"
                onClick={() => {
                  pending.resolve(true);
                  setPending(null);
                }}
              >
                Confirmar y usar {pending.cost} IBC
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useIbc(): IbcCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useIbc must be used inside <IbcProvider>");
  return ctx;
}
