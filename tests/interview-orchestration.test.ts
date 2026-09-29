import assert from 'node:assert/strict';
import test from 'node:test';
import { runInterviewGraph } from '@/lib/interview/graph';
import { InterviewController } from '@/lib/interview/controller';
import { initializeSessionState } from '@/agents/resumeInterviewerAgent';
import { ResumeInterviewerAgent } from '@/agents/resumeInterviewerAgent';
import { ContentEvaluationAgent } from '@/agents/contentEvaluationAgent';
import { CommunicationAnalysisAgent } from '@/agents/communicationAnalysisAgent';
import { StarStructureAgent } from '@/agents/starStructureAgent';
import { InterviewCoachAgent } from '@/agents/interviewCoachAgent';
import { runEvaluation } from '@/lib/coachEngine';
import { MultiAgentPipeline } from '@/agents/multiAgentPipeline';
import { evaluateSemanticallyWithLLM } from '@/server/evaluation/semanticEvaluator';
import { calculateOverallScore, isValidScoreSet } from '@/lib/interview/scoring';
import type { ResumeKnowledgeModel } from '@/lib/resume/resumeKnowledge';
import { buildEvidenceGraph, extractResumeKnowledge } from '@/lib/resume/resumeKnowledge';
import { chooseEvidence, isGroundedQuestion, isSemanticDuplicate } from '@/lib/interview/evidenceGuard';
import { createEmptyProfile } from '@/lib/api';
import { enhanceSpecialistWithLLM } from '@/server/evaluation/specialistEvaluators';
import { deriveReviewWeaknesses, sessionRoadmap } from '@/lib/sessionReview';
import { filterSessions, SESSION_FILTERS, sessionFilterCategories, sessionMatchesFilter } from '@/lib/sessionFilters';
import { POST as runBenchmark } from '@/app/api/benchmark/run/route';
import { getPlanResources } from '@/lib/resources';
import { profile as sessionProfile } from '@/lib/store';

const knowledge: ResumeKnowledgeModel = {
  candidate: { name: 'Test Candidate', email: 'candidate@example.com', phone: '', location: '', summary: '' },
  education: [], experience: [], projects: [], certifications: [], achievements: [], organizations: [], rawText: '',
  skills: { technical: ['SQL'], soft: [], technologies: ['SQL'], domains: ['Analytics'] },
  evidenceGraph: [{ id: 'project_1', topic: 'Revenue dashboard', category: 'project', facts: ['Built a revenue dashboard'], skills: ['SQL'], technologies: ['SQL'], metrics: [], responsibilities: [], achievements: [], potentialCompetencies: ['Data analysis'], source: 'resume', covered: false, timesExplored: 0 }],
};

test('controller enforces total-question and follow-up limits', () => {
  const state = initializeSessionState(knowledge, 'technical', 'da');
  state.totalQuestionsAsked = state.maxTotalQuestions;
  assert.equal(InterviewController.isQuestionLimitReached(state), true);
  assert.equal(InterviewController.canAskCoreQuestion(state), false);
  state.totalQuestionsAsked = 1;
  state.currentFollowUpsForCore = state.maxFollowUpsPerQuestion;
  assert.equal(InterviewController.canAskFollowUp(state, true), false);
});

test('controller ends an expired interview regardless of model intent', () => {
  const state = initializeSessionState(knowledge, 'hr', 'da');
  state.startedAt = new Date(Date.now() - state.durationMinutes * 60_000 - 1).toISOString();
  assert.equal(InterviewController.isTimeExceeded(state), true);
  assert.equal(InterviewController.shouldEndInterview(state), true);
});

test('LangGraph returns a completion turn when the hard limit is reached', async () => {
  const state = initializeSessionState(knowledge, 'hr', 'da');
  state.totalQuestionsAsked = state.maxTotalQuestions;
  const result = await runInterviewGraph({ sessionState: state, lastAnswer: 'A detailed answer.', lastEvaluation: {}, nextQuestion: undefined, complete: false });
  assert.equal(result.complete, true);
  assert.equal(result.nextQuestion?.isCompleted, true);
  assert.equal(result.sessionState.isCompleted, true);
});

