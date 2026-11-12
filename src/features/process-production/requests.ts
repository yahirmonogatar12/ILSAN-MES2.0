import {
  isRecord,
  positiveIntegerList,
  requiredText,
} from "@/shared/lib/parse";
import type { ExtraPayloads, Row } from "./types";
export type AssyMutation =
  | "assign-scan"
  | "create-scan"
  | "import-wos"
  | "apply-diff"
  | "import-proposal";
export const assyPayloads: {
  [A in AssyMutation]: (value: Row) => ExtraPayloads[A];
} = {
  "assign-scan": (value) => ({
    ...value,
    linea: requiredText(value.linea, "linea"),
    nparte: requiredText(value.nparte, "nparte"),
    target_lot_no: requiredText(value.target_lot_no, "target_lot_no"),
    allow_extend: value.allow_extend === true,
  }),
  "create-scan": (value) => ({
    ...value,
    linea: requiredText(value.linea, "linea"),
    nparte: requiredText(value.nparte, "nparte"),
    working_date: requiredText(value.working_date, "working_date"),
  }),
  "import-wos": (value) => {
    return {
      ...value,
      wo_ids: positiveIntegerList(
        value.wo_ids,
        "La selección de WO no es válida.",
      ),
      import_date: requiredText(value.import_date, "import_date"),
    };
  },
  "apply-diff": (value) => {
    if (!Array.isArray(value.cambios))
      throw new Error("La propuesta no contiene cambios.");
    return {
      ...value,
      proposal_id: requiredText(value.proposal_id, "proposal_id"),
      cambios: value.cambios.map((item: unknown) => {
        if (!isRecord(item))
          throw new Error("La propuesta contiene un cambio inválido.");
        return { ...item, lot_no: requiredText(item.lot_no, "lot_no") };
      }),
    };
  },
  "import-proposal": (value) => ({
    ...value,
    proposal_id: requiredText(value.proposal_id, "proposal_id"),
  }),
};
