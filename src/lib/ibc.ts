// 🪙 IsaBot Coins (IBC) — catálogo de costos y precios (client-safe).

export type IbcActionKey =
  | "text_basic"
  | "long_form"
  | "image"
  | "render3d"
  | "agent"
  | "pro_tool"
  | "theme";

export const IBC_COSTS: Record<IbcActionKey, { cost: number; label: string; freeForPro?: boolean; proOnly?: boolean }> = {
  text_basic: { cost: 1, label: "Texto básico / post social", freeForPro: true },
  long_form: { cost: 2, label: "Guion largo / artículo" },
  image: { cost: 3, label: "Imagen / arte 2D" },
  render3d: { cost: 5, label: "Render 3D / keycap" },
  agent: { cost: 4, label: "Agente autónomo (PDF + correo)" },
  pro_tool: { cost: 6, label: "Herramienta PRO (Turbo)", proOnly: true },
  theme: { cost: 20, label: "Tema de interfaz" },
};

/** Costo efectivo según el plan del usuario. Las herramientas PRO cuestan el doble en plan FREE. */
export function effectiveCost(key: IbcActionKey, isPro: boolean): number {
  const rule = IBC_COSTS[key];
  if (isPro) return rule.freeForPro ? 0 : rule.cost;
  return rule.proOnly ? rule.cost * 2 : rule.cost;
}

export const PRO_PLAN = {
  usd: "$4.99 USD",
  cop: "$20.000 COP",
  perks: [
    "Texto básico ilimitado (0 IBC)",
    "+300 IBC de bonus cada mes",
    "Acceso prioritario a modelos avanzados",
    "Herramientas PRO exclusivas sin recargo",
    "Soporte prioritario de IsaBot 💜",
  ],
};

export type CoinPack = {
  id: string;
  name: string;
  coins: number;
  bonus: number;
  usd: string;
  cop: string;
  emoji: string;
  highlight?: boolean;
};

export const COIN_PACKS: CoinPack[] = [
  { id: "starter", name: "Starter Pack", coins: 50, bonus: 0, usd: "$2.50 USD", cop: "$10.000 COP", emoji: "🪙" },
  { id: "pro", name: "Pro Pack", coins: 150, bonus: 20, usd: "$5.00 USD", cop: "$20.000 COP", emoji: "💎", highlight: true },
  { id: "mega", name: "Mega Pack", coins: 500, bonus: 100, usd: "$12.00 USD", cop: "$48.000 COP", emoji: "🌟" },
];