test('HR introduction stays focused on career story and role motivation', async () => {
  const state = initializeSessionState(knowledge, 'hr', 'aiml');
  const result = await ResumeInterviewerAgent.decideNextQuestion(state);
  assert.equal(result.nextQuestion.round, 'hr');
  assert.match(result.nextQuestion.question, /introduce yourself|career/i);
  assert.doesNotMatch(result.nextQuestion.question, /architecture|technical decision|project from your resume/i);
});

test('deterministic follow-ups include verified prior-question context and avoid vague references', () => {
  const state = initializeSessionState(knowledge, 'behavioral', 'swe');
  state.history.push({
    turnIndex: 1,
    coreQuestionIndex: 1,
    isFollowUp: false,
    answer: 'Our team delivered the dashboard successfully.',
    question: {
      question: 'Tell me about the Revenue dashboard project.', questionType: 'behavioral', round: 'behavioral',
      competency: 'Ownership', difficulty: 'Standard', source: 'resume', resumeTopic: 'Revenue dashboard',
      reason: 'Resume evidence', expectedCompetency: 'Ownership', followUp: false, evidenceUsed: ['Revenue dashboard'],
    },
  });

  const followUp = ResumeInterviewerAgent.generateFallbackQuestion(state, true, state.history[0].answer);
  assert.equal(followUp.followUp, true);
  assert.match(followUp.question, /Revenue dashboard/);
  assert.doesNotMatch(followUp.question, /that initiative|that project|what the team delivered|as you mentioned|that experience|that effort|that implementation/i);
  assert.doesNotMatch(followUp.question, /MinuteMind/i);
});

test('follow-up generation uses a fresh core question when no verified context exists', () => {
  const state = initializeSessionState(knowledge, 'behavioral', 'swe');
  const question = ResumeInterviewerAgent.generateFallbackQuestion(state, true, 'We improved the result but I cannot provide details.');
  assert.equal(question.followUp, false);
  assert.match(question.question, /Revenue dashboard/);
});

test('a short non-answer cannot receive a passing evaluation', async () => {
  const question: any = {
    id: 'rubric_test', question: 'Tell me about a time you resolved a production incident.', role: 'swe',
    competency: 'behavioral', difficulty: 'Standard', questionType: 'Behavioral',
    expectedCompetency: 'Incident ownership', evaluationCriteria: ['Context', 'Action', 'Result'],
    focus: [], durationSec: 150, expectSTAR: true,
    modelPoints: ['Explain the incident context', 'Describe your personal action', 'State a measurable result'],
    modelAnswer: '', followUps: [],
  };
  const answer = "I don't know. Nothing to say.";
  const [content, communication, star] = await Promise.all([
    ContentEvaluationAgent.execute({ question, candidateResponse: answer, candidateProfile: null }),
    CommunicationAnalysisAgent.execute({ candidateResponse: answer, mode: 'text' }),
    StarStructureAgent.execute({ candidateResponse: answer, expectSTAR: true }),
  ]);
  const coach = await InterviewCoachAgent.execute({
    candidateProfile: null,
    questionOutput: { question, expectedCompetency: question.expectedCompetency, evaluationCriteria: question.evaluationCriteria, metadata: {} } as any,
    candidateResponse: answer,
    commOutput: communication,
    contentOutput: content,
    starOutput: star,
  });

  assert.ok(content.relevance <= 30);
  assert.ok(content.completeness <= 24);
  assert.ok(star.structure_score < 30);
  assert.ok(coach.overallScore <= 25);
});

