import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { modules } from "@/app/registry";
import * as adapter from "@/features/production-results/api";
import { today } from "@/features/production-results/model";

afterEach(() => vi.restoreAllMocks());
const routes = [
  ["/resultados/operadores-maquina", "Historial de Operadores por Maquina"],
  ["/resultados/maquina-ict", "Historial de maquina ICT"],
  ["/resultados/ict-pass-fail", "Historial de maquina ICT % Pass/Fail"],
  ["/resultados/maquina-fct", "Historial de maquina FCT"],
  ["/resultados/fct-pass-fail", "Historial de maquina FCT % Pass/Fail"],
  [
    "/resultados/cambios-parametros-ict",
    "Historial de cambios de parametros ICT",
  ],
  ["/resultados/maquina-vision", "Historial de maquina vision"],
  ["/resultados/vision-pass-fail", "Historial de maquina Vision % Pass/Fail"],
  ["/resultados/prueba-electrica", "Historial de prueba electrica"],
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
describe("Máquinas de calidad en Control de resultados", () => {
  it.each(routes)(
    "protege y oculta %s con el permiso original",
    async (path, permission) => {
      const fetcher = vi.fn(async (url: string) =>
        Response.json(
          url.endsWith("/api/mi-perfil")
            ? {
                perfil: {
                  username: "qa-machines",
                  nombre_completo: "QA",
                  rol: "operador",
                },
              }
            : { usuario: "qa-machines", rol: "operador", permisos: {} },
        ),
      );
      vi.stubGlobal("fetch", fetcher);
      mount(path, false);
      await screen.findByText("Acceso restringido");
      expect(
        screen.queryByRole("link", {
          name: modules.find((module) => module.path === path)!.title,
        }),
      ).not.toBeInTheDocument();
      expect(
        modules.find((module) => module.path === path)?.permission,
      ).toEqual({
        pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
        seccion: "Historial de maquinas calidad",
        boton: permission,
      });
      expect(
        fetcher.mock.calls.every(
          ([url]) =>
            !url.includes("/api/ict/") &&
            !url.includes("/api/fct/") &&
            !url.includes("/api/vision/"),
        ),
      ).toBe(true);
    },
  );
  it.each(routes.filter(([path]) => !path.includes("cambios-parametros")))(
    "abre %s con 500 filas y exportación verde",
    async (path) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => {
          throw new Error("La demo no usa HTTP.");
        }),
      );
      mount(path);
      await screen.findByRole("table");
      expect(
        await screen.findByRole("combobox", { name: "Filas por página" }),
      ).toHaveValue("500");
      expect(
        screen.getByRole("button", { name: "Exportar Excel" }),
      ).toHaveClass("success");
      if (path.endsWith("pass-fail")) {
        await waitFor(() =>
          expect(screen.getAllByRole("img").length).toBeGreaterThan(0),
        );
        expect(document.querySelector(".production-results-view")).toHaveStyle({
          "--production-results-row-height": "44px",
        });
        const bar = document.querySelector(".percentage-bar")!;
        expect(bar.getAttribute("aria-label")).toMatch(/\d+\.\d{2}%/);
      }
    },
  );
  it("consulta cambios solo al elegir ICT y conserva el detalle del archivo original", async () => {
    const base = adapter.createResultsApi("demo"),
      report = vi.fn(base.report);
    vi.spyOn(adapter, "createResultsApi").mockReturnValue({ ...base, report });
    mount("/resultados/cambios-parametros-ict");
    await screen.findByText("Selecciona los filtros y pulsa Consultar.");
    expect(report).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await screen.findByText("Selecciona una ICT para consultar.");
    expect(report).not.toHaveBeenCalled();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "ICT" }),
      "ICT1 M1",
    );
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await screen.findByRole("cell", { name: "HLIM %" });
    await userEvent.click(
      screen.getByRole("button", { name: "Ver detalle R37 / P-01 · 08:05:00" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Detalle del cambio de parámetros",
    });
    expect(within(dialog).getByText("TEST-0001.lgd")).toBeVisible();
    expect(within(dialog).getByText("TEST-0002.lgd")).toBeVisible();
  });
  it("compara dos ejecuciones del mismo barcode usando su timestamp", async () => {
    mount("/resultados/maquina-ict");
    const date = today();
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Comparar 0001/A+02&B · " + date + " 08:00:00",
      }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Comparar 0001/A+02&B · " + date + " 08:00:01",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Comparar parámetros (2)" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Comparación de parámetros ICT",
    });
    await waitFor(() =>
      expect(within(dialog).getByRole("cell", { name: "2.00" })).toBeVisible(),
    );
    expect(within(dialog).getAllByRole("cell", { name: "R37" })).toHaveLength(
      2,
    );
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Solo diferencias" }),
    );
    expect(within(dialog).getAllByRole("cell", { name: "C25" })).toHaveLength(
      2,
    );
  });
  it("carga pasos FCT y permite filtrar FAIL", async () => {
    mount("/resultados/maquina-fct");
    await screen.findByRole("cell", { name: "0001/A+02&B-SER-0" });
    await userEvent.click(
      screen.getByRole("button", {
        name: "Ver detalle 0001/A+02&B-SER-0 · " + today() + " 08:00:00",
      }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Pasos FCT · 0001/A+02&B-SER-0",
    });
    await within(dialog).findByRole("cell", { name: "CURRENT" });
    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: "Resultado" }),
      "1",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Consultar" }),
    );
    await waitFor(() =>
      expect(
        within(dialog).queryByRole("cell", { name: "CURRENT" }),
      ).not.toBeInTheDocument(),
    );
    expect(within(dialog).getByRole("cell", { name: "VCC" })).toBeVisible();
  });
  it("muestra las posiciones y lecturas SHT aunque falte una imagen demo", async () => {
    mount("/resultados/maquina-vision");
    await screen.findByRole("cell", { name: "0001/A+02&B-QR-0" });
    await userEvent.click(
      screen.getByRole("button", {
        name: "Ver detalle 0001/A+02&B · " + today() + " 08:00:00",
      }),
    );
    const preview = screen.getByRole("dialog", {
      name: "Preview de imagen Vision",
    });
    await userEvent.click(
      await within(preview).findByRole("button", { name: "Ver parámetros" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Parámetros de Visión" });
    await within(dialog).findByRole("cell", { name: "FALTANTE > 0" });
    expect(
      within(dialog).getByRole("cell", { name: "0001/A+02&B-QR" }),
    ).toBeVisible();
    expect(within(dialog).getByRole("cell", { name: "C25" })).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cerrar" }),
    );
    expect(
      within(preview).getByRole("button", { name: "Ver parámetros" }),
    ).toBeVisible();
    expect(within(preview).getByText("Ruta encontrada")).toBeVisible();
  });
  it("consolida partes pegadas en varias líneas con el control compartido", async () => {
    mount("/resultados/ict-pass-fail");
    await screen.findByRole("table");
    await userEvent.click(
      screen.getByRole("button", { name: "Consolidado por parte" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Consolidado por número de parte",
    });
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Números de parte" }),
      "0001/A+02&B\nEBR24212304",
    );
    expect(
      within(dialog).getByRole("textbox", { name: "Números de parte" }),
    ).toHaveValue("0001/A+02&B\nEBR24212304");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Consultar" }),
    );
    expect(
      await within(dialog).findAllByRole("cell", { name: "420" }),
    ).toHaveLength(2);
  });
});
