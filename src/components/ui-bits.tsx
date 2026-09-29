'use client';

import { motion } from "framer-motion";
import type { ReactNode } from 'react';

export const Reveal = ({ children, delay = 0, className = "", y = 24 }: { children: ReactNode; delay?: number; className?: string; y?: number }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.15 }}
    transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

export const SectionTag = ({ children, dark = false }: { children: ReactNode; dark?: boolean }) => (
  <p className={`eyebrow flex items-center gap-2 ${dark ? "text-coal3" : ""}`}>
    <span className={`h-px w-8 ${dark ? "bg-coal3" : "bg-terra"}`} />
    {children}
  </p>
);

export const ScoreRing = ({ value, size = 120, stroke = 9, label = "Overall", testid }: { value: number; size?: number; stroke?: number; label?: string; testid?: string }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" data-testid={testid || "score-gauge-overall"}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDE9E0" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#4A7494"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * value) / 100 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-bold tracking-tight text-ink">{value}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-mut">{label}</span>
      </div>
    </div>
  );
};

export const ScoreBar = ({ label, value, weight, delay = 0 }: { label: string; value: number; weight?: number; delay?: number }) => (
  <div data-testid={`score-bar-${label.toLowerCase().replace(/\s+/g, "-")}`}>
    <div className="mb-1.5 flex items-baseline justify-between">
      <span className="text-sm font-medium text-ink2">
        {label} {weight ? <span className="ml-1 font-mono text-[10px] text-mut">{weight}%</span> : null}
      </span>
      <span className="font-mono text-sm font-bold text-terra">{value}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-[#EDE9E0]">
      <motion.div
        className="h-full rounded-full bg-terra"
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  </div>
);

export const statusTone = (score: number) =>
  score >= 80 ? "bg-sagesoft text-sage" : score >= 65 ? "bg-ochresoft text-ochre" : "bg-terrasoft text-terrad";