test('HR evaluation uses career-fit criteria instead of forcing STAR evidence', async () => {
  const result = await runEvaluation({
    question: {
      id: 'hr_rubric_test', type: 'hr', competency: 'Career motivation', difficulty: 'Standard', durationSec: 120,
      text: 'Please introduce yourself and explain why you are pursuing this AI/ML Engineer role.',
    },
    answer: 'I began in backend engineering, where I enjoyed turning ambiguous requirements into dependable services. My recent work with Python and data workflows made me want to build intelligent products. I am pursuing an AI/ML Engineer role because it connects that engineering foundation with the impact I want to create.',
    mode: 'text',
  });

  assert.ok(result.scores.structure >= 35, 'HR answers should be evaluated for organization, not missing STAR sections');
  assert.ok(result.scores.relevance > 40);
});

const hybridQuestion: any = {
  id: 'hybrid_test', question: 'Describe a production incident you resolved and its outcome.', role: 'swe',
  competency: 'behavioral', difficulty: 'Standard', questionType: 'Behavioral',
  expectedCompetency: 'Incident ownership', evaluationCriteria: ['Context', 'Action', 'Result'],
  focus: [], durationSec: 150, expectSTAR: true,
  modelPoints: ['Describe the incident context', 'Explain your personal action', 'State the measurable outcome'],
  modelAnswer: '', followUps: [],
};
const hybridAnswer = 'During a checkout incident, I was responsible for restoring service. I rolled back the faulty release, added a database index, and monitored recovery. The change reduced errors by 82% and restored customers within 12 minutes.';

test('semantic evaluator accepts valid LLM JSON scores', async () => {
  const scores = await evaluateSemanticallyWithLLM({
    question: hybridQuestion,
    answer: hybridAnswer,
    objectiveSignals: { words: 35, fillers: 0 },
  }, async () => ({ choices: [{ message: { content: JSON.stringify({ relevance: 91, clarity: 84, structure: 88, completeness: 86, communication: 83 }) } }] }) as any);

  assert.deepEqual(scores, { relevance: 91, clarity: 84, structure: 88, completeness: 86, communication: 83 });
});

test('semantic evaluator rejects invalid LLM JSON and invalid score sets', async () => {
  await assert.rejects(() => evaluateSemanticallyWithLLM({ question: hybridQuestion, answer: hybridAnswer, objectiveSignals: {} }, async () => ({ choices: [{ message: { content: 'not json' } }] }) as any));
  assert.equal(isValidScoreSet({ relevance: 101, clarity: 80, structure: 80, completeness: 80, communication: 80 }), false);
  assert.equal(isValidScoreSet({ relevance: 80, clarity: 80, structure: 80, completeness: 80, communication: 80 }), true);
});

test('hybrid pipeline falls back deterministically when the semantic API fails', async () => {
  const result = await MultiAgentPipeline.execute({
    question: hybridQuestion,
    answer: hybridAnswer,
    mode: 'text',
    semanticEvaluator: async () => { throw new Error('provider timeout'); },
  });

  assert.equal(result.evaluationSource, 'deterministic_fallback');
  assert.equal(result.overall, calculateOverallScore(result.scores));
});

test('pipeline reports real parallel specialist fallback states before coach synthesis', async () => {
  const events: Array<{ id: string; status: string }> = [];
  await MultiAgentPipeline.execute({
    question: hybridQuestion,
    answer: hybridAnswer,
    mode: 'text',
  }, (id, status) => events.push({ id, status }));

  const firstCoachRunning = events.findIndex((event) => event.id === 'coach' && event.status === 'running');
  assert.ok(firstCoachRunning > -1);
  for (const id of ['comm', 'content', 'star']) {
    assert.ok(events.findIndex((event) => event.id === id && event.status === 'running') > -1, `${id} starts`);
    assert.ok(events.findIndex((event) => event.id === id && event.status === 'fallback') > -1, `${id} exposes deterministic fallback`);
    assert.ok(events.findIndex((event) => event.id === id && event.status === 'fallback') < firstCoachRunning, `${id} completes before coach synthesis`);
  }
});

