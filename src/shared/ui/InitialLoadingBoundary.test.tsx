import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InitialLoadingBoundary } from "./InitialLoadingBoundary";
import { Loading, ErrorState } from "./Feedback";
import { TableSkeleton } from "./Skeleton";
import { TextField } from "./Fields";

describe("initial loading boundary", () => {
  it("keeps one fallback for concurrent initial reads and leaves later loads inside the visible page", () => {
    const ui = (first: boolean, second: boolean) => (
      <StrictMode>
        <InitialLoadingBoundary
          fallback={<p role="status">Preparando vista</p>}
        >
          <TextField label="Captura" defaultValue="Borrador" />
          {first ? <Loading text="Primera consulta" /> : <p>Primera lista</p>}
          {second ? (
            <TableSkeleton label="Segunda consulta" />
          ) : (
            <p>Segunda lista</p>
          )}
        </InitialLoadingBoundary>
      </StrictMode>
    );
    const view = render(ui(true, true));
    const initial = screen.getByRole("status", { name: "" });
    expect(initial).toHaveTextContent("Preparando vista");
    expect(screen.queryByRole("textbox", { name: "Captura" })).toBeNull();
    view.rerender(ui(false, true));
    expect(screen.getByText("Preparando vista")).toBe(initial);
    view.rerender(ui(false, false));
    const field = screen.getByRole("textbox", { name: "Captura" });
    expect(field).toBeVisible();
    expect(screen.queryByText("Preparando vista")).toBeNull();
    view.rerender(ui(true, false));
    expect(screen.getByRole("textbox", { name: "Captura" })).toBe(field);
    expect(field).toHaveValue("Borrador");
    expect(screen.getByRole("status")).toHaveTextContent("Primera consulta");
    expect(screen.queryByText("Preparando vista")).toBeNull();
  });
  it("ignores inactive hidden loaders and reveals an initial failure with its retry action", () => {
    const ui = (pending: boolean) => (
      <InitialLoadingBoundary fallback={<p role="status">Preparando vista</p>}>
        <div hidden>
          <TableSkeleton label="Consulta inactiva" />
        </div>
        {pending ? (
          <Loading />
        ) : (
          <ErrorState error={new Error("Sin conexión")} onRetry={() => {}} />
        )}
      </InitialLoadingBoundary>
    );
    const view = render(ui(true));
    expect(screen.getByText("Preparando vista")).toBeVisible();
    view.rerender(ui(false));
    expect(screen.queryByText("Preparando vista")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Sin conexión");
    expect(
      screen.getByRole("button", { name: "Volver a intentar" }),
    ).toBeEnabled();
  });
});
