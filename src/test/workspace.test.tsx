import { lazy, useEffect, useMemo, useState } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PanelsTopLeft } from "lucide-react";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { Workspace } from "@/app/workspace/Workspace";
import { decodeTabs } from "@/app/workspace/tabs";
import type { ModuleDefinition, SectionDefinition } from "@/core/modules/types";
import { SESSION_EXPIRED_EVENT } from "@/core/runtime";
import { useActiveModule } from "@/core/modules/ActiveModule";
import {
  Button,
  Card,
  DataGrid,
  Page,
  TextField,
  type TableColumn,
} from "@/shared/ui";

const scope = "demo:workspace-test";
const sections: SectionDefinition[] = [
  { id: "informacion-basica", title: "Información básica", image: "info" },
];
function sampleModules() {
  const effects = vi.fn();
  function Screen({ name }: { name: string }) {
    const [draft, setDraft] = useState("");
    useEffect(() => {
      effects(`visible:${name}`);
      return () => effects(`hidden:${name}`);
    }, [name]);
    const rows = useMemo(
      () =>
        Array.from({ length: 60 }, (_, i) => ({
          id: i + 1,
          nombre: `${name}-${String(i + 1).padStart(2, "0")}`,
        })),
      [name],
    );
    const columns = useMemo<TableColumn<(typeof rows)[number]>[]>(
      () => [
        {
          id: "name",
          header: "Nombre",
          cell: (row) => row.nombre,
          sortValue: (row) => row.nombre,
        },
      ],
      [],
    );
    return (
      <Page>
        <TextField
          label={`Captura ${name}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Card fill>
          <DataGrid
            label={`Tabla ${name}`}
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            initialSort={{ columnId: "name", direction: "asc" }}
          />
        </Card>
      </Page>
    );
  }
  const loaders = ["A", "B", "C"].map((name) =>
    vi.fn(async () => ({ default: () => <Screen name={name} /> })),
  );
  const modules: ModuleDefinition[] = ["A", "B", "C"].map((name, index) => ({
    id: name.toLowerCase(),
    path: `/informacion-basica/${name.toLowerCase()}`,
    ...(index === 0 ? { legacyPaths: ["/legado/a"] } : {}),
    title: name,
    sectionId: "informacion-basica",
    group: "Pruebas",
    icon: PanelsTopLeft,
    permission: null,
    demoOnly: true,
    component: lazy(loaders[index]),
  }));
  return { modules, loaders, effects };
}
function HistoryControls() {
  const navigate = useNavigate();
  return (
    <>
      <Button onClick={() => void navigate(-1)}>Ir atrás</Button>
      <Button onClick={() => void navigate(1)}>Ir adelante</Button>
    </>
  );
}
function mount(
  modules: ModuleDefinition[],
  path = "/informacion-basica/a",
  userScope = scope,
  children?: React.ReactNode,
) {
  localStorage.setItem("mes-v2:mode", JSON.stringify("demo"));
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <HistoryControls />
        <Workspace
          key={userScope}
          modules={modules}
          sections={sections}
          scope={userScope}
          mode="demo"
        >
          {children}
        </Workspace>
      </AppProviders>
    </MemoryRouter>,
  );
}

describe("pestañas del workspace", () => {
  it("conserva el mismo esqueleto mientras carga código y datos y muestra el módulo al terminar", async () => {
    let resolve!: (value: { default: () => React.ReactNode }) => void;
    const pending = new Promise<{ default: () => React.ReactNode }>((done) => {
      resolve = done;
    });
    const { modules } = sampleModules();
    let finishData!: () => void;
    function LoadedModule() {
      const [loading, setLoading] = useState(true);
      finishData = () => setLoading(false);
      return (
        <Page>
          <TextField label="Captura inicial" />
          <Card fill>
            <DataGrid
              label="Lista inicial"
              rows={[{ id: 1 }]}
              columns={[{ id: "id", header: "ID", cell: (row) => row.id }]}
              rowKey={(row) => row.id}
              loading={loading}
            />
          </Card>
        </Page>
      );
    }
    mount([{ ...modules[0], component: lazy(() => pending) }]);
    const loading = await screen.findByRole("status", { name: "Cargando A…" });
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("table")).toBeNull();
    expect(within(loading).queryByRole("button")).toBeNull();
    await act(async () => resolve({ default: LoadedModule }));
    expect(screen.getByRole("status", { name: "Cargando A…" })).toBe(loading);
    expect(
      screen.queryByRole("textbox", { name: "Captura inicial" }),
    ).toBeNull();
    act(() => finishData());
    await screen.findByRole("table", { name: "Lista inicial" });
    expect(
      screen.getByRole("textbox", { name: "Captura inicial" }),
    ).toBeVisible();
    expect(screen.queryByRole("status", { name: "Cargando A…" })).toBeNull();
  });
  it("publica el módulo activo y limpia su contexto al cerrar la última pestaña", async () => {
    function ContextProbe() {
      const module = useActiveModule();
      return (
        <output aria-label="Contexto del workspace">
          {JSON.stringify(module)}
        </output>
      );
    }
    const { modules } = sampleModules();
    mount(modules, "/informacion-basica/a", scope, <ContextProbe />);
    await screen.findByRole("table", { name: "Tabla A" });
    const context = await screen.findByLabelText("Contexto del workspace");
    await waitFor(() =>
      expect(context).toHaveTextContent('"panelId":"workspace-panel-a"'),
    );
    await userEvent.click(screen.getByRole("link", { name: "B" }));
    await screen.findByRole("table", { name: "Tabla B" });
    expect(JSON.parse(context.textContent!)).toEqual({
      id: "b",
      title: "B",
      path: "/informacion-basica/b",
      panelId: "workspace-panel-b",
    });
    await userEvent.click(screen.getByRole("button", { name: "Cerrar B" }));
    await waitFor(() => expect(context).toHaveTextContent('"id":"a"'));
    await userEvent.click(screen.getByRole("button", { name: "Cerrar A" }));
    await waitFor(() => expect(context).toHaveTextContent("null"));
  });
  it("conserva captura, página, tamaño y DOM de la tabla, pausa efectos y no duplica módulos", async () => {
    const { modules, effects } = sampleModules();
    mount(modules);
    const table = await screen.findByRole("table", { name: "Tabla A" });
    await userEvent.type(
      screen.getByLabelText("Captura A"),
      "Captura pendiente",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Filas por página" }),
      "25",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Página siguiente" }),
    );
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("A-26");
    await userEvent.click(screen.getByRole("link", { name: "B" }));
    await screen.findByRole("table", { name: "Tabla B" });
    expect(effects).toHaveBeenCalledWith("hidden:A");
    expect(
      screen.queryByRole("table", { name: "Tabla A" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "A" }));
    expect(await screen.findByRole("table", { name: "Tabla A" })).toBe(table);
    expect(screen.getByLabelText("Captura A")).toHaveValue("Captura pendiente");
    expect(
      screen.getByRole("combobox", { name: "Filas por página" }),
    ).toHaveValue("25");
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("A-26");
    expect(
      effects.mock.calls.filter(([event]) => event === "visible:A"),
    ).toHaveLength(2);
    await userEvent.click(screen.getByRole("link", { name: "A" }));
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    const saved = JSON.parse(localStorage.getItem(`mes-v2:tabs:${scope}`)!);
    expect(saved).toEqual({ ids: ["a", "b"], activeId: "a" });
    expect(JSON.stringify(saved)).not.toContain("Captura pendiente");
  });

  it("cierra una pestaña inactiva sin cambiar la actual y libera el estado al reabrir; cerrar la última deja el workspace vacío", async () => {
    const { modules } = sampleModules();
    mount(modules);
    await screen.findByRole("table", { name: "Tabla A" });
    await userEvent.type(screen.getByLabelText("Captura A"), "Temporal");
    await userEvent.click(screen.getByRole("link", { name: "B" }));
    await screen.findByRole("table", { name: "Tabla B" });
    await userEvent.type(screen.getByLabelText("Captura B"), "Conservar B");
    await userEvent.click(screen.getByRole("button", { name: "Cerrar A" }));
    expect(screen.getByRole("tab", { name: "B" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.click(screen.getByRole("link", { name: "A" }));
    await screen.findByRole("table", { name: "Tabla A" });
    expect(screen.getByLabelText("Captura A")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Cerrar A" }));
    await screen.findByRole("table", { name: "Tabla B" });
    expect(screen.getByLabelText("Captura B")).toHaveValue("Conservar B");
    await userEvent.click(screen.getByRole("button", { name: "Cerrar B" }));
    await screen.findByText("Sin pestañas abiertas");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "A" }));
    await screen.findByRole("table", { name: "Tabla A" });
    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("restaura los nombres por sesión sin cargar pantallas inactivas y respeta atrás/adelante del navegador", async () => {
    const { modules, loaders } = sampleModules();
    localStorage.setItem(
      `mes-v2:tabs:${scope}`,
      JSON.stringify({ ids: ["a", "b", "c"], activeId: "c" }),
    );
    mount(modules);
    await screen.findByRole("table", { name: "Tabla A" });
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(loaders[0]).toHaveBeenCalledOnce();
    expect(loaders[1]).not.toHaveBeenCalled();
    expect(loaders[2]).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("tab", { name: "B" }));
    await screen.findByRole("table", { name: "Tabla B" });
    await userEvent.click(screen.getByRole("tab", { name: "C" }));
    await screen.findByRole("table", { name: "Tabla C" });
    await userEvent.click(screen.getByRole("button", { name: "Ir atrás" }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "B" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Ir adelante" }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "C" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("permite flechas, Inicio, Fin y Suprimir y el cierre no activa la pestaña cerrada", async () => {
    const { modules, loaders } = sampleModules();
    localStorage.setItem(
      `mes-v2:tabs:${scope}`,
      JSON.stringify({ ids: ["a", "b", "c"], activeId: "a" }),
    );
    mount(modules);
    await screen.findByRole("table", { name: "Tabla A" });
    screen.getByRole("tab", { name: "A" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    await screen.findByRole("table", { name: "Tabla B" });
    expect(screen.getByRole("tab", { name: "B" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    await screen.findByRole("table", { name: "Tabla C" });
    await userEvent.keyboard("{Home}");
    await screen.findByRole("table", { name: "Tabla A" });
    await userEvent.keyboard("{Delete}");
    await waitFor(() =>
      expect(screen.queryByRole("tab", { name: "A" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("tab", { name: "B" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(loaders[0]).toHaveBeenCalledOnce();
  });

  it.each(["/legado/a", "/informacion-basica/a/"])(
    "ignora preferencias inválidas y abre %s como una sola pestaña",
    async (path) => {
      const { modules } = sampleModules();
      expect(
        decodeTabs(
          {
            ids: ["a", "inexistente", "a", 7, "b"],
            activeId: "inexistente",
            visited: ["b"],
          },
          modules,
        ),
      ).toEqual({ ids: ["a", "b"], activeId: "a", visited: [] });
      mount(modules, path);
      await screen.findByRole("table", { name: "Tabla A" });
      expect(screen.getAllByRole("tab")).toHaveLength(1);
      expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    },
  );

  it("las pestañas guardadas pertenecen al usuario y la expiración retira también los módulos ocultos", async () => {
    const { modules } = sampleModules();
    localStorage.setItem(
      `mes-v2:tabs:otro-usuario`,
      JSON.stringify({ ids: ["b", "c"], activeId: "b" }),
    );
    const view = mount(modules);
    await screen.findByRole("table", { name: "Tabla A" });
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    view.unmount();
    render(
      <MemoryRouter initialEntries={["/material/materiales"]}>
        <AppProviders>
          <App />
        </AppProviders>
      </MemoryRouter>,
    );
    await screen.findByRole("table", { name: "Materiales registrados" });
    await userEvent.click(
      within(
        screen.getByRole("navigation", { name: "Secciones del MES" }),
      ).getByRole("link", { name: "Información básica" }),
    );
    await screen.findByRole("table", { name: "Usuarios registrados" });
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    act(() => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)));
    await screen.findByRole("heading", { name: "Iniciar sesión" });
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("table", { hidden: true }),
    ).not.toBeInTheDocument();
  });
});
