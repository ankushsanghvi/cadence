import { CandidateProfile } from '@/lib/api';
import { CommunicationAgentOutput } from './communicationAnalysisAgent';
import { ContentAgentOutput } from './contentEvaluationAgent';
import { StarAgentOutput } from './starStructureAgent';
import { QuestionAgentOutput } from './interviewQuestionAgent';
import { applyScoreGuardrails, calculateOverallScore, verdictForScore } from '@/lib/interview/scoring';

export interface CoachAgentInput {
  candidateProfile: CandidateProfile | null;
  questionOutput: QuestionAgentOutput;
  candidateResponse: string;
  commOutput: CommunicationAgentOutput;
  contentOutput: ContentAgentOutput;
  starOutput: StarAgentOutput;
}

export interface CoachAgentOutput {
  overallScore: number; // 0-100
  verdict: string;
  dimensionScores: {
    relevance: number;
    clarity: number;
    structure: number;
    completeness: number;
    communication: number;
  };
  strengths: string[];
  improvements: string[];
  evidenceHighlights: Array<{
    dimension: string;
    quoteOrSignal: string;
    coachingNote: string;
  }>;
  actionableAdvice: string[];
  improvedAnswer: string;
  hitPoints: string[];
  followUpQuestions: string[];
  recurringGapKey?: 'fillers' | 'results' | 'structure' | 'hedges' | 'thin';
}

export class InterviewCoachAgent {
  public static readonly agentName = "Lead Interview Coach Agent";
  public static readonly id = "coach";
  public static readonly prompt = `You are the Lead Interview Coach Agent.
Consolidate the evaluations of the Interview Question Agent, Communication Analysis Agent, Content Evaluation Agent, and STAR Structure Agent into a unified, actionable coaching report.
Generate an overall score, evidence-grounded strengths and weaknesses, an improved model rewrite, and personalized follow-up questions directly responsive to the candidate's detected gaps and claims.`;

