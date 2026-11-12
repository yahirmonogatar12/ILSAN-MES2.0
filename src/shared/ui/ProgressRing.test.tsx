import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressRing } from "./ProgressRing";
describe("shared percentage ring", () => {
  it("presents the supplied percentage and label accessibly", () => {
    render(<ProgressRing value={75.25} label="Accuracy" />);
    expect(screen.getByRole("img", { name: "Accuracy 75.25%" })).toBeVisible();
    expect(screen.getByText("75.25%")).toBeVisible();
  });
  it.each([
    [NaN, 0],
    [Infinity, 0],
    [-10, 0],
    [150, 100],
  ])("bounds %s to %s", (value, result) => {
    render(<ProgressRing value={value} label="Cumplimiento" />);
    expect(
      screen.getByRole("img", { name: "Cumplimiento " + result + "%" }),
    ).toBeVisible();
  });
});
