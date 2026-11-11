import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { SESSION_EXPIRED_EVENT } from "@/core/runtime";

function mount(path = "/material/materiales") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
}
describe("integración del módulo con la base compartida", () => {
  it("completa alta, edición, historial y baja usando los componentes compartidos sin red", async () => {
    localStorage.setItem("mes-v2:mode", JSON.stringify("demo"));
    const fetcher = vi.fn(() => {
      throw new Error("La demostración no debe usar HTTP");
    });
    vi.stubGlobal("fetch", fetcher);
    mount();
    await screen.findByRole("table", { name: "Materiales registrados" });
    const navigation = screen.getByRole("navigation", {
      name: "Secciones del MES",
    });
    expect(
      within(navigation).getByRole("link", { name: "Control de material" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(navigation).getByRole("link", { name: "Información básica" }),
    ).toHaveAttribute("href", "/informacion-basica/usuarios");
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Buscar materiales" }),
      "QA/74-11",
    );
    await screen.findByText("No encontramos materiales");
    await userEvent.click(
      screen.getByRole("button", { name: "Nuevo material" }),
    );
    let dialog = screen.getByRole("dialog", { name: "Nuevo material" });
    await userEvent.type(
      within(dialog).getByLabelText(/Número de parte/),
      "QA/74-11",
    );
    await userEvent.type(
      within(dialog).getByLabelText(/Especificación del material/),
      "PCB de prueba",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Agregar vendedor" }),
    );
    await userEvent.type(
      within(dialog).getByLabelText("Vendedor 1"),
      "Vendedor QA",
    );
    await userEvent.type(
      within(dialog).getByLabelText("Costo del vendedor 1"),
      "0.1250",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Registrar material" }),
    );
    await screen.findByRole("button", { name: "QA/74-11" });
    await userEvent.click(
      screen.getByRole("button", { name: "Editar QA/74-11" }),
    );
    dialog = await screen.findByRole("dialog", { name: "Editar material" });
    expect(within(dialog).getByLabelText(/Número de parte/)).toHaveAttribute(
      "readonly",
    );
    await userEvent.clear(
      within(dialog).getByLabelText("Costo del vendedor 1"),
    );
    await userEvent.type(
      within(dialog).getByLabelText("Costo del vendedor 1"),
      "0.2500",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar cambios" }),
    );
    await screen.findByText("0.2500 USD");
    await userEvent.click(
      screen.getByRole("button", { name: "Historial de QA/74-11" }),
    );
    const history = await screen.findByRole("table", {
      name: "Historial de costos",
    });
    expect(history).toHaveTextContent("0.1250 USD");
    expect(history).toHaveTextContent("0.2500 USD");
    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar historial" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Dar de baja QA/74-11" }),
    );
    dialog = await screen.findByRole("dialog", {
      name: "Dar de baja material",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Dar de baja" }),
    );
    await screen.findByText("No encontramos materiales");
    expect(
      screen.queryByRole("button", { name: "QA/74-11" }),
    ).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  }, 15000);
  it("la ruta anterior redirige al módulo dentro de Control de material", async () => {
    localStorage.setItem("mes-v2:mode", JSON.stringify("demo"));
    mount("/informacion-basica/materiales");
    await screen.findByRole("table", { name: "Materiales registrados" });
    const navigation = screen.getByRole("navigation", {
      name: "Secciones del MES",
    });
    expect(
      within(navigation).getByRole("link", { name: "Control de material" }),
    ).toHaveAttribute("href", "/material/materiales");
    expect(
      within(navigation).getByRole("link", { name: "Control de material" }),
    ).toHaveAttribute("aria-current", "page");
  });
  it("un permiso denegado impide montar el módulo y sus acciones", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
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
      ),
    );
    mount();
    await screen.findByText("Acceso restringido");
    expect(
      screen.queryByRole("button", { name: "Nuevo material" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("la expiración de sesión retira el módulo y sus datos", async () => {
    localStorage.setItem("mes-v2:mode", JSON.stringify("demo"));
    mount();
    await screen.findByRole("table", { name: "Materiales registrados" });
    act(() => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)));
    await screen.findByRole("heading", { name: "Iniciar sesión" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
