import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "./RichText";
import { Button, Modal } from "./index";
describe("shared rich text", () => {
  it("escapes HTML and refuses script links while preserving readable text", () => {
    const { container } = render(
      <RichText
        text={
          "<script>alert(1)</script>\n[Unsafe](javascript:alert)\n[Docs](https://example.com/help)"
        }
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.queryByRole("link", { name: "Unsafe" })).toBeNull();
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });
  it("renders tables through the shared table and code as literal text", () => {
    render(
      <RichText
        text={
          "# Resultados\n| Parte | Qty |\n| --- | --- |\n| **PCB** | 50 |\n\n- Revisar\n\n```sql\nSELECT * FROM plan;\n```"
        }
      />,
    );
    expect(
      screen.getByRole("table", { name: "Tabla de la respuesta" }),
    ).toHaveClass("ui-data-table");
    expect(screen.getByRole("columnheader", { name: "Parte" })).toBeVisible();
    expect(screen.getByText("PCB").tagName).toBe("STRONG");
    expect(screen.getByRole("listitem")).toHaveTextContent("Revisar");
    expect(screen.getByText("SELECT * FROM plan;").tagName).toBe("CODE");
  });
  it("composes header actions without losing the modal close control", () => {
    render(
      <Modal
        title="Chat"
        onClose={() => {}}
        headerActions={<Button>Expandir</Button>}
      >
        <p>Contenido</p>
      </Modal>,
    );
    expect(screen.getByRole("button", { name: "Expandir" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Cerrar ventana" }),
    ).toBeVisible();
  });
});
