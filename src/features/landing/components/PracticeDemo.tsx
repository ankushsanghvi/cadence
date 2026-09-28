'use client';

import { useState } from "react";
import { Link } from "@/lib/routerCompat";
import { motion } from "framer-motion";
import { ArrowRight, RotateCcw, Check, Loader2 } from "lucide-react";
import { AGENTS } from "@/lib/mockData";
import { runEvaluation } from "@/lib/coachEngine";
import { ScoreBar } from "@/components/ui-bits";
import AgentStepper from "@/components/AgentStepper";

const SAMPLE_Q = { id: "demo", text: "Describe a challenging project you worked on. What made it hard, and what was the outcome?", durationSec: 180, expectSTAR: true, modelPoints: ["Frame the situation", "Your specific actions", "Quantified result"] };
const SAMPLE_A = "So basically we had this project that was really hard because of the deadline, and I think we had to kind of figure out a lot of things. I worked with the team on it and after some back and forth we improved the numbers over time and it went pretty well in the end, I guess. Everyone was happy with how it turned out.";

export default function PracticeDemo() {
  const [answer, setAnswer] = useState(SAMPLE_A);
  const [stages, setStages] = useState<any>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    setStages({});
    const r = await runEvaluation({ question: SAMPLE_Q, answer, mode: "text" }, (id: string, status: string, out: any) =>
      setStages((s: any) => ({ ...s, [id]: { status, out } }))
    );
    setResult(r);
    setRunning(false);
  };

  return (
    <section id="practice-demo" className="bg-coal py-20 text-paper sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow flex items-center gap-2 !text-coal3">
              <span className="h-px w-8 bg-terra" /> Live demo
            </p>
            <h2 className="mt-5 max-w-xl font-display text-4xl leading-tight tracking-tight sm:text-5xl">
              Grade a <em className="italic text-terra">weak</em> answer right now.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-paper/60">
            This is the full pipeline, running in your browser. Edit the answer, run it, and watch the five agents
            work. In the app it scores your real responses.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-coaline bg-coal2 p-7" data-testid="demo-question-card">
              <p className="eyebrow !text-coal3">Question · Behavioral</p>
              <p className="mt-3 font-display text-xl leading-snug text-paper">"{SAMPLE_Q.text}"</p>
              <textarea
                data-testid="demo-answer-textarea"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={9}
                className="mt-6 w-full rounded-2xl border border-coaline bg-coal p-4 text-sm leading-relaxed text-paper/90 placeholder:text-paper/30 focus:border-terra focus:outline-none"
                placeholder="Type an answer…"
              />
              <div className="mt-4 flex items-center justify-between">
                <span className="font-mono text-[11px] text-paper/40">{answer.trim() ? answer.trim().split(/\s+/).length : 0} words</span>
                <div className="flex gap-3">
                  <button
                    data-testid="demo-reset-btn"
                    onClick={() => { setAnswer(SAMPLE_A); setResult(null); setStages({}); }}
                    className="inline-flex items-center gap-2 rounded-full border border-coaline px-4 py-2.5 text-xs font-medium text-paper/70 transition-colors hover:text-paper"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                  <button
                    data-testid="demo-run-btn"
                    onClick={run}
                    disabled={running || !answer.trim()}
                    className="btn-terra !px-5 !py-2.5 disabled:opacity-50"
                  >
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run the pipeline"}
                    {!running && <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="h-full rounded-3xl border border-coaline bg-coal2 p-7" data-testid="demo-results-panel">
              <AgentStepper dark stages={stages} agents={AGENTS} />
              {result && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-8" data-testid="demo-feedback">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-coaline pt-6">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-4xl font-bold text-[#7AA2C0]">{result.overall}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/50">
                        overall
                        <br />
                        verdict
                      </span>
                    </div>
                    <span className="chip !border-coaline !bg-coal !text-paper/80">
                      {result.metrics.fillers} filler words · {result.metrics.words} words
                    </span>
                  </div>
                  <div className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2">
                    {Object.entries(result.scores).map(([k, v], i) => (
                      <ScoreBar key={k} label={k[0].toUpperCase() + k.slice(1)} value={v} delay={i * 0.08} />
                    ))}
                  </div>
                  <div className="mt-6 space-y-2">
                    {result.improvements.slice(0, 2).map((imp: string) => (
                      <p key={imp} className="flex items-start gap-2 text-sm text-paper/75">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7AA2C0]" /> {imp}
                      </p>
                    ))}
                  </div>
                  <Link to="/app/practice" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#7AA2C0] hover:underline" data-testid="demo-cta-app">
                    Practice the real thing <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
