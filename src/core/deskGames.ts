import { todayKey } from "./calendar.ts";
import type {
  HouseholdGames,
  HangmanGame,
  TicTacToeGame,
  FourGame,
  FourColor,
  FleetGame,
  FleetBoard,
  FleetShipId,
  PanesGame,
} from "./types.ts";

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
    four: shapeFour(input?.four),
    fleet: shapeFleet(input?.fleet),
    panes: shapePanes(input?.panes),
  };
}

export function mergeGames(server?: HouseholdGames | null, client?: HouseholdGames | null): HouseholdGames {
  const left = shapeGames(server);
  const right = shapeGames(client);
  const pick = <T extends { updatedAt: string }>(a: T, b: T): T => ((b.updatedAt || "") >= (a.updatedAt || "") ? b : a);
  return {
    tictactoe: pick(left.tictactoe, right.tictactoe),
    hangman: pick(left.hangman, right.hangman),
    four: pick(left.four, right.four),
    fleet: pick(left.fleet, right.fleet),
    panes: pick(left.panes, right.panes),
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

export const FOUR_COLS = 7;
export const FOUR_ROWS = 6;

export function emptyFour(): FourGame {
  return {
    columns: Array.from({ length: FOUR_COLS }, () => []),
    turn: "pine",
    lastMemberId: "",
    winner: null,
    updatedAt: "",
    updatedBy: "",
  };
}

export function shapeFour(input?: Partial<FourGame> | null): FourGame {
  const columns = Array.from({ length: FOUR_COLS }, (_, col) => {
    const raw = Array.isArray(input?.columns) ? input.columns[col] : null;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((cell): cell is FourColor => cell === "pine" || cell === "copper")
      .slice(0, FOUR_ROWS);
  });
  const winner = input?.winner === "pine" || input?.winner === "copper" || input?.winner === "draw"
    ? input.winner
    : null;
  return {
    columns,
    turn: input?.turn === "copper" ? "copper" : "pine",
    lastMemberId: String(input?.lastMemberId || ""),
    winner,
    updatedAt: String(input?.updatedAt || ""),
    updatedBy: String(input?.updatedBy || ""),
  };
}

function fourCell(game: FourGame, col: number, row: number): FourColor | "" {
  return game.columns[col]?.[row] ?? "";
}

export function fourWinner(game: FourGame): FourGame["winner"] {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;
  for (let col = 0; col < FOUR_COLS; col += 1) {
    for (let row = 0; row < FOUR_ROWS; row += 1) {
      const start = fourCell(game, col, row);
      if (!start) continue;
      for (const [dc, dr] of dirs) {
        let n = 1;
        for (let step = 1; step < 4; step += 1) {
          if (fourCell(game, col + dc * step, row + dr * step) === start) n += 1;
          else break;
        }
        if (n >= 4) return start;
      }
    }
  }
  if (game.columns.every((column) => column.length >= FOUR_ROWS)) return "draw";
  return null;
}

export const FLEET_SIZE = 8;
export const FLEET_SHIPS: Array<{ id: FleetShipId; len: number }> = [
  { id: "milk", len: 5 },
  { id: "visa", len: 4 },
  { id: "hydro", len: 3 },
  { id: "jar", len: 3 },
  { id: "pad", len: 2 },
];

export function emptyFleetBoard(memberId = ""): FleetBoard {
  return { memberId, ships: [], shots: {}, placed: false };
}

export function emptyFleet(): FleetGame {
  return {
    boards: [emptyFleetBoard(), emptyFleetBoard()],
    turnMemberId: "",
    winnerMemberId: null,
    updatedAt: "",
    updatedBy: "",
  };
}

function shapeFleetBoard(input?: Partial<FleetBoard> | null): FleetBoard {
  const ships = Array.isArray(input?.ships)
    ? input.ships
      .filter((ship): ship is FleetBoard["ships"][number] => Boolean(ship && typeof ship === "object"))
      .map((ship) => ({
        id: FLEET_SHIPS.some((row) => row.id === ship.id) ? ship.id : "pad" as FleetShipId,
        cells: Array.isArray(ship.cells)
          ? ship.cells.map((cell) => Number(cell)).filter((cell) => Number.isInteger(cell) && cell >= 0 && cell < 64)
          : [],
        sunk: Boolean(ship.sunk),
      }))
    : [];
  const shots: Record<string, "hit" | "miss"> = {};
  if (input?.shots && typeof input.shots === "object") {
    for (const [key, value] of Object.entries(input.shots)) {
      if (value === "hit" || value === "miss") shots[key] = value;
    }
  }
  return {
    memberId: String(input?.memberId || ""),
    ships,
    shots,
    placed: Boolean(input?.placed),
  };
}

export function shapeFleet(input?: Partial<FleetGame> | null): FleetGame {
  const boards = Array.isArray(input?.boards)
    ? input.boards.slice(0, 2).map((board) => shapeFleetBoard(board))
    : [];
  while (boards.length < 2) boards.push(emptyFleetBoard());
  return {
    boards,
    turnMemberId: String(input?.turnMemberId || ""),
    winnerMemberId: input?.winnerMemberId ? String(input.winnerMemberId) : null,
    updatedAt: String(input?.updatedAt || ""),
    updatedBy: String(input?.updatedBy || ""),
  };
}

export function placeFleetRandom(board: FleetBoard, seed: string): FleetBoard {
  const occupied = new Set<number>();
  const ships: FleetBoard["ships"] = [];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const rand = () => {
    hash = (Math.imul(hash, 1664525) + 1013904223) | 0;
    return (hash >>> 0) / 4294967296;
  };
  for (const spec of FLEET_SHIPS) {
    let placed = false;
    for (let attempt = 0; attempt < 80 && !placed; attempt += 1) {
      const horizontal = rand() > 0.5;
      const maxC = horizontal ? FLEET_SIZE - spec.len : FLEET_SIZE - 1;
      const maxR = horizontal ? FLEET_SIZE - 1 : FLEET_SIZE - spec.len;
      const c = Math.floor(rand() * (maxC + 1));
      const r = Math.floor(rand() * (maxR + 1));
      const cells: number[] = [];
      let clear = true;
      for (let i = 0; i < spec.len; i += 1) {
        const col = c + (horizontal ? i : 0);
        const row = r + (horizontal ? 0 : i);
        const cell = row * FLEET_SIZE + col;
        if (occupied.has(cell)) { clear = false; break; }
        cells.push(cell);
      }
      if (!clear) continue;
      for (const cell of cells) occupied.add(cell);
      ships.push({ id: spec.id, cells, sunk: false });
      placed = true;
    }
  }
  return { ...board, ships, placed: ships.length === FLEET_SHIPS.length };
}

export function fleetOccupies(board: FleetBoard, cell: number): FleetBoard["ships"][number] | null {
  return board.ships.find((ship) => ship.cells.includes(cell)) ?? null;
}

export const PANES_DOT_W = 5;
export const PANES_DOT_H = 4;
export const PANES_H = (PANES_DOT_W - 1) * PANES_DOT_H;
export const PANES_V = PANES_DOT_W * (PANES_DOT_H - 1);
export const PANES_BOXES = (PANES_DOT_W - 1) * (PANES_DOT_H - 1);

export function emptyPanes(): PanesGame {
  return {
    h: Array.from({ length: PANES_H }, () => ""),
    v: Array.from({ length: PANES_V }, () => ""),
    boxes: Array.from({ length: PANES_BOXES }, () => ""),
    lastMemberId: "",
    turnMemberId: "",
    updatedAt: "",
    updatedBy: "",
  };
}

export function shapePanes(input?: Partial<PanesGame> | null): PanesGame {
  const pad = (list: unknown, len: number) => {
    const next = Array.isArray(list) ? list.map((row) => String(row || "")) : [];
    while (next.length < len) next.push("");
    return next.slice(0, len);
  };
  return {
    h: pad(input?.h, PANES_H),
    v: pad(input?.v, PANES_V),
    boxes: pad(input?.boxes, PANES_BOXES),
    lastMemberId: String(input?.lastMemberId || ""),
    turnMemberId: String(input?.turnMemberId || ""),
    updatedAt: String(input?.updatedAt || ""),
    updatedBy: String(input?.updatedBy || ""),
  };
}

export function panesBoxComplete(game: PanesGame, box: number): boolean {
  const col = box % (PANES_DOT_W - 1);
  const row = Math.floor(box / (PANES_DOT_W - 1));
  const top = row * (PANES_DOT_W - 1) + col;
  const bottom = (row + 1) * (PANES_DOT_W - 1) + col;
  const left = row * PANES_DOT_W + col;
  const right = row * PANES_DOT_W + col + 1;
  return Boolean(game.h[top] && game.h[bottom] && game.v[left] && game.v[right]);
}

export function panesScores(game: PanesGame): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const owner of game.boxes) {
    if (!owner) continue;
    scores[owner] = (scores[owner] ?? 0) + 1;
  }
  return scores;
}

export const EMPTY_GAMES: HouseholdGames = {
  tictactoe: { ...EMPTY_TICTACTOE },
  hangman: emptyHangman("hearth"),
  four: emptyFour(),
  fleet: emptyFleet(),
  panes: emptyPanes(),
};
