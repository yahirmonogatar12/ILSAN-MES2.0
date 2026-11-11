import { useEffect, useRef, useState, type ReactNode } from "react";
import "./disclosure-menu.css";

/** Native disclosure with outside-click dismissal and keyboard focus restoration. */
export function DisclosureMenu({
  label,
  children,
  align = "left",
  openOnHover = false,
  className = "",
}: {
  label: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  openOnHover?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDetailsElement>(null);
  const hovered = useRef(false);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      root.current?.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <details
      ref={root}
      className={"disclosure-menu disclosure-menu-" + align + " " + className}
      open={open}
      onPointerEnter={(event) => {
        hovered.current = event.pointerType === "mouse";
        if (openOnHover && hovered.current) setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (!openOnHover || event.pointerType !== "mouse") return;
        hovered.current = false;
        if (
          !root.current
            ?.querySelector(".disclosure-menu-content")
            ?.contains(document.activeElement)
        )
          setOpen(false);
      }}
    >
      <summary
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((previous) => !previous);
          }
        }}
        onClick={(event) => {
          event.preventDefault();
          if (openOnHover && hovered.current && event.detail > 0) setOpen(true);
          else setOpen((previous) => !previous);
        }}
      >
        {label}
      </summary>
      <div
        className="disclosure-menu-content"
        onClick={(event) => {
          if ((event.target as Element).closest("a,button")) {
            setOpen(false);
            if (root.current?.contains(document.activeElement))
              root.current.querySelector("summary")?.focus();
          }
        }}
      >
        {children}
      </div>
    </details>
  );
}
