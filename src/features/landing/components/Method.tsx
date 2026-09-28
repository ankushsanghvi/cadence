import { FLOW_STEPS } from "@/lib/mockData";
import { Reveal, SectionTag } from "@/components/ui-bits";

export default function Method() {
  return (
    <section id="method" className="py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <div className="relative" data-testid="method-photo">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-sagesoft blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] shadow-pop">
              <img
                src="https://images.unsplash.com/photo-1573496267526-08a69e46a409?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"
                alt="A professional rehearsing answers in an interview coaching session"
                className="aspect-[4/5] w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-coal/50 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-paper/90 p-4 backdrop-blur">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terra">The data flow</p>
                <p className="mt-1 text-sm font-medium text-ink">
                  Candidate → Question → Response → Agents → Coaching → Improvement Plan
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="lg:col-span-7">
          <Reveal>
            <SectionTag>How it works</SectionTag>
            <h2 className="mt-5 font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
              One loop, <em className="italic text-terra">seven</em> steps.
            </h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-ink2">
              Each practice session runs the full loop — and every loop makes the next question sharper.
            </p>
          </Reveal>

          <div className="mt-10 space-y-0" data-testid="method-flow">
            {FLOW_STEPS.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.05}>
                <div className="relative flex items-center gap-5 py-3.5">
                  {i < FLOW_STEPS.length - 1 && <span className="absolute left-[22px] top-[38px] h-[calc(100%-14px)] w-px bg-line" />}
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-white font-mono text-xs font-bold text-terra">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex flex-1 items-baseline justify-between gap-4">
                    <span className="text-base font-semibold text-ink">{s.label}</span>
                    <span className="text-right text-xs text-mut sm:text-sm">{s.note}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
