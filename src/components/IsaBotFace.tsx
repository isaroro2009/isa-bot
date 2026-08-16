import avatarAsset from "@/assets/isabot-avatar.png.asset.json";

export type FaceExpression =
  | "neutral"
  | "happy"
  | "sad"
  | "worried"
  | "excited"
  | "sleepy"
  | "love"
  | "angry";

type Props = {
  expression?: FaceExpression;
  speaking?: boolean;
  size?: number;
};

export function IsaBotFace({ size = 340 }: Props) {
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      <img
        src={avatarAsset.url}
        alt="IsaBot"
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          filter: "drop-shadow(0 12px 26px rgba(180, 140, 220, 0.35))",
        }}
      />
    </div>
  );
}
