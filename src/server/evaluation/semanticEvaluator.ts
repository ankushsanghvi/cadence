import { executeChatCompletion } from '@/server/ai/llmClient';
import { EvaluationScores, isValidScoreSet, normalizeScores } from '@/lib/interview/scoring';

export type SemanticEvaluationInput = {
  question: { question: string; expectedCompetency: string; evaluationCriteria: string[]; expectSTAR: boolean };
  answer: string;
  objectiveSignals: Record<string, unknown>;
};

export type CompletionRunner = (options: Parameters<typeof executeChatCompletion>[0]) => ReturnType<typeof executeChatCompletion>;

const RUBRIC = `Score each dimension independently from 0 to 100.
- relevance: answers the exact question and target competency.
- completeness: covers the requested elements with sufficient explanation and evidence.
- structure: logical organization; use STAR only when the question expects STAR.
- clarity: understandable, precise sentences with no unnecessary ambiguity.
- communication: professional, confident, appropriately concise delivery.
Do not reward a response merely for sounding fluent. A non-answer, irrelevant response, or very short response must score low.`;

export async function evaluateSemanticallyWithLLM(
  input: SemanticEvaluationInput,
  completionRunner: CompletionRunner = executeChatCompletion,
): Promise<EvaluationScores> {
  const completion = await completionRunner({
    messages: [
      {
        role: 'system',
        content: `You are Cadence's semantic interview evaluator. ${RUBRIC} Return only valid JSON with exactly these numeric keys: relevance, clarity, structure, completeness, communication.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          question: input.question.question,
          competency: input.question.expectedCompetency,
          criteria: input.question.evaluationCriteria,
          expectsSTAR: input.question.expectSTAR,
          candidateAnswer: input.answer,
          objectiveSignals: input.objectiveSignals,
        }),
      },
    ],
    responseFormat: 'json_object',
    temperature: 0,
    timeoutMs: 8_000,
    maxRetries: 0,
    traceName: 'Interview Coach Agent — Semantic Evaluation',
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned no semantic evaluation output.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('LLM returned invalid semantic evaluation JSON.');
  }
  if (!isValidScoreSet(parsed)) throw new Error('LLM semantic evaluation failed score validation.');
  return normalizeScores(parsed);
}
