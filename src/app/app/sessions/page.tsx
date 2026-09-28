'use client';

import { useMemo, useState, useEffect } from "react";
import { Link } from "@/lib/routerCompat";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Mic, PenLine, ChevronDown, ArrowRight } from "lucide-react";
import { COMPETENCIES } from "@/lib/mockData";
import { loadSessions } from "@/lib/store";
import { ScoreBar, statusTone, Reveal } from "@/components/ui-bits";

const compLabel = (id: string) => COMPETENCIES.find((c) => c.id === id)?.label || id;

export default function Sessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [comp, setComp] = useState("All");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const list = loadSessions().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setSessions(list);
  }, []);

  const filtered = sessions.filter(
    (s) =>
      (comp === "All" || s.competency === comp) &&
      s.questionText.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-8" data-testid="sessions-page">
      <Reveal>
        <p className="eyebrow">History</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">Every completed round, kept.</h1>
      </Reveal>

      {sessions.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-12 text-center" data-testid="sessions-empty-state">
          <p className="font-display text-2xl text-ink">No sessions yet.</p>
          <p className="mt-2 max-w-md text-sm text-mut">
            Complete an interview round to preserve its questions, transcripts, evidence, and coaching evaluation here.
          </p>
          <Link to="/app/practice" className="btn-terra mt-6 inline-flex items-center gap-2 !px-5 !py-2.5">
            Start your first practice <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <>
          <Reveal delay={0.05}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mut" />
                <input
                  data-testid="history-search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search questions…"
                  className="input-warm !pl-10"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {["All", ...COMPETENCIES.map((c) => c.id)].map((id) => (
                  <button
                    key={id}
                    data-testid={`sessions-filter-${id}`}
                    onClick={() => setComp(id)}
                    className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                      comp === id ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink2"
                    }`}
                  >
                    {id === "All" ? "All" : compLabel(id)}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="space-y-3" data-testid="sessions-list">
            {filtered.length === 0 && (
              <p className="rounded-2xl border border-dashed border-line2 p-10 text-center text-sm text-mut">
                No sessions match your search.
              </p>
            )}
            {filtered.map((s, i) => (
              <Reveal key={s.id} delay={Math.min(i * 0.03, 0.3)}>
                <div className="card overflow-hidden" data-testid="session-row">
                  <button
                    onClick={() => setOpenId(openId === s.id ? null : s.id)}
                    data-testid={`session-toggle-${s.id}`}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left cursor-pointer"
                  >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{s.questionText}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-mut">
                    <span>{compLabel(s.competency)}</span>·<span>{s.difficulty}</span>·
                    <span className="inline-flex items-center gap-1">
                      {s.mode === "voice" ? <Mic className="h-3 w-3" /> : <PenLine className="h-3 w-3" />} {s.mode}
                    </span>
                    ·<span>{new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${statusTone(s.overall)}`} data-testid={`session-score-${s.id}`}>
                    {s.overall}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-mut transition-transform ${openId === s.id ? "rotate-180" : ""}`} />
                </div>
              </button>
              <AnimatePresence>
                {openId === s.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="border-t border-line bg-cream/40"
                  >
                    <div className="grid grid-cols-1 gap-8 p-6 sm:grid-cols-2" data-testid="session-detail">
                      <div className="space-y-4">
                        {Object.entries(s.scores || {}).map(([k, v]: [string, any]) => (
                          <ScoreBar key={k} label={k[0].toUpperCase() + k.slice(1)} value={v} />
                        ))}
                      </div>
                      <div className="space-y-5">
                        {Array.isArray(s.turns) && s.turns.length > 0 ? (
                          <div className="space-y-3">
                            <p className="eyebrow">Interview transcript</p>
                            {s.turns.map((turn: any, index: number) => (
                              <div key={`${turn.question?.id || index}-${index}`} className="rounded-xl border border-line bg-white p-3">
                                <p className="text-xs font-semibold leading-relaxed text-ink">{index + 1}. {turn.question?.text || turn.question?.question}</p>
                                <p className="mt-2 text-xs italic leading-relaxed text-ink2">“{turn.answer}”</p>
                                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-mut">
                                  Internal turn score {turn.result?.overall ?? '—'} · STAR {turn.result?.starFilled ?? 0}/4
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : s.answer && s.answer !== "(Archived practice response)" && (
                          <div>
                            <p className="eyebrow mb-2">Your transcript</p>
                            <p className="rounded-xl border border-line bg-white p-3 text-xs italic leading-relaxed text-ink2">
                              "{s.answer}"
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="eyebrow mb-2">Coach said</p>
                          <ul className="space-y-1.5">
                            {[...(s.strengths || []), ...(s.improvements || [])].slice(0, 4).map((t: string) => (
                              <li key={t} className="text-xs leading-relaxed text-ink2">· {t}</li>
                            ))}
                          </ul>
                        </div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-mut">
                          STAR {s.starFilled || 0}/4 · {s.metrics?.fillers || 0} fillers · {s.metrics?.words || 0} words
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        ))}
      </div>
        </>
      )}
    </div>
  );
}
