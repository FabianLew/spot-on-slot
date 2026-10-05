"use client";

import { type RefObject, useEffect, useState } from "react";

/**
 * Whether `target` (a ref or an element id) intersects the viewport, shrunk by `rootMargin`.
 * Starts as `true` because the hero is on screen at load, and stays `true` where
 * IntersectionObserver is unavailable.
 */
export function useInView(target: RefObject<Element | null> | string, rootMargin = "0px"): boolean {
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const element = typeof target === "string" ? document.getElementById(target) : target.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (entry) setInView(entry.isIntersecting);
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [target, rootMargin]);

  return inView;
}
