'use client';

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@/lib/routerCompat";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, Check, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import api, { formatApiError } from "@/lib/api";

const STEPS = ["Account", "Resume", "AI Profile"];
const STAGES = [
  "Uploading",
  "Reading Resume",
  "Extracting Information",
  "Building AI Profile",
  "Profile Ready"
];

export default function ResumeUpload() {
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stageIdx, setStageIdx] = useState(-1);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [extractedSummary, setExtractedSummary] = useState<{
    name: string;
    expCount: number;
    projCount: number;
    skillsCount: number;
  } | null>(null);

  const run = async (chosen: File) => {
    setError("");
    if (!chosen.name.toLowerCase().match(/\.(pdf|docx|txt)$/)) {
      setError("Unsupported format. Please upload a PDF or DOCX file.");
      return;
    }
    if (chosen.size > 10 * 1024 * 1024) {
      setError("File too large — please keep it under 10 MB.");
      return;
    }
    setFile(chosen);
    setStatus("processing");
    setStageIdx(0);
    // Progress through reading and extraction while request is inflight (stages 0, 1, 2, 3)
    const timer = setInterval(() => setStageIdx((i) => Math.min(i + 1, 3)), 1600);
    try {
      const fd = new FormData();
      fd.append("file", chosen);
      const res = await api.post("/onboarding/resume", fd);

      if (typeof window !== "undefined" && res?.data?.profile) {
        localStorage.setItem("cadence_candidate_profile", JSON.stringify(res.data.profile));
        localStorage.setItem("cadence_profile_source", res.data.source || "ai");
        if (res.data.diagnostic) {
          localStorage.setItem("cadence_resume_diagnostic", JSON.stringify(res.data.diagnostic));
        }

        const prof = res.data.profile;
        setExtractedSummary({
          name: prof.basics?.fullName || prof.name || "",
          expCount: (prof.workExperience || prof.experience || []).length,
          projCount: (prof.projects || []).length,
          skillsCount: (prof.technicalSkills || prof.technical_skills || []).length,
        });
      }

      clearInterval(timer);
      // Section 18: Only show Profile Ready after structured profile data actually exists
      setStageIdx(4);
      setStatus("done");
      setTimeout(() => nav("/onboarding/profile"), 1200);
    } catch (e: any) {
      clearInterval(timer);
      setError(formatApiError(e));
      setStatus("error");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (status === "processing" || status === "done") return;
    const f = e.dataTransfer.files?.[0];
    if (f) run(f);
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper" data-testid="resume-upload-page">
      <header className="px-6 py-5">
        <Link to="/" data-testid="upload-home-link">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pb-16 sm:items-center">
        <div className="w-full max-w-xl">
          <div className="mb-8 flex items-center gap-2" data-testid="onboarding-stepper-resume">
            {STEPS.map((s, i) => (
              <span key={s} className={`flex-1 border-t-2 ${i <= 1 ? "border-terra" : "border-line"}`} />
            ))}
            <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.18em] text-mut">02 · {STEPS[1]}</span>
          </div>

          <h1 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">Upload your resume.</h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink2">
            The AI Profile Agent reads it and builds your candidate profile — skills, experience, projects — so your
            practice questions fit you. You can edit everything afterwards.
          </p>

          <div className="card mt-7 p-7" data-testid="upload-card">
            <AnimatePresence mode="wait">
              {status === "idle" && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div
                    data-testid="upload-dropzone"
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all ${
                      dragging ? "border-terra bg-terrasoft" : "border-line2 bg-cream/40 hover:border-terra hover:bg-terrasoft/60"
                    }`}
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-terrasoft text-terra">
                      <UploadCloud className="h-6 w-6" />
                    </span>
                    <p className="mt-4 text-sm font-medium text-ink">Drag your resume here, or click to browse</p>
                    <p className="mt-1.5 text-xs text-mut">Your file is processed in seconds and never shared.</p>
                    <div className="mt-5 flex gap-2">
                      <span className="chip font-mono !text-[10px]">PDF</span>
                      <span className="chip font-mono !text-[10px]">DOCX</span>
                      <span className="chip font-mono !text-[10px]">max 10 MB</span>
                    </div>
                    <input
                      ref={inputRef}
                      data-testid="upload-file-input"
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && run(e.target.files[0])}
                    />
                  </div>
                  <button onClick={() => nav("/onboarding/profile")} data-testid="upload-skip-btn" className="mt-5 w-full text-center text-xs font-medium text-mut hover:text-terra">
                    Continue without a resume — I'll enter details myself
                  </button>
                </motion.div>
              )}

              {status === "processing" && (
                <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="upload-processing">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 shrink-0 text-terra" />
                    <p className="truncate text-sm font-medium text-ink">{file?.name}</p>
                  </div>
                  <div className="mt-6 space-y-1" data-testid="processing-stages">
                    {STAGES.map((s, i) => {
                      const active = i === stageIdx;
                      const done = i < stageIdx;
                      return (
                        <div key={s} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${
                            done ? "border-transparent bg-sage text-white" : active ? "border-terra text-terra" : "border-line text-mut"
                          }`}>
                            {done ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : i + 1}
                          </span>
                          <span className={`text-sm font-medium ${done || active ? "text-ink" : "text-mut"}`}>{s}</span>
                        </div>
                      );
                    })}
                  </div>
                  {stageIdx === 3 && (
                    <p className="mt-3 px-3 text-xs text-mut">
                      Matching experience, skills, and projects into your editable profile…
                    </p>
                  )}
                  <div className="mt-6 h-1 overflow-hidden rounded-full bg-line">
                    <motion.div
                      className="h-full w-1/3 rounded-full bg-terra"
                      animate={{ x: ["-100%", "300%"] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                </motion.div>
              )}

              {status === "done" && (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-8 text-center" data-testid="upload-success">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sagesoft text-sage shadow-sm">
                    <Check className="h-6 w-6" />
                  </span>
                  <p className="mt-4 font-display text-2xl text-ink">Profile Ready</p>
                  <p className="mt-1 text-sm text-ink2 font-medium">
                    {extractedSummary?.name ? `Candidate: ${extractedSummary.name}` : "Resume processed successfully."}
                  </p>
                  {extractedSummary && (
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <span className="chip !text-[11px] font-mono">{extractedSummary.expCount} Experience entries</span>
                      <span className="chip !text-[11px] font-mono">{extractedSummary.projCount} Projects</span>
                      <span className="chip !text-[11px] font-mono">{extractedSummary.skillsCount} Skills</span>
                    </div>
                  )}
                  <p className="mt-4 text-xs text-mut animate-pulse">Opening your AI profile for review…</p>
                </motion.div>
              )}

              {status === "error" && (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="upload-error">
                  <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-[#FEF2F2] px-4 py-3.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div>
                      <p className="text-sm font-semibold text-destructive">Extraction Error</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-destructive/90">{error}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button onClick={() => { setStatus("idle"); setError(""); }} data-testid="upload-retry-btn" className="btn-ghost !px-5 !py-2.5 !text-xs">
                      Try another file
                    </button>
                    <button onClick={() => nav("/onboarding/profile")} data-testid="upload-error-manual-btn" className="btn-terra !px-5 !py-2.5 !text-xs">
                      Enter details manually <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
