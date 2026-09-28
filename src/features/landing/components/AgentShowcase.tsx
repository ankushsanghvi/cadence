'use client';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, Mic, FileText, Layers, Sparkles, ArrowDownRight } from "lucide-react";
import { AGENTS } from "@/lib/mockData";
import { Reveal, SectionTag } from "@/components/ui-bits";

const ICONS: Record<string, any> = { question: HelpCircle, comm: Mic, content: FileText, star: Layers, coach: Sparkles };

export default function AgentShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((a) => (a + 1) % AGENTS.length), 3400);
    return () => clearInterval(t);
  }, [paused]);

  const agent = AGENTS[active];
  const next = AGENTS[(active + 1) % AGENTS.length];
  const Icon = ICONS[agent.id] || HelpCircle;

  return (
    <section id="agents" className="py-20 sm:py-28" data-testid="agent-pipeline-container">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <SectionTag>The Engine</SectionTag>
          <div className="mt-5 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h2 className="max-w-xl font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
              Five specialists.
              <br />
              One <em className="italic text-terra">honest</em> verdict.
            </h2>
            <p className="max-w-md text-base leading-relaxed text-ink2">
              Every answer is handed agent-to-agent — from question selection to the final coaching synthesis. No
              single model grades you alone.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-12" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div className="space-y-3 lg:col-span-5">
            {AGENTS.map((a: any, i: number) => {
              const AIcon = ICONS[a.id] || HelpCircle;
              const isActive = i === active;
              return (
                <button
                  key={a.id}
                  data-testid={`agent-card-${a.id}_agent`}
                  onClick={() => setActive(i)}
                  className={`flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-300 ${
                    isActive ? "border-terra bg-white shadow-lift" : "border-line bg-white/60 hover:border-line2"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      isActive ? "bg-terra text-white" : "bg-cream text-ink2"
                    }`}
                  >
                    <AIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-semibold ${isActive ? "text-ink" : "text-ink2"}`}>{a.name}</span>
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-mut">{a.tag}</span>
                  </span>
                  {isActive && <ArrowDownRight className="h-4 w-4 shrink-0 text-terra" />}
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-7">
            <div className="card relative h-full overflow-hidden rounded-3xl p-8 sm:p-10">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-terrasoft blur-3xl" />
              <AnimatePresence mode="wait">
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.35 }}
                  data-testid={`agent-detail-${agent.id}_agent`}
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-terra text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-display text-2xl text-ink">{agent.name}</h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terra">{agent.tag}</p>
                    </div>
                  </div>
                  <p className="mt-6 text-base leading-relaxed text-ink2">{agent.desc}</p>
                  <div className="mt-8 rounded-2xl border border-line bg-cream/70 p-5">
                    <p className="eyebrow mb-3">System prompt · inspectable</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-ink2">
{agent.prompt}
                    </pre>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut">
                      A2A handoff · step {active + 1} of {AGENTS.length}
                    </span>
                    <span className="chip !border-terrasoft !bg-terrasoft !text-terrad">
                      hands off → {next.short}
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
