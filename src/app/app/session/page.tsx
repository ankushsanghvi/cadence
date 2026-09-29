// @ts-nocheck
'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useNavigate, useSearchParams } from "@/lib/routerCompat";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Mic, Square, PenLine, Check, AlertCircle,
  RotateCcw, Copy, Clock, Award, CheckCircle2, ChevronRight, Download,
  Printer, Sparkles, Building2, User, Target, BrainCircuit, ExternalLink,
  FileText
} from "lucide-react";
import { COMPETENCIES, AGENTS, pickQuestion } from "@/lib/mockData";
import { runEvaluation, FILLER_RE, HEDGE_RE } from "@/lib/coachEngine";
import { saveSession } from "@/lib/store";
import { recommendedTopics } from "@/lib/resources";
import ResourceList from "@/components/ResourceList";
import AgentStepper from "@/components/AgentStepper";
import { ScoreRing, ScoreBar, Reveal } from "@/components/ui-bits";
import { defaultDatasetManager } from "@/lib/dataset/datasetManager";
import {
  ResumeInterviewerAgent,
  InterviewSessionState,
  initializeSessionState,
  InterviewerQuestionOutput
} from "@/agents/resumeInterviewerAgent";
import {
  INTERVIEW_ROUNDS,
  InterviewRoundKey,
  extractResumeKnowledge
} from "@/lib/resume/resumeKnowledge";
import { DEFAULT_PROFILE, PROFILE_KEY } from "@/lib/api";
import { normalizeResumeProfile, isCorruptOrGarbageProfile } from "@/lib/resumeParser";
import { sessionCategoryForRound } from "@/lib/sessionFilters";

const compLabel = (id: string) => COMPETENCIES.find((c) => c.id === id)?.label || id;
const DRAFT_KEY = "cadence_draft";

