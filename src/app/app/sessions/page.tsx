'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/lib/routerCompat';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown, ExternalLink, Mic, PenLine } from 'lucide-react';
import { COMPETENCIES, ROLES } from '@/lib/mockData';
import { loadSessions } from '@/lib/store';
import { getRecommendedResources } from '@/lib/resources';
import { deriveReviewWeaknesses, sessionRoadmap } from '@/lib/sessionReview';
import { filterSessions, SESSION_FILTERS, type SessionFilterId } from '@/lib/sessionFilters';
import ResourceList from '@/components/ResourceList';
import { ScoreBar, statusTone, Reveal } from '@/components/ui-bits';

const labels: Record<string, string> = { relevance: 'Relevance', clarity: 'Clarity', structure: 'Structure', completeness: 'Completeness', communication: 'Communication' };
const compLabel = (id: string) => COMPETENCIES.find((item) => item.id === id)?.label || id;
const roleLabel = (id?: string) => ROLES.find((item) => item.id === id)?.label || id || 'Unavailable for this historical session';
const questionText = (turn: any) => turn?.question?.text || turn?.question?.question || turn?.result?.questionText || 'Question unavailable';
const answerText = (turn: any) => turn?.answer || turn?.result?.answer || '';

function Answer({ answer }: { answer: string }) {
  const [full, setFull] = useState(false);
  const isLong = answer.length > 420;
  return <div><p className={`whitespace-pre-wrap text-sm leading-relaxed text-ink2 ${isLong && !full ? 'line-clamp-4' : ''}`}>“{answer}”</p>{isLong && <button onClick={() => setFull(!full)} className="mt-2 text-xs font-semibold text-terra hover:underline">{full ? 'Show less' : 'View full answer'}</button>}</div>;
}

function QuestionCard({ turn, index, role }: { turn: any; index: number; role?: string }) {
  const [open, setOpen] = useState(index === 0);
  const weaknesses = useMemo(() => deriveReviewWeaknesses(turn?.result), [turn]);
  const resources = useMemo(() => getRecommendedResources({ scores: turn?.result?.scores, role, weaknessKeys: weaknesses.map((item) => item.key), weaknesses: turn?.result?.improvements || [], turns: [turn] }).slice(0, 3), [turn, role, weaknesses]);
  const result = turn?.result || {};
  return <article className="overflow-hidden rounded-2xl border border-line bg-white" data-testid={`session-question-${index + 1}`}>
    <button onClick={() => setOpen(!open)} className="flex w-full items-start justify-between gap-4 p-5 text-left cursor-pointer"><div className="min-w-0"><p className="eyebrow">Question {index + 1}</p><h3 className="mt-2 text-sm font-semibold leading-relaxed text-ink">{questionText(turn)}</h3></div><span className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-xs font-bold ${statusTone(result.overall || 0)}`}>{result.overall ?? '—'}</span><ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-mut transition-transform ${open ? 'rotate-180' : ''}`} /></button>
    <AnimatePresence initial={false}>{open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-line bg-cream/30"><div className="space-y-6 p-5 sm:p-6">
      <section><p className="eyebrow mb-2">Candidate answer</p><Answer answer={answerText(turn)} /></section>
      {result.scores && <section><p className="eyebrow mb-3">Evaluation</p><div className="grid gap-x-7 gap-y-3 sm:grid-cols-2">{Object.entries(labels).map(([key, label]) => typeof result.scores[key] === 'number' && <ScoreBar key={key} label={label} value={result.scores[key]} />)}</div></section>}
      {weaknesses.length > 0 && <section className="rounded-xl border border-terrasoft bg-terrasoft/35 p-4" data-testid={`question-weakness-${index + 1}`}><p className="eyebrow text-terrad">Why this answer was weak</p><ul className="mt-2 space-y-2">{weaknesses.map((item) => <li key={item.key} className="text-xs leading-relaxed text-ink2"><span className="font-semibold text-ink">{item.title}:</span> {item.evidence}</li>)}</ul></section>}
      {weaknesses.some((item) => item.suggestion) && <section><p className="eyebrow mb-2">Coach suggestion</p><ul className="space-y-1.5">{weaknesses.flatMap((item) => item.suggestion ? [item.suggestion] : []).filter((item, position, items) => items.indexOf(item) === position).map((item) => <li key={item} className="text-xs leading-relaxed text-ink2">· {item}</li>)}</ul></section>}
      {resources.length > 0 && <section><p className="eyebrow mb-3">Recommended resources</p><ResourceList resources={resources} testPrefix={`question-${index + 1}-resources`} /></section>}
    </div></motion.div>}</AnimatePresence>
  </article>;
}

