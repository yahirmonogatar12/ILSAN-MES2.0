import { afterEach, describe, expect, it, vi } from "vitest";
import {
  auditDefaults,
  auditFilterIssue,
} from "@/features/administration/auditModel";
import * as invoices from "@/features/invoicing/model";
import * as areas from "@/features/material-areas/model";
import { todayIso } from "@/features/material-ledger/config";
import { validateDates } from "@/features/material-ledger/model";
import * as process from "@/features/process-production/model";
import * as tracking from "@/features/product-tracking/model";
import * as planning from "@/features/production-planning/model";
import * as results from "@/features/production-results/model";
import * as quality from "@/features/quality-control/model";
import {
  operationalDate,
  oqcDefaults,
  oqcParams,
} from "@/features/quality-control/reportModel";
import * as rework from "@/features/rework/model";
import * as scrap from "@/features/scrap-control/model";
import * as shipping from "@/features/shipping-warehouse/model";

afterEach(() => vi.useRealTimers());

describe("contratos de módulos al compartir utilidades", () => {
  it("mantiene el día de planta en los módulos y sus exportaciones públicas", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T05:59:59Z"));
    for (const getDate of [
      planning.today,
      process.today,
      tracking.today,
      results.today,
      quality.today,
      rework.mexicoDate,
      shipping.today,
      areas.todayMexico,
    ])
      expect(getDate()).toBe("2026-11-11");
    expect(scrap.defaultFilters()).toEqual({
      start: "2026-11-11",
      end: "2026-11-11",
      area: "",
    });
  });

  it("mantiene el calendario del operador en facturas, movimientos y auditoría", () => {
    vi.useFakeTimers();
    const instant = new Date("2026-11-12T05:59:59Z");
    vi.setSystemTime(instant);
    const local = [
      instant.getFullYear(),
      String(instant.getMonth() + 1).padStart(2, "0"),
      String(instant.getDate()).padStart(2, "0"),
    ].join("-");
    expect(invoices.localToday()).toBe(local);
    expect(todayIso()).toBe(local);
    expect(todayIso(new Date(2026, 0, 2))).toBe("2026-01-02");
    expect(auditDefaults()).toMatchObject({
      fecha_inicio: local,
      fecha_fin: local,
    });
  });

  it("respeta el corte de las 07:30 en el día operativo LQC", () => {
    expect(operationalDate(new Date("2026-11-12T13:29:59Z"))).toBe(
      "2026-11-11",
    );
    expect(operationalDate(new Date("2026-11-12T13:30:00Z"))).toBe(
      "2026-11-12",
    );
  });

  it("preserva las fechas obligatorias y el máximo de 120 días de planificación", () => {
    expect(planning.rangeIssue("", "2026-11-12")).toBe(
      "Selecciona ambas fechas.",
    );
    expect(planning.rangeIssue("2026-02-30", "2026-11-12")).toBe(
      "Selecciona ambas fechas.",
    );
    expect(planning.rangeIssue("2026-01-01", "2026-05-01", 120)).toBe("");
    expect(planning.rangeIssue("2026-01-01", "2026-05-02", 120)).toBe(
      "El rango máximo es de 120 días.",
    );
    expect(process.rangeIssue({ start: "", end: "" })).toBe(
      "Selecciona ambas fechas.",
    );
    expect(quality.filterIssue({ fecha_desde: "", fecha_hasta: "" })).toBe(
      "Selecciona ambas fechas.",
    );
  });

  it("conserva los rangos opcionales y comprueba las fechas capturadas en OQC", () => {
    expect(oqcParams(oqcDefaults).toString()).toBe("");
    expect(
      oqcParams({ ...oqcDefaults, fecha_desde: "2026-11-12" }).get(
        "fecha_desde",
      ),
    ).toBe("2026-11-12");
    expect(() =>
      oqcParams({ ...oqcDefaults, fecha_desde: "2026-02-30" }),
    ).toThrow("Selecciona fechas válidas.");
    expect(validateDates("", "")).toBe("");
    expect(validateDates("", "", true)).toBe(
      "Captura ambas fechas para consultar el periodo.",
    );
    expect(
      shipping.rangeError({
        ...shipping.filtersFor("entries"),
        fecha_desde: "",
      }),
    ).toBe("");
    expect(tracking.validateTrace("materiales", {})).toBe("");
  });

  it("mantiene la búsqueda por código de retrabajo y los invoices pendientes", () => {
    const filters = {
      ...rework.defaultFilters(),
      desde: "inválida",
      hasta: "",
      codigo: " QR/01 ",
    };
    expect(rework.filterIssue(filters)).toBe("");
    expect(Object.fromEntries(rework.filterParams(filters))).toEqual({
      codigo: "QR/01",
    });
    expect(rework.filterIssue({ ...filters, codigo: "" })).toBe(
      "Captura fechas válidas.",
    );
    const pending = {
      ...invoices.invoiceDefaults(),
      estado: "PENDIENTES",
      fecha_inicio: "2026-11-12",
      fecha_fin: "2026-11-01",
    };
    expect(invoices.dateIssue(pending)).toBe("");
    expect(Object.fromEntries(invoices.listParams(pending))).toEqual({
      estado: "PENDIENTES",
    });
  });

  it("respeta el calendario positivo de los historiales por área e inventarios sin fechas", () => {
    const filters = {
      ...areas.defaults(),
      start: "0000-01-01",
      end: "0000-01-02",
    };
    expect(areas.dateIssue({ ...filters, consulta: "entradas" })).toBe(
      "Selecciona ambas fechas.",
    );
    expect(areas.dateIssue({ ...filters, consulta: "inventario" })).toBe("");
  });

  it("mantiene las validaciones de horas y duración mínima", () => {
    expect(results.filterIssue({ hora_desde: "25:00" })).toBe(
      "Las horas deben usar el formato HH:mm o HH:mm:ss.",
    );
    expect(
      results.filterIssue({ hora_desde: "18:30", hora_hasta: "08:00" }),
    ).toBe("La hora desde debe ser anterior o igual a la hora hasta.");
    expect(
      quality.filterIssue({
        fecha_desde: "2026-11-12",
        fecha_hasta: "2026-11-12",
        min_seg: "-1",
      }),
    ).toBe("La duración mínima debe ser un número mayor o igual a cero.");
  });

  it("entrega el mismo mensaje de rango en auditoría y los adaptadores opcionales", () => {
    const expected = "La fecha inicial no puede ser posterior a la final.";
    expect(
      auditFilterIssue({
        ...auditDefaults(),
        fecha_inicio: "2026-11-12",
        fecha_fin: "2026-11-01",
      }),
    ).toBe(expected);
    expect(
      tracking.validateTrace("materiales", {
        fecha_inicio: "2026-11-12",
        fecha_fin: "2026-11-01",
      }),
    ).toBe(expected);
    expect(
      shipping.rangeError({
        ...shipping.filtersFor("entries"),
        fecha_desde: "2026-11-12",
        fecha_hasta: "2026-11-01",
      }),
    ).toBe(expected);
    expect(validateDates("2026-11-12", "2026-11-01")).toBe(expected);
  });

  it("mantiene los errores y las conversiones propios de cada dominio", () => {
    const serverError = { status: "error", message: "Fallo del equipo" };
    expect(quality.object(serverError)).toBe(serverError);
    expect(tracking.record(serverError)).toBe(serverError);
    expect(() => results.object(serverError)).toThrow("Fallo del equipo");
    expect(() => results.object({ status: "error" })).toThrow(
      "No se pudo consultar el reporte.",
    );
    expect(() => process.record([])).toThrow(
      "El servidor devolvió una respuesta inválida.",
    );
    expect(quality.number("no numérico")).toBe(0);
    expect(tracking.numeric("no numérico")).toBe(0);
    expect(Number.isNaN(invoices.amount("no numérico"))).toBe(true);
    expect(planning.cellInteger("1,000")).toBe(1000);
    expect(quality.text({ cantidad: 0 })).toBe("[object Object]");
    expect(planning.text({ cantidad: 0 })).toBe('{"cantidad":0}');
  });
});
