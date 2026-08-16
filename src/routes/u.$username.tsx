import { createFileRoute, Link } from "@tanstack/react-router";
import { getPublicProfile } from "@/lib/referrals.functions";
import "../isabot.css";

export const Route = createFileRoute("/u/$username")({
  loader: ({ params }) => getPublicProfile({ data: { username: params.username } }),
  head: ({ loaderData, params }) => {
    const name = loaderData?.display_name ?? params.username;
    const desc = loaderData?.headline ?? `Conoce a ${name} y sus creaciones en IsaBot, el co-piloto de IA creativa.`;
    return {
      meta: [
        { title: `${name} en IsaBot — Perfil creativo` },
        { name: "description", content: desc.slice(0, 155) },
        { property: "og:title", content: `${name} en IsaBot` },
        { property: "og:description", content: desc.slice(0, 155) },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => <PublicShell><p>No pudimos cargar este perfil 💔</p></PublicShell>,
  notFoundComponent: () => <PublicShell><p>Perfil no encontrado 🌸</p></PublicShell>,
  component: PublicProfilePage,
});

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pub-page">
      <div className="pub-card">{children}</div>
    </div>
  );
}

function PublicProfilePage() {
  const profile = Route.useLoaderData();
  const params = Route.useParams();

  if (!profile) {
    return (
      <PublicShell>
        <h1>@{params.username}</h1>
        <p>Este perfil no existe o todavía no es público 🌸</p>
        <Link to="/auth" className="pub-cta">✨ Crear mi cuenta en IsaBot</Link>
      </PublicShell>
    );
  }

  const joinUrl = profile.referral_code ? `/i/${profile.referral_code}` : "/auth";

  return (
    <div className="pub-page">
      <div className="pub-card">
        <div className="pub-head">
          {profile.avatar_url
            ? <img className="pub-avatar" src={profile.avatar_url} alt={profile.display_name ?? profile.username} />
            : <div className="pub-avatar placeholder">✨</div>}
          <div>
            <h1 className="pub-name">{profile.display_name ?? profile.username}</h1>
            <div className="pub-user">@{profile.username}{profile.location ? ` · ${profile.location}` : ""}</div>
            {profile.headline && <div className="pub-headline">{profile.headline}</div>}
          </div>
        </div>

        {profile.bio && <p className="pub-bio">{profile.bio}</p>}

        {profile.interests.length > 0 && (
          <div className="pub-tags">
            {profile.interests.map((t: string) => <span key={t}>{t}</span>)}
          </div>
        )}

        {profile.posts.length > 0 && (
          <>
            <h2 className="pub-sec">🪐 Sus creaciones en IsaSpace</h2>
            <div className="pub-grid">
              {profile.posts.map((p: { id: string; content: string; image_url: string | null }) => (
                <article key={p.id} className="pub-post">
                  {p.image_url && <img src={p.image_url} alt="" loading="lazy" />}
                  <p>{p.content}</p>
                </article>
              ))}
            </div>
          </>
        )}

        <div className="pub-foot">
          <div className="pub-foot-txt">
            Hecho con <b>IsaBot</b> — el co-piloto de IA creativa de IsaRoRo Studio 💜
          </div>
          <a className="pub-cta" href={joinUrl}>✨ Entrar con su invitación</a>
        </div>
      </div>
    </div>
  );
}