export default function Sessions() {
  const [sessions, setSessions] = useState<any[]>([]); const [query, setQuery] = useState(''); const [comp, setComp] = useState<SessionFilterId>('all'); const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => setSessions(loadSessions().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())), []);
  const filtered = filterSessions(sessions, comp, query);
  return <div className="space-y-8" data-testid="sessions-page"><Reveal><p className="eyebrow">History</p><h1 className="mt-2 font-display text-4xl tracking-tight text-ink">Every completed round, kept.</h1></Reveal>
    {sessions.length === 0 ? <div className="card flex flex-col items-center justify-center p-12 text-center" data-testid="sessions-empty-state"><p className="font-display text-2xl text-ink">No sessions yet.</p><p className="mt-2 max-w-md text-sm text-mut">Complete an interview round to preserve its questions, answers, evidence, and coaching evaluation here.</p><Link to="/app/practice" className="btn-terra mt-6 inline-flex items-center gap-2 !px-5 !py-2.5">Start your first practice <ArrowRight className="h-4 w-4" /></Link></div> : <>
      <Reveal delay={0.05}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search completed rounds…" className="input-warm w-full sm:max-w-xs" data-testid="history-search-input" /><div className="flex gap-2 overflow-x-auto no-scrollbar">{SESSION_FILTERS.map((filter) => <button key={filter.id} onClick={() => setComp(filter.id)} data-testid={`sessions-filter-${filter.id}`} className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium cursor-pointer ${comp === filter.id ? 'border-ink bg-ink text-paper' : 'border-line bg-white text-ink2'}`}>{filter.label}</button>)}</div></div></Reveal>
      <div className="space-y-3" data-testid="sessions-list">{filtered.length ? filtered.map((session, index) => <SessionRow key={session.id} session={session} index={index} open={openId === session.id} onToggle={() => setOpenId(openId === session.id ? null : session.id)} />) : <p className="rounded-2xl border border-dashed border-line2 p-10 text-center text-sm text-mut" data-testid="sessions-no-matches">No matching sessions.</p>}</div>
    </>}</div>;
}

function SessionRow({ session, index, open, onToggle }: { session: any; index: number; open: boolean; onToggle: () => void }) {
  const turns = Array.isArray(session.turns) ? session.turns : []; const roadmap = sessionRoadmap(turns);
  return <Reveal delay={Math.min(index * 0.03, 0.3)}><section className="card overflow-hidden" data-testid="session-row"><button onClick={onToggle} className="flex w-full items-center justify-between gap-4 p-5 text-left cursor-pointer" data-testid={`session-toggle-${session.id}`}><div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{session.questionText}</p><p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-mut"><span>{compLabel(session.competency)}</span>·<span>{session.difficulty}</span>·<span className="inline-flex items-center gap-1">{session.mode === 'voice' ? <Mic className="h-3 w-3" /> : <PenLine className="h-3 w-3" />}{session.mode}</span>·<span>{new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></p></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${statusTone(session.overall)}`}>{session.overall}</span><ChevronDown className={`h-4 w-4 text-mut transition-transform ${open ? 'rotate-180' : ''}`} /></div></button>
    <AnimatePresence>{open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-line bg-cream/40"><div className="space-y-7 p-5 sm:p-7" data-testid="session-detail"><section><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Completed session</p><h2 className="mt-2 font-display text-3xl text-ink">{session.roundLabel || session.questionText}</h2><p className="mt-2 text-xs text-mut">Round: {session.roundLabel || compLabel(session.competency)} · Role: {roleLabel(session.role)} · {session.difficulty} · {new Date(session.createdAt).toLocaleDateString()}</p></div><span className={`rounded-full px-4 py-2 font-mono text-lg font-bold ${statusTone(session.overall)}`}>Overall {session.overall}</span></div><div className="mt-6 grid gap-x-7 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">{Object.entries(labels).map(([key, label]) => typeof session.scores?.[key] === 'number' && <ScoreBar key={key} label={label} value={session.scores[key]} />)}</div></section>
      <section className="grid gap-4 md:grid-cols-2"><Summary title="Strengths" items={session.strengths} /><Summary title="Improvement areas" items={session.improvements} tone="improvement" /></section>
      {turns.length > 0 ? <><section><p className="eyebrow mb-3">Question review</p><div className="space-y-3">{turns.map((turn: any, turnIndex: number) => <QuestionCard key={`${turn.question?.id || turnIndex}-${turnIndex}`} turn={turn} index={turnIndex} role={session.role} />)}</div></section>{roadmap.length > 0 && <section className="rounded-2xl bg-coal p-5 sm:p-6" data-testid="session-roadmap"><p className="eyebrow text-paper/50">Overall improvement roadmap</p><div className="mt-4 space-y-4">{roadmap.map((item) => { const resource = getRecommendedResources({ weaknessKeys: [item.key] })[0]; return <div key={item.key} className="grid gap-2 border-t border-coaline pt-4 text-sm sm:grid-cols-[90px_1fr_1fr_auto]"><span className="font-mono text-xs text-terra">{item.count}×</span><span className="text-paper">{item.weakness}</span><span className="text-paper/70">{item.action.drill}</span>{resource && <a href={resource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-terra hover:underline">Resource <ExternalLink className="h-3 w-3" /></a>}</div>; })}</div></section>}</> : <p className="text-sm text-mut">This older session has no turn-level review data, so Cadence cannot reconstruct feedback that was never stored.</p>}</div></motion.div>}</AnimatePresence>
  </section></Reveal>;
}

function Summary({ title, items, tone }: { title: string; items?: string[]; tone?: 'improvement' }) { return <div className={`rounded-xl border p-4 ${tone ? 'border-terrasoft bg-terrasoft/30' : 'border-line bg-white'}`}><p className={`eyebrow mb-2 ${tone ? 'text-terrad' : ''}`}>{title}</p>{items?.length ? <ul className="space-y-1.5">{items.map((item) => <li key={item} className="text-xs leading-relaxed text-ink2">· {item}</li>)}</ul> : <p className="text-xs text-mut">No persisted {title.toLowerCase()} are available for this historical session.</p>}</div>; }
