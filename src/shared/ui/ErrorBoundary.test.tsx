import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Content({ fail }: { fail: boolean }) {
  if (fail) throw new Error("Fallo controlado");
  return <p>Contenido disponible</p>;
}

function ManualRecovery() {
  const [fail, setFail] = useState(true);
  return (
    <ErrorBoundary
      fallback={(_, reset) => (
        <button
          onClick={() => {
            setFail(false);
            reset();
          }}
        >
          Reintentar
        </button>
      )}
    >
      <Content fail={fail} />
    </ErrorBoundary>
  );
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("muestra el fallback con el error capturado", () => {
    render(
      <ErrorBoundary fallback={(error) => <p>{error.message}</p>}>
        <Content fail />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Fallo controlado")).toBeInTheDocument();
  });

  it("conserva el error mientras resetKey no cambie", () => {
    const fallback = (error: Error) => <p>{error.message}</p>;
    const view = render(
      <ErrorBoundary resetKey="misma" fallback={fallback}>
        <Content fail />
      </ErrorBoundary>,
    );

    view.rerender(
      <ErrorBoundary resetKey="misma" fallback={fallback}>
        <Content fail={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Fallo controlado")).toBeInTheDocument();
    expect(screen.queryByText("Contenido disponible")).not.toBeInTheDocument();
  });

  it("se recupera durante la renderización al cambiar resetKey", () => {
    const fallback = (error: Error) => <p>{error.message}</p>;
    const view = render(
      <ErrorBoundary resetKey="anterior" fallback={fallback}>
        <Content fail />
      </ErrorBoundary>,
    );

    view.rerender(
      <ErrorBoundary resetKey="nuevo" fallback={fallback}>
        <Content fail={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Contenido disponible")).toBeInTheDocument();
  });

  it("permite una recuperación manual mediante el fallback", () => {
    render(<ManualRecovery />);

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(screen.getByText("Contenido disponible")).toBeInTheDocument();
  });
});
