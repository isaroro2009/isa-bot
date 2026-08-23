import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWallet, getTransactions, checkin, spend, refund } from "@/lib/ibc.functions";
import { effectiveCost, type IbcActionKey } from "@/lib/ibc";

type IbcCtx = {
  enabled: boolean;
  balance: number;
  isPro: boolean;
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
  doCheckin: () => Promise<number>;
  /** Cobra la acción. Devuelve false (y abre el modal de saldo) si no alcanza. */
  charge: (action: IbcActionKey, note?: string) => Promise<boolean>;
  giveBack: (amount: number, note?: string) => Promise<void>;
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

  const doCheckin = useCallback(async () => {
    const res = await checkinFn();
    invalidate();
    return res.delta;
  }, [checkinFn, invalidate]);

  const charge = useCallback(
    async (action: IbcActionKey, note?: string) => {
      if (!enabled) return true; // invitados: sin economía hasta iniciar sesión
      const cost = effectiveCost(action, isPro);
      if (cost > 0 && balance < cost) {
        setEmptyOpen(true);
        return false;
      }
      try {
        await spendFn({ data: { action, note: note ?? undefined } });
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
    [enabled, isPro, balance, spendFn, invalidate],
  );

  const giveBack = useCallback(
    async (amount: number, note?: string) => {
      if (!enabled || amount <= 0) return;
      try {
        await refundFn({ data: { amount, note: note ?? "Reembolso" } });
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
      charge,
      giveBack,
      costOf: (action: IbcActionKey) => effectiveCost(action, isPro),
    }),
    [enabled, balance, isPro, wallet.data, tx.data, vaultOpen, storeOpen, emptyOpen, doCheckin, charge, giveBack],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIbc(): IbcCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useIbc must be used inside <IbcProvider>");
  return ctx;
}
