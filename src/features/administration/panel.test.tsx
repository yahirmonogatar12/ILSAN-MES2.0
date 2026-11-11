import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { allowsRoles } from "@/core/auth/usePermission";
import { createPanelApi, auditQuery } from "./panelApi";
import { auditData, auditDefaults, auditFilterIssue } from "./PanelAudit";
import { PanelRoleForm } from "./PanelRoleForm";
import type { PanelUser } from "./panelTypes";

const user: PanelUser = {
  id: 12,
  username: "operador",
  nombre_completo: "Usuario del almacén",
  email: "",
  departamento: "Almacén",
  cargo: "",
  activo: 1,
  ultimo_acceso: "",
  roles: ["Operador"],
  bloqueado: true,
  intentos_fallidos: 5,
  bloqueado_hasta: null,
  fecha_creacion: "",
};
const role = {
  id: 4,
  nombre: "Operador",
  descripcion: "Consulta",
  departamento: "Almacén",
  nivel: 2,
  total_usuarios: 1,
};
const context = {
  es_superadmin: true,
  departamento_propio: null,
  departamentos: ["Almacén"],
  roles: ["Operador"],
  cargos: ["Supervisor"],
};
const catalog = {
  LISTA_CONTROL_MATERIAL: {
    "Control de material": [
      { id: 9, boton: "Control de material", descripcion: "Materiales" },
    ],
  },
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function app(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
}
function fixture(secondarySuperadmin = true) {
  const writes: { path: string; method: string; body: unknown }[] = [];
  let active = 1;
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace("/backend", "");
    if (path === "/api/mi-perfil")
      return response({
        perfil: {
          username: "qa",
          nombre_completo: "QA",
          rol: "operador",
          roles: secondarySuperadmin
            ? ["operador", "superadmin"]
            : ["operador"],
        },
      });
    if (path === "/obtener_permisos_usuario_actual")
      return response({ usuario: "qa", rol: "operador", permisos: {} });
    if (path.endsWith("/contexto")) return response(context);
    if (path === "/admin/listar_usuarios")
      return response([{ ...user, activo: active }]);
    if (path === "/admin/listar_roles") return response([role]);
    if (path === "/admin/listar_departamentos")
      return response([
        { id: 2, nombre: "Almacén", activo: 1, total_usuarios: 1 },
      ]);
    if (path === "/admin/listar_permisos_dropdowns") return response(catalog);
    if (path === "/admin/obtener_permisos_dropdowns_rol/4")
      return response([{ id: 9 }]);
    if (init?.method && init.method !== "GET") {
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      writes.push({ path, method: init.method, body });
      if (path === "/admin/cambiar_estado_usuario")
        active = body.activo ? 1 : 0;
      return response({ success: true, mensaje: "Guardado" });
    }
    return response({ error: "Ruta no simulada " + path }, 404);
  });
  vi.stubGlobal("fetch", fetcher);
  return { fetcher, writes };
}
describe("panel central y autorización por roles", () => {
  it.each([
    "/admin/panel",
    "/admin/roles",
    "/admin/departamentos",
    "/admin/auditoria",
  ])(
    "oculta el panel y evita lecturas privadas sin superadmin en %s",
    async (path) => {
      const { fetcher } = fixture(false);
      app(path);
      await screen.findByText("Acceso restringido");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /Panel de Administración/ }),
      ).not.toBeInTheDocument();
      expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
        "/backend/api/mi-perfil",
        "/backend/obtener_permisos_usuario_actual",
      ]);
    },
  );
  it("acepta superadmin como rol secundario y permite editar con el formulario compartido", async () => {
    const { writes } = fixture();
    app("/admin/panel");
    await screen.findByRole("table", { name: "Directorio de usuarios" });
    expect(
      screen.getByRole("link", { name: /Panel de Administración/ }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Editar operador" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Editar usuario" });
    const name = within(dialog).getByRole("textbox", {
      name: /Nombre completo/,
    });
    await userEvent.clear(name);
    await userEvent.type(name, "Nombre actualizado");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar cambios" }),
    );
    await waitFor(() =>
      expect(writes).toContainEqual({
        path: "/admin/guardar_usuario",
        method: "POST",
        body: {
          username: "operador",
          nombre_completo: "Nombre actualizado",
          email: "",
          departamento: "Almacén",
          cargo: "",
          activo: 1,
          roles: ["Operador"],
        },
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
  it("confirma cambios de estado y guarda una sola vez", async () => {
    const { writes } = fixture();
    app("/admin/panel");
    await screen.findByRole("table", { name: "Directorio de usuarios" });
    await userEvent.click(
      screen.getByRole("button", { name: "Desactivar operador" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Desactivar usuario" });
    expect(
      within(dialog).getByText("Se cerrarán sus sesiones activas."),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Desactivar" }),
    );
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      path: "/admin/cambiar_estado_usuario",
      method: "POST",
      body: { username: "operador", activo: false },
    });
    await screen.findByRole("button", { name: "Activar operador" });
  });
  it("reutiliza el editor de permisos con el contrato global y conserva permisos seleccionados", async () => {
    const { writes } = fixture();
    app("/admin/roles");
    await screen.findByRole("table", { name: "Roles del sistema" });
    await userEvent.click(
      screen.getByRole("button", { name: "Permisos de Operador" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Permisos de Operador",
    });
    const save = await within(dialog).findByRole("button", {
      name: "Guardar permisos",
    });
    await userEvent.click(save);
    await waitFor(() =>
      expect(writes).toContainEqual({
        path: "/admin/actualizar_permisos_dropdowns_rol",
        method: "POST",
        body: { rol_id: 4, permisos_ids: [9] },
      }),
    );
  });
  it("protege nombre y nivel de roles del sistema y permite guardar su descripción", async () => {
    const api = createPanelApi("live");
    const save = vi.spyOn(api, "savePanelRole").mockResolvedValue();
    render(
      <PanelRoleForm
        record={{ ...role, id: 1, nombre: "superadmin", nivel: 10 }}
        roles={[]}
        departments={[]}
        api={api}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(
      screen.getByRole("textbox", { name: /Nombre del rol/ }),
    ).toHaveAttribute("readonly");
    expect(screen.getByRole("combobox", { name: "Nivel" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ nombre: "superadmin", nivel: 10 }),
      ),
    );
  });
  it("evalúa rol principal, secundario y demostración sin elevar cuentas ordinarias", () => {
    const profile = { username: "x", nombre_completo: "X", rol: "operador" };
    expect(allowsRoles(profile, ["superadmin"], "live")).toBe(false);
    expect(
      allowsRoles({ ...profile, rol: "superadmin" }, ["superadmin"], "live"),
    ).toBe(true);
    expect(
      allowsRoles(
        { ...profile, roles: ["superadmin"] },
        ["superadmin"],
        "live",
      ),
    ).toBe(true);
    expect(allowsRoles(null, ["superadmin"], "live")).toBe(false);
    expect(allowsRoles(profile, ["superadmin"], "demo")).toBe(true);
  });
  it("conserva el formulario y sus valores cuando falla el guardado del rol", async () => {
    const api = createPanelApi("live");
    const save = vi
      .spyOn(api, "savePanelRole")
      .mockRejectedValue(new Error("Servidor ocupado"));
    const onSaved = vi.fn();
    render(
      <PanelRoleForm
        record={role}
        roles={[role]}
        departments={[]}
        api={api}
        onClose={() => {}}
        onSaved={onSaved}
      />,
    );
    const description = screen.getByRole("textbox", { name: "Descripción" });
    await userEvent.clear(description);
    await userEvent.type(description, "Descripción pendiente");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByText("Servidor ocupado");
    expect(description).toHaveValue("Descripción pendiente");
    expect(save).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
describe("contratos nativos del panel", () => {
  it("envía estado, desbloqueo, nivel, departamento y asignación N:M por sus rutas originales", async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
      response({ success: true }),
    );
    vi.stubGlobal("fetch", fetcher);
    const api = createPanelApi("live");
    await api.changeState("a", false);
    await api.unlock("a");
    await api.savePanelRole({
      nombre: "Inspector",
      descripcion: "Inspección",
      departamento: "Calidad",
      nivel: 3,
    });
    await api.savePanelRole({
      rol_id: 4,
      nombre: "Inspector",
      descripcion: "Inspección",
      departamento: "Calidad",
      nivel: 3,
    });
    await api.saveDepartment(null, " Calidad ", 1);
    await api.saveDepartment(
      { id: 2, nombre: "Calidad", activo: 1, total_usuarios: 0 },
      "QA",
      0,
    );
    await api.assignAreas([9, 9, 8], "Calidad", "remove");
    await api.deleteRole(4);
    await api.deleteDepartment(2);
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      "/backend/admin/cambiar_estado_usuario",
      "/backend/admin/desbloquear_usuario",
      "/backend/admin/crear_rol",
      "/backend/admin/actualizar_rol/4",
      "/backend/admin/crear_departamento",
      "/backend/admin/actualizar_departamento/2",
      "/backend/admin/api/permiso-departamentos-masivo",
      "/backend/admin/eliminar_rol/4",
      "/backend/admin/eliminar_departamento/2",
    ]);
    const options = fetcher.mock.calls.map(
      (call) => (call as unknown as [string, RequestInit])[1],
    );
    expect(options.map((item) => item.method)).toEqual([
      "POST",
      "POST",
      "POST",
      "PUT",
      "POST",
      "PUT",
      "POST",
      "DELETE",
      "DELETE",
    ]);
    expect(JSON.parse(String(options[6].body))).toEqual({
      permiso_ids: [9, 8],
      departamento: "Calidad",
      accion: "remove",
    });
    expect(JSON.parse(String(options[2].body))).toMatchObject({ nivel: 3 });
  });
  it("transforma permisos de registros a IDs y propaga AbortSignal", async () => {
    const fetcher = vi.fn(async () => response([{ id: 9, boton: "Material" }]));
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    expect(await createPanelApi("live").rolePermissions(4, signal)).toEqual([
      9,
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "/backend/admin/obtener_permisos_dropdowns_rol/4",
      expect.objectContaining({ signal }),
    );
  });
  it.each([{}, { registros: null }, "<html>login</html>"])(
    "rechaza una respuesta incompleta",
    async (body) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response(body)),
      );
      await expect(
        createPanelApi("live").audit(auditDefaults()),
      ).rejects.toThrow("incompletos");
    },
  );
  it("propaga el error sin reintentar una mutación", async () => {
    const fetcher = vi.fn(async () =>
      response({ error: "Rol asignado a usuarios" }, 400),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(createPanelApi("live").deleteRole(4)).rejects.toThrow(
      "Rol asignado a usuarios",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("codifica todos los filtros de auditoría y rechaza fechas invertidas en la entrada", () => {
    const filters = {
      ...auditDefaults(),
      usuario: "QA & admin",
      resultado: "ERROR",
      accion: "guardar",
      limite: "1000",
    };
    const query = new URLSearchParams(auditQuery(filters));
    expect(query.get("usuario")).toBe("QA & admin");
    expect(query.get("resultado")).toBe("ERROR");
    expect(query.get("accion")).toBe("guardar");
    expect(query.get("limite")).toBe("1000");
    expect(
      auditFilterIssue({
        ...filters,
        fecha_inicio: "2026-11-12",
        fecha_fin: "2026-11-11",
      }),
    ).toBeTruthy();
  });
  it("lee JSON histórico y oculta credenciales en los cambios auditados", () => {
    expect(
      auditData(
        '{"nombre":"Ana","password":"secreto","nested":{"token":"123"}}',
      ),
    ).toContain("Ana");
    expect(auditData({ password_hash: "abc" })).not.toContain("abc");
    expect(auditData("texto histórico")).toBe("texto histórico");
    expect(auditData(null)).toBe("—");
  });
  it("la demostración guarda roles, áreas y usuarios en memoria y descarta contraseñas", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const api = createPanelApi("demo");
    await api.savePanelRole({
      nombre: "Temporal QA",
      descripcion: "Prueba",
      departamento: "",
      nivel: 1,
    });
    const role = (await api.roles()).find(
      (row) => row.nombre === "Temporal QA",
    )!;
    await api.saveUser({
      username: "temporal.qa",
      nombre_completo: "Temporal",
      email: "",
      departamento: "",
      cargo: "",
      activo: 1,
      roles: [role.nombre],
      password: "clave-no-persistida",
    });
    await api.changeState("temporal.qa", false);
    expect(
      (await api.users()).find((row) => row.username === "temporal.qa")?.activo,
    ).toBe(0);
    expect(JSON.stringify(await api.users())).not.toContain(
      "clave-no-persistida",
    );
    await api.assignAreas([1], "Calidad", "add");
    expect(
      (await api.areas()).find((row) => row.id === 1)?.departamentos,
    ).toContain("Calidad");
    await expect(api.deleteRole(role.id)).rejects.toThrow("usuarios asignados");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
