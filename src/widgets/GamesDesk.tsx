import {
  FLEET_SIZE,
  FOUR_COLS,
  FOUR_ROWS,
  GAMES_EMPTY,
  guessHangman,
  hangmanMisses,
  hangmanRevealed,
  MAX_HANGMAN_MISSES,
  PANES_DOT_H,
  PANES_DOT_W,
  fireFleet,
  placeFleet,
  playFour,
  playPanes,
  playTicTacToe,
  resetFleet,
  resetFour,
  resetHangman,
  resetPanes,
  resetTicTacToe,
  type CommitResult,
  type Household,
} from "../core/index.ts";

export function TicTacToeGlance({ household }: { household: Household }) {
  const game = household.kitchen.games.tictactoe;
  if (game.winner === "draw") return <span>cat's game</span>;
  if (game.winner) return <span>{game.winner.toUpperCase()} wins</span>;
  if (!game.cells.some(Boolean)) return <span>grid</span>;
  return <span>{game.turn.toUpperCase()} to move</span>;
}

export function HangmanGlance({ household }: { household: Household }) {
  const game = household.kitchen.games.hangman;
  if (game.lost) return <span>hung</span>;
  if (game.winnerMemberId) return <span>got it</span>;
  return <span>{hangmanRevealed(game).replace(/ /g, "")}</span>;
}

export function TicTacToeBody({
  household,
  memberId,
  busy,
  onCommand,
}: {
  household: Household;
  memberId: string;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => void;
}) {
  const game = household.kitchen.games.tictactoe;
  return (
    <>
      <p className="muted">{GAMES_EMPTY} Two phones. One turn. No CAD on the squares.</p>
      <div className="ttt-grid" role="grid" aria-label="Tic-tac-toe">
        {game.cells.map((cell, index) => (
          <button
            key={index}
            type="button"
            className="ttt-cell"
            disabled={busy || Boolean(game.winner) || Boolean(cell)}
            onClick={() => onCommand((current) => playTicTacToe(current, { memberId, index }))}
          >
            {cell ? cell.toUpperCase() : ""}
          </button>
        ))}
      </div>
      {game.winner && <p>{game.winner === "draw" ? "Cat's game." : `${game.winner.toUpperCase()} wins.`}</p>}
      <button type="button" className="chip" disabled={busy} onClick={() => onCommand((current) => resetTicTacToe(current, memberId))}>
        New game
      </button>
    </>
  );
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

export function HangmanBody({
  household,
  memberId,
  busy,
  onCommand,
}: {
  household: Household;
  memberId: string;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => void;
}) {
  const game = household.kitchen.games.hangman;
  const misses = hangmanMisses(game);
  const done = Boolean(game.lost || game.winnerMemberId);
  return (
    <>
      <p className="hangman-word" aria-label="Word">{hangmanRevealed(game)}</p>
      <p className="muted">
        {done
          ? game.lost
            ? `The word was ${game.word}.`
            : "Got it."
          : `${MAX_HANGMAN_MISSES - misses} misses left. Household words only — never a quiet visit title.`}
      </p>
      <div className="hangman-letters">
        {LETTERS.map((letter) => (
          <button
            key={letter}
            type="button"
            className={`chip ${game.guessed.includes(letter) ? "selected" : ""}`}
            disabled={busy || done || game.guessed.includes(letter)}
            onClick={() => onCommand((current) => guessHangman(current, { memberId, letter }))}
          >
            {letter}
          </button>
        ))}
      </div>
      <button type="button" className="chip" disabled={busy} onClick={() => onCommand((current) => resetHangman(current, memberId))}>
        New word
      </button>
    </>
  );
}

export function FourGlance({ household }: { household: Household }) {
  const game = household.kitchen.games.four;
  if (game.winner === "draw") return <span>draw</span>;
  if (game.winner) return <span>{game.winner} wins</span>;
  return <span>{game.turn} to drop</span>;
}

export function FourBody({
  household,
  memberId,
  busy,
  onCommand,
}: {
  household: Household;
  memberId: string;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => void;
}) {
  const game = household.kitchen.games.four;
  return (
    <>
      <p className="muted">{GAMES_EMPTY} Pine vs copper. Two phones. One turn.</p>
      <div className="four-board" role="grid" aria-label="Sill Four">
        {Array.from({ length: FOUR_COLS }, (_, col) => (
          <button
            key={col}
            type="button"
            className="four-col"
            disabled={busy || Boolean(game.winner) || game.columns[col]!.length >= FOUR_ROWS}
            aria-label={`Drop in column ${col + 1}`}
            onClick={() => onCommand((current) => playFour(current, { memberId, column: col }))}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onCommand((current) => playFour(current, { memberId, column: col }));
              }
            }}
          >
            {Array.from({ length: FOUR_ROWS }, (_, rowFromTop) => {
              const row = FOUR_ROWS - 1 - rowFromTop;
              const disc = game.columns[col]![row];
              return <span key={row} className={`four-cell ${disc ? `is-${disc}` : ""}`} />;
            })}
          </button>
        ))}
      </div>
      {game.winner && <p>{game.winner === "draw" ? "Draw." : `${game.winner} wins.`}</p>}
      <button type="button" className="chip" disabled={busy} onClick={() => onCommand((current) => resetFour(current, memberId))}>
        New game
      </button>
    </>
  );
}

