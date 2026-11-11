import { useEffect } from "react";
let locks = 0;
let originalOverflow = "";
/** Multiple overlays share one lock, including nested dialogs and mobile menus. */
export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    if (locks === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) document.body.style.overflow = originalOverflow;
    };
  }, [active]);
}
