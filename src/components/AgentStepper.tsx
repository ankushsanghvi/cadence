'use client';

import { motion } from "framer-motion";
import { AGENTS } from "@/lib/mockData";
import { HelpCircle, Mic, FileText, Layers, Sparkles, Check } from "lucide-react";

const ICONS: Record<string, any> = { question: HelpCircle, comm: Mic, content: FileText, star: Layers, coach: Sparkles };

export default function AgentStepper({ stages, agents = AGENTS, dark = false, testPrefix = "agent" }: any) {
  const border = dark ? "border-coaline" : "border-line";
  const sub = dark ? "text-paper/40" : "text-mut";
  return (
    <div className="relative space-y-1" data-testid={`${testPrefix}-stepper`}>
      {agents.map((a: any, i: number) => {
        const st = stages[a.id];
        const Icon = ICONS[a.id] || HelpCircle;
        const running = st?.status === "running";
        const done = st?.status === "done";
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
                done
                  ? "border-transparent bg-terra text-white"
                  : running
                  ? `border-terra bg-terrasoft text-terra`
                  : `${dark ? "border-coaline bg-coal text-paper/40" : "border-line bg-white text-mut"}`
              }`}
              data-testid={`${testPrefix}-status-${a.id}`}
            >
              {done ? <Check className="h-4 w-4" /> : running ? <Icon className="h-4 w-4 animate-pulse" /> : <Icon className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className={`truncate text-sm font-medium ${done || running ? (dark ? "text-paper" : "text-ink") : sub}`}>
                  {a.name}
                </span>
                {running && (
                  <span className={`font-mono text-[10px] uppercase tracking-widest ${dark ? "text-[#7AA2C0]" : "text-terra"}`}>
                    running…
                  </span>
                )}
                {done && (
                  <span className={`font-mono text-[10px] ${sub}`} data-testid={`${testPrefix}-latency-${a.id}`}>
                    {(st.out?.latencyMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              {done && st.out && (
                <p className={`mt-0.5 truncate font-mono text-[10px] ${sub}`}>
                  {summary(a.id, st.out)}
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

function summary(id: string, out: any) {
  switch (id) {
    case "question":
      return `selected · ${out.competency} · ${out.difficulty}`;
    case "comm":
      return `clarity ${out.clarity} · ${out.fillers} fillers${out.wpm ? ` · ${out.wpm} wpm` : ""}`;
    case "content":
      return `relevance ${out.relevance} · completeness ${out.completeness}`;
    case "star":
      return `${out.filled}/4 STAR components · structure ${out.structure}`;
    case "coach":
      return `overall ${out.overall} · synthesis complete`;
    default:
      return "";
  }
}
