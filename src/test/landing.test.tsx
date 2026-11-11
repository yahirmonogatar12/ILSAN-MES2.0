import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { SESSION_EXPIRED_EVENT } from "@/core/runtime";
import { createAuthGateway } from "@/core/auth/api";
import { validateProfile } from "@/app/landing/profile";
import { DisclosureMenu, Button } from "@/shared/ui";
afterEach(() => vi.restoreAllMocks());
const profile = {
  username: "qa-portal",
  nombre_completo: "Yahir QA",
  email: "qa@ilsan.test",
  rol: "superadmin",
  editable: true,
};
function server(authenticated = false) {
  const state = {
    authenticated,
    profile: { ...profile },
    posts: [] as { path: string; body: unknown }[],
  };
  const fetcher = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.replace("/backend", "");
    if (path === "/login") {
      state.posts.push({ path, body: init.body });
      state.authenticated = true;
      return Response.json({ success: true, redirect: "/inicio" });
    }
    if (path === "/logout") {
      state.authenticated = false;
      return new Response("", { status: 200 });
    }
    if (path === "/api/mi-perfil") {
      if (!state.authenticated)
        return Response.json(
          { success: false, message: "Sesión expirada" },
          { status: 401 },
        );
      if (init.method === "POST") {
        const body = JSON.parse(String(init.body));
        state.posts.push({ path, body });
        state.profile = {
          ...state.profile,
          nombre_completo: body.nombre_completo,
          email: body.email,
        };
      }
      return Response.json({ success: true, perfil: state.profile });
    }
    if (path === "/obtener_permisos_usuario_actual")
      return Response.json({
        usuario: profile.username,
        rol: "superadmin",
        permisos: {},
      });
    return Response.json([]);
  });
  vi.stubGlobal("fetch", fetcher);
  return { state, fetcher };
}
function mount(path = "/") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
}
async function openProfile() {
  await userEvent.click(
    (await screen.findByText("Menú de usuario")).closest("summary")!,
  );
  await userEvent.click(screen.getByRole("button", { name: "Mi Perfil" }));
  return screen.getByRole("dialog", { name: "Configuración de usuario" });
}
describe("Portal corporativo antes del MES", () => {
  it.each(["/", "/inicio", "/login"])(
    "muestra la portada completa sin sesión en %s",
    async (path) => {
      const { fetcher } = server();
      mount(path);
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled(),
      );
      expect(
        screen.getByRole("img", {
          name: "Planta de Ilsan Electronics en Monterrey",
        }),
      ).toHaveAttribute("src", "/brand/ilsan-facility.png");
      expect(
        screen.getAllByRole("heading", {
          name: "Bienvenido al Portal Integrado de Ilsan Electronics Monterrey México.",
        }),
      ).toHaveLength(6);
      expect(
        screen.getByRole("navigation", { name: "Portal corporativo" }),
      ).toBeInTheDocument();
      expect(
        fetcher.mock.calls.every(([url]) => url.endsWith("/api/mi-perfil")),
      ).toBe(true);
    },
  );
  it("solicita iniciar sesión al abrir MES y enfoca el usuario", async () => {
    server();
    mount();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled(),
    );
    await userEvent.click(screen.getByText("System Link"));
    await userEvent.click(screen.getByRole("link", { name: "ILSAN MES" }));
    expect(screen.getByRole("textbox", { name: "Usuario" })).toHaveFocus();
    expect(
      await screen.findByText("Inicia sesión para abrir esta aplicación."),
    ).toBeVisible();
  });
  it("inicia sesión en el portal y abre el MES desde System Link", async () => {
    const { state } = server();
    mount();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled(),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Usuario" }),
      "qa-portal",
    );
    await userEvent.type(screen.getByLabelText("Contraseña"), "segura&123");
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    await screen.findByText("Menú de usuario");
    expect(
      screen.queryByRole("navigation", { name: "Secciones del MES" }),
    ).not.toBeInTheDocument();
    expect(
      new URLSearchParams(state.posts[0].body as URLSearchParams).get(
        "password",
      ),
    ).toBe("segura&123");
    await userEvent.click(screen.getByText("System Link"));
    await userEvent.click(screen.getByRole("link", { name: "ILSAN MES" }));
    await screen.findByRole("navigation", { name: "Secciones del MES" });
  });
  it("con sesión activa conserva la landing y enlaza las aplicaciones originales", async () => {
    const { fetcher } = server(true);
    mount("/inicio");
    await screen.findByText("Menú de usuario");
    expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute(
      "href",
      "/portal-tickets",
    );
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "href",
      "/calendario",
    );
    await userEvent.click(screen.getByText("System Link"));
    expect(
      screen.getByRole("link", { name: "Defect Management" }),
    ).toHaveAttribute("href", "/defect-management");
    expect(
      fetcher.mock.calls.every(([url]) => url.endsWith("/api/mi-perfil")),
    ).toBe(true);
  });
  it("mantiene el destino de un enlace directo después del login", async () => {
    server();
    mount("/material/materiales");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled(),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Usuario" }),
      "qa-portal",
    );
    await userEvent.type(screen.getByLabelText("Contraseña"), "segura123");
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    await screen.findByRole("navigation", { name: "Secciones del MES" });
    expect(
      screen.queryByRole("navigation", { name: "Portal corporativo" }),
    ).not.toBeInTheDocument();
  });
  it("muestra el rechazo del login y vacía la contraseña", async () => {
    const { fetcher } = server();
    mount();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled(),
    );
    fetcher.mockImplementationOnce(async () =>
      Response.json(
        { success: false, message: "Credenciales incorrectas" },
        { status: 401 },
      ),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Usuario" }),
      "qa-portal",
    );
    await userEvent.type(screen.getByLabelText("Contraseña"), "incorrecta");
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Credenciales incorrectas",
    );
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Usuario" })).toHaveValue(
      "qa-portal",
    );
  });
  it("actualiza el perfil sin alterar usuario o rol y limpia las contraseñas", async () => {
    const { state } = server(true);
    mount("/inicio");
    const dialog = await openProfile();
    expect(within(dialog).getByLabelText("Usuario")).toHaveAttribute(
      "readonly",
    );
    expect(within(dialog).getByLabelText("Rol")).toHaveAttribute("readonly");
    await userEvent.clear(within(dialog).getByLabelText(/Nombre completo/));
    await userEvent.type(
      within(dialog).getByLabelText(/Nombre completo/),
      "Yahir actualizado",
    );
    await userEvent.clear(within(dialog).getByLabelText("Correo electrónico"));
    await userEvent.type(
      within(dialog).getByLabelText("Correo electrónico"),
      "nuevo@ilsan.test",
    );
    await userEvent.type(
      within(dialog).getByLabelText("Contraseña actual"),
      "actual123",
    );
    await userEvent.type(
      within(dialog).getByLabelText("Nueva contraseña"),
      "nueva123",
    );
    await userEvent.type(
      within(dialog).getByLabelText("Confirmar nueva contraseña"),
      "nueva123",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar cambios" }),
    );
    await within(dialog).findByText("Perfil actualizado correctamente.");
    expect(state.posts[0].body).toEqual({
      nombre_completo: "Yahir actualizado",
      email: "nuevo@ilsan.test",
      current_password: "actual123",
      new_password: "nueva123",
      confirm_password: "nueva123",
    });
    expect(within(dialog).getByLabelText("Nueva contraseña")).toHaveValue("");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cerrar" }),
    );
    const reopened = await openProfile();
    expect(within(reopened).getByLabelText(/Nombre completo/)).toHaveValue(
      "Yahir actualizado",
    );
    expect(within(reopened).getByLabelText("Contraseña actual")).toHaveValue(
      "",
    );
  });
  it("un guardado con sesión expirada vuelve al acceso del portal", async () => {
    const { state } = server(true);
    mount("/inicio");
    const dialog = await openProfile();
    state.authenticated = false;
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar cambios" }),
    );
    await screen.findByRole("button", { name: "Ingresar" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Menú de usuario")).not.toBeInTheDocument();
  });
  it("una respuesta tardía del perfil conserva la sesión expirada", async () => {
    const { fetcher } = server(true);
    mount("/inicio");
    const dialog = await openProfile();
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>((done) => {
      resolve = done;
    });
    fetcher.mockImplementationOnce(async () => pending);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar cambios" }),
    );
    act(() => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)));
    await screen.findByRole("button", { name: "Ingresar" });
    await act(async () =>
      resolve(Response.json({ success: true, perfil: profile })),
    );
    expect(screen.queryByText("Menú de usuario")).not.toBeInTheDocument();
  });
  it("cierra sesión desde el portal", async () => {
    const { state } = server(true);
    mount("/inicio");
    await userEvent.click(
      (await screen.findByText("Menú de usuario")).closest("summary")!,
    );
    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    await screen.findByRole("button", { name: "Ingresar" });
    expect(state.authenticated).toBe(false);
  });
});
describe("Contrato de perfil y menú compartido", () => {
  const values = {
    nombre_completo: "QA",
    email: "qa@ilsan.test",
    current_password: "",
    new_password: "",
    confirm_password: "",
  };
  it.each([
    { ...values, nombre_completo: " " },
    { ...values, nombre_completo: "x".repeat(121) },
    { ...values, email: "invalido" },
    { ...values, new_password: "nueva123", confirm_password: "nueva123" },
    {
      ...values,
      current_password: "actual",
      new_password: "123",
      confirm_password: "123",
    },
    {
      ...values,
      current_password: "actual",
      new_password: "nueva123",
      confirm_password: "diferente",
    },
    {
      ...values,
      current_password: "misma123",
      new_password: "misma123",
      confirm_password: "misma123",
    },
  ])("valida el contrato original del perfil", (data) =>
    expect(validateProfile(data).length).toBeGreaterThan(0),
  );
  it("acepta actualizar datos conservando las contraseñas vacías", () =>
    expect(validateProfile(values)).toEqual([]));
  it("mantiene las contraseñas y normaliza solo nombre y correo al enviar", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ success: true, perfil: profile }),
    );
    vi.stubGlobal("fetch", fetcher);
    await createAuthGateway("live").saveProfile({
      ...values,
      nombre_completo: " QA ",
      email: " qa@ilsan.test ",
      current_password: " actual ",
      new_password: " nueva ",
      confirm_password: " nueva ",
    });
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/backend/api/mi-perfil");
    expect(JSON.parse(String(init.body))).toEqual({
      ...values,
      current_password: " actual ",
      new_password: " nueva ",
      confirm_password: " nueva ",
    });
  });
  it("permite cerrar el menú con Escape y recuperar el foco", async () => {
    render(
      <DisclosureMenu label="Abrir menú">
        <Button>Acción</Button>
      </DisclosureMenu>,
    );
    const summary = screen.getByText("Abrir menú");
    await userEvent.click(summary);
    expect(screen.getByRole("button", { name: "Acción" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(summary).toHaveFocus();
  });
  it("abre por hover y permite llevar el cursor al enlace del menú", async () => {
    render(
      <DisclosureMenu label="Sistemas" openOnHover>
        <a href="/mes">Abrir MES</a>
      </DisclosureMenu>,
    );
    const summary = screen.getByText("Sistemas");
    const menu = summary.closest("details")!;
    await userEvent.hover(summary);
    expect(menu).toHaveAttribute("open");
    await userEvent.click(summary);
    expect(menu).toHaveAttribute("open");
    await userEvent.hover(screen.getByRole("link", { name: "Abrir MES" }));
    expect(menu).toHaveAttribute("open");
    await userEvent.unhover(screen.getByRole("link", { name: "Abrir MES" }));
    expect(menu).not.toHaveAttribute("open");
  });
  it("mantiene la apertura y cierre por teclado con hover habilitado", async () => {
    render(
      <DisclosureMenu label="Sistemas" openOnHover>
        <a href="/mes">Abrir MES</a>
      </DisclosureMenu>,
    );
    const summary = screen.getByText("Sistemas");
    summary.focus();
    await userEvent.keyboard("{Enter}");
    expect(summary.closest("details")).toHaveAttribute("open");
    await userEvent.keyboard("{Enter}");
    expect(summary.closest("details")).not.toHaveAttribute("open");
  });
  it("mantiene la apertura y cierre táctil con hover habilitado", async () => {
    render(
      <DisclosureMenu label="Sistemas" openOnHover>
        <a href="/mes">Abrir MES</a>
      </DisclosureMenu>,
    );
    const summary = screen.getByText("Sistemas");
    await userEvent.pointer({ keys: "[TouchA]", target: summary });
    expect(summary.closest("details")).toHaveAttribute("open");
    await userEvent.pointer({ keys: "[TouchA]", target: summary });
    expect(summary.closest("details")).not.toHaveAttribute("open");
  });
});