test('pipeline reports completed specialist states when LLM enhancement succeeds', async () => {
  const events: Array<{ id: string; status: string }> = [];
  await MultiAgentPipeline.execute({
    question: hybridQuestion,
    answer: hybridAnswer,
    mode: 'text',
    specialistEvaluator: async (_kind, _context, deterministic) => ({
      output: { ...deterministic, evaluationSource: 'llm' },
      evaluationSource: 'llm' as const,
    }),
  }, (id, status) => events.push({ id, status }));

  for (const id of ['comm', 'content', 'star']) {
    assert.ok(events.some((event) => event.id === id && event.status === 'done'), `${id} completes with LLM enhancement`);
    assert.equal(events.some((event) => event.id === id && event.status === 'fallback'), false);
  }
});

test('both hybrid paths use identical deterministic final weighting', async () => {
  const llmScores = { relevance: 90, clarity: 80, structure: 88, completeness: 84, communication: 86 };
  const result = await MultiAgentPipeline.execute({
    question: hybridQuestion,
    answer: hybridAnswer,
    mode: 'text',
    semanticEvaluator: async () => llmScores,
  });

  assert.equal(result.evaluationSource, 'llm');
  assert.deepEqual(result.scores, llmScores);
  assert.equal(result.overall, calculateOverallScore(llmScores));
});

test('session review shows no artificial weakness for a strong persisted answer', () => {
  const result = {
    scores: { relevance: 91, clarity: 86, structure: 90, completeness: 84, communication: 88 },
    metrics: { fillers: 0, hedges: 0 },
    star: { situation: { detected: true }, task: { detected: true }, action: { detected: true }, result: { detected: true } },
    improvements: [],
  };
  assert.deepEqual(deriveReviewWeaknesses(result), []);
});

test('session review aggregates only persisted weak signals into the improvement roadmap', () => {
  const weakResult = {
    scores: { relevance: 82, clarity: 80, structure: 58, completeness: 62, communication: 75 },
    metrics: { fillers: 4, hedges: 0 },
    star: {
      situation: { detected: true }, task: { detected: true }, action: { detected: true },
      result: { detected: false, evidence: 'No measurable outcome stated.' },
    },
    evidenceHighlights: [{ dimension: 'Content Rigor', coachingNote: 'Omitted key criteria: "State the measurable outcome".' }],
    improvements: ['Land every story on a quantified Result.', 'Trim filler words (4 detected).'],
  };
  const weaknesses = deriveReviewWeaknesses(weakResult);
  assert.ok(weaknesses.some((item) => item.key === 'results'));
  assert.ok(weaknesses.some((item) => item.key === 'fillers'));
  assert.ok(sessionRoadmap([{ result: weakResult }, { result: weakResult }]).some((item) => item.key === 'results' && item.count === 2));
});

test('session filters map every completed round and legacy competency without mutating records', () => {
  const sessions = [
    { id: 'hr', questionText: 'Round 1 — HR & Introduction interview', round: 'hr' },
    { id: 'behavioral', questionText: 'Round 2 — Behavioral & STAR interview', competency: 'behavioral' },
    { id: 'technical', questionText: 'Round 3 — Technical & Domain Knowledge interview', competency: 'technical' },
    { id: 'situational', questionText: 'Round 4 — Situational & Problem Solving interview', stage: 'System Design & Scenarios' },
    { id: 'leadership', questionText: 'Round 5 — Leadership & Ownership interview', round: 'leadership' },
    { id: 'communication', questionText: 'Explain a technical concept', category: 'Technical Communication' },
    { id: 'customer', questionText: 'Customer escalation', competency: 'customer' },
    { id: 'mock', questionText: 'Round 6 — Full Comprehensive Mock interview', round: 'mock' },
  ];
  const before = JSON.stringify(sessions);
  assert.deepEqual(filterSessions(sessions, 'all').map((session) => session.id), sessions.map((session) => session.id));
  assert.deepEqual(filterSessions(sessions, 'hr').map((session) => session.id), ['hr']);
  assert.deepEqual(filterSessions(sessions, 'behavioral').map((session) => session.id), ['behavioral']);
  assert.deepEqual(filterSessions(sessions, 'technical').map((session) => session.id), ['technical']);
  assert.deepEqual(filterSessions(sessions, 'problem').map((session) => session.id), ['situational']);
  assert.deepEqual(filterSessions(sessions, 'leadership').map((session) => session.id), ['leadership']);
  assert.deepEqual(filterSessions(sessions, 'tech-comm').map((session) => session.id), ['communication']);
  assert.deepEqual(filterSessions(sessions, 'customer').map((session) => session.id), ['customer']);
  assert.deepEqual(filterSessions(sessions, 'mock').map((session) => session.id), ['mock']);
  assert.equal(JSON.stringify(sessions), before);
});

