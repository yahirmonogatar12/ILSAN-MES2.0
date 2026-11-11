import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PercentageBar } from "@/shared/ui";
import { passFailView } from "@/features/production-results/machineViews";
import { passFailColumns } from "@/features/production-results/passFailColumns";

describe("Porcentajes de los historiales de máquinas", () => {
  it.each(["ict", "vision"] as const)(
    "%s presenta dos decimales, barra combinada y fail lateral",
    (kind) => {
      const columns = passFailColumns(passFailView(kind), kind, false, vi.fn());
      const row = { porcentaje_ok: 78.125, porcentaje_ng: 21.875 };
      render(
        <>{columns.find((column) => column.id === "percentage")!.cell(row)}</>,
      );
      const bar = screen.getByRole("img", { name: "Pass 78.13%, Fail 21.88%" });
      expect(bar.querySelector(".percentage-bar-positive")).toHaveStyle({
        width: "78.125%",
      });
      expect(bar.querySelector(".percentage-bar-negative")).toHaveStyle({
        width: "21.875%",
      });
      expect(bar.querySelector(".percentage-bar-label")).toHaveTextContent(
        "78.13%",
      );
      expect(bar.querySelector(".percentage-bar-side-label")).toHaveTextContent(
        "21.88%",
      );
      expect(
        columns.reduce(
          (sum, column) => sum + parseFloat(String(column.width)),
          0,
        ),
      ).toBeCloseTo(100);
      expect(
        parseFloat(
          String(columns.find((column) => column.id === "percentage")!.width),
        ),
      ).toBeGreaterThan(23);
    },
  );

  it.each([
    ["porcentaje_ok", 90, "good", "90.00%"],
    ["porcentaje_ok", 89.99, "neutral", "89.99%"],
    ["porcentaje_ng", 10, "neutral", "10.00%"],
    ["porcentaje_ng", 10.01, "bad", "10.01%"],
    ["porcentaje_ok", 100, "good", "100.00%"],
    ["porcentaje_ng", 0, "neutral", "0.00%"],
  ])("%s aplica el umbral original a %s", (key, value, tone, label) => {
    const column = passFailColumns(
      passFailView("vision"),
      "vision",
      false,
      vi.fn(),
    ).find((item) => item.id === key)!;
    render(<>{column.cell({ [key]: value })}</>);
    expect(screen.getByText(label)).toHaveClass(
      "production-results-rate-" + tone,
    );
    expect(column.textValue!({ [key]: value })).toBe(label);
    expect(column.sortValue!({ [key]: value })).toBe(value);
  });

  it.each([
    ["porcentaje_deteccion", 90, "good"],
    ["porcentaje_falso_negativo", 0.01, "bad"],
    ["porcentaje_falso_fail", 10, "neutral"],
  ])("formatea %s en el detalle ICT", (key, value, tone) => {
    const columns = passFailColumns(
      passFailView("ict", true),
      "ict",
      true,
      vi.fn(),
    );
    render(
      <>
        {columns.find((column) => column.id === key)!.cell({ [key]: value })}
      </>,
    );
    expect(screen.getByText(Number(value).toFixed(2) + "%")).toHaveClass(
      "production-results-rate-" + tone,
    );
    expect(columns.some((column) => column.id === "percentage")).toBe(false);
  });

  it("FCT conserva una barra por porcentaje y el detalle de su grupo", () => {
    const onDetail = vi.fn();
    const columns = passFailColumns(
      passFailView("fct"),
      "fct",
      false,
      onDetail,
    );
    const row = { pass_pct: 85.5, fail_pct: 14.5, numero_parte: "EBR01" };
    render(
      <>
        {columns
          .filter((column) =>
            ["pass_pct", "fail_pct", "detail"].includes(column.id),
          )
          .map((column) => (
            <div key={column.id}>{column.cell(row)}</div>
          ))}
      </>,
    );
    expect(
      screen
        .getByRole("img", { name: "% Pass 85.50%" })
        .querySelector(".percentage-bar-positive"),
    ).toHaveStyle({ width: "85.5%" });
    expect(
      screen
        .getByRole("img", { name: "% Fail 14.50%" })
        .querySelector(".percentage-bar-negative"),
    ).toHaveStyle({ width: "14.5%" });
    expect(screen.getByText("85.50%")).toHaveClass("percentage-bar-side-label");
    expect(columns.some((column) => column.id === "percentage")).toBe(false);
    screen.getByRole("button").click();
    expect(onDetail).toHaveBeenCalledWith(row);
  });

  it("limita los anchos de la barra sin modificar las etiquetas recibidas", () => {
    render(
      <PercentageBar
        label="Medición de prueba"
        segments={[
          { value: -10, tone: "negative" },
          { value: 120, tone: "positive", label: "120.00%" },
          { value: Number.NaN, tone: "negative" },
        ]}
        sideLabel="0.00%"
      />,
    );
    const segments = screen
      .getByRole("img")
      .querySelectorAll(".percentage-bar-segment");
    expect(
      Array.from(segments, (segment) => (segment as HTMLElement).style.width),
    ).toEqual(["0%", "100%", "0%"]);
    expect(screen.getByText("120.00%")).toBeInTheDocument();
  });
});
