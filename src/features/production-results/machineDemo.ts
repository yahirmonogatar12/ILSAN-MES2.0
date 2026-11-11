import { exportSpreadsheet } from "@/shared/lib/spreadsheet";
import {
  comparisonRows,
  consolidatedRows,
  machineView,
  parameterColumns,
  passFailView,
  type MachineKind,
  type TestKind,
  visionStops,
} from "./machineViews";
import { number, text, today } from "./model";
import type { Row, ViewSpec } from "./types";

const date = today();
const code = "0001/A+02&B";
function parameters(ts: string): Row[] {
  return [
    {
      componente: "R37",
      pinref: "P-01",
      act_value: ts.endsWith("01") ? "2.00" : "1.00",
      act_unit: "kΩ",
      std_value: "1.00",
      std_unit: "kΩ",
      meas_value: "1.01",
      m_value: "0",
      r_value: "0",
      hlim_pct: "10",
      llim_pct: "-10",
      hp_value: "0",
      lp_value: "0",
      ws_value: "0",
      ds_value: "0",
      rc_value: "0",
      p_flag: "P",
      j_flag: "J",
      resultado_local: ts.endsWith("01") ? "NG" : "OK",
      defecto_tipo: "RESISTANCE",
    },
    {
      componente: "C25",
      pinref: "P-02",
      act_value: "0.10",
      act_unit: "µF",
      std_value: "0.10",
      std_unit: "µF",
      resultado_local: "OK",
    },
  ];
}
function records(kind: MachineKind): Row[] {
  if (kind === "changes")
    return [
      {
        jornada: date,
        hora_anterior: "08:00:00",
        hora_cambio: "08:05:00",
        operador: "Técnico demo",
        ict: "ICT1 M1",
        ict_num: 1,
        linea: "M1",
        no_parte: code,
        std: code,
        componente: "R37 / P-01",
        componente_raw: "R37",
        pinref: "P-01",
        parametro: "HLIM %",
        field_key: "hlim_pct",
        valor_anterior: "10",
        valor_nuevo: "15",
        archivo_anterior: "TEST-0001.lgd",
        archivo_cambio: "TEST-0002.lgd",
        barcode_anterior: code,
        barcode_cambio: code,
      },
    ];
  return Array.from({ length: 640 }, (_, index) => ({
    id: index + 1,
    fecha: date,
    hora: "08:00:" + String(index % 60).padStart(2, "0"),
    ts: date + " 08:00:" + String(index % 60).padStart(2, "0"),
    linea: "M" + ((index % 4) + 1),
    ict: (index % 2) + 1,
    no_parte: code,
    numero_parte: code,
    barcode: index < 2 ? code : code + "-" + String(index).padStart(4, "0"),
    qr: code + "-QR-" + index,
    lote: "SMT-261111-001",
    resultado:
      kind === "fct"
        ? index % 3 === 0
          ? "FAIL"
          : "PASS"
        : index % 3 === 0
          ? "NG"
          : "OK",
    operador: "Operador demo (0001)",
    fuente_archivo: "TEST-0001." + (kind === "fct" ? "csv" : "lgd"),
    defect_code: "R37",
    defect_valor: "1.01",
    source_path_hash: "fct-" + index,
    estacion: "FCT-01",
    serial_number: code + "-SER-" + index,
    failed_step: "10",
    failed_test_name: "VCC",
    failed_measured_value: "4.92",
    start_at: date + " 08:00:00",
    end_at: date + " 08:00:20",
    duration_seconds: 20,
    row_count: 2,
    fallas:
      index % 3 === 0
        ? [
            {
              tipo: "PRESENCIA",
              componente: "R37",
              tipo_falla: "FALTANTE",
              valor: "0",
              unidad: "",
            },
          ]
        : [],
    session_id: "session-demo-" + index,
    nombre_estacion: "Estación ICT-01",
    tipo: "ICT",
    usuario: "Operador demo",
    username: "0001",
    hora_entrada: "07:30:00",
    hora_salida: index % 7 ? "08:00:00" : "",
    duracion: index % 7 ? "0:30:00" : "En curso",
    estado: index % 7 ? "Closed" : "Open",
    inicio_online: true,
    fin_online: index % 7 !== 0,
    inicio_local: date + " 07:30:00",
    fin_local: index % 7 ? date + " 08:00:00" : "",
  }));
}
function summaries(kind: TestKind): Row[] {
  return Array.from({ length: 8 }, (_, index) => ({
    fecha: date,
    linea: "M" + ((index % 4) + 1),
    ict: (index % 2) + 1,
    estacion: "FCT-" + ((index % 2) + 1),
    turno: "DIA",
    numero_parte: index % 2 ? code : "EBR24212304",
    operadores: "Operador demo",
    operador: "Operador demo",
    ajuste_total: "0:05:00",
    ajuste_detalle: "Técnico demo (0:05:00)",
    total: 100,
    ok_count: 94,
    ng_count: 6,
    total_real: 100,
    ok_real: 92,
    total_intentos: 105,
    ok_count_raw: 96,
    ng_count_raw: 9,
    defectos_detectados: 2,
    falsos_negativos: 1,
    falsos_fail: 3,
    porcentaje_ok: 94,
    porcentaje_ng: 6,
    porcentaje_deteccion: 66.67,
    porcentaje_falso_negativo: 33.33,
    porcentaje_falso_fail: 2.9,
    pass_count: 94,
    fail_count: 6,
    pass_pct: 94,
    fail_pct: 6,
    unknown_count: 0,
    unknown_pct: 0,
    fallas_con_paso: 6,
    piezas_unicas: 100,
    piezas_repetidas: 4,
    piezas_reparacion: 3,
    primer_test: date + " 07:30:00",
    ultimo_test: date + " 15:30:00",
    machine: kind,
  }));
}
function apply(items: Row[], params: URLSearchParams): Row[] {
  return items.filter((row) => {
    const values: Record<string, unknown> = {
      ...row,
      no_parte: row.no_parte ?? row.numero_parte,
      barcode_like: row.barcode,
      serial_like: row.serial_number,
      serial: row.serial_number,
      fecha_desde: row.fecha ?? row.jornada,
      fecha_hasta: row.fecha ?? row.jornada,
    };
    for (const key of [
      "q",
      "no_parte",
      "numero_parte",
      "linea",
      "ict",
      "estacion",
      "resultado",
      "barcode_like",
      "serial_like",
      "barcode",
      "serial",
      "qr",
      "lote",
      "tipo",
      "estado",
      "componente",
      "parametro",
    ]) {
      const criterion = params.get(key);
      if (
        !criterion ||
        criterion === "ALL" ||
        (key === "ict" && params.get("ict_all") === "1")
      )
        continue;
      if (key === "q") {
        if (
          !Object.values(row).some((value) =>
            text(value).toLowerCase().includes(criterion.toLowerCase()),
          )
        )
          return false;
      } else if (
        !text(values[key]).toLowerCase().includes(criterion.toLowerCase())
      )
        return false;
    }
    const rowDate = text(values.fecha_desde);
    if (
      params.get("fecha_desde") &&
      rowDate &&
      rowDate < params.get("fecha_desde")!
    )
      return false;
    if (
      params.get("fecha_hasta") &&
      rowDate &&
      rowDate > params.get("fecha_hasta")!
    )
      return false;
    for (const [key, value] of params) {
      if (
        key.startsWith("cf_") &&
        !text(row[key.slice(3)]).toLowerCase().includes(value.toLowerCase())
      )
        return false;
    }
    return true;
  });
}
function resolve(
  path: string,
  params: URLSearchParams,
): { spec: ViewSpec; items: Row[] } {
  const kinds: MachineKind[] = [
    "operators",
    "ict",
    "fct",
    "vision",
    "electrical",
    "changes",
  ];
  const kind = kinds.find((kind) => {
    const spec = machineView(kind);
    return spec.path === path || spec.exportPath === path;
  });
  if (kind) {
    const spec = machineView(kind);
    return { spec, items: apply(records(kind), params) };
  }
  const pass = (["ict", "fct", "vision"] as const).find((kind) => {
    const spec = passFailView(kind);
    return spec.path === path || spec.exportPath === path;
  });
  if (pass) {
    const spec = passFailView(pass, params.get("modo") === "detallado");
    return { spec, items: apply(summaries(pass), params) };
  }
  const spec = visionStops();
  return {
    spec,
    items: [
      {
        linea: "M1",
        numero_parte: code,
        sequence_error_datetime: date + " 08:00:00",
        stop_datetime: date + " 08:01:00",
        stable_run_datetime: date + " 08:05:00",
        real_stop_seconds: 300,
        real_stop_prov: null,
        run_attempt_count: 2,
        recovery_status: "confirmed",
        ajustes: [
          {
            tecnico: "Técnico demo",
            inicio_local: date + " 08:01:00",
            fin_local: date + " 08:02:00",
          },
        ],
      },
    ],
  };
}
export async function machineRequest(path: string): Promise<unknown> {
  const url = new URL(path, "http://demo"),
    params = url.searchParams,
    endpoint = url.pathname;
  if (endpoint === "/api/ict/param-changes/progress")
    return { done: 2, total: 2, phase: "completado" };
  if (endpoint === "/api/ict/defects")
    return parameters(params.get("ts") ?? "");
  if (endpoint === "/api/fct/steps")
    return [
      {
        idx: 1,
        step: "10",
        tested_at: date + " 08:00:00",
        test_name: "VCC",
        measured_value: "4.92",
        unit: "V",
        nominal: "5",
        upper_limit: "5.1",
        lower_limit: "4.9",
        row_result: "FAIL",
      },
      ...(params.get("only_fail")
        ? []
        : [
            {
              idx: 2,
              step: "20",
              tested_at: date + " 08:00:02",
              test_name: "CURRENT",
              measured_value: "0.5",
              unit: "A",
              nominal: "0.5",
              row_result: "PASS",
            },
          ]),
    ];
  if (endpoint === "/api/vision/image-info")
    return {
      record_id: Number(params.get("id")),
      parametros_disponibles: true,
      numero_parte: code,
      qr: code + "-QR",
      resultado: "NG",
      source_file: "RESULTS-DEMO.txt",
      image_url: "",
      message:
        "La imagen original se consulta al conectar el servidor de Visión.",
      defects: [
        {
          tipo: "PRESENCIA",
          componente: "R37",
          tipo_falla: "FALTANTE",
          detalle: "Componente no detectado.",
        },
      ],
    };
  if (endpoint === "/api/vision/parameters")
    return {
      record_id: Number(params.get("id")),
      resultado: "NG",
      pruebas: [
        {
          prueba: "PRESENCIA",
          resultado: "NG",
          ejecutada: true,
          limite_inferior: "0",
          limite_superior: "1",
          lectura: "",
          posiciones: [
            { posicion: "R37", resultado: "NG", detalle: "FALTANTE > 0" },
            { posicion: "C25", resultado: "OK", detalle: "" },
          ],
        },
        {
          prueba: "QR",
          resultado: "OK",
          ejecutada: true,
          es_lectura: true,
          lectura: code + "-QR",
          posiciones: [],
        },
      ],
      resumen: { pruebas: 2, posiciones: 2, ng: 1 },
    };
  if (endpoint === "/api/ict/pass-fail/detail")
    return {
      summary: { total_intentos: 3, piezas_unicas: 1, piezas_repetidas: 1 },
      rows: [
        {
          barcode: code,
          primer_test: date + " 08:00:00",
          ultimo_test: date + " 08:02:00",
          intentos: 3,
          ok_count: 2,
          ng_count: 1,
          ok_real: 2,
          defectos_detectados: 1,
          falsos_negativos: 0,
          falsos_fail: 0,
          criterio_real: "DEFECTO_DETECTADO",
          resultado_primer: "NG",
          resultado_final: "OK",
          defectos: "R37, soldadura",
        },
      ],
    };
  if (endpoint === "/api/fct/pass-fail/detail")
    return records("fct").slice(0, 5);
  const { spec, items } = resolve(endpoint, params);
  if (spec.remote) {
    const size = Number(params.get("per_page")) || 500;
    const page = Math.min(
      Number(params.get("page")) || 1,
      Math.max(1, Math.ceil(items.length / size)),
    );
    return {
      rows: items.slice((page - 1) * size, page * size),
      page,
      per_page: size,
      total: items.length,
    };
  }
  if (spec.id === "machine-changes")
    return {
      rows: items,
      warnings: [],
      meta: { archivos_leidos: 2, eventos: items.length },
    };
  if (spec.id === "machine-operators")
    return { records: items, total: items.length };
  return items;
}
export async function machineDownload(path: string, filename: string) {
  const url = new URL(path, "http://demo");
  if (url.pathname === "/api/ict/export-defects") {
    const items = parameters(url.searchParams.get("ts") ?? "").filter(
      (item) =>
        !url.searchParams.get("resultado") ||
        item.resultado_local === url.searchParams.get("resultado"),
    );
    return exportSpreadsheet(filename, [
      {
        name: "Parámetros",
        rows: [
          [
            "Fecha",
            "Hora",
            "Línea",
            "ICT",
            "Barcode",
            ...parameterColumns.map((column) => column.title),
          ],
          ...items.map((row) => [
            date,
            text(url.searchParams.get("ts")).slice(11),
            "M1",
            "1",
            text(url.searchParams.get("barcode")),
            ...parameterColumns.map((column) => text(row[column.key])),
          ]),
        ],
      },
    ]);
  }
  let { spec, items } = resolve(url.pathname, url.searchParams);
  if (url.pathname === "/api/ict/pass-fail/consolidado/export") {
    items = consolidatedRows(summaries("ict"));
    spec = {
      ...passFailView("ict"),
      columns: [
        { key: "numero_parte", title: "No. parte", width: 150 },
        { key: "total", title: "Total", width: 85, numeric: true },
        { key: "ok", title: "OK", width: 85, numeric: true },
      ],
    };
  }
  if (spec.remote && url.searchParams.has("page")) {
    const size = Number(url.searchParams.get("per_page")) || 500,
      page = Number(url.searchParams.get("page")) || 1;
    items = items.slice((page - 1) * size, page * size);
  }
  if (spec.exportLimit) items = items.slice(0, spec.exportLimit);
  items = spec.mapRows
    ? spec.mapRows(items, Object.fromEntries(url.searchParams))
    : items;
  return exportSpreadsheet(filename, [
    {
      name: "Historial",
      rows: [
        spec.columns.map((column) => column.title),
        ...items.map((row) =>
          spec.columns.map((column) =>
            column.numeric ? number(row[column.key]) : text(row[column.key]),
          ),
        ),
      ],
    },
  ]);
}
export async function comparisonDownload(
  records: readonly Row[],
  onlyDiffs: boolean,
) {
  const items = comparisonRows(
    records.map((record) => ({
      record,
      parameters: parameters(text(record.ts)),
    })),
    onlyDiffs,
  );
  const columns = [
    { key: "execution", title: "Ejecución", width: 200 },
    ...parameterColumns,
  ];
  return exportSpreadsheet("comparacion_ict.xlsx", [
    {
      name: "Comparación",
      rows: [
        columns.map((column) => column.title),
        ...items.map((row) => columns.map((column) => text(row[column.key]))),
      ],
    },
  ]);
}
