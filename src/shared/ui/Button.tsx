import { Download, LoaderCircle } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: "primary" | "secondary" | "success" | "danger" | "ghost" | "plain";
  size?: "sm" | "md";
  icon?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
}
/** Native button semantics, common ILSAN variants and double-submit protection. */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading = false,
  loadingLabel,
  disabled,
  children,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const variantClass = {
    primary: "primary",
    secondary: "secondary",
    success: "success",
    danger: "destructive",
    ghost: "ghost",
    plain: "plain",
  }[variant];
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${variant === "plain" ? "ui-plain" : `button ${variantClass} ${size === "sm" ? "small" : ""}`} ${className}`}
    >
      {loading ? (
        <LoaderCircle size={16} className="spin" aria-hidden="true" />
      ) : (
        icon
      )}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
export type ExportButtonProps = Omit<ButtonProps, "variant">;
/** Shared export appearance. Each consumer supplies its own data, handler and loading state. */
export function ExportButton({
  children = "Exportar Excel",
  icon = <Download size={15} />,
  ...props
}: ExportButtonProps) {
  return (
    <Button {...props} variant="success" icon={icon}>
      {children}
    </Button>
  );
}
export interface IconButtonProps extends Omit<
  ButtonProps,
  "children" | "icon"
> {
  label: string;
  icon: ReactNode;
  tone?: "default" | "danger";
}
export function IconButton({
  label,
  icon,
  tone = "default",
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <Button
      {...props}
      variant="plain"
      aria-label={label}
      title={props.title || label}
      icon={icon}
      className={`icon-button ${tone === "danger" ? "danger-text" : ""} ${className}`}
    />
  );
}
