import { describe, expect, it, vi } from "vitest";
import { createAdministrationApi } from "./api";
import { createAuthGateway } from "@/core/auth/api";
import { AUTHORITY_PERMISSION, USER_PERMISSION } from "./config";
import {
  assignableSelection,
  rolePayload,
  toggleSelection,
  userDraft,
  userEditIssue,
  userPayload,
  validateRole,
  validateUser,
} from "./model";
import type {
  AuthorityContext,
  PermissionCatalog,
  UserContext,
  UserRecord,
} from "./types";

const context: UserContext = {
  es_superadmin: false,
  departamento_propio: "Calidad",
  departamentos: ["Calidad"],
  roles: ["Inspector"],
  cargos: ["Inspector"],
};
const user: UserRecord = {
  id: 1,
  username: "qa.usuario",
  nombre_completo: "Usuario QA",
  email: "",
  departamento: "Calidad",
  cargo: "Inspector",
  activo: 1,
  ultimo_acceso: "",
  roles: ["Inspector"],
};
const authority: AuthorityContext = {
  es_superadmin: false,
  departamento: "Calidad",
};
const catalog: PermissionCatalog = {
  LISTA_CONTROL_DE_CALIDAD: {
    Inspección: [{ id: 7, boton: "Consultar", descripcion: null }],
  },
};
function mock(value: unknown, status = 200) {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
describe("administración: contrato y alcance del backend original", () => {
  it.each([USER_PERMISSION, AUTHORITY_PERMISSION])(
    "consulta el permiso exacto $boton",
    async (permission) => {
      const fetcher = mock({ tiene_permiso: true });
      await createAuthGateway("live").permission(permission);
      expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(permission);
    },
  );
  it("consulta usuarios, roles y permisos en sus endpoints delegados y conserva abortos", async () => {
    const fetcher = mock(context);
    const api = createAdministrationApi("live");
    const signal = new AbortController().signal;
    await api.userContext(signal);
    mock([]);
    await api.users(signal);
    mock(authority);
    await api.authorityContext(signal);
    mock([]);
    await api.roles(signal);
    mock(catalog);
    await api.availablePermissions(signal);
    const assigned = mock([7]);
    await api.rolePermissions(42, signal);
    expect(fetcher.mock.calls[0][0]).toBe(
      "/backend/api/admin-usuarios-depto/contexto",
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      signal,
      credentials: "same-origin",
    });
    expect(assigned.mock.calls[0][0]).toBe(
      "/backend/api/gestion-roles-depto/permisos-rol/42",
    );
    expect(assigned.mock.calls[0][1].signal).toBe(signal);
  });
  it("envía las escrituras al contrato original, sin cambiar contraseñas vacías ni el nivel del rol", async () => {
    const api = createAdministrationApi("live");
    let fetcher = mock({ success: true, mensaje: "Guardado" });
    const draft = userDraft(user, context);
    await api.saveUser(
      userPayload({ ...draft, departamento: "Producción" }, context),
    );
    expect(fetcher.mock.calls[0][0]).toBe(
      "/backend/api/admin-usuarios-depto/guardar_usuario",
    );
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      username: "qa.usuario",
      nombre_completo: "Usuario QA",
      email: "",
      departamento: "Calidad",
      cargo: "Inspector",
      activo: 1,
      roles: ["Inspector"],
    });
    fetcher = mock({ success: true, rol_id: 42 });
    await api.saveRole(
      rolePayload(
        {
          nombre: " Inspector ",
          descripcion: " QA ",
          departamento: "Producción",
        },
        {
          id: 42,
          nombre: "Inspector",
          descripcion: "",
          departamento: "Calidad",
          nivel: 7,
          total_usuarios: 1,
        },
        authority,
      ),
    );
    expect(fetcher.mock.calls[0][0]).toBe(
      "/backend/api/gestion-roles-depto/guardar-rol",
    );
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      rol_id: 42,
      nombre: "Inspector",
      descripcion: "QA",
      departamento: "Calidad",
    });
    fetcher = mock({ success: true, mensaje: "Guardado" });
    await api.savePermissions(42, assignableSelection([7, 999, 7], catalog));
    expect(fetcher.mock.calls[0][0]).toBe(
      "/backend/api/gestion-roles-depto/guardar-permisos",
    );
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      rol_id: 42,
      permisos_ids: [7],
    });
  });
  it("conserva literalmente la contraseña nueva y exige una al crear", () => {
    const draft = userDraft(null, context);
    expect(
      validateUser(
        { ...draft, username: "nuevo", nombre_completo: "Nuevo" },
        null,
        context,
        [],
      ),
    ).toContain("La contraseña es requerida para nuevos usuarios.");
    expect(
      userPayload({ ...draft, password: " x& y " }, context).password,
    ).toBe(" x& y ");
    expect(userDraft(user, context).password).toBe("");
  });
  it("protege admin, usuarios fuera del área y roles que no se pueden preservar desde este alcance", () => {
    expect(userEditIssue({ ...user, username: "admin" }, context)).toMatch(
      /protegido/,
    );
    expect(
      userEditIssue({ ...user, departamento: "Producción" }, context),
    ).toMatch(/departamento/);
    expect(userEditIssue({ ...user, roles: ["superadmin"] }, context)).toMatch(
      /roles fuera de tu alcance/,
    );
    expect(
      validateUser(
        { ...userDraft(user, context), roles: ["superadmin"] },
        user,
        context,
        [user],
      ),
    ).toContain("Hay roles fuera de tu alcance.");
    expect(
      validateUser(
        userDraft(null, { ...context, departamento_propio: null }),
        null,
        { ...context, departamento_propio: null },
        [],
      ),
    ).toContain("Tu usuario no tiene departamento asignado.");
    expect(
      validateRole(
        { nombre: "superadmin", descripcion: "", departamento: "Calidad" },
        null,
        authority,
        [],
      ),
    ).toContain("El nombre del rol está reservado.");
  });
  it("impide el upsert accidental de un usuario existente y conserva departamentos de roles al editar como superadmin", () => {
    expect(
      validateUser(
        { ...userDraft(user, context), password: "nueva" },
        null,
        context,
        [user],
      ),
    ).toContain("El usuario ya existe. Edítalo desde la tabla.");
    const payload = rolePayload(
      { nombre: "QA", descripcion: "", departamento: "Calidad" },
      {
        id: 4,
        nombre: "QA",
        descripcion: "",
        nivel: 3,
        total_usuarios: 0,
        departamento: "Calidad",
      },
      { es_superadmin: true, departamento: null },
    );
    expect(payload.departamento).toBe("Calidad");
  });
  it("selecciona solamente IDs delegables y alterna grupos sin perder selecciones de otras páginas", () => {
    expect(assignableSelection([7, 999], catalog)).toEqual([7]);
    expect(toggleSelection([7, 8], [7])).toEqual([8]);
    expect(toggleSelection([8], [7])).toEqual([8, 7]);
  });
  it.each([
    { error: "Sin catálogo" },
    { Página: { Sección: [{ id: "7", boton: "Consultar" }] } },
  ])(
    "rechaza un catálogo incompleto antes de editar permisos (%j)",
    async (value) => {
      mock(value);
      await expect(
        createAdministrationApi("live").availablePermissions(),
      ).rejects.toThrow(/incompletos/);
    },
  );
  it("acepta un catálogo vacío como ausencia de permisos disponibles", async () => {
    mock({});
    expect(
      await createAdministrationApi("live").availablePermissions(),
    ).toEqual({});
  });
  it("expone errores 403 del servidor sin reintentar una escritura", async () => {
    const fetcher = mock({ error: "Rol fuera de tu alcance" }, 403);
    await expect(
      createAdministrationApi("live").savePermissions(42, [7]),
    ).rejects.toThrow("Rol fuera de tu alcance");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
