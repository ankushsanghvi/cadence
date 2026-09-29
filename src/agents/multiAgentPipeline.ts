import { CandidateProfile } from '@/lib/api';
import { StructuredQuestion } from '@/lib/dataset/datasetManager';
import { InterviewQuestionAgent, QuestionAgentOutput } from './interviewQuestionAgent';
import { CommunicationAnalysisAgent, CommunicationAgentOutput } from './communicationAnalysisAgent';
import { ContentEvaluationAgent, ContentAgentOutput } from './contentEvaluationAgent';
import { StarStructureAgent, StarAgentOutput } from './starStructureAgent';
import { InterviewCoachAgent, CoachAgentOutput } from './interviewCoachAgent';
import { EvaluationScores, applyScoreGuardrails, calculateOverallScore, normalizeScores, verdictForScore } from '@/lib/interview/scoring';
import { type SpecialistFallbackReason, type SpecialistKind, type SpecialistResult } from '@/server/evaluation/specialistEvaluators';

export interface A2AMessage {
  from: string; // e.g. "comm_agent"
  to: string; // e.g. "coach_agent"
  payload: Record<string, unknown>;
  timestamp: string;
  status: 'sent' | 'delivered' | 'processed';
  latencyMs?: number;
}

export interface MultiAgentPipelineResult {
  id: string;
  questionId: string;
  questionText: string;
  competency: string;
  type: string;
  difficulty: string;
  mode: string;
  answer: string;
  metrics: {
    words: number;
    fillers: number;
    wpm: number | null;
    avgSentenceLen: number;
    numbers: number;
    hedges: number;
  };
  scores: {
    relevance: number;
    clarity: number;
    structure: number;
    completeness: number;
    communication: number;
  };
  overall: number;
  evaluationSource: 'llm' | 'deterministic_fallback';
  agentEvaluationSources: { communication: 'llm' | 'deterministic_fallback'; content: 'llm' | 'deterministic_fallback'; star: 'llm' | 'deterministic_fallback'; coach: 'deterministic_fallback' };
  agentFallbackReasons: Partial<Record<'communication' | 'content' | 'star', SpecialistFallbackReason>>;
  verdict: string;
  star: {
    situation: { detected: boolean; evidence: string };
    task: { detected: boolean; evidence: string };
    action: { detected: boolean; evidence: string };
    result: { detected: boolean; evidence: string };
  };
  starFilled: number;
  strengths: string[];
  improvements: string[];
  modelAnswer: string;
  modelPoints: string[];
  followUps: string[];
  evidenceHighlights: CoachAgentOutput['evidenceHighlights'];
  actionableAdvice: string[];
  recurringGapKey?: string;
  a2aMessages: A2AMessage[];
  timings: Record<string, number>;
  createdAt: string;
}

export type PipelineStageCallback = (
  stageId: 'question' | 'comm' | 'content' | 'star' | 'coach',
  status: 'running' | 'done' | 'fallback' | 'error',
  output?: Record<string, unknown>
) => void;

export type SemanticEvaluator = (input: {
  question: StructuredQuestion;
  answer: string;
  objectiveSignals: Record<string, unknown>;
  deterministicScores: EvaluationScores;
}) => Promise<EvaluationScores>;
export type SpecialistEvaluator = <T extends object>(kind: SpecialistKind, context: Record<string, unknown>, deterministic: T) => Promise<SpecialistResult<T>>;

