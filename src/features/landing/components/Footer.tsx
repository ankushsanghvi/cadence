'use client';

import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/routerCompat";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Reveal } from "@/components/ui-bits";
import { getStartPracticingRoute } from "@/lib/authRoute";

export default function Footer() {
  const [practiceRoute, setPracticeRoute] = useState("/signup");
  const nav = useNavigate();

  useEffect(() => {
    setPracticeRoute(getStartPracticingRoute());
  }, []);

  const handleStartPracticing = (e: React.MouseEvent) => {
    e.preventDefault();
    nav(getStartPracticingRoute());
  };

  return (
    <footer className="bg-coal text-paper">
      <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
            <div>
              <p className="eyebrow !text-coal3">Interview Coaching Engine</p>
              <h2 className="mt-5 max-w-xl font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
                Ready to find your <em className="italic text-terra">cadence?</em>
              </h2>
            </div>
            <a
              href={practiceRoute}
              onClick={handleStartPracticing}
              data-testid="footer-cta"
              className="btn-terra shrink-0"
            >
              Start practicing <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </Reveal>

        <div className="mt-20 flex flex-col justify-between gap-6 border-t border-coaline pt-8 sm:flex-row sm:items-center">
          <Logo dark />
          <nav className="flex flex-wrap gap-6 text-sm text-paper/60">
            <a href="#features" className="transition-colors hover:text-paper">Features</a>
            <a href="#agents" className="transition-colors hover:text-paper">5-Agent Engine</a>
            <a href="#practice-demo" className="transition-colors hover:text-paper">Live demo</a>
            <Link to="/app" className="transition-colors hover:text-paper">Dashboard</Link>
          </nav>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/35">
            Communication & Interview Coaching
          </p>
        </div>
      </div>
    </footer>
  );
}