test('technical completed sessions filter by their round/category and compose with search', () => {
  const technical = { id: 'technical-round', questionText: 'Round 3 — Technical & Domain Knowledge interview', round: 'technical', category: 'technical' };
  assert.equal(sessionMatchesFilter(technical, 'technical'), true);
  assert.equal(sessionMatchesFilter(technical, 'tech-comm'), false);
  assert.deepEqual(sessionFilterCategories(technical), ['technical']);
  assert.deepEqual(filterSessions([technical], 'technical', 'domain knowledge').map((session) => session.id), ['technical-round']);
  assert.deepEqual(filterSessions([technical], 'technical', 'behavioral'), []);
});

test('sessions exposes only current interview-round filters, while preserving legacy records in All', () => {
  assert.equal(SESSION_FILTERS.some((filter) => filter.id === 'tech-comm'), false);
  assert.equal(SESSION_FILTERS.some((filter) => filter.id === 'customer'), false);
  assert.deepEqual(filterSessions([{ id: 'legacy', questionText: 'Explain a technical concept', competency: 'tech-comm' }], 'all').map((session) => session.id), ['legacy']);
});

test('evidence graph never attaches global skills to unrelated education or work evidence', () => {
  const profile = createEmptyProfile();
  profile.technicalSkills = ['Python', 'PostgreSQL'];
  profile.technologies = ['Python', 'PostgreSQL'];
  profile.education = [{ institution: 'Example University', degree: 'B.Com', year: '2024' }];
  profile.workExperience = [{ company: 'Retail Co', role: 'Analyst', duration: '2023', summary: 'Prepared weekly reports.' }];
  profile.projects = [{ name: 'Inventory API', summary: 'Built an API.', technologies: ['Python'] }];
  const evidence = buildEvidenceGraph(profile);
  assert.deepEqual(evidence.find(e => e.topic === 'Example University')?.technologies, []);
  assert.deepEqual(evidence.find(e => e.topic === 'Retail Co')?.technologies, []);
  assert.deepEqual(evidence.find(e => e.topic === 'Inventory API')?.technologies, ['Python']);
});

test('technical fallback does not turn education into an architecture project', () => {
  const educationOnly: ResumeKnowledgeModel = {
    ...knowledge,
    education: [{ institution: 'Example University', degree: 'BSc Computer Science', year: '2024' }],
    evidenceGraph: [{ id: 'edu_1', topic: 'Example University', category: 'education', facts: ['Studied at Example University: BSc Computer Science (2024)'], skills: [], technologies: [], metrics: [], responsibilities: [], achievements: [], potentialCompetencies: [], source: 'resume', covered: false, timesExplored: 0 }],
  };
  const q = ResumeInterviewerAgent.generateFallbackQuestion(initializeSessionState(educationOnly, 'technical', 'swe'), false);
  assert.match(q.question, /coursework|foundation|concept/i);
  assert.doesNotMatch(q.question, /architecture|implemented|database|API/i);
});

test('grounding validator rejects an LLM question that combines a university with another project technology', () => {
  const university: any = { id: 'edu', topic: 'Example University', category: 'education', facts: ['BSc'], skills: [], technologies: [], metrics: [], responsibilities: [], achievements: [], potentialCompetencies: [], source: 'resume', covered: false, timesExplored: 0 };
  const project: any = { id: 'project', topic: 'Inventory API', category: 'project', facts: ['Built Inventory API'], skills: ['Python'], technologies: ['Python'], metrics: [], responsibilities: [], achievements: [], potentialCompetencies: [], source: 'resume', covered: false, timesExplored: 0 };
  assert.equal(isGroundedQuestion('At Example University, explain the Python architecture you designed.', university, [university, project], 'technical'), false);
  assert.equal(isGroundedQuestion('On Inventory API, what requirement led you to use Python?', project, [university, project], 'technical'), true);
});

