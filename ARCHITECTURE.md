# Cadence — Current System Architecture

This document describes the architecture implemented in this repository as of September 2026. It is an engineering reference for the current application flow, not a future-state design.

---

## 1. Source Code Organization

Cadence uses Next.js App Router. Route files stay in `src/app`; runtime concerns are separated by responsibility.

```text
src/
├── app/                         # Next.js pages, layouts, and route handlers
│   ├── api/                     # HTTP boundary for server capabilities
│   ├── app/                     # Authenticated dashboard and practice routes
│   └── onboarding/              # Resume and profile onboarding routes
├── agents/                      # Interview and evaluation agent implementations
├── server/                      # Server-only AI client and benchmark services
│   ├── ai/
│   └── evaluation/
├── features/                    # Feature-owned frontend UI and state
│   ├── auth/
│   └── landing/
├── components/                  # Reusable frontend components
├── lib/                         # Shared domain logic, browser adapters, and storage
│   ├── dataset/
│   ├── interview/
│   ├── resume/
│   └── storage/
├── data/                        # Versioned benchmark and interview datasets
└── types/                       # Shared TypeScript contracts
```

### Dependency boundaries

- Browser UI uses feature modules, reusable components, shared domain utilities, data, and types.
- `src/app/api` is the HTTP boundary for provider-backed work.
- `src/server` owns the OpenAI-compatible client and server evaluation services.
- `src/agents` owns question selection, deterministic specialist evaluators, orchestration, and coaching contracts.
- Static datasets and shared types do not depend on UI, routes, or provider clients.

---

## 2. Product Flows

### Resume onboarding

```text
Candidate uploads PDF, DOCX, or TXT
        │
        ▼
POST /api/onboarding/resume
        │
        ├── Extract readable text
        │   ├── DOCX: Mammoth, then XML fallback
        │   └── PDF: pdfjs, PDFParse, then stream fallback
        │
        ├── Attempt AI profile structuring
        │   └── OpenAI-compatible JSON request, 7.5 s timeout, no retry
        │
        └── On failure or invalid profile: deterministic resume parser
                    │
                    ▼
             Editable candidate profile
                    │
                    ▼
            /onboarding/profile review and save
```

The deterministic parser is the reliability path. A slow or unavailable model does not block onboarding; the candidate can review and edit the generated profile either way.

### Interview question flow

```text
Candidate profile → Resume knowledge model → Resume evidence graph
                                          │
                                          ▼
                         POST /api/interviewer/next-question
                                          │
                                          ▼
                           LangGraph interview control flow
                    ┌─────────────────────┴─────────────────────┐
                    ▼                                           ▼
        Hard limit reached                              Continue interview
     (time/core/total questions)                       ResumeInterviewerAgent
                    │                                           │
                    ▼                                           ▼
             Completion turn                     Core or adaptive follow-up
```

The interview graph controls session initialization, resume-context loading, evaluation handoff, hard-limit checking, question generation, follow-up presentation, and completion. The resume interviewer tracks covered evidence topics and uses the prior evaluation to determine whether a follow-up is needed.

For browser resilience, the client calls the server route first. If the route is unavailable, the browser uses the deterministic resume-aware question fallback; it never attempts a provider call from the browser.

### Answer evaluation flow

```text
Candidate typed or transcribed response
                │
                ▼
       Browser calls POST /api/agents/evaluate
                │
                ▼
       Deterministic five-stage pipeline
       ├── Question/rubric context
       ├── Communication analysis
       ├── Content evaluation
       ├── STAR/structure analysis
       └── Coach synthesis
                │
                ▼
      Server-side semantic LLM evaluation
      (only when provider is available)
                │
        ┌───────┴────────┐
        ▼                ▼
  Valid score JSON   Timeout/error/invalid JSON
        │                │
        ▼                ▼
  evaluationSource     evaluationSource
      = "llm"       = "deterministic_fallback"
        └───────┬────────┘
                ▼
   Deterministic weighting and guardrails
                │
                ▼
        Session result and coaching report
```

The browser retains the same deterministic pipeline as a local fallback if the API route itself cannot be reached.

---

## 3. Hybrid Evaluation Architecture

Cadence evaluates the same five score dimensions on every answer:

| Metric | Meaning |
| --- | --- |
| `relevance` | Whether the answer addresses the question and competency. |
| `clarity` | Precision and understandability of the wording. |
| `structure` | Logical organization; STAR rigor when the prompt expects STAR. |
| `completeness` | Coverage, explanation depth, and supporting evidence. |
| `communication` | Professional, confident, appropriately concise delivery. |

### Deterministic signals

The existing deterministic agents always calculate objective and inspectable signals, including:

- word count and average sentence length;
- filler words and hedging phrases;
- WPM when voice telemetry is available;
- detected metrics and numeric claims;
- prompt/rubric point coverage;
- STAR component detection and result quality.

These signals support deterministic scoring and are passed to the semantic LLM as context.

### Semantic LLM layer

`src/server/evaluation/semanticEvaluator.ts` asks the configured OpenAI-compatible model for strict JSON containing the five scores. Its rubric explicitly requires low scores for non-answers, irrelevant answers, and very short answers. Responses must parse as JSON and every value must be finite and within `0–100`.

The model request uses an 8-second timeout and no retries. A provider error, timeout, empty response, malformed JSON, or invalid score set automatically retains the deterministic result.

### Final score and guardrails