export function FleetGlance({ household }: { household: Household }) {
  const game = household.kitchen.games.fleet;
  if (game.winnerMemberId) return <span>sunk</span>;
  if (!game.boards.every((board) => board.placed)) return <span>set fleet</span>;
  return <span>fire</span>;
}

export function FleetBody({
  household,
  memberId,
  busy,
  onCommand,
}: {
  household: Household;
  memberId: string;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => void;
}) {
  const game = household.kitchen.games.fleet;
  const mine = game.boards.find((board) => board.memberId === memberId);
  const theirs = game.boards.find((board) => board.memberId && board.memberId !== memberId);
  return (
    <>
      <p className="muted">Milk, Visa, Hydro, Jar, Pad. Fog until you fire. Never reads the journal.</p>
      {!mine?.placed && (
        <button type="button" className="chip" disabled={busy} onClick={() => onCommand((current) => placeFleet(current, { memberId }))}>
          Set fleet
        </button>
      )}
      {theirs?.placed && (
        <div className="fleet-grid" role="grid" aria-label="Kitchen Fleet">
          {Array.from({ length: FLEET_SIZE * FLEET_SIZE }, (_, cell) => {
            const shot = theirs.shots[String(cell)];
            return (
              <button
                key={cell}
                type="button"
                className={`fleet-cell ${shot ? `is-${shot}` : ""}`}
                disabled={busy || Boolean(game.winnerMemberId) || Boolean(shot) || !mine?.placed}
                onClick={() => onCommand((current) => fireFleet(current, { memberId, cell }))}
              />
            );
          })}
        </div>
      )}
      {game.winnerMemberId && <p>Fleet sunk.</p>}
      <button type="button" className="chip" disabled={busy} onClick={() => onCommand((current) => resetFleet(current, memberId))}>
        New game
      </button>
    </>
  );
}

export function PanesGlance({ household }: { household: Household }) {
  const game = household.kitchen.games.panes;
  const filled = game.boxes.filter(Boolean).length;
  return <span>{filled} panes</span>;
}

export function PanesBody({
  household,
  memberId,
  busy,
  onCommand,
}: {
  household: Household;
  memberId: string;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => void;
}) {
  const game = household.kitchen.games.panes;
  const claim = (kind: "h" | "v", index: number) => onCommand((current) => playPanes(current, { memberId, kind, index }));
  return (
    <>
      <p className="muted">Claim a mullion. A closed pane takes your initial. No off-device ink.</p>
      <div className="panes-board" aria-label="Pane Boxes">
        {Array.from({ length: PANES_DOT_H }, (_, row) => (
          <div key={`h-${row}`} className="panes-h-row">
            {Array.from({ length: PANES_DOT_W - 1 }, (_, col) => {
              const index = row * (PANES_DOT_W - 1) + col;
              return (
                <button
                  key={index}
                  type="button"
                  className={`panes-edge is-h ${game.h[index] ? "is-on" : ""}`}
                  disabled={busy || Boolean(game.h[index])}
                  aria-label={`Horizontal mullion ${index + 1}`}
                  onClick={() => claim("h", index)}
                />
              );
            })}
          </div>
        ))}
        {Array.from({ length: PANES_DOT_H - 1 }, (_, row) => (
          <div key={`v-${row}`} className="panes-v-row">
            {Array.from({ length: PANES_DOT_W }, (_, col) => {
              const index = row * PANES_DOT_W + col;
              return (
                <button
                  key={index}
                  type="button"
                  className={`panes-edge is-v ${game.v[index] ? "is-on" : ""}`}
                  disabled={busy || Boolean(game.v[index])}
                  aria-label={`Vertical mullion ${index + 1}`}
                  onClick={() => claim("v", index)}
                />
              );
            })}
          </div>
        ))}
        <div className="panes-stamps">
          {game.boxes.map((stamp, index) => (
            <span key={index} className="panes-box">{stamp}</span>
          ))}
        </div>
      </div>
      <button type="button" className="chip" disabled={busy} onClick={() => onCommand((current) => resetPanes(current, memberId))}>
        New game
      </button>
    </>
  );
}