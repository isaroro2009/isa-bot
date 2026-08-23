import { createFileRoute } from "@tanstack/react-router";
import { IsaCoin3D, COIN_SKINS } from "@/components/ibc/IsaCoin3D";

export const Route = createFileRoute("/coin-preview")({ component: Page });

function Page() {
  return (
    <div style={{ background: "#140b1e", minHeight: "100vh", display: "flex", gap: 40, padding: 60, flexWrap: "wrap" }}>
      {COIN_SKINS.map((s) => (
        <IsaCoin3D key={s.id} skin={s.id} size={260} isPro label={s.name} />
      ))}
    </div>
  );
}
