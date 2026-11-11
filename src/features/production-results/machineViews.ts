import { number, rows, text, today } from "./model";
import { col, field, inputHistory, select, view } from "./views";
import type { ColumnSpec, Filters, Row, ViewSpec } from "./types";

export type MachineKind =
  "operators" | "ict" | "fct" | "vision" | "electrical" | "changes";
export type TestKind = "ict" | "fct" | "vision";
const dates = [
  field("fecha_desde", "Fecha desde", "date"),
  field("fecha_hasta", "Fecha hasta", "date"),
];
function dated(spec: ViewSpec): ViewSpec {
  return {
    ...spec,
    defaults: { ...spec.defaults, fecha_desde: today(), fecha_hasta: today() },
  };
}
const noSearch = (column: ColumnSpec): ColumnSpec => ({
  ...column,
  filterable: false,
});
export const parameterColumns = [
  col("componente", "Componente", 125),
  col("pinref", "Pinref", 80),
  ...[
    ["act_value", "ACT"],
    ["act_unit", "Unidad ACT"],
    ["std_value", "STD"],
    ["std_unit", "Unidad STD"],
    ["meas_value", "MEAS"],
    ["m_value", "M"],
    ["r_value", "R"],
    ["hlim_pct", "HLIM %"],
    ["llim_pct", "LLIM %"],
    ["hp_value", "HP"],
    ["lp_value", "LP"],
    ["ws_value", "WS"],
    ["ds_value", "DS"],
    ["rc_value", "RC"],
    ["p_flag", "P"],
    ["j_flag", "J"],
    ["resultado_local", "Resultado"],
    ["defecto_tipo", "Tipo defecto"],
  ].map(([key, title]) => col(key, title, 70)),
];
export const compareFields = parameterColumns.filter(
  (column) =>
    ![
      "componente",
      "pinref",
      "meas_value",
      "resultado_local",
      "defecto_tipo",
    ].includes(column.key),
);
export const stepColumns = [
  col("idx", "#", 45, true),
  col("step", "Paso", 70),
  col("tested_at", "Fecha / hora", 140),
  col("test_name", "Prueba", 200),
  col("measured_value", "Valor", 95),
  col("unit", "Unidad", 70),
  col("nominal", "Nominal", 95),
  col("upper_limit", "LS", 85),
  col("lower_limit", "LI", 85),
  col("row_result", "Resultado", 90),
];
export function machineView(kind: MachineKind): ViewSpec {
  if (kind === "electrical") {
    const base = inputHistory("smt");
    return {
      ...base,
      id: "machine-electrical",
      title: "Historial de prueba eléctrica",
      path: "/api/control_resultados/historial_prueba_electrica",
      exportPath: "/api/control_resultados/historial_prueba_electrica/export",
      columns: [
        ...base.columns,
        col("resultado", "Resultado", 85),
        col("operador", "Operador", 170),
      ],
      minWidth: 1000,
    };
  }
  if (kind === "operators")
    return dated(
      view(
        "machine-operators",
        "Historial de Operadores por Máquina",
        "/api/control_resultados/historial_operadores_maquina",
        [
          col("linea", "Línea", 75),
          col("estacion", "Estación", 100),
          col("nombre_estacion", "Nombre", 140),
          col("tipo", "Tipo", 75),
          col("usuario", "Usuario", 140),
          col("username", "Badge", 95),
          col("fecha", "Fecha", 105),
          col("hora_entrada", "Entrada", 85),
          col("hora_salida", "Salida", 85),
          col("duracion", "Duración", 95),
          col("estado", "Estado", 105),
        ],
        [
          ...dates,
          field("q", "Estación, línea o usuario", "search"),
          select("tipo", "Tipo", ["ICT", "FCT", "Packing"]),
          select("estado", "Estado", [
            "Open",
            "Closed",
            "AutoClosed",
            "Ajuste",
          ]),
        ],
        {
          responseKey: "records",
          exportPath:
            "/api/control_resultados/historial_operadores_maquina/export",
          limit: 1000,
          minWidth: 1040,
        },
      ),
    );
  if (kind === "changes") {
    const spec = dated(
      view(
        "machine-changes",
        "Historial de cambios de parámetros ICT",
        "/api/ict/param-changes",
        [
          col("jornada", "Jornada", 100),
          col("hora_anterior", "Hora anterior", 85),
          col("hora_cambio", "Hora del cambio", 90),
          col("operador", "Técnico", 140),
          col("ict", "ICT / Línea", 95),
          col("no_parte", "No. parte", 130),
          col("componente", "Componente", 130),
          col("parametro", "Parámetro", 110),
          col("valor_anterior", "Valor anterior", 105),
          col("valor_nuevo", "Valor nuevo", 105),
        ],
        [
          ...dates,
          { ...field("hora_desde", "Hora desde"), placeholder: "HH:mm" },
          { ...field("hora_hasta", "Hora hasta"), placeholder: "HH:mm" },
          {
            ...select("ict", "ICT", [
              "ALL",
              ...["M1", "M2", "M3", "M4"].flatMap((line) => [
                "ICT1 " + line,
                "ICT2 " + line,
              ]),
            ]),
            options: [
              { value: "", label: "Seleccione…" },
              { value: "ALL", label: "Todas" },
              ...["M1", "M2", "M3", "M4"].flatMap((line) =>
                [1, 2].map((n) => ({
                  value: "ICT" + n + " " + line,
                  label: "ICT" + n + " " + line,
                })),
              ),
            ],
          },
          field("no_parte", "No. parte", "search"),
          field("componente", "Componente"),
          field("parametro", "Parámetro"),
        ],
        {
          responseKey: "rows",
          exportPath: "/api/ict/param-changes/export",
          manual: true,
          progressPath: "/api/ict/param-changes/progress",
          limit: 1000,
          params: (filters): Filters =>
            filters.ict === "ALL" ? { ict_all: "1" } : {},
          validate: (filters) =>
            !filters.fecha_desde
              ? "Selecciona la fecha desde para consultar."
              : filters.ict
                ? ""
                : "Selecciona una ICT para consultar.",
          minWidth: 1050,
        },
      ),
    );
    return spec;
  }
  if (kind === "vision")
    return dated(
      view(
        "machine-vision",
        "Historial de máquina Visión",
        "/api/vision/data",
        [
          col("linea", "Línea", 85),
          col("fecha", "Fecha", 105),
          col("hora", "Hora", 85),
          col("numero_parte", "No. parte", 140),
          col("qr", "QR", 210),
          col("barcode", "Barcode", 170),
          col("resultado", "Resultado", 80),
          col("tipo", "Tipo", 115),
          col("componente", "Componente", 100),
          col("tipo_falla", "Tipo de falla", 150),
        ],
        [
          ...dates,
          field("linea", "Línea"),
          select("resultado", "Resultado", ["OK", "NG"]),
          field("numero_parte", "No. parte", "search"),
          field("qr", "QR"),
          field("barcode", "Barcode"),
        ],
        {
          remote: true,
          exportPage: false,
          exportPath: "/api/vision/export",
          minWidth: 1250,
          mapRows: (items) =>
            items.map((row) => {
              const defects = rows(row.fallas ?? []);
              return {
                ...row,
                ...Object.fromEntries(
                  ["tipo", "componente", "tipo_falla"].map((key) => [
                    key,
                    [
                      ...new Set(
                        defects
                          .map((defect) => text(defect[key]))
                          .filter(Boolean),
                      ),
                    ].join(" · "),
                  ]),
                ),
              };
            }),
        },
      ),
    );
  const ict = kind === "ict";
  return dated(
    view(
      "machine-" + kind,
      "Historial de máquina " + kind.toUpperCase(),
      "/api/" + kind + "/data",
      [
        col("fecha", "Fecha", 105),
        col("hora", "Hora", 85),
        col("linea", "Línea", 75),
        col(ict ? "ict" : "estacion", ict ? "ICT" : "Estación", 80),
        col("resultado", "Resultado", 85),
        noSearch(col("operador", "Operador", 150)),
        col("no_parte", "No. parte", 130),
        col(ict ? "barcode" : "serial_number", ict ? "Barcode" : "Serial", 200),
        col("fuente_archivo", "Fuente", 180),
        ...(ict
          ? [
              col("defect_code", "Defecto", 110),
              col("defect_valor", "Valor", 95),
            ]
          : [
              col("failed_step", "Paso fallo", 80),
              col("failed_test_name", "Prueba fallo", 140),
              noSearch(col("failed_measured_value", "Valor", 90)),
            ]),
      ],
      [
        ...dates,
        field("no_parte", "No. parte", "search"),
        field("linea", "Línea"),
        ict ? select("ict", "ICT", ["1", "2"]) : field("estacion", "Estación"),
        select(
          "resultado",
          "Resultado",
          ict ? ["OK", "NG"] : ["PASS", "FAIL", "UNKNOWN"],
        ),
        {
          ...field(
            ict ? "barcode_like" : "serial_like",
            ict ? "Barcode" : "Serial",
          ),
          placeholder: "Mínimo 6 caracteres",
        },
      ],
      {
        remote: true,
        exportPage: false,
        exportPath: "/api/" + kind + "/export",
        exportLimit: ict ? 500 : 50000,
        minWidth: 1200,
      },
    ),
  );
}
export function visionStops(): ViewSpec {
  return dated(
    view(
      "machine-vision-stops",
      "Paros de Visión",
      "/api/vision/stops",
      [
        col("linea", "Línea", 85),
        col("numero_parte", "No. parte", 130),
        col("sequence_error_datetime", "Error de secuencia", 155),
        col("stop_datetime", "Inicio de paro", 155),
        col("stable_run_datetime", "Recuperación", 155),
        {
          ...col("paro_real", "Paro real (s)", 95, true),
          searchLabel: "Duración HH:mm:ss",
          searchValue: (row) => {
            const seconds = Math.max(0, Math.floor(number(row.paro_real)));
            return [
              Math.floor(seconds / 3600),
              Math.floor((seconds % 3600) / 60),
              seconds % 60,
            ]
              .map((value) => String(value).padStart(2, "0"))
              .join(":");
          },
        },
        col("run_attempt_count", "Intentos", 80, true),
        noSearch(col("recovery_status", "Estado", 110)),
        {
          ...col("tecnico_ajuste", "Técnico / ajustes", 180),
          searchValue: (row) => text(rows(row.ajustes ?? [])[0]?.tecnico),
        },
      ],
      [
        ...dates,
        field("linea", "Línea"),
        select("estado", "Estado", ["open", "confirmed", "failed_recovery"]),
      ],
      {
        remote: true,
        exportPage: false,
        exportPath: "/api/vision/stops/export",
        minWidth: 1100,
        mapRows: (items) =>
          items.map((row) => ({
            ...row,
            paro_real: row.real_stop_seconds ?? row.real_stop_prov,
            tecnico_ajuste: rows(row.ajustes ?? [])
              .map((item) =>
                [item.tecnico, item.inicio_local, item.fin_local]
                  .map(text)
                  .filter(Boolean)
                  .join(" · "),
              )
              .join(" · "),
          })),
      },
    ),
  );
}
export function passFailView(kind: TestKind, detailed = false): ViewSpec {
  const ict = kind === "ict",
    vision = kind === "vision";
  const columns = [
    ...(vision ? [] : [col("fecha", "Fecha", 105)]),
    col("linea", "Línea", 80),
    ...(vision
      ? []
      : [
          col(ict ? "ict" : "estacion", ict ? "ICT" : "Estación", 80),
          col("turno", "Turno", 90),
        ]),
    col("numero_parte", "No. parte", 150),
    ...(vision
      ? []
      : [col(ict ? "operadores" : "operador", "Operador(es)", 150)]),
    ...(ict ? [col("ajuste_total", "Tiempo ajuste", 90)] : []),
    ...(ict && detailed
      ? [
          col("total", "Total real", 85, true),
          col("ok_real", "OK real", 80, true),
          col("defectos_detectados", "Detectados", 85, true),
          col("falsos_negativos", "F. negativos", 85, true),
          col("falsos_fail", "F. fail", 80, true),
          col("porcentaje_ok", "% Correcto", 90, true),
          col("porcentaje_deteccion", "% detección", 90, true),
          col("porcentaje_falso_negativo", "% F. negativo", 90, true),
          col("porcentaje_falso_fail", "% F. fail", 90, true),
        ]
      : [
          col("total", "Total", 85, true),
          col(
            kind === "fct" ? "pass_count" : "ok_count",
            "OK / PASS",
            85,
            true,
          ),
          col(
            kind === "fct" ? "fail_count" : "ng_count",
            "NG / FAIL",
            85,
            true,
          ),
          col(
            kind === "fct" ? "pass_pct" : "porcentaje_ok",
            "% Pass",
            85,
            true,
          ),
          col(
            kind === "fct" ? "fail_pct" : "porcentaje_ng",
            "% Fail",
            85,
            true,
          ),
        ]),
    ...(kind === "fct"
      ? [
          col("fallas_con_paso", "Fallas con paso", 95, true),
          col("unknown_count", "Desconocidos", 90, true),
        ]
      : []),
  ];
  return dated(
    view(
      "machine-" + kind + "-pass",
      "Historial de máquina " +
        (vision ? "Visión" : kind.toUpperCase()) +
        " % Pass/Fail",
      "/api/" + kind + (vision ? "/pass-fail-summary" : "/pass-fail"),
      columns,
      [
        ...dates,
        field("numero_parte", "No. parte", "search"),
        ...(vision
          ? []
          : [
              select(
                "turno",
                "Turno",
                ict
                  ? ["DIA", "TIEMPO EXTRA", "NOCHE"]
                  : ["DIA", "TE", "NOCHE", "SIN TURNO"],
              ),
              field(ict ? "barcode" : "serial", ict ? "Barcode" : "Serial"),
            ]),
      ],
      {
        exportPath:
          "/api/" +
          kind +
          (vision ? "/pass-fail-summary/export" : "/pass-fail/export"),
        params: ict ? { modo: detailed ? "detallado" : "normal" } : undefined,
        minWidth: detailed ? 1520 : vision ? 760 : 1160,
        mapRows:
          ict && !detailed
            ? (items) =>
                items.map((row) => {
                  const total = number(row.total_intentos ?? row.total),
                    ok = number(row.ok_count_raw ?? row.ok_count),
                    ng = number(row.ng_count_raw ?? row.ng_count);
                  return {
                    ...row,
                    total,
                    ok_count: ok,
                    ng_count: ng,
                    porcentaje_ok: total
                      ? Math.round((10000 * ok) / total) / 100
                      : 0,
                    porcentaje_ng: total
                      ? Math.round((10000 * ng) / total) / 100
                      : 0,
                  };
                })
            : undefined,
      },
    ),
  );
}
export function testDetail(kind: "ict" | "fct", row: Row): ViewSpec {
  if (kind === "ict")
    return view(
      "machine-ict-parameters",
      "Parámetros ICT · " + text(row.barcode),
      "/api/ict/defects",
      parameterColumns,
      [select("resultado", "Resultado", ["OK", "NG"])],
      {
        params: { barcode: text(row.barcode), ts: text(row.ts) },
        minWidth: 1510,
        mapRows: (items, filters) =>
          items.filter(
            (item) =>
              !filters.resultado || item.resultado_local === filters.resultado,
          ),
        exportPath: "/api/ict/export-defects",
      },
    );
  return view(
    "machine-fct-steps",
    "Pasos FCT · " + text(row.serial_number),
    "/api/fct/steps",
    stepColumns,
    [
      {
        ...select("only_fail", "Resultado", ["1"]),
        options: [
          { value: "", label: "Todos" },
          { value: "1", label: "Solo FAIL" },
        ],
      },
    ],
    {
      params: { source_path_hash: text(row.source_path_hash) },
      minWidth: 1010,
    },
  );
}
export function passDetail(
  kind: "ict" | "fct",
  row: Row,
  detailed = false,
): ViewSpec {
  const columns =
    kind === "ict"
      ? [
          col("barcode", "Barcode", 200),
          col("primer_test", "Primer test", 155),
          col("ultimo_test", "Último test", 155),
          col("intentos", "Intentos", 80, true),
          col("ok_count", "OK", 70, true),
          col("ng_count", "NG", 70, true),
          ...(detailed
            ? [
                col("ok_real", "OK real", 80, true),
                col("defectos_detectados", "Detectados", 90, true),
                col("falsos_negativos", "F. negativos", 90, true),
                col("falsos_fail", "F. fail", 80, true),
                col("criterio_real", "Clase", 110),
              ]
            : []),
          col("resultado_primer", "Primero", 90),
          col("resultado_final", "Final", 90),
          col("defectos", "Defecto / Ubicación", 180),
        ]
      : [
          col("start_at", "Inicio", 155),
          col("serial_number", "Serial", 200),
          col("resultado", "Resultado", 85),
          col("failed_step", "Paso fallo", 85),
          col("failed_test_name", "Prueba fallo", 155),
          col("failed_measured_value", "Valor", 90),
          col("fuente_archivo", "Fuente", 200),
        ];
  const params: Filters =
    kind === "ict"
      ? {
          fecha: text(row.fecha),
          linea: text(row.linea),
          ict: text(row.ict),
          turno: text(row.turno),
          numero_parte: text(row.numero_parte),
        }
      : {
          fecha_desde: text(row.fecha),
          fecha_hasta: text(row.fecha),
          fecha_jornada: text(row.fecha),
          grupo_linea: text(row.linea),
          grupo_estacion: text(row.estacion),
          grupo_turno: text(row.turno),
          grupo_numero_parte: text(row.numero_parte),
        };
  return view(
    "machine-" + kind + "-pass-detail",
    "Detalle " + kind.toUpperCase() + " · " + text(row.numero_parte),
    "/api/" + kind + "/pass-fail/detail",
    columns,
    kind === "ict"
      ? [
          field("barcode", "Barcode"),
          select("min_intentos", "Intentos mínimos", ["1", "2", "3"]),
        ]
      : [],
    {
      params,
      minWidth: detailed ? 1500 : 1100,
      responseKey: kind === "ict" ? "rows" : undefined,
    },
  );
}
export function comparisonRows(
  runs: readonly { record: Row; parameters: Row[] }[],
  onlyDiffs: boolean,
): Row[] {
  const groups = new Map<
    string,
    { component: unknown; pinref: unknown; values: Map<number, Row> }
  >();
  runs.forEach((run, index) =>
    run.parameters.forEach((parameter) => {
      const key = JSON.stringify([parameter.componente, parameter.pinref]);
      const group = groups.get(key) ?? {
        component: parameter.componente,
        pinref: parameter.pinref,
        values: new Map<number, Row>(),
      };
      group.values.set(index, parameter);
      groups.set(key, group);
    }),
  );
  return [...groups.values()].flatMap((group) => {
    const changedFields = compareFields
      .filter((field) => {
        const values = runs.map((_, index) =>
          text(group.values.get(index)?.[field.key]).trim(),
        );
        return new Set(values).size > 1;
      })
      .map((field) => field.key);
    const differs =
      group.values.size !== runs.length || changedFields.length > 0;
    if (onlyDiffs && !differs) return [];
    return runs.map((run, index) => ({
      ...group.values.get(index),
      componente: group.component,
      pinref: group.pinref,
      execution: text(run.record.barcode) + " · " + text(run.record.ts),
      different: differs,
      changedFields,
      missing: !group.values.has(index),
    }));
  });
}
export function consolidatedRows(items: Row[]): Row[] {
  const grouped = new Map<string, Row & { days: Set<string> }>();
  for (const item of items) {
    const key = JSON.stringify([item.numero_parte, item.ict]);
    const row = grouped.get(key) ?? {
      numero_parte: item.numero_parte,
      ict: item.ict,
      days: new Set<string>(),
      total: 0,
      ok: 0,
      ng: 0,
    };
    row.days.add(text(item.fecha));
    row.total = number(row.total) + number(item.total_intentos);
    row.ok = number(row.ok) + number(item.ok_count_raw);
    row.ng = number(row.ng) + number(item.ng_count_raw);
    grouped.set(key, row);
  }
  return [...grouped.values()].map((row) => ({
    ...row,
    dias: row.days.size,
    pass_pct: number(row.total)
      ? Math.round((10000 * number(row.ok)) / number(row.total)) / 100
      : 0,
    fail_pct: number(row.total)
      ? Math.round((10000 * number(row.ng)) / number(row.total)) / 100
      : 0,
  }));
}
