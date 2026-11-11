import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { modules } from "@/app/registry";
import * as adapter from "@/features/quality-control/api";
import * as spreadsheet from "@/shared/lib/spreadsheet";
afterEach(() => vi.restoreAllMocks());
const routes = [
  [
    "/calidad/liberacion-lqc",
    "Historial de liberacion LQC",
    "Inspeccion de calidad",
  ],
  [
    "/calidad/liberacion-oqc",
    "Historial de liberacion OQC",
    "Inspeccion de calidad",
  ],
  ["/calidad/ppm-lqc", "PPM's LQC", "PPM's"],
  ["/calidad/ppm-oqc", "PPM's OQC", "PPM's"],
] as const;
function mount(path: string, demo = true) {
  if (demo) localStorage.setItem("mes-v2:mode", JSON.stringify("demo"));
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
}
function server() {
  const fetcher = vi.fn(async (url: string) =>
    Response.json(
      url.endsWith("/api/mi-perfil")
        ? {
            perfil: {
              username: "qa-ppm",
              nombre_completo: "QA",
              rol: "operador",
            },
          }
        : {
            usuario: "qa-ppm",
            rol: "operador",
            permisos: {},
          },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
function demoOnly() {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("La demo no usa HTTP.");
    }),
  );
}
describe("Liberación y PPM de Control de calidad", () => {
  it.each(routes)(
    "oculta y protege %s con su permiso exacto",
    async (path, title, group) => {
      const fetcher = server();
      mount(path, false);
      await screen.findByText("Acceso restringido");
      expect(
        screen.queryByRole("link", { name: title }),
      ).not.toBeInTheDocument();
      expect(
        modules.find((module) => module.path === path)?.permission,
      ).toEqual({
        pagina: "LISTA_CONTROL_DE_CALIDAD",
        seccion: group,
        boton: title,
      });
      expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
        "/backend/api/mi-perfil",
        "/backend/obtener_permisos_usuario_actual",
      ]);
    },
  );
  it("retira IQC del menú, las rutas y las pestañas guardadas", async () => {
    demoOnly();
    localStorage.setItem(
      "mes-v2:tabs:demo:demo",
      JSON.stringify({
        ids: ["quality-iqc-ppm", "quality-lqc-ppm", "quality-oqc-ppm"],
        activeId: "quality-iqc-ppm",
      }),
    );
    mount("/calidad/ppm-lqc");
    await screen.findByRole("spinbutton", { name: "TARGET LQC" });
    expect(
      screen.queryByRole("link", { name: "PPM's IQC" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "PPM's IQC" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PPM's LQC" })).toBeVisible();
    expect(screen.getByRole("link", { name: "PPM's OQC" })).toBeVisible();
    expect(
      modules.some(
        (module) =>
          module.path === "/calidad/ppm-iqc" ||
          module.legacyPaths?.includes("/control_calidad/ppms/iqc"),
      ),
    ).toBe(false);
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("mes-v2:tabs:demo:demo")!).ids,
      ).not.toContain("quality-iqc-ppm"),
    );
  });
  it("consulta resumen y detalle LQC y exporta los históricos filtrados sin repetir la consulta al buscar", async () => {
    demoOnly();
    const api = adapter.createQualityApi("demo"),
      records = vi.fn(api.lqcRecords);
    vi.spyOn(adapter, "createQualityApi").mockReturnValue({
      ...api,
      lqcRecords: records,
    });
    const download = vi
      .spyOn(spreadsheet, "exportSpreadsheet")
      .mockResolvedValue(undefined);
    mount("/calidad/liberacion-lqc");
    await screen.findByRole("button", { name: "M1 2 escaneos" });
    await userEvent.click(
      screen.getByRole("button", { name: "Todas las líneas" }),
    );
    const summary = await screen.findByRole("table", {
      name: "Resumen de liberación LQC",
    });
    expect(
      within(summary).queryByRole("columnheader", { name: /Lote/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Filas por página" }),
    ).toHaveValue("500");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Vista LQC" }),
      "detail",
    );
    await screen.findByRole("table", { name: "Detalle de liberación LQC" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar" }), {
      target: { value: "0001/LQC+01-A" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Exportar Excel" }),
    );
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
    const sheets = download.mock.calls[0][1],
      exported = sheets[0].rows;
    expect(exported).toHaveLength(3);
    expect(exported[0]).toContain("Escaneos históricos");
    expect(
      exported.slice(1).every((row) => row.includes("0001/LQC+01-A")),
    ).toBe(true);
    expect(exported.some((row) => row.includes("Duplicado"))).toBe(true);
    expect(records).toHaveBeenCalledOnce();
  });
  it("guarda la meta LQC y actualiza sus reportes conservando una meta OQC independiente", async () => {
    demoOnly();
    const api = adapter.createQualityApi("demo"),
      save = vi.fn(api.savePpmTarget);
    vi.spyOn(adapter, "createQualityApi").mockReturnValue({
      ...api,
      savePpmTarget: save,
    });
    mount("/calidad/ppm-lqc");
    const target = await screen.findByRole("spinbutton", {
      name: "TARGET LQC",
    });
    await userEvent.clear(target);
    await userEvent.type(target, "12500");
    await userEvent.click(screen.getByRole("button", { name: "Guardar meta" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("lqc", 12500));
    await userEvent.click(
      screen.getByRole("tab", { name: "Por línea y semana" }),
    );
    expect(
      await screen.findByRole("table", {
        name: "Detalle PPM por línea y semana",
      }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "PPM's OQC" }));
    expect(
      await screen.findByRole("spinbutton", { name: "TARGET OQC" }),
    ).toHaveValue(20000);
    await api.savePpmTarget("lqc", 20000);
  });
});
