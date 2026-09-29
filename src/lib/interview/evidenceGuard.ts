import type { ResumeEvidenceItem, InterviewRoundKey } from '@/lib/resume/resumeKnowledge';

export type QuestionIntent =
  | 'implementation' | 'debugging' | 'design_decision' | 'trade_off'
  | 'scalability' | 'performance' | 'failure_handling' | 'technical_depth'
  | 'ownership' | 'collaboration' | 'measurable_impact' | 'lessons_learned'
  | 'role_knowledge' | 'career_story' | 'academic_foundation';

const concreteCategories = new Set(['project', 'experience', 'venture']);
const architectureIntents = new Set<QuestionIntent>(['implementation', 'design_decision', 'trade_off', 'scalability', 'performance', 'failure_handling', 'technical_depth']);

/** Generic skill clusters describe capability, not an actual system or experience. */
export function isQuestionableEvidence(item?: ResumeEvidenceItem): boolean {
  if (!item) return false;
  return concreteCategories.has(item.category) &&
    item.topic.trim().length > 2 &&
    !/^(core )?(technical )?(stack|skills?|technologies|experience|education|projects?)$/i.test(item.topic.trim());
}

export function isTechnicalEvidence(item?: ResumeEvidenceItem): boolean {
  return !!item && isQuestionableEvidence(item) &&
    (item.technologies.length > 0 || item.facts.some(f => /\b(built|implemented|developed|designed|debugged|deployed|api|database|model|pipeline|system)\b/i.test(f)));
}

export function allowedIntents(round: InterviewRoundKey, item?: ResumeEvidenceItem): QuestionIntent[] {
  if (round === 'hr') return ['career_story', 'role_knowledge'];
  if (item?.category === 'education') return ['academic_foundation', 'lessons_learned'];
  if (item?.category === 'certification' || item?.category === 'achievement') return ['role_knowledge', 'lessons_learned'];
  if (round === 'technical') return isTechnicalEvidence(item)
    ? ['implementation', 'debugging', 'design_decision', 'trade_off', 'scalability', 'performance', 'failure_handling', 'technical_depth']
    : ['role_knowledge'];
  if (round === 'behavioral') return ['ownership', 'collaboration', 'measurable_impact', 'lessons_learned'];
  if (round === 'leadership') return ['ownership', 'collaboration', 'design_decision', 'measurable_impact'];
  return ['debugging', 'failure_handling', 'trade_off', 'role_knowledge'];
}

export function chooseEvidence(items: ResumeEvidenceItem[], round: InterviewRoundKey, excludedIds: string[] = []): ResumeEvidenceItem | undefined {
  const uncovered = items.filter(item => !item.covered && !excludedIds.includes(item.id));
  const candidates = uncovered.length ? uncovered : items.filter(item => !excludedIds.includes(item.id));
  if (!candidates.length) return undefined;
  if (round === 'technical') return candidates.find(isTechnicalEvidence) || candidates.find(i => ['education', 'certification', 'achievement'].includes(i.category));
  if (round === 'behavioral' || round === 'leadership' || round === 'situational') return candidates.find(isQuestionableEvidence);
  return candidates.find(isQuestionableEvidence) || candidates.find(i => ['education', 'certification', 'achievement'].includes(i.category));
}

export function normalizedQuestion(text: string): Set<string> {
  const stop = new Set(['the', 'and', 'with', 'your', 'about', 'what', 'were', 'that', 'this', 'from', 'have', 'tell', 'walk', 'through', 'would', 'could', 'when', 'into']);
  return new Set((text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => w.length > 2 && !stop.has(w)));
}

export function isSemanticDuplicate(question: string, previousQuestions: string[]): boolean {
  const current = normalizedQuestion(question);
  return previousQuestions.some(previous => {
    const before = normalizedQuestion(previous);
    const shared = [...current].filter(word => before.has(word)).length;
    return shared >= 4 && shared / Math.max(1, Math.min(current.size, before.size)) >= 0.6;
  });
}

/** Rejects a model question that attributes an unrelated resume item or technology to the selected item. */
export function isGroundedQuestion(question: string, item: ResumeEvidenceItem | undefined, allItems: ResumeEvidenceItem[], round: InterviewRoundKey): boolean {
  if (!item || !question.trim() || isVagueReference(question)) return false;
  if (item.category === 'skill' || /^(core )?(technical )?(stack|skills?|technologies)$/i.test(item.topic.trim())) return false;
  if (round === 'technical' && !isTechnicalEvidence(item) && /\b(architecture|implement|database|api|scalab|performance|deploy|debug)\b/i.test(question)) return false;
  const lower = question.toLowerCase();
  const allowedTechnology = new Set([...item.technologies, ...item.skills].map(v => v.toLowerCase()));
  for (const other of allItems) {
    if (other.id === item.id) continue;
    if (other.topic.length > 2 && lower.includes(other.topic.toLowerCase())) return false;
    for (const tech of [...other.technologies, ...other.skills]) {
      if (tech.length > 2 && lower.includes(tech.toLowerCase()) && !allowedTechnology.has(tech.toLowerCase())) return false;
    }
  }
  return true;
}

export function isVagueReference(question: string): boolean {
  return /\b(that initiative|that project|what the team delivered|as you mentioned|that experience|that effort|that implementation|that approach)\b/i.test(question);
}

export function followUpGap(answer: string): QuestionIntent | null {
  if (/\b(reduced|improved|increased|saved|faster|slower|significant|scaled)\b/i.test(answer) && !/\b\d+(?:\.\d+)?(?:%|ms|s|x)?\b/i.test(answer)) return 'measurable_impact';
  if (/\b(we|our team)\b/i.test(answer) && !/\b(i |i\'|my |personally)\b/i.test(answer)) return 'ownership';
  if (/\b(built|implemented|used|created|designed)\b/i.test(answer) && !/\b(because|trade-?off|instead|reason|why)\b/i.test(answer)) return 'design_decision';
  if (answer.trim().split(/\s+/).length < 40) return 'technical_depth';
  return null;
}

export function isArchitectureIntent(intent: QuestionIntent): boolean { return architectureIntents.has(intent); }
