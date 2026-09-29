import { getOpenAIClient } from '@/server/ai/llmClient';
import { CandidateProfile, InterviewQuestion, StageType } from '@/types/interview';
import { INITIAL_INTERVIEW_DATASET } from '@/data/interviewDataset';

export async function selectOrGenerateQuestion(
  profile: CandidateProfile,
  stage: StageType,
  userApiKey?: string,
  forceDynamicGeneration = false
): Promise<InterviewQuestion> {
  // If not forcing dynamic generation, find the best match from the curated dataset
  if (!forceDynamicGeneration) {
    const candidates = INITIAL_INTERVIEW_DATASET.filter(
      q => q.stage === stage && (q.role === profile.targetRole || q.stage === 'HR & Culture Screening')
    );
    if (candidates.length > 0) {
      // Pick one randomly or first
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // Secondary fallback in dataset
    const stageCandidates = INITIAL_INTERVIEW_DATASET.filter(q => q.stage === stage);
    if (stageCandidates.length > 0) {
      return stageCandidates[Math.floor(Math.random() * stageCandidates.length)];
    }
  }

  // Dynamic Generation via OpenAI (or smart fallback)
  const effectiveApiKey = userApiKey || process.env.OPENAI_API_KEY || '';
  const effectiveBaseUrl = process.env.OPENAI_BASE_URL || 'https://aicredits.in/v1';
  const effectiveModel = process.env.OPENAI_MODEL || 'openai/gpt-5-nano';

  if (!effectiveApiKey) {
    // This legacy entry point only receives a flat skill profile, not resume
    // evidence. It must therefore never imply a skill belonged to a project,
    // employer, or production system.
    const skill = profile.keySkills[0] || 'a core technical skill';
    return {
      id: `dyn-${Date.now()}`,
      role: profile.targetRole,
      stage,
      competency: `${skill} Technical Depth`,
      difficulty: profile.experienceYears >= 5 ? 'Senior' : 'Mid-Level',
      questionType: stage === 'Behavioral & STAR Competency' ? 'Behavioral' : 'Technical',
      question: `Choose one problem you have personally solved using ${skill}. What did you implement, and how did you verify the result?`,
      expectedCompetencies: [
        'Accurate technical explanation', 'Personal ownership', 'Evidence-based result'
      ],
      evaluationCriteria: [
        'Does not assume an unsupported employer or project', 'Explains concrete implementation choices', 'Articulates clear personal contribution'
      ],
      idealStarResponse: `I would first name a real example where I used ${skill}, explain my own implementation choices, and describe the evidence I used to judge the outcome.`
    };
  }

  try {
    const openai = getOpenAIClient(effectiveApiKey, effectiveBaseUrl);
    const prompt = `You are the Interview Question Agent for an executive technical coaching platform.
Generate a tailored interview question for this candidate profile:
Role: ${profile.targetRole}
Experience: ${profile.experienceYears} years
Listed skills (these are not evidence of use at a particular employer or project): ${profile.keySkills.join(', ')}
Target Interview Stage: ${stage}

Return ONLY valid JSON matching this structure:
{
  "id": "dyn-${Date.now()}",
  "role": "${profile.targetRole}",
  "stage": "${stage}",
  "competency": "Specific Technical or Behavioral Competency",
  "difficulty": "Mid-Level",
  "questionType": "Technical",
  "question": "A self-contained question that asks the candidate to choose a real example; do not invent or attribute a project, employer, metric, architecture, or technology relationship",
  "expectedCompetencies": ["comp 1", "comp 2", "comp 3"],
  "evaluationCriteria": ["crit 1", "crit 2", "crit 3"],
  "idealStarResponse": "A 3-sentence model answer"
}`;

    const res = await openai.chat.completions.create({
      model: effectiveModel,
      messages: [{ role: 'system', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    const parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
    const question = String(parsed.question || '');
    const unsafe = /\b(your (project|company|team|production|architecture)|you (built|deployed|designed))\b/i.test(question) && !/choose|personally|real example/i.test(question);
    if (unsafe || !question) {
      const skill = profile.keySkills[0] || 'a core technical skill';
      return {
        id: `dyn-${Date.now()}`, role: profile.targetRole, stage,
        competency: `${skill} Technical Depth`, difficulty: profile.experienceYears >= 5 ? 'Senior' : 'Mid-Level',
        questionType: stage === 'Behavioral & STAR Competency' ? 'Behavioral' : 'Technical',
        question: `Choose one problem you have personally solved using ${skill}. What did you implement, and how did you verify the result?`,
        expectedCompetencies: ['Accurate technical explanation', 'Personal ownership'],
        evaluationCriteria: ['Grounded example', 'Concrete implementation choices'],
        idealStarResponse: undefined,
      };
    }
    return {
      id: parsed.id || `dyn-${Date.now()}`,
      role: parsed.role || profile.targetRole,
      stage: parsed.stage || stage,
      competency: parsed.competency || 'Core Engineering Competency',
      difficulty: parsed.difficulty || 'Mid-Level',
      questionType: parsed.questionType || 'Technical',
      question,
      expectedCompetencies: parsed.expectedCompetencies || ['Technical depth', 'Problem solving'],
      evaluationCriteria: parsed.evaluationCriteria || ['Clarity', 'Depth'],
      idealStarResponse: parsed.idealStarResponse
    };
  } catch (err) {
    console.error('Dynamic question generation error, falling back:', err);
    return INITIAL_INTERVIEW_DATASET[0];
  }
}
