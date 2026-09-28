import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/routerCompat";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { getStartPracticingRoute } from "@/lib/authRoute";

const LINKS = [
  { label: "Features", href: "#features" },
  { label: "5-Agent Engine", href: "#agents" },
  { label: "Try it live", href: "#practice-demo" },
  { label: "Method", href: "#method" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [practiceRoute, setPracticeRoute] = useState("/signup");
  const nav = useNavigate();

  useEffect(() => {
    setPracticeRoute(getStartPracticingRoute());
  }, []);

  const handleStartPracticing = (e: React.MouseEvent) => {
    e.preventDefault();
    const route = getStartPracticingRoute();
    nav(route);
  };

  return (
    <header className="glass fixed inset-x-0 top-0 z-50 border-b border-line">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <a href="#top" data-testid="nav-logo-link">
          <Logo />
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              data-testid={`nav-link-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-sm font-medium text-ink2 transition-colors hover:text-terra"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Link to="/app" data-testid="nav-dashboard-btn" className="text-sm font-medium text-ink2 transition-colors hover:text-terra">
            Dashboard
          </Link>
          <a
            href={practiceRoute}
            onClick={handleStartPracticing}
            data-testid="nav-launch-arena-btn"
            className="btn-terra !px-5 !py-2.5"
          >
            Start practicing <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)} data-testid="nav-mobile-toggle" aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-line bg-paper px-6 py-4 md:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2.5 text-sm font-medium text-ink2">
              {l.label}
            </a>
          ))}
          <a
            href={practiceRoute}
            onClick={(e) => {
              setOpen(false);
              handleStartPracticing(e);
            }}
            className="btn-terra mt-3 w-full"
            data-testid="nav-mobile-cta"
          >
            Start practicing
          </a>
        </div>
      )}
    </header>
  );
}
