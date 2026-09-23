import type { GlbAsset } from "../assets/manifest.ts";
import type { FigureAnatomy } from "./figure.ts";

export type PlayableAvatar = "bianca" | "jonathan";

export type PlayableAvatarDefinition = GlbAsset & {
  sourceMinY: number; sourceHeight: number;
  colours: { coat: string; skin: string; trouser: string; shoe: string; hair: string };
  anatomy: FigureAnatomy;
};

export const PLAYABLE_AVATARS: Readonly<Record<PlayableAvatar, PlayableAvatarDefinition>> = Object.freeze({
  bianca: {
    url: "/models/players/bianca.v1.glb", gz: "/models/players/bianca.v1.glb.gz", sha256: "9217914f8f6869f20bba6cb78fdabf2b0f02654863b73d3bca20644750bed64b", bytes: 143220, tier: "any",
    sourceMinY: 0, sourceHeight: 1.7362035512924194,
    colours: { coat: "#a86c3c", skin: "#f2a675", trouser: "#3f70a8", shoe: "#342d32", hair: "#3a241c" },
    anatomy: { shoulderX: .061, shoulderY: .459, sleeveRadius: .026, sleeveLength: .088,
      hipX: .023, hipY: .305, legRadius: .029, legLength: .247,
      waist: { centre: [.002, .298, -.004], size: [.084, .060, .064] } },
  },
  jonathan: {
    url: "/models/players/jonathan.v1.glb", gz: "/models/players/jonathan.v1.glb.gz", sha256: "20c9a22b0ee3bf5b5354bdbb98a479c6c64496d4be0e9f63ee32e5ba5ce5027f", bytes: 162968, tier: "any",
    sourceMinY: 0, sourceHeight: 1.8975625038146973,
    colours: { coat: "#302c2d", skin: "#f2a675", trouser: "#3f70a8", shoe: "#302a28", hair: "#271d19" },
    anatomy: { shoulderX: .061, shoulderY: .471, sleeveRadius: .027, sleeveLength: .114,
      hipX: .023, hipY: .305, legRadius: .029, legLength: .247 },
  },
});
