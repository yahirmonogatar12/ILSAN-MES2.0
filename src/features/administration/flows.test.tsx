import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { PermissionEditor } from "./PermissionEditor";
import { createAdministrationApi } from "./api";

describe("administración integrada con controles compartidos", () => {
  it.each(["usuarios", "autoridades"])(
    "un permiso denegado impide cargar datos privados de %s",
    async (route) => {
      const fetcher = vi.fn((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              url.endsWith("/api/mi-perfil")
                ? {
                    perfil: {
                      username: "qa",
                      nombre_completo: "QA",
                      rol: "operador",
                    },
                  }
                : { usuario: "qa", rol: "operador", permisos: {} },
            ),
            { headers: { "Content-Type": "application/json" } },
          ),
        ),
      );
      vi.stubGlobal("fetch", fetcher);
      render(
        <MemoryRouter initialEntries={[`/informacion-basica/${route}`]}>
          <AppProviders>
            <App />
          </AppProviders>
        </MemoryRouter>,
      );
      await screen.findByText("Acceso restringido");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
        "/backend/api/mi-perfil",
        "/backend/obtener_permisos_usuario_actual",
      ]);
    },
  );
  it("crea un rol, lo asigna a un usuario, edita su estado y guarda permisos filtrados sin HTTP", async () => {
    localStorage.setItem("mes-v2:mode", JSON.stringify("demo"));
    const fetcher = vi.fn(() => {
      throw new Error("La demo no debe usar HTTP");
    });
    vi.stubGlobal("fetch", fetcher);
    render(
      <MemoryRouter initialEntries={["/informacion-basica/autoridades"]}>
        <AppProviders>
          <App />
        </AppProviders>
      </MemoryRouter>,
    );
    await screen.findByRole("table", { name: "Roles registrados" });
    await userEvent.click(screen.getByRole("button", { name: "Nuevo rol" }));
    let dialog = screen.getByRole("dialog", { name: "Nuevo rol" });
    await userEvent.type(
      within(dialog).getByLabelText(/Nombre del rol/),
      "QA Reutilizable",
    );
    await userEvent.type(
      within(dialog).getByLabelText("Departamento"),
      "Calidad",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Crear rol" }),
    );
    await screen.findByRole("button", { name: "Permisos de QA Reutilizable" });
    await userEvent.click(
      screen.getByRole("link", { name: "Administración de usuario" }),
    );
    await screen.findByRole("table", { name: "Usuarios registrados" });
    await userEvent.click(
      screen.getByRole("button", { name: "Nuevo usuario" }),
    );
    dialog = screen.getByRole("dialog", { name: "Nuevo usuario" });
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Usuario" }),
      "qa.usuario.v2",
    );
    await userEvent.type(
      within(dialog).getByLabelText(/Nombre completo/),
      "Usuario prueba",
    );
    await userEvent.type(
      within(dialog).getByLabelText(/Contraseña/),
      "Demo temporal&",
    );
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Departamento"),
      "Calidad",
    );
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "QA Reutilizable" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Crear usuario" }),
    );
    await screen.findByRole("button", { name: "Editar qa.usuario.v2" });
    await userEvent.click(
      screen.getByRole("button", { name: "Editar qa.usuario.v2" }),
    );
    dialog = screen.getByRole("dialog", { name: "Editar usuario" });
    expect(
      within(dialog).getByRole("textbox", { name: "Usuario" }),
    ).toHaveAttribute("readonly");
    expect(within(dialog).getByLabelText(/Contraseña/)).toHaveValue("");
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Usuario activo" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar cambios" }),
    );
    const table = await screen.findByRole("table", {
      name: "Usuarios registrados",
    });
    expect(
      within(table).getByRole("row", { name: /qa.usuario.v2/ }),
    ).toHaveTextContent("Inactivo");
    await userEvent.click(
      screen.getByRole("link", { name: "Administración de autoridad" }),
    );
    await screen.findByRole("button", { name: "Permisos de QA Reutilizable" });
    await userEvent.click(
      screen.getByRole("button", { name: "Permisos de QA Reutilizable" }),
    );
    dialog = await screen.findByRole("dialog", {
      name: "Permisos de QA Reutilizable",
    });
    let search = await within(dialog).findByRole("searchbox", {
      name: "Buscar permiso",
    });
    await userEvent.type(search, "material");
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Control de material" }),
    );
    await userEvent.clear(search);
    await userEvent.type(search, "autoridad");
    await userEvent.click(
      within(dialog).getByRole("checkbox", {
        name: "Administración de autoridad",
      }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar permisos" }),
    );
    await screen.findByRole("table", { name: "Roles registrados" });
    await userEvent.click(
      screen.getByRole("button", { name: "Permisos de QA Reutilizable" }),
    );
    dialog = await screen.findByRole("dialog", {
      name: "Permisos de QA Reutilizable",
    });
    search = await within(dialog).findByRole("searchbox", {
      name: "Buscar permiso",
    });
    await userEvent.type(search, "material");
    expect(
      within(dialog).getByRole("checkbox", { name: "Control de material" }),
    ).toBeChecked();
    await userEvent.clear(search);
    await userEvent.type(search, "autoridad");
    expect(
      within(dialog).getByRole("checkbox", {
        name: "Administración de autoridad",
      }),
    ).toBeChecked();
    expect(fetcher).not.toHaveBeenCalled();
    expect(JSON.stringify(localStorage)).not.toContain("Demo temporal&");
  }, 20000);

  it("un fallo al cargar permisos bloquea el guardado; al reintentar envía solamente los permisos del área", async () => {
    const api = {
      ...createAdministrationApi("demo"),
      availablePermissions: vi.fn().mockResolvedValue({
        QA: {
          Inspección: [
            { id: 7, boton: "Consultar inspección", descripcion: null },
          ],
        },
      }),
      rolePermissions: vi
        .fn()
        .mockRejectedValueOnce(new Error("No se pudieron cargar los permisos"))
        .mockResolvedValue([7, 999]),
      savePermissions: vi
        .fn()
        .mockResolvedValue({ success: true, mensaje: "Guardado" }),
    };
    const saved = vi.fn();
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <PermissionEditor
          record={{
            id: 42,
            nombre: "Inspector",
            descripcion: "",
            departamento: "Calidad",
            nivel: 3,
            total_usuarios: 1,
          }}
          context={{ es_superadmin: false, departamento: "Calidad" }}
          api={api}
          scope="test:qa"
          onClose={vi.fn()}
          onSaved={saved}
        />
      </QueryClientProvider>,
    );
    await screen.findByText("No se pudieron cargar los permisos");
    expect(
      screen.queryByRole("button", { name: "Guardar permisos" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Volver a intentar" }),
    );
    const search = await screen.findByRole("searchbox", {
      name: "Buscar permiso",
    });
    expect(screen.getByText(/Se conservarán al guardar/)).toHaveTextContent(
      "1 permiso(s)",
    );
    await userEvent.type(search, "inspección");
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Consultar inspección" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar permisos" }),
    );
    expect(api.savePermissions).toHaveBeenCalledExactlyOnceWith(42, []);
    expect(saved).toHaveBeenCalledWith("Guardado");
  });
});
