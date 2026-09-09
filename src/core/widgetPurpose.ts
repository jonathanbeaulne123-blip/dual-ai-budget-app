import type { InstrumentId } from './officeLayout.ts';

/** Explanations for the existing instruments, not additional financial readings. */
export const OFFICE_INSTRUMENT_PURPOSE: Record<InstrumentId,string> = {
  calculator:'Draft an amount and review an entry.',
  blotter:'Money in and out in your current books.',
  wallet:'Card balances and payment review.',
  accounts:'Account balances and accepted activity.',
  calendar:'Bills and events on their dates.',
  appointments:'Upcoming visits and appointments.',
  mail:'Bills coming due and payment review.',
  claims:'Amounts owed and recovery review.',
  timesheet:'Your current shift, breaks and pay review.',
  chalkboard:'Notes, photos, tasks, milestones and Shift Ask.',
  wardrobe:'Hercules appearance, names and conversation.',
  postcard:'Your household review and weekly acknowledgements.',
  cookoff:'Recorded kitchen and takeout spending.',
  jars:'Financial goals and accepted progress.',
  lamp:'Checks on the integrity of your books.',
  tictactoe:'Play a shared round of tic-tac-toe.',
  hangman:'Play a shared word game.',
};
