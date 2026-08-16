import { createFileRoute } from "@tanstack/react-router";
import { IsaSpacePage } from "@/components/IsaSpacePage";

export const Route = createFileRoute("/_authenticated/isaspace")({
  head: () => ({
    meta: [
      { title: "IsaSpace — la comunidad creativa de IsaBot" },
      { name: "description", content: "Comparte moodboards, ideas y tu vibe creativa con la comunidad de IsaBot." },
      { property: "og:title", content: "IsaSpace — la comunidad creativa de IsaBot" },
      { property: "og:description", content: "Feed social de estudiantes y emprendedores creativos dentro de IsaBot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IsaSpacePage,
});
