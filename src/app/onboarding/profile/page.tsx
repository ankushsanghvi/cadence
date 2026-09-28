'use client';

import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/routerCompat";
import { ArrowRight, Sparkles, Plus, X, AlertCircle, RefreshCw, PenTool } from "lucide-react";
import { Logo } from "@/components/Logo";
import api, { formatApiError, CandidateProfile, createEmptyProfile } from "@/lib/api";
import { normalizeResumeProfile } from "@/lib/resumeParser";

const STEPS = ["Account", "Resume", "AI Profile"];

const EMPTY: CandidateProfile = createEmptyProfile();

export default function AIProfile() {
  const nav = useNavigate();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState("manual");
  const [diagnostic, setDiagnostic] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cadence_candidate_profile");
      const storedSource = localStorage.getItem("cadence_profile_source");
      const storedDiag = localStorage.getItem("cadence_resume_diagnostic");
      if (storedDiag) {
        try {
          setDiagnostic(JSON.parse(storedDiag));
        } catch {
          // ignore
        }
      }
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const normalized = normalizeResumeProfile(parsed);
          setProfile(normalized);
          if (storedSource) setSource(storedSource);
          setLoading(false);
        } catch (e) {
          console.error("Failed to parse stored profile", e);
        }
      }
    }
    api
      .get("/onboarding/profile")
      .then(({ data }) => {
        if (data?.profile) {
          setProfile((prev) => {
            // Section 14: Never allow an empty server response to overwrite an already loaded profile
            const isServerNonEmpty =
              (data.profile.basics?.fullName && data.profile.basics.fullName.toLowerCase() !== "candidate") ||
              data.profile.experience?.length > 0 ||
              data.profile.workExperience?.length > 0 ||
              data.profile.projects?.length > 0 ||
              data.profile.technical_skills?.length > 0 ||
              data.profile.technicalSkills?.length > 0;

            if (prev && !isServerNonEmpty) {
              return prev;
            }
            return normalizeResumeProfile({ ...(prev || {}), ...data.profile });
          });
          if (data.source && data.source !== "manual") {
            setSource(data.source);
          }
        }
      })
      .catch(() => {
        setProfile((prev) => prev || createEmptyProfile());
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof CandidateProfile, v: any) => {
    setProfile((p) => {
      if (!p) return null;
      const updated: any = { ...p, [k]: v };
      if (!updated.basics) {
        updated.basics = {
          fullName: p.name || "",
          email: p.email || "",
          phone: p.phone || "",
          location: p.location || "",
          summary: p.summary || "",
        };
      }
      if (k === "name") updated.basics.fullName = v;
      if (k === "email") updated.basics.email = v;
      if (k === "phone") updated.basics.phone = v;
      if (k === "location") updated.basics.location = v;
      if (k === "summary") updated.basics.summary = v;
      return updated;
    });
  };

  const setList = (k: 'education' | 'experience' | 'internships' | 'projects', i: number, key: string, v: string) => {
    setProfile((p) => {
      if (!p) return null;
      const list = [...(p[k] as any[])];
      list[i] = { ...list[i], [key]: v };
      const updated: any = { ...p, [k]: list };
      if (k === 'experience') {
        updated.workExperience = list;
      }
      return updated;
    });
  };

  const setStringItem = (k: 'achievements', i: number, v: string) => {
    setProfile((p) => {
      if (!p) return null;
      const list = [...p[k]];
      list[i] = v;
      return { ...p, [k]: list };
    });
  };

  const addToList = (k: keyof CandidateProfile, item: any) => {
    setProfile((p) => {
      if (!p) return null;
      const list = [...(p[k] as any[]), item];
      const updated: any = { ...p, [k]: list };
      if (k === 'experience') updated.workExperience = list;
      if (k === 'technical_skills') updated.technicalSkills = list;
      if (k === 'soft_skills') updated.softSkills = list;
      return updated;
    });
  };

  const rmList = (k: keyof CandidateProfile, i: number) => {
    setProfile((p) => {
      if (!p) return null;
      const list = (p[k] as any[]).filter((_, j) => j !== i);
      const updated: any = { ...p, [k]: list };
      if (k === 'experience') updated.workExperience = list;
      if (k === 'technical_skills') updated.technicalSkills = list;
      if (k === 'soft_skills') updated.softSkills = list;
      return updated;
    });
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const normalized = normalizeResumeProfile(profile);
      await api.put("/onboarding/profile", normalized);
      localStorage.setItem("cadence_candidate_profile", JSON.stringify(normalized));
      localStorage.setItem("cadence_profile_confirmed", "true");
      nav("/app/practice");
    } catch (e: any) {
      alert(formatApiError(e));
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper" data-testid="profile-loading">
        <Logo />
      </div>
    );
  }

  const isProfileEmpty =
    !profile.name &&
    profile.education.length === 0 &&
    profile.experience.length === 0 &&
    profile.projects.length === 0 &&
    profile.technical_skills.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-paper" data-testid="ai-profile-page">
      <header className="px-6 py-5">
        <Link to="/" data-testid="profile-home-link">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20">
        <div className="mb-8 flex items-center gap-2" data-testid="onboarding-stepper-profile">
          {STEPS.map((s, i) => (
            <span key={s} className={`flex-1 border-t-2 ${i <= 2 ? "border-terra" : "border-line"}`} />
          ))}
          <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.18em] text-mut">03 · {STEPS[2]}</span>
        </div>

        <h1 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">Your AI profile.</h1>
        <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-ink2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-terra" />
          {source === "ai"
            ? "Extracted from your resume by the AI Profile Agent. Review everything — edit or remove anything that looks off."
            : source === "heuristic"
            ? "Extracted from your resume via local parsing engine. Please review and complete your details."
            : "Fill in your profile — it powers personalized question selection and evaluation."}
        </p>

        {/* Section 26: Development-Only Diagnostic Panel */}
        {process.env.NODE_ENV === "development" && diagnostic && (
          <div className="card mt-6 border border-emerald-300 bg-emerald-50/70 p-5 shadow-sm" data-testid="dev-diagnostic-panel">
            <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2.5">
              <span className="font-mono text-xs font-bold text-emerald-950 tracking-wider">
                DEVELOPMENT RESUME EXTRACTION DIAGNOSTIC
              </span>
              <span className="chip !bg-emerald-100 !border-emerald-300 !text-emerald-900 font-mono !text-[10px]">
                SOURCE: {diagnostic.parserSource?.toUpperCase()}
              </span>
            </div>
            <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs text-emerald-950">
              <div>FILE: <span className="font-semibold">{diagnostic.fileName}</span> <span className="text-emerald-700">✓</span></div>
              <div>TEXT EXTRACTION: <span className="font-semibold">{diagnostic.charCount?.toLocaleString()} chars</span> <span className="text-emerald-700">✓</span></div>
              <div>RESUME PARSER: <span className="font-semibold">completed</span> <span className="text-emerald-700">✓</span></div>
              <div>WORK EXPERIENCE: <span className="font-semibold">{diagnostic.experienceCount} entries</span></div>
              <div>PROJECTS: <span className="font-semibold">{diagnostic.projectsCount} entries</span></div>
              <div>SKILLS: <span className="font-semibold">{diagnostic.skillsCount} skills</span></div>
              <div>EDUCATION: <span className="font-semibold">{diagnostic.educationCount} entries</span></div>
              <div>PERSISTENCE: <span className="font-semibold">saved</span> <span className="text-emerald-700">✓</span></div>
              <div>PROFILE LOAD: <span className="font-semibold">populated</span> <span className="text-emerald-700">✓</span></div>
            </div>
          </div>
        )}

        {/* Section 17: Empty State Rule — Explicit error with Retry / Manual action */}
        {isProfileEmpty && source !== "manual" && (
          <div className="mt-6 rounded-2xl border border-destructive/30 bg-[#FEF2F2] p-6 shadow-sm" data-testid="profile-empty-warning">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-destructive">Extraction Incomplete</p>
                <p className="mt-1 text-xs leading-relaxed text-destructive/90">
                  We couldn't extract your resume details. Please try uploading the file again or enter the information manually.
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button
                    onClick={() => nav("/onboarding/resume")}
                    data-testid="profile-retry-extraction-btn"
                    className="btn-terra !px-4 !py-2 !text-xs inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Retry extraction
                  </button>
                  <button
                    onClick={() => setSource("manual")}
                    data-testid="profile-enter-manually-btn"
                    className="btn-ghost !px-4 !py-2 !text-xs inline-flex items-center gap-1.5"
                  >
                    <PenTool className="h-3.5 w-3.5" /> Enter manually
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-5">
          <div className="card p-7" data-testid="profile-contact-card">
            <p className="eyebrow mb-5">Basics</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" testid="profile-name-input" value={profile.name} onChange={(v) => set("name", v)} placeholder="Full Name" />
              <Field label="Email" testid="profile-email-input" value={profile.email} onChange={(v) => set("email", v)} placeholder="name@domain.com" />
              <Field label="Phone" testid="profile-phone-input" value={profile.phone} onChange={(v) => set("phone", v)} placeholder="e.g. +1 (555) 000-0000" />
              <Field label="Location" testid="profile-location-input" value={profile.location} onChange={(v) => set("location", v)} placeholder="City, Country" />
            </div>
            <label className="mt-4 block">
              <span className="eyebrow mb-1.5 block">Profile summary</span>
              <textarea
                data-testid="profile-summary-input"
                rows={3}
                value={profile.summary}
                onChange={(e) => set("summary", e.target.value)}
                placeholder="Two lines on who you are professionally…"
                className="input-warm resize-none leading-relaxed"
              />
            </label>
          </div>

          <ListCard
            title="Education" k="education" items={profile.education}
            fields={[["institution", "Institution"], ["degree", "Degree / Field"], ["year", "Years"]]}
            onSet={setList} onAdd={() => addToList("education", { institution: "", degree: "", year: "" })} onRm={rmList}
          />
          <ListCard
            title="Work experience" k="experience" items={profile.experience}
            fields={[["company", "Company"], ["role", "Role"], ["duration", "Duration"]]}
            summaryKey="summary" onSet={setList} onAdd={() => addToList("experience", { company: "", role: "", duration: "", summary: "" })} onRm={rmList}
          />
          <ListCard
            title="Internships" k="internships" items={profile.internships}
            fields={[["company", "Company"], ["role", "Role"], ["duration", "Duration"]]}
            summaryKey="summary" onSet={setList} onAdd={() => addToList("internships", { company: "", role: "", duration: "", summary: "" })} onRm={rmList}
          />
          <ListCard
            title="Projects" k="projects" items={profile.projects}
            fields={[["name", "Project name"]]}
            summaryKey="summary" onSet={setList} onAdd={() => addToList("projects", { name: "", summary: "" })} onRm={rmList}
          />

          <ChipCard title="Technical skills" k="technical_skills" items={profile.technical_skills} onAdd={(v) => addToList("technical_skills", v)} onRm={rmList} />
          <ChipCard title="Soft skills" k="soft_skills" items={profile.soft_skills} onAdd={(v) => addToList("soft_skills", v)} onRm={rmList} />
          <ChipCard title="Technologies" k="technologies" items={profile.technologies} onAdd={(v) => addToList("technologies", v)} onRm={rmList} />
          <ChipCard title="Certifications" k="certifications" items={profile.certifications} onAdd={(v) => addToList("certifications", v)} onRm={rmList} />
          <AchievementsCard items={profile.achievements} onSet={(i, v) => setStringItem("achievements", i, v)} onAdd={(v) => addToList("achievements", v)} onRm={(i) => rmList("achievements", i)} />
          <ChipCard title="Domain experience" k="domains" items={profile.domains} onAdd={(v) => addToList("domains", v)} onRm={rmList} />
        </div>

        <div className="sticky bottom-6 mt-10 flex justify-end rounded-2xl border border-line bg-paper/95 p-4 backdrop-blur-md shadow-pop z-30">
          <button onClick={save} disabled={saving} data-testid="profile-continue-btn" className="btn-terra !px-6 !py-3 font-medium shadow-lift disabled:opacity-50">
            {saving ? "Saving…" : "Continue to Interview Setup"}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </main>
    </div>
  );
}

