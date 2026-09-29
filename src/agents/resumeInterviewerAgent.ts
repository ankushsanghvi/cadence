import {
  ResumeKnowledgeModel,
  ResumeEvidenceItem,
  InterviewRoundKey,
  INTERVIEW_ROUNDS,
} from '@/lib/resume/resumeKnowledge';
import { executeChatCompletion } from '@/server/ai/llmClient';
import { allowedIntents, chooseEvidence, followUpGap, isGroundedQuestion, isQuestionableEvidence, isSemanticDuplicate, isTechnicalEvidence, isVagueReference, type QuestionIntent } from '@/lib/interview/evidenceGuard';
import { INITIAL_INTERVIEW_DATASET } from '@/data/interviewDataset';

export type InterviewEvaluation = {
  star?: { result?: { detected?: boolean } };
  improvements?: string[];
};
type LlmQuestionPayload = Partial<InterviewerQuestionOutput> & { question?: unknown };
const questionTypes = new Set<InterviewerQuestionOutput['questionType']>(['behavioral', 'technical', 'situational', 'leadership', 'hr', 'followup', 'role_alignment']);

export interface InterviewerQuestionOutput {
  question: string;
  questionType: 'behavioral' | 'technical' | 'situational' | 'leadership' | 'hr' | 'followup' | 'role_alignment';
  round: InterviewRoundKey;
  competency: string;
  difficulty: string;
  source: 'resume' | 'role_standard';
  resumeTopic: string;
  reason: string;
  expectedCompetency: string;
  followUp: boolean;
  evidenceUsed: string[];
  evidenceItemId?: string;
  intent?: QuestionIntent;
  generationSource?: 'llm' | 'deterministic_fallback';
  isCompleted?: boolean;
}

export interface InterviewTurnRecord {
  turnIndex: number;
  coreQuestionIndex: number;
  isFollowUp: boolean;
  question: InterviewerQuestionOutput;
  answer: string;
  evaluation?: InterviewEvaluation;
}

export interface InterviewSessionState {
  sessionId: string;
  candidateId: string;
  candidateName: string;
  targetRole: string;
  round: InterviewRoundKey;
  difficulty: string;
  resumeKnowledge: ResumeKnowledgeModel;
  evidenceGraph: ResumeEvidenceItem[];
  history: InterviewTurnRecord[];
  coreQuestionsAsked: number;
  totalCoreQuestions: number;
  maxTotalQuestions: number;
  durationMinutes: number;
  startedAt: string;
  totalQuestionsAsked: number;
  maxFollowUpsPerQuestion: number;
  currentFollowUpsForCore: number;
  topicsCovered: string[];
  topicsRemaining: string[];
  askedEvidenceIds: string[];
  askedIntents: QuestionIntent[];
  isCompleted: boolean;
}

/**
 * Initializes a new interview session state for any candidate and round.
 */
