import { Button, PercentageBar, type TableColumn } from "@/shared/ui";
import { columnsFor } from "./resultColumns";
import { number, text } from "./model";
import type { TestKind } from "./machineViews";
import type { Row, ViewSpec } from "./types";

const percentageKeys = new Set([
  "porcentaje_ok",
  "porcentaje_ng",
  "porcentaje_deteccion",
  "porcentaje_falso_negativo",
  "porcentaje_falso_fail",
  "pass_pct",
  "fail_pct",
]);
const positiveKeys = new Set([
  "porcentaje_ok",
  "porcentaje_deteccion",
  "pass_pct",
]);
const formatPercent = (value: number) => value.toFixed(2) + "%";

/** Original report presentation, retaining numeric sorting and plain-text filtering. */
export function passFailColumns(
  spec: ViewSpec,
  kind: TestKind,
  detailed: boolean,
  onDetail: (row: Row) => void,
): TableColumn<Row>[] {
  const columns = columnsFor(spec.columns).map((column, index) => {
    const percentage = percentageKeys.has(column.id);
    return {
      ...column,
      width: kind === "fct" && percentage ? 240 : spec.columns[index].width,
      ...(percentage && {
        textValue: (row: Row) => formatPercent(number(row[column.id])),
        cell: (row: Row) => {
          const value = number(row[column.id]);
          const label = formatPercent(value);
          const positive = positiveKeys.has(column.id);
          if (kind === "fct")
            return (
              <PercentageBar
                label={column.header + " " + label}
                segments={[{ value, tone: positive ? "positive" : "negative" }]}
                sideLabel={label}
              />
            );
          const threshold = column.id === "porcentaje_falso_negativo" ? 0 : 10;
          const tone = positive
            ? value >= 90
              ? "good"
              : "neutral"
            : value > threshold
              ? "bad"
              : "neutral";
          return (
            <span
              className={
                "production-results-rate production-results-rate-" + tone
              }
            >
              {label}
            </span>
          );
        },
      }),
    };
  });
  if (kind !== "fct" && !detailed)
    columns.push({
      id: "percentage",
      header: "Porcentaje",
      width: kind === "vision" ? 300 : 425,
      filterable: false,
      cell: (row) => {
        const pass = number(row.porcentaje_ok);
        const fail = number(row.porcentaje_ng);
        return (
          <PercentageBar
            label={
              "Pass " + formatPercent(pass) + ", Fail " + formatPercent(fail)
            }
            segments={[
              { value: pass, tone: "positive", label: formatPercent(pass) },
              { value: fail, tone: "negative" },
            ]}
            sideLabel={formatPercent(fail)}
          />
        );
      },
    });
  if (kind !== "vision")
    columns.push({
      id: "detail",
      header: "Detalle",
      width: 75,
      filterable: false,
      cell: (row) => (
        <Button
          size="sm"
          aria-label={
            "Ver detalle " +
            [
              row.numero_parte,
              row.fecha,
              row.linea,
              row.ict ?? row.estacion,
              row.turno,
            ]
              .map(text)
              .join(" · ")
          }
          onClick={() => onDetail(row)}
        >
          Ver
        </Button>
      ),
    });
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  return columns.map((column) => ({
    ...column,
    width: (100 * column.width) / totalWidth + "%",
  }));
}
