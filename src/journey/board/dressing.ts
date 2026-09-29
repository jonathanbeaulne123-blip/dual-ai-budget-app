/**
 * Board dressings (T3): the route, spaces, signposts and piece in the three authored themes. The board is the one
 * strong thing on a deliberately quiet land (`land/dressing.ts`): a cream ribbon with dark edges that reads like a
 * printed board path, worn sandstone for months already travelled, one bright colour for the open month, and paper +
 * stakes for what is still ahead. Meaning never rests on colour alone — every state also has a shape (worn solid /
 * bright raised / stakes-and-string) and a DOM label.
 *
 * Classic Hearth: cream, walnut and honey. Taylor's Scrapbook: paper, plum ink and rose. Newfoundland: fog white,
 * slate and dory yellow.
 */
import type { JourneyBoardDressing, JourneyBoardDressings, ThemeId } from "../contracts.ts";

/** Board-only extras beyond the contract's keys (kept here so the frozen contract stays as agreed). */
export type BoardDressingExtras = {
  /** The attention cap on overdue / needs-review posts (a SHAPE is added too; colour is never the only signal). */
  attention: string;
  /** Paper slips, pennants and flags. */
  paper: string;
  /** The cast shadow disc under the piece and posts. */
  shadow: string;
  /** Boardwalk planks where the route crosses water (T7). */
  plank: string;
};
export type FullBoardDressing = JourneyBoardDressing & BoardDressingExtras;

export const JOURNEY_BOARD_DRESSINGS: JourneyBoardDressings = {
  classic: {
    ribbon: "#f7efe0", ribbonEdge: "#6b4a33",
    spacePast: "#cbb595", spaceOpen: "#f2c46b", spaceUpcoming: "#fbf6ec", spaceInset: "#e4d2b2", stakes: "#7a5a3f",
    signpost: "#8a6446", selectionRing: "#c2553a", provisional: "#2f7f8f", pavilion: "#f1e6d0", clusterBase: "#d8c09a",
    piece: {
      lantern: { body: "#3d5a4a", accent: "#f2c46b" },
      cat: { body: "#d08a4c", accent: "#fff4e0" },
      boat: { body: "#2f5d7c", accent: "#f2e6cf" },
      kettle: { body: "#b24a3a", accent: "#e8dccb" },
    },
  },
  taylor: {
    ribbon: "#fff6ee", ribbonEdge: "#7f4f62",
    spacePast: "#d6b6bc", spaceOpen: "#f5a3b5", spaceUpcoming: "#fffaf6", spaceInset: "#efd9d2", stakes: "#8c6a73",
    signpost: "#9a7280", selectionRing: "#d4406a", provisional: "#4f88a3", pavilion: "#fbeee6", clusterBase: "#e6c7cd",
    piece: {
      lantern: { body: "#5f8a74", accent: "#f7d38b" },
      cat: { body: "#d59a72", accent: "#fff1ea" },
      boat: { body: "#6187b3", accent: "#fbe7ea" },
      kettle: { body: "#c45f78", accent: "#fbeadf" },
    },
  },
  newfoundland: {
    ribbon: "#eef1ee", ribbonEdge: "#2f3e46",
    spacePast: "#aab3b0", spaceOpen: "#f0b43c", spaceUpcoming: "#f6f8f7", spaceInset: "#cfd6d4", stakes: "#44525a",
    signpost: "#56656d", selectionRing: "#c8412f", provisional: "#23798d", pavilion: "#e7ebe9", clusterBase: "#c3ccc9",
    piece: {
      lantern: { body: "#2f4a57", accent: "#f0b43c" },
      cat: { body: "#8d7a68", accent: "#f4efe6" },
      boat: { body: "#c8412f", accent: "#f4efe6" },
      kettle: { body: "#1f5f7a", accent: "#e6e1d6" },
    },
  },
};

const EXTRAS: Record<ThemeId, BoardDressingExtras> = {
  classic: { attention: "#b8452f", paper: "#fffaf0", shadow: "#3d2f22", plank: "#b88f63" },
  taylor: { attention: "#c23b5e", paper: "#fffdf9", shadow: "#4a3440", plank: "#c9a08a" },
  newfoundland: { attention: "#b83a2a", paper: "#fbfcfb", shadow: "#1d2a31", plank: "#94836c" },
};

export const BOARD_DRESSING_KEYS = Object.keys(JOURNEY_BOARD_DRESSINGS.classic) as (keyof JourneyBoardDressing)[];

export function boardDressing(theme: ThemeId): FullBoardDressing {
  const known = (JOURNEY_BOARD_DRESSINGS as Partial<JourneyBoardDressings>)[theme] ? theme : "classic";
  return { ...JOURNEY_BOARD_DRESSINGS[known], ...EXTRAS[known] };
}
