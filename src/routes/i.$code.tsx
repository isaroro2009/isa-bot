import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { getInviterPreview } from "@/lib/referrals.functions";
import "../isabot.css";

export const Route = createFileRoute("/i/$code")({
  loader: ({ params }) => getInviterPreview({ data: { code: params.code } }),
  head: ({ loaderData }) => {
    const who = loaderData?.name ? `${loaderData.name} te invita` : "Te invitaron";
    return {
      meta: [
        { title: `${who} a IsaBot — Co-piloto de IA creativa` },
        {
          name: "description",
          content: "Únete a IsaBot: organiza tu día, estudia mejor y crea sin bloqueo. Entra con esta invitación y gana IsaPuntos de bienvenida.",
        },
        { property: "og:title", content: `${who} a IsaBot ✨` },
        { property: "og:description", content: "Regístrate con esta invitación y las dos ganan IsaPuntos." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => <InviteShell code="" name={null} />,
  notFoundComponent: () => <InviteShell code="" name={null} />,
  component: InvitePage,
});

function InviteShell({ code, name }: { code: string; name: string | null }) {
  return (
    <div className="pub-page">
      <div className="pub-card invite-landing">
        <div className="pub-avatar placeholder">✨</div>
        <h1 className="pub-name">{name ? `${name} te invita a IsaBot` : "Te invitaron a IsaBot"}</h1>
        <p className="pub-bio">
          IsaBot es tu co-piloto de IA creativa: te arma el plan del día, te acompaña en modo foco,
          escribe contigo y te ayuda a no rendirte. Creada por Isabella Rodríguez Roque 💜
        </p>
        <div className="pub-tags">
          <span>🚀 Mi Día</span><span>🎯 Modo Foco</span><span>🎨 Imágenes</span>
          <span>📞 Llamadas de voz</span><span>🪐 IsaSpace</span><span>🎁 IsaPuntos</span>
        </div>
        <div className="invite-bonus">
          🎁 Al registrarte con esta invitación recibes <b>15 IsaPuntos</b> extra
          {name ? ` y ${name} recibe 25.` : "."}
        </div>
        <Link to="/auth" className="pub-cta">✨ Crear mi cuenta gratis</Link>
        {code && <div className="invite-code-note">Código de invitación: <b>{code}</b></div>}
      </div>
    </div>
  );
}

function InvitePage() {
  const params = Route.useParams();
  const inviter = Route.useLoaderData();

  useEffect(() => {
    try {
      window.localStorage.setItem("isabot_referral_code", params.code.toUpperCase());
    } catch {
      /* noop */
    }
  }, [params.code]);

  return <InviteShell code={params.code.toUpperCase()} name={inviter?.name ?? null} />;
}
