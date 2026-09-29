import { IMPROVEMENT_DRILLS, type ImprovementGapKey } from '@/lib/improvementPlan';

export type ReviewWeakness = {
  key: ImprovementGapKey;
  title: string;
  evidence: string;
  suggestion?: string;
};

const belowReviewThreshold = (value: unknown) => typeof value === 'number' && value < 70;

function matchingCoachSuggestion(improvements: unknown, key: ImprovementGapKey) {
  const terms: Record<ImprovementGapKey, RegExp> = {
    fillers: /filler|pause/i,
    results: /quant|result|metric|outcome/i,
    structure: /signpost|context|structure|story|\bSTAR\b|shift from/i,
    hedges: /hedg|authority|direct/i,
    thin: /thin|depth|elaborate|example/i,
  };
  return Array.isArray(improvements)
    ? improvements.find((item): item is string => typeof item === 'string' && terms[key].test(item))
    : undefined;
}

/** Builds review copy exclusively from persisted evaluator signals. */
export function deriveReviewWeaknesses(result: any): ReviewWeakness[] {
  if (!result || typeof result !== 'object') return [];
  const weaknesses: ReviewWeakness[] = [];
  const add = (key: ImprovementGapKey, title: string, evidence: unknown) => {
    if (weaknesses.some((item) => item.key === key) || typeof evidence !== 'string' || !evidence.trim()) return;
    weaknesses.push({ key, title, evidence, suggestion: matchingCoachSuggestion(result.improvements, key) });
  };
  const scores = result.scores || {};
  const star = result.star || {};
  const highlights = Array.isArray(result.evidenceHighlights) ? result.evidenceHighlights : [];
  const note = (dimension: string) => highlights.find((item: any) => item?.dimension === dimension)?.coachingNote;

  if (star.result && !star.result.detected) add('results', 'Missing concrete result', star.result.evidence || note('STAR Result'));
  if (belowReviewThreshold(scores.structure) || ['situation', 'task', 'action'].some((part) => star[part] && !star[part].detected)) {
    const part = ['situation', 'task', 'action'].find((item) => star[item] && !star[item].detected);
    add('structure', 'Weak answer structure', part ? star[part].evidence : note('STAR Result'));
  }
  if (belowReviewThreshold(scores.completeness)) {
    add('thin', 'Incomplete answer', note('Content Rigor') || result.improvements?.find((item: unknown) => typeof item === 'string' && /missed|depth|thin|incomplete/i.test(item)));
  }
  if (belowReviewThreshold(scores.relevance)) {
    add('thin', 'Low relevance or missing coverage', result.improvements?.find((item: unknown) => typeof item === 'string' && /missed|relevance|prompt|dimension/i.test(item)));
  }
  if ((result.metrics?.fillers || 0) > 2) add('fillers', 'Excessive fillers', `${result.metrics.fillers} filler words were detected in this answer.`);
  if ((result.metrics?.hedges || 0) > 2) add('hedges', 'Hedging language', `${result.metrics.hedges} hedging phrases were detected in this answer.`);
  if (belowReviewThreshold(scores.clarity) || belowReviewThreshold(scores.communication)) {
    const evidence = result.improvements?.find((item: unknown) => typeof item === 'string' && /filler|hedg|sentence|spoken|clarity|delivery/i.test(item));
    if (evidence) add((result.metrics?.fillers || 0) > 2 ? 'fillers' : 'hedges', 'Communication needs attention', evidence);
  }
  return weaknesses.slice(0, 3);
}

export function sessionRoadmap(turns: any[]) {
  const grouped = new Map<ImprovementGapKey, { count: number; examples: ReviewWeakness[] }>();
  turns.forEach((turn) => deriveReviewWeaknesses(turn?.result).forEach((weakness) => {
    const current = grouped.get(weakness.key) || { count: 0, examples: [] };
    current.count += 1;
    current.examples.push(weakness);
    grouped.set(weakness.key, current);
  }));
  return [...grouped.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 3).map(([key, value]) => ({
    key, count: value.count, weakness: value.examples[0].title, action: IMPROVEMENT_DRILLS[key],
  }));
}
