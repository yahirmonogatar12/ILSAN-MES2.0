import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImageViewer } from "./ImageViewer";

const NativeURL = URL;
let count = 0;
const create = vi.fn(() => "blob:qa-" + ++count);
const revoke = vi.fn();
beforeEach(() => {
  count = 0;
  create.mockClear();
  revoke.mockClear();
  vi.stubGlobal(
    "URL",
    class extends NativeURL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
});
async function ready() {
  const img = await screen.findByAltText("Prueba");
  Object.defineProperty(img, "naturalWidth", {
    configurable: true,
    value: 1600,
  });
  Object.defineProperty(img, "complete", { configurable: true, value: true });
  fireEvent.load(img);
  return img;
}
function pointer(element: HTMLElement, type: string, x: number, y: number) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  fireEvent(element, event);
}
describe("ImageViewer", () => {
  it("crea una URL por imagen y libera cada recurso al cambiar o cerrar", async () => {
    const first = new Blob(["first"]),
      second = new Blob(["second"]);
    const onLoad = vi.fn();
    const result = render(
      <ImageViewer blob={first} alt="Prueba" onLoad={onLoad} />,
    );
    await ready();
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Nivel de zoom")).toHaveTextContent("100%");
    result.rerender(<ImageViewer blob={second} alt="Prueba" />);
    await ready();
    expect(create).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledWith("blob:qa-1");
    result.unmount();
    expect(revoke).toHaveBeenCalledWith("blob:qa-2");
  });
  it("amplía con botones y rueda, limita a 600% y restablece a 100%", async () => {
    render(<ImageViewer blob={new Blob(["image"])} alt="Prueba" />);
    const img = await ready();
    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar zoom" }),
    );
    expect(screen.getByLabelText("Nivel de zoom")).toHaveTextContent("120%");
    const region = screen.getByRole("region", { name: "Imagen ampliable" });
    act(() => {
      for (let index = 0; index < 40; index++)
        region.dispatchEvent(
          new WheelEvent("wheel", { deltaY: -100, cancelable: true }),
        );
    });
    expect(screen.getByLabelText("Nivel de zoom")).toHaveTextContent("600%");
    expect(
      screen.getByRole("button", { name: "Aumentar zoom" }),
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Restablecer imagen" }),
    );
    expect(screen.getByLabelText("Nivel de zoom")).toHaveTextContent("100%");
    expect(img).toHaveStyle({ transform: "translate(0px, 0px) scale(1)" });
    expect(screen.getByRole("button", { name: "Reducir zoom" })).toBeDisabled();
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("arrastra la imagen ampliada y permite reposicionarla con el teclado", async () => {
    render(<ImageViewer blob={new Blob(["image"])} alt="Prueba" />);
    const img = await ready();
    const region = screen.getByRole("region", { name: "Imagen ampliable" });
    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar zoom" }),
    );
    pointer(region, "pointerdown", 50, 50);
    pointer(region, "pointermove", 80, 95);
    expect(img).toHaveStyle({ transform: "translate(30px, 45px) scale(1.2)" });
    pointer(region, "pointerup", 80, 95);
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(img).toHaveStyle({ transform: "translate(-10px, 45px) scale(1.2)" });
    fireEvent.keyDown(region, { key: "Home" });
    expect(img).toHaveStyle({ transform: "translate(0px, 0px) scale(1)" });
  });
  it("comunica una imagen inválida y mantiene los controles bloqueados", async () => {
    const onError = vi.fn();
    render(
      <ImageViewer blob={new Blob(["bad"])} alt="Prueba" onError={onError} />,
    );
    const img = await screen.findByAltText("Prueba");
    fireEvent.error(img);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudo mostrar la imagen recibida.",
    );
    expect(
      screen.getByRole("button", { name: "Aumentar zoom" }),
    ).toBeDisabled();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
