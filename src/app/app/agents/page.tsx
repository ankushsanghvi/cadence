'use client';

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, Mic, FileText, Layers, Sparkles, Play, Loader2, ChevronDown, GitBranch, CheckCircle2, ShieldCheck, BarChart3, Database } from "lucide-react";
import { AGENTS } from "@/lib/mockData";
import { runEvaluation } from "@/lib/coachEngine";
import AgentStepper from "@/components/AgentStepper";
import { Reveal } from "@/components/ui-bits";
import { BENCHMARK_TEST_CASES } from "@/data/benchmarkDataset";

const ICONS: Record<string, any> = { question: HelpCircle, comm: Mic, content: FileText, star: Layers, coach: Sparkles };

const AGENT_SCHEMAS: Record<string, {
  purpose: string;
  inputSchema: string;
  outputSchema: string;
  tools: string[];
}> = {
  question: {
    purpose: "Analyzes candidate profile, target role, and past questions to select or generate a tailored question with rubrics.",
    inputSchema: `{
  "candidateProfile": { "name": string, "skills": string[], "projects": string[] },
  "targetRole": "swe" | "sse" | "em" | "pm" | "da" | "cs",
  "competency": "behavioral" | "tech-comm" | "problem" | "leadership",
  "difficulty": "Warm-up" | "Standard" | "Senior"
}`,
    outputSchema: `{
  "question": { "id": string, "question": string, "durationSec": number },
  "expectedCompetency": string,
  "evaluationCriteria": string[],
  "metadata": { "tailoredToProfile": boolean, "matchingSignals": string[] }
}`,
    tools: ["RecruitView Dataset Indexer", "Profile Alignment Scorer", "Previous Question Deduplicator"]
  },
  comm: {
    purpose: "Performs acoustic and linguistic diagnostics on speech clarity, filler crutches, hedging, and pacing.",
    inputSchema: `{
  "candidateResponse": string,
  "mode": "voice" | "text",
  "wpm": number | null
}`,
    outputSchema: `{
  "clarity": number, // 0-100
  "conciseness": number, // 0-100
  "communication_quality": number, // 0-100
  "filler_words": number,
  "hedging": number,
  "tone": string,
  "evidence": Array<{ "type": string, "text": string, "critique": string }>
}`,
    tools: ["Acoustic WPM Telemetry", "Regex Filler Extractor", "Hedging Pattern Detector", "Sentence Cadence Analyzer"]
  },
  content: {
    purpose: "Verifies technical depth, relevance to the exact prompt, domain rigor, and quantitative claim verification.",
    inputSchema: `{
  "question": StructuredQuestion,
  "candidateResponse": string,
  "candidateProfile": CandidateProfile
}`,
    outputSchema: `{
  "relevance": number, // 0-100
  "completeness": number, // 0-100
  "competency_match": number, // 0-100
  "answered_prompt": boolean,
  "metrics_cited": string[],
  "evidence": Array<{ "claim": string, "verified": boolean, "detail": string }>
}`,
    tools: ["Prompt Keyword Overlap Matrix", "Numerical Metric Verifier", "Rubric Checklist Comparator"]
  },
  star: {
    purpose: "Deconstructs the narrative into Situation, Task, Action, and Result components with verbatim quoted evidence.",
    inputSchema: `{
  "candidateResponse": string,
  "expectSTAR": boolean
}`,
    outputSchema: `{
  "structure_score": number, // 0-100
  "starFilled": number, // 0-4
  "situation": { "status": "strong" | "detected" | "weak" | "missing", "evidence": string },
  "task": { "status": "strong" | "detected" | "weak" | "missing", "evidence": string },
  "action": { "status": "strong" | "detected" | "weak" | "missing", "evidence": string },
  "result": { "status": "strong" | "detected" | "weak" | "missing", "evidence": string }
}`,
    tools: ["STAR Sentence Classifier", "Verbatim Span Extractor", "Signposting Connector Detector"]
  },
  coach: {
    purpose: "Consolidates specialist findings into a cohesive score, model answer rewrite, and adaptive follow-ups.",
    inputSchema: `{
  "questionOutput": QuestionAgentOutput,
  "commOutput": CommunicationAgentOutput,
  "contentOutput": ContentAgentOutput,
  "starOutput": StarAgentOutput
}`,
    outputSchema: `{
  "overallScore": number, // 0-100
  "verdict": string,
  "dimensionScores": { "relevance": number, "clarity": number, "structure": number, "completeness": number, "communication": number },
  "improvedAnswer": string,
  "followUpQuestions": string[]
}`,
    tools: ["Holistic Rubric Synthesizer", "Response-Dependent Follow-Up Generator", "Model Answer Rewrite Engine"]
  }
};

