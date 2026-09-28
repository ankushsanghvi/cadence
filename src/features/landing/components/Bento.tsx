'use client';

import { Check, AlertCircle, Waves, Target, Wand2 } from "lucide-react";
import { Reveal, SectionTag } from "@/components/ui-bits";

const card =
  "group relative overflow-hidden rounded-3xl border border-line bg-white p-8 transition-all duration-300 hover:-translate-y-1.5 hover:border-terra/60 hover:shadow-pop";

export default function Bento() {
  return (
    <section id="features" className="bg-cream/50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <SectionTag>What you get</SectionTag>
          <h2 className="mt-5 max-w-2xl font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
            Feedback that reads like a <em className="italic text-terra">coach</em>, not a rubric.
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
          <Reveal className="lg:col-span-8" delay={0.05}>
            <div className={`${card} h-full`}>
              <div className="flex items-start justify-between gap-6">
                <div className="max-w-sm">
                  <Waves className="h-6 w-6 text-terra" />
                  <h3 className="mt-4 font-display text-2xl text-ink">Hear what the interviewer hears</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink2">
                    Filler words, hedging, rambling sentences, pace — the Communication Agent transcribes your voice
                    response and scores the way it actually sounded, then shows you the evidence.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {["um ×3", "basically ×1", "you know ×2", "pace 128 wpm"].map((t) => (
                      <span key={t} className="chip !border-terrasoft !bg-terrasoft !text-terrad font-mono !text-[10px]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="hidden h-28 flex-1 items-end justify-center gap-1.5 sm:flex" data-testid="bento-waveform">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <span
                      key={i}
                      className="w-1.5 origin-bottom animate-wave rounded-full bg-terra/70"
                      style={{ height: `${18 + ((i * 37) % 80)}%`, animationDelay: `${i * 0.09}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-4" delay={0.1}>
            <div className={`${card} h-full`} data-testid="bento-star-card">
              <Target className="h-6 w-6 text-terra" />
              <h3 className="mt-4 font-display text-2xl text-ink">STAR, scored line by line</h3>
              <div className="mt-5 space-y-2.5">
                {[
                  ["S", "Situation", true],
                  ["T", "Task", true],
                  ["A", "Action", true],
                  ["R", "Result", false],
                ].map(([k, label, ok]) => (
                  <div key={String(k)} className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5">
                    <span className="flex items-center gap-3 text-sm font-medium text-ink2">
                      <span className="font-mono text-xs font-bold text-terra">{k}</span> {label}
                    </span>
                    {ok ? (
                      <Check className="h-4 w-4 text-sage" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-ochre" />
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-mut">"Result missing — close with a number."</p>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-4" delay={0.15}>
            <div className={`${card} h-full`}>
              <Wand2 className="h-6 w-6 text-terra" />
              <h3 className="mt-4 font-display text-2xl text-ink">Questions that adapt to you</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink2">
                Selected by role, competency, difficulty and your weakest recurring gap — not shuffled from a list.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Behavioral", "Tech Communication", "Problem Solving", "Leadership", "Customer Obsession"].map((t) => (
                  <span key={t} className="chip">{t}</span>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-8" delay={0.2}>
            <div className={`${card} h-full`} data-testid="bento-coach-card">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl text-ink">The rewrite, not just the review</h3>
                <span className="chip !border-terrasoft !bg-terrasoft !text-terrad font-mono !text-[10px]">Coach Agent</span>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-cream/70 p-5">
                  <p className="eyebrow mb-2">You said</p>
                  <p className="text-sm leading-relaxed text-ink2 line-clamp-4">
                    "…and then basically, after a lot of back and forth, we kind of improved the numbers over time
                    and it went pretty well overall, I think."
                  </p>
                </div>
                <div className="rounded-2xl bg-coal p-5">
                  <p className="eyebrow mb-2 !text-coal3">Coach rewrite</p>
                  <p className="text-sm leading-relaxed text-paper/90">
                    "We cut checkout failures from 2% to 0.1% in six weeks — I owned the diagnosis, the redesign and
                    the rollout."
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
