import type { ProfileUpdate } from "@/core/auth/types";

export function validateProfile(values: ProfileUpdate): string[] {
  const errors: string[] = [];
  if (!values.nombre_completo.trim())
    errors.push("El nombre completo es obligatorio.");
  if (values.nombre_completo.trim().length > 120)
    errors.push("El nombre completo debe tener hasta 120 caracteres.");
  if (
    values.email.trim() &&
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim())
  )
    errors.push("Escribe un correo electrónico válido.");
  if (
    values.current_password ||
    values.new_password ||
    values.confirm_password
  ) {
    if (!values.current_password) errors.push("Escribe tu contraseña actual.");
    if (values.new_password.length < 6)
      errors.push("La nueva contraseña debe tener al menos 6 caracteres.");
    if (values.new_password !== values.confirm_password)
      errors.push("La confirmación de la nueva contraseña no coincide.");
    if (values.new_password && values.new_password === values.current_password)
      errors.push("La nueva contraseña debe ser diferente a la actual.");
  }
  return errors;
}