const Field = ({ label, value, onChange, placeholder, testid }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; testid: string }) => (
  <label className="block">
    <span className="eyebrow mb-1.5 block">{label}</span>
    <input data-testid={testid} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input-warm" />
  </label>
);

function ListCard({
  title,
  k,
  items,
  fields,
  summaryKey,
  onSet,
  onAdd,
  onRm,
}: {
  title: string;
  k: 'education' | 'experience' | 'internships' | 'projects';
  items: any[];
  fields: string[][];
  summaryKey?: string;
  onSet: (k: any, i: number, key: string, v: string) => void;
  onAdd: () => void;
  onRm: (k: any, i: number) => void;
}) {
  return (
    <div className="card p-7" data-testid={`profile-section-${k}`}>
      <div className="flex items-center justify-between">
        <p className="eyebrow">{title}</p>
        <button onClick={onAdd} data-testid={`profile-add-${k}-btn`} className="inline-flex items-center gap-1.5 text-xs font-medium text-terra hover:underline">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      {items.length === 0 && <p className="mt-3 text-xs text-mut">Nothing here yet — add your details so questions match your background.</p>}
      <div className="mt-4 space-y-4">
        {items.map((it, i) => (
          <div key={i} className="rounded-2xl border border-line bg-cream/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                {fields.map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-mut">{label}</span>
                    <input value={it[key] || ""} onChange={(e) => onSet(k, i, key, e.target.value)} className="input-warm !px-3 !py-2 !text-xs" />
                  </label>
                ))}
              </div>
              <button onClick={() => onRm(k, i)} data-testid={`profile-rm-${k}-${i}`} className="rounded-lg p-1.5 text-mut transition-colors hover:bg-white hover:text-destructive" aria-label="Remove">
                <X className="h-4 w-4" />
              </button>
            </div>
            {summaryKey && (
              <label className="mt-3 block">
                <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-mut">Summary</span>
                <textarea rows={2} value={it[summaryKey] || ""} onChange={(e) => onSet(k, i, summaryKey, e.target.value)} className="input-warm resize-none !px-3 !py-2 !text-xs leading-relaxed" />
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChipCard({
  title,
  k,
  items,
  onAdd,
  onRm,
}: {
  title: string;
  k: keyof CandidateProfile;
  items: string[];
  onAdd: (v: string) => void;
  onRm: (k: keyof CandidateProfile, i: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    onAdd(v.slice(0, 80));
    setDraft("");
  };
  return (
    <div className="card p-7" data-testid={`profile-section-${k}`}>
      <p className="eyebrow">{title}</p>
      <div className="mt-4 flex flex-wrap gap-2" data-testid={`profile-chips-${k}`}>
        {items.map((s, i) => (
          <span key={`${s}-${i}`} className="chip">
            {s}
            <button onClick={() => onRm(k, i)} data-testid={`profile-chip-rm-${k}-${i}`} className="text-mut hover:text-destructive" aria-label={`Remove ${s}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {items.length === 0 && <p className="text-xs text-mut">None added yet.</p>}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          data-testid={`profile-chip-input-${k}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
          placeholder={`Add ${title.toLowerCase()}…`}
          className="input-warm !px-3 !py-2 !text-xs"
        />
        <button onClick={commit} data-testid={`profile-chip-add-${k}-btn`} className="btn-ghost !px-4 !py-2 !text-xs">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function AchievementsCard({
  items,
  onSet,
  onAdd,
  onRm,
}: {
  items: string[];
  onSet: (i: number, v: string) => void;
  onAdd: (v: string) => void;
  onRm: (i: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft("");
  };
  return (
    <div className="card p-7" data-testid="profile-section-achievements">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Achievements</p>
      </div>
      <div className="mt-4 space-y-2.5" data-testid="profile-achievements-list">
        {items.map((ach, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl border border-line bg-cream/40 px-3 py-2">
            <input
              value={ach}
              onChange={(e) => onSet(i, e.target.value)}
              className="flex-1 bg-transparent text-xs text-ink focus:outline-none"
              placeholder="Achievement statement..."
            />
            <button
              onClick={() => onRm(i)}
              data-testid={`profile-rm-achievements-${i}`}
              className="rounded p-1 text-mut hover:text-destructive"
              aria-label="Remove achievement"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-mut">None added yet.</p>}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          data-testid="profile-chip-input-achievements"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
          placeholder="Add an achievement statement…"
          className="input-warm !px-3 !py-2 !text-xs"
        />
        <button onClick={commit} data-testid="profile-add-achievements-btn" className="btn-ghost !px-4 !py-2 !text-xs">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
    </div>
  );
}
