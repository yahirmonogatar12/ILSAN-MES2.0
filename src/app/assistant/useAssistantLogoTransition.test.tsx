import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAssistantLogoTransition } from "./useAssistantLogoTransition";

const original = Object.getOwnPropertyDescriptor(
  document,
  "startViewTransition",
);
beforeEach(() => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  vi.spyOn(window, "matchMedia").mockReturnValue({ ...media, matches: false });
});
afterEach(() => {
  if (original)
    Object.defineProperty(document, "startViewTransition", original);
  else Reflect.deleteProperty(document, "startViewTransition");
  document.documentElement.classList.remove("assistant-logo-transition");
  vi.restoreAllMocks();
});
function pendingTransition(ready: Promise<void> = Promise.resolve()) {
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  return {
    ready,
    finished,
    updateCallbackDone: Promise.resolve(),
    skipTransition: vi.fn(),
    finish,
  };
}
function install(...transitions: ReturnType<typeof pendingTransition>[]) {
  const queue = [...transitions];
  const start = vi.fn((update: () => void) => {
    update();
    return queue.shift()!;
  });
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: start,
  });
  return start;
}
describe("assistant logo transition", () => {
  it("keeps ordinary activation when the browser has no transition API", () => {
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: undefined,
    });
    const update = vi.fn();
    const { result } = renderHook(useAssistantLogoTransition);
    act(() => result.current(update));
    expect(update).toHaveBeenCalledOnce();
    expect(document.documentElement).not.toHaveClass(
      "assistant-logo-transition",
    );
  });
  it("applies the update directly when reduced motion is requested", () => {
    const start = install(pendingTransition());
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    vi.spyOn(window, "matchMedia").mockReturnValue({ ...media, matches: true });
    const update = vi.fn();
    const { result } = renderHook(useAssistantLogoTransition);
    act(() => result.current(update));
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledOnce();
  });
  it("cleans up a skipped capture without losing the state change", async () => {
    const transition = pendingTransition(
      Promise.reject(new Error("Capture skipped")),
    );
    install(transition);
    const update = vi.fn();
    const { result } = renderHook(useAssistantLogoTransition);
    act(() => result.current(update));
    expect(update).toHaveBeenCalledOnce();
    expect(document.documentElement).toHaveClass("assistant-logo-transition");
    await act(async () => transition.finish());
    expect(document.documentElement).not.toHaveClass(
      "assistant-logo-transition",
    );
  });
  it("does not let the previous completion remove a replacement transition", async () => {
    const first = pendingTransition(),
      second = pendingTransition();
    install(first, second);
    const { result } = renderHook(useAssistantLogoTransition);
    act(() => result.current(vi.fn()));
    act(() => result.current(vi.fn()));
    expect(first.skipTransition).toHaveBeenCalledOnce();
    await act(async () => first.finish());
    expect(document.documentElement).toHaveClass("assistant-logo-transition");
    await act(async () => second.finish());
    expect(document.documentElement).not.toHaveClass(
      "assistant-logo-transition",
    );
  });
  it("cancels the decorative transition when access unmounts the assistant", async () => {
    const transition = pendingTransition();
    install(transition);
    const { result, unmount } = renderHook(useAssistantLogoTransition);
    act(() => result.current(vi.fn()));
    unmount();
    expect(transition.skipTransition).toHaveBeenCalledOnce();
    expect(document.documentElement).not.toHaveClass(
      "assistant-logo-transition",
    );
    await act(async () => transition.finish());
  });
});
