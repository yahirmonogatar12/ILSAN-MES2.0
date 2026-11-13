import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import * as scripts from "../lib/loadScript";
import { SpreadsheetPreview } from "./SpreadsheetPreview";
import {
  MAX_SPREADSHEET_BYTES,
  validateSpreadsheetSize,
} from "../lib/spreadsheet";
afterEach(() => {
  vi.restoreAllMocks();
  delete window.XLSX;
});
it.each([0, -1, NaN, Infinity, MAX_SPREADSHEET_BYTES + 1])(
  "rejects size %s before loading or reading Excel",
  async (size) => {
    const load = vi.spyOn(scripts, "loadScript").mockResolvedValue();
    const arrayBuffer = vi.fn();
    render(
      <SpreadsheetPreview
        blob={{ size, arrayBuffer } as unknown as Blob}
        name="large.xlsx"
      />,
    );
    await screen.findByText(
      "La vista previa de Excel admite archivos con datos de hasta 200 MB.",
    );
    expect(load).not.toHaveBeenCalled();
    expect(arrayBuffer).not.toHaveBeenCalled();
  },
);
it("accepts the exact preview size limit", () => {
  expect(MAX_SPREADSHEET_BYTES).toBe(200 * 1024 * 1024);
  expect(() => validateSpreadsheetSize(MAX_SPREADSHEET_BYTES)).not.toThrow();
});
it.each([20 * 1024 * 1024 + 1, 100 * 1024 * 1024])(
  "accepts %s bytes within the increased limit",
  (size) => {
    expect(() => validateSpreadsheetSize(size)).not.toThrow();
  },
);
it("stops before allocating a buffer when the viewer closes during engine loading", async () => {
  let finish!: () => void;
  vi.spyOn(scripts, "loadScript").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  window.XLSX = { version: "0.20.3" } as NonNullable<Window["XLSX"]>;
  const arrayBuffer = vi.fn();
  const view = render(
    <SpreadsheetPreview
      blob={{ size: 1, arrayBuffer } as unknown as Blob}
      name="test.xlsx"
    />,
  );
  view.unmount();
  await act(async () => finish());
  expect(arrayBuffer).not.toHaveBeenCalled();
});
it("rejects a stale engine loaded by an older page", async () => {
  vi.spyOn(scripts, "loadScript").mockResolvedValue();
  const arrayBuffer = vi.fn();
  window.XLSX = { version: "0.18.5" } as NonNullable<Window["XLSX"]>;
  render(
    <SpreadsheetPreview
      blob={{ size: 1, arrayBuffer } as unknown as Blob}
      name="test.xlsx"
    />,
  );
  await screen.findByText(
    "No se pudo cargar la versión actual del lector de Excel. Recarga la página.",
  );
  expect(arrayBuffer).not.toHaveBeenCalled();
});
it("presenta texto de Excel sin HTML ejecutable, conserva cero y permite cambiar de hoja", async () => {
  vi.spyOn(scripts, "loadScript").mockResolvedValue();
  const unsafe = '<img src=x onerror="alert(1)">';
  window.XLSX = {
    version: "0.20.3",
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
  const blob = { size: 1, arrayBuffer: async () => new ArrayBuffer(1) } as Blob;
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
