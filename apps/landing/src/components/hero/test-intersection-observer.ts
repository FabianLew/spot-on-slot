import { vi } from "vitest";

type Observed = { callback: IntersectionObserverCallback; options?: IntersectionObserverInit; targets: Element[] };

/** Installs a controllable IntersectionObserver stub; call `vi.unstubAllGlobals()` to remove it. */
export function mockIntersectionObserver() {
  const observers: Observed[] = [];
  class FakeIntersectionObserver {
    private readonly entry: Observed;
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.entry = { callback, options, targets: [] };
      observers.push(this.entry);
    }
    observe(target: Element) {
      this.entry.targets.push(target);
    }
    unobserve() {}
    disconnect() {
      this.entry.targets = [];
    }
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

  return {
    observers,
    /** Reports `isIntersecting` for every observer currently watching `target`. */
    setIntersecting(target: Element, isIntersecting: boolean) {
      for (const observer of observers.filter((o) => o.targets.includes(target))) {
        observer.callback(
          [{ target, isIntersecting } as IntersectionObserverEntry],
          observer as unknown as IntersectionObserver,
        );
      }
    },
  };
}