export class MultiAgentPipeline {
  /**
   * Executes the full 5-agent pipeline end-to-end with real A2A messaging.
   */
  public static async execute(
    params: {
      question: StructuredQuestion;
      answer: string;
      mode: 'voice' | 'text' | string;
      candidateProfile?: CandidateProfile | null;
      wpm?: number | null;
      semanticEvaluator?: SemanticEvaluator;
      specialistEvaluator?: SpecialistEvaluator;
    },
    onStage?: PipelineStageCallback
  ): Promise<MultiAgentPipelineResult> {
    const timings: Record<string, number> = {};
    const a2aMessages: A2AMessage[] = [];

    // Helper to log A2A message
    const logA2A = (from: string, to: string, payload: Record<string, unknown>, latencyMs?: number) => {
      a2aMessages.push({
        from,
        to,
        payload,
        timestamp: new Date().toISOString(),
        status: 'processed',
        latencyMs
      });
    };

    // -------------------------------------------------------------
    // STAGE 1: Interview Question Agent
    // -------------------------------------------------------------
    onStage?.('question', 'running');
    const t0Question = Date.now();

    const questionOutput: QuestionAgentOutput = await InterviewQuestionAgent.execute({
      candidateProfile: params.candidateProfile || null,
      targetRole: params.question.role,
      competency: params.question.competency,
      difficulty: params.question.difficulty,
      questionType: params.question.questionType,
    });
    timings.question = Date.now() - t0Question;

    logA2A('candidate_profile', 'question_agent', {
      targetRole: params.question.role,
      competency: params.question.competency,
      difficulty: params.question.difficulty,
      candidate: params.candidateProfile?.name || 'Guest Candidate'
    }, timings.question);

    logA2A('question_agent', 'evaluators', {
      selectedQuestionId: params.question.id,
      expectedCompetency: params.question.expectedCompetency,
      expectSTAR: params.question.expectSTAR,
      modelRubricCriteriaCount: params.question.evaluationCriteria.length
    });

    onStage?.('question', 'done', {
      selected: params.question.id,
      competency: params.question.competency,
      difficulty: params.question.difficulty,
      latencyMs: timings.question
    });

    // The three specialists begin together. Deterministic measurements are
    // always computed; an optional semantic LLM can enhance each independently.
    onStage?.('comm', 'running');
    onStage?.('content', 'running');
    onStage?.('star', 'running');
    const evaluator = params.specialistEvaluator;
    const deterministicSpecialist = <T extends object>(output: T): SpecialistResult<T> => ({
      output: { ...output, evaluationSource: 'deterministic_fallback' } as T,
      evaluationSource: 'deterministic_fallback',
      fallbackReason: { code: 'provider_error', message: 'Semantic specialist enhancement was not configured.' },
    });
    const runCommunication = async () => {
      const started = Date.now();
      const base = await CommunicationAnalysisAgent.execute({ candidateResponse: params.answer, mode: params.mode, wpm: params.wpm });
      const result = evaluator
        ? await evaluator('communication', { answer: params.answer, objectiveSignals: { fillers: base.filler_words, hedges: base.hedging, wpm: base.wpm, words: base.word_count, avgSentenceLength: base.avg_sentence_len } }, base)
        : deterministicSpecialist(base);
      timings.comm = Date.now() - started;
      const output = result.output as CommunicationAgentOutput;
      logA2A('comm_agent', 'coach_agent', { clarity: output.clarity, fillerCount: output.filler_words, evaluationSource: result.evaluationSource, fallbackReason: result.fallbackReason }, timings.comm);
      onStage?.('comm', result.evaluationSource === 'llm' ? 'done' : 'fallback', { clarity: output.clarity, communication: output.communication_quality, latencyMs: timings.comm, evaluationSource: result.evaluationSource, fallbackReason: result.fallbackReason });
      return { output, result };
    };
    const runContent = async () => {
      const started = Date.now();
      const base = await ContentEvaluationAgent.execute({ question: params.question, candidateResponse: params.answer, candidateProfile: params.candidateProfile || null });
      const result = evaluator
        ? await evaluator('content', { question: params.question.question, criteria: params.question.evaluationCriteria, expectedCompetency: params.question.expectedCompetency, answer: params.answer, deterministicSignals: { metrics: base.metrics_cited, covered: base.key_points_covered } }, base)
        : deterministicSpecialist(base);
      timings.content = Date.now() - started;
      const output = result.output as ContentAgentOutput;
      logA2A('content_agent', 'coach_agent', { relevance: output.relevance, completeness: output.completeness, evaluationSource: result.evaluationSource, fallbackReason: result.fallbackReason }, timings.content);
      onStage?.('content', result.evaluationSource === 'llm' ? 'done' : 'fallback', { relevance: output.relevance, completeness: output.completeness, latencyMs: timings.content, evaluationSource: result.evaluationSource, fallbackReason: result.fallbackReason });
      return { output, result };
    };
    const runStar = async () => {
      const started = Date.now();
      const base = await StarStructureAgent.execute({ candidateResponse: params.answer, expectSTAR: params.question.expectSTAR });
      const result = evaluator
        ? await evaluator('star', { answer: params.answer, expectsSTAR: params.question.expectSTAR, connectors: base.connectors_detected }, base)
        : deterministicSpecialist(base);
      timings.star = Date.now() - started;
      const output = result.output as StarAgentOutput;
      logA2A('star_agent', 'coach_agent', { structureScore: output.structure_score, starFilled: output.starFilled, situation: output.situation.status, task: output.task.status, action: output.action.status, result: output.result.status }, timings.star);
      onStage?.('star', result.evaluationSource === 'llm' ? 'done' : 'fallback', { filled: output.starFilled, structure: output.structure_score, latencyMs: timings.star, evaluationSource: result.evaluationSource, fallbackReason: result.fallbackReason });
      return { output, result };
    };
    const [commStage, contentStage, starStage] = await Promise.all([runCommunication(), runContent(), runStar()]);
    const commOutput = commStage.output;
    const contentOutput = contentStage.output;
    const starOutput = starStage.output;
    const commResult = commStage.result;
    const contentResult = contentStage.result;
    const starResult = starStage.result;

    // -------------------------------------------------------------
    // STAGE 5: Interview Coach Agent
    // -------------------------------------------------------------
    onStage?.('coach', 'running');
    const t0Coach = Date.now();

    const coachOutput: CoachAgentOutput = await InterviewCoachAgent.execute({
      candidateProfile: params.candidateProfile || null,
      questionOutput,
      candidateResponse: params.answer,
      commOutput,
      contentOutput,
      starOutput
    });
    timings.coach = Date.now() - t0Coach;

    let scores = coachOutput.dimensionScores;
    let overall = coachOutput.overallScore;
    let verdict = coachOutput.verdict;
    let evaluationSource: MultiAgentPipelineResult['evaluationSource'] = 'deterministic_fallback';

    if (params.semanticEvaluator) {
      try {
        const llmScores = normalizeScores(await params.semanticEvaluator({
          question: params.question,
          answer: params.answer,
          deterministicScores: coachOutput.dimensionScores,
          objectiveSignals: {
            words: commOutput.word_count,
            fillers: commOutput.filler_words,
            hedges: commOutput.hedging,
            wpm: commOutput.wpm,
            avgSentenceLength: commOutput.avg_sentence_len,
            metricsCited: contentOutput.metrics_cited,
            answeredPrompt: contentOutput.answered_prompt,
            rubricPointsCovered: contentOutput.key_points_covered.length,
            starComponentsDetected: starOutput.starFilled,
            starResultStatus: starOutput.result.status,
          },
        }));
        scores = llmScores;
        overall = applyScoreGuardrails(calculateOverallScore(llmScores), {
          answer: params.answer,
          wordCount: commOutput.word_count,
          answeredPrompt: contentOutput.answered_prompt,
          coveredPointCount: contentOutput.key_points_covered.length,
          completeness: llmScores.completeness,
        });
        verdict = verdictForScore(overall);
        evaluationSource = 'llm';
      } catch (error) {
        timings.semanticFallback = Date.now() - t0Coach;
        logA2A('semantic_evaluator', 'coach_agent', {
          mode: 'deterministic_fallback',
          reason: error instanceof Error ? error.message : 'Semantic evaluator unavailable',
        });
      }
    }

    logA2A('coach_agent', 'candidate_dashboard', {
      overallScore: overall,
      verdict,
      evaluationSource,
      followUpsGenerated: coachOutput.followUpQuestions.length,
      recurringGap: coachOutput.recurringGapKey
    }, timings.coach);

    onStage?.('coach', 'done', {
      overall,
      scores,
      latencyMs: timings.coach
    });

    // Assemble unified result
    return {
      id: `s_${Date.now()}`,
      questionId: params.question.id,
      questionText: params.question.question,
      competency: params.question.competency,
      type: params.question.questionType,
      difficulty: params.question.difficulty,
      mode: params.mode,
      answer: params.answer,
      metrics: {
        words: commOutput.word_count,
        fillers: commOutput.filler_words,
        wpm: commOutput.wpm,
        avgSentenceLen: commOutput.avg_sentence_len,
        numbers: contentOutput.metrics_cited.length,
        hedges: commOutput.hedging
      },
      scores,
      overall,
      verdict,
      evaluationSource,
      agentEvaluationSources: { communication: commResult.evaluationSource, content: contentResult.evaluationSource, star: starResult.evaluationSource, coach: 'deterministic_fallback' },
      agentFallbackReasons: {
        ...(commResult.fallbackReason ? { communication: commResult.fallbackReason } : {}),
        ...(contentResult.fallbackReason ? { content: contentResult.fallbackReason } : {}),
        ...(starResult.fallbackReason ? { star: starResult.fallbackReason } : {}),
      },
      star: {
        situation: {
          detected: starOutput.situation.status === 'detected' || starOutput.situation.status === 'strong',
          evidence: starOutput.situation.evidence || "No context-setting sentence found."
        },
        task: {
          detected: starOutput.task.status === 'detected' || starOutput.task.status === 'strong',
          evidence: starOutput.task.evidence || "No explicit responsibility statement found."
        },
        action: {
          detected: starOutput.action.status === 'detected' || starOutput.action.status === 'strong',
          evidence: starOutput.action.evidence || "No first-person action verbs detected."
        },
        result: {
          detected: starOutput.result.status === 'detected' || starOutput.result.status === 'strong',
          evidence: starOutput.result.evidence || "No measurable outcome stated."
        }
      },
      starFilled: starOutput.starFilled,
      strengths: coachOutput.strengths,
      improvements: coachOutput.improvements,
      modelAnswer: coachOutput.improvedAnswer,
      modelPoints: coachOutput.hitPoints,
      followUps: coachOutput.followUpQuestions,
      evidenceHighlights: coachOutput.evidenceHighlights,
      actionableAdvice: coachOutput.actionableAdvice,
      recurringGapKey: coachOutput.recurringGapKey,
      a2aMessages,
      timings,
      createdAt: new Date().toISOString()
    };
  }
}
