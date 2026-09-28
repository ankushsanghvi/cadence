// @ts-nocheck
'use client';

import { useRef, useState, useEffect } from "react";
import { Link, useNavigate } from "@/lib/routerCompat";
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { SectionTag } from "@/components/ui-bits";
import { getStartPracticingRoute } from "@/lib/authRoute";

const line = {
  hidden: { y: "115%" },
  show: (i: number) => ({
    y: 0,
    transition: { duration: 1, delay: 0.12 + i * 0.13, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const drift = useTransform(scrollY, [0, 700], [0, 70]);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), { stiffness: 60, damping: 16 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), { stiffness: 60, damping: 16 });

  const [practiceRoute, setPracticeRoute] = useState("/signup");
  const nav = useNavigate();

  useEffect(() => {
    setPracticeRoute(getStartPracticingRoute());
  }, []);

  const handleStartPracticing = (e: React.MouseEvent) => {
    e.preventDefault();
    nav(getStartPracticingRoute());
  };

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  return (
    <section id="top" ref={ref} onMouseMove={onMove} className="relative overflow-hidden pb-16 pt-32 sm:pt-36 lg:pb-24 lg:pt-40">
      <div className="pointer-events-none absolute -top-40 right-[-10%] h-[560px] w-[560px] rounded-full bg-terrasoft blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-20%] left-[-8%] h-[420px] w-[420px] rounded-full bg-sagesoft blur-3xl opacity-70" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
            <SectionTag>Interview Coaching Engine</SectionTag>
          </motion.div>

          <h1 className="mt-6 font-display text-5xl leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            <span className="block overflow-hidden pb-1">
              <motion.span className="block" variants={line} custom={0} initial="hidden" animate="show">
                Every great answer
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-2">
              <motion.span className="block" variants={line} custom={1} initial="hidden" animate="show">
                has a <em className="italic text-terra">cadence.</em>
              </motion.span>
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-ink2"
          >
            Cadence listens to how you answer — clarity, structure, confidence — and coaches you question by
            question, with five specialist AI agents behind every piece of feedback.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <a
              href={practiceRoute}
              onClick={handleStartPracticing}
              data-testid="landing-hero-cta"
              className="btn-terra"
            >
              Start practicing <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#agents" data-testid="landing-hero-secondary-cta" className="btn-ghost">
              <Play className="h-3.5 w-3.5 fill-current" /> See the 5-agent engine
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="mt-12 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-mut"
          >
            <span>5 specialist agents</span>
            <span className="text-line2">/</span>
            <span>16 curated questions</span>
            <span className="text-line2">/</span>
            <span>5 scoring dimensions</span>
          </motion.div>
        </div>

        <motion.div style={{ y: drift }} className="lg:col-span-6" data-testid="hero-visual">
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ perspective: 1200 }}
          >
            <motion.div
              style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
              className="relative mx-auto max-w-lg"
              data-testid="hero-product-card"
            >
              <div className="absolute -inset-8 rounded-[2.5rem] bg-terra/10 blur-2xl" />
              <HeroCard />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

const AGENT_ROWS = [
  { name: "Interview Question Agent", chip: "selected · Behavioral", tone: "bg-sagesoft text-sage" },
  { name: "Communication Analysis", chip: "clarity 84 · 2 fillers", tone: "bg-sagesoft text-sage" },
  { name: "Content Evaluation", chip: "relevance 81", tone: "bg-sagesoft text-sage" },
  { name: "STAR & Structure", chip: "running…", tone: "bg-terrasoft text-terrad animate-pulseglow" },
  { name: "Interview Coach", chip: "queued", tone: "bg-cream text-mut" },
];

function HeroCard() {
  return (
    <div className="card relative overflow-hidden rounded-3xl shadow-pop">
      <div className="flex items-center gap-2 border-b border-line bg-cream/60 px-5 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-terra/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-line2" />
        <span className="h-2.5 w-2.5 rounded-full bg-line2" />
        <span className="ml-3 font-mono text-[10px] tracking-wider text-mut">cadence.app/practice/live</span>
      </div>
      <div className="space-y-5 p-6">
        <div>
          <p className="eyebrow">Now evaluating</p>
          <p className="mt-2 font-display text-lg leading-snug text-ink">
            "Describe a challenging project you worked on."
          </p>
        </div>
        <div className="space-y-2" data-testid="hero-agent-rows">
          {AGENT_ROWS.map((a, i) => (
            <motion.div
              key={a.name}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + i * 0.12, duration: 0.5 }}
              className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-2.5"
            >
              <span className="text-xs font-medium text-ink2">{a.name}</span>
              <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] ${a.tone}`}>{a.chip}</span>
            </motion.div>
          ))}
        </div>
        <div className="flex items-center gap-6 rounded-2xl bg-coal p-5">
          <div className="relative h-16 w-16 shrink-0">
            <svg viewBox="0 0 64 64" className="-rotate-90">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#2E2A25" strokeWidth="6" />
              <motion.circle
                cx="32" cy="32" r="26" fill="none" stroke="#4A7494" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={163}
                initial={{ strokeDashoffset: 163 }}
                animate={{ strokeDashoffset: 163 - 163 * 0.88 }}
                transition={{ duration: 1.4, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-paper">88</span>
          </div>
          <div className="flex-1 space-y-2.5">
            {[
              ["Structure", 84],
              ["Clarity", 88],
              ["Completeness", 76],
            ].map(([l, v], i) => (
              <div key={l} className="flex items-center gap-3">
                <span className="w-24 font-mono text-[9px] uppercase tracking-widest text-coal3">{l}</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-coal3">
                  <motion.div
                    className="h-full rounded-full bg-[#4A7494]"
                    initial={{ width: 0 }}
                    animate={{ width: `${v}%` }}
                    transition={{ duration: 1, delay: 1.3 + i * 0.15 }}
                  />
                </div>
                <span className="w-6 text-right font-mono text-[10px] text-paper/80">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