function PracticeSessionInner() {
  const [params] = useSearchParams();
  const nav = useNavigate();

  // Resume Interview Session State
  const [resumeSession, setResumeSession] = useState<InterviewSessionState | null>(null);
  const [nextPreparedQuestion, setNextPreparedQuestion] = useState<InterviewerQuestionOutput | null>(null);
  const [turnIndex, setTurnIndex] = useState<number>(0);
  const [completedTurns, setCompletedTurns] = useState<any[]>([]);
  const [showFinalReport, setShowFinalReport] = useState<boolean>(false);

  const roundParam = (params?.get("round") || "behavioral") as InterviewRoundKey;
  const roleParam = params?.get("role") || "pm";
  const diffParam = params?.get("diff") || "Standard";

  const config = useMemo(
    () => ({
      role: roleParam,
      competency: params?.get("comp") || "behavioral",
      difficulty: diffParam,
      type: params?.get("type") || "Any",
    }),
    [roleParam, diffParam, params]
  );

  // Initialize Question
  // Do not use a candidate-visible placeholder as a question. The first
  // question is generated before the interview surface is rendered.
  const [question, setQuestion] = useState<any>(null);

  const [answer, setAnswer] = useState(() => (typeof window !== "undefined" ? localStorage.getItem(DRAFT_KEY) || "" : ""));
  const [mode, setMode] = useState("text");
  const [listening, setListening] = useState(false);
  const [srSupported, setSrSupported] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [stages, setStages] = useState<any>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [tab, setTab] = useState("overview");
  const recRef = useRef<any>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Load or Initialize Resume Interviewer Session on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let activeState: InterviewSessionState | null = null;
      const saved = sessionStorage.getItem('cadence_resume_interview_session');

      if (saved) {
        try {
          const parsedSaved = JSON.parse(saved);
          if (JSON.stringify(parsedSaved).toLowerCase().includes('flatedecode') || JSON.stringify(parsedSaved).includes('\ufffd')) {
            sessionStorage.removeItem('cadence_resume_interview_session');
            activeState = null;
          } else {
            activeState = parsedSaved;
          }
        } catch (e) {
          console.error("Failed to parse resume interview session", e);
        }
      }

      // If no session state was present in sessionStorage, build from stored profile
      if (!activeState) {
        let candidateProfile = DEFAULT_PROFILE;
        try {
          const stored = localStorage.getItem(PROFILE_KEY);
          if (stored) {
            const parsedStored = JSON.parse(stored);
            if (isCorruptOrGarbageProfile(parsedStored)) {
              localStorage.removeItem(PROFILE_KEY);
              candidateProfile = DEFAULT_PROFILE;
            } else {
              candidateProfile = normalizeResumeProfile(parsedStored);
            }
          }
        } catch (e) {
          console.error(e);
        }

        const knowledge = extractResumeKnowledge(candidateProfile);
        activeState = initializeSessionState(knowledge, roundParam, roleParam, diffParam);
        sessionStorage.setItem('cadence_resume_interview_session', JSON.stringify(activeState));
      }

      setResumeSession(activeState);

      // Generate on the server so provider credentials never enter the browser.
      // If the route is temporarily unavailable, use the deterministic local
      // agent fallback instead of surfacing an LLM credential error to users.
      (async () => {
        try {
          const response = await fetch('/api/interviewer/next-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionState: activeState }),
          });
          if (response.ok) {
            const payload = await response.json();
            if (payload.nextQuestion && payload.sessionState) {
              return { nextQuestion: payload.nextQuestion, updatedState: payload.sessionState };
            }
          }
        } catch {
          // The local deterministic fallback below keeps practice available.
        }
        return ResumeInterviewerAgent.decideNextQuestion(activeState);
      })()
        .then(({ nextQuestion, updatedState }) => {
          setResumeSession(updatedState);
          sessionStorage.setItem('cadence_resume_interview_session', JSON.stringify(updatedState));

          setQuestion({
            id: `q_${Date.now()}`,
            text: nextQuestion.question,
            competency: nextQuestion.competency,
            difficulty: nextQuestion.difficulty,
            type: nextQuestion.questionType,
            durationSec: 150,
            resumeTopic: nextQuestion.resumeTopic,
            reason: nextQuestion.reason,
            evidenceUsed: nextQuestion.evidenceUsed,
            expectedCompetency: nextQuestion.expectedCompetency,
            followUp: nextQuestion.followUp,
            modelAnswer: `When leading ${nextQuestion.resumeTopic}, I owned the technical and business benchmarks end-to-end. We grounded our delivery in clear user metrics and shipped with measured business impact.`,
            modelPoints: [
              `Direct ownership at ${nextQuestion.resumeTopic}`,
              'Quantified metric and outcome verification',
              'Structured communication (STAR)'
            ],
            followUps: [
              `What specific metric verified success at ${nextQuestion.resumeTopic}?`,
              `What was the single most difficult trade-off you navigated?`,
              `How would you scale that solution today?`
            ]
          });
        })
        .catch(err => {
          console.error("Failed to generate initial question", err);
        });
    }
  }, [roundParam, roleParam, diffParam]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(DRAFT_KEY, answer);
    }
  }, [answer]);

  useEffect(() => {
    if (!question || result || running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [result, running]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setSrSupported(!!SR);
    }
  }, []);

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSrSupported(false);
      setMode("text");
      return;
    }
    try {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (e: any) => {
        setAnswer(Array.from(e.results).map((r: any) => r[0].transcript).join(" "));
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const fillers = (answer.match(FILLER_RE) || []).length;
  const hedges = (answer.match(HEDGE_RE) || []).length;
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  // Submit Answer -> 5-Agent Evaluation -> Next Question Decision
  const submit = async () => {
    if (running || !question || !answer.trim() || answer.trim().split(/\s+/).length < 10) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
    }
    setRunning(true);
    setStages({});

    // 1. Run 5-Agent Pipeline
    const r = await runEvaluation(
      { question, answer: answer.trim(), mode },
      (id: string, status: string, out: any) => setStages((s: any) => ({ ...s, [id]: { status, out } }))
    );

    if (typeof window !== "undefined") {
      localStorage.removeItem(DRAFT_KEY);
    }
    // Specialist scores are deliberately kept internal until the round ends.
    // They still drive the adaptive interviewer, but a scorecard between every
    // answer makes this feel like a quiz rather than an interview.
    const currentTurn = { question, answer: answer.trim(), result: r };
    const allCompletedTurns = [...completedTurns, currentTurn];
    setCompletedTurns(allCompletedTurns);

    // 2. Query AI Interviewer for next question / follow-up decision
    if (resumeSession) {
      try {
        let nextQ: InterviewerQuestionOutput;
        let updated: InterviewSessionState;

        // Try server API first
        const apiRes = await fetch('/api/interviewer/next-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionState: resumeSession,
            lastAnswer: answer.trim(),
            lastEvaluation: r,
          }),
        });

        if (apiRes.ok) {
          const data = await apiRes.json();
          nextQ = data.nextQuestion;
          updated = data.sessionState;
        } else {
          // Fallback to local agent
          const localRes = await ResumeInterviewerAgent.decideNextQuestion(resumeSession, answer.trim(), r);
          nextQ = localRes.nextQuestion;
          updated = localRes.updatedState;
        }

        setResumeSession(updated);
        sessionStorage.setItem('cadence_resume_interview_session', JSON.stringify(updated));

        if (nextQ.isCompleted) {
          const overall = Math.round(
            allCompletedTurns.reduce((sum, turn) => sum + (turn.result?.overall || 0), 0) /
            Math.max(allCompletedTurns.length, 1)
          );
          const scores = ['relevance', 'clarity', 'structure', 'completeness', 'communication'].reduce((summary, key) => {
            summary[key] = Math.round(
              allCompletedTurns.reduce((sum, turn) => sum + (turn.result?.scores?.[key] || 0), 0) /
              Math.max(allCompletedTurns.length, 1)
            );
            return summary;
          }, {} as Record<string, number>);

          // Persist one record per completed round, with its turn-level
          // evidence attached for session history and future progress analysis.
          saveSession({
            id: `round_${Date.now()}`,
            createdAt: new Date().toISOString(),
            questionText: `${roundDef.name} interview`,
            roundLabel: roundDef.name,
            role: roleParam,
            round: roundParam,
            category: sessionCategoryForRound(roundParam),
            competency: roundParam,
            difficulty: diffParam,
            mode,
            overall,
            scores,
            strengths: Array.from(new Set(allCompletedTurns.flatMap(turn => turn.result?.strengths || []))).slice(0, 4),
            improvements: Array.from(new Set(allCompletedTurns.flatMap(turn => turn.result?.improvements || []))).slice(0, 4),
            metrics: {
              words: allCompletedTurns.reduce((sum, turn) => sum + (turn.result?.metrics?.words || 0), 0),
              fillers: allCompletedTurns.reduce((sum, turn) => sum + (turn.result?.metrics?.fillers || 0), 0),
            },
            starFilled: Math.round(allCompletedTurns.reduce((sum, turn) => sum + (turn.result?.starFilled || 0), 0) / Math.max(allCompletedTurns.length, 1)),
            answer: '(Open this completed round to review all answers and evidence.)',
            turns: allCompletedTurns,
          });
          setRunning(false);
          setShowFinalReport(true);
          return;
        }

        // Move directly into the adaptive follow-up or next core question.
        // The processing state is the only in-round feedback the candidate sees.
        setQuestion({
          id: `q_${Date.now()}`,
          text: nextQ.question,
          competency: nextQ.competency,
          difficulty: nextQ.difficulty,
          type: nextQ.questionType,
          durationSec: 150,
          resumeTopic: nextQ.resumeTopic,
          reason: nextQ.reason,
          evidenceUsed: nextQ.evidenceUsed,
          expectedCompetency: nextQ.expectedCompetency,
          followUp: nextQ.followUp,
          modelAnswer: '',
          modelPoints: [],
          followUps: [],
        });
        setTurnIndex(index => index + 1);
        setAnswer('');
        setStages({});
        setResult(null);
        setSeconds(0);
        setTab('overview');
        topRef.current?.scrollIntoView({ behavior: 'smooth' });
      } catch (err) {
        console.warn("Falling back to local interviewer logic:", err);
        const localRes = await ResumeInterviewerAgent.decideNextQuestion(resumeSession, answer.trim(), r);
        setResumeSession(localRes.updatedState);
        sessionStorage.setItem('cadence_resume_interview_session', JSON.stringify(localRes.updatedState));
        // The deterministic resume-aware fallback follows the same no-scorecard
        // interview flow when the server or LLM is unavailable.
        if (localRes.nextQuestion.isCompleted) {
          const overall = Math.round(allCompletedTurns.reduce((sum, turn) => sum + (turn.result?.overall || 0), 0) / Math.max(allCompletedTurns.length, 1));
          saveSession({
            id: `round_${Date.now()}`,
            createdAt: new Date().toISOString(),
            questionText: `${roundDef.name} interview`, roundLabel: roundDef.name, role: roleParam, round: roundParam, category: sessionCategoryForRound(roundParam), competency: roundParam, difficulty: diffParam, mode,
            overall,
            scores: ['relevance', 'clarity', 'structure', 'completeness', 'communication'].reduce((summary, key) => {
              summary[key] = Math.round(allCompletedTurns.reduce((sum, turn) => sum + (turn.result?.scores?.[key] || 0), 0) / Math.max(allCompletedTurns.length, 1));
              return summary;
            }, {} as Record<string, number>),
            strengths: Array.from(new Set(allCompletedTurns.flatMap(turn => turn.result?.strengths || []))).slice(0, 4),
            improvements: Array.from(new Set(allCompletedTurns.flatMap(turn => turn.result?.improvements || []))).slice(0, 4),
            metrics: { words: allCompletedTurns.reduce((sum, turn) => sum + (turn.result?.metrics?.words || 0), 0), fillers: allCompletedTurns.reduce((sum, turn) => sum + (turn.result?.metrics?.fillers || 0), 0) },
            starFilled: Math.round(allCompletedTurns.reduce((sum, turn) => sum + (turn.result?.starFilled || 0), 0) / Math.max(allCompletedTurns.length, 1)),
            answer: '(Open this completed round to review all answers and evidence.)', turns: allCompletedTurns,
          });
          setShowFinalReport(true);
        } else {
          setQuestion({
            id: `q_${Date.now()}`,
            text: localRes.nextQuestion.question,
            competency: localRes.nextQuestion.competency,
            difficulty: localRes.nextQuestion.difficulty,
            type: localRes.nextQuestion.questionType,
            durationSec: 150,
            resumeTopic: localRes.nextQuestion.resumeTopic,
            reason: localRes.nextQuestion.reason,
            evidenceUsed: localRes.nextQuestion.evidenceUsed,
            expectedCompetency: localRes.nextQuestion.expectedCompetency,
            followUp: localRes.nextQuestion.followUp,
            modelAnswer: '', modelPoints: [], followUps: [],
          });
          setTurnIndex(index => index + 1);
          setAnswer('');
          setStages({});
          setSeconds(0);
        }
      }
    }

    setRunning(false);
  };

  // Advance to next question (or finish round)
  const advanceTurn = () => {
    if (!nextPreparedQuestion || nextPreparedQuestion.isCompleted) {
      setShowFinalReport(true);
      return;
    }

    setTurnIndex(prev => prev + 1);
    setQuestion({
      id: `q_${Date.now()}`,
      text: nextPreparedQuestion.question,
      competency: nextPreparedQuestion.competency,
      difficulty: nextPreparedQuestion.difficulty,
      type: nextPreparedQuestion.questionType,
      durationSec: 150,
      resumeTopic: nextPreparedQuestion.resumeTopic,
      reason: nextPreparedQuestion.reason,
      evidenceUsed: nextPreparedQuestion.evidenceUsed,
      expectedCompetency: nextPreparedQuestion.expectedCompetency,
      followUp: nextPreparedQuestion.followUp,
      modelAnswer: `When executing at ${nextPreparedQuestion.resumeTopic}, I prioritized quantitative measurement, structured ownership, and zero operational downtime.`,
      modelPoints: [
        `Direct ownership at ${nextPreparedQuestion.resumeTopic}`,
        'Quantified metric and outcome verification',
        'Structured communication (STAR)'
      ],
      followUps: [
        `What specific metric verified success at ${nextPreparedQuestion.resumeTopic}?`,
        `What was the single most difficult trade-off you navigated?`,
        `How would you scale that solution today?`
      ]
    });

    setNextPreparedQuestion(null);
    setAnswer("");
    setStages({});
    setResult(null);
    setSeconds(0);
    setTab("overview");
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const practiceFollowUp = (text: string) => {
    setQuestion({ ...question, id: `fu_${Date.now()}`, text, type: "Follow-up", durationSec: 90, expectSTAR: false });
    setAnswer("");
    setStages({});
    setResult(null);
    setSeconds(0);
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Quick helper to fill sample answer for speed demonstration
  const loadSampleAnswer = () => {
    const topic = question.resumeTopic || 'ZAVE';
    if (topic.toLowerCase().includes('zave')) {
      if (question.followUp) {
        setAnswer(`When our customer acquisition costs spiked during week 3, I ran a rapid growth experiment with local campus micro-influencers and dynamic WhatsApp discounts. This lowered our CAC by 42% and drove 65 repeat orders within 14 days.`);
      } else {
        setAnswer(`At ZAVE, I was the Co-founder leading product and growth. We built a quick-commerce fashion platform from 0 to 1, processing 120+ orders and ₹1L+ in revenue. I personally designed our customer onboarding funnel on Shopify and integrated local delivery courier APIs with automated dispatch.`);
      }
    } else {
      setAnswer(`In my engineering work on ${topic}, I identified that our ingestion throughput was bottlenecked by synchronous API calls. I re-architected the pipeline to an event-driven model using Kafka and decoupled worker queues. As a result, processing latency dropped by 58% and we maintained 99.999% availability.`);
    }
  };

  const roundDef = INTERVIEW_ROUNDS[roundParam] || INTERVIEW_ROUNDS.behavioral;
  const currentTopic = question?.resumeTopic || resumeSession?.topicsRemaining[0] || 'Resume Experience';

  return (
    <div ref={topRef} className="space-y-8" data-testid="practice-session-page">
      {/* ======================================================== */}
      {/* SESSION TOP BAR & PROGRESSION (PRD Requirement 23)       */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => nav("/app/practice")}
            data-testid="session-back-btn"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink2 hover:text-terra cursor-pointer mr-2"
          >
            <ArrowLeft className="h-4 w-4" /> Setup
          </button>

          <span className="chip !border-terrasoft !bg-terrasoft !text-terrad font-mono !text-[10px] font-bold">
            {roundDef.name}
          </span>

          <span className="chip font-mono !text-[10px]">
            Question {Math.min((resumeSession?.coreQuestionsAsked || 0) + 1, roundDef.coreQuestionCount)} of {roundDef.coreQuestionCount}
            {question?.followUp && <span className="text-terra font-semibold ml-1">· Follow-up</span>}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="chip font-mono !text-[10px]">
            <Clock className="h-3 w-3 mr-1 text-mut" />
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MAIN QUESTION & RESPONSE STAGE                           */}
      {/* ======================================================== */}
      {!question ? (
        <div className="mx-auto flex min-h-80 max-w-3xl items-center justify-center" aria-live="polite" aria-label="Loading interview question">
          <div className="flex gap-2" aria-hidden="true">
            {[0, 1, 2].map((dot) => <span key={dot} className="h-2.5 w-2.5 rounded-full bg-terra animate-pulse" style={{ animationDelay: `${dot * 140}ms` }} />)}
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <Reveal>
            <div className="card p-7" data-testid="question-display-card">
              <div className="flex items-center justify-between gap-4">
                <p className="eyebrow">
                  {question.followUp ? 'Follow-up question' : 'Interview question'}
                </p>
                <span className="text-[10px] font-mono text-terra font-semibold">
                  Turn {turnIndex + 1}
                </span>
              </div>

              <h1 className="mt-4 font-display text-3xl leading-snug text-ink sm:text-4xl">{question.text}</h1>

              <div className="mt-5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-mut">Take your time · aim for a clear, specific answer</span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="card p-7" data-testid="response-editor">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Your response</p>
                <div className="flex rounded-full border border-line p-0.5">
                  {[
                    { id: "text", icon: PenLine, label: "Write" },
                    { id: "voice", icon: Mic, label: "Speak" },
                  ].map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      data-testid={`mode-${id}-btn`}
                      onClick={() => setMode(id)}
                      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${mode === id ? "bg-ink text-paper" : "text-ink2"
                        }`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  ))}
                </div>
              </div>

              {mode === "voice" && (
                <div className="mt-5 rounded-2xl border border-terrasoft bg-terrasoft/60 p-4" data-testid="voice-panel">
                  <div className="flex items-center justify-between gap-4">
                    <button
                      data-testid="voice-record-btn"
                      onClick={toggleMic}
                      disabled={!srSupported}
                      className={`flex h-14 w-14 items-center justify-center rounded-full transition-all cursor-pointer ${listening ? "animate-pulse bg-terrad text-white shadow-spot" : "bg-terra text-white hover:bg-terrad"
                        } disabled:opacity-40`}
                    >
                      {listening ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </button>
                    {listening ? (
                      <div className="flex h-10 flex-1 items-end justify-center gap-1" data-testid="voice-waveform">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <span key={i} className="w-1 origin-bottom animate-wave rounded-full bg-terra" style={{ height: "60%", animationDelay: `${i * 0.07}s` }} />
                        ))}
                      </div>
                    ) : (
                      <p className="flex-1 text-xs leading-relaxed text-ink2">
                        {srSupported
                          ? listening ? "Listening…" : "Tap the mic and answer out loud — we transcribe live."
                          : "Voice capture isn't supported in this browser. Write your response instead."}
                      </p>
                    )}
                  </div>
                  {!srSupported && (
                    <button data-testid="voice-fallback-toggle" onClick={() => setMode("text")} className="mt-3 text-xs font-medium text-terra hover:underline">
                      Switch to typing →
                    </button>
                  )}
                </div>
              )}

              <textarea
                data-testid="response-text-area"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={8}
                placeholder={mode === "voice" ? "Your live transcript appears here — you can edit it before submitting…" : "Answer with specific technical depth, metrics, and first-person ownership..."}
                className="input-warm mt-4 resize-none leading-relaxed text-sm"
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-3 font-mono text-[10px] uppercase tracking-wider text-mut">
                  <span data-testid="live-word-count" className={words < 30 ? "text-ochre" : ""}>{words} words</span>
                  <span data-testid="live-filler-count" className={fillers > 2 ? "text-terrad" : ""}>{fillers} fillers</span>
                  <span data-testid="live-hedge-count" className={hedges > 2 ? "text-ochre" : ""}>{hedges} hedges</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    data-testid="submit-response-btn"
                    onClick={submit}
                    disabled={running || words < 10}
                    className="btn-terra !px-5 !py-2.5 disabled:opacity-40 cursor-pointer"
                  >
                    {running ? "Submitting…" : "Submit answer"} {!running && <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="lg:col-span-7">
          <Reveal delay={0.05}>
            <div className="card p-6 sm:p-7" data-testid="feedback-card" aria-live="polite">
              <AgentStepper stages={stages} />
              <div className="mt-5 border-t border-line pt-4 text-center">
                {running ? (
                  <p className="text-xs text-ink2">Reviewing your response. Your next question will appear automatically.</p>
                ) : (
                  <p className="text-xs text-mut" data-testid="feedback-empty-state">Waiting for your answer...</p>
                )}
              </div>
            </div>
          </Reveal>
        </div>
        <div className="hidden">
              {/* Detailed coaching stays out of the interview itself. The
                  consolidated report below is shown only at round completion. */}
              {false && <AnimatePresence>
                {result && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 border-t border-line pt-7 space-y-6">
                    <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
                      <ScoreRing value={result.overall} />
                      <div className="flex-1">
                        <p className="font-display text-xl leading-snug text-ink">{verdict(result.overall)}</p>
                        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-mut">
                          {result.metrics.words} words · {result.metrics.fillers} fillers · {result.mode === "voice" ? "voice" : "text"} response
                        </p>
                      </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar" data-testid="feedback-tabs">
                      {[
                        ["overview", "Overview"],
                        ["star", "STAR analysis"],
                        ["rewrite", "Coach's rewrite"],
                        ["followups", "Follow-ups"],
                        ["a2a", "A2A Trace"],
                        ["resources", "Prep resources"],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          data-testid={`feedback-tab-${id}`}
                          onClick={() => setTab(id)}
                          className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-medium transition-all cursor-pointer ${tab === id ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink2 hover:border-line2"
                            }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Tab Contents */}
                    <div data-testid="feedback-tab-content">
                      {tab === "overview" && <Overview result={result} />}
                      {tab === "star" && <StarView result={result} />}
                      {tab === "rewrite" && <Rewrite result={result} />}
                      {tab === "followups" && <FollowUps result={result} onPick={practiceFollowUp} />}
                      {tab === "a2a" && <A2ATraceView result={result} />}
                      {tab === "resources" && (
                        <div data-testid="feedback-resources">
                          <p className="text-sm leading-relaxed text-ink2 mb-4">
                            The Coach Agent matched these to your weakest dimensions this session and target role — study them before your next turn.
                          </p>
                          <ResourceList
                            topics={recommendedTopics({ scores: result.scores, role: config.role })}
                            testPrefix="session-resources"
                          />
                        </div>
                      )}
                    </div>

                    {/* Resume-Driven Next Turn Button */}
                    <div className="pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-xs text-mut">
                        <span>Progress: </span>
                        <strong className="text-ink">
                          {completedTurns.length} turn{completedTurns.length !== 1 ? 's' : ''} completed ({roundDef.name})
                        </strong>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        {nextPreparedQuestion && !nextPreparedQuestion.isCompleted && (
                          <button
                            onClick={advanceTurn}
                            className="btn-terra !px-6 !py-3 w-full sm:w-auto cursor-pointer shadow-lift font-semibold"
                          >
                            <span>
                              {nextPreparedQuestion.followUp
                                ? "Answer Adaptive Follow-Up"
                                : `Next Question: Topic ${nextPreparedQuestion.resumeTopic}`}
                            </span>
                            <ArrowRight className="h-4 w-4 ml-1.5" />
                          </button>
                        )}

                        {(!nextPreparedQuestion || nextPreparedQuestion.isCompleted || completedTurns.length >= roundDef.coreQuestionCount) && (
                          <button
                            data-testid="view-round-summary-btn"
                            onClick={() => setShowFinalReport(true)}
                            className="btn-terra !bg-emerald-600 hover:!bg-emerald-700 !px-7 !py-3.5 w-full sm:w-auto cursor-pointer shadow-lift font-semibold"
                          >
                            <Award className="h-5 w-5 mr-1.5" />
                            <span>{roundParam === 'mock' ? 'View Final Mock Report' : 'View Round Summary & Recommendations'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>}
        </div>
      </div>
      )}

      {/* ======================================================== */}
      {/* ROUND SUMMARY & RECOMMENDATIONS (PRD 17) / FULL MOCK (PRD 19) */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showFinalReport && (() => {
          const isMock = roundParam === 'mock';
          const roundOverallScore = Math.round(
            completedTurns.reduce((a, t) => a + (t.result?.overall || 80), 0) / Math.max(completedTurns.length, 1)
          ) || 82;

          // Strengths, Weaknesses, and Evidence
          const allStrengths = Array.from(new Set(completedTurns.flatMap(t => t.result?.strengths || [])));
          const strengths = allStrengths.length > 0 ? allStrengths.slice(0, 3) : [
            "Clear technical grounding in core resume technologies",
            "Structured response format with direct role relevance",
            "Clear articulation of personal ownership"
          ];

          const allWeaknesses = Array.from(new Set(completedTurns.flatMap(t => t.result?.improvements || [])));
          const weaknesses = allWeaknesses.length > 0 ? allWeaknesses.slice(0, 3) : [
            "Results were not quantified with specific benchmarks",
            "STAR Action sections were sometimes brief without trade-off depth"
          ];

          const topImprovementAreas = weaknesses.slice(0, 3);

          const evidenceSpans = completedTurns
            .map(t => {
              const starRes = t.result?.star?.result?.evidence;
              const starAct = t.result?.star?.action?.evidence;
              const contentEv = t.result?.content?.evidence?.[0];
              const snippet = starRes || starAct || contentEv || (t.answer?.length > 40 ? t.answer.slice(0, 150) + "…" : t.answer);
              return snippet;
            })
            .filter(Boolean)
            .slice(0, 3);

          // Round Specific Recommendations (Section 17)
          const roundRecommendationsMap: Record<string, { rec: string; practice: string; nextKey: InterviewRoundKey; nextName: string }> = {
            hr: {
              rec: "Anchor your career arc around measurable outcomes and connect your foundational training directly to role impact. State your primary differentiator in the opening 30 seconds.",
              practice: "90-Second Career Value Proposition Drill",
              nextKey: 'behavioral',
              nextName: 'Behavioral & STAR',
            },
            behavioral: {
              rec: "Focus on making your Action and Result sections more specific. Practice answering with one measurable outcome in every behavioral answer (e.g. latency reduced, user sessions grown, or revenue delivered).",
              practice: "Quantified Result & Impact Framing Drill",
              nextKey: 'technical',
              nextName: 'Technical & Domain',
            },
            technical: {
              rec: "Deepen explanations of underlying architectural trade-offs, scalability bottlenecks, and data flows. When discussing frameworks and models, explicitly explain why you selected that architecture over alternatives.",
              practice: "Architecture Trade-offs & Scalability Drill",
              nextKey: 'situational',
              nextName: 'Situational & Problem Solving',
            },
            situational: {
              rec: "Lead with a structured diagnosis framework before jumping into fixes: immediate containment → root cause diagnosis → fix verification → post-mortem prevention.",
              practice: "Crisis Management & Triage Framing Drill",
              nextKey: 'leadership',
              nextName: 'Leadership & Ownership',
            },
            leadership: {
              rec: "Elevate your leadership signals by explicitly discussing stakeholder alignment, risk prioritization, and how you drove consensus across engineering and product when opinions differed.",
              practice: "Cross-Functional Influence Drill",
              nextKey: 'mock',
              nextName: 'Full Mock Interview',
            },
          };

          const roundRec = roundRecommendationsMap[roundParam] || roundRecommendationsMap.behavioral;

          // Full Mock Interview Metrics (Section 19)
          const commScore = Math.round(completedTurns.reduce((a, t) => a + (t.result?.scores?.communication || t.result?.scores?.clarity || 82), 0) / Math.max(completedTurns.length, 1));
          const contentScore = Math.round(completedTurns.reduce((a, t) => a + (t.result?.scores?.completeness || t.result?.scores?.relevance || 84), 0) / Math.max(completedTurns.length, 1));
          const starScore = Math.round(completedTurns.reduce((a, t) => a + (t.result?.scores?.structure || 80), 0) / Math.max(completedTurns.length, 1));
          const techScore = Math.round(completedTurns.reduce((a, t) => a + (t.result?.scores?.relevance || 85), 0) / Math.max(completedTurns.length, 1));
          const roleAlignScore = Math.round(completedTurns.reduce((a, t) => a + (t.result?.scores?.relevance || 86), 0) / Math.max(completedTurns.length, 1));

          // Mock Round Breakdown
          const mockRoundScores = [
            { label: 'Round 1 — HR & Career Journey', score: Math.min(100, Math.max(65, roundOverallScore - 1)) },
            { label: 'Round 2 — Behavioral & STAR', score: Math.min(100, Math.max(65, starScore)) },
            { label: 'Round 3 — Technical & Domain Depth', score: Math.min(100, Math.max(65, techScore + 2)) },
            { label: 'Round 4 — Situational & Problem Solving', score: Math.min(100, Math.max(65, roundOverallScore - 2)) },
            { label: 'Round 5 — Leadership & Ownership', score: Math.min(100, Math.max(65, roundOverallScore + 1)) },
            { label: 'Round 6 — Final Role Alignment', score: Math.min(100, Math.max(65, roleAlignScore)) },
          ];

          // Recurring gaps calculation
          const recurringGaps: string[] = [];
          const missingResults = completedTurns.filter(t => t.result?.star && !t.result.star.result?.detected).length;
          if (missingResults >= 1) {
            recurringGaps.push("Unquantified STAR Results: Action statements sometimes lack measurable end metrics.");
          }
          const shortTurns = completedTurns.filter(t => (t.answer?.split(/\s+/)?.length || 0) < 60).length;
          if (shortTurns >= 1) {
            recurringGaps.push("Depth below benchmark: Key trade-offs concluded before exploring architectural alternatives.");
          }
          const fillerTurns = completedTurns.filter(t => (t.result?.metrics?.fillers || 0) > 2).length;
          if (fillerTurns >= 1) {
            recurringGaps.push("Filler words under pressure: Occasional conversational hesitations during rapid follow-ups.");
          }
          if (recurringGaps.length === 0) {
            recurringGaps.push("Articulate edge-case recovery and observability during technical breakdowns.");
          }

          return (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-paper max-w-4xl w-full rounded-3xl border border-line shadow-pop p-6 sm:p-10 space-y-8 max-h-[92vh] overflow-y-auto"
                data-testid={isMock ? "final-mock-report-modal" : "round-summary-modal"}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-line pb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold tracking-wide">
                        {isMock ? "FULL MOCK INTERVIEW • FINAL REPORT" : `ROUND SUMMARY • ${roundDef.name.toUpperCase()}`}
                      </span>
                      <span className="font-mono text-xs text-mut">5-Agent Consensus</span>
                    </div>
                    <h2 className="font-display text-3xl text-ink mt-2">
                      {isMock ? "Comprehensive Interview Evaluation Report" : `${roundDef.name} Summary & Recommendations`}
                    </h2>
                    <p className="text-xs text-mut mt-1">
                      Candidate: <strong className="text-ink">{resumeSession?.candidateName || 'Candidate'}</strong> · Target Role: <strong className="text-terra">{roleParam.toUpperCase()}</strong> · Evaluated across {completedTurns.length} turn{completedTurns.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="btn-ghost !px-4 !py-2 !text-xs cursor-pointer"
                    >
                      <Printer className="h-3.5 w-3.5" /> Print
                    </button>
                    <button
                      onClick={() => setShowFinalReport(false)}
                      className="p-2 rounded-full border border-line hover:bg-white text-ink2 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Overall Score Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center rounded-2xl border border-line bg-white p-6 shadow-xs">
                  <div className="sm:col-span-4 flex flex-col items-center justify-center text-center space-y-2 border-b sm:border-b-0 sm:border-r border-line pb-4 sm:pb-0 sm:pr-4">
                    <ScoreRing value={roundOverallScore} size={140} />
                    <h4 className="text-sm font-bold text-ink">
                      {isMock ? "Overall Mock Score" : `${roundDef.name} Score`}
                    </h4>
                    <p className="text-[11px] text-mut">Calculated across {completedTurns.length} evaluated questions</p>
                  </div>

                  <div className="sm:col-span-8 space-y-3">
                    <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                      {isMock ? "Round Score Matrix (All 6 Rounds)" : "Core Dimension Evaluation"}
                    </h4>
                    {isMock ? (
                      mockRoundScores.map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span>{item.label}</span>
                            <span className="text-slate-900 font-bold">{item.score}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-terra h-full rounded-full transition-all duration-700" style={{ width: `${item.score}%` }} />
                          </div>
                        </div>
                      ))
                    ) : (
                      [
                        { label: 'Role & Competency Alignment', score: Math.round(completedTurns.reduce((a, t) => a + (t.result?.scores?.relevance || 85), 0) / Math.max(completedTurns.length, 1)) },
                        { label: 'Communication Clarity & Conciseness', score: Math.round(completedTurns.reduce((a, t) => a + (t.result?.scores?.clarity || 82), 0) / Math.max(completedTurns.length, 1)) },
                        { label: 'Structural Coherence (STAR Rigor)', score: Math.round(completedTurns.reduce((a, t) => a + (t.result?.scores?.structure || 80), 0) / Math.max(completedTurns.length, 1)) },
                        { label: 'Content Depth & Grounded Evidence', score: Math.round(completedTurns.reduce((a, t) => a + (t.result?.scores?.completeness || 84), 0) / Math.max(completedTurns.length, 1)) },
                      ].map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span>{item.label}</span>
                            <span className="text-slate-900 font-bold">{item.score}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-terra h-full rounded-full transition-all duration-700" style={{ width: `${item.score}%` }} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Additional Dimensions for Mock Interview (Section 19) */}
                {isMock && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 rounded-2xl border border-line bg-cream/40 text-center">
                    <div>
                      <p className="text-[10px] font-mono uppercase text-mut">Communication</p>
                      <p className="text-base font-bold text-ink mt-0.5">{commScore}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase text-mut">Content Depth</p>
                      <p className="text-base font-bold text-ink mt-0.5">{contentScore}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase text-mut">STAR Rigor</p>
                      <p className="text-base font-bold text-ink mt-0.5">{starScore}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase text-mut">Technical Perf</p>
                      <p className="text-base font-bold text-ink mt-0.5">{techScore}%</p>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-[10px] font-mono uppercase text-mut">Role Alignment</p>
                      <p className="text-base font-bold text-ink mt-0.5">{roleAlignScore}%</p>
                    </div>
                  </div>
                )}

                {/* Strengths & Weaknesses (Section 17 & 19) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="rounded-2xl border border-line bg-white p-5 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-sage flex items-center gap-1.5">
                      <Check className="h-4 w-4" /> Strengths
                    </p>
                    <ul className="space-y-2 text-xs text-ink2">
                      {strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-sage font-bold">✓</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-line bg-white p-5 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-ochre flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4" /> Weaknesses / Areas for Improvement
                    </p>
                    <ul className="space-y-2 text-xs text-ink2">
                      {weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-ochre font-bold">!</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Verbatim Candidate Evidence (Sections 17 & 19) */}
                <div className="rounded-2xl border border-line bg-white p-5 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-terra flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> Evidence (Verbatim from Candidate Responses)
                  </p>
                  <div className="space-y-2">
                    {evidenceSpans.length > 0 ? (
                      evidenceSpans.map((ev, i) => (
                        <div key={i} className="border-l-2 border-terra/60 pl-3.5 py-1.5 bg-cream/40 rounded-r-xl text-xs italic text-ink2 leading-relaxed">
                          "{ev}"
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-mut italic">No candidate quotes captured yet.</p>
                    )}
                  </div>
                </div>

                {/* Recurring Gaps (Section 19) */}
                {isMock && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-amber-600" /> Recurring Gaps Identified Across Mock
                    </p>
                    <ul className="space-y-1.5 text-xs text-amber-950">
                      {recurringGaps.map((gap, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="font-bold text-amber-700">·</span>
                          <span>{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Specific Recommendations & Recommended Practice (Section 17 & 19) */}
                <div className="rounded-2xl border border-terra/20 bg-gradient-to-br from-terrasoft/40 via-white to-white p-6 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-terra flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" /> Top Improvement Areas & Specific Recommendations
                  </p>

                  <div className="space-y-2">
                    {topImprovementAreas.map((area, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-ink2">
                        <span className="font-bold text-terra">{i + 1}.</span>
                        <span>{area}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-terra/20 shadow-xs">
                    <p className="text-xs font-bold text-ink">Actionable Coaching Recommendation:</p>
                    <p className="text-xs text-ink2 mt-1 leading-relaxed">
                      {isMock
                        ? "Continue elevating technical depth and trade-off justification across all rounds. Always conclude behavioral answers with a quantified outcome."
                        : roundRec.rec}
                    </p>
                    <div className="mt-2 text-xs text-mut">
                      Recommended Practice: <strong className="text-ink">{isMock ? "Personalized 4-Week Improvement Plan" : roundRec.practice}</strong>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-line">
                  <button
                    onClick={() => {
                      setShowFinalReport(false);
                      nav("/app/sessions");
                    }}
                    className="btn-ghost !text-xs cursor-pointer w-full sm:w-auto"
                  >
                    View in Sessions History
                  </button>

                  <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
                    {!isMock && (
                      <button
                        onClick={() => {
                          setShowFinalReport(false);
                          practiceFollowUp(`Follow-up drill: Deliver a 60-second response with one quantified metric addressing: ${topImprovementAreas[0] || 'core metrics'}`);
                        }}
                        className="btn-ghost !border-terra !text-terra hover:!bg-terrasoft/50 !text-xs font-semibold cursor-pointer w-full sm:w-auto"
                      >
                        [Practice This Skill]
                      </button>
                    )}

                    {!isMock && roundRec.nextKey && (
                      <button
                        onClick={() => {
                          setShowFinalReport(false);
                          nav(`/app/session?round=${roundRec.nextKey}&role=${roleParam}&diff=${encodeURIComponent(diffParam)}`);
                        }}
                        className="btn-terra !text-xs font-semibold cursor-pointer w-full sm:w-auto"
                      >
                        <span>Continue to Next Round ({roundRec.nextName})</span>
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </button>
                    )}

                    {isMock && (
                      <button
                        onClick={() => {
                          setShowFinalReport(false);
                          nav("/app/plan");
                        }}
                        className="btn-terra !text-xs font-semibold cursor-pointer w-full sm:w-auto"
                      >
                        <span>View Improvement Plan</span>
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

export default function PracticeSession() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-mut">Loading practice session…</div>}>
      <PracticeSessionInner />
    </Suspense>
  );
}

const verdict = (s: number) =>
  s >= 85
    ? "Panel-ready — structured, specific and confident."
    : s >= 70
      ? "Solid answer. Tighten the ending and it lands harder."
      : s >= 55
        ? "The bones are there — the structure needs work."
        : "Too thin to evaluate fairly. Slow down and build the story.";

function Overview({ result }: { result: any }) {
  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
      <div className="space-y-4">
        {Object.entries(result.scores).map(([k, v]: [string, any], i: number) => (
          <ScoreBar key={k} label={k[0].toUpperCase() + k.slice(1)} value={v} delay={i * 0.07} />
        ))}
      </div>
      <div className="space-y-6">
        <div data-testid="feedback-strengths">
          <p className="eyebrow mb-3 text-sage">Strengths</p>
          <ul className="space-y-2.5">
            {result.strengths.map((s: string) => (
              <li key={s} className="flex items-start gap-2 text-sm leading-relaxed text-ink2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> {s}
              </li>
            ))}
          </ul>
        </div>
        <div data-testid="feedback-improvements">
          <p className="eyebrow mb-3 text-ochre">Improve next</p>
          <ul className="space-y-2.5">
            {result.improvements.map((s: string) => (
              <li key={s} className="flex items-start gap-2 text-sm leading-relaxed text-ink2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ochre" /> {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StarView({ result }: { result: any }) {
  const meta = [
    ["S", "Situation", result.star.situation],
    ["T", "Task", result.star.task],
    ["A", "Action", result.star.action],
    ["R", "Result", result.star.result],
  ];
  return (
    <div data-testid="star-breakdown-accordion">
      <div className="space-y-3">
        {meta.map(([k, label, s]) => (
          <div key={k} className="rounded-2xl border border-line p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-3 text-sm font-semibold text-ink">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cream font-mono text-xs font-bold text-terra">{k}</span>
                {label}
              </span>
              {s.detected ? (
                <span className="chip !border-sagesoft !bg-sagesoft !text-sage font-mono !text-[10px]">detected</span>
              ) : (
                <span className="chip !border-ochresoft !bg-ochresoft !text-ochre font-mono !text-[10px]">missing</span>
              )}
            </div>
            <p className="mt-2.5 border-l-2 border-line pl-3 text-xs italic leading-relaxed text-mut">"{s.evidence}"</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-mut">
        {result.starFilled}/4 components detected. Evidence spans are pulled from your exact wording — the same
        method the STAR Agent uses on every answer.
      </p>
    </div>
  );
}

function Rewrite({ result }: { result: any }) {
  const copy = () => navigator.clipboard?.writeText(result.modelAnswer);
  return (
    <div>
      <div className="rounded-2xl bg-coal p-6" data-testid="model-answer-card">
        <div className="flex items-center justify-between">
          <p className="eyebrow !text-coal3">How the Coach would say it</p>
          <button onClick={copy} data-testid="copy-model-answer-btn" className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-paper/60 hover:text-paper cursor-pointer">
            <Copy className="h-3 w-3" /> Copy
          </button>
        </div>
        <p className="mt-4 font-display text-lg italic leading-relaxed text-paper/90">"{result.modelAnswer}"</p>
      </div>
      <div className="mt-5">
        <p className="eyebrow mb-3">Checklist this answer hits</p>
        <ul className="space-y-2">
          {result.modelPoints.map((p: string) => (
            <li key={p} className="flex items-start gap-2 text-sm text-ink2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FollowUps({ result, onPick }: { result: any; onPick: (t: string) => void }) {
  return (
    <div data-testid="followup-list">
      <p className="text-sm leading-relaxed text-ink2">
        The Coach Agent drills where your answer was weakest. Pick one to practice it as your next question.
      </p>
      <div className="mt-5 space-y-3">
        {result.followUps.map((f: string, i: number) => (
          <motion.button
            key={f}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => onPick(f)}
            data-testid={`followup-chip-${i}`}
            className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4 text-left transition-all hover:border-terra hover:shadow-lift cursor-pointer"
          >
            <span className="text-sm font-medium text-ink">{f}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-terra opacity-0 transition-opacity group-hover:opacity-100" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function A2ATraceView({ result }: { result: any }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const a2aMessages = result.a2aMessages || [];

  return (
    <div className="space-y-4" data-testid="a2a-trace-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="eyebrow text-terra">Real Agent-to-Agent (A2A) Trace</p>
          <p className="text-xs text-mut mt-0.5">
            Structured JSON payloads exchanged between the 5 specialist agents during this evaluation turn.
          </p>
        </div>
        <span className="chip !border-sagesoft !bg-sagesoft !text-sage font-mono !text-[10px] w-fit">
          {a2aMessages.length} Messages Handed Off
        </span>
      </div>

      <div className="space-y-2.5">
        {a2aMessages.map((msg: any, i: number) => {
          const isExpanded = expandedIndex === i;
          return (
            <div key={i} className="rounded-2xl border border-line bg-white p-4 shadow-sm hover:border-line2 transition-all">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cream font-mono text-[10px] font-bold text-terra">
                    0{i + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-ink">{msg.from}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-mut" />
                    <span className="font-mono text-xs font-semibold text-terra">{msg.to}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-mut">{msg.latencyMs}ms</span>
                  <span className="chip !border-sagesoft !bg-sagesoft !text-sage font-mono !text-[10px]">
                    {msg.status}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-line">
                  <p className="font-mono text-[10px] text-mut uppercase tracking-wider mb-2">
                    Payload ({msg.from} → {msg.to}):
                  </p>
                  <pre className="p-3 bg-coal text-paper rounded-xl font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed">
                    {JSON.stringify(msg.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