Both paths use the exact same final formula in `src/lib/interview/scoring.ts`:

```text
Relevance × 0.20 + Clarity × 0.20 + Structure × 0.25
+ Completeness × 0.15 + Communication × 0.20
```

The final score is then capped by deterministic guardrails for explicit non-answers, fewer than 12 words, answers that do not address the prompt, and thin answers with insufficient rubric coverage. This prevents a fluent but irrelevant response from receiving a passing result.

Every result includes:

```ts
evaluationSource: 'llm' | 'deterministic_fallback'
```

The field is retained with the completed turn when a session is saved.

---

## 4. Agents and Orchestration

### Resume interviewer

`ResumeInterviewerAgent` builds resume-grounded core questions and targeted follow-ups. It uses the active round, role, difficulty, evidence graph, topic history, answer length, ownership language, metrics, and previous STAR result to select the next turn.

HR questions are controlled by an HR-specific template so technical resume content does not turn the introduction into an architecture interview.

### Deterministic evaluation specialists

The active product pipeline runs these stages sequentially:

1. `InterviewQuestionAgent` — establishes question/rubric context from the dataset.
2. `CommunicationAnalysisAgent` — delivery, fillers, hedges, cadence, WPM, and confidence language.
3. `ContentEvaluationAgent` — relevance, completeness, rubric coverage, metrics, and evidence.
4. `StarStructureAgent` — Situation, Task, Action, Result, signposting, and structural score.
5. `InterviewCoachAgent` — deterministic synthesis, coaching advice, follow-ups, and the fallback score.

The legacy `orchestrator` contains a separate parallel specialist implementation for the legacy evaluation API contract. It is not the primary hybrid product evaluation path described above.

### Agent-to-agent trace

The pipeline records in-process A2A trace messages, not network messages. Each record contains:

```ts
{
  from: string;
  to: string;
  payload: Record<string, unknown>;
  timestamp: string; // ISO-8601
  status: 'processed';
  latencyMs?: number;
}
```

The trace is available in the Agents Explorer and in the A2A tab for an evaluated practice response.

---

## 5. Interview Rounds and Hard Limits

Question and time limits are enforced before model generation. A model cannot extend a round beyond its configured budget.

| Round | Core questions | Max follow-ups per core | Max total questions | Duration |
| --- | ---: | ---: | ---: | --- |
| HR & Introduction | 3 | 1 | 5 | 15 min |
| Behavioral & STAR | 5 | 1 | 6 | 25 min |
| Technical & Domain Knowledge | 6 | 1 | 8 | 30 min |
| Situational & Problem Solving | 5 | 1 | 7 | 25 min |
| Leadership & Ownership | 4 | 1 | 6 | 20 min |
| Full Comprehensive Mock | 6 | 1 | 9 | 30 min |

The mock round is a six-core-question end-to-end practice round. It is not a fixed 15-question rotation.

---

## 6. Data and Persistence

### Candidate profile and evidence

The resume parser normalizes profile information into experience, education, projects, skills, technologies, certifications, achievements, and domains. `extractResumeKnowledge` converts it into a resume knowledge model and evidence graph for question grounding.

### Datasets

`DatasetManager` selects structured questions using role, competency, difficulty, and question type. A structured question includes the prompt, target role, competency, expected competency, evaluation criteria, expected STAR behavior, model points, and follow-ups.

### Browser persistence

Candidate profile, onboarding state, drafts, and session history are stored in browser storage. Completed sessions are scoped by user ID where available, limited to the most recent 60 records, and used to calculate trends, streaks, recurring gaps, and improvement plans.

`/api/onboarding/profile` also provides a lightweight in-memory server profile for the active server process; it is not durable database storage.

---

## 7. HTTP API Surface

| Route | Purpose |
| --- | --- |
| `POST /api/onboarding/resume` | Extract text and generate a normalized candidate profile. |
| `GET` / `PUT /api/onboarding/profile` | Retrieve or update the active in-memory server profile. |
| `POST /api/interviewer/next-question` | Advance a resume-interview session through the LangGraph controller. |
| `POST /api/agents/evaluate` | Run hybrid evaluation; legacy payloads use the legacy orchestrator contract. |
| `POST /api/agents/generate-question` | Generate/select a question through the legacy question-agent contract. |
| `POST /api/benchmark/run` | Run one or all benchmark test cases. |
| `POST /api/llm/chat` | OpenAI-compatible chat proxy, including optional streaming. |

---

## 8. Configuration and Reliability

Server-side provider configuration is read from environment variables:

```text
OPENAI_API_KEY
OPENAI_BASE_URL        # optional OpenAI-compatible endpoint
OPENAI_MODEL           # optional; defaults to openai/gpt-5-nano
LANGSMITH_TRACING      # optional tracing switch
LANGSMITH_API_KEY      # optional tracing credential
LANGSMITH_PROJECT      # optional tracing project
LANGSMITH_ENDPOINT     # optional tracing endpoint
```

Provider credentials are never required in browser code. Provider-backed work always has a deterministic recovery path for resume parsing, question fallback, or answer evaluation.

---

## 9. Verification

The automated test suite covers:

- interview duration and question limits;
- HR question focus;
- weak-answer guardrails;
- HR-specific evaluation criteria;
- valid semantic LLM score handling;
- invalid LLM JSON and score validation;
- semantic provider failure fallback;
- identical deterministic weighting for LLM and fallback score paths.

Run:

```bash
npm test
npm run build
```
