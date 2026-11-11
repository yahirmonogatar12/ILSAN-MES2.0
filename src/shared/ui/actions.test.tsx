import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ActionGroup } from "./ActionGroup";
afterEach(() => vi.restoreAllMocks());
it("conserva las acciones y sus restricciones en el selector móvil compacto", async () => {
  const media = window.matchMedia("(max-width: 700px)");
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    ...media,
    media: query,
    matches: true,
  }));
  const open = vi.fn();
  const blocked = vi.fn();
  render(
    <ActionGroup
      label="Acciones disponibles"
      actions={[
        { id: "open", label: "Abrir", onClick: open },
        { id: "blocked", label: "Bloqueada", onClick: blocked, disabled: true },
      ]}
    />,
  );
  const selector = screen.getByRole("combobox", {
    name: "Acciones disponibles",
  });
  expect(
    screen.queryByRole("button", { name: "Abrir" }),
  ).not.toBeInTheDocument();
  await userEvent.selectOptions(selector, "open");
  expect(open).toHaveBeenCalledOnce();
  expect(selector).toHaveValue("");
  expect(screen.getByRole("option", { name: "Bloqueada" })).toBeDisabled();
  expect(blocked).not.toHaveBeenCalled();
});
