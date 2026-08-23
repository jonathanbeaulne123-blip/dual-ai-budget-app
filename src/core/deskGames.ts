import { todayKey } from "./calendar.ts";
import type { HouseholdGames, HangmanGame, TicTacToeGame } from "./types.ts";

/** Household-safe words. Never quiet appointment titles (D-054 / D-060). */
export const HANGMAN_WORDS = [
  "milk",
  "hydro",
  "visor",
  "oats",
  "tips",
  "loaf",
  "hearth",
  "coffee",
  "porch",
  "ruff",
  "kettle",
  "blotter",
  "toque",
  "maple",
  "sill",
  "chalk",
  "pine",
  "jar",
] as const;

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export const MAX_HANGMAN_MISSES = 6;

export const EMPTY_TICTACTOE: TicTacToeGame = {
  cells: ["", "", "", "", "", "", "", "", ""],
  turn: "x",
  winner: null,
  lastMemberId: "",
  updatedAt: "",
  updatedBy: "",
};

export function pickHangmanWord(seed: string): string {
  const cleaned = seed.replace(/\D/g, "") || "1";
  const index = Number(cleaned.slice(-4)) % HANGMAN_WORDS.length;
  return HANGMAN_WORDS[index] ?? "milk";
}

export function emptyHangman(seed = todayKey()): HangmanGame {
  return {
    word: pickHangmanWord(seed),
    guessed: [],
    turnMemberId: "",
    winnerMemberId: null,
    lost: false,
    updatedAt: "",
    updatedBy: "",
  };
}

export const EMPTY_GAMES: HouseholdGames = {
  tictactoe: { ...EMPTY_TICTACTOE },
  hangman: emptyHangman("hearth"),
};

function isMark(value: unknown): value is "x" | "o" | "" {
  return value === "x" || value === "o" || value === "";
}

export function shapeTicTacToe(input?: Partial<TicTacToeGame> | null): TicTacToeGame {
  const cells = Array.isArray(input?.cells)
    ? input.cells.slice(0, 9).map((cell) => (isMark(cell) ? cell : ""))
    : [...EMPTY_TICTACTOE.cells];
  while (cells.length < 9) cells.push("");
  const turn = input?.turn === "o" ? "o" : "x";
  const winner = input?.winner === "x" || input?.winner === "o" || input?.winner === "draw" ? input.winner : null;
  return {
    cells,
    turn,
    winner,
    lastMemberId: String(input?.lastMemberId || ""),
    updatedAt: String(input?.updatedAt || ""),
    updatedBy: String(input?.updatedBy || ""),
  };
}

export function shapeHangman(input?: Partial<HangmanGame> | null): HangmanGame {
  const raw = String(input?.word || "").toLowerCase().replace(/[^a-z]/g, "");
  const word = HANGMAN_WORDS.includes(raw as (typeof HANGMAN_WORDS)[number]) ? raw : pickHangmanWord(raw || "milk");
  const guessed = Array.isArray(input?.guessed)
    ? [...new Set(input.guessed.map((letter) => String(letter).toLowerCase()).filter((letter) => /^[a-z]$/.test(letter)))]
    : [];
  return {
    word,
    guessed,
    turnMemberId: String(input?.turnMemberId || ""),
    winnerMemberId: input?.winnerMemberId ? String(input.winnerMemberId) : null,
    lost: Boolean(input?.lost),
    updatedAt: String(input?.updatedAt || ""),
    updatedBy: String(input?.updatedBy || ""),
  };
}

export function shapeGames(input?: Partial<HouseholdGames> | null): HouseholdGames {
  return {
    tictactoe: shapeTicTacToe(input?.tictactoe),
    hangman: shapeHangman(input?.hangman),
  };
}

export function mergeGames(server?: HouseholdGames | null, client?: HouseholdGames | null): HouseholdGames {
  const left = shapeGames(server);
  const right = shapeGames(client);
  const pick = <T extends { updatedAt: string }>(a: T, b: T): T => ((b.updatedAt || "") >= (a.updatedAt || "") ? b : a);
  return {
    tictactoe: pick(left.tictactoe, right.tictactoe),
    hangman: pick(left.hangman, right.hangman),
  };
}

export function tttWinner(cells: TicTacToeGame["cells"]): TicTacToeGame["winner"] {
  for (const [a, b, c] of WIN_LINES) {
    const mark = cells[a];
    if (mark && mark === cells[b] && mark === cells[c]) return mark;
  }
  if (cells.every((cell) => cell)) return "draw";
  return null;
}

export function hangmanMisses(game: HangmanGame): number {
  return game.guessed.filter((letter) => !game.word.includes(letter)).length;
}

export function hangmanRevealed(game: HangmanGame): string {
  return game.word.split("").map((letter) => (game.guessed.includes(letter) ? letter : "_")).join(" ");
}

export function hangmanWon(game: HangmanGame): boolean {
  return game.word.split("").every((letter) => game.guessed.includes(letter));
}
