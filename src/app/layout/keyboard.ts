import { focusableControls } from "@/shared/lib/focus";

const visible = (element: HTMLElement) =>
  element.getClientRects().length > 0 && !element.closest("[inert]");

/** First visible match, trying each selector in order. */
function find(root: ParentNode, ...selectors: string[]) {
  for (const selector of selectors) {
    const match = [...root.querySelectorAll<HTMLElement>(selector)].find(
      visible,
    );
    if (match) return match;
  }
  return null;
}

/** The workspace pane the user is in; with a split view, the one holding focus. */
function activePane() {
  const panes = [
    ...document.querySelectorAll<HTMLElement>(".workspace-panel:not([hidden])"),
  ];
  return (
    panes.find((pane) => pane.contains(document.activeElement)) ??
    panes[0] ??
    document.getElementById("main-content") ??
    document
  );
}

const targets: Record<string, () => HTMLElement | null> = {
  "1": () =>
    find(
      document,
      ".section-navigation .section-tile.active",
      ".section-navigation .section-tile:not(:disabled)",
    ),
  "2": () =>
    find(
      document,
      ".sidebar-navigation a.active",
      ".sidebar-navigation a, .sidebar-navigation .nav-parent",
      ".sidebar-rail-link.active",
      ".sidebar-rail-link",
      ".sidebar-toggle",
    ),
  "3": () =>
    find(document, '.workspace-tabs [role="tab"][aria-selected="true"]'),
  "4": () =>
    focusableControls(activePane()).find(
      (element) =>
        element.matches("input, select, textarea") &&
        !element.closest("table") &&
        visible(element),
    ) ?? null,
  "5": () => find(activePane(), 'table [data-row][tabindex="0"]'),
};

/** Focus a screen region: 1 sections, 2 module list, 3 open tabs, 4 filters, 5 table. */
export function focusRegion(region: string) {
  targets[region]?.()?.focus();
}
