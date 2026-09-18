import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AcademyPanel } from "@/components/AcademyPanel";

export const Route = createFileRoute("/_authenticated/academy")({
  head: () => ({
    meta: [
      { title: "IsaAcademy — clases de IA y tech con IsaBot" },
      {
        name: "description",
        content: "Rutas de aprendizaje con quiz, XP, racha diaria y cursos creados con IA.",
      },
      { property: "og:title", content: "IsaAcademy — clases de IA y tech con IsaBot" },
      {
        property: "og:description",
        content: "Aprende IA, prompting y no-code con lecciones cortas y cursos personalizados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AcademyRoute,
});

function AcademyRoute() {
  const navigate = useNavigate();
  return (
    <AcademyPanel
      fullPage
      onClose={() => {
        if (window.opener) window.close();
        else void navigate({ to: "/" });
      }}
      onUpgrade={() => void navigate({ to: "/" })}
    />
  );
}
