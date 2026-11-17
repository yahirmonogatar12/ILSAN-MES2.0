import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";

/** Move the assistant mark between its launcher and the shared panel header. */
export function useAssistantLogoTransition() {
  const active = useRef<ViewTransition | null>(null);
  useEffect(
    () => () => {
      active.current?.skipTransition();
      active.current = null;
      document.documentElement.classList.remove("assistant-logo-transition");
    },
    [],
  );
  return useCallback((update: () => void) => {
    active.current?.skipTransition();
    if (
      typeof document.startViewTransition !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      update();
      return;
    }
    const root = document.documentElement;
    root.classList.add("assistant-logo-transition");
    let transition: ViewTransition;
    try {
      transition = document.startViewTransition(() => flushSync(update));
    } catch {
      root.classList.remove("assistant-logo-transition");
      update();
      return;
    }
    active.current = transition;
    // Skipped/unsupported captures still apply the state change normally.
    void transition.ready.catch(() => {});
    void transition.updateCallbackDone.catch(() => {});
    void transition.finished
      .catch(() => {})
      .finally(() => {
        if (active.current !== transition) return;
        active.current = null;
        root.classList.remove("assistant-logo-transition");
      });
  }, []);
}
