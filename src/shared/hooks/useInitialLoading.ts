import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  type RefObject,
} from "react";

export const InitialLoadingContext = createContext<
  ((id: string) => () => void) | null
>(null);

/** Register displayed loading content until its boundary reveals the initial view. */
export function useInitialLoading(element?: RefObject<HTMLElement | null>) {
  const id = useId();
  const register = useContext(InitialLoadingContext);
  useLayoutEffect(() => {
    if (!register || element?.current?.closest("[hidden]")) return;
    return register(id);
  });
}
