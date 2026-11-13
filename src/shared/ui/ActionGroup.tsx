import { useMediaQuery } from "../hooks/useMediaQuery";
import { Button } from "./Button";
import { SelectField } from "./Fields";
export interface GroupAction {
  id: string;
  label: string;

  onClick: () => void;
  disabled?: boolean;
}
/** Same actions as buttons on desktop and a compact native picker on mobile. */
export function ActionGroup({
  label,
  actions,
}: {
  label: string;
  actions: readonly GroupAction[];
}) {
  const compact = useMediaQuery("(max-width: 700px)");
  if (!actions.length) return null;
  return compact ? (
    <SelectField
      label={label}
      containerClassName="action-group-picker"
      value=""
      options={[
        { value: "", label },
        ...actions.map((action) => ({
          value: action.id,
          label: action.label,
          disabled: action.disabled,
        })),
      ]}
      onChange={(event) => {
        const action = actions.find(
          (action) => action.id === event.target.value,
        );
        if (action && !action.disabled) action.onClick();
      }}
    />
  ) : (
    <div className="action-group">
      {actions.map((action) => (
        <Button
          key={action.id}
          size="sm"
          disabled={action.disabled}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
