import { Asterisk } from "lucide-react";
import { MARQUEE_ITEMS } from "@/lib/mockData";

export default function Marquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <section className="border-y border-coaline bg-coal py-6" data-testid="editorial-marquee">
      <div className="mask-fade-x overflow-hidden">
        <div className="flex w-max animate-marquee items-center gap-10 pr-10">
          {items.map((item, i) => (
            <span key={i} className="flex items-center gap-10 whitespace-nowrap">
              <span className="font-display text-xl italic text-paper/90">{item}</span>
              <Asterisk className="h-5 w-5 text-terra" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
