'use client';

import { motion } from "framer-motion";
import { AGENTS } from "@/lib/mockData";
import { HelpCircle, Mic, FileText, Layers, Sparkles, Check, CircleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { question: HelpCircle, comm: Mic, content: FileText, star: Layers, coach: Sparkles };

type Agent = { id: string; name: string };
type StageOutput = {
  latencyMs?: number;
  competency?: string;
  difficulty?: string;
  clarity?: number;
  fillers?: number;
  wpm?: number | null;
  relevance?: number;
  completeness?: number;
  filled?: number;
  structure?: number;
  overall?: number;
  evaluationSource?: 'llm' | 'deterministic_fallback';
};
type Stage = { status?: 'running' | 'done' | 'fallback' | 'error'; out?: StageOutput };
type AgentStepperProps = {
  stages?: Record<string, Stage>;
  agents?: Agent[];
  dark?: boolean;
  testPrefix?: string;
  /** A quiet, candidate-facing progress indicator for the live interview. */
  compact?: boolean;
};

export default function AgentStepper({ stages = {}, agents = AGENTS as Agent[], dark = false, testPrefix = "agent", compact = false }: AgentStepperProps) {
  const sub = dark ? "text-paper/40" : "text-mut";

  if (compact) {
    const completedCount = agents.filter((agent) => stages[agent.id]?.status === 'done').length;
    const activeIndex = Math.min(completedCount, Math.max(agents.length - 1, 0));

    return (
      <div className="flex items-center -space-x-1.5" data-testid={`${testPrefix}-stepper`} aria-label="Answer review in progress">
        {agents.map((agent, index) => {
          const Icon = ICONS[agent.id] || HelpCircle;
          const status = stages[agent.id]?.status;
          const isComplete = status === 'done';
          const isActive = status === 'running' || (!Object.keys(stages).length && index === 0) || (completedCount > 0 && index === activeIndex);

          return (
            <motion.span
              key={agent.id}
              title={agent.name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isActive ? { opacity: 1, scale: [1, 1.1, 1] } : { opacity: isComplete ? 1 : 0.45, scale: 1 }}
              transition={isActive ? { duration: 1.25, repeat: Infinity, ease: 'easeInOut', delay: index * 0.08 } : { duration: 0.2 }}
              style={{ zIndex: agents.length - index }}
              className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-sm ${
                isComplete ? 'bg-terra text-white' : isActive ? 'bg-terrasoft text-terra ring-2 ring-terra/20' : 'bg-white text-mut'
              }`}
              data-testid={`${testPrefix}-status-${agent.id}`}
            >
              {isComplete ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
            </motion.span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative space-y-1" data-testid={`${testPrefix}-stepper`}>
      {agents.map((a, i) => {
        const st = stages[a.id];
        const Icon = ICONS[a.id] || HelpCircle;
        const running = st?.status === "running";
        const fallback = st?.status === "fallback" || st?.out?.evaluationSource === 'deterministic_fallback';
        const done = st?.status === "done" || fallback;
        const error = st?.status === "error";
        const latencyMs = typeof st?.out?.latencyMs === 'number' && Number.isFinite(st.out.latencyMs)
          ? st.out.latencyMs
          : null;
        return (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="relative flex items-center gap-4 py-2.5"
          >
            {i < agents.length - 1 && (
              <span className={`absolute left-[19px] top-[38px] h-[calc(100%-8px)] w-px ${dark ? "bg-coaline" : "bg-line"}`} />
            )}
            <span
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ${
                error
                  ? "border-ochre bg-ochresoft text-ochre"
                  : fallback
                  ? "border-ochre/30 bg-ochresoft text-ochre"
                  : done
                  ? "border-transparent bg-terra text-white"
                  : running
                  ? `border-terra bg-terrasoft text-terra`
                  : `${dark ? "border-coaline bg-coal text-paper/40" : "border-line bg-white text-mut"}`
              }`}
              data-testid={`${testPrefix}-status-${a.id}`}
            >
              {error ? <CircleAlert className="h-4 w-4" /> : done ? <Check className="h-4 w-4" /> : running ? <Icon className="h-4 w-4 animate-pulse" /> : <Icon className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className={`truncate text-sm font-medium ${done || running || error ? (dark ? "text-paper" : "text-ink") : sub}`}>
                  {a.name}
                </span>
                {running && (
                  <span className={`font-mono text-[10px] uppercase tracking-widest ${dark ? "text-[#7AA2C0]" : "text-terra"}`}>
                    running…
                  </span>
                )}
                {done && latencyMs !== null && (
                  <span className={`font-mono text-[10px] ${sub}`} data-testid={`${testPrefix}-latency-${a.id}`}>
                    {(latencyMs / 1000).toFixed(1)}s
                  </span>
                )}
                {fallback && (
                  <span className={`font-mono text-[9px] uppercase tracking-wide ${dark ? "text-paper/40" : "text-ochre"}`}>
                    fallback
                  </span>
                )}
              </div>
              {(done || error) && (
                <p className={`mt-0.5 truncate font-mono text-[10px] ${sub}`}>
                  {error ? 'Unable to complete this check' : summary(a.id)}
                </p>
              )}
              {running && (
                <div className={`mt-1.5 h-0.5 w-full overflow-hidden rounded-full ${dark ? "bg-coaline" : "bg-line"}`}>
                  <motion.div
                    className="h-full w-1/3 rounded-full bg-terra"
                    animate={{ x: ["-100%", "300%"] }}
                    transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function summary(id: string) {
  switch (id) {
    case "question":
      return 'Question context captured';
    case "comm":
      return 'Delivery & clarity analyzed';
    case "content":
      return 'Relevance & completeness analyzed';
    case "star":
      return 'Response structure analyzed';
    case "coach":
      return 'Final feedback synthesized';
    default:
      return "";
  }
}
