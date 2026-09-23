import type { GlbAsset } from "../assets/manifest.ts";

export type PlayableAvatar = "bianca" | "jonathan";

export const PLAYABLE_AVATARS: Readonly<Record<PlayableAvatar, GlbAsset & { sourceMinY: number; sourceHeight: number }>> = Object.freeze({
  bianca: { url: "/models/players/bianca.v1.glb", gz: "/models/players/bianca.v1.glb.gz", sha256: "ee99eadf935a8b13b51766886085d0d7d576d72a63fd2144db4346fa0fbdbf52", bytes: 179476, tier: "any", sourceMinY: 0, sourceHeight: 1.7362035512924194 },
  jonathan: { url: "/models/players/jonathan.v1.glb", gz: "/models/players/jonathan.v1.glb.gz", sha256: "abf0545868724744bd0e58f89da768ae62cd919f3ae147d56d1b769babd438f1", bytes: 180008, tier: "any", sourceMinY: 0, sourceHeight: 1.8975625038146973 },
});
