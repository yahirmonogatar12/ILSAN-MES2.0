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
import type { ScrapRecord } from "@/features/scrap-control/types";

const root = "/backend/api/control-scrap";
const permission = "Control de Scrap";
const row: ScrapRecord = {
  id: 9,
  cliente: "LG",
  fecha: "2026-11-10",
  hora: "08:32:06",
  scanned_original: "0001/QA-08+B&3",
  part_no: "0001/A-03",
  modelo: "QA",
  area: "IMD",
  proceso: "IMD",
  motivo_scrap_texto: "Daño",
  cantidad: 0,
  comentarios: null,
  usuario_registro: "qa",
};

function mockServer(allowed: boolean) {
  const fetcher = vi.fn(async (url: string, _init: RequestInit) => {
    if (url === "/backend/api/mi-perfil")
      return Response.json({
        perfil: {
          username: "qa-scrap",
          nombre_completo: "QA",
          rol: "operador",
        },
      });
    if (url === "/backend/obtener_permisos_usuario_actual")
      return Response.json({
        usuario: "qa-scrap",
        rol: "operador",
        permisos: {
          LISTA_CONTROL_DE_PROCESO: {
            "Almacén de Embarques": ["Entradas almacen embarques"],
            "Control de material Scrap": allowed ? [permission] : [],
          },
        },
      });
    if (url.startsWith(root + "/export?"))
      return new Response("xlsx", {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="Control_Scrap_QA.xlsx"',
        },
      });
    if (url.startsWith(root + "?"))
      return Response.json({ success: true, data: [row] });
    throw new Error("Solicitud inesperada.");
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
function mount(path = "/proceso/scrap") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("Control de Scrap", () => {
  it("oculta el módulo y protege el alias cuando falta el permiso", async () => {
    const fetcher = mockServer(false);
    mount("/control-scrap-ajax");
    await screen.findByText("Acceso restringido");
    expect(
      screen.queryByRole("link", { name: permission }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Control de material Scrap" }),
    ).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([url]) => url.startsWith(root))).toBe(
      false,
    );
  });

  it("consulta y exporta con los mismos filtros, preservando identificadores y ceros", async () => {
    const fetcher = mockServer(true);
    const clickDownload = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = vi.fn(() => "blob:qa-scrap");
        static revokeObjectURL = vi.fn();
      },
    );
    mount();
    const table = await screen.findByRole("table", {
      name: "Registros de scrap",
    });
    expect(screen.getByRole("link", { name: permission })).toBeVisible();
    expect(
      within(table).getByRole("cell", { name: row.scanned_original }),
    ).toBeVisible();
    expect(within(table).getByRole("cell", { name: "0" })).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Filas por página" }),
    ).toHaveValue("500");
    fireEvent.change(screen.getByLabelText("Fecha desde"), {
      target: { value: "2026-11-09" },
    });
    fireEvent.change(screen.getByLabelText("Fecha hasta"), {
      target: { value: "2026-11-10" },
    });
    await userEvent.selectOptions(
      screen.getByLabelText("Área", { exact: true }),
      "IMD",
    );
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Filtrar Código" }),
    );
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Texto para filtrar Código" }),
      row.scanned_original,
    );
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Exportar Excel" }),
    );
    await waitFor(() => expect(clickDownload).toHaveBeenCalledOnce());
    const calls = fetcher.mock.calls.filter(([url]) => url.startsWith(root));
    const [list, download] = calls.slice(-2);
    const params = new URLSearchParams({
      start: "2026-11-09",
      end: "2026-11-10",
      area: "IMD",
      cf_codigo: row.scanned_original,
    });
    expect(list[0]).toBe(root + "?" + params);
    expect(list[1].signal).toBeInstanceOf(AbortSignal);
    expect(download[0]).toBe(root + "/export?" + params);
    expect(
      calls.every(([, init]) => !init.method || init.method === "GET"),
    ).toBe(true);
  });

  it("recupera solo filtros conocidos de la sesión y evita consultar un rango invertido", async () => {
    const fetcher = mockServer(true);
    localStorage.setItem(
      "scrap-control:live:qa-scrap:columns",
      JSON.stringify({
        codigo: " 0001/A ",
        motivo: "Daño",
        unknown: "ignorado",
      }),
    );
    mount();
    await screen.findByRole("table", { name: "Registros de scrap" });
    const first = fetcher.mock.calls.find(([url]) => url.startsWith(root))?.[0];
    const params = new URL(first!, "http://mes").searchParams;
    expect(params.get("cf_codigo")).toBe("0001/A");
    expect(params.get("cf_motivo")).toBe("Daño");
    expect(params.has("cf_unknown")).toBe(false);
    fireEvent.change(screen.getByLabelText("Fecha desde"), {
      target: { value: "2026-11-10" },
    });
    fireEvent.change(screen.getByLabelText("Fecha hasta"), {
      target: { value: "2026-11-09" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La fecha desde debe ser anterior o igual a la fecha hasta.",
    );
    expect(
      fetcher.mock.calls.filter(([url]) => url.startsWith(root)),
    ).toHaveLength(1);
  });
});
