import { useEffect, useId, useMemo, useState } from "react";
import {
  spreadsheetEngine,
  validateSpreadsheetSize,
  type Workbook,
} from "../lib/spreadsheet";
import { Alert, Loading } from "./Feedback";
import { SelectField } from "./Fields";
import { WorksheetTable } from "./table/DataTable";
import { worksheetView } from "../lib/worksheet";
import { Button } from "./Button";
import { TabBar } from "./TabBar";
import { tabIds } from "./tabs";
import "./preview.css";

/** Cell text only: never render workbook HTML, scripts or hyperlinks. */
export function SpreadsheetPreview({
  blob,
  name,
}: {
  blob: Blob;
  name: string;
}) {
  const tabsId = useId();
  const [book, setBook] = useState<Workbook | null>(null);
  const [sheet, setSheet] = useState("");
  const [visibleRows, setVisibleRows] = useState(500);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let alive = true;
    setBook(null);
    setError(null);
    void (async () => {
      try {
        validateSpreadsheetSize(blob.size);
        const engine = await spreadsheetEngine();
        if (!alive) return;
        const buffer = await blob.arrayBuffer();
        if (!alive) return;
        validateSpreadsheetSize(buffer.byteLength);
        const result = engine.read(buffer, {
          type: "array",
          cellHTML: false,
          cellFormula: false,
          cellStyles: true,
        });
        if (!result.SheetNames.length)
          throw new Error("El archivo no contiene hojas para mostrar.");
        if (!alive) return;
        setBook(result);
        setSheet(
          result.SheetNames.find(
            (name) =>
              name.toUpperCase().replace(/\s/g, "") === "INVOICE(CONVERTED)",
          ) ||
            result.SheetNames[0] ||
            "",
        );
      } catch (failure) {
        if (alive)
          setError(
            failure instanceof Error
              ? failure
              : new Error("No se pudo leer el Excel."),
          );
      }
    })();
    return () => {
      alive = false;
    };
  }, [blob]);
  const data = useMemo(() => {
    if (!book || !sheet || !window.XLSX) return null;
    const source = book.Sheets[sheet];
    const range = window.XLSX.utils.decode_range(
      String(source?.["!ref"] || "A1"),
    );
    return worksheetView(source, range, visibleRows);
  }, [book, sheet, visibleRows]);
  function selectSheet(next: string) {
    setSheet(next);
    setVisibleRows(500);
  }
  return (
    <div className="spreadsheet-preview">
      {error ? (
        <Alert tone="danger">{error.message}</Alert>
      ) : !data ? (
        <Loading text="Leyendo Excel…" />
      ) : (
        <>
          {data.limited && (
            <Alert tone="info">
              Vista limitada a 100 columnas y 100,000 celdas. Descarga el
              archivo original para consultar todo su contenido.
            </Alert>
          )}
          <div
            className="spreadsheet-active-sheet"
            role="tabpanel"
            id={tabIds(tabsId, sheet).panel}
            aria-labelledby={tabIds(tabsId, sheet).tab}
          >
            <WorksheetTable label={`${name} · ${sheet}`} view={data} />
          </div>
          {data.rows.length < data.totalRows && !data.limited && (
            <Button
              size="sm"
              onClick={() => setVisibleRows((previous) => previous + 500)}
            >
              Mostrar 500 filas más ({data.rows.length} de {data.totalRows})
            </Button>
          )}
          {data.limited &&
            data.rows.length <
              Math.min(
                data.totalRows,
                10000,
                Math.floor(100000 / data.columns.length),
              ) && (
              <Button
                size="sm"
                onClick={() => setVisibleRows((previous) => previous + 500)}
              >
                Mostrar más filas
              </Button>
            )}
          <div className="spreadsheet-sheets">
            <TabBar
              id={tabsId}
              label="Hojas del Excel original"
              items={book!.SheetNames.map((name) => ({
                id: name,
                label: name,
              }))}
              activeId={sheet}
              onChange={selectSheet}
            />
            <SelectField
              label="Ir a hoja"
              value={sheet}
              options={book!.SheetNames.map((name) => ({
                value: name,
                label: name,
              }))}
              onChange={(event) => selectSheet(event.target.value)}
            />
          </div>
        </>
      )}
    </div>
  );
}
