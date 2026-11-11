import { useMemo, useState } from "react";
import { FilterX } from "lucide-react";
import { Button } from "../Button";
import { TextField } from "../Fields";
import { GridPopup, type GridAnchor } from "./GridPopup";

export function ColumnFilter({
  anchor,
  title,
  values,
  current,
  onApply,
  onClose,
}: {
  anchor: GridAnchor;
  title: string;
  values: readonly string[];
  current?: readonly string[];
  onApply: (values: readonly string[] | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState(() => new Set(current || values));
  const [append, setAppend] = useState(false);
  const visible = useMemo(
    () =>
      values.filter((value) =>
        (value || "(Vacías)")
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
      ),
    [values, query],
  );
  const chosen = new Set(visible.filter((value) => checked.has(value)));
  if (query && append)
    (current || values).forEach((value) => chosen.add(value));
  const checkedCount = visible.filter((value) => checked.has(value)).length;
  return (
    <GridPopup anchor={anchor} title={`Filtrar ${title}`} onClose={onClose}>
      {current && (
        <Button
          variant="plain"
          className="grid-clear-filter"
          icon={<FilterX size={13} />}
          onClick={() => onApply(null)}
        >
          Quitar filtro de esta columna
        </Button>
      )}
      <TextField
        type="search"
        aria-label={`Buscar valores de ${title}`}
        placeholder="Buscar valores…"
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setChecked(
            new Set(
              next.trim()
                ? values.filter((value) =>
                    (value || "(Vacías)")
                      .toLocaleLowerCase()
                      .includes(next.trim().toLocaleLowerCase()),
                  )
                : current || values,
            ),
          );
        }}
      />
      <TextField
        type="checkbox"
        label="Seleccionar todos los resultados"
        checked={visible.length > 0 && checkedCount === visible.length}
        ref={(element) => {
          if (element)
            element.indeterminate =
              checkedCount > 0 && checkedCount < visible.length;
        }}
        onChange={() =>
          setChecked((previous) => {
            const next = new Set(previous);
            visible.forEach((value) =>
              checkedCount === visible.length
                ? next.delete(value)
                : next.add(value),
            );
            return next;
          })
        }
      />
      <div className="grid-filter-values">
        {visible.map((value) => (
          <TextField
            key={value}
            type="checkbox"
            label={value || "(Vacías)"}
            checked={checked.has(value)}
            onChange={() =>
              setChecked((previous) => {
                const next = new Set(previous);
                if (next.has(value)) next.delete(value);
                else next.add(value);
                return next;
              })
            }
          />
        ))}
        {!visible.length && <p>Sin coincidencias</p>}
      </div>
      {query && current && (
        <TextField
          type="checkbox"
          label="Agregar a la selección actual"
          checked={append}
          onChange={(event) => setAppend(event.target.checked)}
        />
      )}
      <div className="grid-popup-actions">
        <Button size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!chosen.size}
          onClick={() =>
            onApply(
              values.every((value) => chosen.has(value)) ? null : [...chosen],
            )
          }
        >
          Aplicar
        </Button>
      </div>
    </GridPopup>
  );
}
