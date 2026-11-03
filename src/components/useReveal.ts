import { useEffect, useRef } from "react";

/**
 * Gentle scroll-reveal. Returns a ref to attach to a container; every
 * descendant carrying `data-reveal` rises and fades in as it enters the
 * viewport. Elements are only armed (hidden) once this effect runs, so a
 * no-JS or pre-hydration render shows all content. Reduced-motion users and
 * browsers without IntersectionObserver see everything immediately.
 *
 * Stagger children with inline `style={{ "--reveal-delay": "80ms" }}`.
 */
export function useReveal<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const targets = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    if (targets.length === 0) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.setAttribute("data-reveal", "shown"));
      return;
    }

    targets.forEach((el) => el.setAttribute("data-reveal", "armed"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-reveal", "shown");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return ref;
}
