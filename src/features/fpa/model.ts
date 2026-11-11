import type {
  Adjustment,
  FpaDetail,
  RequestDraft,
  RequestPayload,
} from "./types";
export const quantityValid = (value: string | number) =>
  String(value).trim() !== "" &&
  Number.isInteger(Number(value)) &&
  Number(value) >= 0 &&
  Number(value) <= 999;
export function validateRequest(values: RequestDraft) {
  const errors: string[] = [];
  if (!values.fpaPartNumber.trim())
    errors.push("Captura el número de parte FPA.");
  if (values.fpaPartNumber.trim().length > 80)
    errors.push("El número de parte FPA admite hasta 80 caracteres.");
  for (const [name, amount, code] of [
    ["MICOM", values.micomQuantity, values.pgmMicom],
    ["COMP", values.compQuantity, values.pgmComp],
  ]) {
    if (!quantityValid(amount))
      errors.push(`Cantidad ${name}: debe ser un entero entre 0 y 999.`);
    if (Number(amount) > 0) {
      const normalized = code.trim().replace(/\s+/g, " ");
      const separator = normalized.indexOf(" ");
      if (separator <= 0 || separator === normalized.length - 1)
        errors.push(
          `PGM ${name}: incluye número de parte y lote/checksum separados por un espacio.`,
        );
      else if (
        normalized.slice(0, separator).length > 24 ||
        normalized.slice(separator + 1).length > 24
      )
        errors.push(`PGM ${name}: cada renglón admite hasta 24 caracteres.`);
    }
  }
  if (Number(values.micomQuantity) <= 0 && Number(values.compQuantity) <= 0)
    errors.push("Solicita al menos una etiqueta MICOM o COMP.");
  return errors;
}
export function requestPayload(values: RequestDraft): RequestPayload {
  return {
    fpaPartNumber: values.fpaPartNumber.trim(),
    pgmMicom: values.pgmMicom.trim(),
    micomQuantity: Number(values.micomQuantity),
    pgmComp: values.pgmComp.trim(),
    compQuantity: Number(values.compQuantity),
  };
}
export function adjustmentPayload(
  values: { reason: string; MICOM: string; COMP: string },
  record: FpaDetail,
): Adjustment {
  return {
    reason: values.reason.trim(),
    ...Object.fromEntries(
      record.items.map((item) => [
        item.labelType === "MICOM" ? "micomQuantity" : "compQuantity",
        Number(values[item.labelType]),
      ]),
    ),
  };
}
