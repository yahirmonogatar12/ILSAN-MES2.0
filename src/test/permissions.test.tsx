import { lazy, useState } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { PanelsTopLeft } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/app/providers";
import { Workspace } from "@/app/workspace/Workspace";
import { AuthProvider } from "@/core/auth/AuthProvider";
import { createAuthGateway } from "@/core/auth/api";
import { allowsPermission } from "@/core/auth/usePermission";
import type { PermissionRule, PermissionSnapshot } from "@/core/auth/types";
import { ModuleCatalogProvider } from "@/core/modules/ModuleCatalog";
import type { ModuleDefinition, SectionDefinition } from "@/core/modules/types";
import { PermissionEditor } from "@/features/administration/PermissionEditor";
import { createAdministrationApi } from "@/features/administration/api";
import { Page, TextField, ToastProvider } from "@/shared/ui";

const entryRule: PermissionRule = {
  pagina: "LISTA_DE_MATERIALES",
  seccion: "Control de material",
  boton: "Historial de entradas",
};
const inventoryRule: PermissionRule = {
  ...entryRule,
  boton: "Inventario actual",
};
const modelRule: PermissionRule = {
  pagina: "LISTA_INFORMACIONBASICA",
  seccion: "Control de produccion",
  boton: "Control de modelos",
};
const sections: SectionDefinition[] = [
  { id: "material", title: "Control de material", image: "material" },
  { id: "informacion-basica", title: "Información básica", image: "info" },
];
const snapshot = (
  buttons: string[],
  extra: PermissionSnapshot["permisos"] = {},
): PermissionSnapshot => ({
  usuario: "operador",
  rol: "operador",
  permisos: {
    LISTA_DE_MATERIALES: { "Control de material": buttons },
    ...extra,
  },
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function samples() {
  const reads = vi.fn();
  function Screen({ id }: { id: string }) {
    const [value, setValue] = useState("");
    return (
      <Page>
        <h2>Contenido {id}</h2>
        <TextField
          label={`Captura ${id}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </Page>
    );
  }
  const modules: ModuleDefinition[] = [entryRule, inventoryRule, modelRule].map(
    (permission, index) => {
      const id = ["entries", "inventory", "models"][index];
      return {
        id,
        path: `/${id}`,
        legacyPaths: [`/legado/${id}`],
        title: permission.boton,
        sectionId: index === 2 ? "informacion-basica" : "material",
        group: permission.seccion,
        icon: PanelsTopLeft,
        permission,
        component: lazy(async () => {
          reads(id);
          return { default: () => <Screen id={id} /> };
        }),
      };
    },
  );
  return { modules, reads };
}
function setup(path = "/entries", initial = snapshot([entryRule.boton])) {
  let permissions: unknown = initial;
  let failure = false;
  const fetcher = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.endsWith("/api/mi-perfil"))
      return json({
        perfil: {
          username: "operador",
          nombre_completo: "Operador QA",
          rol: "operador",
        },
      });
    if (url.endsWith("/obtener_permisos_usuario_actual"))
      return failure
        ? json({ error: "Permisos no disponibles" }, 503)
        : json(permissions);
    throw new Error(`No se deben consultar datos privados: ${url}`);
  });
  vi.stubGlobal("fetch", fetcher);
  const { modules, reads } = samples();
  const client = createQueryClient();
  render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <ToastProvider>
            <Workspace
              modules={modules}
              sections={sections}
              scope="live:operador"
              mode="live"
            />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return {
    modules,
    reads,
    client,
    fetcher,
    update: async (next: unknown) => {
      permissions = next;
      await act(async () => {
        await client.invalidateQueries({ queryKey: ["permission"] });
      });
    },
    fail: async () => {
      failure = true;
      await act(async () => {
        await client.invalidateQueries({ queryKey: ["permission"] });
      });
    },
  };
}

describe("visibilidad y autorización compartidas", () => {
  it("oculta módulos y secciones sin permiso, depura pestañas guardadas y consulta permisos una sola vez", async () => {
    localStorage.setItem(
      "mes-v2:tabs:live:operador",
      JSON.stringify({
        ids: ["entries", "inventory", "models"],
        activeId: "models",
      }),
    );
    const { reads, fetcher } = setup();
    await screen.findByRole("heading", { name: "Contenido entries" });
    expect(
      screen.getByRole("link", { name: "Historial de entradas" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Inventario actual" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Información básica" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Información básica" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(reads).toHaveBeenCalledExactlyOnceWith("entries");
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/backend/api/mi-perfil",
      "/backend/obtener_permisos_usuario_actual",
    ]);
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("mes-v2:tabs:live:operador")!).ids,
      ).toEqual(["entries"]),
    );
  });
  it.each(["/inventory", "/legado/inventory"])(
    "bloquea URL directa o antigua %s sin cargar la pantalla",
    async (path) => {
      const { reads } = setup(path);
      await screen.findByText("Acceso restringido");
      expect(reads).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("tab", { name: "Inventario actual" }),
      ).not.toBeInTheDocument();
    },
  );
  it("retira una pestaña revocada y no recupera su captura al volver a autorizar", async () => {
    const { update } = setup(
      "/entries",
      snapshot([entryRule.boton, inventoryRule.boton]),
    );
    await screen.findByRole("heading", { name: "Contenido entries" });
    await userEvent.type(
      screen.getByLabelText("Captura entries"),
      "Privado temporal",
    );
    await userEvent.click(
      screen.getByRole("link", { name: "Inventario actual" }),
    );
    await screen.findByRole("heading", { name: "Contenido inventory" });
    await update(snapshot([inventoryRule.boton]));
    await waitFor(() =>
      expect(
        screen.queryByRole("tab", { name: "Historial de entradas" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByLabelText("Captura entries")).not.toBeInTheDocument();
    await update(snapshot([entryRule.boton, inventoryRule.boton]));
    await userEvent.click(
      await screen.findByRole("link", { name: "Historial de entradas" }),
    );
    expect(await screen.findByLabelText("Captura entries")).toHaveValue("");
  });
  it("la revocación activa oculta su contenido y el error de refresco retira todos los accesos", async () => {
    const { update, fail } = setup();
    await screen.findByRole("heading", { name: "Contenido entries" });
    await update(snapshot([]));
    await screen.findByText("Acceso restringido");
    expect(
      screen.queryByRole("heading", { name: "Contenido entries" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Historial de entradas" }),
    ).not.toBeInTheDocument();
    await fail();
    await screen.findByText("No se pudieron verificar los permisos");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
  it("rechaza permisos de otro usuario y respuestas inválidas", async () => {
    const { update } = setup();
    await screen.findByRole("heading", { name: "Contenido entries" });
    await update({ ...snapshot([entryRule.boton]), usuario: "otro" });
    await screen.findByText("Los permisos no corresponden a la sesión actual.");
    expect(
      screen.queryByRole("link", { name: "Historial de entradas" }),
    ).not.toBeInTheDocument();
    await update({ permisos: true });
    await screen.findByText("La respuesta de permisos no es válida.");
  });
  it("sin módulos abre un estado vacío y superadmin conserva el acceso total", async () => {
    const { update, reads } = setup("/", snapshot([]));
    await screen.findByText("Sin módulos asignados");
    expect(reads).not.toHaveBeenCalled();
    await update({ ...snapshot([]), rol: "superadmin" });
    expect(
      await screen.findByRole("link", { name: "Información básica" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Inventario actual" }),
    ).toBeInTheDocument();
  });
  it("compara la terna exacta, conserva el permiso original y propaga AbortSignal", async () => {
    expect(allowsPermission(snapshot([entryRule.boton]), entryRule)).toBe(true);
    expect(
      allowsPermission(snapshot([entryRule.boton]), {
        ...entryRule,
        pagina: "LISTA_INFORMACIONBASICA",
      }),
    ).toBe(false);
    expect(
      allowsPermission(snapshot([entryRule.boton]), {
        ...entryRule,
        seccion: "Control de Material",
      }),
    ).toBe(false);
    const fetcher = vi
      .fn()
      .mockResolvedValue(json(snapshot([entryRule.boton])));
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    expect(await createAuthGateway("live").permissions(signal)).toEqual(
      snapshot([entryRule.boton]),
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      signal,
      credentials: "same-origin",
    });
  });
});

it("asigna módulos visibles sin borrar permisos del sistema anterior ni asignar fuera de alcance", async () => {
  const { modules } = samples();
  const api = {
    ...createAdministrationApi("demo"),
    availablePermissions: vi.fn().mockResolvedValue({
      LISTA_DE_MATERIALES: {
        "Control de material": [
          { id: 1, boton: entryRule.boton, descripcion: null },
          { id: 2, boton: inventoryRule.boton, descripcion: null },
          { id: 99, boton: "Proceso anterior", descripcion: null },
        ],
      },
    }),
    rolePermissions: vi.fn().mockResolvedValue([99]),
    savePermissions: vi
      .fn()
      .mockResolvedValue({ success: true, mensaje: "Guardado" }),
  };
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ModuleCatalogProvider modules={modules} sections={sections}>
        <PermissionEditor
          record={{
            id: 10,
            nombre: "Almacén",
            descripcion: "",
            departamento: "Almacén",
            nivel: 3,
            total_usuarios: 1,
          }}
          context={{ es_superadmin: false, departamento: "Almacén" }}
          api={api}
          scope="test:editor"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </ModuleCatalogProvider>
    </QueryClientProvider>,
  );
  const search = await screen.findByRole("searchbox", {
    name: "Buscar permiso",
  });
  const dialog = screen.getByRole("dialog", {
    name: "Permisos de Almacén",
  });
  expect(
    within(dialog).queryByRole("checkbox", { name: "Control de modelos" }),
  ).not.toBeInTheDocument();
  await userEvent.type(search, "entradas");
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Marcar visibles" }),
  );
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Guardar permisos" }),
  );
  expect(api.savePermissions).toHaveBeenCalledExactlyOnceWith(10, [99, 1]);
});
