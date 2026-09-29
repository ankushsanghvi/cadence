import { executeChatCompletion } from '@/server/ai/llmClient';

export type SpecialistKind = 'communication' | 'content' | 'star';
export type SpecialistFallbackReason = {
  code: 'timeout' | 'provider_error' | 'empty_response' | 'invalid_json' | 'invalid_schema';
  message: string;
};
export type SpecialistResult<T> = { output: T; evaluationSource: 'llm' | 'deterministic_fallback'; fallbackReason?: SpecialistFallbackReason };
type Runner = typeof executeChatCompletion;

const score = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : null;
const statuses = new Set(['strong', 'detected', 'weak', 'missing']);

function classifyFallback(error: unknown): SpecialistFallbackReason {
  const message = error instanceof Error ? error.message : 'LLM specialist unavailable';
  const lower = message.toLowerCase();
  if (error instanceof SyntaxError) return { code: 'invalid_json', message };
  if (lower.includes('timed out') || lower.includes('timeout')) return { code: 'timeout', message };
  if (lower.includes('invalid specialist json') || lower.includes('unexpected token')) return { code: 'invalid_json', message };
  if (lower.includes('invalid ') || lower.includes('star ')) return { code: 'invalid_schema', message };
  if (lower.includes('empty') || lower.includes('no content')) return { code: 'empty_response', message };
  return { code: 'provider_error', message };
}

export async function enhanceSpecialistWithLLM<T extends object>(
  kind: SpecialistKind, context: Record<string, unknown>, deterministic: T, runner: Runner = executeChatCompletion,
): Promise<SpecialistResult<T>> {
  const rubrics: Record<SpecialistKind, string> = {
    communication: 'Score clarity, conciseness, and communication_quality from 0-100. Do not score filler count, hedge count, WPM, word count, or sentence length; those are objective measurements.',
    content: 'Return exactly this JSON shape: {"relevance": 0, "completeness": 0, "competency_match": 0, "technical_depth": 0}. Each value must be an integer from 0 through 100. Score against the supplied question and rubric. Identify only evidence present in the answer.',
    star: 'Return exactly this JSON shape: {"structure_score": 0, "situation": {"status": "strong|detected|weak|missing", "evidence": "one exact sentence", "critique": "brief note"}, "task": {"status": "strong|detected|weak|missing", "evidence": "one exact sentence", "critique": "brief note"}, "action": {"status": "strong|detected|weak|missing", "evidence": "one exact sentence", "critique": "brief note"}, "result": {"status": "strong|detected|weak|missing", "evidence": "one exact sentence", "critique": "brief note"}}. Score structure_score from 0-100. Cite only sentences from the answer.',
  };
  try {
    const response = await runner({
      traceName: `${kind === 'star' ? 'STAR' : kind[0].toUpperCase() + kind.slice(1)} Agent — Semantic Evaluation`,
      // STAR has the largest validated payload (four structured components),
      // and the configured provider can take longer than the other two
      // specialists. Keep a bounded timeout without treating a healthy call
      // as a deterministic fallback.
      responseFormat: 'json_object', temperature: 0, timeoutMs: 30_000, maxRetries: 0,
      messages: [{ role: 'system', content: `You are Cadence's ${kind} interview specialist. ${rubrics[kind]} Return only valid JSON.` }, { role: 'user', content: JSON.stringify(context) }],
    });
    const raw = response.choices?.[0]?.message?.content;
    if (!raw) throw new Error('LLM returned empty specialist response.');
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') throw new Error('LLM returned invalid specialist JSON.');
    const value = parsed as Record<string, unknown>;
    const next: Record<string, unknown> = { ...(deterministic as Record<string, unknown>) };
    const keys = kind === 'communication' ? ['clarity', 'conciseness', 'communication_quality'] : kind === 'content' ? ['relevance', 'completeness', 'competency_match', 'technical_depth'] : ['structure_score'];
    for (const key of keys) { const valid = score(value[key]); if (valid === null) throw new Error(`LLM returned invalid ${key} score.`); next[key] = valid; }
    if (kind === 'communication' && typeof value.tone === 'string' && ['Professional & Confident', 'Clear & Structured', 'Hesitant / Passive', 'Rushed', 'Wordy'].includes(value.tone)) next.tone = value.tone;
    if (kind === 'star') {
      for (const component of ['situation', 'task', 'action', 'result']) {
        const incoming = value[component] as Record<string, unknown> | undefined;
        if (!incoming || !statuses.has(String(incoming.status))) throw new Error(`LLM returned invalid STAR ${component}.`);
        const baseline = (deterministic as Record<string, Record<string, unknown>>)[component];
        next[component] = { ...baseline, status: incoming.status, evidence: typeof incoming.evidence === 'string' ? incoming.evidence : null, critique: typeof incoming.critique === 'string' ? incoming.critique : baseline?.critique };
      }
      next.starFilled = ['situation', 'task', 'action', 'result'].filter(key => ['strong', 'detected'].includes((next[key] as Record<string, unknown>).status as string)).length;
    }
    return { output: { ...next, evaluationSource: 'llm' } as unknown as T, evaluationSource: 'llm' };
  } catch (error) {
    const fallbackReason = classifyFallback(error);
    console.warn('[Cadence specialist fallback]', { kind, fallbackReason });
    return { output: { ...deterministic, evaluationSource: 'deterministic_fallback' } as unknown as T, evaluationSource: 'deterministic_fallback', fallbackReason };
  }
}
