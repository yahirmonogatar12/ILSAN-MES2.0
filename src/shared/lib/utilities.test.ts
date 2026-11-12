import { describe, expect, it } from "vitest";
import { localDate, rangeIssue, today, validDate } from "./date";
import {
  isRecord,
  number,
  record,
  isNumericValue,
  isNullableText,
  positiveIntegerList,
  requiredNumber,
  requiredText,
} from "./parse";
import { containsText, jsonText, normalizeSearch, text } from "./text";

describe("calendario compartido", () => {
  it("cambia de día en la medianoche de la planta", () => {
    expect(today(new Date("2026-11-12T05:59:59Z"))).toBe("2026-11-11");
    expect(today(new Date("2026-11-12T06:00:00Z"))).toBe("2026-11-12");
  });

  it("representa el calendario local del operador", () => {
    expect(localDate(new Date(2026, 10, 12, 0, 5))).toBe("2026-11-12");
  });

  it("comprueba el calendario completo y el formato de los controles", () => {
    for (const value of ["2024-02-29", "2026-11-12", "0000-01-01"])
      expect(validDate(value), value).toBe(true);
    for (const value of [
      "",
      "2026-02-29",
      "2026-02-31",
      "2026-13-01",
      "2026-00-01",
      "2026-1-01",
      " 2026-11-12",
      "2026-11-12T00:00:00Z",
    ])
      expect(validDate(value), value).toBe(false);
  });

  it("permite límites opcionales e iguales y unifica el error de orden", () => {
    expect(rangeIssue()).toBe("");
    expect(rangeIssue("2026-11-12")).toBe("");
    expect(rangeIssue("", "2026-11-12")).toBe("");
    expect(rangeIssue("2026-11-12", "2026-11-12")).toBe("");
    expect(rangeIssue("2026-11-12", "2026-11-11")).toBe(
      "La fecha inicial no puede ser posterior a la final.",
    );
  });

  it("acepta el máximo de días transcurridos y conserva límites opcionales", () => {
    expect(rangeIssue("2026-01-01", "2026-05-01", 120)).toBe("");
    expect(rangeIssue("2026-01-01", "2026-05-02", 120)).toBe(
      "El rango máximo es de 120 días.",
    );
    expect(rangeIssue("2026-01-01", "2026-05-02", 0)).toBe("");
    expect(rangeIssue("", "2026-05-02", 120)).toBe("");
  });
});

describe("conversiones compartidas", () => {
  it("comprueba valores y capturas sin convertir objetos o booleanos en cantidades", () => {
    expect([null, "0", "0007", 0].every(isNumericValue)).toBe(true);
    expect([false, {}, Infinity].some(isNumericValue)).toBe(false);
    expect(isNullableText(null)).toBe(true);
    expect(isNullableText(0)).toBe(false);
    expect(requiredNumber("0", "cantidad")).toBe(0);
    expect(() => requiredNumber(null, "cantidad")).toThrow("cantidad");
    expect(() => requiredNumber(false, "cantidad")).toThrow("cantidad");
    expect(requiredText(" A-01/A ", "parte")).toBe("A-01/A");
    expect(() => requiredText({}, "parte")).toThrow("parte");
    expect(positiveIntegerList([1, 9], "IDs inválidos")).toEqual([1, 9]);
    expect(() => positiveIntegerList(["1"], "IDs inválidos")).toThrow(
      "IDs inválidos",
    );
  });
  it("convierte cantidades finitas con las reglas de Number", () => {
    expect([0, "0", " 12.5 ", null, true, false, 7n].map(number)).toEqual([
      0, 0, 12.5, 0, 1, 0, 7,
    ]);
    for (const value of [undefined, "1,000", "abc", NaN, Infinity, -Infinity])
      expect(number(value)).toBe(0);
    expect(() => number(Symbol("cantidad"))).toThrow(TypeError);
  });

  it("acepta los objetos admitidos por los adaptadores existentes", () => {
    for (const value of [{}, new Date(), new Map(), Object.create(null)]) {
      expect(isRecord(value)).toBe(true);
      expect(record(value)).toBe(value);
    }
    for (const value of [null, undefined, [], 0, "", true, () => ({})]) {
      expect(isRecord(value)).toBe(false);
      expect(() => record(value)).toThrow(
        "El servidor devolvió un registro inválido.",
      );
    }
  });

  it("conserva las variantes de texto plano y JSON", () => {
    for (const convert of [text, jsonText]) {
      expect(convert(null)).toBe("");
      expect(convert(undefined)).toBe("");
      expect(convert(0)).toBe("0");
      expect(convert(false)).toBe("false");
    }
    expect(text({ cantidad: 0 })).toBe("[object Object]");
    expect(jsonText({ cantidad: 0 })).toBe('{"cantidad":0}');
    expect(text([1, 2])).toBe("1,2");
    expect(jsonText([1, 2])).toBe("[1,2]");
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => jsonText(circular)).toThrow(TypeError);
  });

  it("conserva acentos, espacios y locale en las búsquedas de demostración", () => {
    expect(containsText("México", "MÉX", "es")).toBe(true);
    expect(containsText("México", "mex", "es")).toBe(false);
    expect(containsText("pieza", " pieza ")).toBe(false);
    expect(containsText("I", "ı", "tr")).toBe(true);
    expect(containsText("I", "ı", "es")).toBe(false);
    expect(containsText(0, "0")).toBe(true);
    expect(containsText(false, "false")).toBe(true);
    expect(containsText(jsonText({ parte: "EBR" }), '"parte"')).toBe(true);
    expect(normalizeSearch("MÉXICO")).toBe("mexico");
  });
});
