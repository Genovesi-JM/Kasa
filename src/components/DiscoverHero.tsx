import { useEffect, useRef, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import "./discoverHero.css";

/**
 * Drives a 0→1 `--hero-progress` custom property from the hero's scroll
 * position (rAF-throttled, passive). Deterministic across the app's nested
 * scroll containers, and skipped entirely under reduced motion.
 */
function useHeroParallax<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const travel = rect.height || 1;
      // 0 while the hero sits at the top; 1 once it has scrolled fully away.
      const progress = Math.min(Math.max(-rect.top / travel, 0), 1);
      node.style.setProperty("--hero-progress", progress.toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return ref;
}

/**
 * Cinematic, scroll-driven landing hero for the discovery page. A full-viewport
 * residence image parallaxes behind a forest scrim while the serif headline
 * reveals word by word. Entrance motion runs everywhere; the scroll-linked
 * parallax is a progressive enhancement (native scroll-driven animations), and
 * everything collapses to a calm static hero under reduced-motion.
 */
export function DiscoverHero({
  eyebrow,
  title,
  subtitle,
  intent,
  onChooseIntent,
  rentLabel,
  buyLabel,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  intent: "Rent" | "Buy";
  onChooseIntent: (intent: "Rent" | "Buy") => void;
  rentLabel: string;
  buyLabel: string;
}) {
  const words = title.split(/\s+/).filter(Boolean);
  const heroRef = useHeroParallax<HTMLElement>();
  return (
    <section className="discover-hero" ref={heroRef}>
      <div className="discover-hero-media" aria-hidden="true" />
      <div className="discover-hero-scrim" aria-hidden="true" />
      <div className="discover-hero-inner">
        <span className="eyebrow light discover-hero-eyebrow">{eyebrow}</span>
        <h2 className="display-serif discover-hero-title" aria-label={title}>
          {words.map((word, index) => (
            <span
              key={`${word}-${index}`}
              className="discover-hero-word"
              style={{ "--i": index } as CSSProperties}
              aria-hidden="true"
            >
              <span>{word}</span>
            </span>
          ))}
        </h2>
        <p className="discover-hero-sub">{subtitle}</p>
        <div className="intent-switch discover-hero-switch">
          <button
            className={intent === "Rent" ? "active" : ""}
            onClick={() => onChooseIntent("Rent")}
          >
            {rentLabel}
          </button>
          <button
            className={intent === "Buy" ? "active" : ""}
            onClick={() => onChooseIntent("Buy")}
          >
            {buyLabel}
          </button>
        </div>
      </div>
      <span className="discover-hero-cue" aria-hidden="true">
        <ChevronDown size={22} />
      </span>
    </section>
  );
}
