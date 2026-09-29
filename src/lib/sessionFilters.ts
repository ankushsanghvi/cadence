export type SessionFilterId = 'all' | 'hr' | 'behavioral' | 'technical' | 'problem' | 'leadership' | 'tech-comm' | 'customer' | 'mock';

export const SESSION_FILTERS: Array<{ id: SessionFilterId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'hr', label: 'HR & Introduction' },
  { id: 'behavioral', label: 'Behavioral' },
  { id: 'technical', label: 'Technical & Domain' },
  { id: 'problem', label: 'Problem Solving' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'mock', label: 'Full Mock' },
];

const ROUND_CATEGORY: Record<string, SessionFilterId> = {
  hr: 'hr', behavioral: 'behavioral', technical: 'technical', situational: 'problem', leadership: 'leadership', mock: 'mock',
};

const NORMALIZED_CATEGORY: Record<string, SessionFilterId> = {
  hr: 'hr', 'hr & introduction': 'hr', 'hr & culture screening': 'hr',
  behavioral: 'behavioral', 'behavioral & star': 'behavioral', 'behavioral & star competency': 'behavioral',
  technical: 'technical', 'technical & domain': 'technical', 'technical & domain knowledge': 'technical', 'technical & domain depth': 'technical',
  situational: 'problem', 'situational & problem solving': 'problem', 'system design & scenarios': 'problem', 'problem solving': 'problem',
  leadership: 'leadership', 'leadership & ownership': 'leadership', 'executive & client communication': 'leadership',
  'tech-comm': 'tech-comm', 'technical communication': 'tech-comm',
  customer: 'customer', 'customer obsession': 'customer',
  mock: 'mock', 'full comprehensive mock': 'mock',
};

const QUESTION_TYPE_CATEGORY: Record<string, SessionFilterId> = {
  hr: 'hr', 'hr / cultural fit': 'hr', behavioral: 'behavioral', technical: 'technical', 'scenario-based': 'problem', situational: 'problem', leadership: 'leadership',
};

function normalized(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function categoryFor(value: unknown, source: Record<string, SessionFilterId>) {
  const key = normalized(value);
  return source[key];
}

/**
 * Resolves an existing or new session without mutating it. Round metadata has
 * precedence over a question's incidental competency because a completed
 * round may include adaptive follow-ups with different question labels.
 */
export function sessionFilterCategories(session: any): SessionFilterId[] {
  const categories = new Set<SessionFilterId>();
  const add = (value?: SessionFilterId) => value && categories.add(value);

  add(categoryFor(session?.category, NORMALIZED_CATEGORY));
  add(categoryFor(session?.sessionCategory, NORMALIZED_CATEGORY));
  add(categoryFor(session?.round, ROUND_CATEGORY));
  add(categoryFor(session?.competency, NORMALIZED_CATEGORY));
  add(categoryFor(session?.stage, NORMALIZED_CATEGORY));

  // Historical one-question records often lack round metadata. Only then use
  // their interview type as a fallback; full rounds are classified by round.
  if (categories.size === 0) {
    add(categoryFor(session?.interviewType, QUESTION_TYPE_CATEGORY));
    add(categoryFor(session?.type, QUESTION_TYPE_CATEGORY));
    const firstQuestion = Array.isArray(session?.turns) ? session.turns[0]?.question : undefined;
    add(categoryFor(firstQuestion?.questionType || firstQuestion?.type, QUESTION_TYPE_CATEGORY));
  }
  return [...categories];
}

export function sessionMatchesFilter(session: any, filter: SessionFilterId) {
  return filter === 'all' || sessionFilterCategories(session).includes(filter);
}

export function filterSessions(sessions: any[], filter: SessionFilterId, query = '') {
  const search = query.trim().toLowerCase();
  return sessions.filter((session) => sessionMatchesFilter(session, filter) && (!search || String(session?.questionText || '').toLowerCase().includes(search)));
}

export function sessionCategoryForRound(round: string): SessionFilterId | undefined {
  return ROUND_CATEGORY[normalized(round)];
}
