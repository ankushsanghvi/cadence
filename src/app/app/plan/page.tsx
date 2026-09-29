'use client';

import { Link } from "@/lib/routerCompat";
import { ArrowRight, CalendarClock, Dumbbell, TrendingUp } from "lucide-react";
import { loadSessions, profile } from "@/lib/store";
import { recommendedTopics } from "@/lib/resources";
import { IMPROVEMENT_DRILLS } from "@/lib/improvementPlan";
import ResourceList from "@/components/ResourceList";
import { Reveal } from "@/components/ui-bits";
import { useEffect, useState } from "react";

const GENERIC = [
  { title: "Practice 4 sessions this week", drill: "Mix one behavioral, one technical-communication, one situational and one follow-up drill.", metric: "4 sessions / week" },
  { title: "One answer out loud every day", drill: "Voice mode only for a week — the Communication Agent measures what typing hides.", metric: "7 voice sessions" },
];

export default function Plan() {
  const [p, setP] = useState<any>({ index: 0, avg: 0, starRate: 0, streak: 0, trend: [], gaps: [], weekCount: 0, total: 0 });

  useEffect(() => {
    const s = loadSessions();
    setP(profile(s));
  }, []);

  const milestones = [
    ...(p.gaps || []).slice(0, 2).map((g: any) => ({
      ...IMPROVEMENT_DRILLS[g.key as keyof typeof IMPROVEMENT_DRILLS],
      progress: Math.max(10, 100 - g.pct),
      weeks: "This week",
    })),
    ...GENERIC.slice(0, 3 - Math.min((p.gaps || []).length, 2)).map((g) => ({ ...g, progress: Math.min(90, p.index || 60), weeks: "Ongoing" })),
  ].slice(0, 3);

  return (
    <div className="mx-auto max-w-4xl space-y-10" data-testid="plan-page">
      <Reveal>
        <p className="eyebrow">Improvement Plan</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
          Where your answers <em className="italic text-terra">actually</em> slip.
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink2">
          Built by the Coach Agent from every session you've run — ranked by how often the gap shows up, not by how
          loud it is once.
        </p>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="plan-summary">
          {[
            ["Index", p.total > 0 && p.index > 0 ? p.index : "—"],
            ["Sessions", p.total || 0],
            ["STAR rate", p.total > 0 ? `${p.starRate}%` : "—"],
            ["Streak", `${p.streak || 0}d`],
          ].map(([l, v]) => (
            <div key={l} className="card p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mut">{l}</p>
              <p className="mt-2 font-mono text-2xl font-bold text-ink">{v}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {p.total === 0 ? (
        <div className="card p-8 sm:p-10" data-testid="plan-empty-state">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-terrasoft text-terra">
              <TrendingUp className="h-6 w-6" />
            </span>
            <div>
              <h2 className="font-display text-2xl text-ink">Your improvement plan will appear after your first few practice sessions.</h2>
              <p className="mt-1 text-sm text-mut">
                As you answer questions, the Coach Agent tracks specific behavioral and speech metrics to assemble your personalized roadmap:
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Communication", desc: "Pacing, articulation, and vocal confidence signals" },
              { title: "STAR Structure", desc: "Situation, Task, Action, and Result framing" },
              { title: "Content Quality", desc: "Technical depth and prompt relevance" },
              { title: "Filler Words", desc: "Detecting 'um', 'uh', 'like' under pressure" },
              { title: "Hedging", desc: "Eliminating passive or uncertain phrasing" },
              { title: "Response Completeness", desc: "Ensuring all prompt requirements are answered" },
              { title: "Recurring Gaps", desc: "Multi-session trends identified by the Coach Agent" },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-line bg-cream/40 p-4">
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-mut">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <Link to="/app/practice" className="btn-terra inline-flex items-center gap-2 !px-6 !py-3">
              Start your first practice session <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4" data-testid="improvement-plan-roadmap">
          {milestones.map((m, i) => (
            <Reveal key={m.title || i} delay={i * 0.06}>
              <div className="card p-7">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="flex items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-terrasoft text-terra">
                      {i === 0 ? <TrendingUp className="h-5 w-5" /> : i === 1 ? <Dumbbell className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
                    </span>
                    <div>
                      <h3 className="font-display text-xl text-ink">{m.title}</h3>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink2">{m.drill}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-start sm:items-end gap-1">
                    <span className="chip font-mono !text-[10px]">{m.metric}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-mut">{m.weeks}</span>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-4">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EDE9E0]">
                    <div className="h-full rounded-full bg-terra transition-all" style={{ width: `${m.progress}%` }} />
                  </div>
                  <span className="font-mono text-xs text-terra">{m.progress}%</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}

      <Reveal delay={0.08}>
        <section data-testid="plan-resources">
          <p className="eyebrow mb-1">Prep library</p>
          <h2 className="font-display text-2xl tracking-tight text-ink">Resources for your gaps.</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink2">
            Videos, documentation and reading matched to your recurring gaps — if FastAPI or STAR keeps showing up,
            this is where you fix it.
          </p>
          <div className="mt-6">
            <ResourceList topics={recommendedTopics({ gaps: p.gaps })} testPrefix="plan-resources" />
          </div>
        </section>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="flex flex-col items-start justify-between gap-5 rounded-3xl bg-coal p-8 sm:flex-row sm:items-center">
          <p className="max-w-md font-display text-2xl leading-snug text-paper">
            The plan only works if the pipeline runs. Next question is one click away.
          </p>
          <Link to="/app/practice" data-testid="plan-practice-cta" className="btn-terra shrink-0">
            Practice now <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