export function initializeSessionState(
  resumeKnowledge: ResumeKnowledgeModel,
  roundKey: InterviewRoundKey,
  targetRole: string,
  difficulty = 'Standard'
): InterviewSessionState {
  const roundDef = INTERVIEW_ROUNDS[roundKey] || INTERVIEW_ROUNDS.behavioral;
  const allTopics = resumeKnowledge.evidenceGraph.map(e => e.topic);

  return {
    sessionId: `interview_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    candidateId: resumeKnowledge.candidate.email || 'anonymous-candidate',
    candidateName: resumeKnowledge.candidate.name || 'Candidate',
    targetRole,
    round: roundKey,
    difficulty,
    resumeKnowledge,
    evidenceGraph: resumeKnowledge.evidenceGraph.map(e => ({ ...e })),
    history: [],
    coreQuestionsAsked: 0,
    totalCoreQuestions: roundDef.coreQuestionCount,
    maxTotalQuestions: roundDef.maxTotalQuestions,
    durationMinutes: roundDef.durationMinutes,
    startedAt: new Date().toISOString(),
    totalQuestionsAsked: 0,
    maxFollowUpsPerQuestion: roundDef.maxFollowUpsPerQuestion,
    currentFollowUpsForCore: 0,
    topicsCovered: [],
    topicsRemaining: allTopics,
    askedEvidenceIds: [],
    askedIntents: [],
    isCompleted: false,
  };
}

/**
 * Core AI Interviewer Agent
 */
export class ResumeInterviewerAgent {
  public static readonly agentName = 'Resume-Driven AI Interviewer';

  /**
   * Generates or decides the next question based on candidate resume, round, and previous answers.
   */
  public static async decideNextQuestion(
    state: InterviewSessionState,
    lastAnswer?: string,
    lastEvaluation?: InterviewEvaluation
  ): Promise<{ nextQuestion: InterviewerQuestionOutput; updatedState: InterviewSessionState }> {
    const updatedState = { ...state, askedEvidenceIds: state.askedEvidenceIds || [], askedIntents: state.askedIntents || [] };

    const elapsedMinutes = (Date.now() - new Date(updatedState.startedAt).getTime()) / 60000;
    const reachedQuestionLimit = updatedState.totalQuestionsAsked >= updatedState.maxTotalQuestions;
    const reachedCoreLimit = updatedState.coreQuestionsAsked >= updatedState.totalCoreQuestions;
    const reachedDurationLimit = elapsedMinutes >= updatedState.durationMinutes;

    // A round ends at the first hard limit. This is enforced before any model
    // call, so a model can never keep an interview alive indefinitely.
    if ((reachedQuestionLimit || reachedCoreLimit || reachedDurationLimit) && !updatedState.isCompleted) {
      updatedState.isCompleted = true;
      return {
        nextQuestion: {
          question: 'The interview round is complete. Thank you for walking through your experience.',
          questionType: 'role_alignment',
          round: updatedState.round,
          competency: 'Interview Completion',
          difficulty: updatedState.difficulty,
          source: 'role_standard',
          resumeTopic: 'Overall Interview',
          reason: reachedDurationLimit ? 'The interview duration budget has been reached.' : 'The configured interview question limit has been reached.',
          expectedCompetency: 'Summary',
          followUp: false,
          evidenceUsed: [],
          isCompleted: true,
        },
        updatedState,
      };
    }

    // Decide if we should ask an adaptive follow-up on the last answer
    const shouldAskFollowUp =
      !!lastAnswer &&
      lastAnswer.trim().split(/\s+/).length >= 5 &&
      updatedState.currentFollowUpsForCore < updatedState.maxFollowUpsPerQuestion &&
      this.detectFollowUpNeed(lastAnswer, lastEvaluation);

    let nextQuestion: InterviewerQuestionOutput;

    // This agent is also used as the browser's offline fallback. Provider
    // credentials deliberately exist only on the server, so browser execution
    // must remain deterministic and must never attempt an LLM request.
    const canUseServerLLM = typeof window === 'undefined' && Boolean(process.env.OPENAI_API_KEY?.trim());

    // HR is deliberately controlled by the round template. A language model
    // can enrich technical rounds, but it must not turn an HR introduction
    // into a project-depth interview simply because the resume is technical.
    if (updatedState.round === 'hr' || !canUseServerLLM) {
      nextQuestion = this.generateFallbackQuestion(updatedState, shouldAskFollowUp, lastAnswer);
    } else {
      try {
        // A question transition is part of the interview's rhythm. Keep the
        // model enhancement opportunistic and use the grounded deterministic
        // generator if it cannot respond within the interaction budget.
        nextQuestion = await this.queryLLMWithinBudget(updatedState, shouldAskFollowUp, lastAnswer, lastEvaluation);
      } catch (err) {
        console.warn('[ResumeInterviewerAgent] LLM call failed or unavailable, using deterministic resume-aware fallback:', err);
        nextQuestion = this.generateFallbackQuestion(updatedState, shouldAskFollowUp, lastAnswer);
      }
    }

    // Final gate shared by LLM, deterministic, and follow-up paths. Nothing
    // reaches the session UI as a resume-grounded question unless its actual
    // evidence item and wording still validate together.
    if (nextQuestion.source === 'resume') {
      const selectedEvidence = updatedState.evidenceGraph.find(item => item.id === nextQuestion.evidenceItemId || item.topic === nextQuestion.resumeTopic);
      if (!isQuestionableEvidence(selectedEvidence) || !isGroundedQuestion(nextQuestion.question, selectedEvidence, updatedState.evidenceGraph, updatedState.round) || isSemanticDuplicate(nextQuestion.question, updatedState.history.map(turn => turn.question.question))) {
        nextQuestion = this.curatedFallback(updatedState);
      }
    }

    // Attach the actual evidence identity even for deterministic templates;
    // topics can share names, whereas evidence ids cannot.
    if (!nextQuestion.evidenceItemId) {
      nextQuestion.evidenceItemId = updatedState.evidenceGraph.find(item => item.topic === nextQuestion.resumeTopic)?.id;
    }
    if (!nextQuestion.intent) nextQuestion.intent = nextQuestion.followUp ? followUpGap(lastAnswer || '') || 'technical_depth' : allowedIntents(updatedState.round, updatedState.evidenceGraph.find(item => item.id === nextQuestion.evidenceItemId))[0];
    if (!nextQuestion.generationSource) nextQuestion.generationSource = 'deterministic_fallback';

    // Update state progression
    if (nextQuestion.followUp) {
      updatedState.currentFollowUpsForCore += 1;
    } else {
      updatedState.coreQuestionsAsked += 1;
      updatedState.currentFollowUpsForCore = 0;
    }
    if (nextQuestion.evidenceItemId && !updatedState.askedEvidenceIds.includes(nextQuestion.evidenceItemId)) updatedState.askedEvidenceIds.push(nextQuestion.evidenceItemId);
    if (nextQuestion.intent) updatedState.askedIntents.push(nextQuestion.intent);
    updatedState.totalQuestionsAsked += 1;

    // Mark resume topic as covered
    if (nextQuestion.resumeTopic && !updatedState.topicsCovered.includes(nextQuestion.resumeTopic)) {
      updatedState.topicsCovered.push(nextQuestion.resumeTopic);
      updatedState.topicsRemaining = updatedState.topicsRemaining.filter(t => t !== nextQuestion.resumeTopic);
      const graphItem = updatedState.evidenceGraph.find(e => e.id === nextQuestion.evidenceItemId || e.topic === nextQuestion.resumeTopic);
      if (graphItem) {
        graphItem.covered = true;
        graphItem.timesExplored = (graphItem.timesExplored || 0) + 1;
      }
    }

    return { nextQuestion, updatedState };
  }

  private static async queryLLMWithinBudget(
    state: InterviewSessionState,
    isFollowUp: boolean,
    lastAnswer?: string,
    lastEvaluation?: InterviewEvaluation
  ): Promise<InterviewerQuestionOutput> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.queryLLMForNextQuestion(state, isFollowUp, lastAnswer, lastEvaluation),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Question generation exceeded the live interview budget.')), 1800);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  /**
   * Detects if the candidate's last answer has a noticeable gap that warrants a targeted follow-up.
   */
  private static detectFollowUpNeed(answer: string, evaluation?: InterviewEvaluation): boolean {
    // 1. Very brief answer
    if (followUpGap(answer)) return true;

    // 2. Unquantified claim in behavioral/technical response
    const hasNumbers = /\b\d+(\.\d+)?%?\b/g.test(answer);
    if (!hasNumbers && /\b(improved|increased|grew|scaled|reduced|boosted|saved|optimized)\b/i.test(answer)) {
      return true;
    }

    // 3. Vague ownership ("we did", "the team did")
    const weCount = (answer.match(/\b(we|our team|they)\b/gi) || []).length;
    const iCount = (answer.match(/\b(i|my|me)\b/gi) || []).length;
    if (weCount > iCount * 2 && weCount >= 3) {
      return true;
    }

    // 4. Missing STAR Result
    if (evaluation?.star && !evaluation.star.result?.detected) {
      return true;
    }

    return false;
  }

  private static resolveFollowUpContext(state: InterviewSessionState): string | null {
    const previousQuestion = state.history.at(-1)?.question;
    const topic = previousQuestion?.resumeTopic;
    const evidence = previousQuestion?.evidenceItemId || topic
      ? state.evidenceGraph.find((item) => item.id === previousQuestion?.evidenceItemId || item.topic === topic)
      : undefined;
    const verifiedTopic = evidence?.topic || topic;

    return verifiedTopic && verifiedTopic !== 'Resume' && verifiedTopic !== 'Resume Experience'
      ? `While discussing ${verifiedTopic}`
      : null;
  }

  private static hasVagueFollowUpReference(question: string): boolean {
    return isVagueReference(question);
  }

  /**
   * Prompts the configured LLM endpoint (openai/gpt-5-nano) with strict resume grounding.
   */
  private static async queryLLMForNextQuestion(
    state: InterviewSessionState,
    isFollowUp: boolean,
    lastAnswer?: string,
    lastEvaluation?: InterviewEvaluation
  ): Promise<InterviewerQuestionOutput> {
    const roundDef = INTERVIEW_ROUNDS[state.round] || INTERVIEW_ROUNDS.behavioral;
    const targetEvidence = isFollowUp
      ? state.evidenceGraph.find(e => e.id === state.history.at(-1)?.question.evidenceItemId || e.topic === state.history.at(-1)?.question.resumeTopic)
      : chooseEvidence(state.evidenceGraph, state.round, state.askedEvidenceIds || []);
    if (!targetEvidence) throw new Error('No concrete resume evidence is available for a grounded question.');
    const permittedIntents = allowedIntents(state.round, targetEvidence).filter(i => !(state.askedIntents || []).includes(i));

    const promptContext = {
      candidateName: state.candidateName,
      targetRole: state.targetRole,
      round: state.round,
      roundTitle: roundDef.name,
      difficulty: state.difficulty,
      coreQuestionNumber: isFollowUp ? state.coreQuestionsAsked : state.coreQuestionsAsked + 1,
      totalCoreQuestions: state.totalCoreQuestions,
      isFollowUp,
      selectedResumeTopic: targetEvidence.topic,
      resumeFacts: targetEvidence.facts,
      evidenceType: targetEvidence.category,
      evidenceTechnologies: targetEvidence.technologies,
      evidenceResponsibilities: targetEvidence.responsibilities,
      permittedIntents,
      topicsAlreadyCovered: state.topicsCovered,
      lastQuestion: state.history[state.history.length - 1]?.question.question,
      lastAnswer: lastAnswer || null,
      identifiedWeakness: lastEvaluation?.improvements?.[0] || null,
      verifiedFollowUpContext: isFollowUp ? this.resolveFollowUpContext(state) : null,
    };

    const systemPrompt = `You are an elite, perceptive, and highly experienced AI Interviewer conducting a rigorous job interview.
You have thoroughly reviewed the candidate's actual resume.
CRITICAL MANDATES:
1. Ground your question only in the selected evidence item. Its technologies, facts and responsibilities are the only facts you may attribute to it. Global skills are not evidence that a technology was used at a company, university, or project.
2. NEVER hallucinate or invent experiences, companies, metrics, or teams that are not in the resume.
3. If this is a FOLLOW-UP question, probe the specific gap or claim in the candidate's previous answer (e.g. asking for specific metrics, personal contribution vs team, or architectural rationale).
4. If this is a NEW core question, use the supplied selected evidence item and frame it appropriate for the current interview round:
   - HR / Intro: Background, career trajectory, motivation, and culture/role fit. Do NOT ask for architecture, project selection, implementation detail, technical trade-offs, or metrics.
   - Behavioral: STAR situations of adversity, disagreement, or failure in their past ventures/jobs.
   - Technical: In-depth implementation questions only for project/work/venture evidence with supported technical facts. For education, certification, or a generic skill, ask a focused foundations or role-knowledge question; never imply it had an architecture or implementation.
   - Situational: Hypothetical operational challenges calibrated to their real experience (e.g., startup orders crashing, partner outage).
   - Leadership: Ownership, unassigned initiatives, founding decisions, stakeholder management.
5. Return ONLY a single, valid JSON object matching the requested schema.`;
    const roleGuidance = /\b(data analyst|analyst|\bda\b)\b/i.test(state.targetRole)
      ? 'For this Data Analyst role, prioritize SQL, data quality, interpretation, dashboards, statistics, business reasoning, and stakeholder communication. Do not ask ML or system-design questions unless the resume directly supports them.'
      : /\b(executive|leadership|manager|\bem\b)\b/i.test(state.targetRole)
        ? 'For this leadership role, prioritize ownership, prioritisation, business impact, ambiguity, stakeholder alignment, and judgement. Avoid deep technical implementation unless it is central to the candidate evidence.'
        : 'Match technical depth to the target role and the candidate evidence.';

    const userPrompt = `Interview Context:
${JSON.stringify(promptContext, null, 2)}

Role guidance: ${roleGuidance}

Question constraints: ask one conversational question in 20–45 words (two short sentences at most). Never combine more than two asks. A follow-up must probe one specific gap only. Every follow-up must stand alone: include the provided verified follow-up context in the question, and never use “that initiative,” “that project,” “what the team delivered,” “as you mentioned,” “that experience,” “that effort,” or “that implementation.” If no verified follow-up context is provided, ask a fresh standalone question instead of a follow-up.

For HR / Introduction, ask a warm, people-focused interviewer question about the candidate's story, motivation, or fit—not a technical or project-depth question.

Return ONLY valid JSON matching this exact structure:
{
  "question": "Your precise, conversational question string here",
  "questionType": "${state.round === 'technical' ? 'technical' : state.round === 'situational' ? 'situational' : state.round === 'leadership' ? 'leadership' : state.round === 'hr' ? 'hr' : 'behavioral'}",
  "round": "${state.round}",
  "competency": "${roundDef.primaryCompetencies[0]}",
  "difficulty": "${state.difficulty}",
  "source": "resume",
      "resumeTopic": "${targetEvidence.topic}",
  "reason": "Why this question was chosen based on the resume and previous responses",
  "expectedCompetency": "Key competency being tested",
  "followUp": ${isFollowUp},
      "evidenceUsed": ${JSON.stringify(targetEvidence.facts.slice(0, 2))}
}`;

    const res = await executeChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      responseFormat: 'json_object',
      temperature: isFollowUp ? 0.3 : 0.6,
      traceName: isFollowUp ? 'Question Agent — Adaptive Follow-up' : 'Question Agent — Resume Question',
    });

    const rawContent = res.choices?.[0]?.message?.content;
    const parsed: LlmQuestionPayload = typeof rawContent === 'string' ? JSON.parse(rawContent) as LlmQuestionPayload : {};
    if (!parsed.question || typeof parsed.question !== 'string') {
      throw new Error('Malformed JSON received from LLM');
    }
    if (isFollowUp && (!this.resolveFollowUpContext(state) || this.hasVagueFollowUpReference(parsed.question))) {
      throw new Error('LLM returned a vague or ungrounded follow-up');
    }
    if (!isQuestionableEvidence(targetEvidence) || !isGroundedQuestion(parsed.question, targetEvidence, state.evidenceGraph, state.round) || isSemanticDuplicate(parsed.question, state.history.map(turn => turn.question.question))) {
      throw new Error('LLM returned an ungrounded or duplicate question');
    }

    return {
      question: this.limitQuestionLength(parsed.question),
      questionType: questionTypes.has(parsed.questionType as InterviewerQuestionOutput['questionType'])
        ? parsed.questionType as InterviewerQuestionOutput['questionType']
        : state.round === 'technical' ? 'technical' : state.round === 'situational' ? 'situational' : state.round === 'leadership' ? 'leadership' : state.round === 'hr' ? 'hr' : 'behavioral',
      round: state.round,
      competency: parsed.competency || roundDef.primaryCompetencies[0],
      difficulty: state.difficulty,
      source: 'resume',
      resumeTopic: targetEvidence.topic,
      reason: parsed.reason || 'Personalized using candidate resume evidence graph.',
      expectedCompetency: parsed.expectedCompetency || 'Demonstrated ownership and technical depth',
      followUp: isFollowUp,
      evidenceUsed: targetEvidence.facts.slice(0, 2),
      evidenceItemId: targetEvidence.id,
      intent: permittedIntents[0] || allowedIntents(state.round, targetEvidence)[0],
      generationSource: 'llm',
    };
  }

  private static limitQuestionLength(question: string): string {
    const words = question.trim().split(/\s+/);
    if (words.length <= 45) return question.trim();
    return `${words.slice(0, 45).join(' ').replace(/[,:;\-]+$/, '')}?`;
  }

  private static displayRole(role: string): string {
    const names: Record<string, string> = {
      aiml: 'AI/ML Engineer', swe: 'Software Engineer', sse: 'Senior Software Engineer',
      pm: 'Product Manager', da: 'Data Analyst', ba: 'Business Analyst',
      devops: 'Cloud / DevOps Engineer', em: 'Engineering Manager', cs: 'Customer Success Manager',
    };
    return names[role.toLowerCase()] || role;
  }

  private static curatedFallback(state: InterviewSessionState): InterviewerQuestionOutput {
    const stageByRound: Record<InterviewRoundKey, string> = {
      hr: 'HR & Culture Screening', behavioral: 'Behavioral & STAR Competency', technical: 'Technical & Domain Depth',
      situational: 'System Design & Scenarios', leadership: 'Executive & Client Communication', mock: 'Behavioral & STAR Competency',
    };
    const datasetQuestion = INITIAL_INTERVIEW_DATASET.find(item => item.stage === stageByRound[state.round]) || INITIAL_INTERVIEW_DATASET[0];
    return {
      question: datasetQuestion.question, questionType: state.round === 'hr' ? 'hr' : state.round === 'technical' ? 'technical' : state.round === 'situational' ? 'situational' : state.round === 'leadership' ? 'leadership' : 'behavioral',
      round: state.round, competency: datasetQuestion.competency, difficulty: state.difficulty, source: 'role_standard', resumeTopic: 'Role-standard question',
      reason: 'No sufficiently detailed resume evidence was available; selected a curated round-appropriate question.', expectedCompetency: datasetQuestion.expectedCompetencies.join(', '), followUp: false, evidenceUsed: [], intent: 'role_knowledge',
    };
  }

  /**
   * Deterministic, zero-failure fallback engine that is GUARANTEED to be resume-aware.
   * Dynamically constructs questions using candidate's actual projects, companies, metrics, and skills.
   */
  public static generateFallbackQuestion(
    state: InterviewSessionState,
    isFollowUp: boolean,
    lastAnswer?: string
  ): InterviewerQuestionOutput {
    const roundDef = INTERVIEW_ROUNDS[state.round] || INTERVIEW_ROUNDS.behavioral;

    // Pick an uncovered evidence item if possible
    const previousEvidence = state.history.at(-1)?.question.evidenceItemId;
    const evidence = isFollowUp
      ? state.evidenceGraph.find(item => item.id === previousEvidence || item.topic === state.history.at(-1)?.question.resumeTopic)
      : chooseEvidence(state.evidenceGraph, state.round, state.askedEvidenceIds || []);

    if (!evidence || (isFollowUp && !isQuestionableEvidence(evidence))) return isFollowUp ? this.generateFallbackQuestion(state, false) : this.curatedFallback(state);

    const topic = evidence?.topic || 'Core Experience';
    const role = evidence?.role || 'Engineer';
    const metric = evidence?.metrics?.[0];
    const tech = evidence?.technologies?.[0];
    const isDataAnalyst = /\b(data analyst|analyst|\bda\b)\b/i.test(state.targetRole);
    const isExecutive = /\b(executive|leadership|manager|\bem\b)\b/i.test(state.targetRole);
    const targetRole = this.displayRole(state.targetRole);

    // 1. Follow-Up Generation
    if (isFollowUp && lastAnswer) {
      const followUpContext = this.resolveFollowUpContext(state);
      if (!followUpContext) {
        return this.generateFallbackQuestion(state, false);
      }
      if (state.round === 'hr') {
        return {
          question: `${followUpContext}, what specifically motivated you to move toward a ${targetRole} role at this point in your career?`,
          questionType: 'followup', round: state.round, competency: 'Career Motivation', difficulty: state.difficulty,
          source: 'resume', resumeTopic: topic,
          reason: 'Clarifying the candidate’s career motivation in an HR interview.',
          expectedCompetency: 'Clear career direction and role fit', followUp: true, evidenceUsed: [topic],
        };
      }
      const gap = followUpGap(lastAnswer);
      if (gap === 'ownership') {
        return {
          question: `${followUpContext}, you described a team outcome. What specifically did you personally design, implement, or own?`,
          questionType: 'followup',
          round: state.round,
          competency: 'Personal Ownership',
          difficulty: state.difficulty,
          source: 'resume',
          resumeTopic: topic,
          reason: 'Probing personal ownership following a team-centric answer.',
          expectedCompetency: 'Individual Ownership & Accountability',
          followUp: true,
          evidenceUsed: [topic, role],
        };
      }

      if (gap === 'measurable_impact') {
        return {
          question: `${followUpContext}, what concrete metric or measurable outcome verified success?`,
          questionType: 'followup',
          round: state.round,
          competency: 'STAR Result Rigor',
          difficulty: state.difficulty,
          source: 'resume',
          resumeTopic: topic,
          reason: 'Eliciting quantifiable outcome for STAR result completeness.',
          expectedCompetency: 'Quantified Impact',
          followUp: true,
          evidenceUsed: [topic],
        };
      }

      const answerTechnology = [...(evidence?.technologies || [])].reverse().find(item => new RegExp(`\\b${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lastAnswer));
      if (gap === 'design_decision' && answerTechnology) return {
        question: `${followUpContext}, you said you used ${answerTechnology}. What requirement or trade-off led you to choose it?`,
        questionType: 'followup',
        round: state.round,
        competency: 'Adversity & Trade-offs',
        difficulty: state.difficulty,
        source: 'resume',
        resumeTopic: topic,
        reason: 'Probing the design rationale omitted from the latest answer.',
        expectedCompetency: 'Critical Decision-Making',
        followUp: true,
        evidenceUsed: [topic],
      };
      return this.generateFallbackQuestion(state, false);
    }

    // 2. Core Question Generation by Round
    let questionText = '';
    let comp = roundDef.primaryCompetencies[0];

    switch (state.round) {
      case 'hr':
        if (state.coreQuestionsAsked === 0) {
          questionText = `Please introduce yourself and walk me through the experiences that led you to pursue a ${targetRole} role.`;
          comp = 'Career Story & Motivation';
        } else if (state.coreQuestionsAsked === 1) {
          questionText = `What interests you most about a ${targetRole} career, and which part of your background has most shaped that direction?`;
          comp = 'Role Motivation & Fit';
        } else {
          questionText = `What are you looking for in your next team, and how would you hope to contribute in your first few months?`;
          comp = 'Culture Fit & Communication';
        }
        break;

      case 'behavioral':
        if (evidence?.category === 'venture' || /\b(founder|owner|lead)\b/i.test(role)) {
          questionText = `I noticed you were involved in ${topic} as ${role}${metric ? ` handling ${metric}` : ''}. Tell me about a critical decision you had to make under extreme uncertainty where there was no clear right answer.`;
          comp = 'Decision Making Under Uncertainty';
        } else if (state.coreQuestionsAsked % 2 === 0) {
          questionText = `Describe a meaningful challenge while working on ${topic}. What action did you take, and what did you learn?`;
          comp = 'Conflict Resolution & Adversity';
        } else {
          questionText = `Tell me about a time related to ${topic} when something did not meet expectations. How did you respond and communicate the outcome?`;
          comp = 'Overcoming Failure (STAR)';
        }
        break;

      case 'technical':
        if (evidence?.category === 'education') {
          questionText = `Your education includes ${topic}. Which relevant concept or coursework gave you a useful technical foundation, and how do you apply it today?`;
          comp = 'Academic Foundation';
        } else if (evidence?.category === 'certification' || evidence?.category === 'achievement') {
          questionText = `Your resume lists ${topic}. What practical knowledge did you gain from it, and where would you apply that knowledge?`;
          comp = 'Role Knowledge';
        } else if (isDataAnalyst && isTechnicalEvidence(evidence)) {
          questionText = `Using ${topic}, walk me through one analysis you delivered. How did you validate the data and turn it into a recommendation?`;
          comp = 'Data Interpretation & Business Reasoning';
        } else if (isTechnicalEvidence(evidence) && tech) {
          const intent = allowedIntents(state.round, evidence).find(i => !(state.askedIntents || []).includes(i)) || 'technical_depth';
          const templates: Record<string, string> = {
            implementation: `On ${topic}, how did you implement the part of the work involving ${tech}?`,
            debugging: `On ${topic}, describe a technical issue you diagnosed and the evidence you used to isolate it.`,
            design_decision: `On ${topic}, what requirement led you to use ${tech}, and what alternative did you consider?`,
            trade_off: `On ${topic}, what trade-off did you make while working with ${tech}?`,
            scalability: `On ${topic}, what constraint would you examine first if usage increased substantially?`,
            performance: `On ${topic}, how did you evaluate whether the implementation performed well enough?`,
            failure_handling: `On ${topic}, how did you plan for or handle failures in the part you built?`,
            technical_depth: `Walk me through the most technically demanding part of ${topic} that involved ${tech}.`,
          };
          questionText = templates[intent];
          comp = intent.replace('_', ' ');
        } else {
          questionText = `Your resume lists ${topic}. What practical role-specific knowledge are you most confident applying, and how would you use it?`;
          comp = 'Role Knowledge';
        }
        break;

      case 'situational':
        if (evidence?.category === 'venture' || /\b(founder|commerce|delivery)\b/i.test(topic + ' ' + (evidence?.facts || []).join(' '))) {
          questionText = `Imagine you are running ${topic} and orders or system traffic suddenly drop by 30% over a 48-hour period. Walk me through your step-by-step investigation framework.`;
          comp = 'Incident Root Cause Analysis';
        } else {
          questionText = `Imagine a dependency relevant to ${topic} becomes unavailable before a deadline. How would you assess the impact and respond?`;
          comp = 'Crisis Management';
        }
        break;

      case 'leadership':
        questionText = isExecutive
          ? `Tell me about an ambiguous decision you owned at ${topic}. How did you align stakeholders and measure the business outcome?`
          : `Tell me about an ambiguous problem you owned at ${topic}. What did you do when no one had assigned it to you?`;
        comp = isExecutive ? 'Leadership Judgement & Stakeholder Alignment' : 'Extreme Ownership & Initiative';
        break;

      case 'mock':
      default:
        const mockStageIdx = state.coreQuestionsAsked;
        if (mockStageIdx < 2) {
          questionText = `Walk me through your background with ${topic}. What motivated you to focus on ${state.targetRole}?`;
          comp = 'HR & Background';
        } else if (mockStageIdx < 6) {
          questionText = `Tell me about a challenging situation you navigated while delivering ${topic}. Walk me through the Situation, Task, Action, and quantifiable Result.`;
          comp = 'Behavioral (STAR)';
        } else if (mockStageIdx < 10) {
          questionText = isTechnicalEvidence(evidence) && tech ? `On ${topic}, what technical constraint did you consider when working with ${tech}?` : `What role-specific knowledge from ${topic} would you apply to a new problem?`;
          comp = 'Technical Architecture';
        } else if (mockStageIdx < 12) {
          questionText = `If your primary production pipeline for ${topic} experienced silent data corruption under heavy concurrent load, how would you triage and fix it?`;
          comp = 'Situational Troubleshooting';
        } else if (mockStageIdx < 14) {
          questionText = `Describe a time on ${topic} where you had to influence cross-functional peers to adopt a major technical or product change they initially resisted.`;
          comp = 'Leadership & Stakeholder Influence';
        } else {
          questionText = `Based on everything you built across ${topic} and your projects, why are you the strongest candidate for this ${state.targetRole} role today?`;
          comp = 'Executive Value Proposition';
        }
        break;
    }

    return {
      question: questionText,
      questionType: state.round === 'technical' ? 'technical' : state.round === 'situational' ? 'situational' : state.round === 'leadership' ? 'leadership' : state.round === 'hr' ? 'hr' : 'behavioral',
      round: state.round,
      competency: comp,
      difficulty: state.difficulty,
      source: 'resume',
      resumeTopic: topic,
      reason: `Deterministic resume-aware question generated from candidate evidence item: ${topic} (${role}).`,
      expectedCompetency: comp,
      followUp: false,
      evidenceUsed: [topic, ...(metric ? [metric] : [])],
      evidenceItemId: evidence?.id,
      intent: allowedIntents(state.round, evidence).find(i => !(state.askedIntents || []).includes(i)) || allowedIntents(state.round, evidence)[0],
    };
  }
}
