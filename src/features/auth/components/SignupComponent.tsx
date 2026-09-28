'use client';

import { useState } from "react";
import { Link, useNavigate } from "@/lib/routerCompat";
import { ArrowRight, AlertCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/features/auth/context/AuthContext";
import api, { formatApiError } from "@/lib/api";

const STEPS = ["Account", "Resume", "AI Profile"];

export default function SignupComponent({ mode = "signup" }: { mode?: "signup" | "login" }) {
  const nav = useNavigate();
  const { signup, login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (isSignup && name.trim().length < 2) return setError("Please enter your full name.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      if (isSignup) {
        await signup(name.trim(), email.trim().toLowerCase(), password);
        nav("/onboarding/resume");
      } else {
        await login(email.trim().toLowerCase(), password);
        try {
          await api.get("/onboarding/profile");
          nav("/app/practice");
        } catch {
          nav("/onboarding/resume");
        }
      }
    } catch (err: any) {
      setError(formatApiError(err));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper" data-testid="signup-page">
      <header className="px-6 py-5">
        <Link to="/" data-testid="signup-home-link">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pb-16 sm:items-center">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2" data-testid="onboarding-stepper">
            {STEPS.map((s, i) => (
              <span key={s} className={`flex-1 border-t-2 ${i === 0 ? "border-terra" : "border-line"}`} />
            ))}
            <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.18em] text-mut">01 · {STEPS[0]}</span>
          </div>

          <div className="card p-8">
            <h1 className="font-display text-3xl tracking-tight text-ink">
              {isSignup ? "Create your account." : "Welcome back."}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink2">
              {isSignup
                ? "One account for everything: practice sessions, your AI profile and your improvement plan."
                : "Sign in to pick up where you left off."}
            </p>

            <form onSubmit={submit} className="mt-7 space-y-5" data-testid="signup-form">
              {isSignup && (
                <label className="block">
                  <span className="eyebrow mb-1.5 block">Full name</span>
                  <input
                    data-testid="signup-name-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Full Name"
                    className="input-warm"
                    autoComplete="name"
                  />
                </label>
              )}
              <label className="block">
                <span className="eyebrow mb-1.5 block">Email</span>
                <input
                  data-testid="signup-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. name@domain.com"
                  className="input-warm"
                  autoComplete="email"
                />
              </label>
              <label className="block">
                <span className="eyebrow mb-1.5 block">Password</span>
                <input
                  data-testid="signup-password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? "At least 8 characters" : "Your password"}
                  className="input-warm"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                />
              </label>

              {error && (
                <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-[#FEF2F2] px-4 py-3 text-sm text-destructive" data-testid="signup-error">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </p>
              )}

              <button type="submit" disabled={busy} data-testid="signup-submit-btn" className="btn-terra w-full disabled:opacity-50">
                {busy ? "One moment…" : isSignup ? "Create account" : "Sign in"}
                {!busy && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-6 border-t border-line pt-5 text-center text-sm text-ink2">
              {isSignup ? "Already have an account? " : "New to Cadence? "}
              <Link
                to={isSignup ? "/login" : "/signup"}
                data-testid="signup-mode-toggle"
                className="font-medium text-terra hover:underline"
              >
                {isSignup ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-mut">
            Next: upload your resume → AI profile
          </p>
        </div>
      </main>
    </div>
  );
}
