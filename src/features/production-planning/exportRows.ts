import { exportSpreadsheet } from "@/shared/lib/spreadsheet";
import { text } from "./model";
import type { Row, Spec } from "./types";

export async function exportRows(
  name: string,
  specs: readonly Spec[],
  records: readonly Row[],
) {
  await exportSpreadsheet(`${name}.xlsx`, [
    {
      name: "Consulta",
      rows: [
        specs.map((spec) => spec[1]),
        ...records.map((row) =>
          specs.map(([key]) => {
            const value = row[key];
            return typeof value === "number" || typeof value === "boolean"
              ? value
              : text(value);
          }),
        ),
      ],
    },
  ]);
}
