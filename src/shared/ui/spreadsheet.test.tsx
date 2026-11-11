import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import * as scripts from "../lib/loadScript";
import { SpreadsheetPreview } from "./SpreadsheetPreview";
afterEach(() => {
  vi.restoreAllMocks();
  delete window.XLSX;
});
it("presenta texto de Excel sin HTML ejecutable, conserva cero y permite cambiar de hoja", async () => {
  vi.spyOn(scripts, "loadScript").mockResolvedValue();
  const unsafe = '<img src=x onerror="alert(1)">';
  window.XLSX = {
    read: vi.fn().mockReturnValue({
      SheetNames: ["OTRA", "INVOICE(CONVERTED)"],
      Sheets: {
        OTRA: { "!ref": "A1:A2", A1: { v: "Otra hoja" }, A2: { v: "0001-A" } },
        "INVOICE(CONVERTED)": {
          "!ref": "A1:B2",
          A1: { v: "PART SYS" },
          B1: { v: "QTY" },
          A2: { v: unsafe },
          B2: { v: 0, w: "0.00" },
          "!merges": [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }],
        },
      },
    }),
    utils: {
      decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 1, c: 1 } }),
      encode_col: (index: number) => ["A", "B"][index],
      sheet_to_json: (sheet: { data: string[][] }) => sheet.data,
    },
  } as unknown as NonNullable<typeof window.XLSX>;
  const blob = { arrayBuffer: async () => new ArrayBuffer(1) } as Blob;
  const { container } = render(
    <SpreadsheetPreview blob={blob} name="invoice.xlsx" />,
  );
  const table = await screen.findByRole("table");
  expect(table).toHaveTextContent(unsafe);
  expect(table).toHaveTextContent("0.00");
  expect(screen.getByRole("cell", { name: "PART SYS" })).toHaveAttribute(
    "colspan",
    "2",
  );
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByLabelText("Ir a hoja")).toHaveValue("INVOICE(CONVERTED)");
  await userEvent.click(screen.getByRole("tab", { name: "OTRA" }));
  expect(await screen.findByText("0001-A")).toBeInTheDocument();
});
