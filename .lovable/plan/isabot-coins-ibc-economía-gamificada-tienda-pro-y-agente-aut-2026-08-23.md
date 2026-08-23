# IsaBot Coins (IBC): economía gamificada, tienda PRO y agente autónomo

Nueva capa de monetización sobre IsaBot, independiente del sistema de puntos actual (los puntos y el premium existentes se quedan como están).

## 1. Economía IBC

Nueva moneda con saldo propio, historial y racha diaria.

- Saldo inicial de 15 IBC al crear la cuenta.
- Check-in diario: +1 IBC, una vez por día, con contador de racha.
- Cada gasto y cada ingreso queda registrado con descripción y fecha.

## 2. Header estilo Duolingo

En la barra superior de la app:

- Insignia dorada con el saldo (🪙 150 IBC) con animación al cambiar.
- Insignia de estado: FREE o PRO.
- Al tocar la insignia de monedas se abre el cajón "Billetera Virtual":
  - Saldo actual y progreso de racha diaria.
  - Botón de check-in diario.
  - Historial de transacciones (+10 IBC Check-in, −3 IBC Imagen).

## 3. Tienda (Duo-Store)

Modal con dos pestañas:

- **Plan PRO** — $4.99 USD / $20.000 COP al mes: texto básico ilimitado, +300 IBC mensuales, acceso prioritario a modelos avanzados y herramientas exclusivas.
- **Packs de monedas**:
  - Starter: 50 IBC — $2.50 USD / $10.000 COP
  - Pro: 150 + 20 bonus — $5.00 USD / $20.000 COP
  - Mega: 500 + 100 bonus — $12.00 USD / $48.000 COP

Los pagos quedan como maqueta: el botón de compra abre un aviso "próximamente" (sin cobrar). La estructura queda lista para conectar Stripe o Paddle después.

## 4. Sin saldo

Cuando una acción no alcanza el saldo, aparece un pop-up estilo Duolingo: "¡Te quedaste sin IsaBot Coins! 🪙" con dos accesos rápidos: suscribirse a PRO o comprar un pack.

## 5. Costos por acción

Se descuenta antes de ejecutar la acción:

| Acción | Costo |
| --- | --- |
| Texto básico / post social | 1 IBC (gratis con PRO) |
| Guion largo / artículo | 2 IBC |
| Imagen / arte 2D | 3 IBC |
| Render 3D / keycap | 5 IBC |
| Acciones agénticas (PDF + correo) | 4 IBC |
| Herramientas PRO | requiere PRO, o doble costo en plan FREE |

El descuento ocurre en el servidor, no en el navegador, y se revierte si la acción falla.

## 6. Agente Autónomo (PDF + correo)

Módulo nuevo en la interfaz. El usuario escribe algo como "Crea una cotización en PDF para Juan Pérez y envíasela a juan@email.com" y ve el progreso paso a paso:

1. Interpretar destinatario, título e ítems.
2. Generar el PDF (descargable desde la UI).
3. Envío del correo: **simulado por ahora** — se muestra el paso como completado y se registra, sin envío real, hasta conectar el proveedor de correo.
4. Descuento de 4 IBC al completar.

## 7. Diseño

Modo oscuro por defecto con acentos morado neón, cian cyberpunk y dorado para monedas e insignia PRO. Todo responsive: móvil PWA y escritorio.

---

## Detalles técnicos

**Base de datos** (migración nueva, tablas separadas de `user_points`):

- `ibc_wallets`: `user_id` (PK), `balance` (default 15), `plan_status` ('free'|'pro'), `streak_days`, `last_checkin_at`, timestamps.
- `ibc_transactions`: `id`, `user_id`, `amount`, `type` ('earn'|'spend'), `description`, `created_at`.
- `ibc_subscriptions`: `id`, `user_id`, `status`, `current_period_end`.

RLS: SELECT propio en las tres tablas; ninguna escritura directa desde el cliente. `GRANT SELECT` a `authenticated`, `GRANT ALL` a `service_role`.

Funciones SQL `SECURITY DEFINER`:
- `ibc_ensure_wallet()` — crea la billetera del usuario actual si no existe.
- `ibc_checkin()` — +1 IBC por día, actualiza racha, escribe transacción.
- `ibc_spend(_amount int, _reason text)` — valida saldo, descuenta atómicamente, escribe transacción; devuelve error `insufficient_funds` si no alcanza.
- `ibc_grant(_amount int, _reason text)` — reversa/abono controlado.

El trigger `handle_new_user` se extiende para crear la billetera con 15 IBC.

**Servidor**: `src/lib/ibc.functions.ts` con `createServerFn` + `requireSupabaseAuth`: `getWallet`, `getTransactions`, `checkin`, `spend`, `refund`. Los flujos que consumen IBC (chat/agente) llaman `spend` antes de ejecutar y `refund` si falla.

**UI**:
- `src/components/ibc/CoinBadge.tsx`, `ProBadge.tsx` en el header actual.
- `VaultDrawer.tsx` (saldo, racha, check-in, historial).
- `DuoStoreModal.tsx` (dos pestañas, precios USD/COP, compra deshabilitada con aviso).
- `InsufficientFundsModal.tsx`.
- `AgentAutonomoPanel.tsx` con badges de progreso; el PDF se genera en el cliente con `jspdf`.
- Hook `useIbc()` sobre TanStack Query para saldo, historial e invalidación tras cada gasto.

Tokens de color nuevos (morado neón, cian, dorado) se añaden a `src/styles.css`; sin colores hardcodeados en componentes.
