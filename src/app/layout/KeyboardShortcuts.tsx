import { useEffect, useState } from "react";
import { isTextEntry } from "@/shared/lib/focus";
import { DialogBody, Modal } from "@/shared/ui";
import { focusRegion } from "./keyboard";

const groups: [string, [string, string][]][] = [
  [
    "Ir a",
    [
      ["Alt+1", "Secciones de la barra superior"],
      ["Alt+2", "Menú lateral de módulos"],
      ["Alt+3", "Pestañas abiertas"],
      ["Alt+4", "Primer filtro de la pantalla"],
      ["Alt+5", "Tabla de la pantalla"],
      ["?", "Esta ayuda"],
    ],
  ],
  [
    "Tablas",
    [
      ["Flechas", "Moverse entre celdas"],
      ["Tab / Mayús+Tab", "Siguiente o anterior celda y sus botones"],
      ["Ctrl+Fin y Tab", "Salir de la tabla hacia abajo"],
      ["Inicio / Fin", "Primera o última columna"],
      ["Ctrl+Inicio / Ctrl+Fin", "Primera o última fila"],
      ["Re Pág / Av Pág", "Subir o bajar una pantalla"],
      ["Enter en encabezado", "Ordenar por esa columna"],
      ["Alt+↓ o Tab al embudo", "Abrir el filtro de la columna"],
      ["Mayús+← / →", "Ajustar ancho (en el encabezado)"],
      [
        "Enter o F2 en celda",
        "Entrar al botón o campo de la celda, o abrir el registro",
      ],
      ["Ctrl+C", "Copiar la celda"],
    ],
  ],
  [
    "Filtro de columna",
    [
      ["↑ / ↓", "Moverse entre búsqueda, valores y botones"],
      ["Espacio", "Marcar o desmarcar un valor"],
      ["Enter", "Aplicar el filtro"],
      ["Tab", "Recorrer el filtro sin salirse"],
      ["Esc", "Cancelar"],
    ],
  ],
  [
    "General",
    [
      ["Tab / Mayús+Tab", "Siguiente o anterior control"],
      ["← / → en secciones", "Cambiar de sección y ver su lista"],
      ["↓ en secciones", "Entrar a la lista de módulos"],
      ["↑ / ↓ en la lista", "Moverse entre módulos; Enter abre"],
      ["Flechas en pestañas", "Cambiar de pestaña"],
      ["Ctrl+Mayús+← / → en una pestaña", "Moverla a la izquierda o derecha"],
      ["Supr en una pestaña", "Cerrar la pestaña"],
      ["Enter en un filtro", "Consultar"],
      ["Esc", "Cerrar filtro, menú o ventana"],
    ],
  ],
];

/** Global jumps between screen regions plus a help sheet; tables handle their own keys. */
export function KeyboardShortcuts() {
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A modal owns the keyboard while open; AltGr arrives as Ctrl+Alt and types characters.
      if (event.defaultPrevented || document.querySelector("dialog[open]"))
        return;
      const digit = /^(?:Digit|Numpad)([1-5])$/.exec(event.code)?.[1];
      if (digit && event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        focusRegion(digit);
      } else if (event.key === "?" && !isTextEntry(event.target)) {
        event.preventDefault();
        setHelp(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  if (!help) return null;
  return (
    <Modal title="Atajos de teclado" onClose={() => setHelp(false)} size="lg">
      <DialogBody>
        <div className="keyboard-help">
          {groups.map(([title, items]) => (
            <section key={title}>
              <h3>{title}</h3>
              <dl>
                {items.map(([keys, action]) => (
                  <div key={keys}>
                    <dt>
                      <kbd>{keys}</kbd>
                    </dt>
                    <dd>{action}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogBody>
    </Modal>
  );
}
