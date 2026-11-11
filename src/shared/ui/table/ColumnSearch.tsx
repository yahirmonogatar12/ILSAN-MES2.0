import { useMemo, useState } from "react";
import { Button } from "../Button";
import { TextField } from "../Fields";
import { GridPopup, type GridAnchor } from "./GridPopup";

export interface ColumnSearchOption {
  value: string;
  label: string;
}
/** Server text criterion with suggestions from the loaded records or supplied options. */
export function ColumnSearch({
  anchor,
  title,
  current = "",
  values = [],
  label = "Contiene",
  onApply,
  onClose,
}: {
  anchor: GridAnchor;
  title: string;
  current?: string;
  values?: readonly ColumnSearchOption[];
  label?: string;
  onApply: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(current);
  const visible = useMemo(() => {
    const query = value.trim().toLocaleLowerCase("es");
    return values.filter(
      (option) =>
        option.label.toLocaleLowerCase("es").includes(query) ||
        option.value.toLocaleLowerCase("es").includes(query),
    );
  }, [value, values]);
  return (
    <GridPopup anchor={anchor} title={`Filtrar ${title}`} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onApply(value.trim());
        }}
      >
        <TextField
          type="search"
          label={label}
          aria-label={`Texto para filtrar ${title}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Buscar en esta columna…"
        />
        <p className="grid-search-values-label">Valores cargados</p>
        <div
          className="grid-filter-values grid-search-values"
          role="group"
          aria-label={`Valores de ${title}`}
        >
          {visible.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant="plain"
              className="grid-search-value"
              aria-pressed={value === option.value}
              title={option.label}
              onClick={() => setValue(option.value)}
            >
              {option.label}
            </Button>
          ))}
          {!visible.length && (
            <p>
              {values.length
                ? "Sin coincidencias en los valores cargados."
                : "Sin valores cargados."}
            </p>
          )}
        </div>
        <div className="grid-popup-actions">
          <Button size="sm" onClick={() => onApply("")}>
            Quitar filtro
          </Button>
          <Button size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" variant="primary" type="submit">
            Aplicar
          </Button>
        </div>
      </form>
    </GridPopup>
  );
}