test('adaptive follow-up uses the latest answer gap and remains self-contained', () => {
  const k: ResumeKnowledgeModel = { ...knowledge, evidenceGraph: [{ ...knowledge.evidenceGraph[0], technologies: ['Flask', 'PostgreSQL'] }] };
  const state = initializeSessionState(k, 'technical', 'swe');
  state.history.push({ turnIndex: 1, coreQuestionIndex: 1, isFollowUp: false, answer: 'I built the backend using Flask and PostgreSQL.', question: { question: 'On Revenue dashboard, how did you implement the backend?', questionType: 'technical', round: 'technical', competency: 'Implementation', difficulty: 'Standard', source: 'resume', resumeTopic: 'Revenue dashboard', reason: 'Resume evidence', expectedCompetency: 'Technical depth', followUp: false, evidenceUsed: ['Revenue dashboard'], evidenceItemId: 'project_1' } });
  const q = ResumeInterviewerAgent.generateFallbackQuestion(state, true, state.history[0].answer);
  assert.equal(q.followUp, true);
  assert.match(q.question, /Revenue dashboard.*PostgreSQL/i);
  assert.match(q.question, /requirement|trade-off/i);
  assert.doesNotMatch(q.question, /that approach|that project|as you mentioned/i);
});

test('semantic duplicate protection and intent tracking prevent repeated templates', () => {
  assert.equal(isSemanticDuplicate('On Inventory API, what requirement led you to use Python?', ['On Inventory API, what requirement led you to use Python?']), true);
  const state = initializeSessionState(knowledge, 'technical', 'swe');
  state.askedIntents = ['implementation'];
  const q = ResumeInterviewerAgent.generateFallbackQuestion(state, false);
  assert.notEqual(q.intent, 'implementation');
});

test('certifications are classified separately and technical fallback stays role-knowledge appropriate', () => {
  const profile = createEmptyProfile();
  profile.certifications = ['Cloud Fundamentals Certificate'];
  const model = extractResumeKnowledge(profile);
  assert.equal(model.evidenceGraph[0].category, 'certification');
  const q = ResumeInterviewerAgent.generateFallbackQuestion(initializeSessionState(model, 'technical', 'devops'), false);
  assert.match(q.question, /practical knowledge|apply/i);
  assert.doesNotMatch(q.question, /architecture|scalab/i);
});

test('insufficient resume evidence uses a curated round-appropriate fallback', () => {
  const empty: ResumeKnowledgeModel = { ...knowledge, evidenceGraph: [] };
  const q = ResumeInterviewerAgent.generateFallbackQuestion(initializeSessionState(empty, 'technical', 'swe'), false);
  assert.equal(q.source, 'role_standard');
  assert.equal(q.resumeTopic, 'Role-standard question');
  assert.equal(q.followUp, false);
});

test('generic technical skill clusters can never become implementation projects', () => {
  const skillsOnly: ResumeKnowledgeModel = {
    ...knowledge,
    evidenceGraph: [{ id: 'skills_tech_core', topic: 'Core Technical Stack', category: 'skill', facts: ['Primary technical capabilities: TypeScript, SQL'], skills: ['TypeScript', 'SQL'], technologies: ['TypeScript', 'SQL'], metrics: [], responsibilities: ['Technical implementation and architecture'], achievements: [], potentialCompetencies: ['Technical Depth'], source: 'resume', covered: false, timesExplored: 0 }],
  };
  const state = initializeSessionState(skillsOnly, 'technical', 'swe');
  assert.equal(chooseEvidence(state.evidenceGraph, 'technical'), undefined);
  const question = ResumeInterviewerAgent.generateFallbackQuestion(state, false);
  assert.equal(question.source, 'role_standard');
  assert.doesNotMatch(question.question, /Core Technical Stack/i);
  assert.equal(isGroundedQuestion('On Core Technical Stack, how did you evaluate performance?', skillsOnly.evidenceGraph[0], skillsOnly.evidenceGraph, 'technical'), false);
});

