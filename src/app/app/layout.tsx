'use client';

import { NavLink, Link } from "@/lib/routerCompat";
import { LayoutDashboard, Mic, History, TrendingUp, Bot, Plus } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/features/auth/context/AuthContext";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/app/practice", label: "Practice", icon: Mic, testid: "nav-practice" },
  { to: "/app/sessions", label: "Sessions", icon: History, testid: "nav-sessions" },
  { to: "/app/plan", label: "Improvement Plan", icon: TrendingUp, testid: "nav-plan" },
  { to: "/app/agents", label: "Agents", icon: Bot, testid: "nav-agents" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto flex max-w-[1500px]">
        {/* Desktop Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-cream/40 px-5 py-6 lg:flex" data-testid="dashboard-sidebar-nav">
          <Link to="/" data-testid="sidebar-logo-link">
            <Logo />
          </Link>
          <nav className="mt-10 flex-1 space-y-1">
            {NAV.map(({ to, label, icon: Icon, end, testid }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                data-testid={testid}
                className={({ isActive }: { isActive: boolean }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                    isActive ? "bg-ink text-paper shadow-lift" : "text-ink2 hover:bg-white"
                  }`
                }
              >
                <Icon className="h-4 w-4" /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="space-y-3">
            <Link to="/app/practice" data-testid="sidebar-new-practice-btn" className="btn-terra w-full !px-4 !py-2.5 !text-xs">
              <Plus className="h-4 w-4" /> New practice
            </Link>
            <div className="rounded-2xl border border-line bg-white p-4" data-testid="sidebar-profile-card">
              <Link to="/onboarding/profile" className="flex items-center gap-3 group">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-terra font-display text-sm italic text-white transition-transform group-hover:scale-105">
                  {(user?.name || "G").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink group-hover:text-terra transition-colors">{user?.name || "Guest Candidate"}</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-mut">
                    {user ? "Candidate" : "Sign in to save progress"}
                  </p>
                </div>
              </Link>
              {user ? (
                <button
                  onClick={logout}
                  data-testid="sidebar-signout-btn"
                  className="mt-3 w-full rounded-lg border border-line py-1.5 text-[11px] font-medium text-ink2 transition-colors hover:border-ink hover:bg-paper cursor-pointer"
                >
                  Sign out
                </button>
              ) : (
                <Link
                  to="/signup"
                  data-testid="sidebar-signin-btn"
                  className="mt-3 block rounded-lg border border-line py-1.5 text-center text-[11px] font-medium text-ink2 transition-colors hover:border-ink hover:bg-paper"
                >
                  Sign in to save progress
                </Link>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 lg:pl-64">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line glass px-5 py-3 lg:hidden">
            <Link to="/"><Logo /></Link>
            <Link to="/app/practice" className="btn-terra !px-4 !py-2 !text-xs" data-testid="mobile-new-practice-btn">
              <Plus className="h-3.5 w-3.5" /> Practice
            </Link>
          </header>
          <div className="flex gap-2 overflow-x-auto no-scrollbar border-b border-line px-5 py-2.5 lg:hidden">
            {NAV.map(({ to, label, end, testid }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                data-testid={`${testid}-mobile`}
                className={({ isActive }: { isActive: boolean }) =>
                  `whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium ${
                    isActive ? "bg-ink text-paper" : "bg-white text-ink2 border border-line"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>

          <main className="px-5 py-8 sm:px-8 lg:px-10">
            <div className="mx-auto max-w-6xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
