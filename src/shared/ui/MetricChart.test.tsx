import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricChart } from "./MetricChart";
describe("MetricChart", () => {
  it("conserva ceros y muestra los valores exactos con foco de teclado", () => {
    const { container } = render(
      <MetricChart
        title="PPM"
        labels={["0001/A", "0002/B"]}
        series={[
          { label: "PPM", values: [0, 25000], color: "#54b7ef" },
          { label: "TARGET", values: [0, 20000], color: "#ff7070" },
        ]}
      />,
    );
    const point = container.querySelector("circle")!;
    fireEvent.focus(point);
    expect(screen.getByRole("status")).toHaveTextContent(
      "0001/A · PPM 0 · TARGET 0",
    );
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    expect(screen.getByRole("img", { name: "PPM" })).toBeInTheDocument();
  });
  it("mantiene una escala finita cuando todas las barras están en cero", () => {
    const { container } = render(
      <MetricChart
        title="UPH"
        labels={["07:30", "08:30"]}
        bars
        series={[{ label: "Escaneos", values: [0, 0], color: "#54b7ef" }]}
      />,
    );
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    expect(container.querySelectorAll("rect")).toHaveLength(2);
  });
});
