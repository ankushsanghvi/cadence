// @ts-nocheck
'use client';

import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/routerCompat";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, Mic, Upload, FileText, CheckCircle2, 
  Sparkles, Building2, User, ChevronRight, Check, Compass, Award, ShieldCheck
} from "lucide-react";
import { ROLES, DIFFICULTIES } from "@/lib/mockData";
import { parseResumeText, parseJDText, analyzeResumeJDMatch, normalizeResumeProfile, isCorruptOrGarbageProfile } from "@/lib/resumeParser";
import { 
  INTERVIEW_ROUNDS, 
  InterviewRoundKey, 
  extractResumeKnowledge, 
  buildEvidenceGraph 
} from "@/lib/resume/resumeKnowledge";
import { initializeSessionState, ResumeInterviewerAgent } from "@/agents/resumeInterviewerAgent";
import { DEFAULT_PROFILE, PROFILE_KEY, createEmptyProfile } from "@/lib/api";
import { Reveal } from "@/components/ui-bits";

export default function PracticeSetup() {
  const nav = useNavigate();

  // Custom Upload Inputs
  const [resumeText, setResumeText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [showUploadArea, setShowUploadArea] = useState<boolean>(false);
  const [showEvidence, setShowEvidence] = useState<boolean>(false);
  const [isLaunchingInterview, setIsLaunchingInterview] = useState(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Practice Configuration
  const [role, setRole] = useState("aiml");
  const [selectedRoundKey, setSelectedRoundKey] = useState<InterviewRoundKey>('hr');
  const [difficulty, setDifficulty] = useState("Standard");

  // Load candidate profile from storage on mount if available
  const [activeProfile, setActiveProfile] = useState<any>(createEmptyProfile());
  const [hasProfile, setHasProfile] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(PROFILE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (isCorruptOrGarbageProfile(parsed)) {
            console.warn("Discarding corrupt binary profile from localStorage");
            localStorage.removeItem(PROFILE_KEY);
            localStorage.removeItem('cadence_profile_source');
            localStorage.removeItem('cadence_resume_diagnostic');
            setActiveProfile(createEmptyProfile());
            setHasProfile(false);
            return;
          }
          const normalized = normalizeResumeProfile(parsed);
          const name = String(normalized.name || normalized.basics?.fullName || '').trim();
          const hasData = Boolean(
            (name && !name.toLowerCase().includes('candidate') && !name.toLowerCase().includes('flatedecode')) ||
            (normalized.workExperience && normalized.workExperience.length > 0) || 
            (normalized.experience && normalized.experience.length > 0) ||
            (normalized.projects && normalized.projects.length > 0)
          );
          if (hasData) {
            setActiveProfile(normalized);
            setHasProfile(true);
            // Default role alignment based on candidate background
            const allText = JSON.stringify(normalized).toLowerCase();
            if (allText.includes("machine learning") || allText.includes("ai/ml") || allText.includes("llm")) {
              setRole("aiml");
            } else if (allText.includes("product lead") || allText.includes("product manager")) {
              setRole("pm");
            } else {
              setRole("swe");
            }
          } else {
            setActiveProfile(createEmptyProfile());
            setHasProfile(false);
          }
        } catch (e) {
          console.error("Failed to parse stored profile", e);
          setActiveProfile(createEmptyProfile());
          setHasProfile(false);
        }
      } else {
        setActiveProfile(createEmptyProfile());
        setHasProfile(false);
      }
    }
  }, []);

  const handleResetCleanState = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PROFILE_KEY);
      localStorage.removeItem('cadence_profile_source');
      localStorage.removeItem('cadence_resume_diagnostic');
      localStorage.removeItem('cadence_sessions_v1');
      localStorage.removeItem('cadence_profile_confirmed');
      sessionStorage.removeItem('cadence_resume_interview_session');
      sessionStorage.removeItem('cadence_active_interview_session');
      setActiveProfile(createEmptyProfile());
      setHasProfile(false);
      setResumeText('');
      setFileName('');
    }
  };

  // Build active resume evidence graph
  const activeKnowledge = extractResumeKnowledge(activeProfile, resumeText || activeProfile.summary);
  const activeEvidence = activeKnowledge.evidenceGraph;
  const currentRound = INTERVIEW_ROUNDS[selectedRoundKey] || INTERVIEW_ROUNDS.hr;

  // File Upload Handler (supports PDF/DOCX via server extraction + plain text)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setIsUploading(true);

    if (file.name.toLowerCase().match(/\.(pdf|docx)$/)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/onboarding/resume", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (data.profile && !isCorruptOrGarbageProfile(data.profile)) {
          const normalized = normalizeResumeProfile(data.profile);
          setActiveProfile(normalized);
          setHasProfile(true);
          if (typeof window !== 'undefined') {
            localStorage.setItem(PROFILE_KEY, JSON.stringify(normalized));
            localStorage.setItem('cadence_profile_source', data.source || 'ai');
          }
        }
      } catch (err) {
        console.error("Failed to parse file", err);
      } finally {
        setIsUploading(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setResumeText(content);
        if (content && !content.includes('%PDF-') && !content.includes('FlateDecode')) {
          const parsedResume = parseResumeText(content, activeProfile);
          if (!isCorruptOrGarbageProfile(parsedResume)) {
            const customProf = normalizeResumeProfile(parsedResume);
            setActiveProfile(customProf);
            setHasProfile(true);
            if (typeof window !== 'undefined') {
              localStorage.setItem(PROFILE_KEY, JSON.stringify(customProf));
              localStorage.setItem('cadence_profile_source', 'uploaded');
            }
          }
        }
        setIsUploading(false);
      };
      reader.readAsText(file);
    }
  };

  const startSession = async () => {
    if (isLaunchingInterview) return;
    setIsLaunchingInterview(true);
    const knowledge = extractResumeKnowledge(activeProfile, resumeText || activeProfile.summary);
    const sessionState = initializeSessionState(knowledge, selectedRoundKey, role, difficulty);

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('cadence_resume_interview_session', JSON.stringify(sessionState));
      sessionStorage.removeItem('cadence_active_interview_session');
      sessionStorage.removeItem('cadence_prepared_opening_question');
    }

    // Prepare the opening turn before leaving setup. The candidate enters the
    // interview only after the server has a resume-grounded question ready.
    let preparedQuestion: any = null;
    let preparedState: any = null;
    try {
      const response = await fetch('/api/interviewer/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionState }),
      });
      if (response.ok) {
        const prepared = await response.json();
        if (prepared.nextQuestion && prepared.sessionState) {
          preparedQuestion = prepared.nextQuestion;
          preparedState = prepared.sessionState;
        }
      }
    } catch (error) {
      // The session page retains its deterministic, resume-aware fallback.
      console.warn('Opening question prefetch failed; using interview fallback.', error);
    }

    if (!preparedQuestion) {
      const fallback = await ResumeInterviewerAgent.decideNextQuestion(sessionState);
      preparedQuestion = fallback.nextQuestion;
      preparedState = fallback.updatedState;
    }

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('cadence_resume_interview_session', JSON.stringify(preparedState));
      sessionStorage.setItem('cadence_prepared_opening_question', JSON.stringify(preparedQuestion));
    }

    nav(`/app/session?round=${selectedRoundKey}&role=${role}&diff=${encodeURIComponent(difficulty)}`);
  };

  const candidateDisplayName = activeProfile.name || activeProfile.basics?.fullName || "Candidate";

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-16" data-testid="practice-setup-page">
      <Reveal>
        <p className="eyebrow">Resume-Driven Practice Arena</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
          Interview with an AI that has <em className="italic text-terra">read your resume</em>.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink2">
          Your interview is fully personalized using your actual companies, ventures, projects, technologies, and metrics.
          The AI Interviewer probes claims, tests trade-offs, and follows up adaptively based on your responses.
        </p>
      </Reveal>

      {/* Resume Grounding Card */}
      {hasProfile ? (
        <Reveal delay={0.03}>
          <div className="card border-l-4 border-l-sage p-5 sm:p-6" data-testid="resume-intelligence-card">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sagesoft text-sage">
                  <Check className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl text-ink">Resume Intelligence</h2>
                    <span className="chip !border-sagesoft !bg-sagesoft !text-sage font-mono !text-[9px]">Verified resume</span>
                    <span className="chip font-mono !text-[9px]">{activeEvidence.length} evidence nodes</span>
                  </div>
                  <p className="mt-1 text-xs text-ink2">Your interview is grounded in your actual resume background.</p>
                  <p className="mt-2 text-[11px] text-mut"><span className="font-medium text-ink2">{candidateDisplayName}</span> · resume-grounded profile</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <button onClick={() => setShowUploadArea(!showUploadArea)} className="font-medium text-terra hover:underline cursor-pointer">
                  {showUploadArea ? "Hide updater" : "Update resume"}
                </button>
                <button onClick={handleResetCleanState} className="border-l border-line pl-3 font-medium text-rose-700 hover:text-rose-900 cursor-pointer" title="Wipe current profile and start fresh">
                  Clear profile
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className="eyebrow mb-2">Experience extracted</p>
                <div className="flex flex-wrap gap-2">
                  {activeEvidence.filter(item => item.category === 'experience' || item.category === 'venture').slice(0, 3).map((item) => (
                    <span key={item.id} className="rounded-lg border border-line bg-cream/40 px-2.5 py-1.5 text-[11px] text-ink2">
                      <strong className="font-medium text-ink">{item.topic}</strong>{item.role ? ` — ${item.role}` : ''}
                    </span>
                  ))}
                  {activeEvidence.filter(item => item.category === 'experience' || item.category === 'venture').length === 0 && <span className="text-xs text-mut">Projects and skills are ready to ground your interview.</span>}
                </div>
                {activeEvidence.length > 3 && (
                  <button onClick={() => setShowEvidence(value => !value)} className="mt-2 text-[11px] font-medium text-terra hover:underline cursor-pointer">
                    {showEvidence ? 'Hide evidence' : `View all ${activeEvidence.length} evidence nodes`}
                  </button>
                )}
                {showEvidence && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {activeEvidence.slice(3).map((item) => <span key={item.id} className="text-[10px] text-mut">• {item.topic}</span>)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-mut sm:justify-end">
                <ShieldCheck className="h-3.5 w-3.5 text-sage" /> Zero-hallucination grounding
              </div>
            </div>
          </div>
        </Reveal>
      ) : (
        <Reveal delay={0.03}>
          <div className="card border-l-4 border-l-terra p-5 sm:p-6" data-testid="resume-onboarding-card">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terrasoft text-terra">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="eyebrow">Personalize your interview</p>
                  <h3 className="mt-1 font-display text-xl text-ink">Add your resume for a tailored practice round.</h3>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink2">
                    We’ll use your actual experience, projects, and skills to ask more relevant questions and deliver grounded feedback. Upload or paste it below when you’re ready.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-wider text-mut">
                    <span>Resume-grounded questions</span>
                    <span>Profile review before practice</span>
                    <span>PDF, DOCX, or text</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {/* Optional Upload / Update Area */}
      {(!hasProfile || showUploadArea) && (
        <Reveal delay={0.06}>
          <div className="card p-6 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Upload or Paste Resume</p>
                <span className="text-[10px] text-mut font-mono">PDF, DOCX, TXT</span>
              </div>
              <label className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-line hover:border-terra bg-white/70 transition-all cursor-pointer group">
                <Upload className="h-6 w-6 text-terra group-hover:scale-110 transition-transform mb-2" />
                <span className="text-xs font-semibold text-ink">
                  {fileName || 'Drop your resume file or browse'}
                </span>
                <span className="text-[10px] text-mut mt-0.5">Click to select PDF or text file</span>
                <input type="file" accept=".txt,.pdf,.docx,.md" onChange={handleFileUpload} className="hidden" />
              </label>
              <textarea
                rows={4}
                value={resumeText}
                onChange={(e) => {
                  setResumeText(e.target.value);
                  if (e.target.value.trim().length > 30) {
                    const parsed = parseResumeText(e.target.value, activeProfile);
                    const customProf = {
                      ...activeProfile,
                      name: parsed.candidateName || activeProfile.name,
                      summary: parsed.summary || activeProfile.summary,
                      technical_skills: parsed.skills || activeProfile.technical_skills,
                      projects: parsed.projects.map(p => ({ name: p.title, summary: p.description })),
                    };
                    setActiveProfile(customProf);
                    setHasProfile(true);
                  }
                }}
                placeholder="Or paste resume text directly here..."
                className="input-warm text-xs resize-none"
              />
            </div>
          </div>
        </Reveal>
      )}

      {/* Section 01: Target Role */}
      <Reveal delay={0.07}>
        <section>
          <p className="eyebrow mb-3.5">01 · Target role</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5" data-testid="practice-role-select">
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                className={`rounded-2xl border p-3.5 text-left transition-all duration-200 cursor-pointer ${
                  role === r.id ? "border-terra bg-white shadow-lift ring-1 ring-terra" : "border-line bg-white/60 hover:border-line2"
                }`}
              >
                <p className="text-xs font-bold text-ink truncate">{r.label}</p>
                <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-mut">{r.tag}</p>
              </button>
            ))}
          </div>
        </section>
      </Reveal>

      {/* Section 02: The 6 Resume-Driven Interview Rounds (PRD Section 7) */}
      <Reveal delay={0.09}>
        <section>
          <div className="flex items-center justify-between mb-3.5">
            <p className="eyebrow">02 · Select Interview Round</p>
            <span className="text-xs text-mut">All rounds are resume-grounded</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="practice-category-select">
            {Object.values(INTERVIEW_ROUNDS).map((r) => (
              <button
                key={r.key}
                onClick={() => setSelectedRoundKey(r.key)}
                className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                  selectedRoundKey === r.key
                    ? "border-terra bg-white shadow-lift ring-1 ring-terra"
                    : "border-line bg-white/60 hover:border-line2"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase font-bold text-terra">
                    {r.coreQuestionCount} Core Questions
                  </span>
                  <span className="font-mono text-[10px] text-mut">{r.estimatedDuration}</span>
                </div>
                <p className="text-sm font-bold text-ink mt-1.5">{r.name}</p>
                <p className="text-xs text-mut mt-1 line-clamp-2 leading-relaxed">{r.description}</p>
              </button>
            ))}
          </div>
        </section>
      </Reveal>

      {/* Section 03: Difficulty */}
      <Reveal delay={0.11}>
        <section>
          <p className="eyebrow mb-3.5">03 · Seniority calibration</p>
          <div className="flex flex-wrap gap-2.5">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                data-testid={`chip-${d.toLowerCase()}`}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  difficulty === d ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink2 hover:border-line2"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </section>
      </Reveal>

      {/* Section 04: Interview Start Confirmation Screen (PRD Requirement 22) */}
      <Reveal delay={0.13}>
        <div className="rounded-3xl border border-terra/30 bg-gradient-to-br from-terrasoft/50 via-white to-cream p-7 sm:p-9 shadow-lift space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-line/60 pb-6">
            <div>
              <span className="px-3 py-1 rounded-full bg-terra text-white text-[10px] font-mono uppercase tracking-wider font-bold">
                {currentRound.name.toUpperCase()}
              </span>
              <h3 className="font-display text-2xl text-ink mt-2">
                {currentRound.coreQuestionCount} Core Questions + Adaptive Follow-Ups
              </h3>
              <p className="text-xs text-mut mt-1">
                Estimated duration: <strong className="text-ink">{currentRound.estimatedDuration}</strong> · Candidate: <strong className="text-ink">{candidateDisplayName}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-terra text-white shadow-sm">
                <Mic className="h-5 w-5" />
              </span>
              <div className="text-xs text-ink2">
                <p className="font-semibold text-ink">Voice or Text Input</p>
                <p className="text-mut">Spoken mic input or typed answers</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-ink2">
            <div className="flex items-start gap-2 bg-white/70 p-3.5 rounded-2xl border border-line">
              <CheckCircle2 className="h-4 w-4 text-sage mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-ink">Personalized using your resume</p>
                <p className="text-[11px] text-mut mt-0.5">
                  {activeEvidence.length > 0 
                    ? `Grounded in ${activeEvidence.length} actual projects & experiences` 
                    : "Grounded in your real background"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-white/70 p-3.5 rounded-2xl border border-line">
              <CheckCircle2 className="h-4 w-4 text-sage mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-ink">Target role calibration</p>
                <p className="text-[11px] text-mut mt-0.5">Tested for {role.toUpperCase()} expectations</p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-white/70 p-3.5 rounded-2xl border border-line">
              <CheckCircle2 className="h-4 w-4 text-sage mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-ink">Adaptive follow-up engine</p>
                <p className="text-[11px] text-mut mt-0.5">Interviewer dynamically probes claims &amp; gaps</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <p className="text-xs text-mut">
              Ready to begin? The AI Interviewer will open with a question tailored to your background.
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              data-testid="practice-start-btn"
              onClick={startSession}
              disabled={isLaunchingInterview}
              className="btn-terra !px-8 !py-3.5 shrink-0 w-full sm:w-auto shadow-lift cursor-pointer text-sm font-semibold"
            >
              <span>{isLaunchingInterview ? 'Preparing your interview…' : 'Start Interview'}</span>
              <ArrowRight className="h-4 w-4 ml-2" />
            </motion.button>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
