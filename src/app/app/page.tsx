'use client';

import { Link } from "@/lib/routerCompat";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowRight, ArrowUpRight, Flame, Target, CalendarCheck, Gauge } from "lucide-react";
import { loadSessions, profile } from "@/lib/store";
import { COMPETENCIES } from "@/lib/mockData";
import { Reveal, ScoreRing, statusTone } from "@/components/ui-bits";
import { useEffect, useState } from "react";

const compLabel = (id: string) => COMPETENCIES.find((c) => c.id === id)?.label || id;

export default function Dashboard() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [p, setP] = useState<any>({ index: 0, avg: 0, starRate: 0, streak: 0, trend: [], gaps: [], weekCount: 0, total: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const s = loadSessions();
    setSessions(s);
    setP(profile(s));
    setMounted(true);
  }, []);

  const recent = [...sessions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <Reveal>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Candidate Dashboard</p>
            <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">Good to see you.</h1>
          </div>
          <Link to="/app/practice" data-testid="dashboard-new-practice-btn" className="btn-terra">
            New practice <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Gauge,
            label: "Communication Index",
            value: p.total > 0 && p.index > 0 ? p.index : "—",
            note: p.total > 0 ? "last 5 sessions" : "No sessions yet",
            testid: "stat-index",
          },
          {
            icon: Target,
            label: "STAR Compliance",
            value: p.total > 0 ? `${p.starRate}%` : "—",
            note: p.total > 0 ? "3+ components" : "Complete your first interview",
            testid: "stat-star",
          },
          {
            icon: CalendarCheck,
            label: "This Week",
            value: p.weekCount || 0,
            note: "practice sessions",
            testid: "stat-week",
          },
          {
            icon: Flame,
            label: "Streak",
            value: `${p.streak || 0}d`,
            note: p.streak > 0 ? "consecutive days" : "Start your first session",
            testid: "stat-streak",
          },
        ].map(({ icon: Icon, label, value, note, testid }, i) => (
          <Reveal key={label} delay={i * 0.05} className="h-full">
            <div className="card flex h-full flex-col justify-between p-6" data-testid={testid}>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mut">{label}</p>
                <Icon className="h-4 w-4 text-terra" />
              </div>
              <p className="mt-6 font-mono text-4xl font-bold tracking-tight text-ink">{value}</p>
              <p className="mt-1 text-xs text-mut">{note}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Reveal className="lg:col-span-8">
          <div className="card h-full p-7" data-testid="score-trend-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl text-ink">Score trajectory</h2>
                <p className="text-xs text-mut">Overall coaching score across recent sessions</p>
              </div>
              {p.trend?.length > 1 && (
                <span className="chip font-mono !text-[10px]">
                  <ArrowUpRight className="h-3 w-3 text-sage" /> trending up
                </span>
              )}
            </div>
            <div className="mt-6 h-64">
              {mounted && p.trend?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={p.trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="terra" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4A7494" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#4A7494" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#EDE9E0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#8C8275", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[40, 100]} tick={{ fill: "#8C8275", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #E5E0D5", background: "#fff", fontSize: 12 }}
                      formatter={(v) => [v, "Score"]}
                    />
                    <Area type="monotone" dataKey="score" stroke="#4A7494" strokeWidth={2.5} fill="url(#terra)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-cream/30 p-6 text-center">
                  <p className="text-sm font-medium text-ink2">No sessions completed yet.</p>
                  <p className="mt-1 text-xs text-mut">Your score trajectory will appear here as you practice.</p>
                </div>
              )}
            </div>
          </div>
        </Reveal>

        <Reveal className="lg:col-span-4" delay={0.08}>
          <div className="card flex h-full flex-col items-center justify-center gap-4 p-7" data-testid="index-ring-card">
            <ScoreRing value={p.total > 0 ? p.index : 0} size={150} />
            <div className="text-center">
              <p className="font-display text-lg text-ink">Communication Index</p>
              <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-mut">
                {p.total > 0
                  ? "Blended from relevance, clarity, structure, completeness and communication quality."
                  : "Complete your first practice session to calculate your Communication Index."}
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <div className="card h-full p-7" data-testid="recent-sessions-card">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl text-ink">Recent sessions</h2>
              {recent.length > 0 && (
                <Link to="/app/sessions" className="text-xs font-medium text-terra hover:underline" data-testid="view-all-sessions-link">
                  View all
                </Link>
              )}
            </div>
            {recent.length > 0 ? (
              <div className="mt-4 divide-y divide-line">
                {recent.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-4 py-3.5" data-testid="recent-session-row">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{s.questionText}</p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-mut">
                        {compLabel(s.competency)} · {s.difficulty} · {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 font-mono text-xs font-bold ${statusTone(s.overall)}`}>
                      {s.overall}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-cream/30 p-8 text-center">
                <p className="text-sm font-medium text-ink2">No sessions yet.</p>
                <p className="mt-1 text-xs text-mut">Complete your first practice question to see your history and breakdown.</p>
                <Link to="/app/practice" className="btn-terra mt-4 !px-4 !py-2 !text-xs">
                  Start your first practice
                </Link>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal className="lg:col-span-5" delay={0.08}>
          <div className="card h-full p-7" data-testid="gaps-card">
            <h2 className="font-display text-xl text-ink">Recurring gaps</h2>
            <p className="text-xs text-mut">Detected across all sessions by the Coach Agent</p>
            <div className="mt-5 space-y-4">
              {(!p.gaps || p.gaps.length === 0) ? (
                <div className="rounded-2xl border border-dashed border-line bg-cream/30 p-6 text-center">
                  <p className="text-xs text-mut">
                    No recurring gaps yet. Your speech habits and structural weak spots will be diagnosed across your practice rounds.
                  </p>
                </div>
              ) : (
                p.gaps.map((g: any) => (
                  <div key={g.key} data-testid={`gap-${g.key}`}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium text-ink2">{g.label}</span>
                      <span className="font-mono text-xs text-terra">{g.pct}% of sessions</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EDE9E0]">
                      <div className="h-full rounded-full bg-terra" style={{ width: `${g.pct}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
            {p.total > 0 && (
              <Link to="/app/plan" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-terra hover:underline" data-testid="gaps-plan-link">
                Open improvement plan <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
