export type EvaluationScores = {
  relevance: number;
  clarity: number;
  structure: number;
  completeness: number;
  communication: number;
};

export type ScoreGuardrailContext = {
  answer: string;
  wordCount: number;
  answeredPrompt: boolean;
  coveredPointCount: number;
  completeness: number;
};

export function isValidScoreSet(value: unknown): value is EvaluationScores {
  if (!value || typeof value !== 'object') return false;
  return ['relevance', 'clarity', 'structure', 'completeness', 'communication'].every((key) => {
    const score = (value as Record<string, unknown>)[key];
    return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100;
  });
}

export function normalizeScores(scores: EvaluationScores): EvaluationScores {
  return Object.fromEntries(
    Object.entries(scores).map(([key, value]) => [key, Math.round(Math.max(0, Math.min(100, value)))]),
  ) as EvaluationScores;
}

// This is intentionally the single final-score formula for every evaluator.
export function calculateOverallScore(scores: EvaluationScores): number {
  const normalized = normalizeScores(scores);
  return Math.round(
    normalized.relevance * 0.20 +
    normalized.clarity * 0.20 +
    normalized.structure * 0.25 +
    normalized.completeness * 0.15 +
    normalized.communication * 0.20,
  );
}

export function applyScoreGuardrails(overall: number, context: ScoreGuardrailContext): number {
  const answer = context.answer.trim().toLowerCase();
  const isExplicitNonAnswer = /\b(i don'?t know|no idea|cannot answer|can'?t answer|not sure|idk|whatever|nothing to say)\b/.test(answer);

  if (isExplicitNonAnswer || context.wordCount < 12) return Math.min(overall, 25);
  if (!context.answeredPrompt || context.coveredPointCount === 0) return Math.min(overall, 52);
  if (context.coveredPointCount === 1 && context.completeness < 45) return Math.min(overall, 60);
  return overall;
}

export function verdictForScore(overall: number): string {
  if (overall >= 85) return 'Panel-ready — structured, specific, and technically confident.';
  if (overall >= 72) return 'Strong response with good technical bones. Tighten the conclusion with quantifiable metrics.';
  if (overall >= 58) return 'Promising direction, but narrative structure and empirical evidence need calibration.';
  return 'Needs substantial reinforcement. Focus on first-person ownership and concrete technical actions.';
}
