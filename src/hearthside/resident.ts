import type { WorkspaceExperienceContext } from './workspaceContext.ts';
export type ResidentActivity='small-note'|'possibilities'|'recollection';
/** Authored lines selected only from deliberately chosen experience state. No model, inferred feeling or partner activity. */
export function residentWelcome(context:WorkspaceExperienceContext):string {
  if(context.state==='paused')return 'I kept a little space for this. We can leave it resting, or put one thought on paper.';
  if(context.state==='lived')return 'The ordinary details are welcome here. What would you like to remember?';
  if(context.horizon==='tonight')return 'Something lovely can fit in an ordinary evening. Shall we make a little room for it?';
  if(context.horizon==='someday')return 'No deadline required. I have a soft spot for a possibility with room to grow.';
  return 'A blank page, a little curiosity, and excellent company. I have arranged the pencils.';
}
export const residentActivities:ReadonlyArray<{id:ResidentActivity;title:string;description:string}>=Object.freeze([
  {id:'small-note',title:'Leave a little thought',description:'A few words you can keep private or review for sharing.'},
  {id:'possibilities',title:'Make room for possibilities',description:'Imagine a free version, a small version, and something for later.'},
  {id:'recollection',title:'Catch an ordinary detail',description:'Keep a place, a sound, or a small thing you noticed.'},
]);
export function residentDraft(activity:ResidentActivity,title:string):{title:string;content:string}{
  if(activity==='small-note')return {title:`A little thought · ${title}`,content:`# A little thought\n\nSomething I wanted to say:\n\n`};
  if(activity==='possibilities')return {title:`Possibilities · ${title}`,content:`# ${title}\n\n## A version that costs nothing\n\n## A small version\n\n## Something for later\n\n## What matters to me\n\n`};
  return {title:`An ordinary detail · ${title}`,content:`# An ordinary detail\n\nA place or a moment:\n\nSomething I noticed:\n\nWhat I want to remember:\n\n`};
}
