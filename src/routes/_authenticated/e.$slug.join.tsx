import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { acceptOrgInvite } from "@/lib/orgMembers.functions";

export const Route = createFileRoute("/_authenticated/e/$slug/join")({
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) ?? "" }),
  component: JoinOrg,
});

function JoinOrg() {
  const { slug } = useParams({ from: "/_authenticated/e/$slug/join" });
  const { token } = Route.useSearch();
  const nav = useNavigate();
  const accept = useServerFn(acceptOrgInvite);
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) { setState("error"); setMsg("Falta el token"); return; }
    (async () => {
      try {
        await accept({ data: { token } });
        setState("ok");
        setTimeout(() => nav({ to: "/e/$slug", params: { slug } }), 1200);
      } catch (err: any) {
        setState("error");
        setMsg(err?.message ?? "No se pudo aceptar");
      }
    })();
  }, [token, slug, accept, nav]);

  return (
    <div style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div style={{ background: "rgba(255,255,255,0.9)", padding: 32, borderRadius: 24, maxWidth: 400 }}>
        {state === "pending" && <><div style={{ fontSize: 36 }}>⏳</div><div style={{ marginTop: 8 }}>Uniéndote…</div></>}
        {state === "ok" && <><div style={{ fontSize: 36 }}>🎉</div><div style={{ marginTop: 8, fontWeight: 700 }}>¡Bienvenido al equipo!</div></>}
        {state === "error" && <><div style={{ fontSize: 36 }}>😕</div><div style={{ marginTop: 8, fontWeight: 700 }}>{msg}</div></>}
      </div>
    </div>
  );
}