const SAMPLE = {
  question: {
    id: "swe-beh-01",
    question: "Describe a challenging situation where you had a strong technical disagreement with a team member or architect. How did you resolve it?",
    role: "sse",
    competency: "behavioral",
    difficulty: "Standard",
    type: "Behavioral",
    durationSec: 150,
    expectSTAR: true,
    modelPoints: ["State architectural dispute", "Empirical benchmark data", "Quantified production outcome"]
  },
  answer:
    "When I joined, our order pipeline was dropping 2% of payments at peak. A senior architect favored maintaining legacy polling, but I proposed Server-Sent Events. To resolve the disagreement with data rather than opinions, I built a 2-day proof of concept benchmark measuring socket throughput under 10k connections. The benchmark showed SSE reduced server CPU by 58%. I scheduled a review, presented the data, and addressed his reconnect concerns. We shipped on schedule and eliminated $1,200/month in idle cloud costs.",
  mode: "text",
};

export default function AgentsExplorer() {
  const [open, setOpen] = useState<string | null>("coach");
  const [stages, setStages] = useState<any>({});
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'topology' | 'benchmark'>('topology');

  // Benchmark state
  const [benchRunning, setBenchRunning] = useState(false);
  const [benchResults, setBenchResults] = useState<any[]>([]);

  const run = async () => {
    if (running) return;
    setRunning(true);
    setStages({});
    setLog([]);
    const res = await runEvaluation(SAMPLE, (id: string, status: string, out: any) => {
      setStages((s: any) => ({ ...s, [id]: { status, out } }));
    });
    if (res && res.a2aMessages) {
      setLog(res.a2aMessages);
    }
    setRunning(false);
  };

  const runBenchmark = async () => {
    if (benchRunning) return;
    setBenchRunning(true);
    const results: any[] = [];
    try {
      for (const testCase of BENCHMARK_TEST_CASES) {
        const response = await fetch('/api/benchmark/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testCaseId: testCase.id }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Benchmark request failed');
        results.push(payload.results[0]);
        setBenchResults([...results]);
      }
    } finally {
      setBenchRunning(false);
    }
  };

  return (
    <div className="space-y-10" data-testid="agents-explorer-page">
      <Reveal>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Multi-Agent Architecture</p>
            <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">Inside the pipeline.</h1>
          </div>
          <div className="flex gap-2 p-1 rounded-2xl border border-line bg-cream/50">
            <button
              onClick={() => setActiveTab('topology')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'topology' ? 'bg-white text-ink shadow-lift' : 'text-ink2 hover:text-terra'
              }`}
            >
              A2A Topology & Debugger
            </button>
            <button
              onClick={() => setActiveTab('benchmark')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'benchmark' ? 'bg-white text-ink shadow-lift' : 'text-ink2 hover:text-terra'
              }`}
            >
              LLM-as-a-Judge Benchmark
            </button>
          </div>
        </div>
      </Reveal>

      {activeTab === 'topology' ? (
        <>
          <Reveal delay={0.05}>
            <div className="card overflow-hidden p-7" data-testid="a2a-topology">
              <div className="flex items-center justify-between mb-6">
                <p className="eyebrow">A2A topology · handoffs left to right</p>
                <span className="chip !border-sagesoft !bg-sagesoft !text-sage font-mono !text-[10px]">
                  <ShieldCheck className="h-3 w-3" /> Observable Contracts Active
                </span>
              </div>
              <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
                {[
                  { id: "candidate", label: "Candidate", sub: "response + profile", node: false },
                  ...AGENTS.map((a) => ({ id: a.id, label: a.short, sub: a.tag, node: true })),
                  { id: "out", label: "Feedback", sub: "verdict + plan", node: false },
                ].map((n, i, arr) => (
                  <div key={n.id} className="flex flex-1 items-center gap-3 md:flex-col md:gap-0">
                    <div
                      className={`flex-1 md:w-full rounded-2xl border p-4 text-center transition-all ${
                        n.node ? "border-line bg-white shadow-xs" : "border-dashed border-line2 bg-cream/60"
                      }`}
                      data-testid={`topology-node-${n.id}`}
                    >
                      <p className={`text-xs font-semibold ${n.node ? "text-ink" : "text-mut"}`}>{n.label}</p>
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-mut">{n.sub}</p>
                    </div>
                    {i < arr.length - 1 && (
                      <span className="hidden h-px w-6 shrink-0 bg-line2 md:block" />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-cream/70 p-4">
                <GitBranch className="h-4 w-4 shrink-0 text-terra" />
                <p className="text-xs leading-relaxed text-ink2">
                  <strong>Question Agent</strong> sets expected competencies. <strong>Communication</strong>, <strong>Content</strong>, and <strong>STAR</strong> agents evaluate the candidate response independently; the <strong>Coach Agent</strong> consolidates all findings into evidence-grounded feedback and response-dependent follow-up questions.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Agent Inspector */}
              <div className="space-y-3 lg:col-span-5" data-testid="agent-inspector-list">
                <p className="eyebrow mb-2">Specialist Agent Inspector ({AGENTS.length} Agents)</p>
                {AGENTS.map((a) => {
                  const Icon = ICONS[a.id] || HelpCircle;
                  const isOpen = open === a.id;
                  const schema = AGENT_SCHEMAS[a.id];
                  return (
                    <div key={a.id} className={`card overflow-hidden transition-all ${isOpen ? "border-terra/60 shadow-lift" : ""}`} data-testid={`inspector-${a.id}`}>
                      <button onClick={() => setOpen(isOpen ? null : a.id)} className="flex w-full items-center gap-4 p-5 text-left cursor-pointer">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isOpen ? "bg-terra text-white" : "bg-cream text-ink2"}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{a.name}</span>
                          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-mut">{a.tag}</span>
                        </span>
                        <ChevronDown className={`h-4 w-4 text-mut transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-line">
                            <div className="p-5 space-y-4">
                              <p className="text-xs leading-relaxed text-ink2">{schema?.purpose || a.desc}</p>

                              {schema?.tools && (
                                <div>
                                  <p className="font-mono text-[9px] uppercase tracking-wider text-mut mb-1.5 font-bold">Tools &amp; Heuristics</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {schema.tools.map(t => (
                                      <span key={t} className="chip !text-[10px] font-mono">{t}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div>
                                <p className="font-mono text-[9px] uppercase tracking-wider text-mut mb-1.5 font-bold">Input Schema</p>
                                <pre className="p-3 rounded-xl bg-coal text-[9px] font-mono text-paper/80 overflow-x-auto">{schema?.inputSchema}</pre>
                              </div>

                              <div>
                                <p className="font-mono text-[9px] uppercase tracking-wider text-mut mb-1.5 font-bold">Output Schema</p>
                                <pre className="p-3 rounded-xl bg-coal text-[9px] font-mono text-paper/80 overflow-x-auto">{schema?.outputSchema}</pre>
                              </div>

                              <div className="rounded-xl bg-coal p-4">
                                <p className="eyebrow mb-2 !text-coal3">System prompt</p>
                                <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-paper/75">{a.prompt}</pre>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* Pipeline Debugger */}
              <div className="lg:col-span-7">
                <div className="card sticky top-24 p-7" data-testid="pipeline-debugger">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-xl text-ink">Live Pipeline Debugger</h2>
                      <p className="text-xs text-mut">Execute sample response through all 5 specialist agents</p>
                    </div>
                    <button onClick={run} disabled={running} data-testid="debugger-run-btn" className="btn-terra !px-4 !py-2 !text-xs disabled:opacity-50 cursor-pointer">
                      {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                      {running ? "Running Pipeline" : "Run Sample"}
                    </button>
                  </div>

                  <div className="mt-6 rounded-2xl border border-line bg-cream/40 p-5">
                    <AgentStepper dark stages={stages} agents={AGENTS} testPrefix="debugger" />
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="eyebrow">Observable A2A Message Payloads ({log.length})</p>
                      {log.length > 0 && (
                        <span className="font-mono text-[9px] text-sage flex items-center gap-1 font-bold">
                          <CheckCircle2 className="h-3 w-3" /> All contracts satisfied
                        </span>
                      )}
                    </div>
                    {log.length > 0 ? (
                      <div className="max-h-80 space-y-2 overflow-y-auto rounded-2xl bg-coal p-5 font-mono text-[10px] leading-relaxed" data-testid="a2a-message-log">
                        <AnimatePresence>
                          {log.map((m, i) => (
                            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="p-2.5 rounded-lg bg-coal2 border border-coaline">
                              <div className="flex items-center justify-between text-[#81A1C1] text-[9px] mb-1">
                                <span>{m.from} → {m.to}</span>
                                <span className="text-paper/40">{m.latencyMs ? `${m.latencyMs}ms` : 'instant'}</span>
                              </div>
                              <pre className="text-paper/75 whitespace-pre-wrap overflow-x-auto text-[9px]">{JSON.stringify(m.payload, null, 2)}</pre>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <div className="p-8 text-center rounded-2xl border border-dashed border-line bg-cream/30 text-xs text-mut">
                        Click "Run Sample" to dispatch the 5-agent execution pipeline and view real-time A2A message payloads.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </>
      ) : (
        /* Evaluation & Benchmark Suite Tab */
        <Reveal delay={0.05}>
          <div className="card p-7 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="eyebrow">LLM-as-a-Judge Evaluation Suite (Task 4)</p>
                <h2 className="font-display text-2xl text-ink mt-1">Coaching Rubric &amp; Evidence Benchmark</h2>
                <p className="text-xs text-mut mt-1">
                  Empirical test harness measuring question relevance, response analysis quality, feedback consistency, and evidence groundedness across standard test cases.
                </p>
              </div>
              <button
                onClick={runBenchmark}
                disabled={benchRunning}
                className="btn-terra !px-5 !py-2.5 !text-xs disabled:opacity-50 cursor-pointer"
              >
                {benchRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
                {benchRunning ? "Running 5 Test Cases..." : "Run Benchmark Suite"}
              </button>
            </div>

            {benchResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-cream/50 border border-line">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-mut font-bold">Avg Relevance</p>
                  <p className="font-mono text-2xl font-bold text-ink mt-1">
                    {Math.round(benchResults.reduce((a, b) => a + b.questionRelevanceScore, 0) / benchResults.length)}%
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-mut font-bold">Evidence Groundedness</p>
                  <p className="font-mono text-2xl font-bold text-terra mt-1">
                    {Math.round(benchResults.reduce((a, b) => a + b.evidenceGroundednessScore, 0) / benchResults.length)}%
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-mut font-bold">Feedback Consistency</p>
                  <p className="font-mono text-2xl font-bold text-sage mt-1">
                    {Math.round(benchResults.reduce((a, b) => a + b.feedbackConsistencyScore, 0) / benchResults.length)}%
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-mut font-bold">Suggestion Usefulness</p>
                  <p className="font-mono text-2xl font-bold text-ink mt-1">
                    {Math.round(benchResults.reduce((a, b) => a + b.suggestionUsefulnessScore, 0) / benchResults.length)}%
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <p className="eyebrow">Standardized Benchmark Cases ({BENCHMARK_TEST_CASES.length})</p>
              {BENCHMARK_TEST_CASES.map((tc, idx) => {
                const res = benchResults.find(b => b.testCaseId === tc.id);
                return (
                  <div key={tc.id} className="p-5 rounded-2xl border border-line bg-white/70 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-mut font-bold block">Case 0{idx + 1}</span>
                        <h4 className="text-sm font-bold text-ink mt-0.5">{tc.title}</h4>
                      </div>
                      {res ? (
                        <div className="flex gap-2">
                          <span className="chip !border-sagesoft !bg-sagesoft !text-sage font-mono !text-[10px]">
                            Grounded: {res.evidenceGroundednessScore}%
                          </span>
                          <span className="chip !border-terrasoft !bg-terrasoft !text-terra font-mono !text-[10px]">
                            Analysis: {res.responseAnalysisQuality}%
                          </span>
                        </div>
                      ) : (
                        <span className="chip font-mono !text-[10px]">Pending run</span>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-cream/40 border border-line text-xs italic text-ink2">
                      "{tc.candidateResponse}"
                    </div>

                    <p className="text-[11px] text-mut">
                      <strong>Expected Benchmark Evaluation:</strong> {tc.expectedDeficiency}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      )}
    </div>
  );
}
