import {
  GAMES_EMPTY,
  guessHangman,
  hangmanMisses,
  hangmanRevealed,
  MAX_HANGMAN_MISSES,
  playTicTacToe,
  resetHangman,
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