export const LogoMark = ({ className = "h-8 w-8" }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <rect width="64" height="64" rx="14" fill="#141210" />
    <circle cx="20" cy="44" r="4" fill="#4A7494" />
    <path d="M30 44 A 10 10 0 0 0 20 34" stroke="#4A7494" strokeWidth="4.5" strokeLinecap="round" fill="none" />
    <path
      d="M38 44 A 18 18 0 0 0 20 26"
      stroke="#4A7494"
      strokeWidth="4.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.72"
    />
    <path
      d="M46 44 A 26 26 0 0 0 20 18"
      stroke="#4A7494"
      strokeWidth="4.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.4"
    />
  </svg>
);

export const Logo = ({ dark = false, markClass = "h-8 w-8", textClass = "text-xl" }) => (
  <span className="inline-flex items-center gap-2.5">
    <LogoMark className={markClass} />
    <span className={`font-display tracking-tight ${dark ? "text-paper" : "text-ink"} ${textClass}`}>
      Cadence
    </span>
  </span>
);

export default Logo;
