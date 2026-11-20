import type { KeyboardEvent } from "react";

const CONTROLS =
  "button:not(:disabled), a[href], input:not(:disabled):not([type=hidden]), select:not(:disabled), textarea:not(:disabled)";

/** Enabled controls inside root, in document order, skipping hidden or inert regions. */
export function focusableControls(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(CONTROLS)].filter(
    (element) => !element.closest("[hidden], [inert]"),
  );
}

/** Text-entry targets keep their own arrow, Home/End and Enter behavior. */
export function isTextEntry(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.matches("input, textarea, select") || target.isContentEditable)
  );
}

/** Arrow keys move focus between a menu's buttons and links; Home/End jump to the ends. */
export function moveFocusWithArrows(
  event: KeyboardEvent<HTMLElement>,
  previous: "ArrowLeft" | "ArrowUp",
  next: "ArrowRight" | "ArrowDown",
) {
  const items = focusableControls(event.currentTarget).filter((element) =>
    element.matches("button, a[href]"),
  );
  const index = items.indexOf(document.activeElement as HTMLElement);
  const target = {
    [previous]: index - 1,
    [next]: index + 1,
    Home: 0,
    End: items.length - 1,
  }[event.key];
  if (index < 0 || target === undefined || event.altKey || event.ctrlKey)
    return;
  event.preventDefault();
  items[(target + items.length) % items.length].focus();
}