test('specialist semantic evaluator validates LLM JSON and retains deterministic fallback per agent', async () => {
  const deterministic: any = { clarity: 51, conciseness: 50, communication_quality: 52, filler_words: 2, hedging: 1, wpm: null, avg_sentence_len: 12, word_count: 40, confidence_score: 50, strengths: [], improvements: [], evidence: [], detailedFillersDetected: [], tone: 'Clear & Structured' };
  const success = await enhanceSpecialistWithLLM('communication', { answer: 'A clear answer.' }, deterministic, async () => ({ choices: [{ message: { content: JSON.stringify({ clarity: 82, conciseness: 76, communication_quality: 80, tone: 'Professional & Confident' }) } }] }) as any);
  assert.equal(success.evaluationSource, 'llm');
  assert.equal(success.output.clarity, 82);
  assert.equal(success.output.filler_words, 2, 'objective signal remains deterministic');
  const malformed = await enhanceSpecialistWithLLM('communication', { answer: 'A clear answer.' }, deterministic, async () => ({ choices: [{ message: { content: '{bad json' } }] }) as any);
  assert.equal(malformed.evaluationSource, 'deterministic_fallback');
  assert.equal(malformed.output.clarity, 51);
  assert.equal(malformed.fallbackReason?.code, 'invalid_json');
});

test('benchmark API rejects an unknown case instead of serializing NaN aggregates', async () => {
  const response = await runBenchmark(new Request('http://localhost/api/benchmark/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ testCaseId: 'missing-case' }),
  }) as any);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Benchmark test case was not found.' });
});

test('plan resources follow recurring persisted technical weaknesses without fabricating them', () => {
  const technical = (text: string, scores = { relevance: 55, completeness: 60, structure: 85 }) => ({ turns: [{ question: { text }, result: { scores, improvements: ['Technical depth needs more detail.'] } }] });
  assert.ok(getPlanResources([technical('Explain API backend system design.'), technical('Explain API backend system design.')]).some((item) => /FastAPI|System design/.test(item.topic)));
  assert.ok(getPlanResources([{ turns: [{ question: { text: 'Describe a conflict.' }, result: { scores: { structure: 50 } } }] }]).some((item) => /STAR/.test(item.topic)));
  assert.ok(getPlanResources([technical('Explain SQL query indexing.'), { turns: [{ question: { text: 'Describe a conflict.' }, result: { scores: { structure: 50 } } }] }]).some((item) => /SQL/.test(item.topic)));
  assert.equal(getPlanResources([{ turns: [{ question: { text: 'Explain API backend system design.' }, result: { scores: { relevance: 92, completeness: 90, structure: 90 }, improvements: [] } }] }]).some((item) => /FastAPI|System design/.test(item.topic)), false);
});

test('score trajectory preserves persisted chronological points without invalid values', () => {
  const sessions = [31, 58, 31, 70].map((overall, index) => ({ id: `s-${index}`, overall, createdAt: `2026-09-29T0${index}:00:00.000Z` }));
  assert.deepEqual(sessionProfile([sessions[1], sessions[0]]).trend.map((point) => point.score), [31, 58]);
  assert.deepEqual(sessionProfile([sessions[0], { id: 'missing', overall: Number.NaN, createdAt: '2026-09-29T03:00:00.000Z' }, ...sessions.slice(1)]).trend.map((point) => point.score), [31, 58, 31, 70]);
  assert.equal(new Set(sessionProfile(sessions.slice(0, 2)).trend.map((point) => point.date)).size, 2);
  assert.deepEqual(sessionProfile([sessions[0], { ...sessions[0], id: 'same', createdAt: '2026-09-29T00:30:00.000Z' }]).trend.map((point) => point.score), [31, 31]);
});
