import type { GlbAsset } from "../assets/manifest.ts";

export type PlayableAvatar = "bianca" | "jonathan";

export type PlayableAvatarDefinition = GlbAsset & { sourceMinY: number; sourceHeight: number; colours: { coat: string; skin: string; trouser: string; shoe: string; hair: string }; shoulderX: number; armScale: number };

export const PLAYABLE_AVATARS: Readonly<Record<PlayableAvatar, PlayableAvatarDefinition>> = Object.freeze({
  bianca: { url: "/models/players/bianca.v1.glb", gz: "/models/players/bianca.v1.glb.gz", sha256: "100782b0ca12af4a12c63d72897d0b333c272c99d389a5baabfa8e84f2ab448e", bytes: 138876, tier: "any", sourceMinY: 0, sourceHeight: 1.7362035512924194, colours: { coat: "#a86c3d", skin: "#cb946f", trouser: "#3e709e", shoe: "#342d32", hair: "#3a241c" }, shoulderX: .075, armScale: .96 },
  jonathan: { url: "/models/players/jonathan.v1.glb", gz: "/models/players/jonathan.v1.glb.gz", sha256: "5c3a572da9f7264636a6726a39b16e88616ed323595f458f477b8973c4c61e7f", bytes: 158460, tier: "any", sourceMinY: 0, sourceHeight: 1.8975625038146973, colours: { coat: "#302d30", skin: "#a96f50", trouser: "#3e709e", shoe: "#302a28", hair: "#271d19" }, shoulderX: .08, armScale: 1.02 },
});
