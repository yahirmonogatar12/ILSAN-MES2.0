import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  InitialLoadingContext,
  useInitialLoading,
} from "../hooks/useInitialLoading";
import "./initial-loading.css";

/** Suspense reports pending code through the same boundary as pending data. */
export function LoadingPending() {
  useInitialLoading();
  return null;
}

/** Keep one fallback until the initial code and data have settled. */
export function InitialLoadingBoundary({
  fallback,
  children,
}: {
  fallback: ReactNode;
  children: ReactNode;
}) {
  const pending = useRef(new Set<string>());
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const register = useCallback((id: string) => {
    pending.current.add(id);
    setVersion((value) => value + 1);
    return () => {
      if (pending.current.delete(id)) setVersion((value) => value + 1);
    };
  }, []);
  useLayoutEffect(() => {
    // Child layout effects register before this check, preventing an intermediate paint.
    if (!pending.current.size) setReady(true);
  }, [version]);

  return (
    <div className="ui-initial-loading" aria-busy={!ready}>
      <InitialLoadingContext value={ready ? null : register}>
        <div
          className="ui-initial-loading-content"
          aria-hidden={ready ? undefined : true}
          inert={!ready}
        >
          {children}
        </div>
      </InitialLoadingContext>
      {!ready && <div className="ui-initial-loading-overlay">{fallback}</div>}
    </div>
  );
}
