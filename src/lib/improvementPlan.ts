export type ImprovementGapKey = 'fillers' | 'results' | 'structure' | 'hedges' | 'thin';

export const IMPROVEMENT_DRILLS: Record<ImprovementGapKey, {
  title: string;
  drill: string;
  metric: string;
  resourceTopic: 'communication' | 'star' | 'behavioral';
}> = {
  fillers: {
    title: 'Kill the filler words',
    drill: "Record a 60-second answer. Replay. Count every 'um'. Do it three times — the count drops on its own.",
    metric: '0–2 fillers per answer',
    resourceTopic: 'communication',
  },
  results: {
    title: 'Land every result with a number',
    drill: 'Before submitting, force yourself to end with one sentence containing a %, a time saved, or a revenue figure.',
    metric: '100% of answers end quantified',
    resourceTopic: 'star',
  },
  structure: {
    title: 'Signpost out loud',
    drill: "Open with 'Two things happened…', use 'First / Then / Which meant' — make the structure audible to a tired interviewer.",
    metric: '3+ connectors per answer',
    resourceTopic: 'star',
  },
  hedges: {
    title: 'Delete the hedging',
    drill: "Replace every 'I think / maybe / I guess' with the plain claim. If you can't say it plainly, don't claim it.",
    metric: '≤1 hedge per answer',
    resourceTopic: 'communication',
  },
  thin: {
    title: 'Add a second beat',
    drill: 'Structure answers as: claim → example → result. Most thin answers only have the claim.',
    metric: '90+ words per answer',
    resourceTopic: 'behavioral',
  },
};
