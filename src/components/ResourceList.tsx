// @ts-nocheck
import { Play, BookOpen, FileText, GraduationCap, ArrowUpRight } from "lucide-react";
import { RESOURCE_LIBRARY } from "@/lib/resources";

const ICONS = { youtube: Play, docs: BookOpen, article: FileText };

export default function ResourceList({ topics = [], resources, dark = false, testPrefix = "resources" }: any) {
  if (resources) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid={`${testPrefix}-recommended-list`}>
        {resources.map((resource) => (
          <article key={resource.id || resource.url} className={`rounded-2xl border p-4 ${dark ? "border-coaline bg-coal2" : "border-line bg-white"}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="chip !text-[9px] font-mono">{resource.type}</span>
              <span className="font-mono text-[10px] text-mut">{resource.duration}</span>
            </div>
            <h4 className={`mt-3 text-sm font-semibold leading-snug ${dark ? "text-paper" : "text-ink"}`}>{resource.title}</h4>
            <p className={`mt-2 text-xs leading-relaxed ${dark ? "text-paper/60" : "text-ink2"}`}>{resource.reason}</p>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-mut">{resource.topic} · {resource.source}</p>
            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-terra hover:underline">
              Open resource <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-4" data-testid={`${testPrefix}-list`}>
      {topics.map((id) => {
        const t = RESOURCE_LIBRARY[id];
        if (!t) return null;
        return (
          <div
            key={id}
            className={`rounded-2xl border p-5 ${dark ? "border-coaline bg-coal2" : "border-line bg-white"}`}
            data-testid={`${testPrefix}-topic-${id}`}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-terrasoft text-terra">
                <GraduationCap className="h-4 w-4" />
              </span>
              <p className={`text-sm font-semibold ${dark ? "text-paper" : "text-ink"}`}>{t.label}</p>
            </div>
            <p className={`mt-2 text-xs leading-relaxed ${dark ? "text-paper/50" : "text-mut"}`}>{t.blurb}</p>
            <div className="mt-3.5 space-y-2">
              {t.items.map((it) => {
                const Icon = ICONS[it.type] || FileText;
                return (
                  <a
                    key={it.url}
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`${testPrefix}-link-${it.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`}
                    className={`group flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-all hover:border-terra ${
                      dark ? "border-coaline bg-coal hover:bg-coal3" : "border-line bg-cream/40 hover:bg-white hover:shadow-lift"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-terra" />
                      <span className={`truncate text-xs font-medium ${dark ? "text-paper/85" : "text-ink2"}`}>{it.label}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-mut">
                      {it.source}
                      <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