  public static async execute(input: CoachAgentInput): Promise<CoachAgentOutput> {
    const { questionOutput, candidateResponse, commOutput, contentOutput, starOutput } = input;
    const q = questionOutput.question;

    // Dimension weights:
    // Relevance 20%, Clarity 20%, Structure 25%, Completeness 15%, Communication 20%
    const dimensionScores = {
      relevance: contentOutput.relevance,
      clarity: commOutput.clarity,
      structure: starOutput.structure_score,
      completeness: contentOutput.completeness,
      communication: commOutput.communication_quality,
    };

    const overallScore = applyScoreGuardrails(calculateOverallScore(dimensionScores), {
      answer: candidateResponse,
      wordCount: commOutput.word_count,
      answeredPrompt: contentOutput.answered_prompt,
      coveredPointCount: contentOutput.key_points_covered.length,
      completeness: contentOutput.completeness,
    });
    const verdict = verdictForScore(overallScore);

    // Consolidate Strengths
    const strengths: string[] = [];
    if (starOutput.strengths.length > 0) strengths.push(starOutput.strengths[0]);
    if (contentOutput.strengths.length > 0) strengths.push(contentOutput.strengths[0]);
    if (commOutput.strengths.length > 0) strengths.push(commOutput.strengths[0]);
    if (strengths.length < 2) {
      strengths.push("Directly tackled the challenge and shared first-hand engineering context.");
    }

    // Consolidate Improvements
    const improvements: string[] = [];
    if (starOutput.improvements.length > 0) improvements.push(starOutput.improvements[0]);
    if (contentOutput.gaps.length > 0) improvements.push(contentOutput.gaps[0]);
    if (commOutput.improvements.length > 0) improvements.push(commOutput.improvements[0]);
    if (improvements.length < 2) {
      improvements.push("Sharpen the opening line: lead with the headline impact before detailing implementation.");
    }

    // Evidence Highlights
    const evidenceHighlights: CoachAgentOutput['evidenceHighlights'] = [];

    if (starOutput.result.evidence) {
      evidenceHighlights.push({
        dimension: "STAR Result",
        quoteOrSignal: `"${starOutput.result.evidence}"`,
        coachingNote: starOutput.result.critique
      });
    } else {
      evidenceHighlights.push({
        dimension: "STAR Result",
        quoteOrSignal: "Missing final quantitative outcome",
        coachingNote: "Interviewers look for a clear statement of what changed (latency, cost, throughput, SLA)."
      });
    }

    if (commOutput.evidence.length > 0) {
      const firstComm = commOutput.evidence[0];
      evidenceHighlights.push({
        dimension: "Delivery & Tone",
        quoteOrSignal: firstComm.text,
        coachingNote: firstComm.critique
      });
    }

    if (contentOutput.evidence.length > 0) {
      const firstContent = contentOutput.evidence[0];
      evidenceHighlights.push({
        dimension: "Content Rigor",
        quoteOrSignal: firstContent.claim,
        coachingNote: firstContent.detail
      });
    }

    // Actionable Advice
    const actionableAdvice = [
      "Follow the 10-second rule: State the Situation and Task in under 30 seconds, spend 60 seconds on concrete Actions you personally took, and reserve 30 seconds for measurable Results.",
      "Quantify your contribution: Whenever you mention an improvement, pair it with a unit of measure (%, hours saved, $ cost reduction, p99 latency).",
      "Signpost out loud: Use transition markers ('First... then... which meant that...') to keep non-technical interviewers in sync."
    ];

    // Improved Model Answer
    let improvedAnswer = q.modelAnswer;
    if (!improvedAnswer) {
      improvedAnswer = `A stronger answer would clearly state the real situation, your personal actions, and the evidence you used to evaluate the outcome, without adding facts that were not part of your experience.`;
    }

    // Model Checklist Hit Points
    const hitPoints = q.modelPoints.length > 0
      ? q.modelPoints
      : ["Clear situation context", "Direct first-person action", "Quantifiable business result", "Zero filler words"];

    // Generate Personalized Response-Dependent Follow-Up Questions
    const followUpQuestions: string[] = [];
    const lowerResp = candidateResponse.toLowerCase();
    // One drill only, derived from a gap in this answer. Do not turn a keyword
    // into an invented architecture, metric, or responsibility.
    if ((starOutput.result.status === 'missing' || starOutput.result.status === 'weak') && /\b(improved|reduced|increased|faster|saved|scaled)\b/i.test(candidateResponse)) {
      followUpQuestions.push('You described an improvement. How did you measure it, and what was the before-and-after result?');
    } else if (starOutput.action.status === 'weak' && /\b(we|our team)\b/i.test(candidateResponse) && !/\b(i |my |personally)\b/i.test(candidateResponse)) {
      followUpQuestions.push('You described a team effort. Which specific responsibility did you personally own, and what did you do?');
    } else {
      const mentionedTechnology = ['postgresql', 'postgres', 'sql', 'kafka', 'queue', 'stream', 'api', 'microservice']
        .find(term => lowerResp.includes(term));
      if (mentionedTechnology && candidateResponse.trim().split(/\s+/).length < 80) {
        followUpQuestions.push(`You mentioned ${mentionedTechnology}. What requirement or trade-off led you to use it?`);
      }
    }

    // Identify primary recurring gap key
    let recurringGapKey: CoachAgentOutput['recurringGapKey'];
    if (commOutput.filler_words > 2) recurringGapKey = 'fillers';
    else if (starOutput.result.status === 'missing' || contentOutput.metrics_cited.length === 0) recurringGapKey = 'results';
    else if (starOutput.structure_score < 70) recurringGapKey = 'structure';
    else if (commOutput.hedging > 2) recurringGapKey = 'hedges';
    else if (commOutput.word_count < 90) recurringGapKey = 'thin';

    return {
      overallScore,
      verdict,
      dimensionScores,
      strengths: strengths.slice(0, 3),
      improvements: improvements.slice(0, 4),
      evidenceHighlights,
      actionableAdvice,
      improvedAnswer,
      hitPoints,
      followUpQuestions: followUpQuestions.slice(0, 3),
      recurringGapKey
    };
  }
}
